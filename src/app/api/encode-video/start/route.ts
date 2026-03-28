import { NextResponse } from "next/server";
import { mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";

export async function POST(): Promise<NextResponse> {
  const sessionId = randomUUID();
  const tmpDir = path.join("/tmp", `trace-recap-${sessionId}`);

  try {
    await mkdir(tmpDir, { recursive: true });
    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error("[encode-video/start] error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
