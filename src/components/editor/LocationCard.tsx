"use client";

import { X, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import PhotoManager from "./PhotoManager";
import type { Location } from "@/types";

interface LocationCardProps {
  location: Location;
  index: number;
  total: number;
  onRemove: (id: string) => void;
  onToggleWaypoint: (id: string) => void;
}

export default function LocationCard({
  location,
  index,
  total,
  onRemove,
  onToggleWaypoint,
}: LocationCardProps) {
  const isFirstOrLast = index === 0 || index === total - 1;
  const isWaypoint = location.isWaypoint;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: location.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-card p-3 shadow-sm space-y-2 ${
        isWaypoint ? "opacity-60" : ""
      } ${isDragging ? "shadow-lg" : ""}`}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex items-center cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate">{location.name}</p>
            {isWaypoint && (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                stop by
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {location.coordinates[1].toFixed(2)},{" "}
            {location.coordinates[0].toFixed(2)}
          </p>
        </div>
        {!isFirstOrLast && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            title={isWaypoint ? "Switch to destination" : "Switch to stop by"}
            onClick={() => onToggleWaypoint(location.id)}
          >
            <span className="text-sm">{isWaypoint ? "\u2708\uFE0F" : "\uD83C\uDFE0"}</span>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => onRemove(location.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <PhotoManager locationId={location.id} />
    </div>
  );
}
