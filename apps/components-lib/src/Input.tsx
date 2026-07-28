"use client";

import React, { InputHTMLAttributes, ReactNode, forwardRef } from "react";
import { cn } from "./lib/utils";
import { FormField } from "./FormField";
import { controlClassName } from "./lib/formStyles";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  /** Visible label text rendered above the control. */
  label?: ReactNode;
  /** Validation message. Marks the input invalid and hides `helperText`. */
  error?: string | null;
  /** Supporting text shown below the control while there is no error. */
  helperText?: string;
  /** Stretches the field and control to the width of the container. */
  fullWidth?: boolean;
  /** Explicit control id. Generated when omitted. */
  id?: string;
  /**
   * Drops the library's default control styling so `className` fully owns the
   * look. Use when adopting the primitive inside an app that already has its
   * own input styles and needs pixel-identical output.
   */
  unstyled?: boolean;
  /** Extra classes for the wrapper element (not the control). */
  fieldClassName?: string;
  labelClassName?: string;
  errorClassName?: string;
  helperTextClassName?: string;
}

/**
 * Text input composed onto `FormField` — label, error, helper text and
 * required indicator all come from the shared wrapper.
 *
 * Works controlled (`value` + `onChange`) or uncontrolled (`defaultValue`).
 *
 * @example
 * <Input label="Email" type="email" error="Invalid email" required />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = false,
      id,
      unstyled = false,
      fieldClassName,
      labelClassName,
      errorClassName,
      helperTextClassName,
      className,
      required,
      ...props
    },
    ref,
  ) => (
    <FormField
      label={label}
      error={error}
      helperText={helperText}
      required={required}
      id={id}
      fullWidth={fullWidth}
      className={fieldClassName}
      labelClassName={labelClassName}
      errorClassName={errorClassName}
      helperTextClassName={helperTextClassName}
    >
      {(control) => (
        <input
          ref={ref}
          {...control}
          className={cn(
            controlClassName({ unstyled, hasError: Boolean(error), fullWidth }),
            className,
          )}
          {...props}
        />
      )}
    </FormField>
  ),
);

Input.displayName = "Input";
