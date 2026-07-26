"use client";

import React, { ReactNode, useId } from "react";
import { cn } from "./lib/utils";

export interface FormFieldProps {
  /** Visible label text. Omit for fields labelled elsewhere (e.g. a visually hidden label). */
  label?: ReactNode;
  /** Validation message. When set, the control is marked invalid and help text is suppressed. */
  error?: string | null;
  /** Supporting text shown below the control while there is no error. */
  helperText?: ReactNode;
  /** Renders the required indicator and marks the control `required`/`aria-required`. */
  required?: boolean;
  /** Explicit control id. Generated when omitted so label/error/help stay wired up. */
  id?: string;
  /** Stretches the field to the width of its container. */
  fullWidth?: boolean;
  className?: string;
  labelClassName?: string;
  errorClassName?: string;
  helperTextClassName?: string;
  /**
   * Receives the accessibility props the field derived (`id`, `aria-describedby`,
   * `aria-invalid`, `required`) so the control can spread them onto itself.
   */
  children: (controlProps: FormControlProps) => ReactNode;
}

/** Props a `FormField` hands to its control. Spread these onto the input element. */
export interface FormControlProps {
  id: string;
  required?: boolean;
  "aria-required"?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-errormessage"?: string;
}

/** Stable id for a field's error node — exported so callers can cross-reference it. */
export function getFieldErrorId(id: string): string {
  return `${id}-error`;
}

/** Stable id for a field's helper-text node. */
export function getFieldHelperId(id: string): string {
  return `${id}-helper`;
}

/**
 * Label + error + helper-text wrapper shared by every form primitive.
 *
 * It owns the accessibility wiring (ids, `aria-describedby`, `aria-invalid`) and
 * hands the resulting props to `children` so any control can opt in.
 *
 * @example
 * <FormField label="Goal" error={goalError} required>
 *   {(control) => <input {...control} value={goal} onChange={onChange} />}
 * </FormField>
 */
export function FormField({
  label,
  error,
  helperText,
  required,
  id,
  fullWidth = false,
  className,
  labelClassName,
  errorClassName,
  helperTextClassName,
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = getFieldErrorId(fieldId);
  const helperId = getFieldHelperId(fieldId);

  const showError = Boolean(error);
  const showHelper = Boolean(helperText) && !showError;

  const describedBy =
    [showError ? errorId : null, showHelper ? helperId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  const controlProps: FormControlProps = {
    id: fieldId,
    ...(required ? { required: true, "aria-required": true } : {}),
    ...(showError ? { "aria-invalid": true, "aria-errormessage": errorId } : {}),
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
  };

  return (
    <div className={cn("flex flex-col gap-1", fullWidth && "w-full", className)}>
      {label && (
        <label
          htmlFor={fieldId}
          className={cn("text-sm font-medium text-gray-700", labelClassName)}
        >
          {label}
          {required && (
            <span aria-hidden="true" className="text-red-500 ml-1">
              *
            </span>
          )}
        </label>
      )}

      {children(controlProps)}

      {showError && (
        <span
          id={errorId}
          role="alert"
          className={cn("text-sm text-red-500", errorClassName)}
        >
          {error}
        </span>
      )}

      {showHelper && (
        <span
          id={helperId}
          className={cn("text-sm text-gray-500", helperTextClassName)}
        >
          {helperText}
        </span>
      )}
    </div>
  );
}
