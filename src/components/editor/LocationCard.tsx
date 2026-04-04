"use client";

import { memo, useEffect, useRef, useState } from "react";
import {
  Bike,
  Bus,
  Car,
  Copy,
  Footprints,
  Image as ImageIcon,
  LayoutTemplate,
  Pencil,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { brand } from "@/lib/brand";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { useLocation } from "@/stores/selectors";
import type { TransportMode } from "@/types";
import OnboardingHint from "./OnboardingHint";
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
  showEditHint?: boolean;
  onDismissEditHint?: () => void;
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

const TRANSPORT_ACCENTS: Record<TransportMode, string> = {
  flight: "#f97316",
  car: "#a16207",
  train: "#0891b2",
  bus: "#a855f7",
  ferry: "#0e7490",
  walk: "#78350f",
  bicycle: "#155e75",
};

function DragGrip() {
  return (
    <span className="grid grid-cols-2 gap-1">
      {Array.from({ length: 6 }, (_, index) => (
        <span
          key={index}
          className="h-1 w-1 rounded-full transition-colors"
          style={{ backgroundColor: brand.colors.warm[400] }}
        />
      ))}
    </span>
  );
}

const LONG_PRESS_DURATION_MS = 550;

function shouldIgnoreContextMenuTarget(target: HTMLElement | null): boolean {
  if (!target) return false;

  return Boolean(
    target.closest(
      "button, input, textarea, select, label, a, [data-drag-handle], [data-no-seek], [data-delete-btn], [data-context-menu-ignore]",
    ),
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
        className="touch-target-mobile flex h-8 w-11 items-center justify-center rounded-xl border transition-colors"
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
            <div className="grid max-h-[260px] grid-cols-5 gap-1 overflow-y-auto sm:max-h-[180px] sm:grid-cols-10 sm:gap-0.5">
              {TRAVEL_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onSelect(emoji);
                    setOpen(false);
                  }}
                  className="touch-target-mobile flex h-6 w-6 items-center justify-center rounded text-sm transition-colors hover:bg-white"
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
                  className="h-11 flex-1 bg-white/85 px-2 py-0 text-center text-sm sm:h-6 sm:px-1"
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
                  className="touch-target-mobile shrink-0 rounded-md px-2 py-0.5 text-[10px] transition-colors hover:bg-white"
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
      type="button"
      aria-label={isWaypoint ? "Switch to destination" : "Switch to stop by"}
      className="touch-target-mobile-hitbox relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
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
  total,
  transportMode,
  selected = false,
  onRemove,
  onToggleWaypoint,
  onClick,
  onEditLayout,
  showEditHint = false,
  onDismissEditHint,
}: LocationCardProps) {
  const location = useLocation(locationId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isNameEditing, setIsNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const updateLocation = useProjectStore((s) => s.updateLocation);
  const duplicateLocation = useProjectStore((s) => s.duplicateLocation);
  const addToast = useUIStore((s) => s.addToast);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchOriginRef = useRef<{ x: number; y: number } | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: locationId });

  const { isDragOver, dropProps } = usePhotoDropZone(locationId);

  if (!location) return null;

  const isFirst = index === 0;
  const canToggleWaypoint = index > 0 && index < total - 1;
  const isWaypoint = location.isWaypoint;
  const photoCount = location.photos.length;
  const coverPhoto = location.photos[0];
  const AccentIcon = !isFirst && transportMode ? TRANSPORT_ICONS[transportMode] : null;
  const transportLabel = !isFirst && transportMode ? TRANSPORT_LABELS[transportMode] : undefined;

  const transformValue = CSS.Transform.toString(transform);
  const composedTransform = [
    transformValue,
    !isDragging && isHovered ? "translateY(-1px)" : null,
    isWaypoint ? "scale(0.92)" : null,
  ]
    .filter(Boolean)
    .join(" ");
  const accentColor = !isFirst && transportMode
    ? TRANSPORT_ACCENTS[transportMode]
    : brand.colors.primary[500];
  const style = {
    transform: composedTransform || undefined,
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.65 : isWaypoint ? 0.72 : 1,
    transformOrigin: "top center" as const,
  };

  const clearLongPressTimer = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  useEffect(() => clearLongPressTimer, []);

  useEffect(() => {
    if (!isNameEditing) {
      setNameDraft(location.name);
    }
  }, [isNameEditing, location.name]);

  useEffect(() => {
    if (!isNameEditing) {
      return;
    }

    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [isNameEditing]);

  const openContextMenu = (x: number, y: number) => {
    onClick?.(index);
    setContextMenu({ x, y });
  };

  const dismissEditHint = () => {
    onDismissEditHint?.();
  };

  const startNameEditing = () => {
    onClick?.(index);
    dismissEditHint();
    setNameDraft(location.name);
    setIsNameEditing(true);
  };

  const stopNameEditing = () => {
    setNameDraft(location.name);
    setIsNameEditing(false);
  };

  const saveNameEdit = () => {
    updateLocation(locationId, { name: nameDraft });
    dismissEditHint();
    setIsNameEditing(false);
  };

  const handleRemove = () => {
    onRemove(locationId);
    addToast({
      title: "Location removed",
      description: location.name
        ? `${location.name} was removed from the route.`
        : "The location was removed from the route.",
      variant: "info",
    });
  };

  return (
    <>
      <div
        ref={setNodeRef}
        {...dropProps}
        className={`group relative origin-top overflow-hidden border transition-[transform,border-color,box-shadow,background-color] duration-200 ${
          isDragOver ? "ring-2 ring-[#fdba74] ring-offset-1 ring-offset-[#fffbf5]" : ""
        } ${isWaypoint ? "rounded-[24px]" : "rounded-[30px]"}`}
        style={{
          ...style,
          borderColor: selected || isExpanded ? brand.colors.primary[300] : brand.colors.warm[200],
          background: isWaypoint
            ? `linear-gradient(160deg, rgba(250,250,249,0.98) 0%, rgba(255,255,255,0.92) 100%)`
            : `linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(255,247,237,0.9) 100%)`,
          boxShadow: isDragging
            ? brand.shadows.lg
            : selected || isExpanded || isHovered
              ? brand.shadows.lg
              : brand.shadows.md,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={(e) => {
          const target = e.target as HTMLElement;
          if (shouldIgnoreContextMenuTarget(target)) {
            return;
          }

          e.preventDefault();
          e.stopPropagation();
          openContextMenu(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          const target = e.target as HTMLElement;
          if (shouldIgnoreContextMenuTarget(target) || e.touches.length !== 1) {
            return;
          }

          const touch = e.touches[0];
          touchOriginRef.current = { x: touch.clientX, y: touch.clientY };
          clearLongPressTimer();
          longPressTimeoutRef.current = setTimeout(() => {
            openContextMenu(touch.clientX, touch.clientY);
          }, LONG_PRESS_DURATION_MS);
        }}
        onTouchMove={(e) => {
          if (!touchOriginRef.current) {
            return;
          }

          const touch = e.touches[0];
          if (!touch) {
            clearLongPressTimer();
            return;
          }

          const deltaX = Math.abs(touch.clientX - touchOriginRef.current.x);
          const deltaY = Math.abs(touch.clientY - touchOriginRef.current.y);
          if (deltaX > 10 || deltaY > 10) {
            clearLongPressTimer();
          }
        }}
        onTouchEnd={() => {
          clearLongPressTimer();
          touchOriginRef.current = null;
        }}
        onTouchCancel={() => {
          clearLongPressTimer();
          touchOriginRef.current = null;
        }}
      >
        <div
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{
            backgroundColor: accentColor,
          }}
        />

        <div
          className={`flex cursor-pointer items-center gap-3 ${
            isWaypoint ? "p-3 md:p-3.5" : "p-3.5 md:p-4"
          } max-[420px]:gap-2.5 max-[420px]:p-3`}
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
            className={`touch-target-mobile flex shrink-0 cursor-grab items-center justify-center border transition-colors active:cursor-grabbing touch-none ${
              isWaypoint ? "h-8 w-8 rounded-xl" : "h-10 w-9 rounded-2xl"
            } max-[420px]:h-8 max-[420px]:w-8 max-[420px]:rounded-xl`}
            style={{
              borderColor: brand.colors.warm[200],
              backgroundColor: isHovered ? "rgba(255,255,255,0.98)" : "rgba(255,251,245,0.92)",
            }}
            {...attributes}
            {...listeners}
          >
            <DragGrip />
          </div>

          <div
            className={`flex shrink-0 items-center justify-center font-semibold text-white ${
              isWaypoint ? "h-8 w-8 rounded-[14px] text-xs" : "h-10 w-10 rounded-[16px] text-sm"
            } max-[420px]:h-8 max-[420px]:w-8 max-[420px]:rounded-[14px] max-[420px]:text-xs`}
            style={{
              background: isWaypoint
                ? `linear-gradient(160deg, ${brand.colors.warm[500]} 0%, ${brand.colors.warm[400]} 100%)`
                : `linear-gradient(160deg, ${brand.colors.primary[500]} 0%, ${brand.colors.primary[400]} 100%)`,
              boxShadow: brand.shadows.sm,
            }}
          >
            {location.chapterEmoji || index + 1}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="relative min-w-0 flex-1">
                {isNameEditing ? (
                  <Input
                    ref={nameInputRef}
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={saveNameEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        saveNameEdit();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        stopNameEditing();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="English name"
                    data-no-seek
                    className={`h-8 border-[#fdba74] bg-white/92 px-2.5 py-0 text-sm font-semibold ${
                      isWaypoint ? "text-sm" : "text-[15px]"
                    }`}
                  />
                ) : (
                  <button
                    type="button"
                    data-no-seek
                    onClick={(e) => {
                      e.stopPropagation();
                      startNameEditing();
                    }}
                    className="inline-flex max-w-full items-center rounded-md text-left hover:underline"
                    title="Tap to edit stop name"
                  >
                    <span
                      className={`truncate border-b border-dashed border-transparent font-semibold transition-colors hover:border-current ${
                        isWaypoint ? "text-sm" : "text-[15px]"
                      }`}
                      style={{ color: brand.colors.warm[900], cursor: "text" }}
                    >
                      {location.name || (
                        <span className="italic" style={{ color: brand.colors.warm[400] }}>
                          English name
                        </span>
                      )}
                    </span>
                  </button>
                )}

                {showEditHint && (
                  <OnboardingHint
                    message="Tap a stop name to edit it"
                    onDismiss={dismissEditHint}
                    interactive={false}
                    className="pointer-events-none left-0 top-[calc(100%+0.5rem)] w-56"
                    arrowClassName="left-5 -top-[7px] border-b-0 border-r-0"
                    dismissLabel="This hides automatically"
                  />
                )}
              </div>

              <button
                type="button"
                data-no-seek
                onClick={(e) => {
                  e.stopPropagation();
                  startNameEditing();
                }}
                disabled={isNameEditing}
                className="touch-target-mobile inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors hover:bg-white disabled:cursor-default disabled:opacity-60"
                style={{
                  borderColor: brand.colors.primary[200],
                  backgroundColor: "rgba(255,255,255,0.8)",
                  color: brand.colors.primary[600],
                }}
                aria-label="Edit stop name"
                title="Edit stop name"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>

              {AccentIcon && (
                <div
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${accentColor}18` }}
                  title={transportLabel}
                >
                  <AccentIcon
                    className="h-3.5 w-3.5"
                    style={{ color: accentColor }}
                  />
                </div>
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
                {location.chapterDate || location.nameZh || (isWaypoint ? "Flexible scenic stop" : "Main destination")}
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

          <div
            className={`relative shrink-0 overflow-hidden ${
              isWaypoint ? "h-12 w-12 rounded-[16px]" : "h-14 w-14 rounded-[18px]"
            } max-[420px]:h-11 max-[420px]:w-11 max-[420px]:rounded-[14px]`}
            style={{
              boxShadow: brand.shadows.sm,
              ...(coverPhoto
                ? {}
                : {
                    border: `1px solid ${brand.colors.warm[200]}`,
                    background: `linear-gradient(160deg, ${brand.colors.sand[100]} 0%, ${brand.colors.primary[50]} 100%)`,
                  }),
            }}
          >
            {coverPhoto ? (
              <>
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
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon
                  className="h-4 w-4"
                  style={{ color: brand.colors.warm[400] }}
                />
              </div>
            )}
          </div>

          <button
            data-delete-btn
            className="touch-target-mobile flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#fff1f2]"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
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
                className={`space-y-4 border-t ${
                  isWaypoint ? "px-3.5 pb-3.5 pt-3.5" : "px-4 pb-4 pt-4"
                }`}
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

      <DropdownMenu
        open={Boolean(contextMenu)}
        onOpenChange={(open) => {
          if (!open) {
            setContextMenu(null);
          }
        }}
      >
        <DropdownMenuTrigger
          render={(
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              data-context-menu-ignore
              className="pointer-events-none fixed h-0 w-0 opacity-0"
              style={{
                left: contextMenu?.x ?? 0,
                top: contextMenu?.y ?? 0,
              }}
            />
          )}
        />
        <DropdownMenuContent align="start" side="bottom" sideOffset={6} className="w-48">
          <DropdownMenuItem
            onClick={() => {
              setIsExpanded(true);
              onClick?.(index);
              setContextMenu(null);
            }}
          >
            <ImageIcon className="h-4 w-4" />
            Edit Photos
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!onEditLayout}
            onClick={() => {
              onEditLayout?.(locationId);
              setContextMenu(null);
            }}
          >
            <LayoutTemplate className="h-4 w-4" />
            Edit Layout
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canToggleWaypoint}
            onClick={() => {
              onToggleWaypoint(locationId);
              setContextMenu(null);
            }}
          >
            <span className="text-sm leading-none">{isWaypoint ? "●" : "○"}</span>
            Toggle Waypoint
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              duplicateLocation(locationId);
              setContextMenu(null);
            }}
          >
            <Copy className="h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              handleRemove();
              setContextMenu(null);
            }}
          >
            <X className="h-4 w-4" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
});
