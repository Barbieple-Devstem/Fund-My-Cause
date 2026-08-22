/**
 * Repository interfaces for indexer data access (#898).
 *
 * Handlers depend on these interfaces rather than on `EventStore` directly.
 * This decouples business logic from the storage layer and makes handlers
 * independently testable via a mock implementation.
 *
 * Covered domains:
 *  - EventRepository  – generic contract-event access
 *  - CampaignRepository  – campaign-scoped event queries
 *  - ContributionRepository – contribution-event queries
 *
 * The current backing store is the in-memory EventStore.  Switching to a
 * durable store in the future only requires a new class that satisfies these
 * interfaces — handler code is unaffected.
 */

import type { IndexerEvent } from "./rpc-client.js";

// ---------------------------------------------------------------------------
// EventRepository
// ---------------------------------------------------------------------------

/**
 * Generic access to the raw indexed event stream.
 *
 * This is the primary interface for anything that needs to query events by
 * contract or by type without any domain-level interpretation.
 */
export interface EventRepository {
  /** Persist a batch of events (idempotent: duplicate IDs are ignored). */
  addEvents(events: IndexerEvent[]): void;

  /** Query events by contract address, newest first. */
  queryByContract(contractId: string, limit?: number): IndexerEvent[];

  /** Query events by event type, newest first. */
  queryByType(type: string, limit?: number): IndexerEvent[];

  /** Return up to `limit` most recent events across all contracts. */
  getAllEvents(limit?: number): IndexerEvent[];

  /** Total number of events currently stored. */
  getCount(): number;
}

// ---------------------------------------------------------------------------
// CampaignRepository
// ---------------------------------------------------------------------------

/**
 * Domain-level access to campaign-related events.
 *
 * Handlers that display campaign state or activity use this interface so
 * they are not coupled to how campaign events are stored or keyed.
 */
export interface CampaignRepository {
  /**
   * Return recent events for a specific campaign contract.
   * @param campaignId Soroban contract address of the campaign.
   * @param limit      Maximum number of events to return (default 100).
   */
  getEventsByCampaign(campaignId: string, limit?: number): IndexerEvent[];
}

// ---------------------------------------------------------------------------
// ContributionRepository
// ---------------------------------------------------------------------------

/**
 * Domain-level access to contribution events.
 */
export interface ContributionRepository {
  /**
   * Return recent contribution events (type "Contribute") for a campaign.
   * @param campaignId  Soroban contract address of the campaign.
   * @param limit       Maximum number of events to return (default 100).
   */
  getContributionsForCampaign(campaignId: string, limit?: number): IndexerEvent[];
}
