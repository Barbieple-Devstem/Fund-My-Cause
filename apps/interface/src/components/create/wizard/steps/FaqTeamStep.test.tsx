import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FaqTeamStep } from "./FaqTeamStep";
import { INITIAL, type CampaignFormData } from "../types";

// jsdom's crypto does not always expose randomUUID, which the add-row handlers
// use to key new rows.
let uuidCounter = 0;
beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      ...globalThis.crypto,
      randomUUID: () => `uuid-${++uuidCounter}`,
    },
    configurable: true,
  });
});

function renderStep(overrides: Partial<CampaignFormData> = {}) {
  const setFaqs = jest.fn();
  const setTeamMembers = jest.fn();
  render(
    <FaqTeamStep
      data={{ ...INITIAL, ...overrides }}
      setFaqs={setFaqs}
      setTeamMembers={setTeamMembers}
    />,
  );
  return { setFaqs, setTeamMembers };
}

describe("FaqTeamStep", () => {
  // ── Empty state ────────────────────────────────────────────────────────────

  it("shows empty-state copy for both lists", () => {
    renderStep();
    expect(screen.getByText("No FAQs added yet.")).toBeInTheDocument();
    expect(screen.getByText("No team members added yet.")).toBeInTheDocument();
  });

  // ── FAQs ───────────────────────────────────────────────────────────────────

  it("appends a blank FAQ row", async () => {
    const { setFaqs } = renderStep();
    await userEvent.click(screen.getByRole("button", { name: /Add FAQ/i }));
    expect(setFaqs).toHaveBeenCalledWith([
      { id: expect.any(String), question: "", answer: "" },
    ]);
  });

  it("appends to existing FAQs rather than replacing them", async () => {
    const existing = { id: "a", question: "Q1", answer: "A1" };
    const { setFaqs } = renderStep({ faqs: [existing] });
    await userEvent.click(screen.getByRole("button", { name: /Add FAQ/i }));
    expect(setFaqs).toHaveBeenCalledWith([
      existing,
      { id: expect.any(String), question: "", answer: "" },
    ]);
  });

  it("renders existing FAQ values", () => {
    renderStep({ faqs: [{ id: "a", question: "Why?", answer: "Because." }] });
    expect(screen.getByDisplayValue("Why?")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Because.")).toBeInTheDocument();
    expect(screen.queryByText("No FAQs added yet.")).not.toBeInTheDocument();
  });

  it("updates only the edited FAQ's question", async () => {
    const { setFaqs } = renderStep({
      faqs: [
        { id: "a", question: "Q", answer: "A" },
        { id: "b", question: "Q2", answer: "A2" },
      ],
    });
    await userEvent.type(screen.getByDisplayValue("Q"), "!");
    expect(setFaqs).toHaveBeenCalledWith([
      { id: "a", question: "Q!", answer: "A" },
      { id: "b", question: "Q2", answer: "A2" },
    ]);
  });

  it("removes only the targeted FAQ", async () => {
    const { setFaqs } = renderStep({
      faqs: [
        { id: "a", question: "Q1", answer: "A1" },
        { id: "b", question: "Q2", answer: "A2" },
      ],
    });
    const removeButtons = screen.getAllByRole("button", { name: "Remove FAQ" });
    await userEvent.click(removeButtons[0]!);
    expect(setFaqs).toHaveBeenCalledWith([
      { id: "b", question: "Q2", answer: "A2" },
    ]);
  });

  // ── Team members ───────────────────────────────────────────────────────────

  it("appends a blank team member row", async () => {
    const { setTeamMembers } = renderStep();
    await userEvent.click(screen.getByRole("button", { name: /Add Member/i }));
    expect(setTeamMembers).toHaveBeenCalledWith([
      { id: expect.any(String), name: "", role: "" },
    ]);
  });

  it("renders existing team member values including optional fields", () => {
    renderStep({
      teamMembers: [
        {
          id: "a",
          name: "Ada",
          role: "Lead",
          bio: "Builds things",
          avatarUrl: "https://example.com/a.png",
        },
      ],
    });
    expect(screen.getByDisplayValue("Ada")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lead")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Builds things")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("https://example.com/a.png"),
    ).toBeInTheDocument();
  });

  it("renders blank inputs for absent optional member fields", () => {
    renderStep({ teamMembers: [{ id: "a", name: "Ada", role: "Lead" }] });
    expect(screen.getByPlaceholderText("Bio (optional)")).toHaveValue("");
    expect(screen.getByPlaceholderText("Avatar URL (optional)")).toHaveValue(
      "",
    );
  });

  it("updates only the edited member's role", async () => {
    const { setTeamMembers } = renderStep({
      teamMembers: [
        { id: "a", name: "Ada", role: "Lead" },
        { id: "b", name: "Bo", role: "Design" },
      ],
    });
    await userEvent.type(screen.getByDisplayValue("Lead"), "!");
    expect(setTeamMembers).toHaveBeenCalledWith([
      { id: "a", name: "Ada", role: "Lead!" },
      { id: "b", name: "Bo", role: "Design" },
    ]);
  });

  it("removes only the targeted member", async () => {
    const { setTeamMembers } = renderStep({
      teamMembers: [
        { id: "a", name: "Ada", role: "Lead" },
        { id: "b", name: "Bo", role: "Design" },
      ],
    });
    const removeButtons = screen.getAllByRole("button", {
      name: "Remove member",
    });
    await userEvent.click(removeButtons[1]!);
    expect(setTeamMembers).toHaveBeenCalledWith([
      { id: "a", name: "Ada", role: "Lead" },
    ]);
  });
});
