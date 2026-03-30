"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectStore } from "@/stores/projectStore";
import { MAP_STYLE_CONFIGS } from "@/lib/constants";
import type { MapStyle } from "@/types";

export default function MapStyleSelector() {
  const mapStyle = useProjectStore((s) => s.mapStyle);
  const setMapStyle = useProjectStore((s) => s.setMapStyle);

  return (
    <Select value={mapStyle} onValueChange={(v) => v && setMapStyle(v as MapStyle)}>
      <SelectTrigger className="w-[100px] md:w-[130px] h-11 md:h-8 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MAP_STYLE_CONFIGS.map((cfg) => (
          <SelectItem key={cfg.id} value={cfg.id}>
            {cfg.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
