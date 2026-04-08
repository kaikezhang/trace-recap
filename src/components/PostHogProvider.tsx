"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";
import { getConsent } from "@/components/CookieConsent";

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only initialize analytics if user has accepted cookies
    if (getConsent() === "accepted") {
      initAnalytics();
    }

    // Listen for consent changes (user clicks Accept after initial load)
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "accepted") {
        initAnalytics();
      }
    };
    window.addEventListener("cookie-consent-change", handler);
    return () => window.removeEventListener("cookie-consent-change", handler);
  }, []);

  return <>{children}</>;
}
