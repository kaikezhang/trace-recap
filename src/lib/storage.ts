import { openDB, type IDBPDatabase } from "idb";
import type { ProjectMeta } from "@/types";
import type { ImportRouteData } from "@/stores/projectStore";

const DB_NAME = "trace-recap";
const DB_VERSION = 1;

const STORE_PROJECTS = "projects"; // ProjectMeta records
const STORE_PROJECT_DATA = "projectData"; // Full ImportRouteData keyed by project id

interface TraceRecapDB {
  projects: {
    key: string;
    value: ProjectMeta;
    indexes: { "by-updatedAt": number };
  };
  projectData: {
    key: string;
    value: ImportRouteData;
  };
}

let dbPromise: Promise<IDBPDatabase<TraceRecapDB>> | null = null;

function getDB(): Promise<IDBPDatabase<TraceRecapDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TraceRecapDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          const store = db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
          store.createIndex("by-updatedAt", "updatedAt");
        }
        if (!db.objectStoreNames.contains(STORE_PROJECT_DATA)) {
          db.createObjectStore(STORE_PROJECT_DATA);
        }
      },
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Project metadata CRUD
// ---------------------------------------------------------------------------

export async function listProjects(): Promise<ProjectMeta[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORE_PROJECTS, "by-updatedAt");
  // Most recently updated first
  return all.reverse();
}

export async function getProjectMeta(
  id: string,
): Promise<ProjectMeta | undefined> {
  const db = await getDB();
  return db.get(STORE_PROJECTS, id);
}

export async function putProjectMeta(meta: ProjectMeta): Promise<void> {
  const db = await getDB();
  await db.put(STORE_PROJECTS, meta);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([STORE_PROJECTS, STORE_PROJECT_DATA], "readwrite");
  await Promise.all([
    tx.objectStore(STORE_PROJECTS).delete(id),
    tx.objectStore(STORE_PROJECT_DATA).delete(id),
    tx.done,
  ]);
}

export async function renameProject(
  id: string,
  name: string,
): Promise<void> {
  const db = await getDB();
  const meta = await db.get(STORE_PROJECTS, id);
  if (!meta) return;
  meta.name = name;
  meta.updatedAt = Date.now();
  await db.put(STORE_PROJECTS, meta);
}

// ---------------------------------------------------------------------------
// Project data (full route data)
// ---------------------------------------------------------------------------

export async function getProjectData(
  id: string,
): Promise<ImportRouteData | undefined> {
  const db = await getDB();
  return db.get(STORE_PROJECT_DATA, id);
}

export async function putProjectData(
  id: string,
  data: ImportRouteData,
): Promise<void> {
  const db = await getDB();
  await db.put(STORE_PROJECT_DATA, data, id);
}

// ---------------------------------------------------------------------------
// Save a project (meta + data) in a single transaction
// ---------------------------------------------------------------------------

export async function saveProject(
  meta: ProjectMeta,
  data: ImportRouteData,
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([STORE_PROJECTS, STORE_PROJECT_DATA], "readwrite");
  await Promise.all([
    tx.objectStore(STORE_PROJECTS).put(meta),
    tx.objectStore(STORE_PROJECT_DATA).put(data, meta.id),
    tx.done,
  ]);
}

// ---------------------------------------------------------------------------
// Duplicate a project
// ---------------------------------------------------------------------------

export async function duplicateProject(
  sourceId: string,
  newId: string,
  newName: string,
): Promise<ProjectMeta | null> {
  const db = await getDB();
  const [meta, data] = await Promise.all([
    db.get(STORE_PROJECTS, sourceId),
    db.get(STORE_PROJECT_DATA, sourceId),
  ]);
  if (!meta || !data) return null;

  const now = Date.now();
  const newMeta: ProjectMeta = {
    ...meta,
    id: newId,
    name: newName,
    createdAt: now,
    updatedAt: now,
  };

  await saveProject(newMeta, { ...data, name: newName });
  return newMeta;
}

// ---------------------------------------------------------------------------
// Migration: move legacy localStorage project into IndexedDB
// ---------------------------------------------------------------------------

const LEGACY_STORAGE_KEY = "trace-recap-project";
const MIGRATION_DONE_KEY = "trace-recap-idb-migrated";

export async function migrateFromLocalStorage(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  if (window.localStorage.getItem(MIGRATION_DONE_KEY)) return null;

  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    window.localStorage.setItem(MIGRATION_DONE_KEY, "1");
    return null;
  }

  try {
    const data = JSON.parse(raw) as ImportRouteData;
    const id = crypto.randomUUID();
    const now = Date.now();
    const name = data.name || "My Trip";
    const meta: ProjectMeta = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      locationCount: data.locations.length,
      previewLocations: data.locations
        .filter((l) => !l.isWaypoint)
        .slice(0, 3)
        .map((l) => l.name),
    };

    await saveProject(meta, data);
    window.localStorage.setItem(MIGRATION_DONE_KEY, "1");
    return id;
  } catch {
    window.localStorage.setItem(MIGRATION_DONE_KEY, "1");
    return null;
  }
}
