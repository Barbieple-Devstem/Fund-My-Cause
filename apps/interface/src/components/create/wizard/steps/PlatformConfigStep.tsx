"use client";

import { validateFeeBps } from "@/lib/validation";
import { Field, FieldWithError, inputCls } from "../fields";
import type { StepProps } from "../types";

/**
 * Wizard step 4 — optional platform fee recipient and rate.
 *
 * Both fields are optional individually, but a fee address without a rate is
 * rejected on Next (see `validatePlatformConfigStep`).
 */
export function PlatformConfigStep({ data, set }: StepProps) {
  const feeError = data.feeBps ? validateFeeBps(data.feeBps) : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Optional. Leave blank to skip the platform fee.
      </p>
      <Field label="Platform Fee Address">
        <input
          className={inputCls}
          placeholder="G... or C..."
          value={data.feeAddress}
          onChange={(e) => set("feeAddress", e.target.value)}
        />
      </Field>
      <FieldWithError
        label="Fee (basis points, e.g. 250 = 2.5%)"
        error={feeError}
      >
        <input
          type="number"
          min="0"
          max="10000"
          className={inputCls}
          placeholder="0"
          value={data.feeBps}
          onChange={(e) => set("feeBps", e.target.value)}
        />
      </FieldWithError>
    </div>
  );
}
