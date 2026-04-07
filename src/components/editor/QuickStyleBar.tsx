"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { MAP_STYLE_CONFIGS } from "@/lib/constants";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import type { AspectRatio, MapStyle } from "@/types";

const QUICK_STYLE_IDS = [
  "light",
  "dark",
  "streets",
  "satellite",
  "navigation-day",
  "navigation-night",
  "vintage",
  "monochrome",
] as const satisfies readonly MapStyle[];

const QUICK_RATIO_OPTIONS = ["16:9", "9:16", "1:1"] as const satisfies readonly AspectRatio[];

const MAP_STYLE_PREVIEWS: Record<
  (typeof QUICK_STYLE_IDS)[number],
  { background: string; route: string; pin: string; glow: string }
> = {
  light: {
    background: "linear-gradient(135deg, #f7f4ee 0%, #e8ecf2 100%)",
    route: "rgba(44, 96, 145, 0.68)",
    pin: "#f97316",
    glow: "rgba(255, 255, 255, 0.58)",
  },
  dark: {
    background: "linear-gradient(135deg, #1f2937 0%, #0f172a 100%)",
    route: "rgba(96, 165, 250, 0.72)",
    pin: "#facc15",
    glow: "rgba(148, 163, 184, 0.2)",
  },
  streets: {
    background: "linear-gradient(135deg, #ecd9aa 0%, #d8c28f 100%)",
    route: "rgba(185, 28, 28, 0.65)",
    pin: "#0f766e",
    glow: "rgba(255, 251, 235, 0.35)",
  },
  satellite: {
    background: "linear-gradient(135deg, #425f35 0%, #223523 100%)",
    route: "rgba(251, 191, 36, 0.78)",
    pin: "#f8fafc",
    glow: "rgba(167, 243, 208, 0.2)",
  },
  "navigation-day": {
    background: "linear-gradient(135deg, #d9e9fa 0%, #b8d8f4 100%)",
    route: "rgba(37, 99, 235, 0.72)",
    pin: "#f97316",
    glow: "rgba(255, 255, 255, 0.45)",
  },
  "navigation-night": {
    background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
    route: "rgba(56, 189, 248, 0.76)",
    pin: "#f97316",
    glow: "rgba(59, 130, 246, 0.2)",
  },
  vintage: {
    background: "linear-gradient(135deg, #efe2c8 0%, #d7bea1 100%)",
    route: "rgba(120, 53, 15, 0.6)",
    pin: "#c2410c",
    glow: "rgba(255, 247, 237, 0.4)",
  },
  monochrome: {
    background: "linear-gradient(135deg, #f1f5f9 0%, #d6d3d1 100%)",
    route: "rgba(87, 83, 78, 0.65)",
    pin: "#0f172a",
    glow: "rgba(255, 255, 255, 0.42)",
  },
};

function formatSpeed(speedMultiplier: number): string {
  return `${speedMultiplier.toFixed(1)}×`;
}

function SurfaceLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.2em]",
        className,
      )}
      style={{ color: brand.colors.warm[500] }}
    >
      {children}
    </span>
  );
}

