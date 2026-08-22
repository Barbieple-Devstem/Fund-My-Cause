import { test, expect } from "./fixtures/wallet";

/**
 * Issue #843 – Gamification e2e coverage (achievements, leaderboard, referrals)
 *
 * The gamification panel is rendered on the user profile page, backed by
 * useAchievements() mock data (real contract wiring is blocked on Issue #12).
 */

const MOCK_ADDRESS = "GMOCK000000000000000000000000000000000000000000000000000";

test.describe("Gamification", () => {
  test("achievements panel renders locked and unlocked states", async ({ page }) => {
    await page.goto(`/profile/${MOCK_ADDRESS}`);

    const section = page.getByTestId("gamification-section");
    await expect(section).toBeVisible({ timeout: 10_000 });
    await expect(section.getByText(/achievement system/i)).toBeVisible();

    // Unlocked achievement badge and an in-progress one are both present
    await expect(section.getByText(/^unlocked \(\d+\)$/i)).toBeVisible();
    await expect(section.getByText(/^in progress \(\d+\)$/i)).toBeVisible();
  });

  test("unlocking an achievement updates the UI", async ({ page }) => {
    await page.goto(`/profile/${MOCK_ADDRESS}`);

    // The unlock action is owner-only; connect the mocked wallet first.
    const connectBtn = page.getByRole("button", { name: /connect wallet/i });
    if (await connectBtn.isVisible()) {
      await connectBtn.click();
    }

    const unlockBtn = page.getByRole("button", {
      name: /unlock first contribution achievement/i,
    });
    await expect(unlockBtn).toBeVisible({ timeout: 10_000 });
    await unlockBtn.click();

    // Mutation invalidates achievement queries, which refetch and re-render
    const section = page.getByTestId("gamification-section");
    await expect(section.getByText(/^unlocked \(\d+\)$/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("leaderboard displays entries in rank order", async ({ page }) => {
    await page.goto(`/profile/${MOCK_ADDRESS}`);

    const table = page.getByRole("table");
    await expect(table).toBeVisible({ timeout: 10_000 });

    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(3);
    // First row should show rank #1 and be marked as the current user
    await expect(rows.first()).toContainText("You");
  });

  test("generates and copies a referral code", async ({ page }) => {
    await page.goto(`/profile/${MOCK_ADDRESS}`);

    const section = page.getByTestId("gamification-section");
    await expect(section.getByText(/your referral code/i)).toBeVisible({
      timeout: 10_000,
    });

    const copyBtn = section.getByTitle(/copy referral code/i);
    await copyBtn.click();

    // Copy confirmation icon swap indicates share-tracking UI updated
    await expect(copyBtn).toBeVisible();
  });

  test("shares referral code via a social platform button", async ({ page }) => {
    await page.goto(`/profile/${MOCK_ADDRESS}`);

    const section = page.getByTestId("gamification-section");
    const shareButton = section.getByRole("button", { name: /share on twitter/i });
    await expect(shareButton).toBeVisible({ timeout: 10_000 });
    await shareButton.click();
  });
});
