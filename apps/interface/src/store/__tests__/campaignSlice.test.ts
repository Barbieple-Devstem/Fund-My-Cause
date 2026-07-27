/**
 * Unit tests for campaignSlice — reducers, actions, and selectors.
 * Completely isolated: no React, no network, no other slices.
 */

import { useCampaignStore } from "../campaignSlice";
import {
  selectActiveCampaignId,
  selectOptimisticDelta,
  selectPledgeModalOpen,
  selectPledgeAmountDraft,
} from "../campaignSlice";

// Capture the pristine initial state so every test starts clean.
const INITIAL = useCampaignStore.getState();

beforeEach(() => {
  useCampaignStore.setState(INITIAL, true);
});

// ── setActiveCampaign ─────────────────────────────────────────────────────────

describe("setActiveCampaign", () => {
  it("sets the active campaign ID", () => {
    useCampaignStore.getState().setActiveCampaign("CONTRACT_A");
    expect(useCampaignStore.getState().activeCampaignId).toBe("CONTRACT_A");
  });

  it("clears the active campaign when null is passed", () => {
    useCampaignStore.getState().setActiveCampaign("CONTRACT_A");
    useCampaignStore.getState().setActiveCampaign(null);
    expect(useCampaignStore.getState().activeCampaignId).toBeNull();
  });
});

// ── applyOptimisticContribution ───────────────────────────────────────────────

describe("applyOptimisticContribution", () => {
  const CONTRACT = "CONTRACT_A";

  it("creates a new delta entry from zero", () => {
    useCampaignStore.getState().applyOptimisticContribution(CONTRACT, 10);
    const delta = useCampaignStore.getState().optimisticDeltas[CONTRACT];
    expect(delta).toBeDefined();
    // 10 XLM = 100_000_000 stroops
    expect(delta.raisedDelta).toBe(BigInt(100_000_000));
    expect(delta.countDelta).toBe(1);
  });

  it("accumulates multiple contributions", () => {
    useCampaignStore.getState().applyOptimisticContribution(CONTRACT, 5);
    useCampaignStore.getState().applyOptimisticContribution(CONTRACT, 3);
    const delta = useCampaignStore.getState().optimisticDeltas[CONTRACT];
    // 5 + 3 = 8 XLM = 80_000_000 stroops
    expect(delta.raisedDelta).toBe(BigInt(80_000_000));
    expect(delta.countDelta).toBe(2);
  });

  it("tracks deltas per contract independently", () => {
    useCampaignStore.getState().applyOptimisticContribution("C1", 10);
    useCampaignStore.getState().applyOptimisticContribution("C2", 20);
    const { optimisticDeltas } = useCampaignStore.getState();
    expect(optimisticDeltas["C1"].raisedDelta).toBe(BigInt(100_000_000));
    expect(optimisticDeltas["C2"].raisedDelta).toBe(BigInt(200_000_000));
  });

  it("handles fractional XLM amounts", () => {
    // 0.5 XLM = 5_000_000 stroops
    useCampaignStore.getState().applyOptimisticContribution(CONTRACT, 0.5);
    const delta = useCampaignStore.getState().optimisticDeltas[CONTRACT];
    expect(delta.raisedDelta).toBe(BigInt(5_000_000));
  });
});

// ── rollbackOptimistic ────────────────────────────────────────────────────────

describe("rollbackOptimistic", () => {
  it("removes the delta entry for the given contract", () => {
    useCampaignStore.getState().applyOptimisticContribution("C1", 10);
    useCampaignStore.getState().rollbackOptimistic("C1");
    expect(useCampaignStore.getState().optimisticDeltas["C1"]).toBeUndefined();
  });

  it("does not affect other contracts", () => {
    useCampaignStore.getState().applyOptimisticContribution("C1", 10);
    useCampaignStore.getState().applyOptimisticContribution("C2", 20);
    useCampaignStore.getState().rollbackOptimistic("C1");
    expect(useCampaignStore.getState().optimisticDeltas["C2"]).toBeDefined();
  });

  it("is a no-op when no delta exists", () => {
    expect(() =>
      useCampaignStore.getState().rollbackOptimistic("GHOST"),
    ).not.toThrow();
  });
});

// ── clearOptimistic ───────────────────────────────────────────────────────────

