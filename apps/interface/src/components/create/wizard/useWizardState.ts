"use client";

import { useCallback, useState } from "react";
import type { FAQ, TeamMember } from "@/types/campaign";
import { useCampaignDraft } from "@/hooks/useCampaignDraft";
import { validateAllSteps, validateStep } from "./validators";
import {
  INITIAL,
  LAST_FORM_STEP,
  PREVIEW_STEP,
  type CampaignFormData,
  type CampaignFormTextField,
} from "./types";

export interface UseWizardStateReturn {
  /** Current step index. */
  step: number;
  /** Aggregated form state across every step. */
  data: CampaignFormData;
  /** The blocking validation error for the current step, if any. */
  validationError: string | null;
  /** Whether the wizard is on the final full-page preview. */
  showPreview: boolean;
  /** Sets a single string-valued field and clears any pending step error. */
  set: (key: CampaignFormTextField, value: string) => void;
  setFaqs: (faqs: FAQ[]) => void;
  setTeamMembers: (members: TeamMember[]) => void;
  /**
   * Validates the current step and advances. From the last form step this runs
   * the full-draft validation and moves to the preview instead.
   * @returns Whether navigation happened.
   */
  next: () => boolean;
  /** Moves back one step, or out of the preview back to the last form step. */
  back: () => void;
  /** Replaces all form state and jumps to a step — used when resuming a draft. */
  restore: (data: Partial<CampaignFormData>, step: number) => void;
  /** Runs the full-draft validation, surfacing any error. Used before deploy. */
  validateForSubmission: () => string | null;
  setValidationError: (error: string | null) => void;
  /** Draft persistence, wired to the aggregated form state. */
  draft: ReturnType<typeof useCampaignDraft>;
}

/**
 * Coordinates campaign-wizard step navigation and aggregates per-step form
 * state for final submission.
 *
 * Step components stay presentational: they receive `data` plus the setter for
 * the fields they own, and never decide when navigation is allowed. Validation
 * gating lives here, delegating the rules themselves to `./validators`.
 */
export function useWizardState(): UseWizardStateReturn {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<CampaignFormData>(INITIAL);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const draft = useCampaignDraft({ ...data, step });

  const set = useCallback((key: CampaignFormTextField, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setValidationError(null);
  }, []);

  const setFaqs = useCallback(
    (faqs: FAQ[]) => setData((prev) => ({ ...prev, faqs })),
    [],
  );

  const setTeamMembers = useCallback(
    (teamMembers: TeamMember[]) =>
      setData((prev) => ({ ...prev, teamMembers })),
    [],
  );

  const next = useCallback((): boolean => {
    const err = validateStep(step, data);
    if (err) {
      setValidationError(err);
      return false;
    }

    setValidationError(null);

    if (step === LAST_FORM_STEP) {
      const allErr = validateAllSteps(data);
      if (allErr) {
        setValidationError(allErr);
        return false;
      }
      setShowPreview(true);
      setStep(PREVIEW_STEP);
      return true;
    }

    setStep((s) => s + 1);
    return true;
  }, [step, data]);

  const back = useCallback(() => {
    setValidationError(null);
    if (showPreview) {
      setShowPreview(false);
      setStep(LAST_FORM_STEP);
      return;
    }
    setStep((s) => Math.max(0, s - 1));
  }, [showPreview]);

  const restore = useCallback(
    (restored: Partial<CampaignFormData>, restoredStep: number) => {
      // Drafts only persist a subset of the form (see CampaignDraftData), so
      // merge onto INITIAL rather than replacing — otherwise fields the draft
      // doesn't carry (faqs, teamMembers, …) would come back undefined.
      setData({ ...INITIAL, ...restored });
      setStep(restoredStep);
    },
    [],
  );

  const validateForSubmission = useCallback((): string | null => {
    const err = validateAllSteps(data);
    setValidationError(err);
    return err;
  }, [data]);

  return {
    step,
    data,
    validationError,
    showPreview,
    set,
    setFaqs,
    setTeamMembers,
    next,
    back,
    restore,
    validateForSubmission,
    setValidationError,
    draft,
  };
}
