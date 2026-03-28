import { NextResponse } from "next/server";
import { writeFile, stat } from "fs/promises";
import path from "path";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const sessionId = formData.get("sessionId");
    const frameIndex = formData.get("frameIndex");
    const frame = formData.get("frame");

    if (
      !sessionId ||
      typeof sessionId !== "string" ||
      !frameIndex ||
      typeof frameIndex !== "string" ||
      !frame ||
      !(frame instanceof File)
    ) {
      return NextResponse.json(
        { error: "Missing sessionId, frameIndex, or frame" },
        { status: 400 }
      );
    }

    // Validate sessionId is a UUID to prevent path traversal
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        sessionId
      )
    ) {
      return NextResponse.json(
        { error: "Invalid sessionId" },
        { status: 400 }
      );
    }

    const tmpDir = path.join("/tmp", `trace-recap-${sessionId}`);

    // Verify session directory exists
    try {
      await stat(tmpDir);
    } catch {
      return NextResponse.json(
        { error: "Session not found. Call /api/encode-video/start first." },
        { status: 404 }
      );
    }

    const padded = String(parseInt(frameIndex)).padStart(5, "0");
    const framePath = path.join(tmpDir, `frame${padded}.jpg`);
    const buffer = Buffer.from(await frame.arrayBuffer());
    await writeFile(framePath, buffer);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[encode-video/frame] error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to write frame";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
