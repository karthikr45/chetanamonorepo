"use client";

import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

export type AppImageVariant = "panel" | "icon" | "default";

export interface AppImageProps extends Omit<ImageProps, "fill"> {
  /** How the image is laid out: panel (fill auth area), icon (small square), or default (no wrapper) */
  variant?: AppImageVariant;
  /** Optional wrapper class (e.g. md:hidden for icon on mobile only) */
  wrapperClassName?: string;
  /** Optional class for the Image when variant is panel or icon */
  imageClassName?: string;
}

const variantConfig = {
  /** Use inside a position:relative container (e.g. .auth-card-media). No wrapper. */
  panel: {
    wrapper: null as string | null,
    image: "object-contain p-8",
    sizes: "460px",
  },
  /** Small square with its own wrapper (e.g. mobile logo). */
  icon: {
    wrapper: "relative h-20 w-20 shrink-0",
    image: "object-contain",
    sizes: "80px",
  },
  default: {
    wrapper: null as string | null,
    image: "",
    sizes: "100vw",
  },
} as const;

export function AppImage({
  src,
  alt,
  variant = "default",
  wrapperClassName,
  imageClassName,
  sizes: sizesProp,
  priority = false,
  className,
  ...props
}: AppImageProps) {
  const config = variantConfig[variant];
  const sizes = sizesProp ?? config.sizes;
  const useFill = variant !== "default";
  const image = (
    <Image
      src={src}
      alt={alt}
      fill={useFill}
      sizes={sizes}
      priority={priority}
      className={cn(useFill && config.image, imageClassName, className)}
      {...props}
    />
  );

  if (variant === "default" || !config.wrapper) {
    return image;
  }

  return (
    <div className={cn(config.wrapper, wrapperClassName)}>
      {image}
    </div>
  );
}
