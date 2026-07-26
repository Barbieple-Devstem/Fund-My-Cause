import React from "react";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { PledgeModal } from "./PledgeModal";

expect.extend(toHaveNoViolations);

jest.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    address: null,
    connect: jest.fn(),
    signTx: jest.fn(),
    isSigning: false,
  }),
}));

jest.mock("@/hooks/useAccountExists", () => ({
  useAccountExists: () => ({ exists: true, loading: false }),
}));

jest.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: jest.fn() }),
}));

describe("PledgeModal accessibility", () => {
  it("has no critical or serious axe violations", async () => {
    const { container } = render(
      <PledgeModal
        contractId="CTEST123"
        campaignTitle="Save the Rainforest"
        minContribution={50_000_000n}
        onClose={jest.fn()}
      />,
    );

    const results = await axe(container);
    const criticalOrSerious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    expect(criticalOrSerious).toEqual([]);
    expect(results).toHaveNoViolations();
  });
});
