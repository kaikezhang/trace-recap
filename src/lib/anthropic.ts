import Anthropic from "@anthropic-ai/sdk";
import type { TransportMode } from "@/types";

const client = new Anthropic();

interface GeneratedRoute {
  locations: { name: string; coordinates: [number, number] }[];
  segments: {
    fromIndex: number;
    toIndex: number;
    transportMode: TransportMode;
  }[];
}

const VALID_MODES = new Set<string>([
  "flight",
  "car",
  "train",
  "bus",
  "ferry",
  "walk",
  "bicycle",
]);

const SYSTEM_PROMPT = `You are a travel route generator. Given a natural language description of a trip, output a JSON object with the travel route.

Output format:
{
  "locations": [
    { "name": "City Name", "coordinates": [longitude, latitude] }
  ],
  "segments": [
    { "fromIndex": 0, "toIndex": 1, "transportMode": "flight" }
  ]
}

Rules:
- Use real, accurate city coordinates (longitude first, then latitude)
- Transport modes: flight, car, train, bus, ferry, walk, bicycle
- Choose sensible transport modes based on distance and context
- Order cities in logical travel sequence
- Return ONLY the JSON object, no other text

Example input: "I flew from New York to London, then took the train to Paris"
Example output:
{
  "locations": [
    { "name": "New York", "coordinates": [-74.006, 40.7128] },
    { "name": "London", "coordinates": [-0.1276, 51.5074] },
    { "name": "Paris", "coordinates": [2.3522, 48.8566] }
  ],
  "segments": [
    { "fromIndex": 0, "toIndex": 1, "transportMode": "flight" },
    { "fromIndex": 1, "toIndex": 2, "transportMode": "train" }
  ]
}`;

export async function generateRoute(
  description: string
): Promise<GeneratedRoute> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: description }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No valid JSON in response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as GeneratedRoute;

  // Validate
  if (!Array.isArray(parsed.locations) || parsed.locations.length < 2) {
    throw new Error("Route must have at least 2 locations");
  }

  for (const loc of parsed.locations) {
    const [lng, lat] = loc.coordinates;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new Error(`Invalid coordinates for ${loc.name}`);
    }
  }

  for (const seg of parsed.segments) {
    if (!VALID_MODES.has(seg.transportMode)) {
      seg.transportMode = "flight";
    }
  }

  return parsed;
}
