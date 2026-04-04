"use client";

import { memo, useEffect, useRef, useState } from "react";
import {
  Bike,
  Bus,
  Car,
  ChevronRight,
  Footprints,
  Image as ImageIcon,
  Plane,
  Ship,
  Smile,
  TrainFront,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Input } from "@/components/ui/input";
import { brand } from "@/lib/brand";
import { useProjectStore } from "@/stores/projectStore";
import { useLocation } from "@/stores/selectors";
import type { TransportMode } from "@/types";
import PhotoManager, { usePhotoDropZone } from "./PhotoManager";

interface LocationCardProps {
  locationId: string;
  index: number;
  total: number;
  transportMode?: TransportMode;
  selected?: boolean;
  onRemove: (id: string) => void;
  onToggleWaypoint: (id: string) => void;
  onClick?: (index: number) => void;
  onEditLayout?: (locationId: string) => void;
}

const TRANSPORT_ICONS: Record<TransportMode, LucideIcon> = {
  flight: Plane,
  car: Car,
  train: TrainFront,
  bus: Bus,
  ferry: Ship,
  walk: Footprints,
  bicycle: Bike,
};

const TRANSPORT_LABELS: Record<TransportMode, string> = {
  flight: "Flight leg",
  car: "Road leg",
  train: "Train leg",
  bus: "Bus leg",
  ferry: "Ferry leg",
  walk: "Walking leg",
  bicycle: "Bike leg",
};

function DragGrip() {
  return (
    <span className="grid grid-cols-2 gap-[3px]">
      {Array.from({ length: 6 }, (_, index) => (
        <span
          key={index}
          className="h-[3px] w-[3px] rounded-full"
          style={{ backgroundColor: brand.colors.warm[400] }}
        />
      ))}
    </span>
  );
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
        className={`h-7 border-[#fdba74] bg-white/85 px-2 py-0 text-xs ${className ?? ""}`}
      />
    );
  }

  return (
    <span
      data-no-seek
      className={`cursor-pointer decoration-dotted underline-offset-2 hover:underline ${className ?? ""}`}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      title="Click to edit"
    >
      {value || <span className="italic text-muted-foreground">{placeholder}</span>}
    </span>
  );
}

