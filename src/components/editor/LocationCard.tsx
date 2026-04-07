"use client";

import { memo, type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  Bike,
  BookOpen,
  Bus,
  Camera,
  Car,
  Check,
  ChevronDown,
  Copy,
  Footprints,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  Pencil,
  Plane,
  Ship,
  Smile,
  TrainFront,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Input } from "@/components/ui/input";
import { brand } from "@/lib/brand";
import { useHistoryStore } from "@/stores/historyStore";
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
  mobileSheet?: boolean;
  transportMode?: TransportMode;
  selected?: boolean;
  isMultiSelected?: boolean;
  multiSelectActive?: boolean;
  onMultiSelect?: (id: string, shiftKey: boolean) => void;
  dragDisabled?: boolean;
  bulkExpandSignal?: number;
  bulkExpandMode?: "expand" | "collapse" | null;
  onRemove: (id: string) => void;
  onToggleWaypoint: (id: string) => void;
  onExpandedChange?: (expanded: boolean) => void;
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
          style={{ backgroundColor: brand.colors.warm[500] }}
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
            className="absolute bottom-full right-0 z-50 mb-1 w-[220px] rounded-2xl border p-2 shadow-lg"
            style={{
              backgroundColor: "rgba(255,251,245,0.98)",
              borderColor: brand.colors.warm[200],
              boxShadow: brand.shadows.lg,
            }}
          >
            <div className="grid max-h-[280px] grid-cols-4 gap-0.5 overflow-y-auto sm:max-h-[180px] sm:grid-cols-10 sm:gap-0.5">
              {TRAVEL_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onSelect(emoji);
                    setOpen(false);
                  }}
                  className="touch-target-mobile flex h-11 w-11 items-center justify-center rounded-lg text-base transition-colors hover:bg-white"
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
        className={`${trackClassName} ${isWaypoint ? "justify-end" : "justify-start"}`}
        style={{
          backgroundColor: isWaypoint ? brand.colors.primary[500] : brand.colors.warm[300],
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
  mobileSheet = false,
}: {
  title: string;
  icon: LucideIcon;
  isOpen: boolean;
  onToggle: () => void;
  contentId: string;
  children: ReactNode;
  mobileSheet?: boolean;
}) {
  return (
    <section
      className="overflow-hidden rounded-[16px] border"
      style={{
        borderColor: brand.colors.warm[200],
        background: "linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,250,245,0.72) 100%)",
      }}
    >
      <button
        type="button"
        data-no-seek
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={onToggle}
        className="touch-target-mobile flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fdba74] focus-visible:ring-inset"
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
          className="min-w-0 flex-1 font-semibold"
          style={{
            color: brand.colors.warm[900],
            fontSize: mobileSheet ? 15 : undefined,
          }}
        >
          {title}
        </span>
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
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
  mobileSheet = false,
  transportMode,
  selected = false,
  isMultiSelected = false,
  multiSelectActive = false,
  onMultiSelect,
  dragDisabled = false,
  bulkExpandSignal = 0,
  bulkExpandMode = null,
  onRemove,
  onToggleWaypoint,
  onExpandedChange,
  onClick,
  onEditLayout,
  showEditHint = false,
  onDismissEditHint,
}: LocationCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const location = useLocation(locationId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isNameEditing, setIsNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [openSections, setOpenSections] = useState<OpenSections>(DEFAULT_OPEN_SECTIONS);
  const updateLocation = useProjectStore((s) => s.updateLocation);
  const duplicateLocation = useProjectStore((s) => s.duplicateLocation);
  const addToast = useUIStore((s) => s.addToast);
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
  const isCompactMobile = isMobile && mobileSheet;

  const transformValue = CSS.Transform.toString(transform);
  const composedTransform = [
    transformValue,
    !isDragging && isHovered ? "translateY(-1px)" : null,
    isWaypoint ? (isCompactMobile ? "scale(0.97)" : "scale(0.92)") : null,
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

  useEffect(() => {
    if (bulkExpandSignal === 0 || !bulkExpandMode) {
      return;
    }

    const nextExpanded = bulkExpandMode === "expand";
    setIsExpanded(nextExpanded);
    if (nextExpanded) {
      setOpenSections((current) => (
        hasOpenSections(current) ? current : DEFAULT_OPEN_SECTIONS
      ));
    }
  }, [bulkExpandMode, bulkExpandSignal]);

  const dismissEditHint = () => {
    onDismissEditHint?.();
  };

  const toggleExpanded = () => {
    const nextExpanded = !isExpanded;
    if (nextExpanded) {
      setOpenSections((current) => (
        hasOpenSections(current) ? current : DEFAULT_OPEN_SECTIONS
      ));
    }
    setIsExpanded(nextExpanded);
    onExpandedChange?.(nextExpanded);
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
      action: (
        <button
          type="button"
          onClick={() => {
            const { canUndo, undo } = useHistoryStore.getState();
            if (canUndo) undo();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/20"
          style={{ borderColor: "rgba(255,255,255,0.3)", color: "inherit" }}
        >
          Undo
        </button>
      ),
    });
  };

  const handleTogglePassThrough = () => {
    if (!canToggleWaypoint) return;

    onClick?.(index);
    dismissEditHint();
    onToggleWaypoint(locationId);
    addToast({
      title: isWaypoint ? "Set as destination" : "Set as pass-through",
      variant: "info",
    });
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

    if (multiSelectActive) {
      onClick?.(index);
      return;
    }

    toggleExpanded();
  };

  const actionButtonClassName = "relative z-20 inline-flex items-center justify-center rounded-lg border transition-[transform,background-color,border-color] duration-150 hover:bg-white active:scale-95";
  const mobileActionButtonClassName = `touch-target-mobile ${actionButtonClassName} h-11 w-11 rounded-xl`;
  const hasChapterContent = !!(location.chapterTitle || location.chapterNote);
  const mobileActionBar = (
    <div className="flex items-center gap-1.5">
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
        <LayoutTemplate className="h-[18px] w-[18px]" />
      </button>
    </div>
  );

  return (
      <div
        ref={setNodeRef}
        {...dropProps}
        className={`group relative origin-top overflow-hidden border transition-[transform,border-color,box-shadow,background-color] duration-200 ${
          isDragOver ? "ring-2 ring-[#fdba74] ring-offset-1 ring-offset-[#fffbf5]" : ""
        } ${isWaypoint ? "rounded-xl" : "rounded-2xl"}`}
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
            isWaypoint ? "px-3 py-2 md:gap-3 md:px-3 md:py-2" : "p-4 md:gap-3 md:px-3 md:py-2.5"
          } md:flex-row md:items-center`}
        >
          <button
            type="button"
            data-card-disclosure
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} details for ${stopLabel}`}
            onClick={handleCardClick}
            className={`absolute inset-0 z-10 transition-colors active:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fdba74] focus-visible:ring-inset ${
              isWaypoint ? "rounded-xl" : "rounded-2xl"
            }`}
          />
          <div className="flex min-w-0 items-center gap-2 md:flex-1 md:gap-3">
            <button
              type="button"
              data-drag-handle
              aria-label={dragDisabled ? "Reordering unavailable" : "Reorder stop"}
              title={dragDisabled ? "Reordering is temporarily unavailable" : "Reorder stop"}
              disabled={dragDisabled}
              className={`touch-target-mobile relative z-20 flex shrink-0 items-center justify-center border transition-colors touch-none disabled:cursor-not-allowed disabled:opacity-55 ${
                dragDisabled ? "" : "cursor-grab active:cursor-grabbing"
              } ${
                isWaypoint ? "h-7 w-7 rounded-lg" : "h-7 w-7 rounded-xl"
              }`}
              style={{
                borderColor: brand.colors.warm[200],
                backgroundColor: isHovered ? "rgba(255,255,255,0.98)" : "rgba(255,251,245,0.92)",
                cursor: dragDisabled ? "default" : undefined,
              }}
              {...(dragDisabled ? {} : attributes)}
              {...(dragDisabled ? {} : listeners)}
            >
              <DragGrip />
            </button>

            <div
              className={`flex shrink-0 items-center justify-center font-semibold text-white ${
                isWaypoint
                  ? "h-6 w-6 rounded-lg text-xs"
                  : "h-7 w-7 rounded-xl text-xs"
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
                          isCompactMobile ? "text-[15px]" : isWaypoint ? "" : "md:text-[15px]"
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

                {/* Chevron expand/collapse toggle */}
                <button
                  type="button"
                  className="touch-target-mobile-hitbox relative z-20 shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); toggleExpanded(); }}
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>
              </div>

              {/* Metadata line */}
              {(location.nameLocal || photoCount > 0 || hasChapterContent || isWaypoint) && (
                <div className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: brand.colors.warm[500] }}>
                  {location.nameLocal && <span className="truncate">{location.nameLocal}</span>}
                  {location.nameLocal && (photoCount > 0 || hasChapterContent) && <span>·</span>}
                  {photoCount > 0 && (
                    <span className="flex shrink-0 items-center gap-0.5">
                      <Camera className="h-3 w-3" /> {photoCount}
                    </span>
                  )}
                  {photoCount > 0 && hasChapterContent && <span>·</span>}
                  {hasChapterContent && <BookOpen className="h-3 w-3 shrink-0" />}
                  {isWaypoint && <span className="ml-0.5 italic">pass-through</span>}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 text-xs md:hidden">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5" style={{ color: brand.colors.warm[500] }}>
              {AccentIcon ? (
                <>
                  <span
                    className="inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 py-1"
                    style={{ backgroundColor: `${accentColor}14`, color: accentColor }}
                    title={transportLabel}
                  >
                    <AccentIcon className="h-3 w-3" style={{ color: accentColor }} />
                    {transportMetaLabel}
                  </span>
                </>
              ) : isWaypoint ? (
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{
                    color: brand.colors.warm[500],
                    backgroundColor: brand.colors.warm[100],
                  }}
                >
                  Pass-through
                </span>
              ) : null}
              <span
                className="truncate rounded-full px-2.5 py-1"
                style={{ backgroundColor: "rgba(255,255,255,0.84)", color: brand.colors.warm[600] }}
              >
                {mobileDateLabel}
              </span>
              <span
                className="truncate rounded-full px-2.5 py-1"
                style={{ backgroundColor: "rgba(255,255,255,0.84)", color: brand.colors.warm[600] }}
              >
                {mobilePhotoLabel}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {mobileActionBar}
              <button
                data-delete-btn
                className="touch-target-mobile relative z-20 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-[transform,background-color] duration-150 active:scale-95 hover:bg-[#fff1f2]"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                aria-label="Remove location"
                style={{
                  borderColor: brand.colors.warm[200],
                  backgroundColor: "rgba(255,255,255,0.86)",
                }}
              >
                <X className="h-[18px] w-[18px]" style={{ color: brand.colors.warm[500] }} />
              </button>
            </div>
          </div>

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
                  isWaypoint ? "px-3.5 pb-4 pt-3.5" : "px-4 pb-4 pt-4"
                }`}
                style={{
                  borderColor: brand.colors.warm[200],
                  background: `linear-gradient(180deg, rgba(255,251,245,0.94) 0%, rgba(255,247,237,0.55) 100%)`,
                }}
              >
                {/* Action row */}
                <div className="flex flex-wrap items-center gap-1.5 px-1 pb-2 pt-1">
                  {!isWaypoint && (
                    <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors hover:bg-muted" style={{ color: brand.colors.warm[600] }} onClick={() => toggleSection("chapter")}>
                      <BookOpen className="h-3.5 w-3.5" /> Chapter
                    </button>
                  )}
                  <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors hover:bg-muted" style={{ color: brand.colors.warm[600] }} onClick={() => toggleSection("photos")}>
                    <Camera className="h-3.5 w-3.5" /> Photos
                  </button>
                  <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors hover:bg-muted" style={{ color: brand.colors.warm[600] }} onClick={handleEditLayout}>
                    <LayoutGrid className="h-3.5 w-3.5" /> Layout
                  </button>
                  <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors hover:bg-muted" style={{ color: brand.colors.warm[600] }} onClick={() => { onClick?.(index); duplicateLocation(locationId); }}>
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </button>
                  {canToggleWaypoint && (
                    <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors hover:bg-muted" style={{ color: brand.colors.warm[600] }} onClick={handleTogglePassThrough}>
                      <ArrowRightLeft className="h-3.5 w-3.5" /> {isWaypoint ? "Destination" : "Pass-through"}
                    </button>
                  )}
                  <div className="flex-1" />
                  <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-600" onClick={handleRemove}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
                <div className="border-t" style={{ borderColor: brand.colors.warm[100] }} />

                <SectionDisclosure
                  title="Basics"
                  icon={Pencil}
                  isOpen={openSections.basics}
                  onToggle={() => toggleSection("basics")}
                  contentId={`location-card-basics-${locationId}`}
                  mobileSheet={mobileSheet}
                >
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:gap-2">
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
                          onToggle={handleTogglePassThrough}
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
                    mobileSheet={mobileSheet}
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
                        className="grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4"
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
                  mobileSheet={mobileSheet}
                >
                  <PhotoManager locationId={locationId} onEditLayout={onEditLayout} />
                </SectionDisclosure>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
  );
});
