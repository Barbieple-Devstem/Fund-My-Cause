import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlatformConfigStep } from "./PlatformConfigStep";
import { INITIAL, type CampaignFormData } from "../types";

function renderStep(overrides: Partial<CampaignFormData> = {}) {
  const set = jest.fn();
  render(<PlatformConfigStep data={{ ...INITIAL, ...overrides }} set={set} />);
  return { set };
}

const FEE_RANGE_ERROR = "Fee must be between 0 and 10000 basis points.";

describe("PlatformConfigStep", () => {
  it("renders the fee address and rate fields", () => {
    renderStep();
    expect(screen.getByPlaceholderText("G... or C...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("0")).toBeInTheDocument();
  });

  it("makes clear the fee is optional", () => {
    renderStep();
    expect(
      screen.getByText("Optional. Leave blank to skip the platform fee."),
    ).toBeInTheDocument();
  });

  it("reports fee address edits through the set callback", async () => {
    const { set } = renderStep();
    await userEvent.type(screen.getByPlaceholderText("G... or C..."), "G");
    expect(set).toHaveBeenCalledWith("feeAddress", "G");
  });

  it("reports fee rate edits through the set callback", async () => {
    const { set } = renderStep();
    await userEvent.type(screen.getByPlaceholderText("0"), "5");
    expect(set).toHaveBeenCalledWith("feeBps", "5");
  });

  // ── Validation feedback ────────────────────────────────────────────────────

  it("shows no error when both fields are blank", () => {
    renderStep();
    expect(screen.queryByText(FEE_RANGE_ERROR)).not.toBeInTheDocument();
  });

  it("shows no error for a valid rate", () => {
    renderStep({ feeBps: "250" });
    expect(screen.queryByText(FEE_RANGE_ERROR)).not.toBeInTheDocument();
  });

  it("shows an error for a rate above 10000 bps", () => {
    renderStep({ feeBps: "10001" });
    expect(screen.getByText(FEE_RANGE_ERROR)).toBeInTheDocument();
  });

  it("accepts the boundary rate of 10000 bps", () => {
    renderStep({ feeBps: "10000" });
    expect(screen.queryByText(FEE_RANGE_ERROR)).not.toBeInTheDocument();
  });

  it("accepts the boundary rate of 0 bps", () => {
    renderStep({ feeBps: "0" });
    expect(screen.queryByText(FEE_RANGE_ERROR)).not.toBeInTheDocument();
  });

  it("shows an error for a negative rate", () => {
    renderStep({ feeBps: "-1" });
    expect(screen.getByText(FEE_RANGE_ERROR)).toBeInTheDocument();
  });

  it("shows an error for a non-numeric rate", () => {
    renderStep({ feeBps: "abc" });
    expect(screen.getByText(FEE_RANGE_ERROR)).toBeInTheDocument();
  });
});
