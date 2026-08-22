/**
 * Image optimization utilities for responsive images, lazy loading, AVIF/WebP support,
 * and CDN URL generation.
 *
 * CDN integration: set NEXT_PUBLIC_IMAGE_CDN_URL to your CDN origin
 * (e.g. https://cdn.fund-my-cause.app). When set, all image URLs are rewritten
 * through the CDN so long-lived Cache-Control headers apply and bandwidth is
 * served from the edge. When not set the utilities fall back to origin URLs.
 */

export interface ImageOptimizationConfig {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  quality?: number;
}

export interface ResponsiveImageSet {
  src: string;
  srcSet: string;
  sizes: string;
  webpSrcSet?: string;
  avifSrcSet?: string;
}

// ── CDN helpers ───────────────────────────────────────────────────────────────

/**
 * The CDN base URL, read from NEXT_PUBLIC_IMAGE_CDN_URL at build/runtime.
 * Falls back to an empty string (same-origin) when not configured.
 */
export const IMAGE_CDN_URL: string =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_IMAGE_CDN_URL ?? "")
    : "";

/**
 * Rewrite an image src through the configured CDN origin.
 * If IMAGE_CDN_URL is empty the original src is returned unchanged.
 *
 * @param src - Original image URL (absolute or root-relative)
 * @returns CDN-prefixed URL, or original src when no CDN is configured
 */
export function cdnUrl(src: string): string {
  if (!IMAGE_CDN_URL || src.startsWith("data:")) return src;
  // Absolute URLs for external hosts (Unsplash, IPFS) pass through as-is;
  // the CDN is only applied to same-origin paths.
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return `${IMAGE_CDN_URL}${src.startsWith("/") ? src : `/${src}`}`;
}

// ── Responsive image sets ─────────────────────────────────────────────────────

/**
 * Standard responsive widths used across the application.
 * Matches Next.js deviceSizes in next.config.ts so images are never
 * fetched at a size Next.js wouldn't generate anyway.
 */
export const RESPONSIVE_WIDTHS: number[] = [320, 480, 640, 750, 1080, 1200, 1920];

/**
 * Generate responsive srcset entries for a given format.
 *
 * @param baseSrc - Source image URL (passed through cdnUrl)
 * @param widths  - Breakpoint widths to generate descriptors for
 * @param format  - Image format: "webp", "avif", or "auto" (original)
 * @returns Space-joined srcset string
 */
export function generateSrcSet(
  baseSrc: string,
  widths: number[] = RESPONSIVE_WIDTHS,
  format: "webp" | "avif" | "auto" = "auto",
): string {
  return widths
    .map((w) => {
      const params = new URLSearchParams({ w: String(w) });
      if (format !== "auto") params.set("fmt", format);
      const separator = baseSrc.includes("?") ? "&" : "?";
      return `${cdnUrl(baseSrc)}${separator}${params.toString()} ${w}w`;
    })
    .join(", ");
}

/**
 * Generate a full responsive image set including AVIF, WebP, and original srcsets.
 * Use this to populate <picture> source elements for maximum format coverage.
 *
 * @param baseSrc - Source image URL
 * @param widths  - Breakpoint widths (defaults to RESPONSIVE_WIDTHS)
 * @returns ResponsiveImageSet containing srcset, webpSrcSet, avifSrcSet, and sizes
 */
export function generateResponsiveImageSet(
  baseSrc: string,
  widths: number[] = RESPONSIVE_WIDTHS,
): ResponsiveImageSet {
  return {
    src: cdnUrl(baseSrc),
    srcSet: generateSrcSet(baseSrc, widths, "auto"),
    webpSrcSet: generateSrcSet(baseSrc, widths, "webp"),
    avifSrcSet: generateSrcSet(baseSrc, widths, "avif"),
    sizes:
      "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  };
}

/**
 * Generate WebP srcset for modern browsers (legacy helper kept for compat).
 * Prefer generateResponsiveImageSet for new code.
 */
export function generateWebPSrcSet(
  baseSrc: string,
  widths: number[] = RESPONSIVE_WIDTHS,
): string {
  return generateSrcSet(baseSrc, widths, "webp");
}

/**
 * Generate AVIF srcset. AVIF typically achieves 40-50% smaller file sizes
 * than WebP at equivalent quality.
 */
export function generateAvifSrcSet(
  baseSrc: string,
  widths: number[] = RESPONSIVE_WIDTHS,
): string {
  return generateSrcSet(baseSrc, widths, "avif");
}

// ── Format detection ──────────────────────────────────────────────────────────

/**
 * Check if browser supports WebP via canvas probe.
 */
export function supportsWebP(): boolean {
  if (typeof window === "undefined") return false;

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;

  return (
    canvas.toDataURL("image/webp").indexOf("image/webp") === 0
  );
}

/**
 * Check if browser supports AVIF via a small decode probe.
 * Returns a Promise because AVIF support detection is async.
 */
export function supportsAvif(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);

  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img.width === 1);
    img.onerror = () => resolve(false);
    // 1×1 AVIF image (smallest valid AVIF)
    img.src =
      "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAAAFgAAACEAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDAQAEAAIABgAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACFtZGF0EgAKBzgAABGGAAAQiAEQmAAAAAAAAAA=";
  });
}

// ── Optimized URL generation ──────────────────────────────────────────────────

/**
 * Get optimized image URL with compression and format query params.
 * Routes through the CDN when IMAGE_CDN_URL is configured.
 */
export function getOptimizedImageUrl(
  src: string,
  options: {
    width?: number;
    quality?: number;
    format?: "webp" | "avif" | "auto";
  } = {},
): string {
  const { width, quality = 80, format = "auto" } = options;

  const params = new URLSearchParams();
  if (width) params.append("w", width.toString());
  params.append("q", quality.toString());
  if (format !== "auto") params.append("fmt", format);

  const base = cdnUrl(src);
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${params.toString()}`;
}

// ── Preload helpers ───────────────────────────────────────────────────────────

/**
 * Inject a <link rel="preload"> tag for the given image.
 * Pass imagesrcset/imagesizes for responsive preloading.
 */
export function preloadImage(
  src: string,
  options: { imagesrcset?: string; imagesizes?: string } = {},
): void {
  if (typeof window === "undefined") return;

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = cdnUrl(src);
  if (options.imagesrcset) link.setAttribute("imagesrcset", options.imagesrcset);
  if (options.imagesizes) link.setAttribute("imagesizes", options.imagesizes);
  document.head.appendChild(link);
}

// ── Lazy loading ──────────────────────────────────────────────────────────────

/**
 * Create intersection observer for lazy loading.
 */
export function createLazyLoadObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {},
): IntersectionObserver {
  const defaultOptions: IntersectionObserverInit = {
    rootMargin: "50px",
    threshold: 0.01,
    ...options,
  };

  return new IntersectionObserver(callback, defaultOptions);
}

// ── sizes helpers ─────────────────────────────────────────────────────────────

/**
 * Common sizes descriptors for typical layout slots.
 * Import the constant that matches your usage context.
 */
export const SIZES_FULL_WIDTH = "100vw";
export const SIZES_HALF_WIDTH =
  "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";
export const SIZES_CARD_THUMB =
  "(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw";
export const SIZES_SMALL_THUMB = "56px";
