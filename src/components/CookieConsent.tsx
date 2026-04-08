"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "cookie-consent";

export type ConsentValue = "accepted" | "declined" | null;

export function getConsent(): ConsentValue {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === "accepted" || v === "declined") return v;
  } catch {
    // localStorage unavailable (e.g., incognito Safari)
  }
  return null;
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getConsent()) setVisible(true);
  }, []);

  const respond = (value: "accepted" | "declined") => {
    try { localStorage.setItem(CONSENT_KEY, value); } catch { /* storage unavailable */ }
    setVisible(false);
    // Trigger a custom event so PostHogProvider can react
    window.dispatchEvent(new CustomEvent("cookie-consent-change", { detail: value }));
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[200] border-t bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm sm:flex sm:items-center sm:justify-between sm:px-6 md:bottom-auto md:top-0 md:border-b md:border-t-0"
      style={{ borderColor: "#e7e5e4" }}
    >
      <p className="text-sm text-stone-600">
        We use cookies for analytics to improve your experience.{" "}
        <Link href="/privacy" className="underline hover:text-stone-900">Learn more</Link>
      </p>
      <div className="mt-2 flex gap-2 sm:mt-0 sm:shrink-0">
        <button
          onClick={() => respond("declined")}
          className="rounded-lg border border-stone-200 px-4 py-1.5 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-50"
        >
          Decline
        </button>
        <button
          onClick={() => respond("accepted")}
          className="rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-600"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
