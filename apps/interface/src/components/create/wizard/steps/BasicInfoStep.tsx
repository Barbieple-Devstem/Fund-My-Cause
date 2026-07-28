"use client";

import {
  validateTitle,
  validateDescription,
  validateGoal,
  validateDeadline,
  validateMinContribution,
} from "@/lib/validation";
import { CATEGORY_TAXONOMY } from "@/lib/categories";
import { Input, Select, Textarea } from "@fund-my-cause/components";
import { fieldStyles } from "../fields";
import type { StepProps } from "../types";

/**
 * Wizard step 1 — contract/token addresses plus the campaign's core details.
 *
 * Field-level errors are shown as-you-type, but only once a field is non-empty,
 * so an untouched form isn't covered in "required" errors. The blocking
 * required-field check happens in `validateBasicInfoStep` on Next.
 */
export function BasicInfoStep({ data, set }: StepProps) {
  const titleError = data.title ? validateTitle(data.title) : null;
  const descError = data.description
    ? validateDescription(data.description)
    : null;
  const goalError = data.goal ? validateGoal(data.goal) : null;
  const deadlineError = data.deadline ? validateDeadline(data.deadline) : null;
  const minContribError = data.minContribution
    ? validateMinContribution(data.minContribution, data.goal)
    : null;

  return (
    <div className="space-y-4">
      <Input
        {...fieldStyles}
        label="Contract ID"
        placeholder="C..."
        value={data.contractId}
        onChange={(e) => set("contractId", e.target.value)}
      />
      <Input
        {...fieldStyles}
        label="Token Address"
        placeholder="C..."
        value={data.token}
        onChange={(e) => set("token", e.target.value)}
      />
      <Input
        {...fieldStyles}
        label="Title"
        error={titleError}
        required
        placeholder="My Campaign"
        value={data.title}
        onChange={(e) => set("title", e.target.value)}
      />
      <Textarea
        {...fieldStyles}
        label="Description"
        error={descError}
        required
        rows={3}
        placeholder="What are you raising funds for?"
        value={data.description}
        onChange={(e) => set("description", e.target.value)}
      />
      <Select
        {...fieldStyles}
        label="Category"
        placeholder="Select a category…"
        value={data.category}
        onChange={(e) => set("category", e.target.value)}
        options={CATEGORY_TAXONOMY.map((cat) => ({
          value: cat.slug,
          label: `${cat.emoji} ${cat.label}`,
        }))}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          {...fieldStyles}
          label="Goal (XLM)"
          error={goalError}
          required
          type="number"
          min="1"
          placeholder="10000"
          value={data.goal}
          onChange={(e) => set("goal", e.target.value)}
        />
        <Input
          {...fieldStyles}
          label="Min Contribution (XLM)"
          error={minContribError}
          required
          type="number"
          min="1"
          placeholder="1"
          value={data.minContribution}
          onChange={(e) => set("minContribution", e.target.value)}
        />
      </div>
      <Input
        {...fieldStyles}
        label="Deadline"
        error={deadlineError}
        required
        type="date"
        value={data.deadline}
        min={new Date().toISOString().split("T")[0]}
        onChange={(e) => set("deadline", e.target.value)}
      />
    </div>
  );
}
