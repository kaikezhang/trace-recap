"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import CitySearch from "./CitySearch";
import RouteList from "./RouteList";

export default function LeftPanel() {
  return (
    <div className="flex h-full w-80 flex-col border-r bg-background">
      <div className="border-b px-3 py-2">
        <h2 className="text-sm font-semibold">Route</h2>
      </div>
      <CitySearch />
      <ScrollArea className="flex-1">
        <RouteList />
      </ScrollArea>
    </div>
  );
}
