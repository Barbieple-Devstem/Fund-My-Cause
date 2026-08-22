"use client";

import React from "react";

interface SkipNavProps {
  contentId?: string;
  /** Optional label for the skip link. Defaults to "Skip to main content". */
  label?: string;
}

/**
 * Accessible skip navigation link.
 * - Renders a visually hidden link that becomes visible on focus (keyboard users).
 * - Links to the main content area via `#main-content` by default.
 * - Supports custom contentId and label for flexibility across pages.
 */
export function SkipNav({ contentId = "main-content", label = "Skip to main content" }: SkipNavProps) {
  return (
    <a
      href={`#${contentId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[var(--color-brand)] focus:text-white focus:rounded-[var(--radius-md)] focus:font-medium focus:outline-none focus:shadow-lg"
    >
      {label}
    </a>
  );
}
