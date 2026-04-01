# Photo Persistence Design

## Status

Proposed architecture for long-term photo persistence in the editor. This document is based on the current implementation in `src/stores/projectStore.ts`, `src/lib/storage.ts`, `src/components/editor/PhotoManager.tsx`, and `src/lib/imageUtils.ts`.

## Current State

Today, a photo is compressed on the client, converted to a `data:` URL, stored in Zustand state, then re-serialized into the single IndexedDB `projectData` record on autosave.

That creates four structural problems:

1. Large `data:` URL strings live in Zustand and get copied across immutable updates.
2. `serializeProjectState()` still has to materialize photo payloads, and dirty locations still pay `blobUrlToDataUrl()` plus `JSON.stringify()` on save.
3. One large `projectData` value grows with every photo, so autosave rewrites all photo bytes even when only captions or layout metadata changed.
4. A single persistence failure affects the whole project write instead of one asset.

The current code already shows the strain:

- `PhotoManager` converts compressed blobs to `data:` URLs immediately for persistence safety.
- `serializeLocation()` persists photo bytes inline.
- `blobUrlToDataUrl()` fetches blob URLs and re-encodes them before saving.
- `runBackgroundPhotoCompression()` swaps URLs after load, which improves image size but not the serialized project shape.

## Goals

- Remove photo bytes from the main project JSON.
- Keep photo persistence resilient across reloads, tab restarts, and project switching.
- Reduce autosave write amplification so metadata changes do not rewrite photo payloads.
- Support deduplication when the same compressed image appears multiple times.
- Make migration from legacy `data:` URLs safe and incremental.
- Expose enough persistence state to drive a trustworthy save indicator.

## Non-Goals

- Changing export format in this phase.
- Moving persistence to a server.
- Replacing IndexedDB with OPFS immediately.

OPFS can remain a future optimization if the app later needs very large media libraries, but it is not required to solve the current bottlenecks.

## Decision Summary

- Store photo binaries in a separate IndexedDB `photoAssets` store.
- Persist binary `Blob`s, not `data:` URLs.
- Reference assets from project JSON via hash-based `assetId`.
- Deduplicate across the full app origin with explicit project-photo refs.
- Migrate lazily from legacy inline URLs as projects are opened.
- Derive save status from both asset writes and project JSON writes.

### Alternatives Considered

### Option A: Keep inline `data:` URLs in `projectData`

Pros:

- smallest code change
- no new stores or migration model

Cons:

- does not solve string memory pressure
- autosave still rewrites photo payloads
- keeps the largest failure surface exactly where it is today

Decision: reject.

### Option B: Separate IndexedDB store, keyed by generated photo ID, store blobs

Pros:

- removes photo bytes from project JSON
- much simpler than the current design

Cons:

- no natural dedupe across projects
- duplicated projects duplicate stored bytes
- asset identity becomes tied to editor-specific IDs

Decision: workable, but not the best long-term shape.

### Option C: Separate IndexedDB blob store, keyed by content hash

Pros:

- removes bytes from project JSON
- supports dedupe naturally
- stable asset identity across projects and migration

Cons:

- requires hashing and a reference layer
- slightly more migration complexity

Decision: recommended.

### 1. Store photos in a separate IndexedDB object store

Yes. Project structure and photo binary data should be split.

Recommended stores:

- `projects`: unchanged project metadata.
- `projectData`: lightweight project JSON only.
- `photoAssets`: binary asset records keyed by content hash.
- `photoRefs`: per-project photo usage records for ref counting and cleanup.

This turns project persistence into two concerns:

- project state serialization
- asset storage and reference management

The two concerns should not share the same record anymore.

### 2. Store photos as binary `Blob`s, not `data:` URLs

Yes. Use IndexedDB structured-clone storage for `Blob` values.

Reasons:

- avoids the ~33% base64 expansion of `data:` URLs
- avoids large JS string allocations in Zustand and during `JSON.stringify()`
- matches the browser’s native binary storage path
- lets the app create object URLs only when needed for rendering

The runtime should use object URLs derived from persisted blobs, not base64 strings.

### 3. Use hash-based content addressing for photo assets

Yes. Key each persisted asset by a deterministic hash of the final compressed blob bytes.

Recommended key:

- `assetId = sha256(compressedBlobBytes)`

Hash after compression, not before compression. That ensures dedupe is based on what the app actually stores and renders.

Benefits:

- same image imported twice becomes one binary asset
- duplicated projects can reuse the same persisted asset
- migration from legacy `data:` URLs naturally deduplicates
- asset identity is stable and portable

