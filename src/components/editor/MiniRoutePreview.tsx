"use client";

import { useEffect, useMemo, useState } from "react";
import { brand } from "@/lib/brand";
import type { Location, Segment, TransportMode } from "@/types";

interface MiniRoutePreviewProps {
  locations: Location[];
  segments: Segment[];
  className?: string;
}

interface ProjectedPoint {
  id: string;
  name: string;
  isWaypoint: boolean;
  x: number;
  y: number;
  accent: string;
}

interface RouteSegment {
  key: string;
  from: ProjectedPoint;
  to: ProjectedPoint;
  color: string;
}

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 80;
const INNER_PADDING_X = 16;
const INNER_PADDING_Y = 12;
const MIN_LONGITUDE_SPAN = 0.18;
const MIN_MERCATOR_SPAN = 0.12;
const STATIC_IMAGE_WIDTH = 280;
const STATIC_IMAGE_HEIGHT = 80;
const MAPBOX_STYLE = "mapbox/navigation-day-v1";
const MAPBOX_MARKER_COLOR = "f97316";
const MAPBOX_PATH_COLOR = "f97316";
const MAPBOX_PATH_OPACITY = "0.82";
const MAPBOX_PATH_WIDTH = 3;
const MAPBOX_PADDING = 20;

const MODE_COLORS: Record<TransportMode, string> = {
  flight: brand.colors.primary[500],
  car: brand.colors.sand[500],
  train: brand.colors.ocean[500],
  bus: "#8b5cf6",
  ferry: "#0891b2",
  walk: "#ec4899",
  bicycle: "#14b8a6",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function mercatorY(latitude: number): number {
  const clampedLatitude = clamp(latitude, -85, 85);
  const radians = (clampedLatitude * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

function truncateLabel(label: string): string {
  if (label.length <= 16) return label;
  return `${label.slice(0, 15)}…`;
}

function getLocationAccent(locationId: string, segments: Segment[]): string {
  const outgoing = segments.find((segment) => segment.fromId === locationId);
  if (outgoing) return MODE_COLORS[outgoing.transportMode];

  const incoming = [...segments].reverse().find((segment) => segment.toId === locationId);
  if (incoming) return MODE_COLORS[incoming.transportMode];

  return brand.colors.primary[400];
}

function buildStaticMapUrl(locations: Location[]): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token || locations.length < 2) return null;

  const pathCoords = locations
    .map((location) => `${location.coordinates[0]},${location.coordinates[1]}`)
    .join(",");

  if (!pathCoords) return null;

  const overlays = [
    `path-${MAPBOX_PATH_WIDTH}+${MAPBOX_PATH_COLOR}-${MAPBOX_PATH_OPACITY}(${pathCoords})`,
    ...locations
      .filter((location) => !location.isWaypoint)
      .map(
        (location) =>
          `pin-s+${MAPBOX_MARKER_COLOR}(${location.coordinates[0]},${location.coordinates[1]})`,
      ),
  ]
    .map((overlay) => encodeURIComponent(overlay))
    .join(",");

  return `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE}/static/${overlays}/auto/${STATIC_IMAGE_WIDTH}x${STATIC_IMAGE_HEIGHT}@2x?access_token=${encodeURIComponent(token)}&padding=${MAPBOX_PADDING}`;
}

function FallbackRouteSvg({
  hasRoute,
  preview,
}: {
  hasRoute: boolean;
  preview: {
    points: ProjectedPoint[];
    segments: RouteSegment[];
    labels: ProjectedPoint[];
  };
}) {
  return (
    <svg
      width="100%"
      height="80"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      role="img"
      aria-label="Trip route preview"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="mini-route-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop
            offset="0%"
            stopColor="rgba(255,251,245,0.96)"
          />
          <stop
            offset="100%"
            stopColor="rgba(255,247,237,0.82)"
          />
        </linearGradient>
      </defs>

      <rect
        x="0.5"
        y="0.5"
        width={VIEWBOX_WIDTH - 1}
        height={VIEWBOX_HEIGHT - 1}
        rx="20"
        fill="url(#mini-route-bg)"
        stroke={brand.colors.ocean[200]}
      />

      {hasRoute ? (
        <>
          {preview.segments.map((segment) => (
            <line
              key={segment.key}
              x1={segment.from.x}
              y1={segment.from.y}
              x2={segment.to.x}
              y2={segment.to.y}
              stroke={segment.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {preview.points.map((point) =>
            point.isWaypoint ? (
              <circle
                key={point.id}
                cx={point.x}
                cy={point.y}
                r="3.5"
                fill="rgba(255,255,255,0.9)"
                stroke={point.accent}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <circle
                key={point.id}
                cx={point.x}
                cy={point.y}
                r="6"
                fill={point.accent}
                stroke="rgba(255,255,255,0.96)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            ),
          )}

          {preview.labels.map((label, index) => {
            const placeAbove = label.y > VIEWBOX_HEIGHT / 2;
            const anchor = label.x > VIEWBOX_WIDTH - 72 ? "end" : "start";
            const dx = anchor === "end" ? -10 : 10;
            const dy = placeAbove ? -10 : 16;

            return (
              <text
                key={`${label.id}-${index}`}
                x={label.x + dx}
                y={label.y + dy}
                fill={brand.colors.warm[600]}
                fontFamily={brand.fonts.mono}
                fontSize="10"
                textAnchor={anchor}
              >
                {truncateLabel(label.name)}
              </text>
            );
          })}
        </>
      ) : (
        <text
          x="50%"
          y="50%"
          fill={brand.colors.warm[500]}
          fontFamily={brand.fonts.mono}
          fontSize="10"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          Add stops to sketch your route
        </text>
      )}
    </svg>
  );
}

export default function MiniRoutePreview({
  locations,
  segments,
  className,
}: MiniRoutePreviewProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const routeLocations = useMemo(
    () =>
      locations.filter(
        (location) =>
          Array.isArray(location.coordinates) &&
          location.coordinates.length === 2 &&
          Number.isFinite(location.coordinates[0]) &&
          Number.isFinite(location.coordinates[1]),
      ),
    [locations],
  );

  const staticMapUrl = useMemo(() => buildStaticMapUrl(routeLocations), [routeLocations]);

  useEffect(() => {
    setImageFailed(false);
  }, [staticMapUrl]);

  const preview = useMemo(() => {
    if (routeLocations.length < 2) {
      return {
        points: [] as ProjectedPoint[],
        segments: [] as RouteSegment[],
        labels: [] as ProjectedPoint[],
      };
    }

    const sourcePoints = routeLocations.map((location) => ({
      ...location,
      lng: location.coordinates[0],
      mercator: mercatorY(location.coordinates[1]),
    }));

    const longitudes = sourcePoints.map((point) => point.lng);
    const mercators = sourcePoints.map((point) => point.mercator);

    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const minMercator = Math.min(...mercators);
    const maxMercator = Math.max(...mercators);

    const rawLongitudeSpan = maxLng - minLng;
    const rawMercatorSpan = maxMercator - minMercator;

    const longitudePadding = Math.max(rawLongitudeSpan * 0.1, MIN_LONGITUDE_SPAN / 2);
    const mercatorPadding = Math.max(rawMercatorSpan * 0.1, MIN_MERCATOR_SPAN / 2);

    const paddedMinLng = minLng - longitudePadding;
    const paddedMaxLng = maxLng + longitudePadding;
    const paddedMinMercator = minMercator - mercatorPadding;
    const paddedMaxMercator = maxMercator + mercatorPadding;

    const longitudeSpan = Math.max(paddedMaxLng - paddedMinLng, MIN_LONGITUDE_SPAN);
    const mercatorSpan = Math.max(paddedMaxMercator - paddedMinMercator, MIN_MERCATOR_SPAN);

    const compactness = 1 - Math.min(
      1,
      Math.max(rawLongitudeSpan / MIN_LONGITUDE_SPAN, rawMercatorSpan / MIN_MERCATOR_SPAN),
    );

    const projectedPoints = sourcePoints.map((point, index) => {
      const baseX =
        INNER_PADDING_X +
        ((point.lng - paddedMinLng) / longitudeSpan) * (VIEWBOX_WIDTH - INNER_PADDING_X * 2);
      const baseY =
        INNER_PADDING_Y +
        (1 - (point.mercator - paddedMinMercator) / mercatorSpan) *
          (VIEWBOX_HEIGHT - INNER_PADDING_Y * 2);

      // When several stops are nearly co-located, introduce a gentle route-order spread.
      const routePosition = sourcePoints.length === 1 ? 0.5 : index / (sourcePoints.length - 1);
      const spreadX = (routePosition - 0.5) * 42 * compactness;
      const spreadY = Math.sin(routePosition * Math.PI) * 12 * compactness - 6 * compactness;

      return {
        id: point.id,
        name: point.name,
        isWaypoint: point.isWaypoint,
        x: clamp(baseX + spreadX, INNER_PADDING_X, VIEWBOX_WIDTH - INNER_PADDING_X),
        y: clamp(baseY + spreadY, INNER_PADDING_Y, VIEWBOX_HEIGHT - INNER_PADDING_Y),
        accent: getLocationAccent(point.id, segments),
      };
    });

    const pointById = new Map(projectedPoints.map((point) => [point.id, point]));
    const routeSegments = projectedPoints.slice(0, -1).flatMap((point, index) => {
      const nextPoint = projectedPoints[index + 1];
      if (!nextPoint) return [];

      const matchedSegment = segments.find(
        (segment) => segment.fromId === point.id && segment.toId === nextPoint.id,
      );

      return [
        {
          key: `${point.id}-${nextPoint.id}`,
          from: point,
          to: nextPoint,
          color: matchedSegment ? MODE_COLORS[matchedSegment.transportMode] : point.accent,
        },
      ];
    });

    const labels = routeLocations
      .filter((location) => !location.isWaypoint)
      .map((location) => pointById.get(location.id))
      .filter((point): point is ProjectedPoint => Boolean(point));

    return {
      points: projectedPoints,
      segments: routeSegments,
      labels: labels.length > 1 ? [labels[0], labels[labels.length - 1]] : labels,
    };
  }, [routeLocations, segments]);

  const hasRoute = preview.points.length > 1;
  const showStaticMap = hasRoute && staticMapUrl && !imageFailed;

  return (
    <div
      className={className}
      style={{
        borderRadius: 20,
        border: `1px solid ${brand.colors.ocean[200]}`,
        background:
          "linear-gradient(180deg, rgba(255,251,245,0.92) 0%, rgba(255,247,237,0.84) 100%)",
        boxShadow: brand.shadows.sm,
        overflow: "hidden",
      }}
    >
      {showStaticMap ? (
        <img
          src={staticMapUrl}
          alt="Trip route preview"
          loading="lazy"
          onError={() => setImageFailed(true)}
          style={{
            display: "block",
            width: "100%",
            height: STATIC_IMAGE_HEIGHT,
            objectFit: "cover",
          }}
        />
      ) : (
        <FallbackRouteSvg
          hasRoute={hasRoute}
          preview={preview}
        />
      )}
    </div>
  );
}
