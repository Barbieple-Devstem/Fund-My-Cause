import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { FormField, getFieldErrorId, getFieldHelperId } from "../FormField";

describe("FormField", () => {
  it("links the label to the control it wraps", () => {
    render(
      <FormField label="Goal">{(control) => <input {...control} />}</FormField>,
    );

    expect(screen.getByLabelText("Goal")).toBeDefined();
  });

  it("marks the control invalid and points it at the error node", () => {
    render(
      <FormField label="Goal" id="goal" error="Too low">
        {(control) => <input {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText("Goal");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-errormessage")).toBe(
      getFieldErrorId("goal"),
    );
    expect(screen.getByRole("alert").textContent).toBe("Too low");
  });

  it("describes the control with helper text when there is no error", () => {
    render(
      <FormField label="Goal" id="goal" helperText="In XLM">
        {(control) => <input {...control} />}
      </FormField>,
    );

    expect(screen.getByLabelText("Goal").getAttribute("aria-describedby")).toBe(
      getFieldHelperId("goal"),
    );
  });

  it("suppresses helper text once an error is present", () => {
    render(
      <FormField label="Goal" error="Too low" helperText="In XLM">
        {(control) => <input {...control} />}
      </FormField>,
    );

    expect(screen.queryByText("In XLM")).toBeNull();
  });

  it("marks the control required and renders the indicator", () => {
    const { container } = render(
      <FormField label="Goal" required>
        {(control) => <input {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText(/Goal/);
    expect(input.hasAttribute("required")).toBe(true);
    expect(container.querySelector("label")?.textContent).toContain("*");
  });

  it("generates unique ids so repeated fields stay independently labelled", () => {
    render(
      <>
        <FormField label="First">{(c) => <input {...c} />}</FormField>
        <FormField label="Second">{(c) => <input {...c} />}</FormField>
      </>,
    );

    const first = screen.getByLabelText("First");
    const second = screen.getByLabelText("Second");
    expect(first.id).not.toBe(second.id);
  });
});
