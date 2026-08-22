export const CONTRACT_ERROR_CODES: Record<number, string> = {
  1: "Campaign is already initialized",
  2: "Campaign deadline has passed",
  3: "Campaign is still active",
  4: "Campaign goal was not reached",
  5: "Campaign goal was already reached",
  6: "Arithmetic overflow occurred",
  7: "Campaign is not in the correct status",
  8: "Platform fee is invalid",
  9: "Contribution amount is below the minimum",
  10: "Deadline is invalid",
  11: "Campaign is paused",
  12: "Campaign goal is invalid",
  13: "Token is not accepted by this campaign",
  14: "Contribution would exceed the per-contributor maximum",
  15: "Address is not whitelisted",
  16: "Address is blacklisted",
  17: "Invalid delegation",
  18: "Delegation not found",
  19: "Invalid template",
  20: "Voting period has ended",
  21: "Invalid recurring plan",
  22: "Refund limit exceeded",
  23: "Vesting is not complete",
  24: "Emergency withdrawal is locked",
  25: "Rate limit exceeded",
  26: "Message is too long",
  27: "String field is empty",
  28: "String field exceeds maximum length",
  29: "Amount must be positive",
  30: "Platform fee address cannot be the same as creator",
  31: "Goal would overflow when combined with existing totals",
  32: "Insufficient funds in pool or balance",
  33: "Caller is not authorized for this operation",
  34: "Rate limit configuration is invalid",
  35: "Multi-signature approval requirement not met",
  36: "Proposal not found",
  37: "Already voted on this proposal",
  38: "Rewards are not configured for this campaign",
  39: "Caller is not the campaign creator",
  40: "Milestone not found",
  41: "Milestone has already been reached",
  42: "Verification status is not approved",
  43: "Dispute not found",
  44: "Already voted on this dispute",
  45: "Dispute voting period has ended",
  46: "Analytics not available",
  47: "Governance proposal not found",
  48: "Already voted on this governance proposal",
  49: "Voting period for governance proposal has ended",
  50: "Not enough approvals to execute governance proposal",
  51: "Governance timelock has not yet expired",
  52: "Address is not a designated governor",
  53: "Governance proposal is not in a ready state",
  54: "Governance proposal has already been executed",
  55: "Contract is emergency paused by governance",
  56: "Reentrancy detected",
  57: "Emergency pause is active",
  58: "Invalid input provided",
  59: "Requested item not found",
  60: "Invalid campaign category",
  61: "Contribution would exceed the per-contributor cap",
  62: "No streaming configuration set for this campaign",
  63: "Stream claim amount exceeds what has unlocked so far",
  64: "Nothing left to claim",
  65: "Campaign is not in the correct state for this operation",
  66: "Campaign deadline has not been reached",
  67: "Contributor has no contribution to refund",
  68: "Initialization parameters are invalid",
  69: "Withdrawal has already been executed",
  70: "Required address could not be read from storage",
  71: "Nothing available to refund for this caller",
  72: "Campaign is not currently paused",
};

export function getErrorMessage(errorCode: number | string): string {
  const code =
    typeof errorCode === "string" ? parseInt(errorCode, 10) : errorCode;
  return (
    CONTRACT_ERROR_CODES[code] ??
    `An unexpected error occurred (code: ${code}). Please try again.`
  );
}

export function parseContractError(error: unknown): {
  code: number | null;
  message: string;
} {
  if (typeof error === "string") {
    const codeMatch = error.match(/code[:\s]+(\d+)/i);
    const code = codeMatch ? parseInt(codeMatch[1], 10) : null;
    return {
      code,
      message: code ? getErrorMessage(code) : error,
    };
  }

  if (error instanceof Error) {
    const codeMatch = error.message.match(/code[:\s]+(\d+)/i);
    const code = codeMatch ? parseInt(codeMatch[1], 10) : null;
    return {
      code,
      message: code ? getErrorMessage(code) : error.message,
    };
  }

  return {
    code: null,
    message: "An unexpected error occurred. Please try again.",
  };
}
