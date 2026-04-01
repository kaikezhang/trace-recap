import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ProjectMeta } from "@/types";
import type { ImportRouteData, RouteUISettings } from "@/stores/projectStore";

const DB_NAME = "trace-recap";
const DB_VERSION = 2;

const STORE_PROJECTS = "projects";
const STORE_PROJECT_DATA = "projectData";
const STORE_PHOTO_ASSETS = "photoAssets";
const STORE_PHOTO_REFS = "photoRefs";

export type LegacyProjectData = ImportRouteData;

export interface StoredPhoto {
  id: string;
  assetId: string;
  caption?: string;
  focalPoint?: { x: number; y: number };
}

export type StoredLocation = Omit<LegacyProjectData["locations"][number], "photos"> & {
  photos?: StoredPhoto[];
};

export interface ProjectDataV2 extends RouteUISettings {
  schemaVersion: 2;
  name: string;
  locations: StoredLocation[];
  segments: LegacyProjectData["segments"];
  timingOverrides?: Record<string, number>;
  mapStyle?: LegacyProjectData["mapStyle"];
}

export interface PhotoAssetRecord {
  id: string;
  blob: Blob;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  createdAt: number;
  lastAccessedAt: number;
  refCount: number;
}

export interface PhotoRefRecord {
  projectId: string;
  photoId: string;
  assetId: string;
  createdAt: number;
}

export type PersistedProjectData = LegacyProjectData | ProjectDataV2;

interface TraceRecapDB extends DBSchema {
  projects: {
    key: string;
    value: ProjectMeta;
    indexes: { "by-updatedAt": number };
  };
  projectData: {
    key: string;
    value: PersistedProjectData;
  };
  photoAssets: {
    key: string;
    value: PhotoAssetRecord;
    indexes: {
      "by-createdAt": number;
      "by-lastAccessedAt": number;
      "by-refCount": number;
    };
  };
  photoRefs: {
    key: [string, string];
    value: PhotoRefRecord;
    indexes: {
      "by-projectId": string;
      "by-assetId": string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<TraceRecapDB>> | null = null;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isProjectDataV2(value: unknown): value is ProjectDataV2 {
  return (
    isObject(value) &&
    value.schemaVersion === 2 &&
    Array.isArray(value.locations) &&
    Array.isArray(value.segments)
  );
}

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

        if (!db.objectStoreNames.contains(STORE_PHOTO_ASSETS)) {
          const assetStore = db.createObjectStore(STORE_PHOTO_ASSETS, {
            keyPath: "id",
          });
          assetStore.createIndex("by-createdAt", "createdAt");
          assetStore.createIndex("by-lastAccessedAt", "lastAccessedAt");
          assetStore.createIndex("by-refCount", "refCount");
        }

        if (!db.objectStoreNames.contains(STORE_PHOTO_REFS)) {
          const refStore = db.createObjectStore(STORE_PHOTO_REFS, {
            keyPath: ["projectId", "photoId"],
          });
          refStore.createIndex("by-projectId", "projectId");
          refStore.createIndex("by-assetId", "assetId");
        }
      },
    });
  }

  return dbPromise;
}

async function hydrateStoredProjectData(
  data: PersistedProjectData,
): Promise<ImportRouteData> {
  if (!isProjectDataV2(data)) {
    return data;
  }

  const hydratedLocations = await Promise.all(
    data.locations.map(async (location) => {
      const { photos, ...locationWithoutPhotos } = location;

      if (!photos?.length) {
        return locationWithoutPhotos;
      }

      const hydratedPhotos = (
        await Promise.all(
          photos.map(async (photo) => {
            const asset = await getPhotoAsset(photo.assetId);
            if (!asset) {
              console.warn(
                `[storage] Missing photo asset ${photo.assetId} for photo ${photo.id}.`,
              );
              return null;
            }

            return {
              url: URL.createObjectURL(asset.blob),
              ...(photo.caption !== undefined ? { caption: photo.caption } : {}),
              ...(photo.focalPoint ? { focalPoint: photo.focalPoint } : {}),
            };
          }),
        )
      ).filter((photo): photo is NonNullable<typeof photo> => photo !== null);

      return hydratedPhotos.length > 0
        ? { ...locationWithoutPhotos, photos: hydratedPhotos }
        : locationWithoutPhotos;
    }),
  );

  const { schemaVersion: _schemaVersion, locations: _locations, ...rest } = data;
  return {
    ...rest,
    locations: hydratedLocations,
  };
}

