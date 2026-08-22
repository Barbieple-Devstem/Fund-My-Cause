/**
 * campaignSlice — transient campaign UI state.
 *
 * Intentionally does NOT duplicate React Query's server-cached data
 * (info, stats, contributions).  It only holds ephemeral state that
 * belongs to the client session:
 *   • which campaign is "active" (selected for pledge / detail view)
 *   • optimistic contribution deltas (amount, contributor count)
 *   • pledge modal open/closed flag
 *   • current pledge amount draft
 *
 * All other campaign data lives in React Query (see useCampaign hook).
 */

import { create } from "zustand";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OptimisticDelta {
  /** Contribution delta in stroops (1 XLM = 10_000_000 stroops). */
  raisedDelta: bigint;
  /** Change in contributor head-count. */
  countDelta: number;
}

export interface CampaignSliceState {
  /** The contract ID of the currently focused campaign, or null. */
  activeCampaignId: string | null;
  /** Optimistic contribution delta keyed by contractId. */
  optimisticDeltas: Record<string, OptimisticDelta>;
  /** Whether the pledge modal is open. */
  pledgeModalOpen: boolean;
  /** Current user-typed pledge amount (XLM) before submission. */
  pledgeAmountDraft: string;

  // ── Actions ────────────────────────────────────────────────────────────────

  setActiveCampaign: (id: string | null) => void;
  applyOptimisticContribution: (contractId: string, amountXlm: number) => void;
  rollbackOptimistic: (contractId: string) => void;
  clearOptimistic: (contractId: string) => void;
  openPledgeModal: (campaignId?: string) => void;
  closePledgeModal: () => void;
  setPledgeAmountDraft: (amount: string) => void;
  resetPledgeFlow: () => void;
}

// ── Selectors ─────────────────────────────────────────────────────────────────

/** Returns the active campaign ID. */
export const selectActiveCampaignId = (s: CampaignSliceState) =>
  s.activeCampaignId;

/** Returns the optimistic delta for a given contract, or null. */
export const selectOptimisticDelta =
  (contractId: string) => (s: CampaignSliceState) =>
    s.optimisticDeltas[contractId] ?? null;

/** Returns true when the pledge modal is open. */
export const selectPledgeModalOpen = (s: CampaignSliceState) =>
  s.pledgeModalOpen;

/** Returns the current pledge amount draft string. */
export const selectPledgeAmountDraft = (s: CampaignSliceState) =>
  s.pledgeAmountDraft;

// ── Store ─────────────────────────────────────────────────────────────────────

export const useCampaignStore = create<CampaignSliceState>((set) => ({
  activeCampaignId: null,
  optimisticDeltas: {},
  pledgeModalOpen: false,
  pledgeAmountDraft: "",

  setActiveCampaign: (id) => set({ activeCampaignId: id }),

  applyOptimisticContribution: (contractId, amountXlm) => {
    const stroops = BigInt(Math.round(amountXlm * 1e7));
    set((state) => ({
      optimisticDeltas: {
        ...state.optimisticDeltas,
        [contractId]: {
          raisedDelta:
            (state.optimisticDeltas[contractId]?.raisedDelta ?? 0n) + stroops,
          countDelta: (state.optimisticDeltas[contractId]?.countDelta ?? 0) + 1,
        },
      },
    }));
  },

  rollbackOptimistic: (contractId) =>
    set((state) => {
      const next = { ...state.optimisticDeltas };
      delete next[contractId];
      return { optimisticDeltas: next };
    }),

  clearOptimistic: (contractId) =>
    set((state) => {
      const next = { ...state.optimisticDeltas };
      delete next[contractId];
      return { optimisticDeltas: next };
    }),

  openPledgeModal: (campaignId) =>
    set((state) => ({
      pledgeModalOpen: true,
      activeCampaignId: campaignId ?? state.activeCampaignId,
    })),

  closePledgeModal: () =>
    set({ pledgeModalOpen: false, pledgeAmountDraft: "" }),

  setPledgeAmountDraft: (amount) => set({ pledgeAmountDraft: amount }),

  resetPledgeFlow: () => set({ pledgeModalOpen: false, pledgeAmountDraft: "" }),
}));
