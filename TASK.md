# TASK.md — Server-side FFmpeg Video Encoding

## ⚠️ DO NOT MERGE THE PR. Create PR and stop. DO NOT MERGE.

## Goal
Replace client-side FFmpeg.wasm encoding with server-side native FFmpeg for 10-50x faster video export.

## Architecture
1. Client captures frames as JPEG blobs (existing logic, keep as-is)
2. Client uploads all frames to a new API route via fetch
3. Server writes frames to temp directory
4. Server runs native `ffmpeg` to encode MP4
5. Server returns MP4 file
6. Client offers download

## Implementation

### 1. New API Route: `src/app/api/encode-video/route.ts`
```typescript
POST /api/encode-video
Content-Type: multipart/form-data
Body: { fps: number, frames: File[] }
Response: MP4 binary (application/octet-stream)
```

- Receive all JPEG frames as multipart upload
- Write frames to a temp directory (`/tmp/trace-recap-{uuid}/`)
- Run: `ffmpeg -framerate {fps} -i frame%05d.jpg -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 output.mp4`
- Stream the output MP4 back as response
- Clean up temp directory after response

### 2. Update `VideoExporter.ts`
- After capturing all frames, instead of loading FFmpeg.wasm:
  - Create FormData with fps + all frame blobs
  - POST to `/api/encode-video`
  - Receive MP4 blob from response
- Remove all `@ffmpeg/ffmpeg` and `@ffmpeg/util` imports/usage
- Keep the frame capture logic exactly as-is

### 3. Update `ExportDialog.tsx`
- Update progress display to show "Uploading frames..." and "Encoding on server..."
- The encoding phase should show an indeterminate progress since server doesn't stream progress

### 4. Cleanup
- Remove `@ffmpeg/ffmpeg` and `@ffmpeg/util` from package.json dependencies
- Remove COOP/COEP headers from next.config.ts (no longer needed for SharedArrayBuffer)

## Branch
Create branch: `feat/server-ffmpeg`

## Verification
1. `npx tsc --noEmit` passes
2. `npm run build` passes
3. Import a trip, play, export video → MP4 downloads successfully
4. Encoding is significantly faster than client-side
