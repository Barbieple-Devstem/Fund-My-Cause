import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReferralProgram } from "./ReferralProgram";
import type { GamificationProfile, Referral } from "@/types/gamification";

const userProfile: GamificationProfile = {
  address: "GUSER0000000000000000000000000000000000000000000000000",
  achievements: [],
  totalPoints: 100,
  contributionStreak: 1,
  referralCode: "FMABC123",
  referralsCount: 2,
  level: 1,
};

const referrals: Referral[] = [
  {
    referrerAddress: userProfile.address,
    refereeAddress: "GREF00000000000000000000000000000000000000000000000000",
    referralCode: "FMABC123",
    createdAt: Date.now(),
    firstContributionAt: Date.now(),
    rewardClaimed: false,
    rewardAmount: 500_000_000,
  },
];

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
});

describe("ReferralProgram", () => {
  it("shows a loading state", () => {
    render(<ReferralProgram loading />);
    expect(screen.getByText(/loading referral program/i)).toBeInTheDocument();
  });

  it("displays the referral code and copies it on click", async () => {
    const onCopyCode = jest.fn();
    render(<ReferralProgram userProfile={userProfile} onCopyCode={onCopyCode} />);
    expect(screen.getByText("FMABC123")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle(/copy referral code/i));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("FMABC123");
    expect(onCopyCode).toHaveBeenCalledWith("FMABC123");
    await waitFor(() =>
      expect(screen.getByTitle(/copy referral code/i)).toBeInTheDocument()
    );
  });

  it("fires onShare with the platform name when a share button is clicked", () => {
    const onShare = jest.fn();
    render(<ReferralProgram userProfile={userProfile} onShare={onShare} />);
    fireEvent.click(screen.getByRole("button", { name: /share on twitter/i }));
    expect(onShare).toHaveBeenCalledWith("Twitter");
  });

  it("splits referrals into active and pending lists", () => {
    render(<ReferralProgram userProfile={userProfile} referrals={referrals} />);
    expect(screen.getByText(/1 active, 0 pending/i)).toBeInTheDocument();
  });

  it("shows the empty state when there are no referrals", () => {
    render(<ReferralProgram userProfile={userProfile} referrals={[]} />);
    expect(screen.getByText(/no referrals yet/i)).toBeInTheDocument();
  });
});
