import { NextResponse } from "next/server";
import { writeFile, mkdir, readFile, rm } from "fs/promises";
import { execFile } from "child_process";
import { randomUUID } from "crypto";
import path from "path";

export const maxDuration = 300; // 5 minutes for long videos

const FFMPEG_PATH = "/usr/bin/ffmpeg";

export async function POST(request: Request): Promise<NextResponse> {
  const tmpDir = path.join("/tmp", `trace-recap-${randomUUID()}`);

  try {
    const formData = await request.formData();
    const fps = formData.get("fps");

    if (!fps || typeof fps !== "string") {
      return NextResponse.json({ error: "Missing fps field" }, { status: 400 });
    }

    await mkdir(tmpDir, { recursive: true });

    // Write frame files to temp directory
    const entries = Array.from(formData.entries()).filter(([key]) =>
      key.startsWith("frame_")
    );

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No frames provided" },
        { status: 400 }
      );
    }

    // Sort by frame number to ensure correct order
    entries.sort(([a], [b]) => a.localeCompare(b));

    for (let i = 0; i < entries.length; i++) {
      const file = entries[i][1] as File;
      const frameNum = String(i + 1).padStart(5, "0");
      const framePath = path.join(tmpDir, `frame${frameNum}.jpg`);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(framePath, buffer);
    }

    // Run ffmpeg
    const outputPath = path.join(tmpDir, "output.mp4");
    const inputPattern = path.join(tmpDir, "frame%05d.jpg");

    await runFFmpeg([
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
    ]);

    const mp4Buffer = await readFile(outputPath);

    return new NextResponse(mp4Buffer, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="trace-recap.mp4"',
      },
    });
  } catch (error) {
    console.error("[encode-video] error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown encoding error";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // Clean up temp directory
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG_PATH, args, (error, _stdout, stderr) => {
      if (error) {
        console.error("[ffmpeg] stderr:", stderr);
        reject(new Error(`FFmpeg failed: ${stderr || error.message}`));
        return;
      }
      resolve();
    });
  });
}
