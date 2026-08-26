import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import {
  CampaignHeader,
  CampaignHeaderTitle,
  CampaignHeaderMeta,
  CampaignHeaderActions,
} from "../CampaignHeader";

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
    expect(
      screen.getByLabelText("Custom - campaign header image"),
    ).toBeDefined();
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

describe("CampaignHeaderTitle", () => {
  it("renders title with default h2 heading", () => {
    render(<CampaignHeaderTitle title="Community Well Project" />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      "Community Well Project",
    );
  });

  it("renders title with custom heading level", () => {
    render(<CampaignHeaderTitle title="School Renovation" headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      "School Renovation",
    );
  });

  it("supports custom title render function", () => {
    render(
      <CampaignHeaderTitle
        title="Highlighted Title"
        renderTitle={(t) => <mark>{t}</mark>}
      />,
    );
    expect(screen.getByText("Highlighted Title").tagName.toLowerCase()).toBe(
      "mark",
    );
  });
});

describe("CampaignHeaderMeta", () => {
  it("renders organization and description", () => {
    render(
      <CampaignHeaderMeta
        organization="Eco Builders"
        description="Building eco houses."
      />,
    );
    expect(screen.getByText("Eco Builders")).toBeDefined();
    expect(screen.getByText("Building eco houses.")).toBeDefined();
  });

  it("returns null when neither organization nor description is provided", () => {
    const { container } = render(<CampaignHeaderMeta />);
    expect(container.firstChild).toBeNull();
  });

  it("wraps in a container if className is supplied", () => {
    const { container } = render(
      <CampaignHeaderMeta
        organization="Eco"
        description="Desc"
        className="meta-wrapper"
      />,
    );
    expect(container.querySelector(".meta-wrapper")).toBeDefined();
  });
});

describe("CampaignHeaderActions", () => {
  it("defaults to inline layout", () => {
    const onShare = vi.fn();
    const onSave = vi.fn();
    render(
      <CampaignHeaderActions
        onShare={onShare}
        onSave={onSave}
        shareAriaLabel="Share"
        saveAriaLabel="Save"
      />,
    );
    expect(screen.getByLabelText("Share")).toBeDefined();
    expect(screen.getByLabelText("Save")).toBeDefined();
  });
});
