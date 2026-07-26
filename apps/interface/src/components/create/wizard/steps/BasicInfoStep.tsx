"use client";

import {
  validateTitle,
  validateDescription,
  validateGoal,
  validateDeadline,
  validateMinContribution,
} from "@/lib/validation";
import { CATEGORY_TAXONOMY } from "@/lib/categories";
import { Field, FieldWithError, inputCls } from "../fields";
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
      <Field label="Contract ID">
        <input
          className={inputCls}
          placeholder="C..."
          value={data.contractId}
          onChange={(e) => set("contractId", e.target.value)}
        />
      </Field>
      <Field label="Token Address">
        <input
          className={inputCls}
          placeholder="C..."
          value={data.token}
          onChange={(e) => set("token", e.target.value)}
        />
      </Field>
      <FieldWithError
        label="Title"
        error={titleError}
        fieldName="title"
        required
      >
        <input
          className={inputCls}
          placeholder="My Campaign"
          value={data.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </FieldWithError>
      <FieldWithError
        label="Description"
        error={descError}
        fieldName="description"
        required
      >
        <textarea
          rows={3}
          className={inputCls}
          placeholder="What are you raising funds for?"
          value={data.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </FieldWithError>
      <Field label="Category">
        <select
          className={inputCls}
          value={data.category}
          onChange={(e) => set("category", e.target.value)}
        >
          <option value="">Select a category…</option>
          {CATEGORY_TAXONOMY.map((cat) => (
            <option key={cat.slug} value={cat.slug}>
              {cat.emoji} {cat.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <FieldWithError
          label="Goal (XLM)"
          error={goalError}
          fieldName="goal"
          required
        >
          <input
            type="number"
            min="1"
            className={inputCls}
            placeholder="10000"
            value={data.goal}
            onChange={(e) => set("goal", e.target.value)}
          />
        </FieldWithError>
        <FieldWithError
          label="Min Contribution (XLM)"
          error={minContribError}
          fieldName="minContribution"
          required
        >
          <input
            type="number"
            min="1"
            className={inputCls}
            placeholder="1"
            value={data.minContribution}
            onChange={(e) => set("minContribution", e.target.value)}
          />
        </FieldWithError>
      </div>
      <FieldWithError
        label="Deadline"
        error={deadlineError}
        fieldName="deadline"
        required
      >
        <input
          type="date"
          className={inputCls}
          value={data.deadline}
          min={new Date().toISOString().split("T")[0]}
          onChange={(e) => set("deadline", e.target.value)}
        />
      </FieldWithError>
    </div>
  );
}
