import React from "react";
import { render } from "@testing-library/react";
import { CampaignCard } from "./CampaignCard";
import { ComparisonProvider } from "@/context/ComparisonContext";
import { BookmarkProvider } from "@/context/BookmarkContext";
import type { Campaign } from "@/types/campaign";
import * as campaignProgress from "@/lib/campaignProgress";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    fill: _fill,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => (
    <img {...props} />
  ),
}));

jest.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      transition: _transition,
      whileHover: _whileHover,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

const baseCampaign: Campaign = {
  id: "test-123",
  contractId: "CTEST123",
  title: "Save the Rainforest",
  description: "Help us protect endangered species",
  creator: "GCREATOR123",
  image: "https://example.com/image.jpg",
  raised: 50,
  goal: 100,
  deadline: new Date(Date.now() + 86400000).toISOString(),
  status: "Active",
  token: "native",
};

function renderCard(
  props: Partial<React.ComponentProps<typeof CampaignCard>> = {},
) {
  return render(
    <ComparisonProvider>
      <BookmarkProvider>
        <CampaignCard campaign={baseCampaign} {...props} />
      </BookmarkProvider>
    </ComparisonProvider>,
  );
}

describe("CampaignCard memoized progress/time-remaining calculations", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does not recompute progress or isEnded when an unrelated prop changes", () => {
    const progressSpy = jest.spyOn(
      campaignProgress,
      "calculateCampaignProgress",
    );
    const isEndedSpy = jest.spyOn(campaignProgress, "calculateIsEnded");

    const { rerender } = renderCard({ query: "rain" });
    expect(progressSpy).toHaveBeenCalledTimes(1);
    expect(isEndedSpy).toHaveBeenCalledTimes(1);

    rerender(
      <ComparisonProvider>
        <BookmarkProvider>
          <CampaignCard campaign={baseCampaign} query="forest" />
        </BookmarkProvider>
      </ComparisonProvider>,
    );

    expect(progressSpy).toHaveBeenCalledTimes(1);
    expect(isEndedSpy).toHaveBeenCalledTimes(1);
  });

  it("recomputes progress when raised/goal change", () => {
    const progressSpy = jest.spyOn(
      campaignProgress,
      "calculateCampaignProgress",
    );

    const { rerender } = renderCard();
    expect(progressSpy).toHaveBeenCalledTimes(1);

    rerender(
      <ComparisonProvider>
        <BookmarkProvider>
          <CampaignCard campaign={{ ...baseCampaign, raised: 75 }} />
        </BookmarkProvider>
      </ComparisonProvider>,
    );

    expect(progressSpy).toHaveBeenCalledTimes(2);
    expect(progressSpy).toHaveLastReturnedWith(75);
  });

  it("recomputes isEnded when the deadline changes", () => {
    const isEndedSpy = jest.spyOn(campaignProgress, "calculateIsEnded");

    const { rerender } = renderCard();
    expect(isEndedSpy).toHaveBeenCalledTimes(1);

    const pastDeadline = new Date(Date.now() - 86400000).toISOString();
    rerender(
      <ComparisonProvider>
        <BookmarkProvider>
          <CampaignCard
            campaign={{ ...baseCampaign, deadline: pastDeadline }}
          />
        </BookmarkProvider>
      </ComparisonProvider>,
    );

    expect(isEndedSpy).toHaveBeenCalledTimes(2);
    expect(isEndedSpy).toHaveLastReturnedWith(true);
  });
});
