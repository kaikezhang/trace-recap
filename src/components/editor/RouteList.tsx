"use client";

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
import LocationCard from "./LocationCard";
import TransportSelector from "./TransportSelector";

interface RouteListProps {
  onLocationClick?: (index: number) => void;
}

export default function RouteList({ onLocationClick }: RouteListProps) {
  const locations = useProjectStore((s) => s.locations);
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
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = locations.findIndex((l) => l.id === active.id);
    const newIndex = locations.findIndex((l) => l.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderLocations(oldIndex, newIndex);
    }
  };

  if (locations.length === 0) {
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
        items={locations.map((l) => l.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-1 p-3">
          {locations.map((loc, i) => (
            <div key={loc.id}>
              <LocationCard
                location={loc}
                index={i}
                total={locations.length}
                onRemove={removeLocation}
                onToggleWaypoint={toggleWaypoint}
                onClick={onLocationClick}
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
}
