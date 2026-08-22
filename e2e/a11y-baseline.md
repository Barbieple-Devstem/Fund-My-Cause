# Accessibility Baseline

## Known Issues

This document tracks baseline accessibility violations to be fixed incrementally without blocking CI.

### Color Contrast (2 issues)

- **Location**: Home page hero section
- **Impact**: Moderate
- **Status**: Planned for Q3 2026
- **WCAG**: 1.4.3 (AA)

---

## How to Update Baseline

When fixing an issue, update the count in `e2e/accessibility.spec.ts` and this file.

## Testing Locally

```bash
npm run test:e2e -- accessibility.spec.ts
```

## CI Enforcement

- **Critical/Serious violations**: Block PR
- **Moderate/Minor violations**: Warning only
- **Baseline issues**: Tracked but not blocking
