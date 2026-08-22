/**
 * Campaign-creation validation, split per wizard step and composable into a
 * single full-submission check.
 *
 * Each `validate<Step>` function returns the first error message for the fields
 * that step owns, or `null` when the step is valid. Field-level rules live in
 * `@/lib/validation`; this module only decides which rules apply to which step
 * and in what order.
 */

import {
  validateTitle,
  validateDescription,
  validateGoal,
  validateDeadline,
  validateMinContribution,
  validateFeeBps,
  validateVideoUrl,
  validateContractId,
} from "@/lib/validation";
import { STEP, type CampaignFormData } from "./types";

/** Validates the fields owned by the "Basic Info" step. */
export function validateBasicInfoStep(data: CampaignFormData): string | null {
  const contractErr = validateContractId(data.contractId);
  if (contractErr) return contractErr;

  if (!data.token.trim()) return "Token address is required.";

  const titleErr = validateTitle(data.title);
  if (titleErr) return titleErr;

  const descErr = validateDescription(data.description);
  if (descErr) return descErr;

  if (!data.category) return "Please select a category.";

  const goalErr = validateGoal(data.goal);
  if (goalErr) return goalErr;

  const deadlineErr = validateDeadline(data.deadline);
  if (deadlineErr) return deadlineErr;

  return validateMinContribution(data.minContribution, data.goal);
}

/** Validates the fields owned by the "Media" step. */
export function validateMediaStep(data: CampaignFormData): string | null {
  return validateVideoUrl(data.videoUrl);
}

/**
 * Validates the fields owned by the "FAQ & Team" step. FAQs and team members
 * are entirely optional, so this always passes; it exists so every step has an
 * entry in {@link STEP_VALIDATORS} and callers never special-case a step.
 */
export function validateFaqTeamStep(_data: CampaignFormData): string | null {
  return null;
}

/** Validates the fields owned by the "Platform Config" step. */
export function validatePlatformConfigStep(
  data: CampaignFormData,
): string | null {
  if (data.feeAddress && !data.feeBps)
    return "Provide fee bps when a fee address is set.";

  return validateFeeBps(data.feeBps);
}

/** The review step only displays previously-entered values, so nothing to check. */
export function validateReviewStep(_data: CampaignFormData): string | null {
  return null;
}

type StepValidator = (data: CampaignFormData) => string | null;

/** Step index → the validator for the fields that step owns. */
export const STEP_VALIDATORS: Record<number, StepValidator> = {
  [STEP.BASIC_INFO]: validateBasicInfoStep,
  [STEP.MEDIA]: validateMediaStep,
  [STEP.FAQ_TEAM]: validateFaqTeamStep,
  [STEP.PLATFORM_CONFIG]: validatePlatformConfigStep,
  [STEP.REVIEW]: validateReviewStep,
};

/**
 * Validates a single step by index.
 * @returns The first error for that step, or `null` if it is valid. Unknown
 * step indices are treated as valid.
 */
export function validateStep(
  step: number,
  data: CampaignFormData,
): string | null {
  return STEP_VALIDATORS[step]?.(data) ?? null;
}

/**
 * Runs every step's validator in wizard order — the check gating deployment.
 * @returns The first error across all steps, or `null` if the whole draft is
 * ready to submit.
 */
export function validateAllSteps(data: CampaignFormData): string | null {
  for (const validate of Object.values(STEP_VALIDATORS)) {
    const err = validate(data);
    if (err) return err;
  }
  return null;
}
