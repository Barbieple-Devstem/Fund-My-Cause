/**
 * useCampaignSlice — scoped selector hook for campaign UI state.
 *
 * Returns the narrowest stable snapshot of the campaign slice that
 * a component needs.  Consumers should destructure only what they use
 * so Zustand's shallow-equality check avoids unrelated re-renders.
 *
 * Usage:
 *   const { pledgeModalOpen, openPledgeModal } = useCampaignSlice();
 *   const { activeCampaignId } = useCampaignSlice();
 */

"use client";

import { useShallow } from "zustand/react/shallow";
import {
  useCampaignStore,
  type CampaignSliceState,
} from "@/store/campaignSlice";

/** Full campaign slice state + actions. */
export function useCampaignSlice(): CampaignSliceState {
  return useCampaignStore(
    useShallow((s) => ({
      activeCampaignId: s.activeCampaignId,
      optimisticDeltas: s.optimisticDeltas,
      pledgeModalOpen: s.pledgeModalOpen,
      pledgeAmountDraft: s.pledgeAmountDraft,
      setActiveCampaign: s.setActiveCampaign,
      applyOptimisticContribution: s.applyOptimisticContribution,
      rollbackOptimistic: s.rollbackOptimistic,
      clearOptimistic: s.clearOptimistic,
      openPledgeModal: s.openPledgeModal,
      closePledgeModal: s.closePledgeModal,
      setPledgeAmountDraft: s.setPledgeAmountDraft,
      resetPledgeFlow: s.resetPledgeFlow,
    })),
  );
}

/**
 * Returns only the pledge-modal fields.
 * Use when a component only cares about open/close state and the draft amount.
 */
export function usePledgeModal() {
  return useCampaignStore(
    useShallow((s) => ({
      pledgeModalOpen: s.pledgeModalOpen,
      pledgeAmountDraft: s.pledgeAmountDraft,
      openPledgeModal: s.openPledgeModal,
      closePledgeModal: s.closePledgeModal,
      setPledgeAmountDraft: s.setPledgeAmountDraft,
      resetPledgeFlow: s.resetPledgeFlow,
    })),
  );
}

/**
 * Returns the optimistic delta for a specific contract ID.
 * Returns null when no delta is pending.
 */
export function useOptimisticDelta(contractId: string) {
  return useCampaignStore((s) => s.optimisticDeltas[contractId] ?? null);
}
