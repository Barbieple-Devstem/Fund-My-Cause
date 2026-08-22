---
name: Browser Compatibility Issue
about: Report a browser-specific test failure or compatibility issue
title: '[Browser] '
labels: 'testing, browser-compatibility'
assignees: ''
---

## Browser Information
- **Browser Engine:** [Chromium / Firefox / WebKit]
- **Test File:** [e.g., e2e/contribution-flow.spec.ts]
- **Test Name:** [e.g., "completes full contribute journey"]

## Description
A clear description of the browser-specific issue.

## Expected Behavior
What should happen (working behavior in other browsers).

## Actual Behavior
What actually happens in the affected browser.

## Reproduction Steps
1. Run `npx playwright test --project=[browser] [test-file]`
2. Observe failure at step X
3. ...

## Error Message / Stack Trace
```
Paste error message here
```

## Screenshots / Videos
If available, attach Playwright screenshots or videos from the test artifacts.

## Environment
- **Playwright Version:** [e.g., 1.58.2]
- **Node Version:** [e.g., 20.x]
- **OS:** [e.g., Ubuntu 22.04, macOS 14]

## Additional Context
- Is this issue consistent or flaky?
- Does it occur locally or only in CI?
- Are there any console errors in the browser?

## Proposed Solution
If you have ideas on how to fix this issue, please share them here.