describe("clearOptimistic", () => {
  it("removes the delta entry (alias of rollback)", () => {
    useCampaignStore.getState().applyOptimisticContribution("C1", 5);
    useCampaignStore.getState().clearOptimistic("C1");
    expect(useCampaignStore.getState().optimisticDeltas["C1"]).toBeUndefined();
  });
});

// ── openPledgeModal / closePledgeModal ────────────────────────────────────────

describe("pledge modal actions", () => {
  it("opens the pledge modal", () => {
    useCampaignStore.getState().openPledgeModal();
    expect(useCampaignStore.getState().pledgeModalOpen).toBe(true);
  });

  it("sets the active campaign when opening with a campaign ID", () => {
    useCampaignStore.getState().openPledgeModal("CONTRACT_X");
    expect(useCampaignStore.getState().pledgeModalOpen).toBe(true);
    expect(useCampaignStore.getState().activeCampaignId).toBe("CONTRACT_X");
  });

  it("preserves existing active campaign when no ID is passed", () => {
    useCampaignStore.getState().setActiveCampaign("EXISTING");
    useCampaignStore.getState().openPledgeModal();
    expect(useCampaignStore.getState().activeCampaignId).toBe("EXISTING");
  });

  it("closes the pledge modal and resets the draft", () => {
    useCampaignStore.getState().openPledgeModal();
    useCampaignStore.getState().setPledgeAmountDraft("42");
    useCampaignStore.getState().closePledgeModal();
    expect(useCampaignStore.getState().pledgeModalOpen).toBe(false);
    expect(useCampaignStore.getState().pledgeAmountDraft).toBe("");
  });
});

// ── setPledgeAmountDraft ──────────────────────────────────────────────────────

describe("setPledgeAmountDraft", () => {
  it("stores the typed pledge amount", () => {
    useCampaignStore.getState().setPledgeAmountDraft("100");
    expect(useCampaignStore.getState().pledgeAmountDraft).toBe("100");
  });

  it("allows empty string to clear the draft", () => {
    useCampaignStore.getState().setPledgeAmountDraft("50");
    useCampaignStore.getState().setPledgeAmountDraft("");
    expect(useCampaignStore.getState().pledgeAmountDraft).toBe("");
  });
});

// ── resetPledgeFlow ───────────────────────────────────────────────────────────

describe("resetPledgeFlow", () => {
  it("closes the modal and clears the draft", () => {
    useCampaignStore.getState().openPledgeModal("C1");
    useCampaignStore.getState().setPledgeAmountDraft("99");
    useCampaignStore.getState().resetPledgeFlow();
    expect(useCampaignStore.getState().pledgeModalOpen).toBe(false);
    expect(useCampaignStore.getState().pledgeAmountDraft).toBe("");
  });
});

// ── Selectors ─────────────────────────────────────────────────────────────────

describe("selectors", () => {
  it("selectActiveCampaignId returns the active ID", () => {
    useCampaignStore.getState().setActiveCampaign("SEL_TEST");
    const state = useCampaignStore.getState();
    expect(selectActiveCampaignId(state)).toBe("SEL_TEST");
  });

  it("selectOptimisticDelta returns the delta for a known contract", () => {
    useCampaignStore.getState().applyOptimisticContribution("C1", 1);
    const state = useCampaignStore.getState();
    const delta = selectOptimisticDelta("C1")(state);
    expect(delta).not.toBeNull();
    expect(delta!.countDelta).toBe(1);
  });

  it("selectOptimisticDelta returns null for an unknown contract", () => {
    const state = useCampaignStore.getState();
    expect(selectOptimisticDelta("UNKNOWN")(state)).toBeNull();
  });

  it("selectPledgeModalOpen reflects modal state", () => {
    useCampaignStore.getState().openPledgeModal();
    expect(selectPledgeModalOpen(useCampaignStore.getState())).toBe(true);
    useCampaignStore.getState().closePledgeModal();
    expect(selectPledgeModalOpen(useCampaignStore.getState())).toBe(false);
  });

  it("selectPledgeAmountDraft reflects the draft", () => {
    useCampaignStore.getState().setPledgeAmountDraft("77");
    expect(selectPledgeAmountDraft(useCampaignStore.getState())).toBe("77");
  });
});
