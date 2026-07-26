"use client";

/**
 * Isolated examples for the campaign card building blocks.
 *
 * The repo has no Storybook runner, so each subcomponent's states are declared
 * here as plain exported elements. They are what the unit tests assert against
 * and what a reviewer renders to eyeball a single component in isolation:
 *
 *   import { CAMPAIGN_HEADER_EXAMPLES } from "@fund-my-cause/components/examples";
 *   CAMPAIGN_HEADER_EXAMPLES.map(({ name, element }) => …)
 *
 * Every subcomponent covers the same four states: empty, loading, error and
 * populated.
 */

import React, { ReactNode } from "react";
import { CampaignHeader } from "../CampaignHeader";
import { CampaignProgress } from "../CampaignProgress";
import { CampaignActions } from "../CampaignActions";

export interface ComponentExample {
  /** State this example demonstrates. */
  name: "empty" | "loading" | "error" | "populated";
  element: ReactNode;
}

const SAMPLE_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='2' height='1'/>";

const noop = () => {};

export const CAMPAIGN_HEADER_EXAMPLES: ComponentExample[] = [
  {
    name: "empty",
    element: <CampaignHeader title="Untitled campaign" />,
  },
  {
    name: "loading",
    element: (
      <CampaignHeader
        title="Clean water for Kajiado"
        isLoading
        classNames={{ media: "relative w-full h-48" }}
      />
    ),
  },
  {
    name: "error",
    element: (
      <CampaignHeader
        title="Clean water for Kajiado"
        error="Image unavailable"
        classNames={{ media: "relative w-full h-48" }}
      />
    ),
  },
  {
    name: "populated",
    element: (
      <CampaignHeader
        title="Clean water for Kajiado"
        organization="Maji Trust"
        description="Drilling three boreholes to serve 4,000 people year-round."
        imageUrl={SAMPLE_IMAGE}
        classNames={{ media: "relative w-full h-48" }}
      />
    ),
  },
];

export const CAMPAIGN_PROGRESS_EXAMPLES: ComponentExample[] = [
  {
    name: "empty",
    element: <CampaignProgress percent={0} />,
  },
  {
    name: "loading",
    element: <CampaignProgress percent={0} isLoading />,
  },
  {
    name: "error",
    element: (
      <CampaignProgress percent={0} error="Could not load funding totals" />
    ),
  },
  {
    name: "populated",
    element: (
      <CampaignProgress
        percent={64}
        raisedText="15,400 XLM (~$2,156 USD) raised"
        goalText="24,000 XLM (~$3,360 USD) goal"
        timeRemaining="12d 4h left"
      />
    ),
  },
];

export const CAMPAIGN_ACTIONS_EXAMPLES: ComponentExample[] = [
  {
    name: "empty",
    element: <CampaignActions />,
  },
  {
    name: "loading",
    element: (
      <CampaignActions onDonate={noop} donateLabel="Pledge now" isLoading />
    ),
  },
  {
    name: "error",
    element: <CampaignActions error="Wallet unavailable" />,
  },
  {
    name: "populated",
    element: (
      <CampaignActions
        onDonate={noop}
        donateLabel="Pledge now"
        onShare={noop}
        onSave={noop}
        saved
      />
    ),
  },
];
