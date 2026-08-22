import type { FAQ, TeamMember } from "@/types/campaign";

/** Everything the campaign-creation wizard collects across all steps. */
export interface CampaignFormData {
  contractId: string;
  token: string;
  title: string;
  description: string;
  category: string;
  goal: string;
  deadline: string;
  minContribution: string;
  imageUrl: string;
  videoUrl: string;
  faqs: FAQ[];
  teamMembers: TeamMember[];
  feeAddress: string;
  feeBps: string;
}

/** Form fields that are plain strings, i.e. settable via `set(key, value)`. */
export type CampaignFormTextField = {
  [K in keyof CampaignFormData]: CampaignFormData[K] extends string ? K : never;
}[keyof CampaignFormData];

/** Deployment transaction lifecycle. */
export type TxStatus = "idle" | "pending" | "success" | "error";

/** Step labels, in order. Index doubles as the step number. */
export const STEPS = [
  "Basic Info",
  "Media",
  "FAQ & Team",
  "Platform Config",
  "Review & Deploy",
  "Preview",
] as const;

/** Step indices, named so navigation logic reads without magic numbers. */
export const STEP = {
  BASIC_INFO: 0,
  MEDIA: 1,
  FAQ_TEAM: 2,
  PLATFORM_CONFIG: 3,
  REVIEW: 4,
  PREVIEW: 5,
} as const;

/** The step the wizard jumps to after "Review & Deploy" is confirmed. */
export const PREVIEW_STEP = STEP.PREVIEW;

/** The last step reachable via the normal Next button. */
export const LAST_FORM_STEP = STEP.REVIEW;

export const INITIAL: CampaignFormData = {
  contractId: "",
  token: "",
  title: "",
  description: "",
  category: "",
  goal: "",
  deadline: "",
  minContribution: "1",
  imageUrl: "",
  videoUrl: "",
  faqs: [],
  teamMembers: [],
  feeAddress: "",
  feeBps: "",
};

/**
 * Props shared by every step component: the current values plus a setter for
 * string fields. Steps that own non-string state (FAQs, team members) declare
 * their own extra setters on top of this.
 */
export interface StepProps {
  data: CampaignFormData;
  set: (key: CampaignFormTextField, value: string) => void;
}
