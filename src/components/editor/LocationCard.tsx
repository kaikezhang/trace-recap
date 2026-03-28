"use client";

import { X, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import PhotoManager from "./PhotoManager";
import type { Location } from "@/types";

interface LocationCardProps {
  location: Location;
  index: number;
  total: number;
  onRemove: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onToggleWaypoint: (id: string) => void;
}

export default function LocationCard({
  location,
  index,
  total,
  onRemove,
  onMoveUp,
  onMoveDown,
  onToggleWaypoint,
}: LocationCardProps) {
  const isFirstOrLast = index === 0 || index === total - 1;
  const isWaypoint = location.isWaypoint;

  return (
    <div
      className={`rounded-lg border bg-card p-3 shadow-sm space-y-2 ${
        isWaypoint ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            disabled={index === 0}
            onClick={() => onMoveUp(index)}
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <GripVertical className="h-3 w-3 text-muted-foreground" />
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            disabled={index === total - 1}
            onClick={() => onMoveDown(index)}
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate">{location.name}</p>
            {isWaypoint && (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                fly-through
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
            title={isWaypoint ? "Switch to destination" : "Switch to fly-through"}
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
