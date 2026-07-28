/**
 * Campaign data transforms shared by every surface that renders a campaign.
 *
 * These live here rather than inside a card/detail component so the progress
 * maths, funded/ended state and XLM+USD formatting stay identical across the
 * listing, detail, search and comparison views.
 */

/** Milliseconds in a day, hour and minute — used by the countdown helpers. */
const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;

/**
 * Funding progress as a percentage of the goal.
 *
 * Not clamped: values above 100 are meaningful (over-funded campaigns) and the
 * progress bar clamps for display. Returns 0 for a non-positive goal.
 *
 * @example
 * calculateProgress(5000, 10000) // 50
 * calculateProgress(500, 0)      // 0
 */
export function calculateProgress(raised: number, goal: number): number {
  if (!(goal > 0)) return 0;
  return (raised / goal) * 100;
}

/** True once the campaign has reached or passed its goal. */
export function isCampaignFunded(raised: number, goal: number): boolean {
  return calculateProgress(raised, goal) >= 100;
}

/**
 * True when the deadline has passed and the goal was never met.
 *
 * A funded campaign is never "ended" — funded takes precedence in the UI.
 */
export function isCampaignEnded(
  deadline: string | number | Date,
  raised: number,
  goal: number,
  now: number = Date.now(),
): boolean {
  if (isCampaignFunded(raised, goal)) return false;
  return new Date(deadline).getTime() < now;
}

export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Milliseconds left, clamped to 0 once the deadline passes. */
  total: number;
  expired: boolean;
}

/**
 * Break the time until `deadline` into calendar units.
 *
 * `now` is injectable so callers (and tests) are not bound to wall-clock time.
 */
export function getTimeRemaining(
  deadline: string | number | Date,
  now: number = Date.now(),
): TimeRemaining {
  const total = new Date(deadline).getTime() - now;
  if (!(total > 0)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, expired: true };
  }
  return {
    total,
    days: Math.floor(total / MS_PER_DAY),
    hours: Math.floor((total % MS_PER_DAY) / MS_PER_HOUR),
    minutes: Math.floor((total % MS_PER_HOUR) / MS_PER_MINUTE),
    seconds: Math.floor((total % MS_PER_MINUTE) / 1000),
    expired: false,
  };
}

/**
 * Format an XLM amount with an optional USD estimate.
 *
 * Pass `price: null` when the price feed is unavailable — the USD half is
 * dropped rather than rendered as a wrong or zero value.
 *
 * @example
 * formatXlmWithUsd(15400, 0.14) // "15,400 XLM (~$2,156 USD)"
 * formatXlmWithUsd(15400, null) // "15,400 XLM"
 */
export function formatXlmWithUsd(xlm: number, price: number | null): string {
  const xlmStr = xlm.toLocaleString(undefined, { maximumFractionDigits: 7 });
  if (price === null) return `${xlmStr} XLM`;
  const usdStr = (xlm * price).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  return `${xlmStr} XLM (~${usdStr} USD)`;
}
