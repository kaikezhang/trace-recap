"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectStore } from "@/stores/projectStore";
import type { MapStyle } from "@/types";

const STYLES: { value: MapStyle; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "satellite", label: "Satellite" },
];

export default function MapStyleSelector() {
  const mapStyle = useProjectStore((s) => s.mapStyle);
  const setMapStyle = useProjectStore((s) => s.setMapStyle);

  return (
    <Select value={mapStyle} onValueChange={(v) => v && setMapStyle(v as MapStyle)}>
      <SelectTrigger className="w-[100px] md:w-[130px] h-7 md:h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STYLES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
