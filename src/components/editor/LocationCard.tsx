"use client";

import { memo, type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import {
  Bike,
  Bus,
  Car,
  Check,
  ChevronDown,
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
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  isMultiSelected?: boolean;
  onMultiSelect?: (id: string, shiftKey: boolean) => void;
  dragDisabled?: boolean;
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

const TRANSPORT_META_LABELS: Record<TransportMode, string> = {
  flight: "Flight",
  car: "Drive",
  train: "Train",
  bus: "Bus",
  ferry: "Ferry",
  walk: "Walk",
  bicycle: "Bike",
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
      "button:not([data-card-disclosure]), input, textarea, select, label, a, [data-drag-handle], [data-no-seek], [data-delete-btn], [data-context-menu-ignore]",
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
    <button
      type="button"
      data-no-seek
      className={`cursor-pointer bg-transparent p-0 text-left decoration-dotted underline-offset-2 hover:underline ${className ?? ""}`}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      aria-label={`Edit ${placeholder}`}
      title="Click to edit"
    >
      {value || <span className="italic text-muted-foreground">{placeholder}</span>}
    </button>
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
  const shouldReduceMotion = useReducedMotion();
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
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
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
  size = "default",
  disabled = false,
}: {
  isWaypoint: boolean;
  onToggle: () => void;
  size?: "default" | "actionDesktop" | "actionMobile";
  disabled?: boolean;
}) {
  const isActionVariant = size !== "default";
  const outerClassName = size === "actionMobile"
    ? "touch-target-mobile relative inline-flex h-11 w-14 shrink-0 items-center justify-center rounded-xl border transition-[transform,background-color,border-color] duration-150 active:scale-95"
    : size === "actionDesktop"
      ? "relative inline-flex h-8 w-12 shrink-0 items-center justify-center rounded-lg border transition-[transform,background-color,border-color] duration-150 hover:bg-white active:scale-95"
      : "touch-target-mobile-hitbox relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors";
  const trackClassName = size === "actionMobile"
    ? "inline-flex h-6 w-11 items-center rounded-full px-1.5"
    : size === "actionDesktop"
      ? "inline-flex h-5 w-9 items-center rounded-full px-1"
      : "inline-flex h-full w-full items-center rounded-full px-1";
  const thumbClassName = size === "actionMobile" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <button
      onClick={onToggle}
      type="button"
      data-no-seek
      disabled={disabled}
      aria-label={isWaypoint ? "Switch to destination" : "Switch to pass-through"}
      className={`${outerClassName} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      style={{
        ...(isActionVariant
          ? {
              borderColor: brand.colors.warm[200],
              backgroundColor: "rgba(255,255,255,0.88)",
            }
          : null),
      }}
      title={isWaypoint ? "Switch to destination" : "Switch to pass-through"}
    >
      <span
        className={`${trackClassName} ${isWaypoint ? "justify-start" : "justify-end"}`}
        style={{
          backgroundColor: isWaypoint ? brand.colors.warm[300] : brand.colors.primary[500],
        }}
      >
        <span className={`${thumbClassName} rounded-full bg-white shadow-sm`} />
      </span>
    </button>
  );
}

type LocationSection = "basics" | "chapter" | "photos";
type OpenSections = Record<LocationSection, boolean>;

const DEFAULT_OPEN_SECTIONS: OpenSections = {
  basics: true,
  chapter: false,
  photos: false,
};

function createExclusiveOpenSections(section: LocationSection | null): OpenSections {
  return {
    basics: section === "basics",
    chapter: section === "chapter",
    photos: section === "photos",
  };
}

function hasOpenSections(openSections: OpenSections): boolean {
  return Object.values(openSections).some(Boolean);
}

function SectionDisclosure({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  contentId,
  children,
}: {
  title: string;
  icon: LucideIcon;
  isOpen: boolean;
  onToggle: () => void;
  contentId: string;
  children: ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-[22px] border"
      style={{
        borderColor: brand.colors.warm[200],
        backgroundColor: "rgba(255,255,255,0.66)",
      }}
    >
      <button
        type="button"
        data-no-seek
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fdba74] focus-visible:ring-inset"
      >
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: brand.colors.primary[50],
            color: brand.colors.primary[600],
          }}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span
          className="min-w-0 flex-1 text-sm font-semibold"
          style={{ color: brand.colors.warm[900] }}
        >
          {title}
        </span>
        <span
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
          style={{
            borderColor: brand.colors.warm[200],
            backgroundColor: "rgba(255,255,255,0.88)",
            color: brand.colors.warm[700],
          }}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ease-out ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </span>
      </button>

      <div
        id={contentId}
        className="grid"
        style={{
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          transition: "grid-template-rows 220ms ease-out",
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className="border-t px-3 pb-3 pt-2.5 md:px-3.5 md:pb-3.5"
            style={{
              borderColor: brand.colors.warm[200],
              opacity: isOpen ? 1 : 0,
              transform: isOpen ? "translateY(0)" : "translateY(-4px)",
              visibility: isOpen ? "visible" : "hidden",
              transition: "opacity 220ms ease-out, transform 220ms ease-out",
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(function LocationCard({
  locationId,
  index,
  total,
  transportMode,
  selected = false,
  isMultiSelected = false,
  onMultiSelect,
  dragDisabled = false,
  onRemove,
  onToggleWaypoint,
  onClick,
  onEditLayout,
  showEditHint = false,
  onDismissEditHint,
}: LocationCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const location = useLocation(locationId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isNameEditing, setIsNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [openSections, setOpenSections] = useState<OpenSections>(DEFAULT_OPEN_SECTIONS);
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
  } = useSortable({ id: locationId, disabled: dragDisabled });

  const { isDragOver, dropProps } = usePhotoDropZone(locationId);

  if (!location) return null;

  const isFirst = index === 0;
  const canToggleWaypoint = index > 0 && index < total - 1;
  const isWaypoint = location.isWaypoint;
  const photoCount = location.photos.length;
  const coverPhoto = location.photos[0];
  const AccentIcon = !isFirst && transportMode ? TRANSPORT_ICONS[transportMode] : null;
  const transportLabel = !isFirst && transportMode ? TRANSPORT_LABELS[transportMode] : undefined;
  const transportMetaLabel = !isFirst && transportMode ? TRANSPORT_META_LABELS[transportMode] : undefined;
  const desktopMetaLabel = location.chapterDate
    || location.nameLocal
    || (isWaypoint ? "Pass-through stop" : "Main destination");
  const mobileDateLabel = location.chapterDate || `Day ${index + 1}`;
  const mobilePhotoLabel = `${photoCount} photo${photoCount === 1 ? "" : "s"}`;
  const detailsId = `location-card-details-${locationId}`;
  const stopLabel = location.name || `stop ${index + 1}`;

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
    const mql = window.matchMedia("(max-width: 767px)");
    setIsMobile(mql.matches);
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

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

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    setOpenSections((current) => {
      const openSection = (Object.entries(current).find(([, isOpen]) => isOpen)?.[0] ??
        "basics") as LocationSection;

      if (Object.values(current).filter(Boolean).length <= 1) {
        return current;
      }

      return createExclusiveOpenSections(openSection);
    });
  }, [isMobile]);

  const openContextMenu = (x: number, y: number) => {
    onClick?.(index);
    setContextMenu({ x, y });
  };

  const dismissEditHint = () => {
    onDismissEditHint?.();
  };

  const ensureSectionOpen = (section: LocationSection) => {
    setOpenSections((current) => {
      if (isMobile) {
        return createExclusiveOpenSections(section);
      }

      return { ...current, [section]: true };
    });
  };

  const toggleExpanded = () => {
    setIsExpanded((expanded) => {
      const nextExpanded = !expanded;
      if (nextExpanded) {
        setOpenSections((current) => (
          hasOpenSections(current) ? current : DEFAULT_OPEN_SECTIONS
        ));
      }
      return nextExpanded;
    });
    onClick?.(index);
  };

  const toggleSection = (section: LocationSection) => {
    onClick?.(index);
    setOpenSections((current) => {
      const nextOpen = !current[section];

      if (isMobile) {
        return nextOpen ? createExclusiveOpenSections(section) : createExclusiveOpenSections(null);
      }

      return { ...current, [section]: nextOpen };
    });
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

  const handleDuplicate = () => {
    onClick?.(index);
    dismissEditHint();
    duplicateLocation(locationId);
  };

  const handleTogglePassThrough = () => {
    if (!canToggleWaypoint) return;

    onClick?.(index);
    dismissEditHint();
    onToggleWaypoint(locationId);
  };

  const handleEditLayout = () => {
    if (!onEditLayout) return;

    onClick?.(index);
    dismissEditHint();
    onEditLayout(locationId);
  };

  const handleCardClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if ((event.metaKey || event.ctrlKey || event.shiftKey) && onMultiSelect) {
      event.preventDefault();
      event.stopPropagation();
      dismissEditHint();
      onMultiSelect(locationId, event.shiftKey);
      return;
    }

    toggleExpanded();
  };

  const actionButtonClassName = "relative z-20 inline-flex items-center justify-center rounded-lg border transition-[transform,background-color,border-color] duration-150 hover:bg-white active:scale-95";
  const desktopActionButtonClassName = `${actionButtonClassName} h-8 w-8`;
  const mobileActionButtonClassName = `touch-target-mobile ${actionButtonClassName} h-11 w-11 rounded-xl`;
  const desktopActionBar = (
    <div
      className={`absolute bottom-3 right-14 z-20 hidden items-center gap-1 rounded-xl border px-1.5 py-1 transition-all duration-200 md:flex ${
        isHovered && !isDragging
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-1 opacity-0"
      }`}
      style={{
        borderColor: brand.colors.warm[200],
        backgroundColor: "rgba(255,251,245,0.92)",
        boxShadow: brand.shadows.sm,
      }}
    >
      <button
        type="button"
        data-no-seek
        className={desktopActionButtonClassName}
        style={{
          borderColor: brand.colors.warm[200],
          color: brand.colors.warm[700],
        }}
        onClick={(e) => {
          e.stopPropagation();
          handleDuplicate();
        }}
        aria-label="Duplicate stop"
        title="Duplicate stop"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <WaypointSwitch
        isWaypoint={isWaypoint}
        size="actionDesktop"
        disabled={!canToggleWaypoint}
        onToggle={handleTogglePassThrough}
      />
      <button
        type="button"
        data-no-seek
        disabled={!onEditLayout}
        className={`${desktopActionButtonClassName} disabled:cursor-not-allowed disabled:opacity-50`}
        style={{
          borderColor: brand.colors.warm[200],
          color: brand.colors.warm[700],
        }}
        onClick={(e) => {
          e.stopPropagation();
          handleEditLayout();
        }}
        aria-label="Edit layout"
        title="Edit layout"
      >
        <LayoutTemplate className="h-3.5 w-3.5" />
      </button>
    </div>
  );
  const mobileActionBar = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        data-no-seek
        className={mobileActionButtonClassName}
        style={{
          borderColor: brand.colors.warm[200],
          color: brand.colors.warm[700],
          backgroundColor: "rgba(255,255,255,0.86)",
        }}
        onClick={(e) => {
          e.stopPropagation();
          handleDuplicate();
        }}
        aria-label="Duplicate stop"
        title="Duplicate stop"
      >
        <Copy className="h-4 w-4" />
      </button>
      <WaypointSwitch
        isWaypoint={isWaypoint}
        size="actionMobile"
        disabled={!canToggleWaypoint}
        onToggle={handleTogglePassThrough}
      />
      <button
        type="button"
        data-no-seek
        disabled={!onEditLayout}
        className={`${mobileActionButtonClassName} disabled:cursor-not-allowed disabled:opacity-50`}
        style={{
          borderColor: brand.colors.warm[200],
          color: brand.colors.warm[700],
          backgroundColor: "rgba(255,255,255,0.86)",
        }}
        onClick={(e) => {
          e.stopPropagation();
          handleEditLayout();
        }}
        aria-label="Edit layout"
        title="Edit layout"
      >
        <LayoutTemplate className="h-4 w-4" />
      </button>
    </div>
  );

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
          borderColor: isMultiSelected
            ? brand.colors.ocean[200]
            : selected || isExpanded
              ? brand.colors.primary[300]
              : brand.colors.warm[200],
          background: isWaypoint
            ? `linear-gradient(160deg, rgba(250,250,249,0.98) 0%, rgba(255,255,255,0.92) 100%)`
            : `linear-gradient(165deg, rgba(255,255,255,0.98) 0%, rgba(255,247,237,0.9) 100%)`,
          boxShadow: isDragging
            ? brand.shadows.lg
            : isMultiSelected
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
        {isMultiSelected && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ backgroundColor: "rgba(14, 116, 144, 0.06)" }}
          />
        )}

        <div
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{
            backgroundColor: isMultiSelected ? brand.colors.ocean[500] : accentColor,
          }}
        />

        {isMultiSelected && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-3 top-3 z-30 flex h-5 w-5 items-center justify-center rounded-md"
            style={{
              backgroundColor: brand.colors.ocean[500],
              boxShadow: brand.shadows.sm,
            }}
          >
            <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
          </div>
        )}

        <div
          className={`relative flex flex-col gap-2 ${
            isWaypoint ? "p-3 md:gap-3 md:p-3.5" : "p-3.5 md:gap-3 md:p-4"
          } md:flex-row md:items-center`}
        >
          <button
            type="button"
            data-card-disclosure
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} details for ${stopLabel}`}
            onClick={handleCardClick}
            className={`absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fdba74] focus-visible:ring-inset ${
              isWaypoint ? "rounded-[24px]" : "rounded-[30px]"
            }`}
          />
          <div className="flex min-w-0 items-center gap-2 md:flex-1 md:gap-3">
            <button
              type="button"
              data-drag-handle
              aria-label="Reorder stop"
              title="Reorder stop"
              disabled={dragDisabled}
              className={`touch-target-mobile relative z-20 flex shrink-0 cursor-grab items-center justify-center border transition-colors active:cursor-grabbing touch-none ${
                isWaypoint ? "h-8 w-8 rounded-xl" : "h-10 w-9 rounded-2xl"
              }`}
              style={{
                borderColor: brand.colors.warm[200],
                backgroundColor: isHovered ? "rgba(255,255,255,0.98)" : "rgba(255,251,245,0.92)",
                cursor: dragDisabled ? "default" : undefined,
              }}
              {...attributes}
              {...listeners}
            >
              <DragGrip />
            </button>

            <div
              className={`flex shrink-0 items-center justify-center font-semibold text-white ${
                isWaypoint
                  ? "h-8 w-8 rounded-[14px] text-xs"
                  : "h-8 w-8 rounded-[14px] text-xs md:h-10 md:w-10 md:rounded-[16px] md:text-sm"
              }`}
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
                      className={`relative z-20 h-8 border-[#fdba74] bg-white/92 px-2.5 py-0 text-sm font-semibold ${
                        isWaypoint ? "text-sm" : "md:text-[15px]"
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
                      className="relative z-20 inline-flex max-w-full items-center rounded-md text-left hover:underline"
                      title="Tap to edit stop name"
                    >
                      <span
                        className={`truncate border-b border-dashed border-transparent text-sm font-semibold transition-colors hover:border-current ${
                          isWaypoint ? "" : "md:text-[15px]"
                        }`}
                        style={{ color: brand.colors.warm[800], cursor: "text" }}
                      >
                        {location.name || (
                          <span className="italic" style={{ color: brand.colors.warm[500] }}>
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
                  className="touch-target-mobile relative z-20 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors hover:bg-white disabled:cursor-default disabled:opacity-60 md:inline-flex"
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
                    className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-full md:inline-flex"
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
                    className="hidden shrink-0 rounded-full px-2 py-1 text-xs font-medium md:inline-flex"
                    style={{
                      color: brand.colors.warm[500],
                      backgroundColor: brand.colors.warm[100],
                    }}
                  >
                    Pass-through
                  </span>
                )}
              </div>

              <div
                className="mt-1 hidden items-center gap-2 overflow-hidden text-xs md:flex"
                style={{ color: brand.colors.warm[500] }}
              >
                <span className="truncate">{desktopMetaLabel}</span>
                <span className="shrink-0">•</span>
                <span className="truncate">
                  {photoCount > 0 ? mobilePhotoLabel : "No photos yet"}
                </span>
              </div>

              {location.chapterNote && (
                <p
                  className="mt-1 hidden truncate text-xs md:block"
                  style={{ color: brand.colors.warm[500] }}
                >
                  {location.chapterNote}
                </p>
              )}
            </div>

            <div
              className={`relative shrink-0 overflow-hidden ${
                isWaypoint
                  ? "h-11 w-11 rounded-[14px] md:h-12 md:w-12 md:rounded-[16px]"
                  : "h-11 w-11 rounded-[14px] md:h-14 md:w-14 md:rounded-[18px]"
              }`}
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
          </div>

          <div
            className="flex items-center gap-2 text-xs md:hidden"
            style={{ color: brand.colors.warm[500] }}
          >
            <div className="flex min-w-0 items-center gap-2">
              {AccentIcon ? (
                <>
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${accentColor}18` }}
                    title={transportLabel}
                  >
                    <AccentIcon className="h-3 w-3" style={{ color: accentColor }} />
                  </span>
                  <span className="shrink-0 font-medium" style={{ color: brand.colors.warm[500] }}>
                    {transportMetaLabel}
                  </span>
                </>
              ) : isWaypoint ? (
                <span
                  className="shrink-0 rounded-full px-2 py-1 text-xs font-medium"
                  style={{
                    color: brand.colors.warm[500],
                    backgroundColor: brand.colors.warm[100],
                  }}
                >
                  Pass-through
                </span>
              ) : null}
              <span className="truncate">{mobileDateLabel}</span>
              <span className="shrink-0">•</span>
              <span className="truncate">{mobilePhotoLabel}</span>
            </div>
            <div className="flex-1" />
            {mobileActionBar}
            <button
              data-delete-btn
              className="touch-target-mobile relative z-20 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-[transform,background-color] duration-150 active:scale-95 hover:bg-[#fff1f2]"
              onClick={(e) => {
                e.stopPropagation();
                handleRemove();
              }}
              aria-label="Remove location"
            >
              <X className="h-4 w-4" style={{ color: brand.colors.warm[500] }} />
            </button>
          </div>

          <button
            data-delete-btn
            className="touch-target-mobile relative z-20 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#fff1f2] md:flex"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            aria-label="Remove location"
          >
            <X className="h-4 w-4" style={{ color: brand.colors.warm[500] }} />
          </button>

          {desktopActionBar}
        </div>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: "easeInOut" }}
              id={detailsId}
              className="location-card-expanded overflow-hidden"
            >
              <div
                className={`space-y-3 border-t md:space-y-4 ${
                  isWaypoint ? "px-3.5 pb-3.5 pt-3.5" : "px-4 pb-4 pt-4"
                }`}
                style={{
                  borderColor: brand.colors.warm[200],
                  background: `linear-gradient(180deg, rgba(255,251,245,0.94) 0%, rgba(255,247,237,0.55) 100%)`,
                }}
              >
                <SectionDisclosure
                  title="Basics"
                  icon={Pencil}
                  isOpen={openSections.basics}
                  onToggle={() => toggleSection("basics")}
                  contentId={`location-card-basics-${locationId}`}
                >
                  <div className="space-y-3">
                    <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2 md:grid-cols-1 md:gap-2">
                      <div className="min-w-0">
                        <EditableName
                          value={location.name}
                          placeholder="English name"
                          onSave={(value) => updateLocation(locationId, { name: value })}
                          className="block truncate text-sm font-semibold"
                        />
                      </div>
                      <div className="min-w-0">
                        <EditableName
                          value={location.nameLocal ?? ""}
                          placeholder="Local name"
                          onSave={(value) => updateLocation(locationId, { nameLocal: value || undefined })}
                          className="block truncate text-xs"
                        />
                      </div>
                    </div>

                    {!isFirst && (
                      <div
                        className="flex items-start justify-between gap-3 border-t pt-3"
                        style={{ borderColor: brand.colors.warm[200] }}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-medium" style={{ color: brand.colors.warm[800] }}>
                            Pass-through
                          </p>
                          <p className="mt-1 text-xs leading-5" style={{ color: brand.colors.warm[500] }}>
                            Mark as a brief stop the route passes through, without its own chapter.
                          </p>
                        </div>
                        <WaypointSwitch
                          isWaypoint={!!isWaypoint}
                          onToggle={() => onToggleWaypoint(locationId)}
                        />
                      </div>
                    )}
                  </div>
                </SectionDisclosure>

                {!isWaypoint && (
                  <SectionDisclosure
                    title="Chapter"
                    icon={Smile}
                    isOpen={openSections.chapter}
                    onToggle={() => toggleSection("chapter")}
                    contentId={`location-card-chapter-${locationId}`}
                  >
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <span
                          className="block text-xs font-medium"
                          style={{ color: brand.colors.warm[500] }}
                        >
                          Chapter
                        </span>
                        <EditableName
                          value={location.chapterTitle ?? ""}
                          placeholder="Chapter title"
                          onSave={(value) => updateLocation(locationId, { chapterTitle: value || undefined })}
                          className="block text-sm"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <span
                          className="block text-xs font-medium"
                          style={{ color: brand.colors.warm[500] }}
                        >
                          Note
                        </span>
                        <EditableName
                          value={location.chapterNote ?? ""}
                          placeholder="e.g. Temples and gardens"
                          onSave={(value) => updateLocation(locationId, { chapterNote: value || undefined })}
                          className="block text-sm"
                        />
                      </div>

                      <div
                        className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-t pt-3"
                        style={{ borderColor: brand.colors.warm[200] }}
                      >
                        <div className="space-y-1.5">
                          <span
                            className="block text-xs font-medium"
                            style={{ color: brand.colors.warm[500] }}
                          >
                            Date
                          </span>
                          <EditableName
                            value={location.chapterDate ?? ""}
                            placeholder="e.g. Mar 15-17"
                            onSave={(value) => updateLocation(locationId, { chapterDate: value || undefined })}
                            className="block text-sm"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <span
                            className="block text-xs font-medium"
                            style={{ color: brand.colors.warm[500] }}
                          >
                            Icon
                          </span>
                          <EmojiPicker
                            value={location.chapterEmoji ?? ""}
                            onSelect={(value) => updateLocation(locationId, { chapterEmoji: value || undefined })}
                          />
                        </div>
                      </div>
                    </div>
                  </SectionDisclosure>
                )}

                <SectionDisclosure
                  title="Photos"
                  icon={ImageIcon}
                  isOpen={openSections.photos}
                  onToggle={() => toggleSection("photos")}
                  contentId={`location-card-photos-${locationId}`}
                >
                  <PhotoManager locationId={locationId} onEditLayout={onEditLayout} />
                </SectionDisclosure>
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
              ensureSectionOpen("photos");
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
            Toggle Pass-through
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
