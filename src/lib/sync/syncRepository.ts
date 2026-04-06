import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  setSyncListener,
  withSyncMuted,
  saveProject,
  getProjectMeta,
  getProjectData,
  listProjects,
  listPhotoRefsByProject,
  attachPhotoRef,
  putPhotoAsset,
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

    // If not the active project, delegate to IDB-based push
    const store = useProjectStore.getState();
    if (store.currentProjectId !== projectId) {
      await pushProjectFromIDB(projectId);
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

/** Push a project from IDB data (for non-active projects, e.g., first login migration) */
async function pushProjectFromIDB(projectId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  if (!supabase || !useAuthStore.getState().user) return;

  try {
    const meta = await getProjectMeta(projectId);
    if (!meta) return;

    const data = await getProjectData(projectId);
    if (!data) return;

    // Parse locations/segments from persisted data for cloud conversion
    const locations = (data.locations ?? []).map((loc, i) => ({
      id: loc.id ?? `loc-${i}`,
      name: loc.name,
      nameLocal: loc.nameLocal,
      coordinates: loc.coordinates as [number, number],
      isWaypoint: loc.isWaypoint ?? false,
      photos: (loc.photos ?? []).map((p, j) => ({
        id: p.id ?? `photo-${i}-${j}`,
        locationId: loc.id ?? `loc-${i}`,
        url: p.url ?? "",
        caption: p.caption,
        focalPoint: p.focalPoint,
      })),
      photoLayout: loc.photoLayout,
      chapterTitle: loc.chapterTitle,
      chapterNote: loc.chapterNote,
      chapterDate: loc.chapterDate,
      chapterEmoji: loc.chapterEmoji,
    }));

    const segments = (data.segments ?? []).map((seg, i) => ({
      id: seg.id ?? `seg-${i}`,
      fromId: locations[seg.fromIndex]?.id ?? "",
      toId: locations[seg.toIndex]?.id ?? "",
      transportMode: seg.transportMode,
      iconStyle: (seg.iconStyle ?? "solid") as import("@/types").TransportIconStyle,
      iconVariant: seg.iconVariant,
      geometry: null as GeoJSON.LineString | null,
    }));

    const photoRefs = await listPhotoRefsByProject(projectId);
    const assetMap = new Map(photoRefs.map((r) => [r.photoId, r.assetId]));

    const cloudData = toCloudProjectData(
      locations, segments, data.mapStyle ?? "light",
      data.timingOverrides ?? {}, meta.name, assetMap,
    );

    const { data: result, error } = await supabase.rpc("upsert_project_data", {
      p_project_id: projectId,
      p_data: cloudData,
      p_base_revision: 0,
      p_name: meta.name,
      p_location_count: meta.locationCount,
      p_preview_locations: meta.previewLocations,
    });

    if (error) {
      console.error("[sync] IDB push failed:", error.message);
      return;
    }

    if (result?.new_revision) {
      meta.cloudRevision = result.new_revision;
      await withSyncMuted(async () => {
        const { openDB } = await import("idb");
        const db = await openDB("trace-recap", 2);
        await db.put("projects", meta);
      });
    }
  } catch (err) {
    console.error("[sync] IDB push error:", err);
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
  // Photos from cloud are included with a placeholder marker URL so they
  // survive the round-trip. The url "cloud:assetId" is not renderable but
  // ensures toCloudProjectData() can still find the photoId→assetId mapping
  // on the next push (via the IDB photoRefs, not the URL).
  // Phase 4 (photoSync) replaces these with real blob: URLs.
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
              url: `cloud:${ref.assetId}`, // Placeholder — not renderable, preserves ref
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
    // Convert segment-ID-keyed overrides to index-keyed for ImportRouteData format
    ...(cloud.timingOverrides && Object.keys(cloud.timingOverrides).length > 0
      ? {
          timingOverrides: Object.fromEntries(
            Object.entries(cloud.timingOverrides)
              .map(([segId, duration]) => {
                const idx = cloud.segments.findIndex((s) => s.id === segId);
                return idx >= 0 ? [String(idx), duration] : null;
              })
              .filter((entry): entry is [string, number] => entry !== null),
          ),
        }
      : {}),
  };
}

/** Create IDB photoRef entries for cloud photo references so pushes can find asset mappings */
async function createPhotoRefsForCloudData(projectId: string, cloud: CloudProjectData): Promise<void> {
  for (const loc of cloud.locations) {
    if (!loc.photoRefs?.length) continue;
    for (const ref of loc.photoRefs) {
      // Create a stub asset record if it doesn't exist locally
      // (Phase 4 photoSync will download the actual blob)
      try {
        await putPhotoAsset({
          id: ref.assetId,
          blob: new Blob(), // Empty placeholder — Phase 4 downloads real blob
          mimeType: "image/jpeg",
          byteSize: 0,
          width: 0,
          height: 0,
          createdAt: Date.now(),
          lastAccessedAt: Date.now(),
          refCount: 0, // attachPhotoRef will increment
        });
      } catch {
        // Asset may already exist — that's fine
      }

      await attachPhotoRef({
        projectId,
        photoId: ref.photoId,
        assetId: ref.assetId,
      });
    }
  }
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

  // Bump revision atomically so concurrent pushes don't silently revert
  const { error } = await supabase.rpc("rename_project", {
    p_project_id: projectId,
    p_name: name,
  });

  if (error) {
    console.error("[sync] Cloud rename failed:", error.message);
  } else {
    // Update local cloudRevision
    const meta = await getProjectMeta(projectId);
    if (meta) {
      // Re-fetch revision from cloud
      const { data } = await supabase
        .from("projects")
        .select("revision")
        .eq("id", projectId)
        .single();
      if (data) {
        meta.cloudRevision = data.revision;
        await withSyncMuted(async () => {
          const { openDB } = await import("idb");
          const db = await openDB("trace-recap", 2);
          await db.put("projects", meta);
        });
      }
    }
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
        await createPhotoRefsForCloudData(cloudMeta.id, cloudData);
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
        await createPhotoRefsForCloudData(cloudMeta.id, cloudData);

        // If this is the active project, reload it into Zustand from IDB
        if (cloudMeta.id === useProjectStore.getState().currentProjectId) {
          await withSyncMuted(async () => {
            // Force reload by temporarily clearing currentProjectId
            // then switching back, bypassing the early return guard
            const store = useProjectStore.getState();
            useProjectStore.setState({ currentProjectId: null });
            await store.switchProject(cloudMeta.id);
          });
        }
      }
    }

    // 2. Push local-only (unsynced) projects to cloud
    // Skip empty auto-created projects (locationCount === 0, just created by restorePersistedProject)
    for (const local of localProjects) {
      if (!cloudById.has(local.id) && !local.cloudRevision && local.locationCount > 0) {
        await pushProjectFromIDB(local.id);
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
      // Push the duplicated project from IDB (it's not the active project)
      void pushProjectFromIDB(newProjectId);
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
