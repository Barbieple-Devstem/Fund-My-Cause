"use client";

import React, { TextareaHTMLAttributes, ReactNode, forwardRef } from "react";
import { cn } from "./lib/utils";
import { FormField } from "./FormField";
import { controlClassName } from "./lib/formStyles";

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  /** Visible label text rendered above the control. */
  label?: ReactNode;
  /** Validation message. Marks the textarea invalid and hides `helperText`. */
  error?: string | null;
  /** Supporting text shown below the control while there is no error. */
  helperText?: string;
  /** Stretches the field and control to the width of the container. */
  fullWidth?: boolean;
  /** Explicit control id. Generated when omitted. */
  id?: string;
  /** Drops the library's default control styling so `className` owns the look. */
  unstyled?: boolean;
  /** Extra classes for the wrapper element (not the control). */
  fieldClassName?: string;
  labelClassName?: string;
  errorClassName?: string;
  helperTextClassName?: string;
}

/**
 * Multi-line text control composed onto `FormField`.
 *
 * @example
 * <Textarea label="Description" rows={3} helperText="Markdown supported" />
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
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
      rows = 3,
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
        <textarea
          ref={ref}
          rows={rows}
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

Textarea.displayName = "Textarea";
