"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/stores/projectStore";
import { generateRouteGeometry } from "@/engine/RouteGeometry";
import type { TransportMode } from "@/types";

export default function AIRouteGenerator() {
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearRoute = useProjectStore((s) => s.clearRoute);
  const addLocation = useProjectStore((s) => s.addLocation);
  const setTransportMode = useProjectStore((s) => s.setTransportMode);
  const setSegmentGeometry = useProjectStore((s) => s.setSegmentGeometry);

  const handleGenerate = async () => {
    if (!description.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/generate-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate route");
      }

      // Clear existing route and populate new one
      clearRoute();

      // Add locations
      for (const loc of data.locations) {
        addLocation({
          name: loc.name,
          coordinates: loc.coordinates,
        });
      }

      // Set transport modes and generate geometry
      // We need to wait a tick for the store to update segments
      setTimeout(async () => {
        const state = useProjectStore.getState();
        for (let i = 0; i < data.segments.length && i < state.segments.length; i++) {
          const seg = state.segments[i];
          const mode = data.segments[i].transportMode as TransportMode;
          setTransportMode(seg.id, mode);

          // Generate geometry
          const fromLoc = state.locations[data.segments[i].fromIndex];
          const toLoc = state.locations[data.segments[i].toIndex];
          if (fromLoc && toLoc) {
            try {
              const geometry = await generateRouteGeometry(
                fromLoc.coordinates,
                toLoc.coordinates,
                mode
              );
              setSegmentGeometry(seg.id, geometry);
            } catch {
              // Geometry generation failed for this segment
            }
          }
        }
      }, 0);

      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border-b p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <Sparkles className="h-3.5 w-3.5" />
        AI Route Generator
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe your trip... e.g. 'Flew from San Francisco to Tokyo, took the bullet train to Kyoto, then drove to Osaka'"
        className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none h-20 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        disabled={isLoading}
      />
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      <Button
        size="sm"
        className="w-full gap-1.5"
        onClick={handleGenerate}
        disabled={isLoading || !description.trim()}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            Generate Route
          </>
        )}
      </Button>
    </div>
  );
}
