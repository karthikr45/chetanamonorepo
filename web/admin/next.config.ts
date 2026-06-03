import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Self-contained server bundle for slim Docker images.
  output: "standalone",
  // `next` is hoisted to the monorepo root (node-linker=hoisted) in this
  // pnpm workspace, so Turbopack must treat the repo root as its boundary —
  // otherwise it can't resolve the hoisted `next` package. Pin it explicitly.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "aautifileuploads.blob.core.windows.net",
        pathname: "/svbk/**",
      },
    ],
  },
};

export default nextConfig;
