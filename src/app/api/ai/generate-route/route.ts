import { NextRequest, NextResponse } from "next/server";
import { generateRoute } from "@/lib/anthropic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description } = body;

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Please provide a trip description" },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Anthropic API key not configured" },
        { status: 500 }
      );
    }

    const route = await generateRoute(description);
    return NextResponse.json(route);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate route";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
