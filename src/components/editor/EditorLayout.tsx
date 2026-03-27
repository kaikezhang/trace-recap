"use client";

import { MapProvider } from "./MapContext";
import TopToolbar from "./TopToolbar";
import LeftPanel from "./LeftPanel";
import MapCanvas from "./MapCanvas";

export default function EditorLayout() {
  return (
    <MapProvider>
      <div className="flex h-screen flex-col">
        <TopToolbar />
        <div className="flex flex-1 overflow-hidden">
          <LeftPanel />
          <div className="flex-1 relative">
            <MapCanvas />
          </div>
        </div>
      </div>
    </MapProvider>
  );
}
