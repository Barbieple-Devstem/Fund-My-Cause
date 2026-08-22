/**
 * Accessible form utility helpers.
 * Provides functions for generating accessible IDs, associating errors,
 * and marking required fields for screen readers.
 */

/**
 * Generates a unique error ID for a form field.
 * Use as the `id` on the error message element, then reference it
 * via `aria-describedby` on the input.
 */
export function getErrorId(fieldName: string): string {
  return `error-${fieldName}`;
}

/**
 * Generates a unique instruction ID for a form field.
 * Use as the `id` on the instruction element, then reference it
 * via `aria-describedby` on the input.
 */
export function getInstructionId(fieldName: string): string {
  return `instruction-${fieldName}`;
}

/**
 * Builds an `aria-describedby` string that includes error and/or instruction IDs.
 * Pass the field name and whether an error exists and/or instructions exist.
 */
export function buildDescribedBy(
  fieldName: string,
  hasError: boolean,
  hasInstructions: boolean,
): string | undefined {
  const ids: string[] = [];
  if (hasInstructions) ids.push(getInstructionId(fieldName));
  if (hasError) ids.push(getErrorId(fieldName));
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/**
 * Props to spread onto an input element for accessible form fields.
 */
export interface AccessibleInputProps {
  "aria-required"?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-errormessage"?: string;
}

/**
 * Returns accessible props for an input field.
 * @param fieldName - The field name (used to generate IDs)
 * @param isRequired - Whether the field is required
 * @param error - Current error message (if any)
 * @param hasInstructions - Whether there are instructions for this field
 */
export function getAccessibleInputProps(
  fieldName: string,
  isRequired: boolean,
  error?: string | null,
  hasInstructions?: boolean,
): AccessibleInputProps {
  const props: AccessibleInputProps = {};

  if (isRequired) {
    props["aria-required"] = true;
  }

  if (error) {
    props["aria-invalid"] = true;
    props["aria-errormessage"] = getErrorId(fieldName);
  }

  const describedBy = buildDescribedBy(fieldName, !!error, !!hasInstructions);
  if (describedBy) {
    props["aria-describedby"] = describedBy;
  }

  return props;
}