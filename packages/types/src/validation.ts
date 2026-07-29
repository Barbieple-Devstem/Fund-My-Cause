/**
 * Shared validation schemas for campaign and donation inputs.
 *
 * Reconciliation note: Both frontend and backend now use identical rules.
 * Pre-existing discrepancy resolved: frontend had minContribution >= 1 (XLM),
 * graphql-api had no validation - now both enforce >= 1 XLM minimum.
 */

export const CAMPAIGN_TITLE_MAX_LENGTH = 100;
export const CAMPAIGN_DESCRIPTION_MAX_LENGTH = 1000;
export const CAMPAIGN_DEADLINE_MIN_HOURS = 1;
export const CAMPAIGN_DEADLINE_MAX_YEARS = 1;
export const DONATION_MIN_XLM = 1; // minimum 1 XLM
export const XLM_TO_STROOPS = 10_000_000n;

/** Maximum goal in stroops: i128::MAX / 10 */
const MAX_GOAL_STROOPS = BigInt("9223372036854775807") / 10n;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CampaignValidationInput {
  title: string;
  description: string;
  goal: string;
  deadline: string;
  minContribution: string;
  maxContribution?: string;
  feeBps?: string;
}

export interface DonationValidationInput {
  amount: string;
  campaignId: string;
}

