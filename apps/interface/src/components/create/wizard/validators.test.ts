import {
  validateBasicInfoStep,
  validateMediaStep,
  validateFaqTeamStep,
  validatePlatformConfigStep,
  validateReviewStep,
  validateStep,
  validateAllSteps,
} from "./validators";
import { INITIAL, STEP, type CampaignFormData } from "./types";

const VALID_ADDRESS = "C" + "A".repeat(55);

/**
 * A deadline 30 days out. Deadlines are bounded on both sides (at least 1 hour,
 * at most 1 year ahead), so this has to be relative to now rather than a fixed
 * date that would eventually fall outside the window.
 */
function deadlineInDays(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0]!;
}

/** A draft that passes every step, so tests can invalidate one field at a time. */
const VALID: CampaignFormData = {
  ...INITIAL,
  contractId: VALID_ADDRESS,
  token: VALID_ADDRESS,
  title: "Test Campaign",
  description: "A short description.",
  category: "health",
  goal: "100",
  deadline: deadlineInDays(30),
  minContribution: "1",
  videoUrl: "https://example.com/video.mp4",
  feeAddress: "G123",
  feeBps: "250",
};

describe("validateBasicInfoStep", () => {
  it("accepts a fully-populated step", () => {
    expect(validateBasicInfoStep(VALID)).toBeNull();
  });

  it("requires a contract ID", () => {
    expect(validateBasicInfoStep({ ...VALID, contractId: "" })).toBe(
      "Contract ID is required.",
    );
  });

  it("rejects a malformed contract ID", () => {
    expect(validateBasicInfoStep({ ...VALID, contractId: "C123" })).toBe(
      "Contract ID is invalid.",
    );
  });

  it("requires a token address", () => {
    expect(validateBasicInfoStep({ ...VALID, token: "" })).toBe(
      "Token address is required.",
    );
  });

  it("treats a whitespace-only token address as missing", () => {
    expect(validateBasicInfoStep({ ...VALID, token: "   " })).toBe(
      "Token address is required.",
    );
  });

  it("requires a title", () => {
    expect(validateBasicInfoStep({ ...VALID, title: "" })).toBeTruthy();
  });

  it("requires a description", () => {
    expect(validateBasicInfoStep({ ...VALID, description: "" })).toBeTruthy();
  });

  it("requires a category", () => {
    expect(validateBasicInfoStep({ ...VALID, category: "" })).toBe(
      "Please select a category.",
    );
  });

  it("rejects a zero funding goal", () => {
    expect(validateBasicInfoStep({ ...VALID, goal: "0" })).toBeTruthy();
  });

  it("rejects a negative funding goal", () => {
    expect(validateBasicInfoStep({ ...VALID, goal: "-50" })).toBeTruthy();
  });

  it("rejects a non-numeric funding goal", () => {
    expect(validateBasicInfoStep({ ...VALID, goal: "lots" })).toBeTruthy();
  });

  it("requires a deadline", () => {
    expect(validateBasicInfoStep({ ...VALID, deadline: "" })).toBe(
      "Deadline is required.",
    );
  });

  it("rejects a deadline in the past", () => {
    expect(validateBasicInfoStep({ ...VALID, deadline: "2000-01-01" })).toBe(
      "Deadline must be at least 1 hour in the future.",
    );
  });

  it("rejects a deadline more than a year out", () => {
    expect(
      validateBasicInfoStep({ ...VALID, deadline: deadlineInDays(400) }),
    ).toBe("Deadline cannot be more than 1 year in the future.");
  });

  it("rejects a minimum contribution above the goal", () => {
    expect(
      validateBasicInfoStep({ ...VALID, goal: "100", minContribution: "500" }),
    ).toBeTruthy();
  });

  it("accepts a minimum contribution equal to the goal", () => {
    expect(
      validateBasicInfoStep({ ...VALID, goal: "100", minContribution: "100" }),
    ).toBeNull();
  });

  it("reports the contract ID error first when several fields are invalid", () => {
    const broken = { ...VALID, contractId: "", title: "", goal: "" };
    expect(validateBasicInfoStep(broken)).toBe("Contract ID is required.");
  });
});

