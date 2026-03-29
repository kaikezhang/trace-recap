import type { ImportRouteData } from "@/stores/projectStore";

export const demoProject: ImportRouteData = {
  name: "Taiwan Ring Tour",
  mapStyle: "light",
  locations: [
    {
      name: "Taipei",
      nameZh: "台北",
      coordinates: [121.5654, 25.033],
    },
    {
      name: "Taichung",
      nameZh: "台中",
      coordinates: [120.6736, 24.1477],
    },
    {
      name: "Tainan",
      nameZh: "台南",
      coordinates: [120.227, 22.9998],
    },
    {
      name: "Chiayi",
      nameZh: "嘉義",
      coordinates: [120.4491, 23.48],
    },
    {
      name: "Alishan",
      nameZh: "阿里山",
      coordinates: [120.7, 23.51],
    },
    {
      name: "Taipei",
      nameZh: "台北",
      coordinates: [121.5654, 25.033],
    },
  ],
  segments: [
    { fromIndex: 0, toIndex: 1, transportMode: "train" },
    { fromIndex: 1, toIndex: 2, transportMode: "train" },
    { fromIndex: 2, toIndex: 3, transportMode: "bus" },
    { fromIndex: 3, toIndex: 4, transportMode: "bus" },
    { fromIndex: 4, toIndex: 5, transportMode: "flight" },
  ],
};