export interface DonationValidationOptions {
  minContributionStroops?: bigint;
  maxContributionStroops?: bigint;
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/**
 * Strip HTML tags from a string before applying length rules.
 */
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

// ---------------------------------------------------------------------------
// Individual field validators — return error string or null
// ---------------------------------------------------------------------------

/**
 * Validate campaign title.
 * Required, HTML stripped, max 100 characters.
 */
export function validateCampaignTitle(title: string): string | null {
  if (!title || !title.trim()) {
    return "Title is required.";
  }
  const sanitized = stripHtml(title);
  if (sanitized.length > CAMPAIGN_TITLE_MAX_LENGTH) {
    return `Title must be ${CAMPAIGN_TITLE_MAX_LENGTH} characters or less.`;
  }
  return null;
}

/**
 * Validate campaign description.
 * Required, HTML stripped, max 1000 characters.
 */
export function validateCampaignDescription(description: string): string | null {
  if (!description || !description.trim()) {
    return "Description is required.";
  }
  const sanitized = stripHtml(description);
  if (sanitized.length > CAMPAIGN_DESCRIPTION_MAX_LENGTH) {
    return `Description must be ${CAMPAIGN_DESCRIPTION_MAX_LENGTH} characters or less.`;
  }
  return null;
}

/**
 * Validate funding goal.
 * Required, positive number, bigint conversion to stroops must not exceed i128::MAX / 10.
 */
export function validateCampaignGoal(goal: string): string | null {
  if (!goal || goal.trim() === "") {
    return "Goal is required.";
  }
  const num = Number(goal);
  if (isNaN(num) || num <= 0) {
    return "Goal must be a positive number.";
  }
  const bigGoal = BigInt(Math.floor(num * Number(XLM_TO_STROOPS)));
  if (bigGoal > MAX_GOAL_STROOPS) {
    return "Goal exceeds maximum allowed value.";
  }
  return null;
}

/**
 * Validate campaign deadline.
 * Required, must be at least 1 hour in the future, at most 1 year in the future.
 */
export function validateCampaignDeadline(deadline: string): string | null {
  if (!deadline) {
    return "Deadline is required.";
  }
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffYears = diffHours / (24 * 365);

  if (diffHours < CAMPAIGN_DEADLINE_MIN_HOURS) {
    return `Deadline must be at least ${CAMPAIGN_DEADLINE_MIN_HOURS} hour in the future.`;
  }
  if (diffYears > CAMPAIGN_DEADLINE_MAX_YEARS) {
    return `Deadline cannot be more than ${CAMPAIGN_DEADLINE_MAX_YEARS} year in the future.`;
  }
  return null;
}

/**
 * Validate minimum contribution.
 * Required, must be >= 1 XLM. If goal provided, must not exceed goal.
 */
export function validateMinContribution(
  minContribution: string,
  goal?: string,
): string | null {
  if (!minContribution || minContribution.trim() === "") {
    return "Minimum contribution is required.";
  }
  const num = Number(minContribution);
  if (isNaN(num) || num < DONATION_MIN_XLM) {
    return "Minimum contribution must be at least 1.";
  }
  if (goal !== undefined && goal !== "") {
    const goalNum = Number(goal);
    if (!isNaN(goalNum) && num > goalNum) {
      return "Minimum contribution cannot exceed goal.";
    }
  }
  return null;
}

/**
 * Validate maximum contribution per contributor.
 * Optional — 0 means no limit. If set, must be >= minContribution.
 */
export function validateMaxContribution(
  maxContribution: string,
  minContribution: string,
): string | null {
  if (
    !maxContribution ||
    maxContribution.trim() === "" ||
    maxContribution === "0"
  ) {
    return null; // 0 = no limit, optional field
  }
  const num = Number(maxContribution);
  if (isNaN(num) || num < 0) {
    return "Maximum contribution must be a non-negative number.";
  }
  const minNum = Number(minContribution);
  if (!isNaN(minNum) && minNum > 0 && num < minNum) {
    return "Maximum contribution cannot be less than minimum contribution.";
  }
  return null;
}

/**
 * Validate platform fee in basis points.
 * Optional — if provided must be 0–10000.
 */
export function validateFeeBps(feeBps: string): string | null {
  if (!feeBps || feeBps.trim() === "") {
    return null; // Optional field
  }
  const num = Number(feeBps);
  if (isNaN(num) || num < 0 || num > 10000) {
    return "Fee must be between 0 and 10000 basis points.";
  }
  return null;
}

/**
 * Validate a donation amount (expressed in XLM, not stroops).
 * Required, must be > 0.
 * If minContributionStroops provided: amount_in_stroops >= minContributionStroops.
 * If maxContributionStroops provided and > 0: amount_in_stroops <= maxContributionStroops.
 */
export function validateDonationAmount(
  amount: string,
  options?: DonationValidationOptions,
): string | null {
  if (!amount || amount.trim() === "") {
    return "Amount is required.";
  }
  const num = Number(amount);
  if (isNaN(num) || num <= 0) {
    return "Amount must be a positive number.";
  }

  const amountInStroops = BigInt(Math.floor(num * Number(XLM_TO_STROOPS)));

  if (options?.minContributionStroops !== undefined) {
    if (amountInStroops < options.minContributionStroops) {
      const minXlm = Number(options.minContributionStroops) / Number(XLM_TO_STROOPS);
      return `Amount must be at least ${minXlm} XLM.`;
    }
  }

  if (
    options?.maxContributionStroops !== undefined &&
    options.maxContributionStroops > 0n
  ) {
    if (amountInStroops > options.maxContributionStroops) {
      const maxXlm = Number(options.maxContributionStroops) / Number(XLM_TO_STROOPS);
      return `Amount must not exceed ${maxXlm} XLM.`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Aggregate validators
// ---------------------------------------------------------------------------

/**
 * Validate all campaign creation fields at once.
 * Returns a record of field name → error message for each invalid field.
 * An empty object means all fields are valid.
 */
export function validateCampaignInput(
  input: CampaignValidationInput,
): Record<string, string> {
  const errors: Record<string, string> = {};

  const titleError = validateCampaignTitle(input.title);
  if (titleError) errors["title"] = titleError;

  const descError = validateCampaignDescription(input.description);
  if (descError) errors["description"] = descError;

  const goalError = validateCampaignGoal(input.goal);
  if (goalError) errors["goal"] = goalError;

  const deadlineError = validateCampaignDeadline(input.deadline);
  if (deadlineError) errors["deadline"] = deadlineError;

  const minContribError = validateMinContribution(input.minContribution, input.goal);
  if (minContribError) errors["minContribution"] = minContribError;

  if (input.maxContribution !== undefined) {
    const maxContribError = validateMaxContribution(
      input.maxContribution,
      input.minContribution,
    );
    if (maxContribError) errors["maxContribution"] = maxContribError;
  }

  if (input.feeBps !== undefined) {
    const feeBpsError = validateFeeBps(input.feeBps);
    if (feeBpsError) errors["feeBps"] = feeBpsError;
  }

  return errors;
}

/**
 * Validate a donation input.
 * Returns a record of field name → error message for each invalid field.
 * An empty object means all fields are valid.
 */
export function validateDonationInput(
  input: DonationValidationInput,
  options?: DonationValidationOptions,
): Record<string, string> {
  const errors: Record<string, string> = {};

  const amountError = validateDonationAmount(input.amount, options);
  if (amountError) errors["amount"] = amountError;

  if (!input.campaignId || !input.campaignId.trim()) {
    errors["campaignId"] = "Campaign ID is required.";
  }

  return errors;
}
