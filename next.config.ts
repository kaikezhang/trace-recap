import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com"],
  experimental: {
    webpackMemoryOptimizations: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self' data:",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.posthog.com https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' blob: data: https://*.mapbox.com https://*.googleapis.com https://*.googleusercontent.com https://*.ggpht.com https://*.supabase.co https://tile.openstreetmap.org",
              "connect-src 'self' https://*.mapbox.com https://*.supabase.co https://*.posthog.com https://va.vercel-scripts.com https://vitals.vercel-insights.com",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