### 4. Deduplicate across the whole app origin, not only within one project

Yes. The app already supports multiple projects, so the useful scope is origin-wide dedupe.

That requires a reference layer:

- `photoAssets[assetId]` stores the blob and metadata
- `photoRefs[[projectId, photoId]]` stores which project photo points to which asset

`photoRefs` should have indexes by `projectId` and `assetId`.

`photoAssets` should also track `refCount` for fast cleanup, while `photoRefs` remains the repairable source of truth if counts ever drift.

## Recommended Data Model

### IndexedDB schema

```ts
const DB_VERSION = 2;

interface ProjectDataV2 {
  schemaVersion: 2;
  name: string;
  locations: StoredLocation[];
  segments: ImportRouteData["segments"];
  mapStyle?: MapStyle;
  timingOverrides?: Record<string, number>;
  // existing UI settings payload stays here
}

interface StoredLocation {
  name: string;
  nameZh?: string;
  coordinates: [number, number];
  isWaypoint?: boolean;
  photos?: StoredPhoto[];
  photoLayout?: PhotoLayout;
  chapterTitle?: string;
  chapterNote?: string;
  chapterDate?: string;
  chapterEmoji?: string;
}

interface StoredPhoto {
  id: string;
  assetId: string;
  caption?: string;
  focalPoint?: { x: number; y: number };
}

interface PhotoAssetRecord {
  id: string; // sha256 of compressed blob bytes
  blob: Blob;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  createdAt: number;
  lastAccessedAt: number;
  refCount: number;
}

interface PhotoRefRecord {
  projectId: string;
  photoId: string;
  assetId: string;
  createdAt: number;
}
```

### Runtime model

The runtime `Photo` shape should stop treating `url` as the persisted source of truth.

Recommended runtime additions:

```ts
interface RuntimePhoto {
  id: string;
  locationId: string;
  assetId?: string;
  url: string; // object URL for rendering, not persisted
  caption?: string;
  focalPoint?: { x: number; y: number };
  persistence:
    | { state: "pending" }
    | { state: "persisted"; assetId: string }
    | { state: "error"; reason: string };
}
```

`url` remains useful for existing UI code, but it becomes a transient render URL instead of the canonical storage value.

### Internal vs external types

This should introduce a clean split between:

- `ImportRouteData`: external import/export payload
- `ProjectDataV2`: internal IndexedDB persistence payload

The current code uses `ImportRouteData` for storage. That coupling is one reason photo bytes currently stay inline. The new design should decouple editor persistence from interchange format.

## Save and Load Flow

### Add photo

Recommended flow:

1. User selects file.
2. Compress to the existing max-1920 JPEG blob.
3. Compute dimensions and SHA-256 hash from the compressed blob.
4. Write `photoAssets[assetId]` if it does not already exist.
5. Write `photoRefs[[projectId, photoId]]`.
6. Add the photo to Zustand using:
   - `assetId`
   - an object URL created from the compressed blob
   - `persistence.state = "persisted"` after the transaction commits
7. Autosave writes only lightweight project JSON with `assetId` references.

Important detail: the app should persist the blob before considering the photo fully saved. The in-memory object URL is only a render cache.

### Restore project

Recommended flow:

1. Load `projectData`.
2. Parse locations and photo refs.
3. For each stored photo, resolve `assetId` to blob.
4. Create object URLs for active photos and revoke them on photo removal, project switch, or store teardown.

For current scale, eager hydration on project restore is acceptable. If projects later grow into hundreds of photos, the `PhotoStore` can switch to lazy object URL creation without changing the project schema.

### Metadata-only change

Caption, focal point, layout, and chapter edits should only update `projectData`. No photo blob write should happen unless the binary asset changes.

### Existing compression path

Once this architecture is in place, `runBackgroundPhotoCompression()` should stop rewriting in-memory photo URLs as part of persistence hygiene. Compression should happen before asset insertion, and post-load work should only be needed for migration or optional background cleanup.

## Photo Store Abstraction

### Recommendation

Yes. Add a `photoStore` abstraction layer and make all photo persistence go through it.

Without that layer, photo handling logic stays split across `PhotoManager`, `projectStore`, `storage.ts`, and future migration code.

### Proposed API surface

