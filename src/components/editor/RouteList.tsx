"use client";

import { memo, useEffect, useState, type ReactNode } from "react";
import { lineString } from "@turf/helpers";
import { length } from "@turf/length";
import {
  Bike,
  Bus,
  Car,
  ChevronDown,
  Clock3,
  Footprints,
  Plane,
  Route,
  Ship,
  TrainFront,
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
import { brand } from "@/lib/brand";
import { useAnimationStore } from "@/stores/animationStore";
import { useProjectStore } from "@/stores/projectStore";
import { useLocationCount, useLocationIds } from "@/stores/selectors";
import type { Segment, TransportMode } from "@/types";
import LocationCard from "./LocationCard";
import TransportSelector from "./TransportSelector";

interface RouteListProps {
  onLocationClick?: (index: number) => void;
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

const TRANSPORT_ACCENTS: Record<TransportMode, string> = {
  flight: "#f97316",
  car: "#a16207",
  train: "#0891b2",
  bus: "#a855f7",
  ferry: "#0e7490",
  walk: "#78350f",
  bicycle: "#155e75",
};

function formatDistance(distanceKm: number | null): string | null {
  if (distanceKm === null || !Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  if (distanceKm < 100) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
}

function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;

  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} sec`;

  const roundedMinutes = Math.max(1, Math.round(seconds / 60));
  if (roundedMinutes < 60) return `${roundedMinutes} min`;

  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
}

function getSegmentDistance(segment: Segment): number | null {
  if (!segment.geometry || segment.geometry.coordinates.length < 2) return null;
  return length(lineString(segment.geometry.coordinates));
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
  durationSeconds,
  distanceKm,
  compact = false,
  indented = false,
  showConnector = true,
}: {
  segment: Segment;
  fromLabel: string;
  toLabel: string;
  durationSeconds: number | null;
  distanceKm: number | null;
  compact?: boolean;
  indented?: boolean;
  showConnector?: boolean;
}) {
  const Icon = TRANSPORT_ICONS[segment.transportMode];
  const accent = TRANSPORT_ACCENTS[segment.transportMode];
  const pillBits = [formatDistance(distanceKm), formatDuration(durationSeconds)].filter(Boolean);

  return (
    <div
      className={`relative ${indented ? "ml-6" : ""} pl-11 sm:pl-12`}
    >
      <div
        className={`relative overflow-hidden rounded-[24px] border ${
          compact ? "px-3 py-3" : "px-3.5 py-3.5"
        }`}
        style={{
          borderColor: brand.colors.warm[200],
          background: compact
            ? "rgba(255,250,245,0.84)"
            : "linear-gradient(160deg, rgba(255,251,245,0.96) 0%, rgba(255,255,255,0.92) 100%)",
          boxShadow: brand.shadows.sm,
        }}
      >
        <div className="flex items-stretch gap-3">
          <span
            aria-hidden
            className="w-1 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${accent}1A` }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
                </span>

                <div className="min-w-0">
                  <p
                    className="truncate text-[11px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: brand.colors.warm[500] }}
                  >
                    {segment.transportMode}
                  </p>
                  <p
                    className="truncate text-sm font-medium"
                    style={{ color: brand.colors.warm[800] }}
                  >
                    {fromLabel} to {toLabel}
                  </p>
                </div>
              </div>

              {pillBits.length > 0 && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                  style={{
                    color: brand.colors.warm[700],
                    borderColor: brand.colors.warm[200],
                    backgroundColor: "rgba(255,255,255,0.88)",
                  }}
                >
                  <Route className="h-3 w-3" />
                  {pillBits.join(" · ")}
                </span>
              )}
            </div>

            <div
              className="mt-3 overflow-hidden rounded-[20px] border"
              style={{
                borderColor: brand.colors.warm[200],
                backgroundColor: "rgba(255,255,255,0.76)",
              }}
            >
              <TransportSelector segment={segment} />
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
}: RouteListProps) {
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);
  const segmentTimingOverrides = useProjectStore((s) => s.segmentTimingOverrides);
  const removeLocation = useProjectStore((s) => s.removeLocation);
  const reorderLocations = useProjectStore((s) => s.reorderLocations);
  const toggleWaypoint = useProjectStore((s) => s.toggleWaypoint);
  const timeline = useAnimationStore((s) => s.timeline);
  const locationIds = useLocationIds();
  const locationCount = useLocationCount();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (locationIds.length === 0) {
      setSelectedLocationId(null);
      return;
    }

    if (!selectedLocationId || !locationIds.includes(selectedLocationId)) {
      setSelectedLocationId(locationIds[0]);
    }
  }, [locationIds, selectedLocationId]);

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = locationIds.indexOf(String(active.id));
    const newIndex = locationIds.indexOf(String(over.id));
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderLocations(oldIndex, newIndex);
    }
  };

  const getDisplayDuration = (segment: Segment): number | null => {
    const override = segmentTimingOverrides[segment.id];
    if (override !== undefined) return override;
    return timeline.find((entry) => entry.segmentId === segment.id)?.duration ?? null;
  };

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

  for (let index = 0; index < locations.length; index += 1) {
    const location = locations[index];

    if (location.isWaypoint) {
      continue;
    }

    const incomingMode = segments[index - 1]?.transportMode ?? segments[index]?.transportMode;
    const isSelected = selectedLocationId === location.id;

    timelineItems.push(
      <div key={location.id} className="relative">
        <TimelineNode isWaypoint={false} selected={isSelected} />

        <div className="pl-11 sm:pl-12">
          <LocationCard
            locationId={location.id}
            index={index}
            total={locationCount}
            transportMode={incomingMode}
            selected={isSelected}
            onRemove={removeLocation}
            onToggleWaypoint={toggleWaypoint}
            onClick={(clickedIndex) => {
              setSelectedLocationId(location.id);
              onLocationClick?.(clickedIndex);
            }}
            onEditLayout={onEditLayout}
          />
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
      const durationValues = groupSegments
        .map((segment) => getDisplayDuration(segment))
        .filter((value): value is number => value !== null);
      const totalDuration =
        durationValues.length === groupSegments.length
          ? durationValues.reduce((sum, value) => sum + value, 0)
          : durationValues.length > 0
            ? durationValues.reduce((sum, value) => sum + value, 0)
            : null;
      const summaryBits = [formatDistance(totalDistance || null), formatDuration(totalDuration)].filter(Boolean);
      const groupKey = `${location.id}-stopovers`;
      const isCollapsed = collapsedGroups[groupKey] ?? false;

      timelineItems.push(
        <div key={groupKey} className="relative">
          <div className="pl-11 sm:pl-12">
            <button
              type="button"
              className="touch-target-mobile flex w-full items-center gap-3 rounded-[24px] border px-3.5 py-3 text-left transition-colors"
              onClick={() =>
                setCollapsedGroups((current) => ({
                  ...current,
                  [groupKey]: !isCollapsed,
                }))
              }
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
                    Stopovers
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
                  {summaryBits.length > 0 && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                      style={{
                        color: brand.colors.warm[700],
                        borderColor: brand.colors.warm[200],
                        backgroundColor: "rgba(255,255,255,0.84)",
                      }}
                    >
                      <Clock3 className="h-3 w-3" />
                      {summaryBits.join(" · ")}
                    </span>
                  )}
                </div>

                <p
                  className="mt-1 text-sm"
                  style={{ color: brand.colors.warm[700] }}
                >
                  {waypointIndexes.length === 1 ? "A scenic stop" : `${waypointIndexes.length} scenic pauses`} before {nextStop.name || "the next destination"}
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
                  const waypointSelected = selectedLocationId === waypoint.id;
                  const showConnector = waypointListIndex < waypointIndexes.length - 1 || nextStopIndex > waypointIndex;

                  return (
                    <div key={waypoint.id} className="space-y-3">
                      {waypointSegment && (
                        <TimelineSegmentCard
                          segment={waypointSegment}
                          fromLabel={locations[waypointIndex - 1]?.name || "Previous stop"}
                          toLabel={waypoint.name || "Stopover"}
                          durationSeconds={getDisplayDuration(waypointSegment)}
                          distanceKm={getSegmentDistance(waypointSegment)}
                          compact
                          indented
                          showConnector
                        />
                      )}

                      <div className="relative">
                        <TimelineNode isWaypoint selected={waypointSelected} />

                        <div className="ml-6 pl-11 sm:pl-12">
                          <LocationCard
                            locationId={waypoint.id}
                            index={waypointIndex}
                            total={locationCount}
                            transportMode={
                              segments[waypointIndex - 1]?.transportMode ??
                              segments[waypointIndex]?.transportMode
                            }
                            selected={waypointSelected}
                            onRemove={removeLocation}
                            onToggleWaypoint={toggleWaypoint}
                            onClick={(clickedIndex) => {
                              setSelectedLocationId(waypoint.id);
                              onLocationClick?.(clickedIndex);
                            }}
                            onEditLayout={onEditLayout}
                          />
                        </div>
                      </div>

                      {waypointListIndex === waypointIndexes.length - 1 && nextStopIndex > waypointIndex && segments[nextStopIndex - 1] && (
                        <TimelineSegmentCard
                          segment={segments[nextStopIndex - 1]}
                          fromLabel={waypoint.name || "Stopover"}
                          toLabel={nextStop.name || "Destination"}
                          durationSeconds={getDisplayDuration(segments[nextStopIndex - 1])}
                          distanceKm={getSegmentDistance(segments[nextStopIndex - 1])}
                          compact
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
          durationSeconds={getDisplayDuration(nextSegment)}
          distanceKm={getSegmentDistance(nextSegment)}
          showConnector
        />,
      );
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={locationIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="overflow-x-auto px-2 py-4 sm:px-4">
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
        </div>
      </SortableContext>
    </DndContext>
  );
});
