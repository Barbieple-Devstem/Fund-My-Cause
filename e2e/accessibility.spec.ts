import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility Regression Tests
 * Validates WCAG compliance using axe-core.
 * Tests fail on new serious/critical violations.
 */

// Known baseline issues (to be fixed incrementally)
const BASELINE_VIOLATIONS = {
  "color-contrast": 2, // 2 known contrast issues
};

test.describe("Accessibility Regression", () => {
  test("home page has no new a11y violations", async ({ page }) => {
    await page.goto("/");
    
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const criticalViolations = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test("campaigns list page has no new a11y violations", async ({ page }) => {
    await page.goto("/campaigns");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const criticalViolations = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test("campaign detail page has no new a11y violations", async ({ page }) => {
    await page.goto("/campaigns");
    
    // Wait for campaigns to load and click first one
    await page.waitForSelector('[data-testid="campaign-card"]', { timeout: 10000 });
    await page.click('[data-testid="campaign-card"]:first-child');

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const criticalViolations = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test("create campaign page has no new a11y violations", async ({ page }) => {
    await page.goto("/create");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const criticalViolations = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test("profile page has no new a11y violations", async ({ page }) => {
    await page.goto("/profile");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const criticalViolations = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test("dashboard page has no new a11y violations", async ({ page }) => {
    await page.goto("/dashboard");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const criticalViolations = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test("keyboard navigation works on home page", async ({ page }) => {
    await page.goto("/");

    // Tab through interactive elements
    await page.keyboard.press("Tab");
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(firstFocused).toBeTruthy();

    // Ensure focus is visible
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const focusRing = await page.evaluate(() => {
      const el = document.activeElement;
      const styles = window.getComputedStyle(el!);
      return styles.outlineWidth !== "0px" || styles.boxShadow !== "none";
    });
    
    expect(focusRing).toBeTruthy();
  });

  test("screen reader landmarks are present", async ({ page }) => {
    await page.goto("/");

    const landmarks = await page.evaluate(() => {
      const main = document.querySelector("main");
      const nav = document.querySelector("nav");
      const footer = document.querySelector("footer");
      return { main: !!main, nav: !!nav, footer: !!footer };
    });

    expect(landmarks.main).toBe(true);
    expect(landmarks.nav).toBe(true);
  });
});
