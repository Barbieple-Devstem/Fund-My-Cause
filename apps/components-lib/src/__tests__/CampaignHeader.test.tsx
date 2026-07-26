import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CampaignHeader } from "../CampaignHeader";

describe("CampaignHeader", () => {
  it("renders the title, organisation and description when populated", () => {
    render(
      <CampaignHeader
        title="Clean water for Kajiado"
        organization="Maji Trust"
        description="Three boreholes for 4,000 people."
      />,
    );

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Clean water for Kajiado",
    );
    expect(screen.getByText("Maji Trust")).toBeDefined();
    expect(screen.getByText("Three boreholes for 4,000 people.")).toBeDefined();
  });

  it("renders only the title when everything else is empty", () => {
    const { container } = render(<CampaignHeader title="Untitled" />);

    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Untitled",
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("p")).toBeNull();
  });

  it("shows a loading placeholder instead of the media", () => {
    const { container } = render(<CampaignHeader title="Loading" isLoading />);

    expect(screen.getByRole("status")).toBeDefined();
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows the error message instead of the media", () => {
    render(<CampaignHeader title="Broken" error="Image unavailable" />);

    expect(screen.getByRole("alert").textContent).toBe("Image unavailable");
  });

  it("falls back to the fallback image when the source fails to load", () => {
    const { container } = render(
      <CampaignHeader
        title="Fallback"
        imageUrl="https://example.com/missing.png"
        fallbackImageUrl="https://example.com/fallback.png"
      />,
    );

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("https://example.com/missing.png");

    fireEvent.error(img);

    expect(
      (container.querySelector("img") as HTMLImageElement).getAttribute("src"),
    ).toBe("https://example.com/fallback.png");
  });

  it("delegates rendering to renderImage when supplied", () => {
    const renderImage = vi.fn(({ alt }) => <figure aria-label={alt} />);
    render(
      <CampaignHeader
        title="Custom"
        imageUrl="https://example.com/a.png"
        renderImage={renderImage}
      />,
    );

    expect(renderImage).toHaveBeenCalled();
    expect(screen.getByLabelText("Custom - campaign header image")).toBeDefined();
  });

  it("renders the overlay and body children", () => {
    render(
      <CampaignHeader title="Slots" overlay={<span>Badge</span>}>
        <span>Progress</span>
      </CampaignHeader>,
    );

    expect(screen.getByText("Badge")).toBeDefined();
    expect(screen.getByText("Progress")).toBeDefined();
  });
});
