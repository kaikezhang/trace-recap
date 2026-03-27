"use client";

import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/stores/projectStore";

interface PhotoManagerProps {
  locationId: string;
}

export default function PhotoManager({ locationId }: PhotoManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const location = useProjectStore((s) =>
    s.locations.find((l) => l.id === locationId)
  );
  const addPhoto = useProjectStore((s) => s.addPhoto);
  const removePhoto = useProjectStore((s) => s.removePhoto);

  if (!location) return null;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = 5 - location.photos.length;
    const toAdd = Array.from(files).slice(0, remaining);
    for (const file of toAdd) {
      const url = URL.createObjectURL(file);
      addPhoto(locationId, { url });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
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
                className="h-12 w-12 rounded object-cover"
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
      {location.photos.length < 5 && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="h-3 w-3" />
            Add Photo
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}
    </div>
  );
}
