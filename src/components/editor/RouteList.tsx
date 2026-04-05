"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { lineString } from "@turf/helpers";
import { length } from "@turf/length";
import {
  Bike,
  Bus,
  Car,
  ChevronDown,
  Footprints,
  Plane,
  Route,
  Search,
  Ship,
  TrainFront,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Input } from "@/components/ui/input";
import { brand } from "@/lib/brand";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import type { Location, Segment, TransportMode } from "@/types";
import LocationCard from "./LocationCard";
import TransportSelector from "./TransportSelector";

const EDIT_HINT_STORAGE_KEY = "hasSeenEditHint";

interface RouteListProps {
  onLocationClick?: (index: number) => void;
  onEditLayout?: (locationId: string) => void;
  selectedLocationIndex?: number | null;
  onSelectedLocationIndexChange?: (index: number | null) => void;
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

const TRANSPORT_ACCENTS: Record<TransportMode, string> = {
  flight: "#f97316",
  car: "#a16207",
  train: "#0891b2",
  bus: "#a855f7",
  ferry: "#0e7490",
  walk: "#78350f",
  bicycle: "#155e75",
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

const WHOLE_NUMBER_FORMAT = new Intl.NumberFormat("en-US");
const ONE_DECIMAL_FORMAT = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatDistance(distanceKm: number | null): string | null {
  if (distanceKm === null || !Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  if (distanceKm < 1) return `${WHOLE_NUMBER_FORMAT.format(Math.round(distanceKm * 1000))} m`;
  if (distanceKm < 100) return `${ONE_DECIMAL_FORMAT.format(distanceKm)} km`;
  return `${WHOLE_NUMBER_FORMAT.format(Math.round(distanceKm))} km`;
}

function getSegmentDistance(segment: Segment): number | null {
  if (!segment.geometry || segment.geometry.coordinates.length < 2) return null;
  return length(lineString(segment.geometry.coordinates));
}

function getStopoverGroupKey(locationId: string): string {
  return `${locationId}-stopovers`;
}

function buildCollapsedGroupState(locations: Location[], collapsed: boolean): Record<string, boolean> {
  const nextState: Record<string, boolean> = {};

  for (let index = 0; index < locations.length; index += 1) {
    const location = locations[index];
    const nextLocation = locations[index + 1];

    if (!location || location.isWaypoint || !nextLocation?.isWaypoint) {
      continue;
    }

    nextState[getStopoverGroupKey(location.id)] = collapsed;

    let cursor = index + 1;
    while (cursor < locations.length && locations[cursor]?.isWaypoint) {
      cursor += 1;
    }
    index = cursor - 1;
  }

  return nextState;
}

function buildExpandedSegmentState(segments: Segment[], expanded: boolean): Record<string, boolean> {
  return Object.fromEntries(segments.map((segment) => [segment.id, expanded]));
}

function matchesLocationFilter(location: Location, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;

  const englishName = location.name.toLocaleLowerCase();
  const localName = location.nameLocal?.toLocaleLowerCase() ?? "";
  return englishName.includes(normalizedQuery) || localName.includes(normalizedQuery);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

function TimelineNode({
  isWaypoint,
  selected,
}: {
  isWaypoint: boolean;
  selected: boolean;
}) {
  const size = isWaypoint ? 10 : 12;

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute rounded-full border-2 bg-white"
      style={{
        left: isWaypoint ? 21 : 20,
        top: isWaypoint ? 26 : 28,
        width: size,
        height: size,
        borderColor: selected ? brand.colors.primary[500] : brand.colors.ocean[500],
        backgroundColor: isWaypoint
          ? "rgba(255,255,255,0.94)"
          : selected
            ? brand.colors.primary[500]
            : brand.colors.primary[400],
        boxShadow: selected ? brand.shadows.md : brand.shadows.sm,
      }}
    />
  );
}

function TimelineSegmentCard({
  segment,
  fromLabel,
  toLabel,
  distanceKm,
  expanded,
  onToggle,
  indented = false,
  showConnector = true,
}: {
  segment: Segment;
  fromLabel: string;
  toLabel: string;
  distanceKm: number | null;
  expanded: boolean;
  onToggle: () => void;
  indented?: boolean;
  showConnector?: boolean;
}) {
  const Icon = TRANSPORT_ICONS[segment.transportMode];
  const accent = TRANSPORT_ACCENTS[segment.transportMode];
  const formattedDistance = formatDistance(distanceKm);
  const transportLabel = TRANSPORT_META_LABELS[segment.transportMode];

  return (
    <div className={`relative ${indented ? "ml-6" : ""} pl-11 sm:pl-12`}>
      <div
        className="relative overflow-hidden rounded-[20px] border"
        style={{
          borderColor: brand.colors.warm[200],
          borderLeftColor: accent,
          borderLeftWidth: 3,
          background: expanded
            ? "linear-gradient(160deg, rgba(255,251,245,0.96) 0%, rgba(255,255,255,0.92) 100%)"
            : "rgba(255,250,245,0.88)",
          boxShadow: brand.shadows.sm,
        }}
      >
        <button
          type="button"
          className="touch-target-mobile flex min-h-9 w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${segment.transportMode} segment details`}
          onClick={onToggle}
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${accent}1A` }}
            >
              <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
            </span>

            <div className="min-w-0">
              <p className="truncate text-xs font-medium" style={{ color: brand.colors.warm[500] }}>
                {transportLabel}
                {formattedDistance ? ` · ${formattedDistance}` : ""}
              </p>
              <p className="truncate text-sm font-medium" style={{ color: brand.colors.warm[800] }}>
                {fromLabel} to {toLabel}
              </p>
            </div>
          </div>

          <ChevronDown
            className={`segment-card-chevron h-4 w-4 shrink-0 transition-transform duration-200 ease-out ${
              expanded ? "rotate-180" : ""
            }`}
            style={{ color: brand.colors.warm[500] }}
          />
        </button>

        <div
          className="segment-card-content grid"
          style={{
            gridTemplateRows: expanded ? "1fr" : "0fr",
            transition: "grid-template-rows 200ms ease-out",
          }}
        >
          <div className="overflow-hidden">
            <div
              className="segment-card-content border-t px-3 pb-3 pt-2.5"
              style={{
                borderColor: brand.colors.warm[200],
                opacity: expanded ? 1 : 0,
                transform: expanded ? "translateY(0)" : "translateY(-4px)",
                visibility: expanded ? "visible" : "hidden",
                transition: "opacity 200ms ease-out, transform 200ms ease-out",
              }}
            >
              <div className="space-y-2.5">
                {!formattedDistance && (
                  <p className="text-xs font-medium" style={{ color: brand.colors.warm[500] }}>
                    Distance pending
                  </p>
                )}
                <div className="-mx-2">
                  <TransportSelector segment={segment} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showConnector && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-[54px] top-full h-4 w-px"
          style={{
            background: `linear-gradient(180deg, ${accent} 0%, rgba(255,255,255,0) 100%)`,
          }}
        />
      )}
    </div>
  );
}

export default memo(function RouteList({
  onLocationClick,
  onEditLayout,
  selectedLocationIndex,
  onSelectedLocationIndexChange,
}: RouteListProps) {
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);
  const batchRemoveLocations = useProjectStore((s) => s.batchRemoveLocations);
  const batchToggleWaypoint = useProjectStore((s) => s.batchToggleWaypoint);
  const removeLocation = useProjectStore((s) => s.removeLocation);
  const reorderLocations = useProjectStore((s) => s.reorderLocations);
  const toggleWaypoint = useProjectStore((s) => s.toggleWaypoint);
  const addToast = useUIStore((s) => s.addToast);
  const locationIds = useMemo(() => locations.map((location) => location.id), [locations]);
  const locationCount = locations.length;
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set<string>());
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [expandedSegments, setExpandedSegments] = useState<Record<string, boolean>>({});
  const [showEditHint, setShowEditHint] = useState(false);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [bulkExpandSignal, setBulkExpandSignal] = useState(0);
  const [bulkExpandMode, setBulkExpandMode] = useState<"expand" | "collapse" | null>(null);
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const routeListRef = useRef<HTMLDivElement | null>(null);
  const isSelectionControlled = selectedLocationIndex !== undefined;
  const totalStops = locations.length;
  const showToolbar = totalStops >= 5;
  const autoShowFilter = totalStops >= 10;
  const normalizedFilterQuery = filterQuery.trim().toLocaleLowerCase();
  const isFiltering = normalizedFilterQuery.length > 0;
  const showFilterInput = autoShowFilter || filterOpen;
  const dragDisabled = isFiltering;

  useEffect(() => {
    setCollapsedGroups((current) => {
      const nextState = buildCollapsedGroupState(locations, true);
      let changed = false;

      for (const key of Object.keys(nextState)) {
        nextState[key] = current[key] ?? true;
        if (nextState[key] !== current[key]) {
          changed = true;
        }
      }

      if (!changed && Object.keys(current).length === Object.keys(nextState).length) {
        return current;
      }

      return nextState;
    });
  }, [locations]);

  useEffect(() => {
    setExpandedSegments((current) => {
      const nextState: Record<string, boolean> = {};
      let changed = false;

      for (const segment of segments) {
        nextState[segment.id] = current[segment.id] ?? false;
        if (nextState[segment.id] !== current[segment.id]) {
          changed = true;
        }
      }

      if (!changed && Object.keys(current).length === segments.length) {
        return current;
      }

      return nextState;
    });
  }, [segments]);

  useEffect(() => {
    if (isSelectionControlled) {
      if (selectedLocationIndex === null) {
        setSelectedLocationId(null);
        return;
      }

      const selectedLocation = selectedLocationIndex !== undefined
        ? locations[selectedLocationIndex]
        : null;
      setSelectedLocationId(selectedLocation?.id ?? null);
      return;
    }

    if (locationIds.length === 0) {
      setSelectedLocationId(null);
      setSelectedIds((current) => (current.size === 0 ? current : new Set<string>()));
      setSelectionAnchorId(null);
      return;
    }

    if (!selectedLocationId || !locationIds.includes(selectedLocationId)) {
      setSelectedLocationId(locationIds[0]);
    }
  }, [
    isSelectionControlled,
    locationIds,
    locations,
    selectedLocationId,
    selectedLocationIndex,
  ]);

  useEffect(() => {
    const validIds = new Set(locationIds);

    setSelectedIds((current) => {
      let didChange = false;
      const next = new Set<string>();

      current.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
          return;
        }

        didChange = true;
      });

      return didChange ? next : current;
    });

    setSelectionAnchorId((current) => (
      current && validIds.has(current) ? current : null
    ));
  }, [locationIds]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (locations.length === 0) {
      setShowEditHint(false);
      return;
    }

    setShowEditHint(window.localStorage.getItem(EDIT_HINT_STORAGE_KEY) !== "true");
  }, [locations.length]);

  useEffect(() => {
    if (!showEditHint || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowEditHint(false);
      window.localStorage.setItem(EDIT_HINT_STORAGE_KEY, "true");
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [showEditHint]);

  useEffect(() => {
    if (!showFilterInput) {
      return;
    }

    filterInputRef.current?.focus();
  }, [showFilterInput]);

  useEffect(() => {
    if (!selectedLocationId || !routeListRef.current) {
      return;
    }

    const selectedElement = Array.from(
      routeListRef.current.querySelectorAll<HTMLElement>("[data-route-stop-id]"),
    ).find((element) => element.dataset.routeStopId === selectedLocationId);

    selectedElement?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedLocationId]);

  const dismissEditHint = useCallback(() => {
    setShowEditHint(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EDIT_HINT_STORAGE_KEY, "true");
    }
  }, []);

  const markExpansionStateMixed = useCallback(() => {
    setAllCollapsed(false);
    setAllExpanded(false);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set<string>());
    setSelectionAnchorId(null);
  }, []);

  useEffect(() => {
    if (selectedIds.size === 0) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection, selectedIds.size]);

  const handleMultiSelect = useCallback((id: string, shiftKey: boolean) => {
    if (!locationIds.includes(id)) {
      return;
    }

    setSelectedLocationId(id);

    if (shiftKey) {
      const anchorId = selectionAnchorId && locationIds.includes(selectionAnchorId)
        ? selectionAnchorId
        : selectedIds.size === 1
          ? Array.from(selectedIds)[0] ?? id
          : id;
      const anchorIndex = locationIds.indexOf(anchorId);
      const selectedIndex = locationIds.indexOf(id);
      const [start, end] = anchorIndex <= selectedIndex
        ? [anchorIndex, selectedIndex]
        : [selectedIndex, anchorIndex];

      setSelectionAnchorId(anchorId);
      setSelectedIds(new Set(locationIds.slice(start, end + 1)));
      return;
    }

    const isClearingFinalSelection = selectedIds.size === 1 && selectedIds.has(id);
    setSelectionAnchorId(isClearingFinalSelection ? null : id);
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }, [locationIds, selectedIds, selectionAnchorId]);

  const handleDragEnd = (event: DragEndEvent) => {
    if (dragDisabled || selectedIds.size > 0) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = locationIds.indexOf(String(active.id));
    const newIndex = locationIds.indexOf(String(over.id));
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderLocations(oldIndex, newIndex);
    }
  };

  const handleSelectLocation = useCallback((index: number) => {
    const location = locations[index];
    if (!location) return;

    setSelectedLocationId(location.id);
    onSelectedLocationIndexChange?.(index);
    onLocationClick?.(index);
  }, [locations, onLocationClick, onSelectedLocationIndexChange]);

  const toggleSegmentExpansion = useCallback((segmentId: string) => {
    markExpansionStateMixed();
    setExpandedSegments((current) => ({
      ...current,
      [segmentId]: !current[segmentId],
    }));
  }, [markExpansionStateMixed]);

  const visibleLocations = useMemo(
    () => locations.filter((location) => matchesLocationFilter(location, normalizedFilterQuery)),
    [locations, normalizedFilterQuery],
  );

  const visibleLocationIds = useMemo(
    () => visibleLocations.map((location) => location.id),
    [visibleLocations],
  );

  const handleCollapseAll = useCallback(() => {
    setBulkExpandMode("collapse");
    setBulkExpandSignal((current) => current + 1);
    setCollapsedGroups(buildCollapsedGroupState(locations, true));
    setExpandedSegments(buildExpandedSegmentState(segments, false));
    setAllCollapsed(true);
    setAllExpanded(false);
  }, [locations, segments]);

  const handleExpandAll = useCallback(() => {
    setBulkExpandMode("expand");
    setBulkExpandSignal((current) => current + 1);
    setCollapsedGroups(buildCollapsedGroupState(locations, false));
    setExpandedSegments(buildExpandedSegmentState(segments, true));
    setAllCollapsed(false);
    setAllExpanded(true);
  }, [locations, segments]);

  const handleFilterClear = useCallback(() => {
    setFilterQuery("");
    if (!autoShowFilter) {
      setFilterOpen(false);
    }
    filterInputRef.current?.focus();
  }, [autoShowFilter]);

  const focusFilterInput = useCallback(() => {
    if (!showFilterInput) {
      setFilterOpen(true);
      return;
    }

    filterInputRef.current?.focus();
  }, [showFilterInput]);

  const navigateVisibleLocations = useCallback((direction: -1 | 1) => {
    if (visibleLocations.length === 0) {
      return;
    }

    const currentVisibleIndex = visibleLocations.findIndex(
      (location) => location.id === selectedLocationId,
    );
    const nextVisibleIndex = currentVisibleIndex === -1
      ? direction === 1
        ? 0
        : visibleLocations.length - 1
      : Math.min(
          Math.max(currentVisibleIndex + direction, 0),
          visibleLocations.length - 1,
        );

    const nextLocationId = visibleLocations[nextVisibleIndex]?.id;
    if (!nextLocationId) {
      return;
    }

    const nextIndex = locations.findIndex((location) => location.id === nextLocationId);
    if (nextIndex !== -1) {
      handleSelectLocation(nextIndex);
    }
  }, [handleSelectLocation, locations, selectedLocationId, visibleLocations]);

  const handleRouteListKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (isEditableTarget(event.target)) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      navigateVisibleLocations(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      navigateVisibleLocations(-1);
    }
  }, [navigateVisibleLocations]);

  const renderLocationCard = useCallback((location: Location, index: number, indented = false) => {
    const incomingMode = segments[index - 1]?.transportMode ?? segments[index]?.transportMode;
    const isMultiSelected = selectedIds.has(location.id);
    const isSelected = selectedLocationId === location.id || isMultiSelected;

    return (
      <div
        key={location.id}
        className={indented ? "ml-6" : undefined}
        data-route-stop-id={location.id}
      >
        <LocationCard
          locationId={location.id}
          index={index}
          total={locationCount}
          transportMode={incomingMode}
          selected={isSelected}
          isMultiSelected={isMultiSelected}
          onMultiSelect={handleMultiSelect}
          dragDisabled={dragDisabled || selectedIds.size > 0}
          bulkExpandSignal={bulkExpandSignal}
          bulkExpandMode={bulkExpandMode}
          onRemove={removeLocation}
          onToggleWaypoint={toggleWaypoint}
          onExpandedChange={markExpansionStateMixed}
          onClick={handleSelectLocation}
          onEditLayout={onEditLayout}
          showEditHint={index === 0 && showEditHint}
          onDismissEditHint={dismissEditHint}
        />
      </div>
    );
  }, [
    bulkExpandMode,
    bulkExpandSignal,
    dismissEditHint,
    dragDisabled,
    handleMultiSelect,
    handleSelectLocation,
    locationCount,
    markExpansionStateMixed,
    onEditLayout,
    removeLocation,
    selectedIds,
    segments,
    selectedLocationId,
    showEditHint,
    toggleWaypoint,
  ]);

  const selectedIdList = locationIds.filter((id) => selectedIds.has(id));
  let toggleableSelectionCount = 0;
  for (let index = 0; index < locations.length; index += 1) {
    const locationId = locations[index]?.id;
    if (!locationId || !selectedIds.has(locationId)) {
      continue;
    }

    if (index > 0 && index < locations.length - 1) {
      toggleableSelectionCount += 1;
    }
  }

  const handleBatchDelete = useCallback(() => {
    if (selectedIdList.length === 0) {
      return;
    }

    const message = selectedIdList.length === 1
      ? "Delete the selected stop?"
      : `Delete ${selectedIdList.length} selected stops?`;

    if (typeof window !== "undefined" && !window.confirm(message)) {
      return;
    }

    batchRemoveLocations(selectedIdList);
    clearSelection();
    addToast({
      title: selectedIdList.length === 1 ? "Removed 1 stop" : `Removed ${selectedIdList.length} stops`,
      variant: "info",
    });
  }, [addToast, batchRemoveLocations, clearSelection, selectedIdList]);

  const handleBatchTogglePassThrough = useCallback(() => {
    if (toggleableSelectionCount === 0) {
      return;
    }

    batchToggleWaypoint(selectedIdList);
    clearSelection();
    addToast({
      title: toggleableSelectionCount === 1
        ? "Updated 1 stop"
        : `Updated ${toggleableSelectionCount} stops`,
      description: "Pass-through state was toggled for the selected stops.",
      variant: "info",
    });
  }, [addToast, batchToggleWaypoint, clearSelection, selectedIdList, toggleableSelectionCount]);

  if (locationCount === 0) {
    return (
      <div className="p-4">
        <div
          className="rounded-[24px] border px-5 py-8 text-center"
          style={{
            background: "rgba(255,255,255,0.62)",
            borderColor: brand.colors.warm[200],
            boxShadow: brand.shadows.sm,
          }}
        >
          <p
            className="text-lg"
            style={{
              color: brand.colors.primary[600],
              fontFamily: brand.fonts.handwritten,
            }}
          >
            A route begins with one city.
          </p>
          <p className="mt-2 text-sm leading-6" style={{ color: brand.colors.warm[500] }}>
            Search above or tap the map to drop in the first place on your itinerary.
          </p>
        </div>
      </div>
    );
  }
  const timelineItems: ReactNode[] = [];

  if (!isFiltering) {
    for (let index = 0; index < locations.length; index += 1) {
      const location = locations[index];
      if (location.isWaypoint) {
        continue;
      }

      const isSelected = selectedLocationId === location.id || selectedIds.has(location.id);

      timelineItems.push(
        <div key={location.id} className="relative">
          <TimelineNode isWaypoint={false} selected={isSelected} />

          <div className="pl-11 sm:pl-12">
            {renderLocationCard(location, index)}
          </div>
        </div>,
      );

      const nextLocation = locations[index + 1];
      if (!nextLocation) continue;

      if (nextLocation.isWaypoint) {
        const waypointIndexes: number[] = [];
        let cursor = index + 1;

        while (cursor < locations.length && locations[cursor].isWaypoint) {
          waypointIndexes.push(cursor);
          cursor += 1;
        }

        const nextStopIndex = cursor < locations.length ? cursor : null;
        if (waypointIndexes.length === 0 || nextStopIndex === null) continue;

        const nextStop = locations[nextStopIndex];
        const groupSegments = segments.slice(index, nextStopIndex);
        const totalDistance = groupSegments.reduce((sum, segment) => sum + (getSegmentDistance(segment) ?? 0), 0);
        const summaryDistance = formatDistance(totalDistance || null);
        const groupKey = getStopoverGroupKey(location.id);
        const isCollapsed = collapsedGroups[groupKey] ?? true;

        timelineItems.push(
          <div key={groupKey} className="relative">
            <div className="pl-11 sm:pl-12">
              <button
                type="button"
                className="touch-target-mobile flex w-full items-center gap-3 rounded-[24px] border px-3.5 py-3 text-left transition-colors"
                onClick={() => {
                  markExpansionStateMixed();
                  setCollapsedGroups((current) => ({
                    ...current,
                    [groupKey]: !isCollapsed,
                  }));
                }}
                style={{
                  borderColor: brand.colors.warm[200],
                  background: "linear-gradient(160deg, rgba(255,248,240,0.92) 0%, rgba(255,255,255,0.82) 100%)",
                  boxShadow: brand.shadows.sm,
                }}
              >
                <span
                  aria-hidden
                  className="h-full w-1 self-stretch rounded-full"
                  style={{ backgroundColor: brand.colors.ocean[500] }}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="text-[11px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: brand.colors.warm[500] }}
                    >
                      Pass-throughs
                    </span>
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
                      style={{
                        color: brand.colors.ocean[700],
                        backgroundColor: brand.colors.ocean[50],
                      }}
                    >
                      {waypointIndexes.length}
                    </span>
                    {summaryDistance && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                        style={{
                          color: brand.colors.warm[700],
                          borderColor: brand.colors.warm[200],
                          backgroundColor: "rgba(255,255,255,0.84)",
                        }}
                      >
                        <Route className="h-3 w-3" />
                        {summaryDistance}
                      </span>
                    )}
                  </div>

                  <p
                    className="mt-1 text-sm"
                    style={{ color: brand.colors.warm[700] }}
                  >
                    {waypointIndexes.length === 1 ? "A pass-through" : `${waypointIndexes.length} pass-throughs`} before {nextStop.name || "the next destination"}
                  </p>
                </div>

                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                  style={{ color: brand.colors.warm[500] }}
                />
              </button>

              {!isCollapsed && (
                <div className="mt-3 space-y-3">
                  {waypointIndexes.map((waypointIndex, waypointListIndex) => {
                    const waypoint = locations[waypointIndex];
                    const waypointSegment = segments[waypointIndex - 1];
                    const waypointSelected = selectedLocationId === waypoint.id || selectedIds.has(waypoint.id);
                    const showConnector = waypointListIndex < waypointIndexes.length - 1 || nextStopIndex > waypointIndex;

                    return (
                      <div key={waypoint.id} className="space-y-3">
                        {waypointSegment && (
                          <TimelineSegmentCard
                            segment={waypointSegment}
                            fromLabel={locations[waypointIndex - 1]?.name || "Previous stop"}
                            toLabel={waypoint.name || "Pass-through"}
                            distanceKm={getSegmentDistance(waypointSegment)}
                            expanded={expandedSegments[waypointSegment.id] ?? false}
                            onToggle={() => toggleSegmentExpansion(waypointSegment.id)}
                            indented
                            showConnector
                          />
                        )}

                        <div className="relative">
                          <TimelineNode isWaypoint selected={waypointSelected} />

                          <div className="pl-11 sm:pl-12">
                            {renderLocationCard(waypoint, waypointIndex, true)}
                          </div>
                        </div>

                        {waypointListIndex === waypointIndexes.length - 1 && nextStopIndex > waypointIndex && segments[nextStopIndex - 1] && (
                          <TimelineSegmentCard
                            segment={segments[nextStopIndex - 1]}
                            fromLabel={waypoint.name || "Pass-through"}
                            toLabel={nextStop.name || "Destination"}
                            distanceKm={getSegmentDistance(segments[nextStopIndex - 1])}
                            expanded={expandedSegments[segments[nextStopIndex - 1].id] ?? false}
                            onToggle={() => toggleSegmentExpansion(segments[nextStopIndex - 1].id)}
                            indented
                            showConnector={showConnector}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>,
        );

        index = nextStopIndex - 1;
        continue;
      }

      const nextSegment = segments[index];
      if (nextSegment) {
        timelineItems.push(
          <TimelineSegmentCard
            key={nextSegment.id}
            segment={nextSegment}
            fromLabel={location.name || "Current stop"}
            toLabel={nextLocation.name || "Next stop"}
            distanceKm={getSegmentDistance(nextSegment)}
            expanded={expandedSegments[nextSegment.id] ?? false}
            onToggle={() => toggleSegmentExpansion(nextSegment.id)}
            showConnector
          />,
        );
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={dragDisabled ? visibleLocationIds : locationIds}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={routeListRef}
          tabIndex={0}
          role="listbox"
          aria-label="Route stops"
          className="overflow-x-auto px-2 py-4 outline-none focus-visible:ring-2 focus-visible:ring-[#fdba74]/70 focus-visible:ring-inset sm:px-4"
          onKeyDown={handleRouteListKeyDown}
        >
          {selectedIds.size > 0 && (
            <div
              className="mb-4 rounded-[24px] border px-3.5 py-3"
              role="toolbar"
              aria-label="Selected route stop actions"
              style={{
                borderColor: brand.colors.ocean[200],
                background: "linear-gradient(160deg, rgba(240,249,255,0.96) 0%, rgba(255,255,255,0.94) 100%)",
                boxShadow: brand.shadows.sm,
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p
                  className="text-sm font-semibold"
                  style={{ color: brand.colors.ocean[700] }}
                >
                  {selectedIds.size} selected
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                    style={{
                      color: "#991b1b",
                      backgroundColor: "rgba(254,242,242,0.96)",
                      border: "1px solid rgba(248,113,113,0.3)",
                    }}
                    onClick={handleBatchDelete}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    disabled={toggleableSelectionCount === 0}
                    className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      color: brand.colors.ocean[700],
                      backgroundColor: "rgba(224,242,254,0.92)",
                      border: `1px solid ${brand.colors.ocean[200]}`,
                    }}
                    onClick={handleBatchTogglePassThrough}
                  >
                    Toggle Pass-through
                  </button>
                  <button
                    type="button"
                    className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                    style={{
                      color: brand.colors.warm[700],
                      backgroundColor: "rgba(255,255,255,0.92)",
                      border: `1px solid ${brand.colors.warm[200]}`,
                    }}
                    onClick={clearSelection}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}

          {showToolbar && (
            <div className="mb-3 flex min-w-[21.5rem] flex-wrap items-center gap-2 pl-2 pr-3 sm:min-w-0">
              <button
                type="button"
                className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                onClick={handleCollapseAll}
                style={{
                  borderColor: allCollapsed ? brand.colors.primary[300] : brand.colors.warm[200],
                  color: allCollapsed ? brand.colors.primary[700] : brand.colors.warm[600],
                  backgroundColor: allCollapsed ? brand.colors.primary[50] : "rgba(255,255,255,0.78)",
                }}
              >
                Collapse All
              </button>
              <button
                type="button"
                className="inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                onClick={handleExpandAll}
                style={{
                  borderColor: allExpanded ? brand.colors.ocean[300] : brand.colors.warm[200],
                  color: allExpanded ? brand.colors.ocean[700] : brand.colors.warm[600],
                  backgroundColor: allExpanded ? brand.colors.ocean[50] : "rgba(255,255,255,0.78)",
                }}
              >
                Expand All
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                onClick={focusFilterInput}
                style={{
                  borderColor: showFilterInput ? brand.colors.primary[200] : brand.colors.warm[200],
                  color: showFilterInput ? brand.colors.primary[700] : brand.colors.warm[600],
                  backgroundColor: showFilterInput ? "rgba(255,247,237,0.92)" : "rgba(255,255,255,0.78)",
                }}
              >
                <Search className="h-3.5 w-3.5" />
                Filter
              </button>
            </div>
          )}

          {showFilterInput && (
            <div className="mb-3 min-w-[21.5rem] pl-2 pr-3 sm:min-w-0">
              <div
                className="rounded-[22px] border px-3 py-3"
                style={{
                  borderColor: brand.colors.warm[200],
                  background: "linear-gradient(160deg, rgba(255,250,245,0.92) 0%, rgba(255,255,255,0.84) 100%)",
                  boxShadow: brand.shadows.sm,
                }}
              >
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: brand.colors.warm[400] }}
                  />
                  <Input
                    ref={filterInputRef}
                    value={filterQuery}
                    onChange={(event) => setFilterQuery(event.target.value)}
                    placeholder="Filter stops by name"
                    className="h-10 rounded-2xl border-[#fed7aa] bg-white/90 pl-9 pr-10 text-sm shadow-none focus-visible:border-[#f97316] focus-visible:ring-[#f97316]/15"
                    aria-label="Filter route stops"
                  />
                  {filterQuery && (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full transition-colors hover:bg-[#fff1f2]"
                      onClick={handleFilterClear}
                      aria-label="Clear stop filter"
                    >
                      <X className="h-3.5 w-3.5" style={{ color: brand.colors.warm[500] }} />
                    </button>
                  )}
                </div>
                {isFiltering && (
                  <p className="mt-2 text-xs font-medium" style={{ color: brand.colors.warm[500] }}>
                    Showing {visibleLocations.length} of {totalStops} stops
                  </p>
                )}
              </div>
            </div>
          )}

          {isFiltering ? (
            <div className="min-w-[21.5rem] pb-4 pl-2 pr-3 sm:min-w-0">
              {visibleLocations.length === 0 ? (
                <div
                  className="rounded-[24px] border px-5 py-6 text-center"
                  style={{
                    borderColor: brand.colors.warm[200],
                    backgroundColor: "rgba(255,255,255,0.72)",
                    boxShadow: brand.shadows.sm,
                  }}
                >
                  <p className="text-sm font-medium" style={{ color: brand.colors.warm[700] }}>
                    No stops match &ldquo;{filterQuery.trim()}&rdquo;.
                  </p>
                  <button
                    type="button"
                    className="mt-3 inline-flex rounded-full border px-3 py-1.5 text-xs font-medium"
                    onClick={handleFilterClear}
                    style={{
                      borderColor: brand.colors.warm[200],
                      color: brand.colors.warm[600],
                      backgroundColor: "rgba(255,255,255,0.88)",
                    }}
                  >
                    Clear filter
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleLocations.map((location) => {
                    const index = locations.findIndex((candidate) => candidate.id === location.id);
                    return renderLocationCard(location, index);
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="relative min-w-[21.5rem] pb-4 pl-2 pr-3 sm:min-w-0">
              <div
                aria-hidden
                className="pointer-events-none absolute bottom-6 top-7 w-[2px] rounded-full"
                style={{
                  left: 25,
                  background: `linear-gradient(180deg, ${brand.colors.primary[300]} 0%, ${brand.colors.ocean[400]} 100%)`,
                }}
              />

              <div className="space-y-3">{timelineItems}</div>
            </div>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
});
