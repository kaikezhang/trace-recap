import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const FFMPEG_PATH = "/usr/bin/ffmpeg";

export async function POST(request: NextRequest) {
  const tmpDir = join("/tmp", `trace-recap-${randomUUID()}`);

  try {
    const formData = await request.formData();
    const fps = formData.get("fps");

    if (!fps || typeof fps !== "string") {
      return NextResponse.json({ error: "Missing fps" }, { status: 400 });
    }

    const fpsNum = parseInt(fps, 10);
    if (isNaN(fpsNum) || fpsNum < 1 || fpsNum > 120) {
      return NextResponse.json({ error: "Invalid fps" }, { status: 400 });
    }

    const frames = formData.getAll("frames");
    if (frames.length === 0) {
      return NextResponse.json({ error: "No frames provided" }, { status: 400 });
    }

    // Write frames to temp directory
    await mkdir(tmpDir, { recursive: true });

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      if (!(frame instanceof File)) continue;
      const buffer = Buffer.from(await frame.arrayBuffer());
      const name = `frame${String(i).padStart(5, "0")}.jpg`;
      await writeFile(join(tmpDir, name), buffer);
    }

    // Run ffmpeg
    const outputPath = join(tmpDir, "output.mp4");

    await new Promise<void>((resolve, reject) => {
      execFile(
        FFMPEG_PATH,
        [
          "-framerate", String(fpsNum),
          "-i", join(tmpDir, "frame%05d.jpg"),
          "-c:v", "libx264",
          "-pix_fmt", "yuv420p",
          "-preset", "fast",
          "-crf", "23",
          outputPath,
        ],
        { timeout: 300_000 },
        (error, _stdout, stderr) => {
          if (error) {
            console.error("FFmpeg stderr:", stderr);
            reject(error);
          } else {
            resolve();
          }
        }
      );
    });

    const mp4Buffer = await readFile(outputPath);

    // Clean up in background
    rm(tmpDir, { recursive: true, force: true }).catch(() => {});

    return new NextResponse(mp4Buffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="trace-recap.mp4"',
      },
    });
  } catch (error) {
    // Clean up on error
    rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    console.error("Encode error:", error);
    return NextResponse.json(
      { error: "Video encoding failed" },
      { status: 500 }
    );
  }
}
