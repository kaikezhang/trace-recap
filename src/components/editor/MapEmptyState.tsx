"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brand } from "@/lib/brand";
import { useProjectStore, type ImportRouteData } from "@/stores/projectStore";

interface MapEmptyStateProps {
  onSearchClick: () => void;
  onLoadDemo: () => void;
}

function MapSketch() {
  return (
    <svg
      viewBox="0 0 320 220"
      className="h-auto w-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M42 48L111 31L189 50L269 31V172L189 189L111 170L42 189V48Z"
        fill="rgba(255,255,255,0.72)"
        stroke={brand.colors.warm[300]}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M111 31V170"
        stroke={brand.colors.warm[300]}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="8 8"
      />
      <path
        d="M189 50V189"
        stroke={brand.colors.warm[300]}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="8 8"
      />
      <path
        d="M79 136C102 121 132 126 153 112C176 97 196 83 228 92"
        stroke={brand.colors.primary[500]}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M80 134C94 110 125 89 164 94C191 97 218 116 238 102"
        stroke={brand.colors.ocean[500]}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="5 8"
      />
      <circle cx="81" cy="136" r="8" fill={brand.colors.sand[400]} />
      <circle cx="153" cy="112" r="8" fill={brand.colors.primary[400]} />
      <circle cx="228" cy="92" r="8" fill={brand.colors.ocean[500]} />
      <g transform="translate(220 125)">
        <circle
          cx="34"
          cy="34"
          r="28"
          fill="rgba(255,251,245,0.94)"
          stroke={brand.colors.warm[300]}
          strokeWidth="3"
        />
        <path
          d="M34 14L41 34L34 54L27 34L34 14Z"
          fill={brand.colors.primary[500]}
          stroke={brand.colors.primary[700]}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M14 34L34 27L54 34L34 41L14 34Z"
          fill={brand.colors.ocean[100]}
          stroke={brand.colors.ocean[600]}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <text
          x="34"
          y="8"
          textAnchor="middle"
          fill={brand.colors.warm[600]}
          fontSize="12"
          fontWeight="700"
        >
          N
        </text>
      </g>
      <path
        d="M77 70C84 64 93 64 99 70"
        stroke={brand.colors.sand[500]}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M131 154C141 146 156 146 165 154"
        stroke={brand.colors.primary[300]}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function MapEmptyState({
  onSearchClick,
  onLoadDemo,
}: MapEmptyStateProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadRouteData = useProjectStore((s) => s.loadRouteData);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.name.endsWith(".zip")) {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(file);
        const routeFile = zip.file("route.json");
        if (!routeFile) throw new Error("No route.json in zip");
        const routeText = await routeFile.async("text");
        const data: ImportRouteData = JSON.parse(routeText);

        if (data.locations) {
          for (const loc of data.locations) {
            if (loc.photos) {
              for (const photo of loc.photos) {
                if (photo.url.startsWith("photos/")) {
                  const photoFile = zip.file(photo.url);
                  if (photoFile) {
                    const blob = await photoFile.async("blob");
                    const dataUrl = await new Promise<string>((resolve) => {
                      const reader = new FileReader();
                      reader.onloadend = () => resolve(reader.result as string);
                      reader.readAsDataURL(blob);
                    });
                    photo.url = dataUrl;
                  }
                }
              }
            }
          }
        }

        await loadRouteData(data);
      } else {
        const text = await file.text();
        const data: ImportRouteData = JSON.parse(text);
        await loadRouteData(data);
      }
    } catch (error) {
      console.error("Failed to import route file.", error);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-auto relative w-full max-w-xl overflow-hidden rounded-[32px] border p-6 sm:p-8"
        style={{
          background: `linear-gradient(160deg, rgba(255,251,245,0.97) 0%, rgba(255,247,237,0.94) 100%)`,
          borderColor: brand.colors.warm[200],
          boxShadow: brand.shadows.xl,
        }}
      >
        <div
          className="absolute -left-10 top-4 h-28 w-28 rounded-full"
          style={{ backgroundColor: "rgba(249,115,22,0.08)" }}
        />
        <div
          className="absolute -right-8 bottom-0 h-32 w-32 rounded-full"
          style={{ backgroundColor: "rgba(20,184,166,0.08)" }}
        />

        <div className="relative">
          <div
            className="inline-flex rounded-full px-3 py-1 text-xs font-medium"
            style={{
              backgroundColor: brand.colors.primary[100],
              color: brand.colors.primary[700],
            }}
          >
            Journey starts here
          </div>

          <div className="mx-auto mt-5 max-w-[320px]">
            <MapSketch />
          </div>

          <div className="mt-6 text-center">
            <h2
              className="text-[32px] font-semibold leading-tight"
              style={{
                color: brand.colors.warm[900],
                fontFamily: brand.fonts.display,
              }}
            >
              Ready to map your adventure?
            </h2>
            <p
              className="mx-auto mt-3 max-w-md text-sm leading-6"
              style={{ color: brand.colors.warm[500] }}
            >
              Search for a city above to start plotting your route
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                className="h-11 rounded-2xl border-0 text-white"
                style={{
                  backgroundColor: brand.colors.primary[500],
                  boxShadow: brand.shadows.md,
                }}
                onClick={onSearchClick}
              >
                <Search className="mr-2 h-4 w-4" />
                Search Cities
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-2xl"
                style={{
                  borderColor: brand.colors.ocean[200],
                  color: brand.colors.ocean[700],
                  backgroundColor: "rgba(255,255,255,0.72)",
                }}
                onClick={onLoadDemo}
              >
                Load Demo Route
              </Button>
            </div>

            <Button
              variant="ghost"
              className="h-11 rounded-2xl"
              style={{
                color: brand.colors.warm[600],
                backgroundColor: "rgba(255,255,255,0.52)",
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Saved Route
            </Button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.zip"
          className="hidden"
          onChange={handleImport}
        />
      </motion.div>
    </div>
  );
}
