import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { CampaignProgress } from "../CampaignProgress";

describe("CampaignProgress", () => {
  it("renders a zero-progress bar with no amounts when empty", () => {
    render(<CampaignProgress percent={0} />);

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "0",
    );
  });

  it("renders the bar, amounts and remaining time when populated", () => {
    render(
      <CampaignProgress
        percent={64}
        raisedText="15,400 XLM raised"
        goalText="24,000 XLM goal"
        timeRemaining="12d left"
      />,
    );

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "64",
    );
    expect(screen.getByText("15,400 XLM raised")).toBeDefined();
    expect(screen.getByText("24,000 XLM goal")).toBeDefined();
    expect(screen.getByText("12d left")).toBeDefined();
  });

  it("clamps an over-funded percentage for display", () => {
    render(<CampaignProgress percent={180} />);

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "100",
    );
  });

  it("shows a loading placeholder instead of the bar", () => {
    render(<CampaignProgress percent={50} isLoading raisedText="hidden" />);

    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("hidden")).toBeNull();
  });

  it("shows the error message instead of the bar", () => {
    render(<CampaignProgress percent={50} error="Totals unavailable" />);

    expect(screen.getByRole("alert").textContent).toBe("Totals unavailable");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("delegates the bar to renderBar when supplied", () => {
    const renderBar = vi.fn(({ percent }) => <div data-percent={percent} />);
    render(<CampaignProgress percent={42} renderBar={renderBar} />);

    expect(renderBar).toHaveBeenCalledWith({ percent: 42, animated: false });
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
