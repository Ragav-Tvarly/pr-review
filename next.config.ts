import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com", pathname: "/**" }],
  },
  agentRules: false, // keep `next dev` from appending its block to AGENTS.md
  // No `output: "standalone"` — Vercel does its own tracing (see tvar-business apps/referral/next.config.ts).
};

export default nextConfig;
