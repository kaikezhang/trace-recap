/**
 * Analytics — typed event tracking via PostHog.
 *
 * Privacy rules:
 * - Never send coordinates, city names, photo URLs, feedback text, or email
 * - Use counts and booleans, not PII
 * - Session replay is OFF by default (consent-gated)
 */

import posthog from "posthog-js";

let initialized = false;

export function initAnalytics(): void {
  if (initialized) return;
  if (typeof window === "undefined") return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  if (!key) return;

  posthog.init(key, {
    api_host: host,
    defaults: "2026-01-30",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: false, // Manual events only — editor is too complex for autocapture
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-mask]",
    },
    disable_session_recording: true, // Off by default — consent-gated
    persistence: "localStorage+cookie",
    loaded: () => {
      initialized = true;
    },
  });
}

/** Identify a signed-in user (no PII — just the ID) */
export function identifyUser(userId: string): void {
  if (!initialized) return;
  posthog.identify(userId);
}

/** Reset identity on sign-out */
export function resetUser(): void {
  if (!initialized) return;
  posthog.reset();
}

// ---------------------------------------------------------------------------
// Event types — privacy-safe properties only
// ---------------------------------------------------------------------------

interface ProjectEvent {
  is_demo?: boolean;
  stop_count?: number;
  photo_count?: number;
  segment_count?: number;
}

interface ExportEvent extends ProjectEvent {
  resolution?: string;
  aspect_ratio?: string;
  encoder?: string;
  duration_sec?: number;
  export_attempt_id?: string;
}

interface AuthEvent {
  method?: "google" | "email";
}

type AnalyticsEvents = {
  // Navigation
  demo_loaded: ProjectEvent;
  editor_opened: Record<string, never>;

  // Project lifecycle
  project_created: ProjectEvent;
  project_loaded: ProjectEvent;
  project_imported: Record<string, never>;

  // Editor actions (counts only, no PII)
  location_added: { stop_count: number };
  location_removed: { stop_count: number };
  photo_added: { photo_count: number; stop_count: number };
  photo_removed: { photo_count: number };
  photo_layout_changed: { template: string };
  photo_layout_opened: { photo_count: number };
  photo_layout_template_changed: { template: string };
  transport_mode_changed: { mode: string };

  // Route import/export
  route_exported: ProjectEvent;
  route_imported: Record<string, never>;

  // Playback
  playback_started: ProjectEvent;
  playback_completed: ProjectEvent;
  playback_paused: Record<string, never>;

  // Export funnel (attempt-based state machine)
  export_dialog_opened: ProjectEvent;
  export_started: ExportEvent;
  export_completed: ExportEvent;
  export_failed: ExportEvent & { error_code?: string; failure_stage?: string };
  export_canceled: Record<string, never>;

  // Auth
  auth_succeeded: AuthEvent;
  auth_failed: AuthEvent & { error_code?: string };

  // Engagement
  feedback_submitted: { category: string; has_screenshot: boolean };
};

/** Type-safe event tracking */
export function track<K extends keyof AnalyticsEvents>(
  event: K,
  properties?: AnalyticsEvents[K],
): void {
  if (!initialized) return;
  posthog.capture(event, properties as Record<string, unknown>);
}
