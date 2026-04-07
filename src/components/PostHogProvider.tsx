"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAnalytics();
  }, []);

  return <>{children}</>;
}
