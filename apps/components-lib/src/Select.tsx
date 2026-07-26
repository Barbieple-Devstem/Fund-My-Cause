"use client";

import React, { SelectHTMLAttributes, ReactNode, forwardRef } from "react";
import { cn } from "./lib/utils";
import { FormField } from "./FormField";
import { controlClassName } from "./lib/formStyles";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  /** Visible label text rendered above the control. */
  label?: ReactNode;
  /** Validation message. Marks the select invalid and hides `helperText`. */
  error?: string | null;
  /** Supporting text shown below the control while there is no error. */
  helperText?: string;
  /** Stretches the field and control to the width of the container. */
  fullWidth?: boolean;
  /** Explicit control id. Generated when omitted. */
  id?: string;
  /** Drops the library's default control styling so `className` owns the look. */
  unstyled?: boolean;
  /**
   * Options rendered inside the select. Pass `children` instead when you need
   * `<optgroup>` or custom option markup.
   */
  options?: readonly SelectOption[];
  /** Placeholder option rendered first with an empty value. */
  placeholder?: string;
  /** Extra classes for the wrapper element (not the control). */
  fieldClassName?: string;
  labelClassName?: string;
  errorClassName?: string;
  helperTextClassName?: string;
}

/**
 * Select composed onto `FormField`, sharing the same label/error/help contract
 * as `Input` and `Textarea`.
 *
 * @example
 * <Select label="Category" options={categories} placeholder="Select one…" />
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = false,
      id,
      unstyled = false,
      options,
      placeholder,
      fieldClassName,
      labelClassName,
      errorClassName,
      helperTextClassName,
      className,
      required,
      children,
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
        <select
          ref={ref}
          {...control}
          className={cn(
            controlClassName({ unstyled, hasError: Boolean(error), fullWidth }),
            className,
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options?.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
          {children}
        </select>
      )}
    </FormField>
  ),
);

Select.displayName = "Select";