// ---------------------------------------------------------------------------
// Project metadata CRUD
// ---------------------------------------------------------------------------

export async function listProjects(): Promise<ProjectMeta[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORE_PROJECTS, "by-updatedAt");
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
  const tx = db.transaction(
    [
      STORE_PROJECTS,
      STORE_PROJECT_DATA,
      STORE_PHOTO_ASSETS,
      STORE_PHOTO_REFS,
    ],
    "readwrite",
  );

  const refs = await tx
    .objectStore(STORE_PHOTO_REFS)
    .index("by-projectId")
    .getAll(id);

  for (const ref of refs) {
    const assetStore = tx.objectStore(STORE_PHOTO_ASSETS);
    const asset = await assetStore.get(ref.assetId);
    if (asset) {
      const nextRefCount = Math.max(0, asset.refCount - 1);
      if (nextRefCount === 0) {
        await assetStore.delete(ref.assetId);
      } else {
        await assetStore.put({
          ...asset,
          refCount: nextRefCount,
          lastAccessedAt: Date.now(),
        });
      }
    }

    await tx.objectStore(STORE_PHOTO_REFS).delete([ref.projectId, ref.photoId]);
  }

  await Promise.all([
    tx.objectStore(STORE_PROJECTS).delete(id),
    tx.objectStore(STORE_PROJECT_DATA).delete(id),
  ]);

  await tx.done;
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
// Project data
// ---------------------------------------------------------------------------

export async function getStoredProjectData(
  id: string,
): Promise<PersistedProjectData | undefined> {
  const db = await getDB();
  return db.get(STORE_PROJECT_DATA, id);
}

export async function getProjectData(
  id: string,
): Promise<ImportRouteData | undefined> {
  const data = await getStoredProjectData(id);
  if (!data) return undefined;
  return hydrateStoredProjectData(data);
}

export async function putProjectData(
  id: string,
  data: PersistedProjectData,
): Promise<void> {
  const db = await getDB();
  await db.put(STORE_PROJECT_DATA, data, id);
}

// ---------------------------------------------------------------------------
// Save a project (meta + data) in a single transaction
// ---------------------------------------------------------------------------

export async function saveProject(
  meta: ProjectMeta,
  data: PersistedProjectData,
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
// Photo asset/ref helpers
// ---------------------------------------------------------------------------

export async function getPhotoAsset(
  assetId: string,
): Promise<PhotoAssetRecord | undefined> {
  const db = await getDB();
  return db.get(STORE_PHOTO_ASSETS, assetId);
}

export async function putPhotoAsset(record: PhotoAssetRecord): Promise<void> {
  const db = await getDB();
  await db.put(STORE_PHOTO_ASSETS, record);
}

export async function getPhotoRef(
  projectId: string,
  photoId: string,
): Promise<PhotoRefRecord | undefined> {
  const db = await getDB();
  return db.get(STORE_PHOTO_REFS, [projectId, photoId]);
}

export async function listPhotoRefsByProject(
  projectId: string,
): Promise<PhotoRefRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORE_PHOTO_REFS, "by-projectId", projectId);
}

export async function listPhotoRefsByAsset(
  assetId: string,
): Promise<PhotoRefRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex(STORE_PHOTO_REFS, "by-assetId", assetId);
}

