import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  setSyncListener,
  withSyncMuted,
  saveProject,
  getProjectMeta,
  getProjectData,
  getPhotoAsset,
  listProjects,
  listPhotoRefsByProject,
  attachPhotoRef,
  putPhotoAsset,
  deleteProject,
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

const forkingProjects = new Set<string>(); // Guard against infinite fork loops
const pendingDeletes = new Set<string>(); // Cloud deletes deferred during unhealthy sync

function flushPendingDeletes() {
  if (pendingDeletes.size === 0) return;
  const ids = [...pendingDeletes];
  pendingDeletes.clear();
  for (const id of ids) {
    void deleteFromCloud(id);
  }
}
const pushLocks = new Map<string, Promise<void>>(); // Serialize pushes per project

async function pushProject(projectId: string): Promise<void> {
  // Serialize: wait for any in-flight push for the same project
  const existing = pushLocks.get(projectId);
  if (existing) {
    await existing;
  }
  const { promise, resolve } = (() => {
    let r: () => void;
    const p = new Promise<void>((res) => { r = res; });
    return { promise: p, resolve: r! };
  })();
  pushLocks.set(projectId, promise);
  try {
    await pushProjectInner(projectId);
  } finally {
    resolve();
    if (pushLocks.get(projectId) === promise) {
      pushLocks.delete(projectId);
    }
  }
}

