/**
 * Centralized campaign date formatting utilities.
 * Ensures consistent date formatting across all campaign views.
 */

const DATE_FORMAT_OPTIONS = {
  short: {
    month: "short" as const,
    day: "numeric" as const,
    year: "numeric" as const,
  },
  long: {
    month: "long" as const,
    day: "numeric" as const,
    year: "numeric" as const,
    weekday: "long" as const,
  },
  relative: undefined,
} as const;

/**
 * Format campaign deadline in short form (e.g., "Mar 19, 2026")
 * @param date - Date object or ISO string
 * @param locale - BCP-47 locale code (e.g., 'en-US')
 */
export function formatCampaignDateShort(
  date: Date | string,
  locale: string = "en-US",
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString(locale, DATE_FORMAT_OPTIONS.short);
}

/**
 * Format campaign deadline in long form (e.g., "Wednesday, March 19, 2026")
 * @param date - Date object or ISO string
 * @param locale - BCP-47 locale code (e.g., 'en-US')
 */
export function formatCampaignDateLong(
  date: Date | string,
  locale: string = "en-US",
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString(locale, DATE_FORMAT_OPTIONS.long);
}

/**
 * Format date with time (e.g., "Mar 19, 2026 at 3:45 PM")
 * @param date - Date object or ISO string
 * @param locale - BCP-47 locale code (e.g., 'en-US')
 */
export function formatCampaignDateTime(
  date: Date | string,
  locale: string = "en-US",
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const dateStr = dateObj.toLocaleDateString(locale, DATE_FORMAT_OPTIONS.short);
  const timeStr = dateObj.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateStr} at ${timeStr}`;
}