function MapStyleScroller({
  mapStyle,
  onSelect,
}: {
  mapStyle: MapStyle;
  onSelect: (style: MapStyle) => void;
}) {
  const quickStyles = useMemo(
    () =>
      QUICK_STYLE_IDS.map((id) => MAP_STYLE_CONFIGS.find((config) => config.id === id)).filter(
        (config): config is (typeof MAP_STYLE_CONFIGS)[number] => Boolean(config),
      ),
    [],
  );

  return (
    <div className="flex min-w-0 items-center gap-2">
      <SurfaceLabel className="hidden shrink-0 lg:inline">Map Style</SurfaceLabel>
      <div className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max items-center gap-1.5 pr-1">
          {quickStyles.map((styleConfig) => {
            const active = mapStyle === styleConfig.id;
            const preview = MAP_STYLE_PREVIEWS[styleConfig.id as keyof typeof MAP_STYLE_PREVIEWS];

            return (
              <button
                key={styleConfig.id}
                type="button"
                aria-pressed={active}
                aria-label={`Use ${styleConfig.label} map style`}
                className="group shrink-0 rounded-2xl p-1 transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  backgroundColor: active ? `${brand.colors.primary[50]}` : "transparent",
                  boxShadow: active ? `inset 0 0 0 1px ${brand.colors.primary[200]}` : "none",
                }}
                onClick={() => onSelect(styleConfig.id)}
              >
                <div
                  className="relative h-8 w-12 overflow-hidden rounded-xl border"
                  style={{
                    background: preview.background,
                    borderColor: active ? brand.colors.primary[400] : brand.colors.warm[200],
                    boxShadow: active ? brand.shadows.sm : "none",
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `radial-gradient(circle at 18% 24%, ${preview.glow} 0%, transparent 42%)`,
                    }}
                  />
                  <div
                    className="absolute left-1 top-1 h-1.5 w-3.5 rounded-full"
                    style={{ backgroundColor: "rgba(255, 255, 255, 0.22)" }}
                  />
                  <div
                    className="absolute right-1.5 top-1.5 h-3 w-2 rounded-full border"
                    style={{ borderColor: "rgba(255, 255, 255, 0.22)" }}
                  />
                  <div
                    className="absolute left-[22%] top-[56%] h-[1.5px] w-[52%] -translate-y-1/2 rounded-full"
                    style={{ backgroundColor: preview.route }}
                  />
                  <div
                    className="absolute left-[20%] top-[56%] size-1.5 -translate-y-1/2 rounded-full"
                    style={{ backgroundColor: preview.pin }}
                  />
                  <div
                    className="absolute right-[18%] top-[56%] size-1.5 -translate-y-1/2 rounded-full"
                    style={{ backgroundColor: preview.route }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SpeedControl({
  speedMultiplier,
  onChange,
  compact = false,
}: {
  speedMultiplier: number;
  onChange: (value: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", compact ? "w-full" : "w-[190px]")}>
      <SurfaceLabel>{formatSpeed(speedMultiplier)}</SurfaceLabel>
      <Slider
        min={0.5}
        max={2}
        step={0.1}
        value={[speedMultiplier]}
        onValueChange={([value]) => {
          if (typeof value === "number") {
            onChange(value);
          }
        }}
      />
    </div>
  );
}

function AspectRatioChips({
  viewportRatio,
  onSelect,
  className,
}: {
  viewportRatio: AspectRatio;
  onSelect: (ratio: AspectRatio) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {QUICK_RATIO_OPTIONS.map((ratio) => {
        const active = viewportRatio === ratio;

        return (
          <button
            key={ratio}
            type="button"
            className="touch-target-mobile rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              color: active ? brand.colors.warm[50] : brand.colors.warm[700],
              backgroundColor: active ? brand.colors.primary[500] : "rgba(255, 251, 245, 0.72)",
              borderColor: active ? brand.colors.primary[500] : brand.colors.warm[300],
              boxShadow: active ? brand.shadows.sm : "none",
            }}
            onClick={() => onSelect(ratio)}
          >
            {ratio}
          </button>
        );
      })}
    </div>
  );
}

export default function QuickStyleBar() {
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const mapStyle = useProjectStore((s) => s.mapStyle);
  const setMapStyle = useProjectStore((s) => s.setMapStyle);
  const viewportRatio = useUIStore((s) => s.viewportRatio);
  const setViewportRatio = useUIStore((s) => s.setViewportRatio);
  const speedMultiplier = useUIStore((s) => s.speedMultiplier);
  const setSpeedMultiplier = useUIStore((s) => s.setSpeedMultiplier);

  const surfaceStyle = {
    backgroundColor: "rgba(255, 251, 245, 0.84)",
    borderColor: brand.colors.warm[200],
    boxShadow: brand.shadows.sm,
    backdropFilter: "blur(18px)",
  } satisfies CSSProperties;

  return (
    <>
      <div className="relative z-10 border-b px-3 py-2 md:px-4" style={surfaceStyle}>
        <div className="hidden h-10 items-center gap-4 md:grid md:grid-cols-[minmax(0,1.6fr)_190px_auto]">
          <MapStyleScroller mapStyle={mapStyle} onSelect={setMapStyle} />
          <SpeedControl
            speedMultiplier={speedMultiplier}
            onChange={setSpeedMultiplier}
          />
          <div className="flex items-center justify-end gap-2">
            <SurfaceLabel className="hidden lg:inline">Frame</SurfaceLabel>
            <AspectRatioChips
              viewportRatio={viewportRatio}
              onSelect={setViewportRatio}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <AspectRatioChips
            viewportRatio={viewportRatio}
            onSelect={setViewportRatio}
            className="min-w-0 flex-1 justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="touch-target-mobile shrink-0 rounded-full"
            style={{
              backgroundColor: "rgba(255, 251, 245, 0.8)",
              borderColor: brand.colors.warm[300],
              color: brand.colors.warm[800],
              boxShadow: brand.shadows.sm,
            }}
            onClick={() => setMobileControlsOpen(true)}
          >
            <SlidersHorizontal className="size-3.5" />
            More
          </Button>
        </div>
      </div>

      <Dialog open={mobileControlsOpen} onOpenChange={setMobileControlsOpen}>
        <DialogContent
          className="top-auto bottom-0 left-0 right-0 max-w-none translate-x-0 translate-y-0 gap-5 rounded-t-[28px] rounded-b-none border-x-0 border-b-0 px-4 pb-6 pt-4 sm:max-w-none"
          style={{
            backgroundColor: "rgba(255, 251, 245, 0.96)",
            borderColor: brand.colors.warm[200],
            boxShadow: brand.shadows.lg,
            backdropFilter: "blur(22px)",
          }}
        >
          <DialogHeader className="pr-10">
            <DialogTitle style={{ color: brand.colors.warm[900] }}>
              Quick controls
            </DialogTitle>
            <DialogDescription style={{ color: brand.colors.warm[600] }}>
              Switch map tone, adjust playback speed, and change output framing.
            </DialogDescription>
          </DialogHeader>

          <section className="space-y-2">
            <SurfaceLabel>Aspect Ratio</SurfaceLabel>
            <AspectRatioChips
              viewportRatio={viewportRatio}
              onSelect={setViewportRatio}
              className="flex-wrap"
            />
          </section>

          <section className="space-y-2">
            <SurfaceLabel>Animation Speed</SurfaceLabel>
            <SpeedControl
              speedMultiplier={speedMultiplier}
              onChange={setSpeedMultiplier}
              compact
            />
          </section>

          <section className="space-y-2">
            <SurfaceLabel>Map Style</SurfaceLabel>
            <MapStyleScroller mapStyle={mapStyle} onSelect={setMapStyle} />
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}
