import { localeToIntlCode } from "./format";
import { rtlLocales, type Locale } from "@/i18n/config";

/**
 * Coerces the Date | number union into a real Date, tolerating invalid
 * runtime input (null/undefined/malformed strings) that bypasses the
 * static type. Returns an invalid Date rather than throwing so callers
 * can check `isNaN(result.getTime())`.
 */
function coerceDate(date: Date | number): Date {
  if (date === null || date === undefined) return new Date(NaN);
  if (typeof date === "number") return new Date(date * 1000);
  if (date instanceof Date) return date;
  return new Date(date as unknown as string);
}

/**
 * Format currency with locale and RTL support
 * Handles currency symbol placement for RTL locales
 */
export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: Locale = "en",
): string {
  const intlCode = localeToIntlCode(locale);
  const isRTL = rtlLocales.includes(locale);

  const formatted = new Intl.NumberFormat(intlCode, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  // For RTL locales, ensure proper directional formatting
  if (isRTL) {
    return `\u202E${formatted}\u202C`; // Explicit directional marks
  }
  return formatted;
}

/**
 * Format number with locale support
 */
export function formatNumber(
  value: number,
  locale: Locale = "en",
  options?: Intl.NumberFormatOptions,
): string {
  const intlCode = localeToIntlCode(locale);
  return new Intl.NumberFormat(intlCode, options).format(value);
}

/**
 * Format percentage with locale support
 */
export function formatPercentage(
  value: number,
  locale: Locale = "en",
  fractionDigits: number = 1,
): string {
  return new Intl.NumberFormat(localeToIntlCode(locale), {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value / 100);
}

/**
 * Format date with locale support
 */
export function formatLocalDate(
  date: Date | number,
  locale: Locale = "en",
  options?: Intl.DateTimeFormatOptions,
): string {
  const dateObj = coerceDate(date);
  if (Number.isNaN(dateObj.getTime())) return "Invalid Date";
  const intlCode = localeToIntlCode(locale);
  return dateObj.toLocaleDateString(intlCode, options);
}

/**
 * Format time with locale support
 */
export function formatLocalTime(
  date: Date | number,
  locale: Locale = "en",
  options?: Intl.DateTimeFormatOptions,
): string {
  const dateObj = coerceDate(date);
  if (Number.isNaN(dateObj.getTime())) return "Invalid Date";
  const intlCode = localeToIntlCode(locale);
  return dateObj.toLocaleTimeString(intlCode, options);
}

/**
 * Format datetime with locale support
 */
export function formatLocalDateTime(
  date: Date | number,
  locale: Locale = "en",
  options?: Intl.DateTimeFormatOptions,
): string {
  const dateObj = coerceDate(date);
  if (Number.isNaN(dateObj.getTime())) return "Invalid Date";
  const intlCode = localeToIntlCode(locale);
  return dateObj.toLocaleString(intlCode, options);
}

/**
 * Format compact number (e.g., "1.2K" instead of "1,200")
 */
export function formatCompactNumber(
  value: number,
  locale: Locale = "en",
): string {
  const intlCode = localeToIntlCode(locale);
  return new Intl.NumberFormat(intlCode, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format relative time (e.g., "2 days ago")
 * @param pastDate - The date to compare to now
 * @param locale - The locale code
 */
export function formatRelativeTime(
  pastDate: Date | number,
  locale: Locale = "en",
): string {
  const intlCode = localeToIntlCode(locale);
  const now = new Date();
  const date = coerceDate(pastDate);
  if (Number.isNaN(date.getTime())) return "Invalid Date";
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(intlCode, { numeric: "auto" });

  if (seconds < 60) return rtf.format(-seconds, "second");
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), "hour");
  if (seconds < 604800) return rtf.format(-Math.floor(seconds / 86400), "day");
  return rtf.format(-Math.floor(seconds / 604800), "week");
}

/**
 * Get list format for items (e.g., "a, b, and c")
 */
export function formatList(items: string[], locale: Locale = "en"): string {
  const intlCode = localeToIntlCode(locale);
  const formatter = new Intl.ListFormat(intlCode, {
    style: "long",
    type: "conjunction",
  });
  return formatter.format(items);
}

/**
 * Format as short list (e.g., "a, b, c")
 */
export function formatListShort(
  items: string[],
  locale: Locale = "en",
): string {
  const intlCode = localeToIntlCode(locale);
  const formatter = new Intl.ListFormat(intlCode, {
    style: "short",
    type: "conjunction",
  });
  return formatter.format(items);
}

/**
 * Format currency symbol correctly positioned for RTL locales
 */
export function getCurrencySymbol(
  currency: string = "USD",
  locale: Locale = "en",
): string {
  const intlCode = localeToIntlCode(locale);
  const parts = new Intl.NumberFormat(intlCode, {
    style: "currency",
    currency,
  }).formatToParts(0);

  const symbol = parts.find((part) => part.type === "currency")?.value || "";
  return symbol;
}

/**
 * Format number with proper RTL placement for currencies
 */
export function formatCurrencyRTL(
  amount: number,
  currency: string = "USD",
  locale: Locale = "en",
): string {
  const intlCode = localeToIntlCode(locale);
  const isRTL = rtlLocales.includes(locale);

  const parts = new Intl.NumberFormat(intlCode, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).formatToParts(amount);

  // For RTL, reverse the order appropriately
  if (isRTL) {
    return parts.map((part) => part.value).join("");
  }

  return parts.map((part) => part.value).join("");
}
