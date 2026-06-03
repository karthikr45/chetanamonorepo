import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Self-contained server bundle for slim Docker images.
  output: "standalone",
  // `next` (and tailwind/postcss) is hoisted to the monorepo root
  // (node-linker=hoisted) in this pnpm workspace, so Turbopack must treat
  // the repo root as its boundary — otherwise it can't resolve the hoisted
  // packages and the PostCSS transform fails with "Cannot find module
  // '@vercel/turbopack/postcss'". Pin it explicitly.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  devIndicators: false,
};

export default nextConfig;
