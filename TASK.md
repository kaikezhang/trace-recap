# TASK.md — WebCodecs Video Encoding (Replace FFmpeg.wasm)

## ⚠️ DO NOT MERGE THE PR. Create PR and stop. DO NOT MERGE.

## Goal
Replace FFmpeg.wasm with the browser-native WebCodecs API for GPU-accelerated video encoding. Much faster, no WASM download, no SharedArrayBuffer/COOP/COEP requirements.

## How WebCodecs Video Encoding Works

```
For each frame:
  1. Draw frame to canvas (existing logic)
  2. Create VideoFrame from canvas
  3. Feed VideoFrame to VideoEncoder
  4. VideoEncoder outputs EncodedVideoChunk

After all frames:
  5. Mux all EncodedVideoChunks into MP4 using mp4-muxer library
  6. Download the MP4
```

## Implementation

### 1. Install mp4-muxer
```bash
npm install mp4-muxer
```
This small library (~15KB) handles MP4 container muxing. WebCodecs only encodes raw H.264 chunks — we need a muxer to wrap them in an MP4 container.

### 2. Rewrite `VideoExporter.ts`
Replace FFmpeg.wasm with WebCodecs:

```typescript
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

export class VideoExporter {
  async export(onProgress): Promise<Blob | null> {
    const { fps, resolution } = this.settings;
    const totalDuration = this.engine.getTotalDuration();
    const totalFrames = Math.ceil(totalDuration * fps);

    // Get canvas dimensions
    const canvas = this.map.getCanvas();
    const width = canvas.width;
    const height = canvas.height;

    // Setup MP4 muxer
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: "avc",  // H.264
        width,
        height,
      },
      fastStart: "in-memory",
    });

    // Setup VideoEncoder
    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta);
      },
      error: (e) => console.error("Encoder error:", e),
    });

    await encoder.configure({
      codec: "avc1.640028", // H.264 High Profile Level 4.0
      width,
      height,
      bitrate: 5_000_000, // 5 Mbps
      framerate: fps,
    });

    // Pre-warm tiles
    for (let i = 0; i <= 5; i++) {
      this.engine.renderFrame((i / 5) * totalDuration);
      await this.waitForMapIdle();
    }

    // Capture and encode frames
    for (let i = 0; i < totalFrames; i++) {
      if (this.cancelled) { encoder.close(); return null; }

      const time = i / fps;
      this.engine.seekTo(Math.min(time / totalDuration, 1));
      await this.waitForMapIdle();

      // Create VideoFrame directly from canvas
      const frame = new VideoFrame(canvas, {
        timestamp: i * (1_000_000 / fps), // microseconds
      });

      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 }); // keyframe every 2s
      frame.close();

      onProgress({ phase: "capturing", current: i + 1, total: totalFrames });
    }

    // Flush encoder
    await encoder.flush();
    encoder.close();
    muxer.finalize();

    const buffer = muxer.target.buffer;
    onProgress({ phase: "done", current: 1, total: 1 });

    return new Blob([buffer], { type: "video/mp4" });
  }
}
```

### 3. Remove FFmpeg dependencies
- `npm uninstall @ffmpeg/ffmpeg @ffmpeg/util`
- Remove COOP/COEP headers from next.config.ts (no longer needed)
- Remove the `isDev` variable if no longer used

### 4. Update ExportDialog.tsx
- Remove "encoding" phase from progress display (encoding happens in real-time during capture)
- Just show "Capturing & encoding frames..." with frame count progress

### 5. Feature detection
Add a check at the top of export:
```typescript
if (typeof VideoEncoder === "undefined") {
  // Show error: "Your browser doesn't support video encoding. Please use Chrome or Edge."
  return null;
}
```

## Browser Support
- ✅ Chrome 94+ (Sept 2021)
- ✅ Edge 94+
- ✅ Opera 80+
- ❌ Firefox (behind flag)
- ❌ Safari (partial, unreliable)

## Branch
Create branch: `feat/webcodecs-export`