export async function attachPhotoRef(input: {
  projectId: string;
  photoId: string;
  assetId: string;
  createdAt?: number;
}): Promise<PhotoRefRecord> {
  const db = await getDB();
  const tx = db.transaction([STORE_PHOTO_ASSETS, STORE_PHOTO_REFS], "readwrite");
  const now = input.createdAt ?? Date.now();
  const nextRef: PhotoRefRecord = {
    projectId: input.projectId,
    photoId: input.photoId,
    assetId: input.assetId,
    createdAt: now,
  };

  const existingRef = await tx
    .objectStore(STORE_PHOTO_REFS)
    .get([input.projectId, input.photoId]);

  if (existingRef?.assetId === input.assetId) {
    await tx.objectStore(STORE_PHOTO_REFS).put({
      ...existingRef,
      createdAt: existingRef.createdAt ?? now,
    });
    await tx.done;
    return existingRef;
  }

  const nextAsset = await tx.objectStore(STORE_PHOTO_ASSETS).get(input.assetId);
  if (!nextAsset) {
    throw new Error(`Cannot attach missing photo asset ${input.assetId}.`);
  }

  if (existingRef) {
    const previousAsset = await tx
      .objectStore(STORE_PHOTO_ASSETS)
      .get(existingRef.assetId);
    if (previousAsset) {
      const nextRefCount = Math.max(0, previousAsset.refCount - 1);
      if (nextRefCount === 0) {
        await tx.objectStore(STORE_PHOTO_ASSETS).delete(previousAsset.id);
      } else {
        await tx.objectStore(STORE_PHOTO_ASSETS).put({
          ...previousAsset,
          refCount: nextRefCount,
          lastAccessedAt: now,
        });
      }
    }
  }

  await tx.objectStore(STORE_PHOTO_ASSETS).put({
    ...nextAsset,
    refCount: nextAsset.refCount + 1,
    lastAccessedAt: now,
  });

  await tx.objectStore(STORE_PHOTO_REFS).put(nextRef);
  await tx.done;
  return nextRef;
}

export async function detachPhotoRef(
  projectId: string,
  photoId: string,
): Promise<PhotoRefRecord | null> {
  const db = await getDB();
  const tx = db.transaction([STORE_PHOTO_ASSETS, STORE_PHOTO_REFS], "readwrite");
  const ref = await tx.objectStore(STORE_PHOTO_REFS).get([projectId, photoId]);
  if (!ref) {
    await tx.done;
    return null;
  }

  const asset = await tx.objectStore(STORE_PHOTO_ASSETS).get(ref.assetId);
  if (asset) {
    const nextRefCount = Math.max(0, asset.refCount - 1);
    if (nextRefCount === 0) {
      await tx.objectStore(STORE_PHOTO_ASSETS).delete(asset.id);
    } else {
      await tx.objectStore(STORE_PHOTO_ASSETS).put({
        ...asset,
        refCount: nextRefCount,
        lastAccessedAt: Date.now(),
      });
    }
  }

  await tx.objectStore(STORE_PHOTO_REFS).delete([projectId, photoId]);
  await tx.done;
  return ref;
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

  const nextData = {
    ...data,
    name: newName,
  } as PersistedProjectData;

  const tx = db.transaction(
    [
      STORE_PROJECTS,
      STORE_PROJECT_DATA,
      STORE_PHOTO_ASSETS,
      STORE_PHOTO_REFS,
    ],
    "readwrite",
  );

  await tx.objectStore(STORE_PROJECTS).put(newMeta);
  await tx.objectStore(STORE_PROJECT_DATA).put(nextData, newId);

  if (isProjectDataV2(data)) {
    const refs = await tx
      .objectStore(STORE_PHOTO_REFS)
      .index("by-projectId")
      .getAll(sourceId);

    for (const ref of refs) {
      const asset = await tx.objectStore(STORE_PHOTO_ASSETS).get(ref.assetId);
      if (!asset) {
        continue;
      }

      await tx.objectStore(STORE_PHOTO_ASSETS).put({
        ...asset,
        refCount: asset.refCount + 1,
        lastAccessedAt: now,
      });

      await tx.objectStore(STORE_PHOTO_REFS).put({
        ...ref,
        projectId: newId,
        createdAt: now,
      });
    }
  }

  await tx.done;
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
        .filter((location) => !location.isWaypoint)
        .slice(0, 3)
        .map((location) => location.name),
    };

    await saveProject(meta, data);
    window.localStorage.setItem(MIGRATION_DONE_KEY, "1");
    return id;
  } catch (error) {
    console.error(
      "Failed to migrate legacy project data from localStorage.",
      error,
    );
    return null;
  }
}
