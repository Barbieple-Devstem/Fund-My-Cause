import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Leaderboard } from "./Leaderboard";
import type { LeaderboardEntry } from "@/types/gamification";

const entries: LeaderboardEntry[] = [
  { rank: 1, address: "GAAA1111111111111111111111111111111111111111111111111", totalPoints: 500, contributionCount: 5, level: 3, achievements: 2 },
  { rank: 2, address: "GBBB2222222222222222222222222222222222222222222222222", totalPoints: 300, contributionCount: 3, level: 2, achievements: 1 },
];

describe("Leaderboard", () => {
  it("shows a loading state", () => {
    render(<Leaderboard entries={[]} loading />);
    expect(screen.getByText(/loading leaderboard/i)).toBeInTheDocument();
  });

  it("renders rows in rank order and highlights the current user", () => {
    render(<Leaderboard entries={entries} userAddress={entries[0].address} />);
    const rows = screen.getAllByRole("row").slice(1); // skip header row
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("500");
    expect(rows[1]).toHaveTextContent("300");
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText(/your rank: #1/i)).toBeInTheDocument();
  });

  it("calls onTypeChange and onTimeframeChange when controls are clicked", () => {
    const onTypeChange = jest.fn();
    const onTimeframeChange = jest.fn();
    render(
      <Leaderboard
        entries={entries}
        onTypeChange={onTypeChange}
        onTimeframeChange={onTimeframeChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^referrals$/i }));
    expect(onTypeChange).toHaveBeenCalledWith("referrals");
    fireEvent.click(screen.getByRole("button", { name: /this week/i }));
    expect(onTimeframeChange).toHaveBeenCalledWith("this-week");
  });

  it("shows the empty state when there are no entries", () => {
    render(<Leaderboard entries={[]} />);
    expect(screen.getByText(/no leaderboard data available/i)).toBeInTheDocument();
  });

  it("navigates pages via the pagination controls", () => {
    const onPageChange = jest.fn();
    render(
      <Leaderboard
        entries={entries}
        totalPages={3}
        currentPage={1}
        onPageChange={onPageChange}
      />
    );
    expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
    const [prevBtn, nextBtn] = screen.getAllByRole("button").slice(-2);
    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(0);
  });
});
