"use client";

import { MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MapEmptyStateProps {
  onSearchClick: () => void;
  onLoadDemo: () => void;
}

export default function MapEmptyState({
  onSearchClick,
  onLoadDemo,
}: MapEmptyStateProps) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
      <div className="bg-background/80 backdrop-blur-sm rounded-2xl border shadow-lg p-8 max-w-sm w-full mx-4 flex flex-col items-center gap-4 pointer-events-auto">
        <div className="w-20 h-20 rounded-2xl bg-white shadow-xl flex items-center justify-center">
          <MapPin className="h-10 w-10 text-indigo-500" />
        </div>
        <p className="text-base font-medium text-muted-foreground text-center">
          Start by searching for a city
        </p>
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
      </div>
    </div>
  );
}
