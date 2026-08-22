import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AchievementSystem } from "./AchievementSystem";
import type { Achievement, AchievementProgress } from "@/types/gamification";

const unlocked: Achievement = {
  id: "ach_1",
  type: "first_contribution" as any,
  tier: "common",
  title: "First Step",
  description: "Make your first contribution",
  icon: "🎬",
  earnedAt: Date.now() - 1000,
};

const locked: AchievementProgress = {
  type: "mega_donor" as any,
  title: "Mega Donor",
  description: "Reach 1000 XLM",
  progress: 350,
  required: 1000,
  isUnlocked: false,
  icon: "💰",
  tier: "rare",
};

describe("AchievementSystem", () => {
  it("shows a loading state", () => {
    render(<AchievementSystem loading />);
    expect(screen.getByText(/loading achievements/i)).toBeInTheDocument();
  });

  it("renders unlocked and in-progress achievements with correct counts", () => {
    render(<AchievementSystem achievements={[unlocked]} progressData={[locked]} />);
    expect(screen.getByText("1/1")).toBeInTheDocument();
    expect(screen.getByText(/unlocked \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/in progress \(1\)/i)).toBeInTheDocument();
  });

  it("opens the detail modal and fires the share callback", () => {
    const onShare = jest.fn();
    render(
      <AchievementSystem
        achievements={[unlocked]}
        onShareAchievement={onShare}
      />
    );
    fireEvent.click(screen.getAllByText("First Step")[0]);
    fireEvent.click(screen.getByRole("button", { name: /share achievement/i }));
    expect(onShare).toHaveBeenCalledWith(unlocked);
  });

  it("shows the empty state on the unlocked tab when nothing is earned", () => {
    render(<AchievementSystem achievements={[]} progressData={[locked]} />);
    fireEvent.click(screen.getByRole("button", { name: /^unlocked/i }));
    expect(screen.getByText(/no achievements unlocked yet/i)).toBeInTheDocument();
  });
});
