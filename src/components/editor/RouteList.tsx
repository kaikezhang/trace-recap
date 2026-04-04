"use client";

import { memo, useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Bike,
  Bus,
  Car,
  Footprints,
  Plane,
  Ship,
  TrainFront,
  type LucideIcon,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { useProjectStore } from "@/stores/projectStore";
import { useLocationCount, useLocationIds } from "@/stores/selectors";
import type { TransportMode } from "@/types";
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
  flight: brand.colors.primary[500],
  car: brand.colors.sand[600],
  train: brand.colors.ocean[600],
  bus: "#a855f7",
  ferry: "#0891b2",
  walk: brand.colors.warm[600],
  bicycle: brand.colors.ocean[700],
};

export default memo(function RouteList({
  onLocationClick,
  onEditLayout,
}: RouteListProps) {
  const locationIds = useLocationIds();
  const locationCount = useLocationCount();
  const segments = useProjectStore((s) => s.segments);
  const removeLocation = useProjectStore((s) => s.removeLocation);
  const reorderLocations = useProjectStore((s) => s.reorderLocations);
  const toggleWaypoint = useProjectStore((s) => s.toggleWaypoint);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

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
        <div className="flex flex-col gap-4 px-4 py-4">
          {locationIds.map((id, index) => {
            const segment = segments[index];
            const transportMode = segments[index - 1]?.transportMode ?? segments[index]?.transportMode;
            const SegmentIcon = segment ? TRANSPORT_ICONS[segment.transportMode] : null;
            const isSelected = selectedLocationId === id;

            return (
              <div key={id} className="relative">
                <div className="relative pl-12">
                  {index < locationCount - 1 && (
                    <div
                      className="absolute left-[13px] top-10 bottom-[-1.25rem] w-px"
                      style={{
                        background: `linear-gradient(180deg, ${brand.colors.primary[200]} 0%, ${brand.colors.ocean[200]} 100%)`,
                      }}
                    />
                  )}

                  <div
                    className="absolute left-0 top-7 flex h-7 w-7 items-center justify-center rounded-full border bg-white"
                    style={{
                      borderColor: isSelected ? brand.colors.primary[300] : brand.colors.warm[200],
                      boxShadow: brand.shadows.sm,
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: isSelected ? brand.colors.primary[500] : brand.colors.ocean[500],
                      }}
                    />
                  </div>

                  <LocationCard
                    locationId={id}
                    index={index}
                    total={locationCount}
                    transportMode={transportMode}
                    selected={isSelected}
                    onRemove={removeLocation}
                    onToggleWaypoint={toggleWaypoint}
                    onClick={(clickedIndex) => {
                      setSelectedLocationId(id);
                      onLocationClick?.(clickedIndex);
                    }}
                    onEditLayout={onEditLayout}
                  />
                </div>

                {segment && SegmentIcon && (
                  <div className="relative pl-12 pr-1 pt-2">
                    <div
                      className="absolute left-[13px] top-0 bottom-0 w-px"
                      style={{
                        background: `linear-gradient(180deg, ${brand.colors.primary[200]} 0%, ${brand.colors.ocean[200]} 100%)`,
                      }}
                    />

                    <div
                      className="absolute left-0 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border bg-white"
                      style={{
                        borderColor: brand.colors.warm[200],
                        boxShadow: brand.shadows.sm,
                      }}
                    >
                      <SegmentIcon
                        className="h-3.5 w-3.5"
                        style={{ color: TRANSPORT_ACCENTS[segment.transportMode] }}
                      />
                    </div>

                    <div
                      className="rounded-[24px] border px-2 py-1.5"
                      style={{
                        backgroundColor: "rgba(255,251,245,0.88)",
                        borderColor: brand.colors.warm[200],
                        boxShadow: brand.shadows.sm,
                      }}
                    >
                      <TransportSelector segment={segment} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
});
