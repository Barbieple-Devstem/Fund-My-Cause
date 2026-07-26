import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React, { useState } from "react";
import { Select } from "../Select";

const OPTIONS = [
  { value: "charity", label: "Charity" },
  { value: "technology", label: "Technology" },
];

describe("Select", () => {
  it("renders the placeholder first, then the options", () => {
    render(<Select label="Category" placeholder="Pick one…" options={OPTIONS} />);

    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    expect(options.map((o) => o.textContent)).toEqual([
      "Pick one…",
      "Charity",
      "Technology",
    ]);
    expect(options[0]?.value).toBe("");
  });

  it("renders uncontrolled with a default value", () => {
    render(<Select label="Category" options={OPTIONS} defaultValue="technology" />);

    const select = screen.getByLabelText("Category") as HTMLSelectElement;
    expect(select.value).toBe("technology");
  });

  it("stays controlled — the value only follows the parent's state", () => {
    function Controlled() {
      const [value, setValue] = useState("charity");
      return (
        <Select
          label="Category"
          options={OPTIONS}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      );
    }

    render(<Controlled />);
    const select = screen.getByLabelText("Category") as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "technology" } });
    expect(select.value).toBe("technology");
  });

  it("surfaces the validation error and marks the control invalid", () => {
    render(<Select label="Category" options={OPTIONS} error="Required" />);

    expect(screen.getByRole("alert").textContent).toBe("Required");
    expect(screen.getByLabelText("Category").getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  it("does not fire onChange while disabled", () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Category"
        options={OPTIONS}
        disabled
        value="charity"
        onChange={onChange}
      />,
    );

    const select = screen.getByLabelText("Category") as HTMLSelectElement;
    expect(select.disabled).toBe(true);

    fireEvent.change(select, { target: { value: "technology" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("accepts children for markup the options prop can't express", () => {
    render(
      <Select label="Category">
        <optgroup label="Causes">
          <option value="charity">Charity</option>
        </optgroup>
      </Select>,
    );

    expect(screen.getByRole("group", { name: "Causes" })).toBeDefined();
  });
});
