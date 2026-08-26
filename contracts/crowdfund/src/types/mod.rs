// These are public API re-exports for external consumers; not all are
// referenced internally, but all should remain accessible.
#![allow(unused_imports)]

/// Types for the crowdfund contract, split into two sub-modules:
///
/// - [`domain`] — storage/state types, enums, `DataKey`, and non-event structs.
/// - [`events`] — structured event payload types (`Event*` structs).
///
/// Everything is re-exported at this level so existing `use crate::types::*`
/// or `use crate::types::Foo` imports continue to resolve without any change.
pub mod domain;
pub mod events;

// ── Re-export all domain types ────────────────────────────────────────────────
pub use domain::{
    AnalyticsDataPoint, CampaignAnalytics, CampaignInfo, CampaignStats, CampaignTemplate,
    CampaignUpdate, Category, ContractStateSnapshot, ContributionRecord, DataKey, Delegation,
    Dispute, DisputeStatus, ExecutionRecord, ExtensionProposal, FeeMode, FunctionPerfStats,
    GoalAdjustment, GovernanceConfig, GovernanceProposal, InsuranceConfig, MatchingConfig,
    MetadataVersion, Milestone, MilestoneStatus, PerformanceMetrics, PlatformConfig,
    QfContributorInput, QfInputs, RateLimit, RecurringPlan, RewardConfig, RewardTier,
    SearchIndexEntry, StateValidationResult, Status, StreamConfig, TemplateType,
    VerificationStatus, VersionMigration, VestingSchedule, Visibility, YieldConfig, YieldInfo,
};

// ── Re-export all event types ─────────────────────────────────────────────────
pub use events::{
    EventAllowlistRemoved, EventAllowlisted, EventAnalyticsGenerated, EventArchived,
    EventBatchRefundCompleted, EventBlacklistRemoved, EventBlacklisted, EventCampaignCloned,
    EventCampaignIndexed, EventCancelled, EventCapsConfigured, EventCategoryUpdated,
    EventContractMigrated, EventContributed, EventContributionRecorded, EventDeadlineExtended,
    EventDebugLog, EventDebugSnapshot, EventDelegatedContribution, EventDelegationCreated,
    EventDelegationRevoked, EventDenylistRemoved, EventDenylisted, EventDisputeFiled,
    EventDisputeResolved, EventDisputeVoted, EventEmergencyApproved, EventEmergencyExecuted,
    EventEmergencyInitiated, EventExecutionRecorded, EventExtensionExecuted,
    EventExtensionProposed, EventExtensionVoted, EventGoalAdjusted, EventGovernanceConfigUpdated,
    EventGovernanceEmergencyPaused, EventGovernanceEmergencyResumed, EventGovernanceExecuted,
    EventGovernanceProposed, EventGovernanceVoted, EventInitialized, EventInsuranceEnabled,
    EventInsurancePayout, EventInvariantViolated, EventIpfsCidUpdated, EventMatchingSetup,
    EventMetadataUpdated, EventMetadataVersioned, EventMilestoneReached, EventMilestoneRelease,
    EventMilestoneVerified, EventMultiSigConfigured, EventOwnershipTransferred, EventPartialRefund,
    EventPaused, EventPausedWithTimelock, EventPerfAlert, EventQfContribution, EventRateLimitHit,
    EventRateLimitUpdated, EventRecurringCancelled, EventRecurringExecuted, EventRecurringSetup,
    EventRefunded, EventResumed, EventRewardsConfigured, EventRewardsDistributed,
    EventStateValidated, EventStatusChanged, EventStreamClaimed, EventTemplateApplied,
    EventTierAssigned, EventTiersSet, EventVerificationUpdated, EventVersionChecked,
    EventVisibilityChanged, EventWhitelistOnlySet, EventWhitelistRemoved, EventWhitelisted,
    EventWithdrawn, EventYieldClaimed, EventYieldConfigured,
};

// ── Issue #703 / #924: Event schema versioning ───────────────────────────────
/// Current event schema version. Re-exported from `common`'s shared event
/// convention (see `contracts/common/src/events.rs`) so all three contracts
/// start from the same version number. Bump this when the shape of any
/// emitted event payload changes in a backwards-incompatible way so that
/// indexers can adapt without guessing.
pub use common::EVENT_SCHEMA_VERSION;
