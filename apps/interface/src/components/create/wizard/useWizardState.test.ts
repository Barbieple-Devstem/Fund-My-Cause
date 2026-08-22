import { act, renderHook } from "@testing-library/react";
import { useWizardState } from "./useWizardState";
import { LAST_FORM_STEP, PREVIEW_STEP, STEP } from "./types";

/** 30 days out — deadlines must be between 1 hour and 1 year in the future. */
const DEADLINE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split("T")[0]!;

const VALID_ADDRESS = "C" + "A".repeat(55);

/** Fills in every field required to clear the basic-info step. */
function fillBasicInfo(result: { current: ReturnType<typeof useWizardState> }) {
  act(() => {
    result.current.set("contractId", VALID_ADDRESS);
    result.current.set("token", VALID_ADDRESS);
    result.current.set("title", "Test Campaign");
    result.current.set("description", "A short description.");
    result.current.set("category", "health");
    result.current.set("goal", "100");
    result.current.set("deadline", DEADLINE);
    result.current.set("minContribution", "1");
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("useWizardState", () => {
  it("starts on the first step with empty form state", () => {
    const { result } = renderHook(() => useWizardState());
    expect(result.current.step).toBe(STEP.BASIC_INFO);
    expect(result.current.data.title).toBe("");
    expect(result.current.validationError).toBeNull();
    expect(result.current.showPreview).toBe(false);
  });

  // ── Field setters ──────────────────────────────────────────────────────────

  it("updates a single field without touching the others", () => {
    const { result } = renderHook(() => useWizardState());
    act(() => result.current.set("title", "Hello"));
    expect(result.current.data.title).toBe("Hello");
    expect(result.current.data.description).toBe("");
  });

  it("aggregates FAQs and team members alongside the text fields", () => {
    const { result } = renderHook(() => useWizardState());
    act(() => {
      result.current.set("title", "Hello");
      result.current.setFaqs([{ id: "a", question: "Q", answer: "A" }]);
      result.current.setTeamMembers([{ id: "b", name: "Ada", role: "Lead" }]);
    });
    expect(result.current.data.title).toBe("Hello");
    expect(result.current.data.faqs).toHaveLength(1);
    expect(result.current.data.teamMembers).toHaveLength(1);
  });

  // ── Forward navigation ─────────────────────────────────────────────────────

  it("blocks Next and surfaces an error when the current step is invalid", () => {
    const { result } = renderHook(() => useWizardState());
    let advanced = true;
    act(() => {
      advanced = result.current.next();
    });
    expect(advanced).toBe(false);
    expect(result.current.step).toBe(STEP.BASIC_INFO);
    expect(result.current.validationError).toBe("Contract ID is required.");
  });

  it("advances once the current step is valid", () => {
    const { result } = renderHook(() => useWizardState());
    fillBasicInfo(result);
    act(() => {
      result.current.next();
    });
    expect(result.current.step).toBe(STEP.MEDIA);
    expect(result.current.validationError).toBeNull();
  });

  it("clears a pending error as soon as a field is edited", () => {
    const { result } = renderHook(() => useWizardState());
    act(() => {
      result.current.next();
    });
    expect(result.current.validationError).toBeTruthy();
    act(() => result.current.set("title", "x"));
    expect(result.current.validationError).toBeNull();
  });

  it("moves to the preview from the last form step", () => {
    const { result } = renderHook(() => useWizardState());
    fillBasicInfo(result);
    for (let i = STEP.BASIC_INFO; i <= LAST_FORM_STEP; i++) {
      act(() => {
        result.current.next();
      });
    }
    expect(result.current.step).toBe(PREVIEW_STEP);
    expect(result.current.showPreview).toBe(true);
  });

  it("does not enter the preview when the full draft is invalid", () => {
    const { result } = renderHook(() => useWizardState());
    fillBasicInfo(result);
    // Valid basic info, but a fee address with no rate fails the config step.
    act(() => {
      result.current.set("feeAddress", "G123");
    });
    for (let i = STEP.BASIC_INFO; i <= LAST_FORM_STEP; i++) {
      act(() => {
        result.current.next();
      });
    }
    expect(result.current.showPreview).toBe(false);
    expect(result.current.validationError).toBe(
      "Provide fee bps when a fee address is set.",
    );
  });

  // ── Backward navigation ────────────────────────────────────────────────────

  it("steps back one step at a time", () => {
    const { result } = renderHook(() => useWizardState());
    fillBasicInfo(result);
    act(() => {
      result.current.next();
    });
    act(() => {
      result.current.next();
    });
    expect(result.current.step).toBe(STEP.FAQ_TEAM);
    act(() => result.current.back());
    expect(result.current.step).toBe(STEP.MEDIA);
  });

  it("does not go back past the first step", () => {
    const { result } = renderHook(() => useWizardState());
    act(() => result.current.back());
    expect(result.current.step).toBe(STEP.BASIC_INFO);
  });

  it("leaves the preview back to the last form step", () => {
    const { result } = renderHook(() => useWizardState());
    fillBasicInfo(result);
    for (let i = STEP.BASIC_INFO; i <= LAST_FORM_STEP; i++) {
      act(() => {
        result.current.next();
      });
    }
    expect(result.current.showPreview).toBe(true);
    act(() => result.current.back());
    expect(result.current.showPreview).toBe(false);
    expect(result.current.step).toBe(LAST_FORM_STEP);
  });

  it("preserves entered values across back-and-forward navigation", () => {
    const { result } = renderHook(() => useWizardState());
    fillBasicInfo(result);
    act(() => {
      result.current.next();
    });
    act(() => result.current.set("videoUrl", "https://example.com/v.mp4"));
    act(() => result.current.back());
    act(() => {
      result.current.next();
    });
    expect(result.current.step).toBe(STEP.MEDIA);
    expect(result.current.data.title).toBe("Test Campaign");
    expect(result.current.data.videoUrl).toBe("https://example.com/v.mp4");
  });

  it("clears the pending error when navigating back", () => {
    const { result } = renderHook(() => useWizardState());
    act(() => {
      result.current.next();
    });
    expect(result.current.validationError).toBeTruthy();
    act(() => result.current.back());
    expect(result.current.validationError).toBeNull();
  });

  // ── Draft restore ──────────────────────────────────────────────────────────

  it("restores a partial draft and jumps to its step", () => {
    const { result } = renderHook(() => useWizardState());
    act(() =>
      result.current.restore(
        { title: "Resumed", goal: "250" },
        STEP.PLATFORM_CONFIG,
      ),
    );
    expect(result.current.step).toBe(STEP.PLATFORM_CONFIG);
    expect(result.current.data.title).toBe("Resumed");
    expect(result.current.data.goal).toBe("250");
  });

  it("fills fields a draft does not carry with their defaults", () => {
    const { result } = renderHook(() => useWizardState());
    // Drafts persist only a subset of the form; faqs/teamMembers/category are
    // not among them, and must not come back undefined.
    act(() => result.current.restore({ title: "Resumed" }, STEP.FAQ_TEAM));
    expect(result.current.data.faqs).toEqual([]);
    expect(result.current.data.teamMembers).toEqual([]);
    expect(result.current.data.category).toBe("");
    expect(result.current.data.minContribution).toBe("1");
  });

  // ── Submission gate ────────────────────────────────────────────────────────

  it("reports an error from validateForSubmission for an incomplete draft", () => {
    const { result } = renderHook(() => useWizardState());
    let err: string | null = null;
    act(() => {
      err = result.current.validateForSubmission();
    });
    expect(err).toBe("Contract ID is required.");
    expect(result.current.validationError).toBe("Contract ID is required.");
  });

  it("passes validateForSubmission for a complete draft", () => {
    const { result } = renderHook(() => useWizardState());
    fillBasicInfo(result);
    let err: string | null = "unset";
    act(() => {
      err = result.current.validateForSubmission();
    });
    expect(err).toBeNull();
    expect(result.current.validationError).toBeNull();
  });
});