describe("validateMediaStep", () => {
  it("accepts an empty video URL — video is optional", () => {
    expect(validateMediaStep({ ...VALID, videoUrl: "" })).toBeNull();
  });

  it("accepts a valid https video URL", () => {
    expect(
      validateMediaStep({ ...VALID, videoUrl: "https://example.com/v.mp4" }),
    ).toBeNull();
  });

  it("rejects a non-https scheme", () => {
    expect(
      validateMediaStep({ ...VALID, videoUrl: "ftp://example.com/video.mp4" }),
    ).toBe("Enter a valid URL starting with https://");
  });
});

describe("validateFaqTeamStep", () => {
  it("passes with no FAQs or team members", () => {
    expect(validateFaqTeamStep(INITIAL)).toBeNull();
  });

  it("passes with FAQs and team members present", () => {
    const data: CampaignFormData = {
      ...VALID,
      faqs: [{ id: "1", question: "Why?", answer: "Because." }],
      teamMembers: [{ id: "1", name: "Ada", role: "Lead" }],
    };
    expect(validateFaqTeamStep(data)).toBeNull();
  });
});

describe("validatePlatformConfigStep", () => {
  it("accepts both fields blank — the fee is optional", () => {
    expect(
      validatePlatformConfigStep({ ...VALID, feeAddress: "", feeBps: "" }),
    ).toBeNull();
  });

  it("accepts a valid address and rate", () => {
    expect(validatePlatformConfigStep(VALID)).toBeNull();
  });

  it("requires a rate when a fee address is set", () => {
    expect(
      validatePlatformConfigStep({ ...VALID, feeAddress: "G123", feeBps: "" }),
    ).toBe("Provide fee bps when a fee address is set.");
  });

  it("rejects a rate above 100% (10000 bps)", () => {
    expect(
      validatePlatformConfigStep({ ...VALID, feeBps: "10001" }),
    ).toBeTruthy();
  });

  it("accepts the maximum rate of 10000 bps", () => {
    expect(
      validatePlatformConfigStep({ ...VALID, feeBps: "10000" }),
    ).toBeNull();
  });

  it("rejects a negative rate", () => {
    expect(validatePlatformConfigStep({ ...VALID, feeBps: "-1" })).toBeTruthy();
  });
});

describe("validateReviewStep", () => {
  it("never blocks — it only displays already-validated values", () => {
    expect(validateReviewStep(INITIAL)).toBeNull();
  });
});

describe("validateStep", () => {
  it("dispatches to the validator for the given step index", () => {
    expect(validateStep(STEP.BASIC_INFO, { ...VALID, contractId: "" })).toBe(
      "Contract ID is required.",
    );
    expect(
      validateStep(STEP.MEDIA, { ...VALID, videoUrl: "ftp://x/v.mp4" }),
    ).toBe("Enter a valid URL starting with https://");
    expect(validateStep(STEP.PLATFORM_CONFIG, { ...VALID, feeBps: "" })).toBe(
      "Provide fee bps when a fee address is set.",
    );
  });

  it("does not report a later step's error when validating an earlier step", () => {
    // Media step is valid even though the basic-info fields are empty.
    expect(validateStep(STEP.MEDIA, { ...INITIAL, videoUrl: "" })).toBeNull();
  });

  it("treats an out-of-range step index as valid", () => {
    expect(validateStep(99, INITIAL)).toBeNull();
    expect(validateStep(-1, INITIAL)).toBeNull();
  });
});

describe("validateAllSteps", () => {
  it("passes for a complete draft", () => {
    expect(validateAllSteps(VALID)).toBeNull();
  });

  it("passes for a complete draft with no optional fields", () => {
    const minimal: CampaignFormData = {
      ...VALID,
      videoUrl: "",
      imageUrl: "",
      feeAddress: "",
      feeBps: "",
      faqs: [],
      teamMembers: [],
    };
    expect(validateAllSteps(minimal)).toBeNull();
  });

  it("fails for an untouched form", () => {
    expect(validateAllSteps(INITIAL)).toBe("Contract ID is required.");
  });

  it("surfaces an error from a later step when earlier steps are valid", () => {
    expect(validateAllSteps({ ...VALID, feeBps: "99999" })).toBeTruthy();
  });

  it("reports errors in wizard order — basic info before platform config", () => {
    const broken = { ...VALID, contractId: "", feeBps: "99999" };
    expect(validateAllSteps(broken)).toBe("Contract ID is required.");
  });
});
