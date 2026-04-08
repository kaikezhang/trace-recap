import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 60, windowMs: 60_000, prefix: "geocode" });
  if (limited) return limited;
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");
  const lng = searchParams.get("lng");
  const lat = searchParams.get("lat");
  const language = searchParams.get("language"); // e.g. "zh-Hans", "es", "ja"

  if (!MAPBOX_TOKEN) {
    return NextResponse.json(
      { error: "Mapbox token not configured" },
      { status: 500 }
    );
  }

  let url: string;

  if (q) {
    // Forward geocoding
    url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      q
    )}.json?access_token=${MAPBOX_TOKEN}&types=place,locality,region,country&limit=5${language ? `&language=${language}` : ""}`;
  } else if (lng && lat) {
    // Reverse geocoding
    url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=place,locality,region,country&limit=1${language ? `&language=${language}` : ""}`;
  } else {
    return NextResponse.json(
      { error: "Provide either q (query) or lng+lat parameters" },
      { status: 400 }
    );
  }

  const response = await fetch(url);
  const data = await response.json();
  return NextResponse.json(data);
}
