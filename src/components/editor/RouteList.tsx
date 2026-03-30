"use client";

import { memo } from "react";
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
import { useProjectStore } from "@/stores/projectStore";
import { useLocationIds, useLocationCount } from "@/stores/selectors";
import LocationCard from "./LocationCard";
import TransportSelector from "./TransportSelector";

interface RouteListProps {
  onLocationClick?: (index: number) => void;
  onEditLayout?: (locationId: string) => void;
}

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
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted-foreground text-center">
          Click on the map or search to add your first destination.
        </p>
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
        <div className="flex flex-col gap-4 p-3">
          {locationIds.map((id, i) => (
            <div key={id}>
              <LocationCard
                locationId={id}
                index={i}
                total={locationCount}
                onRemove={removeLocation}
                onToggleWaypoint={toggleWaypoint}
                onClick={onLocationClick}
                onEditLayout={onEditLayout}
              />
              {i < segments.length && (
                <TransportSelector segment={segments[i]} />
              )}
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
});
