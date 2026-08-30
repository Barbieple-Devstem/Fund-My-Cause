/**
 * Regression tests for CampaignActions state transitions — Issue #1180
 *
 * The real "state machine" for campaign actions lives in two places:
 *
 *   1. `campaignActionsState.ts`  → `deriveCampaignActionEligibility()`
 *      Pure function mapping (campaignStatus, deadlinePassed, goalMet,
 *      isCreator, hasContribution) to which *actions* are permitted:
 *        - canWithdraw  (creator withdrawing raised funds)
 *        - canRefund    (backer claiming a refund)
 *
 *   2. `CampaignActions.tsx`  → renders the actual buttons, gating them on
 *      the eligibility above plus the live `campaignStatus`:
 *        - Pledge      : only while status === 'Active' && !deadlinePassed
 *        - Withdraw    : only when `canWithdraw`
 *        - Claim Refund: only when `canRefund`
 *        - Paused      : a disabled "Contributions Paused" button
 *
 * The canonical campaign statuses (see @fund-my-cause/types CAMPAIGN_STATUS_VALUES)
 * are: Active, Successful, Refunded, Cancelled, Paused, Archived. The issue
 * description's "draft→active→funded→closed" is an abstraction of this real
 * machine, which is what these tests pin down.
 *
 * Tests cover every valid transition (an action becoming available / firing),
 * every invalid one (an action that must stay disabled or absent), boundary
 * states (already-funded / already-refunded / archived), and the disabled UI
 * contract for invalid actions.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CampaignActions } from "./CampaignActions";
import { deriveCampaignActionEligibility } from "./campaignActionsState";
import type { CampaignStatus } from "@fund-my-cause/types";

// ── Mock the action hook so we drive the UI from a known state ────────────────
let mockHook: Record<string, unknown>;

jest.mock("./useCampaignActions", () => ({
  useCampaignActions: jest.fn(() => mockHook),
}));

// The lazy pledge modal is irrelevant to action gating — render a stub.
jest.mock("@/lib/lazy-components", () => ({
  LazyPledgeModal: ({ onClose }: { onClose: () => void }) => (
    <button data-testid="pledge-modal" onClick={onClose} type="button">
      Pledge Modal
    </button>
  ),
}));

jest.mock("@/components/ui/TransactionStatus", () => ({
  TransactionStatus: () => null,
}));

const CREATOR = "GCREATOR";
const BACKER = "GBACKER";

function baseHook(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    address: BACKER,
    networkMismatch: false,
    pledging: false,
    setPledging: jest.fn(),
    userContribution: 0,
    campaignStatus: "Active" as CampaignStatus,
    raised: 0,
    txStatus: "idle",
    txHash: "",
    txError: "",
    isProcessing: false,
    isCreator: false,
    canWithdraw: false,
    canRefund: false,
    handleWithdraw: jest.fn(),
    handleRefund: jest.fn(),
    handleDismiss: jest.fn(),
    handlePledgeSuccess: jest.fn(),
    handlePledgeClick: jest.fn(),
    ...overrides,
  };
}

function renderCampaign(
  props: Record<string, unknown> = {},
  hookOverrides: Record<string, unknown> = {},
) {
  mockHook = baseHook(hookOverrides);
  return render(
    <CampaignActions
      contractId="CTEST"
      creator={CREATOR}
      deadlinePassed={false}
      goalMet={false}
      campaignTitle="Help the Reef"
      status={hookOverrides.campaignStatus ?? ("Active" as CampaignStatus)}
      {...props}
    />,
  );
}

// ── 1. Pure eligibility state machine ──────────────────────────────────────────

describe("deriveCampaignActionEligibility — campaign action state machine", () => {
  // A compact table of (input) → expected (isCreator, canWithdraw, canRefund).
  // Each row is one state/transition in the real machine.
  const cases: Array<{
    name: string;
    address: string | null;
    creator: string;
    campaignStatus: CampaignStatus;
    deadlinePassed: boolean;
    goalMet: boolean;
    userContribution: number;
    expect: { isCreator: boolean; canWithdraw: boolean; canRefund: boolean };
  }> = [
    // ── Active, still open for pledges ──
    {
      name: "Active + open: backer cannot withdraw/refund (pledge only)",
      address: BACKER,
      creator: CREATOR,
      campaignStatus: "Active",
      deadlinePassed: false,
      goalMet: false,
      userContribution: 0,
      expect: { isCreator: false, canWithdraw: false, canRefund: false },
    },
    // ── Active, deadline passed, goal met → creator may withdraw ──
    {
      name: "Active + deadlinePassed + goalMet + creator: canWithdraw (valid)",
      address: CREATOR,
      creator: CREATOR,
      campaignStatus: "Active",
      deadlinePassed: true,
      goalMet: true,
      userContribution: 0,
      expect: { isCreator: true, canWithdraw: true, canRefund: false },
    },
    {
      name: "Active + deadlinePassed + goalMet + backer: cannot withdraw (invalid)",
      address: BACKER,
      creator: CREATOR,
      campaignStatus: "Active",
      deadlinePassed: true,
      goalMet: true,
      userContribution: 0,
      expect: { isCreator: false, canWithdraw: false, canRefund: false },
    },
    // ── Active, deadline passed, goal NOT met → backer may refund ──
    {
      name: "Active + deadlinePassed + !goalMet + backer w/ contribution: canRefund (valid)",
      address: BACKER,
      creator: CREATOR,
      campaignStatus: "Active",
      deadlinePassed: true,
      goalMet: false,
      userContribution: 150,
      expect: { isCreator: false, canWithdraw: false, canRefund: true },
    },
    {
      name: "Active + deadlinePassed + !goalMet + backer no contribution: cannot refund (invalid)",
      address: BACKER,
      creator: CREATOR,
      campaignStatus: "Active",
      deadlinePassed: true,
      goalMet: false,
      userContribution: 0,
      expect: { isCreator: false, canWithdraw: false, canRefund: false },
    },
    // ── Successful: creator may withdraw (already-funded boundary) ──
    {
      name: "Successful + creator: canWithdraw (valid, already-funded)",
      address: CREATOR,
      creator: CREATOR,
      campaignStatus: "Successful",
      deadlinePassed: false,
      goalMet: true,
      userContribution: 0,
      expect: { isCreator: true, canWithdraw: true, canRefund: false },
    },
    {
      name: "Successful + backer: cannot withdraw (invalid)",
      address: BACKER,
      creator: CREATOR,
      campaignStatus: "Successful",
      deadlinePassed: false,
      goalMet: true,
      userContribution: 0,
      expect: { isCreator: false, canWithdraw: false, canRefund: false },
    },
    // ── Cancelled: backer may refund ──
    {
      name: "Cancelled + backer w/ contribution: canRefund (valid)",
      address: BACKER,
      creator: CREATOR,
      campaignStatus: "Cancelled",
      deadlinePassed: false,
      goalMet: false,
      userContribution: 200,
      expect: { isCreator: false, canWithdraw: false, canRefund: true },
    },
    {
      name: "Cancelled + backer no contribution: cannot refund (invalid)",
      address: BACKER,
      creator: CREATOR,
      campaignStatus: "Cancelled",
      deadlinePassed: false,
      goalMet: false,
      userContribution: 0,
      expect: { isCreator: false, canWithdraw: false, canRefund: false },
    },
    {
      name: "Cancelled + no wallet: cannot refund (invalid, prerequisite unmet)",
      address: null,
      creator: CREATOR,
      campaignStatus: "Cancelled",
      deadlinePassed: false,
      goalMet: false,
      userContribution: 200,
      expect: { isCreator: false, canWithdraw: false, canRefund: false },
    },
    // ── Refunded: nothing left to do (already-closed boundary) ──
    {
      name: "Refunded + backer w/ contribution: cannot refund again (invalid)",
      address: BACKER,
      creator: CREATOR,
      campaignStatus: "Refunded",
      deadlinePassed: false,
      goalMet: false,
      userContribution: 200,
      expect: { isCreator: false, canWithdraw: false, canRefund: false },
    },
    // ── Paused: no withdraw/refund ──
    {
      name: "Paused + creator: cannot withdraw/refund (invalid)",
      address: CREATOR,
      creator: CREATOR,
      campaignStatus: "Paused",
      deadlinePassed: false,
      goalMet: false,
      userContribution: 0,
      expect: { isCreator: true, canWithdraw: false, canRefund: false },
    },
    // ── Archived: fully closed, no actions ──
    {
      name: "Archived + creator: no actions (invalid)",
      address: CREATOR,
      creator: CREATOR,
      campaignStatus: "Archived",
      deadlinePassed: false,
      goalMet: false,
      userContribution: 0,
      expect: { isCreator: true, canWithdraw: false, canRefund: false },
    },
  ];

  it.each(cases)("$name", (c) => {
    const result = deriveCampaignActionEligibility({
      address: c.address,
      creator: c.creator,
      campaignStatus: c.campaignStatus,
      deadlinePassed: c.deadlinePassed,
      goalMet: c.goalMet,
      userContribution: c.userContribution,
    });
    expect(result.isCreator).toBe(c.expect.isCreator);
    expect(result.canWithdraw).toBe(c.expect.canWithdraw);
    expect(result.canRefund).toBe(c.expect.canRefund);
  });

  it("isCreator is false when the connected wallet is not the creator", () => {
    const r = deriveCampaignActionEligibility({
      address: BACKER,
      creator: CREATOR,
      campaignStatus: "Active",
      deadlinePassed: false,
      goalMet: false,
      userContribution: 0,
    });
    expect(r.isCreator).toBe(false);
  });

  it("isCreator is false when no wallet is connected", () => {
    const r = deriveCampaignActionEligibility({
      address: null,
      creator: CREATOR,
      campaignStatus: "Successful",
      deadlinePassed: false,
      goalMet: true,
      userContribution: 0,
    });
    expect(r.isCreator).toBe(false);
  });
});

// ── 2. UI: valid transitions (action becomes available and fires) ─────────────

describe("CampaignActions UI — valid transitions", () => {
  it("renders an enabled Pledge button while Active and open, and fires on click", () => {
    renderCampaign(
      { status: "Active" },
      { campaignStatus: "Active", address: BACKER },
    );

    const pledge = screen.getByRole("button", {
      name: "Pledge to Help the Reef",
    }) as HTMLButtonElement;
    expect(pledge).toBeEnabled();

    fireEvent.click(pledge);
    expect(mockHook.handlePledgeClick).toHaveBeenCalledTimes(1);
  });

  it("shows a Connect-wallet Pledge button when no wallet is connected", () => {
    renderCampaign(
      { status: "Active" },
      { campaignStatus: "Active", address: null },
    );

    const pledge = screen.getByRole("button", {
      name: "Connect wallet to pledge",
    }) as HTMLButtonElement;
    expect(pledge).toBeEnabled();

    fireEvent.click(pledge);
    expect(mockHook.handlePledgeClick).toHaveBeenCalledTimes(1);
  });

  it("renders an enabled Withdraw button when the creator may withdraw (Successful)", () => {
    renderCampaign(
      { status: "Successful" },
      {
        campaignStatus: "Successful",
        address: CREATOR,
        isCreator: true,
        canWithdraw: true,
      },
    );

    const withdraw = screen.getByRole("button", {
      name: "Withdraw campaign funds",
    }) as HTMLButtonElement;
    expect(withdraw).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Pledge/i })).toBeNull();

    fireEvent.click(withdraw);
    expect(mockHook.handleWithdraw).toHaveBeenCalledTimes(1);
  });

  it("renders an enabled Withdraw button for Active+deadlinePassed+goalMet creator", () => {
    renderCampaign(
      { status: "Active", deadlinePassed: true, goalMet: true },
      {
        campaignStatus: "Active",
        deadlinePassed: true,
        goalMet: true,
        address: CREATOR,
        isCreator: true,
        canWithdraw: true,
      },
    );

    const withdraw = screen.getByRole("button", {
      name: "Withdraw campaign funds",
    }) as HTMLButtonElement;
    expect(withdraw).toBeEnabled();
  });

  it("renders an enabled Claim Refund button when the backer may refund (Cancelled)", () => {
    renderCampaign(
      { status: "Cancelled" },
      {
        campaignStatus: "Cancelled",
        address: BACKER,
        userContribution: 200,
        canRefund: true,
      },
    );

    const refund = screen.getByRole("button", {
      name: /Claim refund/i,
    }) as HTMLButtonElement;
    expect(refund).toBeEnabled();

    fireEvent.click(refund);
    expect(mockHook.handleRefund).toHaveBeenCalledTimes(1);
  });

  it("renders an enabled Claim Refund button for Active+deadlinePassed+!goalMet backer", () => {
    renderCampaign(
      { status: "Active", deadlinePassed: true, goalMet: false },
      {
        campaignStatus: "Active",
        deadlinePassed: true,
        goalMet: false,
        address: BACKER,
        userContribution: 150,
        canRefund: true,
      },
    );

    expect(screen.getByRole("button", { name: /Claim refund/i })).toBeEnabled();
  });
});

// ── 3. UI: invalid transitions (action stays disabled or absent) ───────────────

describe("CampaignActions UI — invalid transitions", () => {
  it("does NOT render Pledge for a non-Active campaign (cannot pledge after close)", () => {
    renderCampaign(
      { status: "Successful" },
      { campaignStatus: "Successful", address: BACKER },
    );
    expect(screen.queryByRole("button", { name: /Pledge/i })).toBeNull();
  });

  it("does NOT render Pledge once the deadline has passed (even if Active)", () => {
    renderCampaign(
      { status: "Active", deadlinePassed: true },
      { campaignStatus: "Active", deadlinePassed: true, address: BACKER },
    );
    expect(screen.queryByRole("button", { name: /Pledge/i })).toBeNull();
  });

  it("disables Pledge when the wallet network mismatches", () => {
    renderCampaign(
      { status: "Active" },
      { campaignStatus: "Active", address: BACKER, networkMismatch: true },
    );
    const pledge = screen.getByRole("button", {
      name: "Pledge to Help the Reef",
    }) as HTMLButtonElement;
    expect(pledge).toBeDisabled();
    fireEvent.click(pledge);
    expect(mockHook.handlePledgeClick).not.toHaveBeenCalled();
  });

  it("disables Pledge while a transaction is processing", () => {
    renderCampaign(
      { status: "Active" },
      { campaignStatus: "Active", address: BACKER, isProcessing: true },
    );
    const pledge = screen.getByRole("button", {
      name: "Pledge to Help the Reef",
    }) as HTMLButtonElement;
    expect(pledge).toBeDisabled();
  });

  it("does NOT render Withdraw when the user is not eligible (prerequisites unmet)", () => {
    renderCampaign(
      { status: "Active", deadlinePassed: true, goalMet: true },
      {
        campaignStatus: "Active",
        deadlinePassed: true,
        goalMet: true,
        address: BACKER, // backer, not creator
        isCreator: false,
        canWithdraw: false,
      },
    );
    expect(
      screen.queryByRole("button", { name: "Withdraw campaign funds" }),
    ).toBeNull();
  });

  it("disables Withdraw while processing even when eligible", () => {
    renderCampaign(
      { status: "Successful" },
      {
        campaignStatus: "Successful",
        address: CREATOR,
        isCreator: true,
        canWithdraw: true,
        isProcessing: true,
      },
    );
    const withdraw = screen.getByRole("button", {
      name: "Withdraw campaign funds",
    }) as HTMLButtonElement;
    expect(withdraw).toBeDisabled();
    fireEvent.click(withdraw);
    expect(mockHook.handleWithdraw).not.toHaveBeenCalled();
  });

  it("does NOT render Claim Refund when the backer has no contribution", () => {
    renderCampaign(
      { status: "Cancelled" },
      {
        campaignStatus: "Cancelled",
        address: BACKER,
        userContribution: 0,
        canRefund: false,
      },
    );
    expect(screen.queryByRole("button", { name: /Claim refund/i })).toBeNull();
  });

  it("disables Claim Refund while processing even when eligible", () => {
    renderCampaign(
      { status: "Cancelled" },
      {
        campaignStatus: "Cancelled",
        address: BACKER,
        userContribution: 200,
        canRefund: true,
        isProcessing: true,
      },
    );
    const refund = screen.getByRole("button", {
      name: /Claim refund/i,
    }) as HTMLButtonElement;
    expect(refund).toBeDisabled();
    fireEvent.click(refund);
    expect(mockHook.handleRefund).not.toHaveBeenCalled();
  });
});

// ── 4. UI: boundary / terminal states ──────────────────────────────────────────

describe("CampaignActions UI — boundary & terminal states", () => {
  it("Paused shows a disabled Contributions Paused button and no other actions", () => {
    renderCampaign(
      { status: "Paused" },
      {
        campaignStatus: "Paused",
        address: CREATOR,
        isCreator: true,
        canWithdraw: false,
      },
    );

    const paused = screen.getByRole("button", {
      name: "Contributions Paused",
    }) as HTMLButtonElement;
    expect(paused).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Pledge/i })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Withdraw campaign funds" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Claim refund/i })).toBeNull();
  });

  it("Refunded (already-closed) renders no actionable buttons", () => {
    renderCampaign(
      { status: "Refunded" },
      {
        campaignStatus: "Refunded",
        address: BACKER,
        userContribution: 200,
        canRefund: false,
      },
    );
    expect(screen.queryByRole("button", { name: /Pledge/i })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Withdraw campaign funds" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Claim refund/i })).toBeNull();
  });

  it("Archived (fully closed) renders no actionable buttons", () => {
    renderCampaign(
      { status: "Archived" },
      { campaignStatus: "Archived", address: CREATOR, isCreator: true },
    );
    expect(screen.queryByRole("button", { name: /Pledge/i })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Withdraw campaign funds" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Claim refund/i })).toBeNull();
  });

  it("Successful (already-funded) offers Withdraw but no Pledge/Refund", () => {
    renderCampaign(
      { status: "Successful" },
      {
        campaignStatus: "Successful",
        address: CREATOR,
        isCreator: true,
        canWithdraw: true,
      },
    );
    expect(
      screen.getByRole("button", { name: "Withdraw campaign funds" }),
    ).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Pledge/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Claim refund/i })).toBeNull();
  });
});
