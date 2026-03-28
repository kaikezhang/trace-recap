"use client";

import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/stores/projectStore";
import { useMap } from "./MapContext";

interface GeoResult {
  id: string;
  place_name: string;
  text: string;
  center: [number, number];
}

export default function CitySearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const addLocation = useProjectStore((s) => s.addLocation);
  const { map } = useMap();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        setResults(data.features || []);
        setIsOpen(true);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  };

  const selectResult = async (result: GeoResult) => {
    // Forward geocode English name → Chinese (more reliable than reverse geocode)
    let nameZh: string | undefined;
    try {
      const name = result.text || result.place_name;
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(name)}&language=zh`);
      const data = await res.json();
      nameZh = data.features?.[0]?.text || data.features?.[0]?.place_name || undefined;
    } catch {
      // Non-critical, proceed without Chinese name
    }
    addLocation({
      name: result.text || result.place_name,
      nameZh,
      coordinates: result.center,
    });
    if (map) {
      map.flyTo({ center: result.center, zoom: 6 });
    }
    setQuery("");
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative p-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search city..."
          value={query}
          onChange={(e) => search(e.target.value)}
          className="pl-9"
        />
      </div>
      {isOpen && results.length > 0 && (
        <div className="absolute left-3 right-3 top-14 z-50 rounded-md border bg-popover shadow-lg">
          {results.map((r) => (
            <button
              key={r.id}
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent truncate"
              onClick={() => selectResult(r)}
            >
              {r.place_name}
            </button>
          ))}
        </div>
      )}
      {isLoading && (
        <p className="mt-1 text-xs text-muted-foreground px-1">Searching...</p>
      )}
    </div>
  );
}
