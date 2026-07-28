import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React, { useState } from "react";
import { Input } from "../Input";

describe("Input", () => {
  it("renders uncontrolled with a default value", () => {
    render(<Input label="Title" defaultValue="Borehole project" />);

    const input = screen.getByLabelText("Title") as HTMLInputElement;
    expect(input.value).toBe("Borehole project");

    fireEvent.change(input, { target: { value: "Edited" } });
    expect(input.value).toBe("Edited");
  });

  it("stays controlled — the value only follows the parent's state", () => {
    function Controlled() {
      const [value, setValue] = useState("a");
      return (
        <Input
          label="Title"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
        />
      );
    }

    render(<Controlled />);
    const input = screen.getByLabelText("Title") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "ab" } });
    expect(input.value).toBe("AB");
  });

  it("surfaces the validation error and marks the control invalid", () => {
    render(<Input label="Goal" error="Must be positive" />);

    expect(screen.getByRole("alert").textContent).toBe("Must be positive");
    expect(screen.getByLabelText("Goal").getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  it("does not fire onChange while disabled", () => {
    const onChange = vi.fn();
    render(<Input label="Title" disabled value="" onChange={onChange} />);

    const input = screen.getByLabelText("Title") as HTMLInputElement;
    expect(input.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "x" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("drops default styling when unstyled so the caller owns the look", () => {
    render(<Input label="Title" unstyled className="my-input" />);

    expect(screen.getByLabelText("Title").className).toBe("my-input");
  });

  it("forwards a ref to the underlying input", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input label="Title" ref={ref} />);

    expect(ref.current?.tagName).toBe("INPUT");
  });
});
