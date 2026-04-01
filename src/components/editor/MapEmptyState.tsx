"use client";

import { useRef } from "react";
import { MapPin, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProjectStore, type ImportRouteData } from "@/stores/projectStore";

interface MapEmptyStateProps {
  onSearchClick: () => void;
  onLoadDemo: () => void;
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
                    // Convert to data URL immediately — blob URLs die on page reload
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
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
      <div className="bg-background/80 backdrop-blur-sm rounded-2xl border shadow-lg p-8 max-w-sm w-full mx-4 flex flex-col items-center gap-4 pointer-events-auto">
        <div className="w-20 h-20 rounded-2xl bg-white shadow-xl flex items-center justify-center">
          <MapPin className="h-10 w-10 text-indigo-500" />
        </div>
        <p className="text-base font-medium text-muted-foreground text-center">
          Start by searching for a city
        </p>
        <div className="flex flex-col gap-2 w-full">
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              className="flex-1 rounded-lg"
              onClick={onSearchClick}
            >
              <Search className="h-4 w-4 mr-1.5" />
              Search
            </Button>
            <Button
              className="flex-1 rounded-lg bg-indigo-500 hover:bg-indigo-600"
              onClick={onLoadDemo}
            >
              Load Demo
            </Button>
          </div>
          <Button
            variant="ghost"
            className="w-full rounded-lg text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-1.5" />
            Import Saved Route
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.zip"
          className="hidden"
          onChange={handleImport}
        />
      </div>
    </div>
  );
}
