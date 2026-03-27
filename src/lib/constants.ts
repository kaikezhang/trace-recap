import type { TransportMode, MapStyle } from "@/types";

export const PHASE_DURATIONS = {
  HOVER: 1.0,
  ARRIVE: 1.2,
  PHOTO_DISPLAY: 2.0,
} as const;

export const ZOOM_RANGE = {
  flyMin: 2,
  flyMax: 10,
  cityMin: 10,
  cityMax: 16,
} as const;

export const TARGET_DURATION = {
  min: 20,
  max: 30,
} as const;

export const FPS = 30;

export interface TransportModeConfig {
  id: TransportMode;
  label: string;
  directionsProfile: "driving" | "walking" | "cycling" | null;
}

export const TRANSPORT_MODES: TransportModeConfig[] = [
  { id: "flight", label: "Flight", directionsProfile: null },
  { id: "car", label: "Car", directionsProfile: "driving" },
  { id: "train", label: "Train", directionsProfile: "driving" },
  { id: "bus", label: "Bus", directionsProfile: "driving" },
  { id: "ferry", label: "Ferry", directionsProfile: null },
  { id: "walk", label: "Walk", directionsProfile: "walking" },
  { id: "bicycle", label: "Bicycle", directionsProfile: "cycling" },
];

export const MAP_STYLES: Record<MapStyle, string> = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

export const DEFAULT_MAP_CENTER: [number, number] = [0, 20];
export const DEFAULT_MAP_ZOOM = 2;
