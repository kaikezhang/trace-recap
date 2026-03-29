"use client";

import { useState, useRef, useEffect } from "react";
import { X, GripVertical, Pencil } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PhotoManager, { usePhotoDropZone } from "./PhotoManager";
import { useProjectStore } from "@/stores/projectStore";
import type { Location } from "@/types";

interface LocationCardProps {
  location: Location;
  index: number;
  total: number;
  onRemove: (id: string) => void;
  onToggleWaypoint: (id: string) => void;
  onClick?: (index: number) => void;
  onEditLayout?: (locationId: string) => void;
}

function EditableName({
  value,
  placeholder,
  onSave,
  className,
}: {
  value: string;
  placeholder: string;
  onSave: (val: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onSave(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSave(draft);
            setEditing(false);
          } else if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        className={`h-6 text-xs px-1 py-0 ${className ?? ""}`}
      />
    );
  }

  return (
    <span
      data-no-seek
      className={`cursor-pointer hover:underline decoration-dotted underline-offset-2 ${className ?? ""}`}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      title="Click to edit"
    >
      {value || <span className="text-muted-foreground italic">{placeholder}</span>}
    </span>
  );
}

export default function LocationCard({
  location,
  index,
  total,
  onRemove,
  onToggleWaypoint,
  onClick,
  onEditLayout,
}: LocationCardProps) {
  const isFirst = index === 0;
  const isWaypoint = location.isWaypoint;
  const updateLocation = useProjectStore((s) => s.updateLocation);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: location.id });

  const { isDragOver, dropProps } = usePhotoDropZone(location.id);

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
      {...dropProps}
      className={`rounded-xl border bg-card p-3 md:p-4 shadow-sm space-y-2 ${
        isWaypoint ? "opacity-60" : ""
      } ${isDragging ? "shadow-lg" : ""} ${
        isDragOver ? "ring-2 ring-primary ring-offset-1 bg-primary/5" : ""
      } ${onClick ? "cursor-pointer" : ""}`}
      onClick={(e) => {
        // Don't trigger if clicking on buttons, inputs, or editable name spans
        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("input") || target.closest("[data-no-seek]") || target.closest("[contenteditable]")) return;
        onClick?.(index);
      }}
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
            <EditableName
              value={location.name}
              placeholder="English name"
              onSave={(val) => updateLocation(location.id, { name: val })}
              className="text-sm font-medium truncate"
            />
            {isWaypoint && (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                stop by
              </span>
            )}
          </div>
          <EditableName
            value={location.nameZh ?? ""}
            placeholder="中文名"
            onSave={(val) => updateLocation(location.id, { nameZh: val || undefined })}
            className="text-xs text-muted-foreground"
          />
        </div>
        {!isFirst && (
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
      <PhotoManager locationId={location.id} onEditLayout={onEditLayout} />
    </div>
  );
}
