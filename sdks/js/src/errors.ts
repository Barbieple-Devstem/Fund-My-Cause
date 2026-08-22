/**
 * Thrown when the Soroban contract returns a `ContractError(n)`.
 *
 * Distinguishes contract-level rejections — a failed precondition the caller
 * can act on — from network, wallet, and submission failures, which surface as
 * a plain `Error`. Narrow with `instanceof` before reading {@link
 * FmcContractError.code}.
 *
 * @example
 * ```ts
 * try {
 *   await client.contribute({ ... });
 * } catch (e) {
 *   if (e instanceof FmcContractError) {
 *     console.error(`Contract error ${e.code}: ${e.message}`);
 *   }
 * }
 * ```
 */
export class FmcContractError extends Error {
  constructor(
    /**
     * The contract's numeric error code, matching the `ContractError`
     * discriminant. Stable across releases, so it is safe to branch on — see
     * `docs/api/errors.md` for the full table.
     */
    public readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "FmcContractError";
  }
}

const ERROR_MESSAGES: Record<number, string> = {
  1:  "Contract is already initialized.",
  2:  "Campaign has ended.",
  3:  "Campaign is still active.",
  4:  "Funding goal has not been reached.",
  5:  "Funding goal was reached — refunds are not available.",
  6:  "Arithmetic overflow.",
  7:  "Campaign is not in Active status.",
  8:  "Fee basis points exceed 10 000.",
  9:  "Amount is below the minimum contribution.",
  10: "Invalid deadline.",
  11: "Campaign is paused.",
  12: "Invalid goal — must be greater than 0.",
  13: "Token is not accepted by this campaign.",
  14: "This would exceed your per-contributor cap.",
  15: "This is a whitelist-only campaign.",
  16: "Your address is blacklisted.",
  17: "Invalid delegation.",
  18: "No delegation found.",
  22: "Partial refund exceeds 50% of your contribution.",
  23: "Vesting cliff has not been reached yet.",
  24: "Emergency withdrawal is locked.",
  25: "Rate limit exceeded — try again later.",
  26: "Message is too long (max 256 characters).",
  33: "Unauthorized.",
  37: "You have already voted on this proposal.",
  39: "You are not the campaign creator.",
};

/**
 * Parse a raw Soroban simulation/execution error string and throw a typed
 * `FmcContractError` when a contract error code is detected.
 */
export function parseAndThrow(raw: string): never {
  const codeMatch = raw.match(/Error\(Contract,\s*#(\d+)\)/);
  if (codeMatch) {
    const code = Number(codeMatch[1]);
    const msg  = ERROR_MESSAGES[code] ?? `Contract error ${code}.`;
    throw new FmcContractError(code, msg);
  }
  throw new Error(raw.split("\n")[0] ?? "Unknown contract error.");
}
