"use client";

import { memo, useState, useRef, useEffect } from "react";
import { X, GripVertical, ChevronRight, Image as ImageIcon, Smile } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Input } from "@/components/ui/input";
import PhotoManager, { usePhotoDropZone } from "./PhotoManager";
import { useProjectStore } from "@/stores/projectStore";
import { useLocation } from "@/stores/selectors";

interface LocationCardProps {
  locationId: string;
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

/* ── Travel emoji palette ── */
const TRAVEL_EMOJIS = [
  // Cities & landmarks
  "🏯", "⛩️", "🗼", "🗽", "🏰", "⛪", "🕌", "🛕", "🏛️", "🎡",
  "🎢", "🏟️", "🕍", "⛲", "🗿", "🧱", "🏗️", "🌁", "🌆", "🏙️",
  // Nature & scenery
  "🏔️", "🌋", "🏖️", "🌊", "🌅", "🌄", "🏜️", "🌲", "🌸", "🍁",
  "🌴", "🌵", "🍀", "🌾", "🪵", "🌿", "🦋", "🐠", "🐬", "🦩",
  // Food & drink
  "🍣", "🍜", "🍕", "🥐", "🍷", "☕", "🧋", "🍦", "🥘", "🍱",
  "🌮", "🥟", "🍔", "🥖", "🍰", "🫕", "🍤", "🥗", "🍻", "🫖",
  // Activities & culture
  "🎭", "🎪", "🎶", "🛍️", "📸", "🎿", "🏄", "🚴", "⛷️", "🧗",
  "🎨", "🎵", "💃", "🏊", "⛳", "🎣", "🧘", "🤿", "🛹", "🏇",
  // Transport
  "✈️", "🚅", "🚗", "⛵", "🚠", "🛶", "🚲", "🛺", "🚢", "🚁",
  "🚂", "🛩️", "🚌", "🛵", "🚤", "🚡", "🛻", "🏍️", "⛴️", "🚀",
  // Weather & time
  "☀️", "🌙", "⛅", "🌈", "❄️", "🌧️", "⛈️", "🌤️", "🔥", "💨",
  // Misc travel
  "🗺️", "🧭", "🏕️", "🌃", "🌉", "🎑", "🏞️", "🌺", "🐚", "⭐",
  "❤️", "🎒", "🛎️", "📍", "🎫", "🔔", "💎", "🪷", "🎆", "🎇",
];

function EmojiPicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative" data-no-seek>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-10 items-center justify-center rounded-md border bg-background text-sm hover:bg-accent transition-colors"
        title="Pick emoji"
      >
        {value || <Smile className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 mb-1 z-50 w-[240px] rounded-lg border bg-popover p-2 shadow-lg"
          >
            <div className="grid grid-cols-10 gap-0.5 max-h-[180px] overflow-y-auto">
              {TRAVEL_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onSelect(emoji);
                    setOpen(false);
                  }}
                  className={`flex h-6 w-6 items-center justify-center rounded text-sm hover:bg-accent transition-colors ${
                    value === emoji ? "bg-accent ring-1 ring-primary" : ""
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="mt-1.5 pt-1.5 border-t flex items-center gap-1.5">
              <Input
                ref={customInputRef}
                placeholder="Type or paste emoji"
                className="h-6 flex-1 text-center text-sm px-1 py-0"
                maxLength={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = customInputRef.current?.value.trim();
                    if (val) {
                      onSelect(val);
                      setOpen(false);
                    }
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (val && /\p{Emoji}/u.test(val)) {
                    onSelect(val);
                    setOpen(false);
                  }
                }}
              />
              {value && (
                <button
                  onClick={() => {
                    onSelect("");
                    setOpen(false);
                  }}
                  className="shrink-0 rounded-md px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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

export default memo(function LocationCard({
  locationId,
  index,
  total,
  onRemove,
  onToggleWaypoint,
  onClick,
  onEditLayout,
}: LocationCardProps) {
  const location = useLocation(locationId);
  const [isExpanded, setIsExpanded] = useState(false);
  const updateLocation = useProjectStore((s) => s.updateLocation);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: locationId });

  const { isDragOver, dropProps } = usePhotoDropZone(locationId);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : undefined,
  };

  if (!location) return null;

  const isFirst = index === 0;
  const isWaypoint = location.isWaypoint;
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

        {/* Photo thumbnails (up to 3) + count badge or empty state */}
        <div className="flex gap-0.5 shrink-0">
          {photoThumbnails.length > 0 ? (
            <>
              {photoThumbnails.map((photo) => (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt=""
                  className="w-8 h-8 rounded-lg object-cover bg-muted"
                />
              ))}
              {location.photos.length > 3 && (
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                  +{location.photos.length - 3}
                </div>
              )}
            </>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              <ImageIcon className="w-3 h-3 text-gray-300" />
            </div>
          )}
        </div>

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
            onRemove(locationId);
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
              <div className="flex flex-col gap-1">
                <EditableName
                  value={location.name}
                  placeholder="English name"
                  onSave={(val) => updateLocation(locationId, { name: val })}
                  className="text-sm font-medium block"
                />
                <EditableName
                  value={location.nameZh ?? ""}
                  placeholder="中文名"
                  onSave={(val) => updateLocation(locationId, { nameZh: val || undefined })}
                  className="text-xs text-muted-foreground block"
                />
              </div>

              {/* Waypoint toggle as switch */}
              {!isFirst && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Stop by (waypoint)</span>
                  <WaypointSwitch
                    isWaypoint={!!isWaypoint}
                    onToggle={() => onToggleWaypoint(locationId)}
                  />
                </div>
              )}

              {/* Chapter metadata */}
              {!isWaypoint && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block">Chapter</span>
                    <EditableName
                      value={location.chapterTitle ?? ""}
                      placeholder="Chapter title"
                      onSave={(val) => updateLocation(locationId, { chapterTitle: val || undefined })}
                      className="text-xs block"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block">Note</span>
                    <EditableName
                      value={location.chapterNote ?? ""}
                      placeholder="e.g. Temples & gardens"
                      onSave={(val) => updateLocation(locationId, { chapterNote: val || undefined })}
                      className="text-xs text-muted-foreground block"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block">Date</span>
                      <EditableName
                        value={location.chapterDate ?? ""}
                        placeholder="e.g. Mar 15-17"
                        onSave={(val) => updateLocation(locationId, { chapterDate: val || undefined })}
                        className="text-xs text-muted-foreground block"
                      />
                    </div>
                    <div className="flex flex-col gap-1 items-center">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Icon</span>
                      <EmojiPicker
                        value={location.chapterEmoji ?? ""}
                        onSelect={(val) => updateLocation(locationId, { chapterEmoji: val || undefined })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Photo manager */}
              <PhotoManager locationId={locationId} onEditLayout={onEditLayout} />

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
