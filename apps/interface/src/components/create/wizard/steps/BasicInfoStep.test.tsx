import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BasicInfoStep } from "./BasicInfoStep";
import { INITIAL, type CampaignFormData } from "../types";

function renderStep(overrides: Partial<CampaignFormData> = {}) {
  const set = jest.fn();
  const data = { ...INITIAL, ...overrides };
  render(<BasicInfoStep data={data} set={set} />);
  return { set, data };
}

describe("BasicInfoStep", () => {
  it("renders every field it owns", () => {
    renderStep();
    expect(screen.getByPlaceholderText("My Campaign")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("What are you raising funds for?"),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("10000")).toBeInTheDocument();
    expect(screen.getByText("Select a category…")).toBeInTheDocument();
  });

  it("reports title edits through the set callback", async () => {
    const { set } = renderStep();
    await userEvent.type(screen.getByPlaceholderText("My Campaign"), "A");
    expect(set).toHaveBeenCalledWith("title", "A");
  });

  it("reports goal edits through the set callback", async () => {
    const { set } = renderStep();
    await userEvent.type(screen.getByPlaceholderText("10000"), "5");
    expect(set).toHaveBeenCalledWith("goal", "5");
  });

  it("reports category selection through the set callback", async () => {
    const { set } = renderStep();
    await userEvent.selectOptions(screen.getByRole("combobox"), "health");
    expect(set).toHaveBeenCalledWith("category", "health");
  });

  // ── Validation feedback ────────────────────────────────────────────────────

  it("shows no errors for an untouched form", () => {
    renderStep();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("shows an error for a title over the length limit", () => {
    renderStep({ title: "x".repeat(101) });
    expect(
      screen.getByText("Title must be 100 characters or less."),
    ).toBeInTheDocument();
  });

  it("accepts a title at exactly the length limit", () => {
    renderStep({ title: "x".repeat(100) });
    expect(
      screen.queryByText("Title must be 100 characters or less."),
    ).not.toBeInTheDocument();
  });

  it("shows an error for a non-positive goal", () => {
    renderStep({ goal: "0" });
    expect(
      screen.getByText("Goal must be a positive number."),
    ).toBeInTheDocument();
  });

  it("shows an error for a negative goal", () => {
    renderStep({ goal: "-5" });
    expect(
      screen.getByText("Goal must be a positive number."),
    ).toBeInTheDocument();
  });

  it("shows an error when the minimum contribution exceeds the goal", () => {
    renderStep({ goal: "10", minContribution: "50" });
    expect(
      screen.getByText("Minimum contribution cannot exceed goal."),
    ).toBeInTheDocument();
  });

  it("shows no minimum-contribution error when it equals the goal", () => {
    renderStep({ goal: "10", minContribution: "10" });
    expect(
      screen.queryByText("Minimum contribution cannot exceed goal."),
    ).not.toBeInTheDocument();
  });

  it("shows an error for a deadline in the past", () => {
    renderStep({ deadline: "2000-01-01" });
    expect(
      screen.getByText("Deadline must be at least 1 hour in the future."),
    ).toBeInTheDocument();
  });
});
