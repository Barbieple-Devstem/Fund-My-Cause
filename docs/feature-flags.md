# Feature Flag System

The Fund-My-Cause application includes a comprehensive feature flag system for controlling feature rollout and A/B testing.

## Overview

The feature flag system provides:
- **Gradual Rollout**: Control feature availability by percentage
- **User Targeting**: Enable features for specific users or groups
- **A/B Testing**: Test features with different user segments
- **Easy Management**: Simple UI for managing flags
- **Type-Safe**: Full TypeScript support

## Quick Start

### 1. Initialize Feature Flags

In your app's root component:

```tsx
import { FeatureFlagProvider, initializeFeatureFlags } from '@/lib/use-feature-flags';
import { FEATURE_FLAGS } from '@/lib/feature-flag-config';

// Initialize with all flags
const manager = initializeFeatureFlags();
Object.values(FEATURE_FLAGS).forEach(flag => {
  manager.registerFlag(flag);
});

export default function App() {
  return (
    <FeatureFlagProvider userId={userId} userGroups={userGroups}>
      {/* Your app content */}
    </FeatureFlagProvider>
  );
}
```

### 2. Use Feature Flags in Components

```tsx
import { useFeatureFlag, FeatureFlag } from '@/lib/use-feature-flags';

export function ContributionForm() {
  const hasRecurring = useFeatureFlag('recurring_contributions');
  const hasAnonymous = useFeatureFlag('anonymous_contributions');

  return (
    <div>
      {hasRecurring && <RecurringSchedulepicker />}
      {hasAnonymous && <AnonymousToggle />}
    </div>
  );
}
```

### 3. Conditional Rendering

```tsx
import { FeatureFlag } from '@/lib/use-feature-flags';

export function Dashboard() {
  return (
    <>
      <FeatureFlag name="ai_recommendations">
        <RecommendedCampaigns />
      </FeatureFlag>

      <FeatureFlag name="advanced_filters" fallback={<BasicFilters />}>
        <AdvancedFilters />
      </FeatureFlag>
    </>
  );
}
```

## Feature Flag Configuration

Feature flags are defined in `src/lib/feature-flag-config.ts`:

```typescript
export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  RECURRING_CONTRIBUTIONS: {
    name: 'recurring_contributions',
    enabled: true,
    rolloutPercentage: 50,
    metadata: {
      description: 'Enable recurring contribution feature',
      releaseDate: '2026-05-01',
    },
  },
  // ... more flags
};
```

