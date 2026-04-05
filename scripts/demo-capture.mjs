#!/usr/bin/env node

import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "public", "demo-video-9x16.webm");

const EDITOR_URL = "http://localhost:3005/editor";
const DEMO_URL = `${EDITOR_URL}?demo=true`;
const OUTPUT_FILENAME = "demo-video-9x16.webm";

const SETUP_VIEWPORT = { width: 1280, height: 874 };
const RECORDING_VIEWPORT = { width: 450, height: 874 };
const RECORDING_FPS = 30;
const RECORDING_TIMEOUT_MS = 70_000;

async function launchBrowser() {
  const launchOptions = {
    headless: false,
    args: [
      "--enable-webgl",
      "--enable-gpu-rasterization",
      "--ignore-gpu-blocklist",
      "--autoplay-policy=no-user-gesture-required",
      "--no-sandbox",
    ],
  };

  try {
    console.log("Launching Google Chrome...");
    return await chromium.launch({
      ...launchOptions,
      channel: "chrome",
    });
  } catch (error) {
    console.warn("Chrome channel launch failed, falling back to bundled Chromium.");
    console.warn(error instanceof Error ? error.message : String(error));
    return chromium.launch(launchOptions);
  }
}

async function openEditor(page) {
  console.log(`Opening editor at ${EDITOR_URL} ...`);
  await page.goto(EDITOR_URL, { waitUntil: "domcontentloaded" });
  await waitForEditorShell(page);
  await page.waitForTimeout(1_500);

  const hasProject = await page.evaluate(() => {
    return document.body.innerText.includes("Pacific Rim Adventure");
  });

  if (!hasProject) {
    console.log("Demo project was not already loaded. Falling back to ?demo=true.");
    await page.goto(DEMO_URL, { waitUntil: "domcontentloaded" });
    await waitForEditorShell(page);
  }
}

async function waitForEditorShell(page) {
  await page.waitForFunction(() => {
    return (
      document.readyState === "complete" ||
      document.querySelector('button[aria-label="Play"]') ||
      document.querySelector('button[aria-label="Pause"]')
    );
  });

  await page.locator(".mapboxgl-canvas").first().waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".mapboxgl-canvas");
    return (
      canvas instanceof HTMLCanvasElement &&
      canvas.clientWidth > 0 &&
      canvas.clientHeight > 0
    );
  });
}

async function stopAutoPlaybackIfNeeded(page) {
  if (page.url().includes("demo=true")) {
    await page.waitForTimeout(2_000);
  }

  const pauseButton = page.getByRole("button", { name: "Pause" });

  if (await pauseButton.isVisible().catch(() => false)) {
    console.log("Auto-play is active. Pausing it before capture setup.");
    await pauseButton.click();
  }

  const resetButton = page.getByRole("button", { name: "Reset playback" });
  if (await resetButton.isVisible().catch(() => false)) {
    console.log("Resetting playback to the beginning.");
    await resetButton.click();
  }
}

async function collapseSidebar(page) {
  const collapseButton = page.getByRole("button", { name: "Collapse sidebar" }).first();

  if (await collapseButton.isVisible().catch(() => false)) {
    console.log("Collapsing the desktop sidebar.");
    await collapseButton.click();
    await page.waitForTimeout(400);
    return;
  }

  console.log("No desktop sidebar toggle is visible in the current layout. Continuing.");
}

async function setAspectRatio(page) {
  console.log("Setting the editor frame to 9:16.");
  await page.getByRole("button", { name: "9:16", exact: true }).first().click();
  await page.waitForTimeout(400);
}

async function setSpeedToOneX(page) {
  console.log("Forcing playback speed to 1.0x.");
  const slider = page.locator('input[type="range"][aria-label="Slider"]').first();
  await slider.evaluate((input) => {
    input.value = "1";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => document.body.innerText.includes("1.0×"));
}

async function resizeForRecording(page) {
  console.log(`Switching to portrait recording viewport ${RECORDING_VIEWPORT.width}x${RECORDING_VIEWPORT.height}.`);
  await page.setViewportSize(RECORDING_VIEWPORT);
  await page.waitForTimeout(800);
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".mapboxgl-canvas");
    return (
      canvas instanceof HTMLCanvasElement &&
      canvas.clientWidth > 0 &&
      canvas.clientHeight > 0
    );
  });
}

