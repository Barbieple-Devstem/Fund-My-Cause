[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / PerformanceMetrics

# Interface: PerformanceMetrics

Defined in: [sdks/js/src/types.ts:107](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L107)

Derived performance and velocity metrics, returned by
`FmcClient.getPerformanceMetrics`.

All values are computed on-chain from contribution history. The projections
are indicative rather than guaranteed.

## Properties

### successRateBps

> **successRateBps**: `number`

Defined in: [sdks/js/src/types.ts:109](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L109)

Success rate in basis points (10 000 = 100%).

***

### contributionVelocityXlm

> **contributionVelocityXlm**: `number`

Defined in: [sdks/js/src/types.ts:111](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L111)

Recent contribution rate in XLM per day.

***

### trending

> **trending**: `number`

Defined in: [sdks/js/src/types.ts:113](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L113)

Trend indicator; positive means contributions are accelerating.

***

### milestonesReached

> **milestonesReached**: `number`

Defined in: [sdks/js/src/types.ts:115](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L115)

Milestones reached so far.

***

### totalMilestones

> **totalMilestones**: `number`

Defined in: [sdks/js/src/types.ts:117](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L117)

Milestones defined for this campaign.

***

### timeElapsedSeconds

> **timeElapsedSeconds**: `number`

Defined in: [sdks/js/src/types.ts:119](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L119)

Seconds since the campaign started.

***

### estimatedSecondsToGoal

> **estimatedSecondsToGoal**: `number`

Defined in: [sdks/js/src/types.ts:124](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L124)

Projected seconds until the goal is met, extrapolated from current
velocity. Expect very large values when velocity is near zero.

***

### avgDailyContributionXlm

> **avgDailyContributionXlm**: `number`

Defined in: [sdks/js/src/types.ts:126](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L126)

Mean contribution volume per day, in XLM.
