"use client";

import type { RefObject } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUIStore } from "@/stores/uiStore";
import CitySearch, { type CitySearchHandle } from "./CitySearch";
import RouteList from "./RouteList";

interface LeftPanelProps {
  onLocationClick?: (index: number) => void;
  onEditLayout?: (locationId: string) => void;
  searchHintMessage?: string;
  onDismissSearchHint?: () => void;
  searchRef?: RefObject<CitySearchHandle | null>;
}

export default function LeftPanel({
  onLocationClick,
  onEditLayout,
  searchHintMessage,
  onDismissSearchHint,
  searchRef,
}: LeftPanelProps) {
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);

  if (!leftPanelOpen) return null;

  return (
    <div className="hidden md:flex h-full w-[360px] flex-col overflow-hidden border-r bg-background">
      <CitySearch
        ref={searchRef}
        hintMessage={searchHintMessage}
        onHintDismiss={onDismissSearchHint}
      />
      <ScrollArea className="flex-1 min-h-0">
        <RouteList
          onLocationClick={onLocationClick}
          onEditLayout={onEditLayout}
        />
      </ScrollArea>
    </div>
  );
}
