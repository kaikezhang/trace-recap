import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { getPhotoAsset, putPhotoAsset } from "@/lib/storage";
import { useAuthStore } from "@/stores/authStore";

const MAX_CONCURRENT_UPLOADS = 3;
const uploadQueue: Array<{ assetId: string; blob: Blob; projectId?: string }> = [];
let activeUploads = 0;

function getStoragePath(userId: string, assetId: string): string {
  return `${userId}/${assetId}.webp`;
}

async function processUploadQueue(): Promise<void> {
  while (uploadQueue.length > 0 && activeUploads < MAX_CONCURRENT_UPLOADS) {
    const item = uploadQueue.shift();
    if (!item) break;

    activeUploads++;
    try {
      await uploadToStorage(item.assetId, item.blob, item.projectId);
    } catch (err) {
      console.error(`[photoSync] Upload failed for ${item.assetId}:`, err);
    } finally {
      activeUploads--;
    }
  }
}

async function uploadToStorage(assetId: string, blob: Blob, projectId?: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();
  const user = useAuthStore.getState().user;
  if (!supabase || !user) return;

  const storagePath = getStoragePath(user.id, assetId);

  const { error } = await supabase.storage
    .from("photos")
    .upload(storagePath, blob, {
      contentType: blob.type || "image/jpeg",
      upsert: true,
    });

  if (error) {
    console.error(`[photoSync] Storage upload failed:`, error.message);
    return;
  }

  // Update local asset record with storage path
  const asset = await getPhotoAsset(assetId);
  if (asset) {
    await putPhotoAsset({ ...asset, storagePath });
  }

  // Insert cloud photo_assets metadata row
  await supabase.from("photo_assets").upsert({
    id: assetId,
    user_id: user.id,
    storage_path: storagePath,
    mime_type: blob.type || "image/jpeg",
    byte_size: blob.size,
    width: asset?.width ?? 0,
    height: asset?.height ?? 0,
  });

  // Insert project_photo_refs row if projectId is known
  if (projectId) {
    await supabase.from("project_photo_refs").upsert({
      project_id: projectId,
      asset_id: assetId,
    });
  }
}

/** Queue a photo for background upload to Supabase Storage */
export function queueUpload(assetId: string, blob: Blob, projectId?: string): void {
  uploadQueue.push({ assetId, blob, projectId });
  void processUploadQueue();
}

/** Download a photo from Supabase Storage and save to local IDB */
export async function downloadPhoto(assetId: string): Promise<Blob | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const user = useAuthStore.getState().user;
  if (!supabase || !user) return null;

  // Check if we have cloud metadata for this asset
  const { data: cloudAsset } = await supabase
    .from("photo_assets")
    .select("storage_path, mime_type, byte_size, width, height")
    .eq("id", assetId)
    .single();

  if (!cloudAsset) return null;

  // Download blob from storage
  const { data: blob, error } = await supabase.storage
    .from("photos")
    .download(cloudAsset.storage_path);

  if (error || !blob) {
    console.error(`[photoSync] Download failed for ${assetId}:`, error?.message);
    return null;
  }

  // Save to local IDB — preserve existing refCount if asset already exists
  const existingAsset = await getPhotoAsset(assetId);
  await putPhotoAsset({
    id: assetId,
    blob,
    mimeType: cloudAsset.mime_type,
    byteSize: cloudAsset.byte_size,
    width: cloudAsset.width,
    height: cloudAsset.height,
    createdAt: existingAsset?.createdAt ?? Date.now(),
    lastAccessedAt: Date.now(),
    refCount: existingAsset?.refCount ?? 0,
    storagePath: cloudAsset.storage_path,
  });

  return blob;
}
