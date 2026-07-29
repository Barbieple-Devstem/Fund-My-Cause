import { test, expect } from "./fixtures/wallet";
import * as path from "path";

test.describe("Campaign Creation Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Pinata API file upload POST requests and return mock IPFS URI
    await page.route("https://api.pinata.cloud/pinning/pinFileToIPFS", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ IpfsHash: "QmMockImageHash" }),
      });
    });
  });

  test("should successfully complete campaign creation wizard (valid path)", async ({ page }) => {
    await page.goto("/create");

    // 1. Basic Info Step
    await page.fill("input[label='Contract ID']", "CTESTCAMPAIGN111111111111111111111111111111111111111111");
    await page.fill("input[label='Token Address']", "CTOKEN11111111111111111111111111111111111111111111111");
    await page.fill("input[label='Title']", "Save the Rainforest");
    await page.fill("textarea[label='Description']", "Help us protect endangered species and their habitats");
    
    // Select category (medical)
    await page.selectOption("select[label='Category']", "medical");

    await page.fill("input[label='Goal (XLM)']", "1000");
    await page.fill("input[label='Min Contribution (XLM)']", "10");

    // Set deadline to tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];
    await page.fill("input[label='Deadline']", dateStr);

    await page.click("button:has-text('Next')");

    // 2. Media Step
    await expect(page.locator("text=Campaign Image")).toBeVisible();

    // Upload mock 1x1 pixel PNG image file using buffer
    const mockPngBuffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    await page.setInputFiles("input[type='file']", {
      name: "test.png",
      mimeType: "image/png",
      buffer: mockPngBuffer,
    });

    // Wait for crop tool to appear and click Confirm Crop
    await page.click("button:has-text('Confirm Crop')");

    // Fill optional video URL
    await page.fill("input[aria-label='Campaign video URL']", "https://youtube.com/watch?v=abcdef");

    await page.click("button:has-text('Next')");

    // 3. FAQ & Team Step
    await page.click("button:has-text('Add FAQ')");
    await page.fill("input[placeholder='Question']", "Is this audit complete?");
    await page.fill("textarea[placeholder='Answer']", "Yes, we are audited.");

    await page.click("button:has-text('Add Member')");
    await page.fill("input[placeholder='Name']", "John Owner");
    await page.fill("input[placeholder='Role (e.g. Lead Developer)']", "Project Lead");

    await page.click("button:has-text('Next')");

    // 4. Platform Config Step
    await page.fill("input[label='Platform Fee Address']", "GA5W32UAQEAVJAAOOSBDBUXBKI6T6T6T6T6T6T6T6T6T6T6T6T6T6T6T");
    await page.fill("input[label*='Fee (basis points']", "250");

    await page.click("button:has-text('Review & Deploy')");

    // 5. Review Step
    await expect(page.locator("text=Review & Deploy")).toBeVisible();
    await page.click("button:has-text('Review & Deploy')"); // Final submit button inside wizard container

    // 6. Sign & Deploy Step (CampaignPreview)
    await expect(page.locator("text=Sign & Deploy")).toBeVisible();
    await page.click("button:has-text('Sign & Deploy')");

    // 7. Success Screen & Redirect to Home
    await expect(page.locator("text=Campaign Deployed!")).toBeVisible();
    await page.click("button:has-text('Back to Home')");

    // Confirm redirected to home / list view
    await expect(page).toHaveURL("/");
  });

  test("should display validation errors and block wizard progression (invalid path)", async ({ page }) => {
    await page.goto("/create");

    // Try navigating with empty fields
    await page.click("button:has-text('Next')");
    await expect(page.locator("text=Contract ID is required.")).toBeVisible();

    // Fill invalid Contract ID and check error
    await page.fill("input[label='Contract ID']", "INVALID");
    await page.click("button:has-text('Next')");
    await expect(page.locator("text=Contract ID is invalid.")).toBeVisible();

    // Fill valid contract/token but invalid goal/min contribution
    await page.fill("input[label='Contract ID']", "CTESTCAMPAIGN111111111111111111111111111111111111111111");
    await page.fill("input[label='Token Address']", "CTOKEN11111111111111111111111111111111111111111111111");
    await page.fill("input[label='Title']", "Save the Rainforest");
    await page.fill("textarea[label='Description']", "Help us protect endangered species");
    await page.selectOption("select[label='Category']", "medical");
    await page.fill("input[label='Goal (XLM)']", "-50"); // Invalid negative goal
    await page.fill("input[label='Min Contribution (XLM)']", "10");

    // Set deadline in past
    await page.fill("input[label='Deadline']", "2020-01-01");

    await page.click("button:has-text('Next')");
    await expect(page.locator("text=Goal must be a positive number.")).toBeVisible();
  });
});
