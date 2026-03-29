"use client";

import { useState, useRef, useEffect } from "react";
import { X, GripVertical, ChevronRight, Pencil, LayoutGrid } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

function WaypointSwitch({
  isWaypoint,
  onToggle,
}: {
  isWaypoint: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        isWaypoint ? "bg-gray-300" : "bg-indigo-500"
      }`}
      title={isWaypoint ? "Switch to destination" : "Switch to stop by"}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
          isWaypoint ? "translate-x-1" : "translate-x-[18px]"
        }`}
      />
    </button>
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
  const [isExpanded, setIsExpanded] = useState(false);
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

  const photoThumbnails = location.photos.slice(0, 3);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...dropProps}
      className={`rounded-xl border bg-card shadow-sm ${
        isWaypoint ? "opacity-60" : ""
      } ${isDragging ? "shadow-lg" : ""} ${
        isDragOver ? "ring-2 ring-primary ring-offset-1 bg-primary/5" : ""
      }`}
    >
      {/* Collapsed row */}
      <div
        className="flex items-center gap-2 p-3 md:p-3 cursor-pointer"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (
            target.closest("[data-drag-handle]") ||
            target.closest("[data-delete-btn]") ||
            target.closest("[data-no-seek]") ||
            target.closest("input")
          )
            return;
          setIsExpanded((v) => !v);
          onClick?.(index);
        }}
      >
        {/* Drag handle */}
        <div
          data-drag-handle
          className="flex items-center cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Number badge */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-semibold text-white">
          {index + 1}
        </div>

        {/* Names on one line */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 truncate">
          <span className="text-sm font-medium truncate">
            {location.name || <span className="text-muted-foreground italic">English name</span>}
          </span>
          {location.nameZh && (
            <span className="text-xs text-muted-foreground truncate">
              {location.nameZh}
            </span>
          )}
          {isWaypoint && (
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              stop by
            </span>
          )}
        </div>

        {/* Photo thumbnails (up to 3) */}
        {photoThumbnails.length > 0 && (
          <div className="flex gap-0.5 shrink-0">
            {photoThumbnails.map((photo) => (
              <img
                key={photo.id}
                src={photo.url}
                alt=""
                className="w-8 h-8 rounded-lg object-cover bg-muted"
              />
            ))}
          </div>
        )}

        {/* Chevron */}
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
            isExpanded ? "rotate-90" : ""
          }`}
        />

        {/* Delete button */}
        <button
          data-delete-btn
          className="h-7 w-7 shrink-0 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-red-500 hover:bg-red-50"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(location.id);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3 border-t pt-3">
              {/* Editable names */}
              <div className="space-y-1.5">
                <EditableName
                  value={location.name}
                  placeholder="English name"
                  onSave={(val) => updateLocation(location.id, { name: val })}
                  className="text-sm font-medium"
                />
                <EditableName
                  value={location.nameZh ?? ""}
                  placeholder="中文名"
                  onSave={(val) => updateLocation(location.id, { nameZh: val || undefined })}
                  className="text-xs text-muted-foreground"
                />
              </div>

              {/* Waypoint toggle as switch */}
              {!isFirst && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Stop by (waypoint)</span>
                  <WaypointSwitch
                    isWaypoint={!!isWaypoint}
                    onToggle={() => onToggleWaypoint(location.id)}
                  />
                </div>
              )}

              {/* Photo manager */}
              <PhotoManager locationId={location.id} onEditLayout={onEditLayout} />

              {/* Photo layout edit button */}
              {location.photos.length > 0 && onEditLayout && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 w-full"
                  onClick={() => onEditLayout(location.id)}
                >
                  <LayoutGrid className="h-3 w-3" />
                  Edit Photo Layout
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
