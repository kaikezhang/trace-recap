import type { ImportRouteData } from "@/stores/projectStore";

export const demoProject: ImportRouteData = {
  name: "Pacific Rim Adventure",
  mapStyle: "light",
  locations: [
    {
      name: "Seattle",
      nameZh: "西雅图",
      coordinates: [-122.3321, 47.6062],
    },
    {
      name: "Honolulu",
      nameZh: "檀香山",
      coordinates: [-157.8583, 21.3069],
    },
    {
      name: "Tokyo",
      nameZh: "东京",
      coordinates: [139.6917, 35.6895],
    },
    {
      name: "Taoyuan",
      nameZh: "桃园",
      coordinates: [121.2168, 24.9936],
    },
    {
      name: "Taipei",
      nameZh: "台北",
      coordinates: [121.5654, 25.033],
    },
    {
      name: "Tainan",
      nameZh: "台南",
      coordinates: [120.227, 22.9998],
    },
    {
      name: "Chiayi",
      nameZh: "嘉义",
      coordinates: [120.4491, 23.48],
    },
    {
      name: "Alishan",
      nameZh: "阿里山",
      coordinates: [120.7, 23.51],
    },
    {
      name: "Chiayi",
      nameZh: "嘉义",
      coordinates: [120.4491, 23.48],
    },
    {
      name: "Taoyuan",
      nameZh: "桃园",
      coordinates: [121.2168, 24.9936],
    },
    {
      name: "Seoul",
      nameZh: "首尔",
      coordinates: [126.978, 37.5665],
    },
    {
      name: "Seattle",
      nameZh: "西雅图",
      coordinates: [-122.3321, 47.6062],
    },
  ],
  segments: [
    { fromIndex: 0, toIndex: 1, transportMode: "flight" },   // Seattle → Honolulu
    { fromIndex: 1, toIndex: 2, transportMode: "flight" },   // Honolulu → Tokyo
    { fromIndex: 2, toIndex: 3, transportMode: "flight" },   // Tokyo → Taoyuan
    { fromIndex: 3, toIndex: 4, transportMode: "train" },    // Taoyuan → Taipei
    { fromIndex: 4, toIndex: 5, transportMode: "train" },    // Taipei → Tainan
    { fromIndex: 5, toIndex: 6, transportMode: "train" },    // Tainan → Chiayi
    { fromIndex: 6, toIndex: 7, transportMode: "train" },    // Chiayi → Alishan
    { fromIndex: 7, toIndex: 8, transportMode: "car" },      // Alishan → Chiayi
    { fromIndex: 8, toIndex: 9, transportMode: "train" },    // Chiayi → Taoyuan
    { fromIndex: 9, toIndex: 10, transportMode: "flight" },  // Taoyuan → Seoul (transit)
    { fromIndex: 10, toIndex: 11, transportMode: "flight" }, // Seoul → Seattle
  ],
};