async function startCanvasRecorder(page) {
  console.log("Starting MediaRecorder on the map canvas.");
  const result = await page.evaluate(
    ({ fps }) => {
      const canvas = document.querySelector(".mapboxgl-canvas");
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error("Could not find the map canvas.");
      }

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";

      const stream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      });

      recorder.start(250);

      window.__traceRecapCapture = {
        chunks,
        mimeType,
        recorder,
        tracks: stream.getTracks(),
      };

      return {
        mimeType,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
      };
    },
    { fps: RECORDING_FPS },
  );

  console.log(
    `Recording canvas at ${result.canvasWidth}x${result.canvasHeight} with ${result.mimeType}.`,
  );
}

async function stopCanvasRecorder(page) {
  console.log("Stopping MediaRecorder and saving the .webm file.");
  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });

  const metadataPromise = page.evaluate((filename) => {
    const state = window.__traceRecapCapture;
    if (!state) {
      throw new Error("Recorder state was not initialized.");
    }

    return new Promise((resolve, reject) => {
      const finalize = async () => {
        try {
          const blob = new Blob(state.chunks, { type: state.mimeType });
          state.tracks.forEach((track) => track.stop());

          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          link.style.display = "none";
          document.body.appendChild(link);
          link.click();
          link.remove();

          setTimeout(() => URL.revokeObjectURL(url), 1_000);
          window.__traceRecapCapture = null;

          resolve({
            mimeType: blob.type || state.mimeType,
            size: blob.size,
          });
        } catch (error) {
          reject(error);
        }
      };

      if (state.recorder.state === "inactive") {
        void finalize();
        return;
      }

      state.recorder.addEventListener(
        "stop",
        () => {
          void finalize();
        },
        { once: true },
      );

      state.recorder.addEventListener(
        "error",
        (event) => {
          reject(new Error(`MediaRecorder failed: ${event.error?.message ?? "unknown error"}`));
        },
        { once: true },
      );

      state.recorder.stop();
    });
  }, OUTPUT_FILENAME);

  const [download, metadata] = await Promise.all([downloadPromise, metadataPromise]);
  await download.saveAs(OUTPUT_PATH);

  console.log(`Saved ${metadata.mimeType} (${metadata.size} bytes) to ${OUTPUT_PATH}.`);
}

async function playAndWaitForCompletion(page) {
  console.log("Starting playback.");
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByRole("button", { name: "Pause" }).waitFor({ state: "visible" });

  console.log("Waiting for the 52-second animation to finish.");
  await page.waitForFunction(
    () => document.body.innerText.includes("0:52 / 0:52"),
    { timeout: RECORDING_TIMEOUT_MS },
  );

  await page.getByRole("button", { name: "Play" }).waitFor({ state: "visible" });
}

async function main() {
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await rm(OUTPUT_PATH, { force: true });

  const browser = await launchBrowser();
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: SETUP_VIEWPORT,
  });

  await context.addInitScript(() => {
    try {
      const key = "trace-recap-ui-settings";
      const raw = window.localStorage.getItem(key);
      const settings = raw ? JSON.parse(raw) : {};
      settings.speedMultiplier = 1;
      window.localStorage.setItem(key, JSON.stringify(settings));
    } catch {
      // Ignore malformed or missing persisted UI settings.
    }
  });

  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.error(`[page] ${msg.text()}`);
    }
  });

  try {
    await openEditor(page);
    await stopAutoPlaybackIfNeeded(page);
    await collapseSidebar(page);
    await setAspectRatio(page);
    await setSpeedToOneX(page);
    await resizeForRecording(page);
    await stopAutoPlaybackIfNeeded(page);
    await startCanvasRecorder(page);
    await playAndWaitForCompletion(page);
    await stopCanvasRecorder(page);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
