import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CampaignActions } from "../CampaignActions";

describe("CampaignActions", () => {
  it("renders nothing actionable when no handlers are supplied", () => {
    render(<CampaignActions />);

    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("renders each action whose handler is supplied and calls it on click", () => {
    const onDonate = vi.fn();
    const onShare = vi.fn();
    const onSave = vi.fn();

    render(
      <CampaignActions
        onDonate={onDonate}
        donateLabel="Pledge now"
        onShare={onShare}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pledge now" }));
    fireEvent.click(screen.getByRole("button", { name: "Share campaign" }));
    fireEvent.click(screen.getByRole("button", { name: "Save campaign" }));

    expect(onDonate).toHaveBeenCalledTimes(1);
    expect(onShare).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("reflects the saved state in the label and aria-pressed", () => {
    render(<CampaignActions onSave={() => {}} saved />);

    const button = screen.getByRole("button", { name: "Remove from saved" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("disables the primary action when the campaign cannot take pledges", () => {
    const onDonate = vi.fn();
    render(
      <CampaignActions
        onDonate={onDonate}
        donateLabel="Campaign ended"
        donateDisabled
      />,
    );

    const button = screen.getByRole("button", {
      name: "Campaign ended",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.click(button);
    expect(onDonate).not.toHaveBeenCalled();
  });

  it("disables every action and marks the primary busy while loading", () => {
    render(
      <CampaignActions
        onDonate={() => {}}
        donateLabel="Pledge now"
        onShare={() => {}}
        isLoading
      />,
    );

    const donate = screen.getByRole("button", {
      name: "Pledge now",
    }) as HTMLButtonElement;
    expect(donate.disabled).toBe(true);
    expect(donate.getAttribute("aria-busy")).toBe("true");
    expect(
      (screen.getByRole("button", { name: "Share campaign" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("shows the error message instead of the actions", () => {
    render(
      <CampaignActions onDonate={() => {}} error="Wallet unavailable" />,
    );

    expect(screen.getByRole("alert").textContent).toBe("Wallet unavailable");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("stops clicks from bubbling to an enclosing clickable card", () => {
    const onCardClick = vi.fn();
    render(
      <div onClick={onCardClick}>
        <CampaignActions onDonate={() => {}} donateLabel="Pledge now" />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pledge now" }));
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it("renders extra controls passed as children", () => {
    render(
      <CampaignActions>
        <span>Compare</span>
      </CampaignActions>,
    );

    expect(screen.getByText("Compare")).toBeDefined();
  });
});
