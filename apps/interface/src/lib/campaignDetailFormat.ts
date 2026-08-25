/**
 * Formatting helpers for campaign detail view.
 */

export function truncateAddress(addr: string, start = 6, end = 4): string {
  if (!addr) return "";
  if (addr.length <= start + end) return addr;
  return `${addr.slice(0, start)}…${addr.slice(-end)}`;
}

export function formatSocialLinkTitle(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
