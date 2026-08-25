# Cross-Browser Testing Guide

## Overview

This project uses Playwright to test across three browser engines:
- **Chromium** (Chrome, Edge, Brave)
- **Firefox**
- **WebKit** (Safari)

## Running Tests

### Run all browsers locally
```bash
npm run test:e2e
```

### Run specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run with UI mode (recommended for debugging)
```bash
npx playwright test --ui
```

### Debug specific test on specific browser
```bash
npx playwright test --project=webkit --debug e2e/contribution-flow.spec.ts
```

## CI/CD Pipeline

On every PR, tests run automatically across all three browsers in parallel:
- Each browser runs in its own job
- Failed tests generate browser-specific artifacts
- Test reports are uploaded for each browser separately

## Browser-Specific Configurations

### Chromium
- Standard timeout: 15s for actions, 30s for navigation
- Uses Desktop Chrome device profile
- Includes `--disable-web-security` flag for development

### Firefox
- Standard timeout: 15s for actions, 30s for navigation
- Uses Desktop Firefox device profile
- Fake media streams enabled for testing
- **Note:** Visual regression tests disabled (Chromium only for consistency)

### WebKit
- Extended timeout: 20s for actions, 40s for navigation (slower rendering)
- Uses Desktop Safari device profile
- **Note:** Visual regression tests disabled (Chromium only for consistency)

## Known Browser Differences & Issues

### Tracked Issues

#### WebKit
- [ ] **Timeout sensitivity**: WebKit may require longer timeouts for complex interactions
- [ ] **CSS animations**: Some animations may render differently
- [ ] **Date pickers**: Native date input behavior differs from Chromium/Firefox

#### Firefox
- [ ] **Clipboard API**: May require different permissions handling
- [ ] **Web3/Wallet mocking**: Freighter wallet extension behavior may differ

#### All Browsers
- [x] Visual regression tests limited to Chromium for consistent baselines
- [x] Core flows (navigation, campaign creation, contribution) pass on all engines

### Testing Strategy

1. **Core flows** must pass on all three engines
2. **Visual regression** uses Chromium as the baseline browser
3. **Browser-specific issues** are tracked in this document
4. **Flaky tests** should be investigated and fixed, not ignored

## Debugging Browser-Specific Failures

1. **Run locally first**:
   ```bash
   npx playwright test --project=webkit --debug
   ```

2. **Check browser-specific artifacts** in CI (under Actions → Artifacts)

3. **Compare behavior** across browsers:
   ```bash
   npx playwright test --headed --project=chromium,firefox,webkit
   ```

4. **Use browser inspector**:
   ```bash
   PWDEBUG=1 npx playwright test --project=webkit
   ```

## Adding Browser-Specific Workarounds

If a test needs browser-specific behavior, use:

```typescript
import { test, expect } from '@playwright/test';

test('example with browser check', async ({ page, browserName }) => {
  await page.goto('/');
  
  if (browserName === 'webkit') {
    // WebKit-specific workaround
    await page.waitForTimeout(1000);
  }
  
  await expect(page.locator('h1')).toBeVisible();
});
```

## Updating Baselines

Visual regression baselines are Chromium-only:

```bash
npx playwright test --update-snapshots --project=chromium
```

## Resources

- [Playwright Cross-Browser Testing](https://playwright.dev/docs/browsers)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Browser Compatibility](https://caniuse.com/)
