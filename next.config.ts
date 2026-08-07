import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output only for container builds (Dockerfile sets this);
  // local `next start` and the e2e webServer keep the default output.
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
