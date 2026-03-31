import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.trycloudflare.com"],
  experimental: {
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