```ts
export interface PersistedPhotoHandle {
  assetId: string;
  url: string; // object URL
  byteSize: number;
  width: number;
  height: number;
  deduped: boolean;
}

export interface PhotoPersistenceState {
  pendingWrites: number;
  failedWrites: number;
  pendingMigrations: number;
  lastError?: string;
}

export interface PhotoStore {
  putPhoto(input: {
    projectId: string;
    photoId: string;
    blob: Blob;
  }): Promise<PersistedPhotoHandle>;

  importLegacyDataUrl(input: {
    projectId: string;
    photoId: string;
    dataUrl: string;
  }): Promise<PersistedPhotoHandle>;

  attachExistingAsset(input: {
    projectId: string;
    photoId: string;
    assetId: string;
  }): Promise<PersistedPhotoHandle>;

  getObjectUrl(assetId: string): Promise<string>;

  releaseObjectUrl(assetId: string): void;

  deletePhoto(projectId: string, photoId: string): Promise<void>;

  deleteProjectPhotos(projectId: string): Promise<void>;

  getPersistenceState(projectId: string): PhotoPersistenceState;

  estimateStorage(): Promise<{
    usage?: number;
    quota?: number;
    persisted?: boolean;
  }>;
}
```

Practical rules:

- `projectStore` should not read blobs directly from IndexedDB.
- `storage.ts` should own schema and transactions.
- UI components should not know whether a photo came from a fresh upload, restored blob, or migrated `data:` URL.

## Migration Strategy

### Recommendation

Use lazy, project-at-a-time migration. Do not try to rewrite every existing project inside the IndexedDB upgrade callback.

### Why lazy migration

- upgrade callbacks should stay fast and deterministic
- some users may have many photos and long-running upgrades are risky
- migration work can be chunked after the app is interactive
- migration can be resumed safely if the tab closes mid-process

### Migration plan

#### Database upgrade

On `DB_VERSION = 2`:

- create `photoAssets` and `photoRefs`
- keep `projectData` readable in legacy format
- do not rewrite records in `upgrade()`

#### Read path

The loader accepts both formats:

- legacy photo: `{ url: "data:..." }`
- new photo: `{ id, assetId }`

#### Migration execution

When a project is opened:

1. Detect legacy photos whose persisted record has `url` and no `assetId`.
2. For each legacy photo:
   - convert `data:` URL to blob
   - hash the compressed bytes
   - put asset if missing
   - write `photoRefs`
   - update in-memory photo to object URL + `assetId`
3. After all legacy photos for that project are persisted, rewrite that project’s `projectData` into v2 format.
4. Mark the project as migrated.

Migration should run in small batches, for example one location at a time, yielding back to the event loop between batches.

### Failure handling

- If one photo migration fails, leave the legacy photo record intact for that photo.
- The project remains readable because the loader still supports legacy `url`.
- Surface a non-blocking warning in save state, not a destructive failure.

### Write policy

Dual-read, single-write:

- read legacy and v2
- write v2 only

That avoids long-term format drift.

## Storage Limits and Browser Constraints

### What matters in practice

The main risk is not a strict per-record IndexedDB limit. The real risks are:

- origin quota limits that vary by browser and device
- write amplification from keeping all photo bytes inside one JSON value
- low disk availability or browser eviction pressure
- long transactions on mobile browsers

### Browser quota guidance

Browser quotas are intentionally browser-specific and should not be hard-coded into business logic.

As of the current MDN guidance:

- Chromium-based browsers generally allow an origin to use roughly 60% of disk in best-effort storage.
- Firefox generally uses a smaller best-effort quota and a separate persistent-storage quota.
- WebKit-based browsers also use origin-level quotas and differentiate browser apps from embedded web views.

Because those rules vary and can change, the app should:

- call `navigator.storage.estimate()` to inspect current usage and quota
- opportunistically call `navigator.storage.persist()` where supported
- warn before large imports when usage is already high
- handle quota errors explicitly in photo writes

### App-level policy

Recommended soft thresholds:

- warn when `usage / quota >= 0.8`
- block new photo imports when a photo write throws `QuotaExceededError`
- show actionable UI: remove photos, duplicate less, export and clear old projects

### Why the new design helps

Even if total stored bytes stay the same, splitting assets from project JSON improves reliability because:

- autosave no longer rewrites all photo bytes
- a caption edit becomes a small metadata write
- failures are localized to the asset being written
- the main project record stays small enough for cheap diffing and serialization

## Size and Performance Estimates

These are illustrative estimates using the current compression target. `PhotoManager` comments already suggest compressed photos are often in the 100-300 KB range.

### Payload expansion

- binary blob size: `N`
- base64 `data:` URL size: about `1.33 * N`
- JS string memory for that base64 payload: roughly `2.66 * N` before extra copies

### Example: 50 photos at 200 KB each

