import { test, expect } from "./fixtures/wallet";

/**
 * Issue #842 – Team management & RBAC delegation e2e coverage
 *
 * The team management panel is rendered on the campaign detail page once a
 * wallet is connected. It is currently backed by local mock data inside
 * TeamManagement.tsx (real on-chain RBAC wiring is a follow-up) — the
 * connected wallet is always treated as the campaign Owner, mirroring the
 * component's own mock fetchTeamData().
 */

async function openFirstCampaign(page: import("@playwright/test").Page) {
  await page.goto("/campaigns");
  await page.locator("a[href*='/campaigns/']").first().click();
}

async function connectWallet(page: import("@playwright/test").Page) {
  const connectBtn = page.getByRole("button", { name: /connect wallet/i });
  if (await connectBtn.isVisible().catch(() => false)) {
    await connectBtn.click();
  }
}

test.describe("Team Management & RBAC", () => {
  test("team management panel is hidden without a connected wallet", async ({
    page,
  }) => {
    await page.goto("/campaigns");
    await page.locator("a[href*='/campaigns/']").first().click();

    await expect(page.getByRole("heading", { name: /manage team/i })).toHaveCount(0);
  });

  test("owner can access the team management panel after connecting", async ({
    page,
  }) => {
    await openFirstCampaign(page);
    await connectWallet(page);

    const section = page.getByTestId("team-management-section");
    await expect(section).toBeVisible({ timeout: 10_000 });
    await expect(section.getByRole("heading", { name: /manage team/i })).toBeVisible();
    await expect(section.getByText(/Team Members \(1\)/i)).toBeVisible();
  });

  test("invites a member and shows the assigned role in the Invitations tab", async ({
    page,
  }) => {
    await openFirstCampaign(page);
    await connectWallet(page);

    const section = page.getByTestId("team-management-section");
    await expect(section).toBeVisible({ timeout: 10_000 });

    await section.getByLabel("Email address").fill("editor@example.com");
    await section.getByLabel("Invite role").selectOption("Editor");
    await section.getByRole("button", { name: /send invitation/i }).click();

    await expect(
      section.getByText("Invitation sent to editor@example.com"),
    ).toBeVisible();

    await section.getByRole("tab", { name: /invitations/i }).click();
    await expect(section.getByText("editor@example.com")).toBeVisible();
  });

  test("role permissions reference lists permissions for every role", async ({
    page,
  }) => {
    await openFirstCampaign(page);
    await connectWallet(page);

    const section = page.getByTestId("team-management-section");
    await expect(section).toBeVisible({ timeout: 10_000 });

    const reference = section.getByTestId("role-permissions-reference");
    await expect(reference.getByText("Withdraw Funds")).toBeVisible();
    await expect(reference.getByText("Manage Delegations")).toBeVisible();
    await expect(reference.getByText("Multi-Sig")).toBeVisible();
  });

  test("creates and revokes a role delegation", async ({ page }) => {
    await openFirstCampaign(page);
    await connectWallet(page);

    const section = page.getByTestId("team-management-section");
    await expect(section).toBeVisible({ timeout: 10_000 });

    await section.getByRole("tab", { name: /delegations/i }).click();
    await section
      .getByLabel("Delegatee address")
      .fill("GDELEGATE00000000000000000000000000000000000000000000000");
    await section.getByLabel("Delegate role").selectOption("Viewer");
    await section.getByRole("button", { name: /^delegate$/i }).click();

    await expect(
      section.getByText("Delegation created successfully"),
    ).toBeVisible();

    await section
      .getByLabel(/revoke delegation for gdelegate/i)
      .click();
    await expect(page.getByRole("dialog")).toContainText("Revoke Delegation");
    await page.getByRole("button", { name: /^revoke$/i }).click();

    await expect(
      section.getByText("Delegation revoked successfully"),
    ).toBeVisible();
  });

  test("negative: the owner cannot remove their own membership", async ({
    page,
  }) => {
    await openFirstCampaign(page);
    await connectWallet(page);

    const section = page.getByTestId("team-management-section");
    await expect(section).toBeVisible({ timeout: 10_000 });

    // The only seeded member is the connected owner, whose own row has no
    // remove control — self-removal must be denied.
    const removeButtons = section.getByRole("button", { name: /^remove /i });
    await expect(removeButtons).toHaveCount(0);
  });
});
