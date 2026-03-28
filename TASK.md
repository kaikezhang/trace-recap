# TASK.md — Replace WebCodecs with Server-side FFmpeg

## ⚠️ DO NOT MERGE THE PR. Create PR and stop. DO NOT MERGE.

## Problem
WebCodecs video encoding is unreliable — codec detection passes but encoder.configure() silently fails on many Chrome setups. The error "Cannot call close on a closed codec" keeps happening.

## Solution
Replace WebCodecs with server-side native FFmpeg encoding. Client captures frames, uploads to server, server encodes with ffmpeg, returns MP4.

## Implementation

### 1. `src/engine/VideoExporter.ts` — Rewrite
Remove all WebCodecs/VideoEncoder/mp4-muxer code. New flow:
- Capture frames as before (canvas.toBlob → JPEG)
- Collect all frame blobs in array
- POST to `/api/encode-video` with FormData containing all frames + fps
- Receive MP4 blob from response
- Return blob for download

Progress phases: "capturing" (frame capture), "uploading" (sending to server), "encoding" (server processing), "done"

### 2. `src/app/api/encode-video/route.ts` — New API Route
- Accept POST with multipart FormData: `fps` field + `frame_NNNNN` files
- Write frames to temp dir: `/tmp/trace-recap-{uuid}/frame00001.jpg` etc.
- Run: `ffmpeg -framerate {fps} -i frame%05d.jpg -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 output.mp4`
- Read output.mp4, return as response with Content-Type: video/mp4
- Clean up temp dir

### 3. Cleanup
- `npm uninstall mp4-muxer`
- Remove any WebCodecs feature detection code
- Remove the browser compatibility warning from ExportDialog
- Keep ExportDialog simple — just show progress phases

### 4. `next.config.ts`
Add `serverExternalPackages` if needed. No COOP/COEP headers needed.

### 5. ExportDialog.tsx
- Remove isSupported/exportSupported checks
- Remove browser warning
- Update progress display for new phases: capturing → uploading → encoding → done
- Start Export button always enabled (server-side encoding works everywhere)

## Branch
Create branch: `feat/server-ffmpeg-v2`