async function pushProjectInner(projectId: string): Promise<void> {
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

    // Extract cloud:assetId placeholder URLs as fallback mappings
    for (const loc of store.locations) {
      for (const photo of loc.photos) {
        if (photo.url.startsWith("cloud:") && !assetMap.has(photo.id)) {
          assetMap.set(photo.id, photo.url.slice("cloud:".length));
        }
      }
    }

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
      // Prevent infinite fork loop: only fork once per project per sync cycle
      if (forkingProjects.has(projectId)) {
        console.error("[sync] Conflict persists after fork — aborting to prevent loop");
        updateSyncState({ remote: "error" });
        return;
      }
      forkingProjects.add(projectId);
      try {
        console.warn("[sync] Conflict detected — forking cloud version as separate project");
        const serverRev = result.server_revision as number | undefined;
        const forkOk = await forkCloudVersion(projectId);
        if (!forkOk) {
          updateSyncState({ remote: "error" });
          return;
        }
        // Update local cloudRevision to server's current revision so the
        // retry push uses the correct base and doesn't conflict again.
        if (serverRev) {
          const freshMeta = await getProjectMeta(projectId);
          if (freshMeta) {
            freshMeta.cloudRevision = serverRev;
            await withSyncMuted(async () => {
              const { openDB } = await import("idb");
              const db = await openDB("trace-recap", 2);
              await db.put("projects", freshMeta);
            });
          }
          // Retry push once with corrected base revision (call inner to avoid deadlock)
          await pushProjectInner(projectId);
        } else {
          updateSyncState({ remote: "error" });
        }
      } finally {
        forkingProjects.delete(projectId);
      }
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
    flushPendingDeletes();
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

    // Also extract cloud:assetId placeholder URLs as fallback mappings
    for (const loc of locations) {
      for (const photo of loc.photos) {
        if (photo.url.startsWith("cloud:") && !assetMap.has(photo.id)) {
          assetMap.set(photo.id, photo.url.slice("cloud:".length));
        }
      }
    }

    const cloudData = toCloudProjectData(
      locations, segments, data.mapStyle ?? "light",
      data.timingOverrides ?? {}, meta.name, assetMap,
    );

    const { data: result, error } = await supabase.rpc("upsert_project_data", {
      p_project_id: projectId,
      p_data: cloudData,
      p_base_revision: meta.cloudRevision ?? 0,
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

/** Convert cloud data to V2 format with photo asset references for proper IDB hydration */
async function convertToV2WithRefs(
  projectId: string,
  cloud: CloudProjectData,
): Promise<import("@/lib/storage").ProjectDataV2 | null> {
  try {
    const { listPhotoRefsByProject: listRefs } = await import("@/lib/storage");
    const refs = await listRefs(projectId);
    const refsByPhotoId = new Map(refs.map((r) => [r.photoId, r]));

    const locations: import("@/lib/storage").StoredLocation[] = cloud.locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      nameLocal: loc.nameLocal,
      coordinates: loc.coordinates,
      isWaypoint: loc.isWaypoint ?? false,
      photos: loc.photoRefs
        ?.map((ref) => {
          const idbRef = refsByPhotoId.get(ref.photoId);
          if (!idbRef) return null;
          return {
            id: ref.photoId,
            assetId: idbRef.assetId,
            caption: ref.caption,
            focalPoint: ref.focalPoint,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null),
      photoLayout: loc.photoLayout,
      chapterTitle: loc.chapterTitle,
      chapterNote: loc.chapterNote,
      chapterDate: loc.chapterDate,
      chapterEmoji: loc.chapterEmoji,
    }));

    // Convert segment-ID-keyed overrides to index-keyed for local format
    const localTimingOverrides: Record<string, number> = {};
    if (cloud.timingOverrides) {
      for (const [segId, duration] of Object.entries(cloud.timingOverrides)) {
        const idx = cloud.segments.findIndex((s) => s.id === segId);
        if (idx >= 0) {
          localTimingOverrides[String(idx)] = duration;
        }
      }
    }

    return {
      schemaVersion: 2,
      name: cloud.name,
      locations,
      segments: cloud.segments.map((seg) => ({
        id: seg.id,
        fromIndex: cloud.locations.findIndex((l) => l.id === seg.fromLocationId),
        toIndex: cloud.locations.findIndex((l) => l.id === seg.toLocationId),
        transportMode: seg.transportMode,
        iconStyle: seg.iconStyle,
        iconVariant: seg.iconVariant,
      })),
      mapStyle: cloud.mapStyle,
      timingOverrides: localTimingOverrides,
    };
  } catch (err) {
    console.error("[sync] Failed to convert to V2:", err);
    return null;
  }
}

/** Create IDB photoRef entries and download photos for cloud photo references */
async function createPhotoRefsForCloudData(projectId: string, cloud: CloudProjectData): Promise<void> {
  const { downloadPhoto } = await import("./photoSync");

  for (const loc of cloud.locations) {
    if (!loc.photoRefs?.length) continue;
    for (const ref of loc.photoRefs) {
      // Only create stub asset if it doesn't exist locally
      const existingAsset = await getPhotoAsset(ref.assetId);
      let hasLocalAsset = !!existingAsset && existingAsset.byteSize > 0;

      if (!hasLocalAsset) {
        // Download from cloud (or retry if previous download left empty stub)
        const blob = await downloadPhoto(ref.assetId);
        if (blob) {
          hasLocalAsset = true;
        } else {
          console.warn(`[sync] Failed to download photo ${ref.assetId} — will retry later`);
        }
      }

      // Only attach ref if the asset actually exists locally
      if (hasLocalAsset) {
        await attachPhotoRef({
          projectId,
          photoId: ref.photoId,
          assetId: ref.assetId,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Conflict resolution: fork cloud version as a new project (never lose data)
// ---------------------------------------------------------------------------

async function forkCloudVersion(originalProjectId: string): Promise<boolean> {
  try {
    const cloudData = await pullProjectData(originalProjectId);
    if (!cloudData) {
      console.warn("[sync] Cannot fork — failed to pull cloud data");
      return false;
    }

    // Create a new project with the cloud data, suffixed to indicate origin
    const forkId = crypto.randomUUID();
    const forkName = `${cloudData.name} (cloud)`;
    const now = Date.now();

    const forkMeta: ProjectMeta = {
      id: forkId,
      name: forkName,
      createdAt: now,
      updatedAt: now,
      locationCount: cloudData.locations.length,
      previewLocations: cloudData.locations.slice(0, 3).map((l) => l.name),
      cloudRevision: 0, // Will get a revision on first push
    };

    const persistedData = cloudToPersistedData(cloudData);
    await withSyncMuted(() => saveProject(forkMeta, persistedData));
    await createPhotoRefsForCloudData(forkId, cloudData);

    // Only upgrade to V2 if ALL photo refs were successfully downloaded.
    // Otherwise keep the placeholder snapshot to avoid silently losing photos.
    const totalCloudPhotos = cloudData.locations.reduce(
      (n, loc) => n + (loc.photoRefs?.length ?? 0), 0,
    );
    const localRefs = await listPhotoRefsByProject(forkId);
    if (localRefs.length >= totalCloudPhotos) {
      const v2Data = await convertToV2WithRefs(forkId, cloudData);
      if (v2Data) {
        await withSyncMuted(() => saveProject(forkMeta, v2Data));
      }
    } else {
      console.warn(`[sync] Fork ${forkId}: ${localRefs.length}/${totalCloudPhotos} photos downloaded — keeping placeholder data`);
    }

    // Push the fork to cloud as a new project (uses original cloud data, no photo loss)
    await pushProjectFromIDB(forkId);

    // Refresh project list
    const refreshed = await listProjects();
    useProjectStore.setState({ projects: refreshed });

    console.info(`[sync] Forked cloud version of ${originalProjectId} → ${forkId} "${forkName}"`);
    return true;
  } catch (err) {
    console.error("[sync] Fork failed:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Delete: remove from cloud
// ---------------------------------------------------------------------------

async function deleteFromCloud(projectId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  if (!supabase || !useAuthStore.getState().user) return;

  // Safety: verify this project actually belongs to the user before deleting
  const { data: existing } = await supabase
    .from("projects")
    .select("id, revision")
    .eq("id", projectId)
    .single();

  if (!existing) {
    // Project doesn't exist on cloud — nothing to delete
    return;
  }

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
    updateSyncState({ remote: "syncing" });

    const cloudProjects = await pullProjectList();
    const localProjects = await listProjects();
    const cloudById = new Map(cloudProjects.map((p) => [p.id, p]));

    // 1. Migrate all anonymous local projects (no cloudRevision, non-empty)
    const anonymousProjects = localProjects.filter(
      (p) => !p.cloudRevision && p.locationCount > 0,
    );

    for (const anonProject of anonymousProjects) {
      await migrateAnonymousProject(anonProject.id);
    }

    // 2. Reconcile cloud projects with local cache
    for (const cloudMeta of cloudProjects) {
      const local = localProjects.find((p) => p.id === cloudMeta.id);
      const localRev = local?.cloudRevision ?? 0;
      const cloudRev = cloudMeta.cloudRevision ?? 0;

      if (local && localRev >= cloudRev) {
        // Same revision — check if local has unpushed edits (e.g. offline edits)
        if (local.updatedAt > (cloudMeta.updatedAt ?? 0)) {
          await pushProjectFromIDB(local.id);
        }
        // Otherwise local cache is current — no transfer needed
        continue;
      }

      if (local && cloudRev > localRev) {
        // Cloud is newer but local might have unpushed edits too
        if (local.updatedAt > (cloudMeta.updatedAt ?? 0)) {
          // Both sides changed — fork cloud version, keep local as-is, then push local
          console.warn(`[sync] Conflict: project ${cloudMeta.id} — forking cloud version to avoid data loss`);
          const forkOk = await forkCloudVersion(cloudMeta.id);
          if (forkOk) {
            // Update local cloudRevision to cloud's current so push won't re-conflict
            local.cloudRevision = cloudRev;
            await withSyncMuted(async () => {
              const { openDB } = await import("idb");
              const db = await openDB("trace-recap", 2);
              await db.put("projects", local);
            });
            await pushProjectFromIDB(local.id);
          }
          continue;
        }
      }

      // Cloud is newer (or local doesn't exist) — pull
      const cloudData = await pullProjectData(cloudMeta.id);
      if (!cloudData) continue;

      const persistedData = cloudToPersistedData(cloudData);
      await withSyncMuted(() => saveProject(cloudMeta, persistedData));
      await createPhotoRefsForCloudData(cloudMeta.id, cloudData);

      const v2Data = await convertToV2WithRefs(cloudMeta.id, cloudData);
      if (v2Data) {
        await withSyncMuted(() => saveProject(cloudMeta, v2Data));
      }
    }

    // 3. Clean up empty default projects left from logout soft-clear
    for (const local of localProjects) {
      if (!local.cloudRevision && local.locationCount === 0 && !cloudById.has(local.id)) {
        await withSyncMuted(() => deleteProject(local.id));
      }
    }

    // Refresh project list and switch to most recent project
    const refreshed = await listProjects();
    useProjectStore.setState({ projects: refreshed });

    // If current project was cleared (soft-clear), switch to first available
    const currentId = useProjectStore.getState().currentProjectId;
    if (!currentId || !refreshed.find((p) => p.id === currentId)) {
      if (refreshed.length > 0) {
        await withSyncMuted(() =>
          useProjectStore.getState().switchProject(refreshed[0].id),
        );
      }
    }

    updateSyncState({ remote: "synced" });
    flushPendingDeletes();
  } catch (err) {
    console.error("[sync] Auth ready hydration failed:", err);
    updateSyncState({ remote: "error" });
  }
}

/** Upload all photos for a local-only project, then push project data to cloud. */
async function migrateAnonymousProject(projectId: string): Promise<void> {
  const { queueUpload } = await import("./photoSync");

  const photoRefs = await listPhotoRefsByProject(projectId);

  // Upload all local photo blobs — await each to ensure cloud assets exist
  const uploadPromises: Promise<void>[] = [];
  for (const ref of photoRefs) {
    const asset = await getPhotoAsset(ref.assetId);
    if (asset && asset.blob && asset.byteSize > 0) {
      uploadPromises.push(queueUpload(ref.assetId, asset.blob, projectId));
    }
  }

  if (uploadPromises.length > 0) {
    const results = await Promise.allSettled(uploadPromises);
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      console.error(`[sync] ${failures.length} photo upload(s) failed during migration`);
      // Continue with push — photos that uploaded will be linked, others will be retried later
    }
  }

  // Push project data to cloud
  await pushProjectFromIDB(projectId);
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
      // Only delete from cloud if sync is healthy and delete was user-initiated.
      // During syncing/conflict/error states, queue for retry to prevent data loss.
      const syncState = useUIStore.getState().syncState;
      if (syncState.remote !== "synced" && syncState.remote !== "idle") {
        console.warn(`[sync] Deferring cloud delete — sync state is "${syncState.remote}"`);
        pendingDeletes.add(projectId);
        return;
      }
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
