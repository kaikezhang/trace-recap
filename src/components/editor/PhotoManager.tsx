"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, LayoutGrid, Undo2, Redo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/imageUtils";
import { useProjectStore } from "@/stores/projectStore";
import { useHistoryStore } from "@/stores/historyStore";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

async function processImageFiles(
  files: FileList | null,
  maxCount: number,
  addPhoto: (locationId: string, photo: { url: string }) => void,
  locationId: string
) {
  if (!files) return;
  const toAdd = Array.from(files).slice(0, maxCount);
  for (const file of toAdd) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) continue;
    if (file.size > MAX_FILE_SIZE) {
      console.warn(`Skipped "${file.name}": exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      continue;
    }
    // Compress: resize to max 1920px + JPEG 80% → typically 100-300KB per photo
    const compressed = await compressImage(file);
    const url = URL.createObjectURL(compressed);
    addPhoto(locationId, { url });
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
              <div key={photo.id} className="relative group">
                <div className="relative aspect-square">
                  <img
                    src={photo.url}
                    alt=""
                    className="w-full h-full rounded-lg object-cover bg-muted"
                  />
                  <button
                    className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                    onClick={() => removePhoto(locationId, photo.id)}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={photo.caption ?? ""}
                  placeholder="Add caption..."
                  className="w-full mt-1 px-1 py-0.5 text-[10px] text-gray-600 bg-transparent border border-transparent rounded hover:border-gray-300 focus:border-indigo-400 focus:outline-none truncate"
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
              className="h-7 text-xs gap-1"
              onClick={() => onEditLayout(locationId)}
            >
              <LayoutGrid className="h-3 w-3" />
              Layout
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