Only flags whose outcome is still undecided live here. A flag at 100% rollout
always returns `true` and a permanently disabled flag always returns `false` —
both are dead configuration, so they get retired (see
[Cleanup](#4-cleanup)) rather than left in place.

### Flag Properties

- **name**: Unique identifier for the flag
- **enabled**: Global on/off switch
- **rolloutPercentage**: Percentage of users to enable for (0-100)
- **targetUsers**: Specific user IDs to enable for
- **targetGroups**: User groups to enable for (e.g., 'beta_testers')
- **metadata**: Additional information (description, release date, etc.)

## Rollout Strategies

### Percentage-Based Rollout

Enable a feature for a percentage of users:

```typescript
{
  name: 'new_feature',
  enabled: true,
  rolloutPercentage: 25, // 25% of users
}
```

The system uses consistent hashing based on user ID to ensure the same user always gets the same experience.

### User Targeting

Enable for specific users:

```typescript
{
  name: 'beta_feature',
  enabled: true,
  rolloutPercentage: 0,
  targetUsers: ['user123', 'user456'],
}
```

### Group Targeting

Enable for user groups:

```typescript
{
  name: 'admin_feature',
  enabled: true,
  rolloutPercentage: 0,
  targetGroups: ['admins', 'moderators'],
}
```

### Combined Strategies

Combine multiple strategies:

```typescript
{
  name: 'premium_feature',
  enabled: true,
  rolloutPercentage: 50,
  targetUsers: ['vip_user1'],
  targetGroups: ['premium_members'],
}
```

## Management UI

Access the feature flag management UI at `/admin/feature-flags`:

```tsx
import { FeatureFlagManagerUI } from '@/components/FeatureFlagManager';

export function AdminPage() {
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <FeatureFlagManagerUI />
    </div>
  );
}
```

The UI allows you to:
- View all feature flags
- Toggle flags on/off
- Adjust rollout percentages
- View flag metadata

## API Reference

### Hooks

#### `useFeatureFlag(flagName: string): boolean`

Check if a feature is enabled:

```tsx
const isEnabled = useFeatureFlag('recurring_contributions');
```

#### `useFeatureFlagConfig(flagName: string): FeatureFlag | undefined`

Get the full flag configuration:

```tsx
const flag = useFeatureFlagConfig('recurring_contributions');
console.log(flag?.rolloutPercentage);
```

#### `useAllFeatureFlags(): FeatureFlag[]`

Get all feature flags:

```tsx
const flags = useAllFeatureFlags();
```

#### `useRegisterFeatureFlag(flag: FeatureFlag): void`

Register a new feature flag:

```tsx
useRegisterFeatureFlag({
  name: 'new_feature',
  enabled: true,
  rolloutPercentage: 50,
});
```

#### `useUpdateFeatureFlag(name: string, updates: Partial<FeatureFlag>): () => void`

Update a feature flag:

```tsx
const updateFlag = useUpdateFeatureFlag('recurring_contributions', {
  rolloutPercentage: 75,
});
updateFlag();
```

### Functions

#### `isFeatureEnabled(flagName: string, userId?: string, userGroups?: string[]): boolean`

Check if a feature is enabled (outside React):

```typescript
if (isFeatureEnabled('recurring_contributions', userId, userGroups)) {
  // Feature is enabled
}
```

#### `registerFeatureFlag(flag: FeatureFlag): void`

Register a feature flag (outside React):

```typescript
registerFeatureFlag({
  name: 'new_feature',
  enabled: true,
  rolloutPercentage: 50,
});
```

#### `updateFeatureFlag(name: string, updates: Partial<FeatureFlag>): void`

Update a feature flag (outside React):

```typescript
updateFeatureFlag('recurring_contributions', {
  rolloutPercentage: 75,
});
```

## Best Practices

### 1. Naming Conventions

Use clear, descriptive names:

```typescript
// Good
'anonymous_contributions'
'recurring_contributions'
'ai_recommendations'

// Avoid
'feature1'
'new_thing'
'test'
```

### 2. Gradual Rollout

Start with a small percentage and increase:

```typescript
// Day 1: 5% of users
rolloutPercentage: 5

// Day 3: 25% of users
rolloutPercentage: 25

// Day 7: 100% of users
rolloutPercentage: 100
```

### 3. Monitoring

Monitor feature usage and errors:

```tsx
export function useFeatureFlagWithTracking(flagName: string) {
  const isEnabled = useFeatureFlag(flagName);
  
  useEffect(() => {
    if (isEnabled) {
      trackEvent('feature_enabled', { flag: flagName });
    }
  }, [isEnabled, flagName]);
  
  return isEnabled;
}
```

### 4. Cleanup

A flag is *resolved* once it can only ever evaluate one way: `enabled: true` at
`rolloutPercentage: 100` with no target group (permanently on), or `enabled:
false` at `rolloutPercentage: 0` (permanently off). Resolved flags are removed,
not left pinned — a stale flag makes reviewers hunt for a branch that no longer
has two sides.

Retirement checklist, in order:

1. Confirm with the feature owner that the rollout is finished and won't be
   reverted.
2. Delete the dead branch at every call site, keeping only the live path, and
   inline any condition that has become unconditional.
3. Remove the flag's entry from `src/lib/feature-flag-config.ts`.
4. Delete any test mocks or stubs that referenced the flag.
5. Re-run the component test suite — behaviour should be unchanged.

Flags retired in the 2026-07 sweep (issue #864): `campaign_categories`,
`campaign_updates`, `campaign_image_upload`, `social_sharing`,
`campaign_analytics`, `lazy_loading` and `image_optimization` (all at 100%),
plus `maintenance_mode` (permanently off). Each had already been rolled out to
completion and no component branched on it, so no call sites needed inlining.

### 5. Documentation

Document why each flag exists:

```typescript
{
  name: 'ai_recommendations',
  enabled: true,
  rolloutPercentage: 10,
  metadata: {
    description: 'AI-powered campaign recommendations',
    releaseDate: '2026-06-01',
    experimental: true,
    issue: 'https://github.com/Fund-My-Cause/Fund-My-Cause/issues/123',
  },
}
```

## Integration with External Services

### LaunchDarkly Integration

To integrate with LaunchDarkly:

```typescript
import * as LaunchDarkly from '@launchdarkly/js-client-sdk';

const ldClient = LaunchDarkly.initialize(
  'YOUR_CLIENT_ID',
  { key: userId }
);

export function useFeatureFlagLD(flagName: string): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    ldClient.on('ready', () => {
      setIsEnabled(ldClient.variation(flagName, false));
    });
  }, [flagName]);

  return isEnabled;
}
```

### Custom Backend Integration

To fetch flags from your backend:

```typescript
export async function fetchFeatureFlags(userId: string) {
  const response = await fetch(`/api/feature-flags?userId=${userId}`);
  const flags = await response.json();
  
  flags.forEach(flag => {
    registerFeatureFlag(flag);
  });
}
```

## Troubleshooting

### Feature Not Showing

1. Check if flag is enabled: `flag.enabled === true`
2. Check rollout percentage: `flag.rolloutPercentage > 0`
3. Check user targeting: Is user in `targetUsers` or `targetGroups`?
4. Check provider setup: Is `FeatureFlagProvider` wrapping your component?

### Inconsistent Behavior

Feature flags use consistent hashing based on user ID. If a user sees different behavior:

1. Verify user ID is consistent
2. Check if flag was updated recently
3. Clear browser cache
4. Check browser console for errors

## Examples

### A/B Testing

```tsx
export function CampaignForm() {
  const useNewDesign = useFeatureFlag('new_campaign_form_design');

  return useNewDesign ? <NewCampaignForm /> : <LegacyCampaignForm />;
}
```

### Gradual Feature Release

```tsx
export function Dashboard() {
  const hasRecommendations = useFeatureFlag('ai_recommendations');
  const hasAdvancedFilters = useFeatureFlag('advanced_filters');

  return (
    <div>
      {hasRecommendations && <RecommendedCampaigns />}
      {hasAdvancedFilters && <AdvancedFilters />}
    </div>
  );
}
```

### Beta Testing

```tsx
export function BetaFeatures() {
  const isBetaTester = useFeatureFlag('beta_features');

  if (!isBetaTester) {
    return <div>This feature is not available yet</div>;
  }

  return <ExperimentalFeature />;
}
```

## Support

For issues or questions about feature flags:
1. Check the troubleshooting section above
2. Review the feature flag configuration
3. Check browser console for errors
4. Contact the development team
