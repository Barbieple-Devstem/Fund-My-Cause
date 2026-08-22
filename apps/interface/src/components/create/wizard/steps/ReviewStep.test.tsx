import { render, screen } from "@testing-library/react";
import { ReviewStep } from "./ReviewStep";
import { INITIAL, type CampaignFormData } from "../types";

function renderStep(overrides: Partial<CampaignFormData> = {}) {
  render(<ReviewStep data={{ ...INITIAL, ...overrides }} />);
}

describe("ReviewStep", () => {
  it("lists every summary row", () => {
    renderStep();
    for (const label of [
      "Contract ID",
      "Token",
      "Title",
      "Description",
      "Category",
      "Goal",
      "Min Contribution",
      "Deadline",
      "Image",
      "FAQs",
      "Team Members",
      "Fee Address",
      "Fee (bps)",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders entered values", () => {
    renderStep({ title: "My Campaign", contractId: "CABC" });
    expect(screen.getByText("My Campaign")).toBeInTheDocument();
    expect(screen.getByText("CABC")).toBeInTheDocument();
  });

  it("appends the XLM unit to the goal and minimum contribution", () => {
    renderStep({ goal: "500", minContribution: "5" });
    expect(screen.getByText("500 XLM")).toBeInTheDocument();
    expect(screen.getByText("5 XLM")).toBeInTheDocument();
  });

  it("falls back to a dash for empty fields", () => {
    renderStep();
    // Every field is empty on an untouched form, so several dashes render.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("summarises FAQ and team counts rather than listing them", () => {
    renderStep({
      faqs: [
        { id: "a", question: "Q", answer: "A" },
        { id: "b", question: "Q2", answer: "A2" },
      ],
      teamMembers: [{ id: "c", name: "Ada", role: "Lead" }],
    });
    expect(screen.getByText("2 added")).toBeInTheDocument();
    expect(screen.getByText("1 added")).toBeInTheDocument();
  });

  it("formats the deadline as a locale date", () => {
    renderStep({ deadline: "2030-06-15" });
    const expected = new Date("2030-06-15").toLocaleDateString();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
