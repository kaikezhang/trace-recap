import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  setSyncListener,
  withSyncMuted,
  saveProject,
  getProjectMeta,
  listProjects,
  listPhotoRefsByProject,
} from "@/lib/storage";
import type { ImportRouteData } from "@/stores/projectStore";
import { toCloudProjectData } from "./converters";
import type { CloudProjectData } from "./types";
import type { ProjectMeta } from "@/types";
import { useUIStore } from "@/stores/uiStore";
import { useProjectStore } from "@/stores/projectStore";
import { useAuthStore } from "@/stores/authStore";

let initialized = false;

function updateSyncState(partial: Parameters<ReturnType<typeof useUIStore.getState>["setSyncState"]>[0]) {
  useUIStore.getState().setSyncState(partial);
}

// ---------------------------------------------------------------------------
// Push: local → cloud
// ---------------------------------------------------------------------------

async function pushProject(projectId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  if (!supabase) return;

  const user = useAuthStore.getState().user;
  if (!user) return;

  try {
    updateSyncState({ remote: "syncing" });

    const meta = await getProjectMeta(projectId);
    if (!meta) return;

    // Use Zustand state only if this is the active project, otherwise skip
    // (debounce fires after IDB save, so Zustand state matches if project is current)
    const store = useProjectStore.getState();
    if (store.currentProjectId !== projectId) {
      // Not the active project — skip push (it was already saved to IDB)
      console.warn(`[sync] Skipping push for non-active project ${projectId}`);
      updateSyncState({ remote: "idle" });
      return;
    }

    const photoRefs = await listPhotoRefsByProject(projectId);
    const assetMap = new Map(photoRefs.map((r) => [r.photoId, r.assetId]));

    const cloudData = toCloudProjectData(
      store.locations,
      store.segments,
      store.mapStyle,
      store.segmentTimingOverrides,
      meta.name,
      assetMap,
    );

    const baseRevision = meta.cloudRevision ?? 0;

    const { data: result, error } = await supabase.rpc("upsert_project_data", {
      p_project_id: projectId,
      p_data: cloudData,
      p_base_revision: baseRevision,
      p_name: meta.name,
      p_location_count: meta.locationCount,
      p_preview_locations: meta.previewLocations,
    });

    if (error) {
      console.error("[sync] Push failed:", error.message);
      updateSyncState({ remote: "error" });
      return;
    }

    if (result?.status === "conflict") {
      console.warn("[sync] Conflict detected — server has newer revision");
      updateSyncState({ remote: "conflict" });
      return;
    }

    // Update local revision
    if (result?.new_revision) {
      const freshMeta = await getProjectMeta(projectId);
      if (freshMeta) {
        freshMeta.cloudRevision = result.new_revision;
        // Write meta without triggering sync loop
        await withSyncMuted(async () => {
          const { openDB } = await import("idb");
          const db = await openDB("trace-recap", 2);
          await db.put("projects", freshMeta);
        });
      }
    }

    updateSyncState({ remote: "synced" });
  } catch (err) {
    console.error("[sync] Push error:", err);
    updateSyncState({ remote: "error" });
  }
}

// ---------------------------------------------------------------------------
// Pull: cloud → local
// ---------------------------------------------------------------------------

async function pullProjectList(): Promise<ProjectMeta[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[sync] Pull project list failed:", error.message);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
    locationCount: (row.location_count as number) ?? 0,
    previewLocations: (row.preview_locations as string[]) ?? [],
    cloudRevision: (row.revision as number) ?? 1,
  }));
}

async function pullProjectData(projectId: string): Promise<CloudProjectData | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("project_data")
    .select("data")
    .eq("project_id", projectId)
    .single();

  if (error || !data) {
    console.error("[sync] Pull project data failed:", error?.message);
    return null;
  }

  return data.data as CloudProjectData;
}

function cloudToPersistedData(cloud: CloudProjectData): ImportRouteData {
  return {
    name: cloud.name,
    locations: cloud.locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      nameLocal: loc.nameLocal,
      coordinates: loc.coordinates,
      isWaypoint: loc.isWaypoint ?? false,
      ...(loc.photoRefs?.length
        ? {
            photos: loc.photoRefs.map((ref) => ({
              id: ref.photoId,
              url: "", // Photos hydrated separately
              caption: ref.caption,
              focalPoint: ref.focalPoint,
            })),
          }
        : {}),
      photoLayout: loc.photoLayout,
      chapterTitle: loc.chapterTitle,
      chapterNote: loc.chapterNote,
      chapterDate: loc.chapterDate,
      chapterEmoji: loc.chapterEmoji,
    })),
    segments: cloud.segments.map((seg) => ({
      id: seg.id,
      fromIndex: cloud.locations.findIndex((l) => l.id === seg.fromLocationId),
      toIndex: cloud.locations.findIndex((l) => l.id === seg.toLocationId),
      transportMode: seg.transportMode,
      iconStyle: seg.iconStyle,
      iconVariant: seg.iconVariant,
    })),
    mapStyle: cloud.mapStyle,
    timingOverrides: cloud.timingOverrides,
  };
}