const TRAVEL_EMOJIS = [
  "🏯", "⛩️", "🗼", "🗽", "🏰", "⛪", "🕌", "🛕", "🏛️", "🎡",
  "🎢", "🏟️", "🕍", "⛲", "🗿", "🧱", "🏗️", "🌁", "🌆", "🏙️",
  "🏔️", "🌋", "🏖️", "🌊", "🌅", "🌄", "🏜️", "🌲", "🌸", "🍁",
  "🌴", "🌵", "🍀", "🌾", "🪵", "🌿", "🦋", "🐠", "🐬", "🦩",
  "🍣", "🍜", "🍕", "🥐", "🍷", "☕", "🧋", "🍦", "🥘", "🍱",
  "🌮", "🥟", "🍔", "🥖", "🍰", "🫕", "🍤", "🥗", "🍻", "🫖",
  "🎭", "🎪", "🎶", "🛍️", "📸", "🎿", "🏄", "🚴", "⛷️", "🧗",
  "🎨", "🎵", "💃", "🏊", "⛳", "🎣", "🧘", "🤿", "🛹", "🏇",
  "✈️", "🚅", "🚗", "⛵", "🚠", "🛶", "🚲", "🛺", "🚢", "🚁",
  "🚂", "🛩️", "🚌", "🛵", "🚤", "🚡", "🛻", "🏍️", "⛴️", "🚀",
  "☀️", "🌙", "⛅", "🌈", "❄️", "🌧️", "⛈️", "🌤️", "🔥", "💨",
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
        onClick={() => setOpen((openState) => !openState)}
        className="flex h-8 w-11 items-center justify-center rounded-xl border transition-colors"
        style={{
          borderColor: brand.colors.warm[200],
          backgroundColor: "rgba(255,255,255,0.86)",
        }}
        title="Pick emoji"
      >
        {value || <Smile className="h-3.5 w-3.5" style={{ color: brand.colors.warm[500] }} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 z-50 mb-1 w-[240px] rounded-2xl border p-2 shadow-lg"
            style={{
              backgroundColor: "rgba(255,251,245,0.98)",
              borderColor: brand.colors.warm[200],
              boxShadow: brand.shadows.lg,
            }}
          >
            <div className="grid max-h-[180px] grid-cols-10 gap-0.5 overflow-y-auto">
              {TRAVEL_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onSelect(emoji);
                    setOpen(false);
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded text-sm transition-colors hover:bg-white"
                  style={{
                    boxShadow: value === emoji ? `inset 0 0 0 1px ${brand.colors.primary[400]}` : undefined,
                    backgroundColor: value === emoji ? brand.colors.primary[100] : "transparent",
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div
              className="mt-1.5 flex items-center gap-1.5 border-t pt-1.5"
              style={{ borderColor: brand.colors.warm[200] }}
            >
              <Input
                ref={customInputRef}
                placeholder="Type or paste emoji"
                className="h-6 flex-1 bg-white/85 px-1 py-0 text-center text-sm"
                maxLength={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const nextValue = customInputRef.current?.value.trim();
                    if (nextValue) {
                      onSelect(nextValue);
                      setOpen(false);
                    }
                  }
                }}
                onChange={(e) => {
                  const nextValue = e.target.value.trim();
                  if (nextValue && /\p{Emoji}/u.test(nextValue)) {
                    onSelect(nextValue);
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
                  className="shrink-0 rounded-md px-2 py-0.5 text-[10px] transition-colors hover:bg-white"
                  style={{ color: brand.colors.warm[500] }}
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
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
      style={{
        backgroundColor: isWaypoint ? brand.colors.warm[300] : brand.colors.primary[500],
      }}
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
  total: _total,
  transportMode,
  selected = false,
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
    opacity: isDragging ? 0.65 : undefined,
  };

  if (!location) return null;

  const isFirst = index === 0;
  const isWaypoint = location.isWaypoint;
  const photoCount = location.photos.length;
  const coverPhoto = location.photos[0];
  const AccentIcon = transportMode ? TRANSPORT_ICONS[transportMode] : null;
  const transportLabel = transportMode ? TRANSPORT_LABELS[transportMode] : undefined;

  return (
    <div
      ref={setNodeRef}
      {...dropProps}
      className={`group relative overflow-hidden rounded-[26px] border transition-all duration-200 ${
        isDragOver ? "ring-2 ring-[#fdba74] ring-offset-1 ring-offset-[#fffbf5]" : ""
      } ${selected || isExpanded ? "translate-x-[2px]" : ""}`}
      style={{
        ...style,
        borderColor: selected || isExpanded ? brand.colors.primary[300] : brand.colors.warm[200],
        background: isWaypoint
          ? `linear-gradient(160deg, ${brand.colors.warm[50]} 0%, rgba(255,255,255,0.95) 100%)`
          : "rgba(255,255,255,0.92)",
        boxShadow: isDragging ? brand.shadows.lg : brand.shadows.md,
      }}
    >
      <div
        className="absolute inset-y-4 left-0 w-[4px] rounded-r-full"
        style={{
          backgroundColor:
            selected || isExpanded ? brand.colors.primary[500] : brand.colors.primary[200],
        }}
      />

      <div
        className="flex cursor-pointer items-center gap-3 p-3.5 md:p-4"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (
            target.closest("[data-drag-handle]") ||
            target.closest("[data-delete-btn]") ||
            target.closest("[data-no-seek]") ||
            target.closest("input")
          ) {
            return;
          }
          setIsExpanded((expanded) => !expanded);
          onClick?.(index);
        }}
      >
        <div
          data-drag-handle
          className="flex h-10 w-9 shrink-0 cursor-grab items-center justify-center rounded-2xl border active:cursor-grabbing touch-none"
          style={{
            borderColor: brand.colors.warm[200],
            backgroundColor: "rgba(255,251,245,0.92)",
          }}
          {...attributes}
          {...listeners}
        >
          <DragGrip />
        </div>

        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] text-sm font-semibold text-white"
          style={{
            background: `linear-gradient(160deg, ${brand.colors.primary[500]} 0%, ${brand.colors.primary[400]} 100%)`,
            boxShadow: brand.shadows.sm,
          }}
        >
          {index + 1}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="truncate text-[15px] font-semibold"
              style={{ color: brand.colors.warm[900] }}
            >
              {location.name || (
                <span className="italic" style={{ color: brand.colors.warm[400] }}>
                  English name
                </span>
              )}
            </span>

            {AccentIcon && (
              <span
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: brand.colors.primary[100] }}
                title={transportLabel}
              >
                <AccentIcon
                  className="h-3.5 w-3.5"
                  style={{ color: brand.colors.primary[600] }}
                />
              </span>
            )}

            {isWaypoint && (
              <span
                className="shrink-0 rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em]"
                style={{
                  color: brand.colors.warm[600],
                  backgroundColor: brand.colors.warm[100],
                }}
              >
                Stopover
              </span>
            )}
          </div>

          <div
            className="mt-1 flex items-center gap-2 overflow-hidden text-xs"
            style={{ color: brand.colors.warm[500] }}
          >
            <span className="truncate">
              {location.nameZh || (isWaypoint ? "Flexible scenic stop" : "Main destination")}
            </span>
            <span className="shrink-0">•</span>
            <span className="truncate">
              {photoCount > 0 ? `${photoCount} photo${photoCount === 1 ? "" : "s"}` : "No photos yet"}
            </span>
          </div>

          {location.chapterNote && (
            <p
              className="mt-1 truncate text-xs"
              style={{ color: brand.colors.warm[600] }}
            >
              {location.chapterNote}
            </p>
          )}
        </div>

        <div className="shrink-0">
          {coverPhoto ? (
            <div className="relative h-14 w-14 overflow-hidden rounded-[18px]" style={{ boxShadow: brand.shadows.sm }}>
              <img
                src={coverPhoto.url}
                alt={location.name ? `${location.name} photo` : "Location photo"}
                className="h-full w-full object-cover"
              />
              {photoCount > 1 && (
                <div
                  className="absolute bottom-1 right-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                  style={{ backgroundColor: "rgba(28,25,23,0.72)" }}
                >
                  +{photoCount - 1}
                </div>
              )}
            </div>
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded-[18px] border"
              style={{
                borderColor: brand.colors.warm[200],
                background: `linear-gradient(160deg, ${brand.colors.sand[100]} 0%, ${brand.colors.primary[50]} 100%)`,
              }}
            >
              <ImageIcon
                className="h-4 w-4"
                style={{ color: brand.colors.warm[400] }}
              />
            </div>
          )}
        </div>

        <button
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white"
          data-no-seek
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded((expanded) => !expanded);
            onClick?.(index);
          }}
          aria-label={isExpanded ? "Collapse location details" : "Expand location details"}
        >
          <ChevronRight
            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
              isExpanded ? "rotate-90" : ""
            }`}
            style={{ color: brand.colors.warm[500] }}
          />
        </button>

        <button
          data-delete-btn
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#fff1f2]"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(locationId);
          }}
          aria-label="Remove location"
        >
          <X className="h-4 w-4" style={{ color: brand.colors.warm[500] }} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div
              className="space-y-4 border-t px-4 pb-4 pt-4"
              style={{
                borderColor: brand.colors.warm[200],
                background: `linear-gradient(180deg, rgba(255,251,245,0.94) 0%, rgba(255,247,237,0.55) 100%)`,
              }}
            >
              <div className="flex flex-col gap-1.5">
                <EditableName
                  value={location.name}
                  placeholder="English name"
                  onSave={(value) => updateLocation(locationId, { name: value })}
                  className="block text-sm font-semibold"
                />
                <EditableName
                  value={location.nameZh ?? ""}
                  placeholder="中文名"
                  onSave={(value) => updateLocation(locationId, { nameZh: value || undefined })}
                  className="block text-xs"
                />
              </div>

              {!isFirst && (
                <div
                  className="flex items-center justify-between rounded-2xl border px-3 py-2.5"
                  style={{
                    borderColor: brand.colors.warm[200],
                    backgroundColor: "rgba(255,255,255,0.68)",
                  }}
                >
                  <div>
                    <p className="text-xs font-medium" style={{ color: brand.colors.warm[800] }}>
                      Stop by
                    </p>
                    <p className="text-[11px]" style={{ color: brand.colors.warm[500] }}>
                      Keep this point as a quick pass-through instead of a chapter stop.
                    </p>
                  </div>
                  <WaypointSwitch
                    isWaypoint={!!isWaypoint}
                    onToggle={() => onToggleWaypoint(locationId)}
                  />
                </div>
              )}

              {!isWaypoint && (
                <div className="grid gap-3">
                  <div
                    className="rounded-2xl border px-3 py-3"
                    style={{
                      borderColor: brand.colors.warm[200],
                      backgroundColor: "rgba(255,255,255,0.7)",
                    }}
                  >
                    <span
                      className="block text-[10px] font-medium uppercase tracking-[0.18em]"
                      style={{ color: brand.colors.warm[500] }}
                    >
                      Chapter
                    </span>
                    <EditableName
                      value={location.chapterTitle ?? ""}
                      placeholder="Chapter title"
                      onSave={(value) => updateLocation(locationId, { chapterTitle: value || undefined })}
                      className="mt-1.5 block text-sm"
                    />
                  </div>

                  <div
                    className="rounded-2xl border px-3 py-3"
                    style={{
                      borderColor: brand.colors.warm[200],
                      backgroundColor: "rgba(255,255,255,0.7)",
                    }}
                  >
                    <span
                      className="block text-[10px] font-medium uppercase tracking-[0.18em]"
                      style={{ color: brand.colors.warm[500] }}
                    >
                      Note
                    </span>
                    <EditableName
                      value={location.chapterNote ?? ""}
                      placeholder="e.g. Temples and gardens"
                      onSave={(value) => updateLocation(locationId, { chapterNote: value || undefined })}
                      className="mt-1.5 block text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <div
                      className="rounded-2xl border px-3 py-3"
                      style={{
                        borderColor: brand.colors.warm[200],
                        backgroundColor: "rgba(255,255,255,0.7)",
                      }}
                    >
                      <span
                        className="block text-[10px] font-medium uppercase tracking-[0.18em]"
                        style={{ color: brand.colors.warm[500] }}
                      >
                        Date
                      </span>
                      <EditableName
                        value={location.chapterDate ?? ""}
                        placeholder="e.g. Mar 15-17"
                        onSave={(value) => updateLocation(locationId, { chapterDate: value || undefined })}
                        className="mt-1.5 block text-sm"
                      />
                    </div>

                    <div
                      className="flex flex-col items-center rounded-2xl border px-3 py-3"
                      style={{
                        borderColor: brand.colors.warm[200],
                        backgroundColor: "rgba(255,255,255,0.7)",
                      }}
                    >
                      <span
                        className="text-[10px] font-medium uppercase tracking-[0.18em]"
                        style={{ color: brand.colors.warm[500] }}
                      >
                        Icon
                      </span>
                      <div className="mt-1.5">
                        <EmojiPicker
                          value={location.chapterEmoji ?? ""}
                          onSelect={(value) => updateLocation(locationId, { chapterEmoji: value || undefined })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <PhotoManager locationId={locationId} onEditLayout={onEditLayout} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