| Metric | Current inline `data:` URL design | Proposed blob + ref design |
|---|---:|---:|
| Binary photo bytes | 10.0 MB | 10.0 MB |
| Serialized photo payload in project JSON | about 13.3 MB | typically 10-30 KB of refs and metadata |
| In-memory string payload for photo bytes | about 26.6 MB | about 0 MB |
| Autosave JSON touched for a caption edit | about 13.3 MB | typically under 50 KB |
| IndexedDB records rewritten for a caption edit | full `projectData` value | small `projectData` value only |

In practice, the current path often creates additional transient copies during:

- blob fetch from object URL
- `FileReader.readAsDataURL()`
- `JSON.stringify()`
- immutable store updates

So peak memory pressure is worse than the table suggests.

## Save Status Model

The current UI store has one save state for the whole project. That is not enough once photo blobs and project metadata are persisted independently.

### Recommendation

Track project save status as the combination of:

- project JSON persistence
- photo asset persistence
- migration state

### Proposed derived states

```ts
type SaveStatus =
  | "idle"
  | "saving-photos"
  | "saving-project"
  | "saved"
  | "warning"
  | "error";
```

Suggested semantics:

- `saving-photos`: at least one photo blob or legacy migration is still being written
- `saving-project`: blobs are settled, but project metadata save is still pending
- `saved`: latest project version saved and `pendingWrites === 0`
- `warning`: project usable, but one or more photo migrations failed and legacy fallback remains
- `error`: latest write failed and data may be unsynced

### User-facing indicator

Recommended toolbar copy:

- `Saving photos...`
- `Saving changes...`
- `All changes saved`
- `Some photos still need saving`
- `Save failed`

This status should be derived, not manually toggled in multiple places.

## Implementation Plan

### Phase 1: Storage foundation

- Add `DB_VERSION = 2`.
- Add `photoAssets` and `photoRefs` stores.
- Introduce `ProjectDataV2` and legacy-compatible readers.
- Add storage helpers for asset put/get/ref counting.

Exit criteria:

- app can open old projects unchanged
- new schema exists
- no UI behavior changes yet

### Phase 2: PhotoStore abstraction

- Add `photoStore.ts` or equivalent module.
- Move blob hashing, asset writes, object URL caching, and deletion logic into it.
- Add `navigator.storage.estimate()` support and quota-aware errors.

Exit criteria:

- all photo persistence flows use `photoStore`
- `projectStore` no longer contains blob persistence details

### Phase 3: New upload and restore flow

- Update photo add flow to store blobs first, not `data:` URLs.
- Persist `assetId` refs in project JSON.
- Restore photos from asset IDs and create object URLs.
- Revoke object URLs on cleanup.

Exit criteria:

- new uploads never produce persisted `data:` URLs
- autosave writes lightweight JSON only

### Phase 4: Lazy migration of legacy projects

- Detect legacy photo records on load.
- Migrate them in batches.
- Rewrite migrated projects to v2 format.
- Surface migration progress in save status.

Exit criteria:

- old projects become v2 after successful open/save
- failed migrations degrade safely without data loss

### Phase 5: Cleanup and hardening

- Delete orphaned assets when photos or projects are removed.
- Add repair sweep for mismatched `refCount`.
- Add regression tests for duplicate imports, project duplication, deletion, and migration resume.

Exit criteria:

- no asset leaks after project/photo deletion
- dedupe works across projects

## Testing Requirements

Minimum scenarios:

1. Add 50 photos, reload, and confirm all photos restore from persisted blobs.
2. Edit captions repeatedly and confirm no photo asset writes are triggered.
3. Import the same file multiple times and confirm one `photoAssets` record is reused.
4. Duplicate a project and confirm photo bytes are not duplicated.
5. Delete a photo and confirm ref counts and orphan cleanup are correct.
6. Delete a project and confirm only unreferenced assets are removed.
7. Open a legacy project with inline `data:` URLs and confirm lazy migration succeeds.
8. Simulate quota failure and confirm save status becomes `warning` or `error` without corrupting existing photos.

## Recommendation

Adopt separate IndexedDB photo asset storage with binary blobs and hash-based references.

This is the highest-leverage fix because it directly addresses the current memory, serialization, write amplification, and persistence-reliability problems without changing the editor’s product model.

The key architectural rule should be simple:

- project JSON stores references and metadata
- photo bytes live in their own asset store
- runtime URLs are transient caches, not persisted state

## References

- MDN: Storage quotas and eviction criteria
  https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- MDN: StorageManager.estimate()
  https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate
- MDN: StorageManager.persist()
  https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
- MDN: Structured clone algorithm
  https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
