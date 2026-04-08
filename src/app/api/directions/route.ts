import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, { maxRequests: 30, windowMs: 60_000, prefix: "directions" });
  if (limited) return limited;
  const { searchParams } = request.nextUrl;
  const profile = searchParams.get("profile") || "driving";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!MAPBOX_TOKEN) {
    return NextResponse.json(
      { error: "Mapbox token not configured" },
      { status: 500 }
    );
  }

  if (!from || !to) {
    return NextResponse.json(
      { error: "Provide from and to as lng,lat" },
      { status: 400 }
    );
  }

  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${from};${to}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full`;

  const response = await fetch(url);
  const data = await response.json();

  if (!data.routes || data.routes.length === 0) {
    return NextResponse.json(
      { error: "No route found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    geometry: data.routes[0].geometry,
    distance: data.routes[0].distance,
    duration: data.routes[0].duration,
  });
}
