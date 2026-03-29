"use client";

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/stores/projectStore";
import { useMap } from "./MapContext";
import OnboardingHint from "./OnboardingHint";

interface GeoResult {
  id: string;
  place_name: string;
  text: string;
  center: [number, number];
}

interface CitySearchProps {
  hintMessage?: string;
  onHintDismiss?: () => void;
}

export interface CitySearchHandle {
  focus: () => void;
}

const PLACEHOLDER_CITIES = [
  "Search Tokyo...",
  "Search Paris...",
  "Search New York...",
  "Search Sydney...",
];

const CitySearch = forwardRef<CitySearchHandle, CitySearchProps>(
  function CitySearch({ hintMessage, onHintDismiss }, ref) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GeoResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [placeholderVisible, setPlaceholderVisible] = useState(true);
    const addLocation = useProjectStore((s) => s.addLocation);
    const { map } = useMap();
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    // Animated placeholder cycling
    useEffect(() => {
      const interval = setInterval(() => {
        setPlaceholderVisible(false);
        setTimeout(() => {
          setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_CITIES.length);
          setPlaceholderVisible(true);
        }, 200);
      }, 3000);
      return () => clearInterval(interval);
    }, []);

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

    const search = useCallback(
      (q: string) => {
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
      },
      []
    );

    const selectResult = async (result: GeoResult) => {
      let nameZh: string | undefined;
      try {
        const name = result.text || result.place_name;
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(name)}&language=zh`
        );
        const data = await res.json();
        nameZh =
          data.features?.[0]?.text ||
          data.features?.[0]?.place_name ||
          undefined;
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
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder={PLACEHOLDER_CITIES[placeholderIndex]}
            value={query}
            onChange={(e) => search(e.target.value)}
            className={[
              "pl-9 h-11 text-base transition-opacity duration-200",
              !query && !placeholderVisible ? "placeholder:opacity-0" : "placeholder:opacity-100",
            ].join(" ")}
          />
        </div>
        {hintMessage && onHintDismiss && (
          <OnboardingHint
            message={hintMessage}
            onDismiss={onHintDismiss}
            className="left-3 right-3 top-[calc(100%+0.25rem)] max-w-none"
            arrowClassName="left-6 -top-[7px] border-b-0 border-r-0"
          />
        )}
        {isOpen && results.length > 0 && (
          <div className="absolute left-3 right-3 top-[60px] z-50 rounded-xl border bg-popover shadow-lg">
            {results.map((r) => (
              <button
                key={r.id}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent truncate first:rounded-t-xl last:rounded-b-xl"
                onClick={() => selectResult(r)}
              >
                {r.place_name}
              </button>
            ))}
          </div>
        )}
        {isLoading && (
          <p className="mt-1 text-xs text-muted-foreground px-1">
            Searching...
          </p>
        )}
      </div>
    );
  }
);

export default CitySearch;