// ---------------------------------------------------------------------------
// Delete: remove from cloud
// ---------------------------------------------------------------------------

async function deleteFromCloud(projectId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  if (!supabase || !useAuthStore.getState().user) return;

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) {
    console.error("[sync] Cloud delete failed:", error.message);
  }
}

// ---------------------------------------------------------------------------
// Rename: update cloud metadata only
// ---------------------------------------------------------------------------

async function renameOnCloud(projectId: string, name: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  if (!supabase || !useAuthStore.getState().user) return;

  // Use revision-aware update to avoid overwriting concurrent changes
  const { error } = await supabase
    .from("projects")
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId)
    .eq("user_id", useAuthStore.getState().user!.id);

  if (error) {
    console.error("[sync] Cloud rename failed:", error.message);
  }
}

// ---------------------------------------------------------------------------
// Cloud hydration: first login on new device
// ---------------------------------------------------------------------------

async function onAuthReady(): Promise<void> {
  if (!isSupabaseConfigured() || !useAuthStore.getState().user) return;

  try {
    const cloudProjects = await pullProjectList();
    const localProjects = await listProjects();
    const localById = new Map(localProjects.map((p) => [p.id, p]));
    const cloudById = new Map(cloudProjects.map((p) => [p.id, p]));

    // 1. Pull cloud-only projects to local IDB
    for (const cloudMeta of cloudProjects) {
      const local = localById.get(cloudMeta.id);

      if (!local) {
        // Cloud-only: pull to local
        const cloudData = await pullProjectData(cloudMeta.id);
        if (!cloudData) continue;
        const persistedData = cloudToPersistedData(cloudData);
        await withSyncMuted(() => saveProject(cloudMeta, persistedData));
        continue;
      }

      // Exists in both: compare revisions
      const localRev = local.cloudRevision ?? 0;
      const cloudRev = cloudMeta.cloudRevision ?? 0;
      if (cloudRev > localRev) {
        // Cloud is newer — pull
        const cloudData = await pullProjectData(cloudMeta.id);
        if (!cloudData) continue;
        const persistedData = cloudToPersistedData(cloudData);
        const mergedMeta = { ...local, ...cloudMeta };
        await withSyncMuted(() => saveProject(mergedMeta, persistedData));
      }
    }

    // 2. Push local-only (unsynced) projects to cloud
    for (const local of localProjects) {
      if (!cloudById.has(local.id) && !local.cloudRevision) {
        if (local.id === useProjectStore.getState().currentProjectId) {
          await pushProject(local.id);
        }
      }
    }

    // Refresh project list in store
    const refreshed = await listProjects();
    useProjectStore.setState({ projects: refreshed });
  } catch (err) {
    console.error("[sync] Auth ready hydration failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Storage listener registration
// ---------------------------------------------------------------------------

// Per-project debounced pushes to avoid hammering the API during rapid edits
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const PUSH_DEBOUNCE_MS = 5000;

function debouncedPush(projectId: string) {
  const existing = pushTimers.get(projectId);
  if (existing) clearTimeout(existing);
  pushTimers.set(
    projectId,
    setTimeout(() => {
      pushTimers.delete(projectId);
      void pushProject(projectId);
    }, PUSH_DEBOUNCE_MS),
  );
}

export function initSyncRepository(): void {
  if (initialized) return;
  initialized = true;

  setSyncListener({
    onProjectSaved: (projectId) => {
      if (!useAuthStore.getState().user) return;
      debouncedPush(projectId);
    },
    onProjectDeleted: (projectId) => {
      void deleteFromCloud(projectId);
    },
    onProjectRenamed: (projectId, name) => {
      void renameOnCloud(projectId, name);
    },
    onProjectDuplicated: (newProjectId) => {
      if (!useAuthStore.getState().user) return;
      // Push the duplicated project to cloud
      void pushProject(newProjectId);
    },
  });

  // Listen for auth state changes
  const unsubAuth = useAuthStore.subscribe((state, prev) => {
    if (state.user && !prev.user) {
      // User just signed in
      void onAuthReady();
    }
  });

  // If already authenticated, hydrate now
  if (useAuthStore.getState().user) {
    void onAuthReady();
  }
}

export { pushProject, pullProjectList, pullProjectData, onAuthReady };
