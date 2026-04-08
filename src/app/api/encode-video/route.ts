import { NextRequest, NextResponse } from "next/server";
import { readFile, rm, readdir, stat } from "fs/promises";
import { execFile, type ChildProcess } from "child_process";
import path from "path";
import { rateLimit } from "@/lib/rateLimit";

export const maxDuration = 300; // 5 minutes for long videos

const FFMPEG_PATH = "ffmpeg"; // uses PATH, works on Mac (homebrew) and Linux

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimit(request, { maxRequests: 5, windowMs: 60_000, prefix: "encode-video" });
  if (limited) return limited;
  let tmpDir = "";
  let ffmpegProcess: ChildProcess | null = null;

  try {
    const body = (await request.json()) as {
      sessionId?: string;
      fps?: string;
    };
    const { sessionId, fps } = body;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    if (!fps || typeof fps !== "string") {
      return NextResponse.json({ error: "Missing fps" }, { status: 400 });
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

    tmpDir = path.join("/tmp", `trace-recap-${sessionId}`);

    // Verify session directory exists and has frames
    try {
      await stat(tmpDir);
    } catch {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const files = await readdir(tmpDir);
    const frameFiles = files.filter(
      (f) => f.startsWith("frame") && f.endsWith(".jpg")
    );

    if (frameFiles.length === 0) {
      return NextResponse.json(
        { error: "No frames found in session" },
        { status: 400 }
      );
    }

    // Kill ffmpeg if the client disconnects
    request.signal.addEventListener("abort", () => {
      if (ffmpegProcess) {
        ffmpegProcess.kill("SIGTERM");
        console.log("[encode-video] Client disconnected, killed ffmpeg");
      }
    });

    const outputPath = path.join(tmpDir, "output.mp4");
    const inputPattern = path.join(tmpDir, "frame%05d.jpg");

    ffmpegProcess = await runFFmpeg(
      [
        "-framerate",
        fps,
        "-i",
        inputPattern,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-preset",
        "fast",
        "-crf",
        "23",
        outputPath,
      ],
      request.signal
    );
    ffmpegProcess = null;

    // Check if request was aborted during encoding
    if (request.signal.aborted) {
      return NextResponse.json(
        { error: "Export cancelled" },
        { status: 499 }
      );
    }

    const mp4Buffer = await readFile(outputPath);

    return new NextResponse(mp4Buffer, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="trace-recap.mp4"',
      },
    });
  } catch (error) {
    if (request.signal.aborted) {
      return NextResponse.json(
        { error: "Export cancelled" },
        { status: 499 }
      );
    }
    console.error("[encode-video] error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown encoding error";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // Clean up temp directory
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

function runFFmpeg(
  args: string[],
  signal: AbortSignal
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const proc = execFile(FFMPEG_PATH, args, (error, _stdout, stderr) => {
      if (signal.aborted) {
        reject(new Error("Export cancelled"));
        return;
      }
      if (error) {
        console.error("[ffmpeg] stderr:", stderr);
        reject(new Error(`FFmpeg failed: ${stderr || error.message}`));
        return;
      }
      resolve(proc);
    });

    signal.addEventListener("abort", () => {
      proc.kill("SIGTERM");
    });
  });
}
