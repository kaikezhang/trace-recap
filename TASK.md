# TASK.md — Fix: Video Export "Cannot call close on a closed codec" Error

## ⚠️ DO NOT MERGE THE PR. Create PR and stop. DO NOT MERGE.

## Bug
When clicking "Start Export" in the Export Video dialog, the app crashes with:
```
Runtime InvalidStateError: Cannot call 'close' on a closed codec
```

The error happens at `encoder.close()` in `VideoExporter.ts`. No `[export]` console logs appear, meaning the code crashes before reaching the frame capture loop.

## Root Cause Analysis
The `VideoEncoder.configure()` call is failing silently — the encoder's `error` callback fires, setting the encoder state to "closed". Then when the code tries to call `encoder.close()`, it throws because the encoder is already closed.

The codec `avc1.640028` (H.264 High Profile) may not be supported. There is auto-detection code in `findSupportedCodec()` but the detected codec may not be correctly flowing to `encoder.configure()`.

## What to Do

1. **Read the entire `src/engine/VideoExporter.ts` file carefully**
2. **Trace the codec flow**: `findSupportedCodec()` → `detectedCodec` → `encoder.configure()`
3. **Find where the hardcoded `avc1.640028` might still be used** instead of the detected codec
4. **Verify `isConfigSupported` is called with actual canvas dimensions** (not just defaults)
5. **Add proper error handling**: wrap `encoder.configure()` in try/catch, log the codec being used, log any errors
6. **Test by running `npm run dev` and trying to export** — if VideoEncoder is not supported at all, show a clear error message instead of crashing

## Key Files
- `src/engine/VideoExporter.ts` — the export logic
- `src/components/editor/ExportDialog.tsx` — the UI that calls export

## Expected Fix
- `encoder.configure()` uses the auto-detected codec from `findSupportedCodec()`
- If no codec is supported, show user-friendly error
- If configure fails, catch the error gracefully — no "close on closed codec" crash
- All `encoder.close()` calls check `encoder.state !== "closed"` first
- Console logs show which codec is being used

## Branch
Create branch: `fix/video-export-codec`
