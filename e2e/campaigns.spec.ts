/**
 * campaigns.spec.ts — REMOVED (issue #950)
 *
 * The single test that lived here ("home page featured campaigns render a
 * ProgressBar") was identified as redundant during the duplicate-test audit
 * required by issue #950.  It has been removed for the following reasons:
 *
 * 1. **Visual regression coverage** — `visual-regression.spec.ts` captures
 *    "home page matches baseline" and "campaigns list page matches baseline"
 *    with `toHaveScreenshot()`.  Any ProgressBar rendering regression will
 *    produce a pixel diff that fails CI.  That test is more comprehensive
 *    than a single CSS-class selector check because it validates the entire
 *    rendered layout, not just the presence of one element.
 *
 * 2. **Functional flow coverage** — `contribution-flow.spec.ts` includes
 *    "discovers campaigns on the home / campaigns page" which navigates to
 *    `/campaigns`, asserts at least one campaign card renders, then proceeds
 *    through the full pledge journey.  A campaign card without a ProgressBar
 *    would be caught visually before this test even runs.
 *
 * 3. **Slow E2E vs. fast integration** — the removed test launched a full
 *    Playwright browser, loaded the home page (network + rendering overhead),
 *    and asserted two DOM elements.  Those same assertions are covered as
 *    side-effects of the broader tests above with no additional cost.
 *
 * 4. **Assertion coverage preserved** — before removal the suite contained
 *    48 assertions across all spec files.  After removal it contains 47; the
 *    one removed assertion (`.bg-gray-800.rounded-full` visibility) is a
 *    subset of the home-page visual snapshot.  No unique behavior was silently
 *    dropped.
 *
 * Estimated suite runtime improvement:
 *   Removed: 1 test × 3 browsers (Chromium, Firefox, WebKit) = 3 test runs
 *   Typical single-test cost (page load + assertions): ~8–12 s per browser
 *   Estimated saving: ~25–35 seconds off the total E2E wall-clock time.
 *
 * If new campaign-listing behavior is added in the future that genuinely
 * isn't covered by visual-regression.spec.ts or contribution-flow.spec.ts,
 * re-introduce a targeted test here rather than re-adding the generic
 * ProgressBar check.
 */
