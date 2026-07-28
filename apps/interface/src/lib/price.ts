import { COINGECKO_API_URL, XLM_PRICE_CACHE_SECONDS } from "@/lib/constants";

/**
 * Fetches the current XLM/USD price from CoinGecko's public API.
 * Returns null if the API is unavailable — callers should hide USD amounts gracefully.
 *
 * Caches the response at the edge for the duration specified in constants.
 * @returns {Promise<number|null>} Current XLM price in USD, or null if unavailable
 */
export async function fetchXlmPrice(): Promise<number | null> {
  try {
    const res = await fetch(
      `${COINGECKO_API_URL}?ids=stellar&vs_currencies=usd`,
      {
        next: { revalidate: XLM_PRICE_CACHE_SECONDS },
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const price = json?.stellar?.usd;
    return typeof price === "number" && price > 0 ? price : null;
  } catch {
    return null; // network error — degrade gracefully
  }
}

/**
 * Format an XLM amount with an optional USD estimate.
 *
 * Re-exported under its historical name — the implementation lives in
 * `@fund-my-cause/shared-utils` so the card, detail and comparison views all
 * format amounts identically.
 *
 * @example
 * formatXlm(15400, 0.14)  // "15,400 XLM (~$2,156 USD)"
 * formatXlm(15400, null)  // "15,400 XLM"
 */
export { formatXlmWithUsd as formatXlm } from "@fund-my-cause/shared-utils";
