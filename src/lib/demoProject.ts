import type { ImportRouteData } from "@/stores/projectStore";

export const demoProject: ImportRouteData = {
  name: "Pacific Rim Adventure",
  mapStyle: "light",
  locations: [
    {
      name: "Seattle",
      nameZh: "西雅图",
      coordinates: [-122.3321, 47.6062],
      photos: [
        { url: "/demo-photos/seattle-1.jpg", caption: "Seattle Skyline" },
        { url: "/demo-photos/seattle-2.jpg", caption: "Pike Place Market" },
      ],
    },
    {
      name: "Honolulu",
      nameZh: "檀香山",
      coordinates: [-157.8583, 21.3069],
      photos: [
        { url: "/demo-photos/honolulu-1.jpg", caption: "Waikiki Beach" },
        { url: "/demo-photos/honolulu-2.jpg", caption: "Diamond Head" },
      ],
    },
    {
      name: "Tokyo",
      nameZh: "东京",
      coordinates: [139.6917, 35.6895],
      photos: [
        { url: "/demo-photos/tokyo-1.jpg", caption: "Tokyo Tower" },
        { url: "/demo-photos/tokyo-2.jpg", caption: "Shibuya Crossing" },
        { url: "/demo-photos/tokyo-3.jpg", caption: "Senso-ji Temple" },
      ],
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
      photos: [
        { url: "/demo-photos/taipei-1.jpg", caption: "Taipei 101" },
        { url: "/demo-photos/taipei-2.jpg", caption: "Night Market" },
      ],
    },
    {
      name: "Tainan",
      nameZh: "台南",
      coordinates: [120.227, 22.9998],
      photos: [
        { url: "/demo-photos/tainan-1.jpg", caption: "Historic Temple" },
        { url: "/demo-photos/tainan-2.jpg", caption: "Old Street" },
      ],
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
      photos: [
        { url: "/demo-photos/alishan-1.jpg", caption: "Sunrise at Alishan" },
        { url: "/demo-photos/alishan-2.jpg", caption: "Forest Railway" },
      ],
    },
    {
      name: "Chiayi",
      nameZh: "嘉义",
      coordinates: [120.4491, 23.48],
      isWaypoint: true,
    },
    {
      name: "Taoyuan",
      nameZh: "桃园",
      coordinates: [121.2168, 24.9936],
      isWaypoint: true,
    },
    {
      name: "Seoul",
      nameZh: "首尔",
      coordinates: [126.978, 37.5665],
      isWaypoint: true,
    },
    {
      name: "Seattle",
      nameZh: "西雅图",
      coordinates: [-122.3321, 47.6062],
    },
  ],
  segments: [
    { fromIndex: 0, toIndex: 1, transportMode: "flight" },
    { fromIndex: 1, toIndex: 2, transportMode: "flight" },
    { fromIndex: 2, toIndex: 3, transportMode: "flight" },
    { fromIndex: 3, toIndex: 4, transportMode: "train" },
    { fromIndex: 4, toIndex: 5, transportMode: "train" },
    { fromIndex: 5, toIndex: 6, transportMode: "train" },
    { fromIndex: 6, toIndex: 7, transportMode: "train" },
    { fromIndex: 7, toIndex: 8, transportMode: "car" },
    { fromIndex: 8, toIndex: 9, transportMode: "train" },
    { fromIndex: 9, toIndex: 10, transportMode: "flight" },
    { fromIndex: 10, toIndex: 11, transportMode: "flight" },
  ],
};
