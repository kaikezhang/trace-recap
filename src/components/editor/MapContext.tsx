"use client";

import { createContext, useContext, useRef, useState, useCallback } from "react";
import type mapboxgl from "mapbox-gl";

interface MapContextValue {
  map: mapboxgl.Map | null;
  setMap: (map: mapboxgl.Map) => void;
}

const MapContext = createContext<MapContextValue>({
  map: null,
  setMap: () => {},
});

export function MapProvider({ children }: { children: React.ReactNode }) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [, setVersion] = useState(0);

  const setMap = useCallback((map: mapboxgl.Map) => {
    mapRef.current = map;
    setVersion((v) => v + 1);
  }, []);

  return (
    <MapContext.Provider value={{ map: mapRef.current, setMap }}>
      {children}
    </MapContext.Provider>
  );
}

export function useMap() {
  return useContext(MapContext);
}
