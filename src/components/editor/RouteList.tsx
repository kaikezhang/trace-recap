"use client";

import { useProjectStore } from "@/stores/projectStore";
import LocationCard from "./LocationCard";
import TransportSelector from "./TransportSelector";

export default function RouteList() {
  const locations = useProjectStore((s) => s.locations);
  const segments = useProjectStore((s) => s.segments);
  const removeLocation = useProjectStore((s) => s.removeLocation);
  const reorderLocations = useProjectStore((s) => s.reorderLocations);

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
    <div className="flex flex-col gap-1 p-3">
      {locations.map((loc, i) => (
        <div key={loc.id}>
          <LocationCard
            location={loc}
            index={i}
            total={locations.length}
            onRemove={removeLocation}
            onMoveUp={(idx) => reorderLocations(idx, idx - 1)}
            onMoveDown={(idx) => reorderLocations(idx, idx + 1)}
          />
          {i < segments.length && (
            <TransportSelector segment={segments[i]} />
          )}
        </div>
      ))}
    </div>
  );
}
