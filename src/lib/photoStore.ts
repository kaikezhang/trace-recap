import { getPhotoAsset } from "@/lib/storage";

export interface PersistedPhotoHandle {
  assetId: string;
  url: string;
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

function notImplemented(method: string): Error {
  return new Error(`photoStore.${method} is deferred to a later persistence phase.`);
}

class IndexedDbPhotoStore implements PhotoStore {
  private readonly objectUrlCache = new Map<
    string,
    { url: string; leases: number }
  >();

  private readonly persistenceState = new Map<string, PhotoPersistenceState>();

  async putPhoto(): Promise<PersistedPhotoHandle> {
    throw notImplemented("putPhoto");
  }

  async importLegacyDataUrl(): Promise<PersistedPhotoHandle> {
    throw notImplemented("importLegacyDataUrl");
  }

  async attachExistingAsset(): Promise<PersistedPhotoHandle> {
    throw notImplemented("attachExistingAsset");
  }

  async getObjectUrl(assetId: string): Promise<string> {
    const cached = this.objectUrlCache.get(assetId);
    if (cached) {
      cached.leases += 1;
      return cached.url;
    }

    const asset = await getPhotoAsset(assetId);
    if (!asset) {
      throw new Error(`Photo asset ${assetId} does not exist.`);
    }

    const url = URL.createObjectURL(asset.blob);
    this.objectUrlCache.set(assetId, { url, leases: 1 });
    return url;
  }

  releaseObjectUrl(assetId: string): void {
    const cached = this.objectUrlCache.get(assetId);
    if (!cached) {
      return;
    }

    cached.leases -= 1;
    if (cached.leases <= 0) {
      URL.revokeObjectURL(cached.url);
      this.objectUrlCache.delete(assetId);
    }
  }

  async deletePhoto(): Promise<void> {
    throw notImplemented("deletePhoto");
  }

  async deleteProjectPhotos(): Promise<void> {
    throw notImplemented("deleteProjectPhotos");
  }

  getPersistenceState(projectId: string): PhotoPersistenceState {
    return (
      this.persistenceState.get(projectId) ?? {
        pendingWrites: 0,
        failedWrites: 0,
        pendingMigrations: 0,
      }
    );
  }

  async estimateStorage(): Promise<{
    usage?: number;
    quota?: number;
    persisted?: boolean;
  }> {
    if (
      typeof navigator === "undefined" ||
      typeof navigator.storage?.estimate !== "function"
    ) {
      return {};
    }

    const [estimate, persisted] = await Promise.all([
      navigator.storage.estimate(),
      typeof navigator.storage.persisted === "function"
        ? navigator.storage.persisted()
        : Promise.resolve(undefined),
    ]);

    return {
      usage: estimate.usage,
      quota: estimate.quota,
      persisted,
    };
  }
}

export const photoStore: PhotoStore = new IndexedDbPhotoStore();
