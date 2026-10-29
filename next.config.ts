import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com", pathname: "/**" }],
  },
  // No `output: "standalone"` — Vercel does its own tracing (see tvar-business apps/referral/next.config.ts).
};

export default nextConfig;
