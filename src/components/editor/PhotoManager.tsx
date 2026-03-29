"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, X, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/stores/projectStore";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function processImageFiles(
  files: FileList | null,
  maxCount: number,
  addPhoto: (locationId: string, photo: { url: string }) => void,
  locationId: string
) {
  if (!files) return;
  const toAdd = Array.from(files).slice(0, maxCount);
  for (const file of toAdd) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size > MAX_FILE_SIZE) {
      console.warn(`Skipped "${file.name}": exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      continue;
    }
    try {
      const url = await readFileAsDataURL(file);
      addPhoto(locationId, { url });
    } catch (err) {
      console.warn(`Failed to read "${file.name}":`, err);
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

  if (!location) return null;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = 9 - location.photos.length;
    void processImageFiles(files, remaining, addPhoto, locationId);
  };

  return (
    <div className="space-y-2">
      {location.photos.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {location.photos.map((photo) => (
            <div key={photo.id} className="relative group">
              <img
                src={photo.url}
                alt=""
                className="h-16 max-w-[64px] rounded object-contain bg-muted"
              />
              <button
                className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                onClick={() => removePhoto(locationId, photo.id)}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        {location.photos.length < 9 && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-3 w-3" />
              Upload
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </>
        )}
        {location.photos.length > 0 && onEditLayout && (
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
      </div>
    </div>
  );
}
