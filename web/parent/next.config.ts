import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Self-contained server bundle for slim Docker images.
  output: "standalone",
  // `next` (and tailwind/postcss) is hoisted to the monorepo root
  // (node-linker=hoisted) in this pnpm workspace. Point file-tracing at the
  // repo root so the standalone bundle includes those hoisted packages.
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
  devIndicators: false,
};

export default nextConfig;
