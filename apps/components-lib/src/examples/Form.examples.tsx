"use client";

/**
 * Isolated examples for the form primitives — one entry per state a reviewer
 * needs to see. See `CampaignCard.examples.tsx` for why these live here rather
 * than in Storybook.
 */

import React from "react";
import { Input } from "../Input";
import { Select } from "../Select";
import { Textarea } from "../Textarea";
import type { ComponentExample } from "./CampaignCard.examples";

const CATEGORIES = [
  { value: "charity", label: "Charity" },
  { value: "technology", label: "Technology" },
  { value: "creative", label: "Creative" },
];

const noop = () => {};

export const INPUT_EXAMPLES: ComponentExample[] = [
  { name: "empty", element: <Input label="Title" placeholder="My campaign" /> },
  {
    name: "loading",
    element: <Input label="Title" value="Loading…" disabled onChange={noop} />,
  },
  {
    name: "error",
    element: <Input label="Title" value="ab" onChange={noop} error="Title must be at least 5 characters" />,
  },
  {
    name: "populated",
    element: (
      <Input
        label="Goal (XLM)"
        type="number"
        defaultValue={10000}
        required
        helperText="Contributions below the minimum are rejected on-chain."
      />
    ),
  },
];

export const SELECT_EXAMPLES: ComponentExample[] = [
  {
    name: "empty",
    element: <Select label="Category" placeholder="Select a category…" options={CATEGORIES} />,
  },
  {
    name: "loading",
    element: <Select label="Category" placeholder="Loading categories…" disabled />,
  },
  {
    name: "error",
    element: (
      <Select
        label="Category"
        options={CATEGORIES}
        value=""
        onChange={noop}
        error="Pick a category before continuing"
      />
    ),
  },
  {
    name: "populated",
    element: (
      <Select label="Category" options={CATEGORIES} defaultValue="technology" required />
    ),
  },
];

export const TEXTAREA_EXAMPLES: ComponentExample[] = [
  {
    name: "empty",
    element: <Textarea label="Description" placeholder="What are you raising funds for?" />,
  },
  { name: "loading", element: <Textarea label="Description" disabled value="" onChange={noop} /> },
  {
    name: "error",
    element: (
      <Textarea label="Description" value="Too short" onChange={noop} error="Add at least 50 characters" />
    ),
  },
  {
    name: "populated",
    element: (
      <Textarea
        label="Description"
        rows={4}
        defaultValue="Drilling three boreholes to serve 4,000 people year-round."
        helperText="Shown on the campaign card and detail page."
      />
    ),
  },
];
