"use client";

import { memo, useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useId, type KeyboardEvent } from "react";
import { Search, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
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
  className?: string;
  inputClassName?: string;
}

export interface CitySearchHandle {
  focus: () => void;
}

const SEARCH_PLACEHOLDER = "Search cities...";

function splitPlaceName(placeName: string): { city: string; region: string } {
  const parts = placeName.split(",");
  const city = parts[0]?.trim() ?? placeName;
  const region = parts.slice(1).join(",").trim();
  return { city, region };
}

const CitySearch = forwardRef<CitySearchHandle, CitySearchProps>(
  function CitySearch({ hintMessage, onHintDismiss, className, inputClassName }, ref) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<GeoResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const addLocation = useProjectStore((s) => s.addLocation);
    const { map } = useMap();
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const inputId = useId();
    const listboxId = `${inputId}-listbox`;
    const labelId = `${inputId}-label`;

    const getOptionId = useCallback(
      (index: number) => `${inputId}-option-${index}`,
      [inputId]
    );
    const activeDescendantId =
      activeIndex >= 0 && activeIndex < results.length
        ? getOptionId(activeIndex)
        : undefined;

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
          setActiveIndex(-1);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
      if (!isOpen || results.length === 0) {
        setActiveIndex(-1);
        return;
      }

      setActiveIndex((prev) => {
        if (prev >= 0 && prev < results.length) {
          return prev;
        }
        return 0;
      });
    }, [isOpen, results]);

    const search = useCallback(
      (q: string) => {
        setQuery(q);
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (q.trim().length < 2) {
          setResults([]);
          setIsOpen(false);
          setActiveIndex(-1);
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
            setIsOpen(false);
            setActiveIndex(-1);
          } finally {
            setIsLoading(false);
          }
        }, 300);
      },
      []
    );

    const selectResult = async (result: GeoResult) => {
      let nameLocal: string | undefined;
      try {
        const name = result.text || result.place_name;
        const { localLanguage } = useUIStore.getState();
        const res = await fetch(
          `/api/geocode?q=${encodeURIComponent(name)}&language=${localLanguage}`
        );
        const data = await res.json();
        nameLocal =
          data.features?.[0]?.text ||
          data.features?.[0]?.place_name ||
          undefined;
      } catch {
        // Non-critical, proceed without local name
      }
      addLocation({
        name: result.text || result.place_name,
        nameLocal,
        coordinates: result.center,
      });
      if (map) {
        map.flyTo({ center: result.center, zoom: 6 });
      }
      setQuery("");
      setResults([]);
      setIsOpen(false);
      setActiveIndex(-1);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        if (results.length === 0) return;
        event.preventDefault();
        setIsOpen(true);
        setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        if (results.length === 0) return;
        event.preventDefault();
        setIsOpen(true);
        setActiveIndex((prev) => (prev <= 0 ? 0 : prev - 1));
        return;
      }

      if (event.key === "Enter" && isOpen && activeIndex >= 0 && activeIndex < results.length) {
        event.preventDefault();
        void selectResult(results[activeIndex]);
        return;
      }

      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    return (
      <div ref={containerRef} className={cn("relative p-3", className)}>
        <label
          id={labelId}
          htmlFor={inputId}
          className="mb-2 block text-sm font-medium text-foreground"
        >
          Search cities
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            id={inputId}
            data-city-search-input="true"
            role="combobox"
            aria-labelledby={labelId}
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeDescendantId}
            placeholder={SEARCH_PLACEHOLDER}
            value={query}
            onChange={(e) => search(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn([
              "city-search-input pl-9 h-11 text-base transition-all duration-200",
              "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10",
            ].join(" "), inputClassName)}
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
        {isOpen && (
          <div
            id={listboxId}
            role="listbox"
            aria-label="City search results"
            className="search-dropdown absolute left-3 right-3 top-[88px] z-50 overflow-hidden rounded-xl border bg-popover shadow-lg"
          >
            {results.length > 0 ? results.map((r, index) => {
              const { city, region } = splitPlaceName(r.place_name);
              const isActive = index === activeIndex;
              return (
                <div
                  key={r.id}
                  id={getOptionId(index)}
                  role="option"
                  aria-selected={isActive}
                  className={cn(
                    "w-full px-3 py-2.5 text-left flex items-center gap-2.5 first:rounded-t-xl last:rounded-b-xl cursor-pointer",
                    isActive ? "bg-accent" : "hover:bg-accent"
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    void selectResult(r);
                  }}
                >
                  <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                    <MapPin className="h-3.5 w-3.5 text-indigo-500" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-medium block truncate">{city}</span>
                    {region && (
                      <span className="text-xs text-muted-foreground block truncate">{region}</span>
                    )}
                  </div>
                </div>
              );
            }) : !isLoading && query.trim().length >= 2 ? (
              <div className="p-6 flex flex-col items-center gap-2" role="presentation">
                <MapPin className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No cities found</p>
              </div>
            ) : null}
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

export default memo(CitySearch);
