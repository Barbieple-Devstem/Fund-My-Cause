"use client";

/**
 * Presentational form primitives shared by the campaign-wizard steps.
 * Kept separate from the steps themselves so each step file stays focused on
 * the fields it owns.
 */

import React from "react";
import { getAccessibleInputProps, getErrorId } from "@/lib/accessibleFormUtils";

export const inputCls =
  "w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-indigo-500";
export const labelCls = "block text-sm text-gray-600 dark:text-gray-400 mb-1";

/** A labelled field with no validation feedback. */
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

export interface FieldWithErrorProps {
  label: string;
  error?: string | null;
  children: React.ReactNode;
  /** The field name used to generate accessible IDs for aria-describedby / aria-errormessage */
  fieldName?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether there are additional instructions for this field */
  hasInstructions?: boolean;
}

/** A labelled field that renders an inline, screen-reader-announced error. */
export function FieldWithError({
  label,
  error,
  children,
  fieldName,
  required,
  hasInstructions,
}: FieldWithErrorProps) {
  const accessibleProps = fieldName
    ? getAccessibleInputProps(fieldName, !!required, error, hasInstructions)
    : {};

  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && fieldName) {
      return React.cloneElement(
        child,
        accessibleProps as Record<string, unknown>,
      );
    }
    return child;
  });

  return (
    <div>
      <label className={labelCls}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-red-500 ml-0.5">
            *
          </span>
        )}
      </label>
      {childrenWithProps}
      {error && fieldName && (
        <p
          id={getErrorId(fieldName)}
          role="alert"
          className="text-red-500 dark:text-red-400 text-xs mt-1"
        >
          {error}
        </p>
      )}
      {error && !fieldName && (
        <p className="text-red-500 dark:text-red-400 text-xs mt-1">{error}</p>
      )}
    </div>
  );
}

/** A label/value row used by the review step's summary table. */
export function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1 border-b border-gray-800">
      <span className="text-gray-400">{label}</span>
      <span className="text-white max-w-xs truncate text-right">
        {value || "—"}
      </span>
    </div>
  );
}
