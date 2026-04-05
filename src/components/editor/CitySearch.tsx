"use client";

import { memo, useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useId, type KeyboardEvent } from "react";
import { Search, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { brand } from "@/lib/brand";
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
  hideLabel?: boolean;
  onInputFocus?: () => void;
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
  function CitySearch(
    { hintMessage, onHintDismiss, className, inputClassName, hideLabel = false, onInputFocus },
    ref
  ) {
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
        {!hideLabel && (
          <label
            id={labelId}
            htmlFor={inputId}
            className="mb-2 block text-sm font-medium"
            style={{ color: brand.colors.warm[700] }}
          >
            Search cities
          </label>
        )}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: brand.colors.warm[400] }}
          />
          <Input
            ref={inputRef}
            id={inputId}
            data-city-search-input="true"
            role="combobox"
            aria-label={hideLabel ? "Search cities" : undefined}
            aria-labelledby={hideLabel ? undefined : labelId}
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeDescendantId}
            placeholder={SEARCH_PLACEHOLDER}
            value={query}
            onChange={(e) => search(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onInputFocus}
            className={cn([
              "city-search-input h-11 rounded-[20px] border pl-10 pr-4 text-[15px] shadow-[0_14px_28px_-24px_rgba(120,53,15,0.5)] transition-all duration-200",
              "focus-visible:ring-2",
            ].join(" "), inputClassName)}
            style={{
              borderColor: brand.colors.warm[200],
              backgroundColor: "rgba(255,255,255,0.92)",
            }}
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
            className="search-dropdown absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-[22px] border shadow-lg"
            style={{
              borderColor: brand.colors.warm[200],
              background: "linear-gradient(180deg, rgba(255,251,245,0.98) 0%, rgba(255,255,255,0.96) 100%)",
              boxShadow: brand.shadows.lg,
            }}
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
                    "flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-3 text-left first:rounded-t-[22px] last:rounded-b-[22px]",
                    isActive ? "" : "hover:bg-white/70"
                  )}
                  style={{
                    backgroundColor: isActive ? "rgba(255,247,237,0.88)" : undefined,
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    void selectResult(r);
                  }}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: brand.colors.primary[50] }}
                  >
                    <MapPin className="h-3.5 w-3.5" style={{ color: brand.colors.primary[500] }} />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium" style={{ color: brand.colors.warm[800] }}>
                      {city}
                    </span>
                    {region && (
                      <span className="block truncate text-xs" style={{ color: brand.colors.warm[500] }}>
                        {region}
                      </span>
                    )}
                  </div>
                </div>
              );
            }) : !isLoading && query.trim().length >= 2 ? (
              <div className="flex flex-col items-center gap-2 p-6" role="presentation">
                <MapPin className="h-8 w-8" style={{ color: brand.colors.warm[300] }} />
                <p className="text-sm" style={{ color: brand.colors.warm[500] }}>No cities found</p>
              </div>
            ) : null}
          </div>
        )}
        {isLoading && (
          <p className="mt-1 px-1 text-xs" style={{ color: brand.colors.warm[500] }}>
            Searching...
          </p>
        )}
      </div>
    );
  }
);

export default memo(CitySearch);
