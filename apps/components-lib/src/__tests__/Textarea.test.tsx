import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React, { useState } from "react";
import { Textarea } from "../Textarea";

describe("Textarea", () => {
  it("renders uncontrolled with a default value", () => {
    render(<Textarea label="Description" defaultValue="Three boreholes" />);

    const textarea = screen.getByLabelText("Description") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Three boreholes");

    fireEvent.change(textarea, { target: { value: "Four boreholes" } });
    expect(textarea.value).toBe("Four boreholes");
  });

  it("stays controlled — the value only follows the parent's state", () => {
    function Controlled() {
      const [value, setValue] = useState("");
      return (
        <Textarea
          label="Description"
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 3))}
        />
      );
    }

    render(<Controlled />);
    const textarea = screen.getByLabelText("Description") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "abcdef" } });
    expect(textarea.value).toBe("abc");
  });

  it("surfaces the validation error and marks the control invalid", () => {
    render(<Textarea label="Description" error="Too short" />);

    expect(screen.getByRole("alert").textContent).toBe("Too short");
    expect(
      screen.getByLabelText("Description").getAttribute("aria-invalid"),
    ).toBe("true");
  });

  it("does not fire onChange while disabled", () => {
    const onChange = vi.fn();
    render(<Textarea label="Description" disabled value="" onChange={onChange} />);

    const textarea = screen.getByLabelText("Description") as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);

    fireEvent.change(textarea, { target: { value: "x" } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("defaults to three rows and honours an override", () => {
    const { rerender } = render(<Textarea label="Description" />);
    expect(
      (screen.getByLabelText("Description") as HTMLTextAreaElement).rows,
    ).toBe(3);

    rerender(<Textarea label="Description" rows={8} />);
    expect(
      (screen.getByLabelText("Description") as HTMLTextAreaElement).rows,
    ).toBe(8);
  });
});
