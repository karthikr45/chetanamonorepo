"use client";

export interface ShimmerProps {
  className?: string;
}

export function Shimmer({ className = "" }: ShimmerProps) {
  return (
    <div
      className={`animate-shimmer rounded bg-gradient-to-r from-transparent via-black/[0.06] to-transparent bg-[length:400%_100%] dark:via-white/[0.06] ${className}`}
      style={{ backgroundColor: "var(--app-search-bg)" }}
    />
  );
}

export function ShimmerLine({ width = "w-full", height = "h-4" }: { width?: string; height?: string }) {
  return <Shimmer className={`${width} ${height} rounded`} />;
}

export function ShimmerCircle({ size = "h-10 w-10" }: { size?: string }) {
  return <Shimmer className={`${size} rounded-full`} />;
}
