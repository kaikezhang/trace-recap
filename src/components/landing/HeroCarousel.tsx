"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { brand } from "@/lib/brand";

const slides = [
  {
    src: "/landing/hero.webp",
    alt: "TraceRecap editor — route on map with photo stops",
    width: 1280,
    height: 800,
  },
  {
    src: "/landing/playback.png",
    alt: "TraceRecap playback — animated flight route from Seoul to Seattle",
    width: 2188,
    height: 1234,
  },
  {
    src: "/landing/taiwan.png",
    alt: "TraceRecap playback — train route through Taiwan",
    width: 2188,
    height: 1234,
  },
];

const INTERVAL_MS = 4000;

export function HeroCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const next = useCallback(() => {
    setActive((i) => (i + 1) % slides.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, INTERVAL_MS);
    return () => clearInterval(id);
  }, [paused, next]);

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-2xl border"
      style={{
        borderColor: brand.colors.warm[200],
        boxShadow: `${brand.shadows.xl}, 0 0 80px rgba(249,115,22,0.06)`,
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      <div className="relative aspect-[16/9] w-full">
        {slides.map((slide, i) => (
          <div
            key={slide.src}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: i === active ? 1 : 0 }}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              width={slide.width}
              height={slide.height}
              className="h-full w-full object-cover"
              priority={i === 0}
            />
          </div>
        ))}
      </div>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className="h-2 w-2 rounded-full transition-all duration-300"
            style={{
              backgroundColor: i === active ? brand.colors.primary[500] : "rgba(255,255,255,0.6)",
              transform: i === active ? "scale(1.3)" : "scale(1)",
            }}
            aria-label={`Show slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
