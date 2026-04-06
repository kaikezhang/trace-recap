"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, Trash2, LayoutGrid, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImage, getImageDimensions } from "@/lib/imageUtils";
import { useProjectStore } from "@/stores/projectStore";
import { useHistoryStore } from "@/stores/historyStore";
import { useAuthStore } from "@/stores/authStore";
import { putPhotoAsset, attachPhotoRef } from "@/lib/storage";
import { queueUpload } from "@/lib/sync/photoSync";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function processImageFiles(
  files: FileList | null,
  maxCount: number,
  addPhoto: (locationId: string, photo: { url: string }) => string,
  locationId: string
) {
  if (!files) return;
  const toAdd = Array.from(files).slice(0, maxCount);
  const currentProjectId = useProjectStore.getState().currentProjectId;

  for (const file of toAdd) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) continue;
    if (file.size > MAX_FILE_SIZE) {
      console.warn(`Skipped "${file.name}": exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      continue;
    }
    // Compress: resize to max 1920px + JPEG 80% → typically 100-300KB per photo
    const compressed = await compressImage(file);

    // Convert directly to data URL for persistence safety — blob URLs die on page reload
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(compressed);
    });

    // Get dimensions from the data URL
    const dimensions = await getImageDimensions(dataUrl);
    const width = dimensions?.width ?? 0;
    const height = dimensions?.height ?? 0;

    const photoId = addPhoto(locationId, { url: dataUrl });

    // Write blob to IDB photoAssets for cloud sync
    const assetId = crypto.randomUUID();
    await putPhotoAsset({
      id: assetId,
      blob: compressed,
      mimeType: compressed.type || "image/jpeg",
      byteSize: compressed.size,
      width,
      height,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      refCount: 0, // attachPhotoRef will increment to 1
    });

    if (currentProjectId) {
      await attachPhotoRef({ projectId: currentProjectId, photoId, assetId });
    }

    // Queue cloud upload if authenticated
    if (useAuthStore.getState().user) {
      queueUpload(assetId, compressed);
    }
  }
}

interface PhotoManagerProps {
  locationId: string;
  onEditLayout?: (locationId: string) => void;
}

export function usePhotoDropZone(locationId: string) {
  const [isDragOver, setIsDragOver] = useState(false);
  const addPhoto = useProjectStore((s) => s.addPhoto);
  const location = useProjectStore((s) =>
    s.locations.find((l) => l.id === locationId)
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || !location) return;
      const remaining = 9 - location.photos.length;
      void processImageFiles(files, remaining, addPhoto, locationId);
    },
    [locationId, location, addPhoto]
  );

  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
  };

  return { isDragOver, dropProps, handleFiles };
}

export default function PhotoManager({ locationId, onEditLayout }: PhotoManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const location = useProjectStore((s) =>
    s.locations.find((l) => l.id === locationId)
  );
  const addPhoto = useProjectStore((s) => s.addPhoto);
  const removePhoto = useProjectStore((s) => s.removePhoto);
  const setPhotoCaption = useProjectStore((s) => s.setPhotoCaption);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.canUndo);
  const canRedo = useHistoryStore((s) => s.canRedo);

  if (!location) return null;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = 9 - location.photos.length;
    void processImageFiles(files, remaining, addPhoto, locationId);
  };

  const hasPhotos = location.photos.length > 0;
  const canAddMore = location.photos.length < 9;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.gif"

        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); if (inputRef.current) inputRef.current.value = ""; }}
      />

      {hasPhotos ? (
        <>
          {/* Photo grid with add button */}
          <div className="grid grid-cols-4 gap-1.5">
            {location.photos.map((photo) => (
              <div key={photo.id} className="relative">
                <div className="relative">
                  <img
                    src={photo.url}
                    alt=""
                    className="w-full rounded-lg object-contain bg-muted"
                    style={{ aspectRatio: "auto", maxHeight: "120px", minHeight: "60px" }}
                  />
                  <button
                    type="button"
                    aria-label="Delete photo"
                    className="absolute -right-2 -top-2 flex h-11 w-11 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm md:-right-1 md:-top-1 md:h-9 md:w-9"
                    onClick={() => removePhoto(locationId, photo.id)}
                  >
                    <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={photo.caption ?? ""}
                  placeholder="Add caption..."
                  className="mt-1 min-h-11 w-full rounded-md border border-transparent bg-transparent px-2 py-2 text-xs text-gray-600 hover:border-gray-300 focus:border-indigo-400 focus:outline-none md:min-h-9 md:px-2 md:py-1.5 md:text-[11px] truncate"
                  onChange={(e) => {
                    setPhotoCaption(locationId, photo.id, e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
              </div>
            ))}
            {canAddMore && (
              <button
                onClick={() => inputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50 flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[10px] text-gray-400">Add</span>
              </button>
            )}
          </div>
        </>
      ) : (
        /* Empty state — dashed upload zone */
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full py-8 border-2 border-dashed border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/50 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <Upload className="w-5 h-5 text-gray-400" />
          </div>
          <span className="text-sm text-gray-500">Click or drag photos here</span>
        </button>
      )}

      {/* Layout + Undo/Redo buttons */}
      {hasPhotos && (
        <div className="flex items-center gap-1">
          {onEditLayout && (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 px-3 text-sm gap-1.5 md:min-h-9 md:text-xs"
              onClick={() => onEditLayout(locationId)}
            >
              <LayoutGrid className="h-4 w-4 md:h-3.5 md:w-3.5" />
              Layout
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 md:h-9 md:w-9"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
          >
            <Undo2 className="h-4.5 w-4.5 md:h-4 md:w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 md:h-9 md:w-9"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
          >
            <Redo2 className="h-4.5 w-4.5 md:h-4 md:w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
