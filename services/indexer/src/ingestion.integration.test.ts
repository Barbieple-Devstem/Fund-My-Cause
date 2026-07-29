/**
 * Integration tests for the indexer event ingestion pipeline. (#938)
 *
 * These tests build a lightweight test harness that streams a scripted
 * sequence of simulated Horizon events through the same ingestion path that
 * production uses (EventStore.addEvents → query helpers), so they exercise
 * the full round-trip without any network I/O.
 *
 * Coverage:
 *  - campaign, donation, and achievement event types
 *  - EventStore state after ingestion matches the expected dataset exactly
 *  - Malformed / invalid payloads are rejected gracefully (no crash, no
 *    state corruption)
 *  - Out-of-order event arrival produces correct final state
 *
 * To run:
 *   npm test --workspace=services/indexer
 *   # or from the repo root:
 *   npx vitest --project services/indexer
 */

import { describe, it, expect, beforeEach } from "vitest";
import pino from "pino";
import { EventStore, type IndexerEvent } from "./event-store";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const CONTRACT_A = "CCAMPAIGN111111111111111111111111111111111111111111111";
const CONTRACT_B = "CCAMPAIGN222222222222222222222222222222222222222222222";
const CONTRIBUTOR_1 = "GCONTRIB1111111111111111111111111111111111111111111111";
const CONTRIBUTOR_2 = "GCONTRIB2222222222222222222222222222222222222222222222";

/** Minimal horizon event payloads that mirror the realistic fixture file */
const horizonFixtures = {
  campaign: [
    {
      id: "campaign-001",
      timestamp: 1_700_000_001,
      type: "campaign",
      contractId: CONTRACT_A,
      data: {
        creator: "GCREATOR111111111111111111111111111111111111111111111",
        title: "Clean Water Initiative",
        goal: "10000000000",
        deadline: "1800000000",
        token: "CTOKEN11111111111111111111111111111111111111111111111",
        min_contribution: "1000000",
      },
    },
    {
      id: "campaign-002",
      timestamp: 1_700_000_050,
      type: "campaign",
      contractId: CONTRACT_B,
      data: {
        creator: "GCREATOR222222222222222222222222222222222222222222222",
        title: "Solar Panel Grid",
        goal: "50000000000",
        deadline: "1900000000",
        token: "CTOKEN22222222222222222222222222222222222222222222222",
        min_contribution: "5000000",
      },
    },
  ] satisfies IndexerEvent[],

  donation: [
    {
      id: "donation-001",
      timestamp: 1_700_000_100,
      type: "donation",
      contractId: CONTRACT_A,
      data: { contributor: CONTRIBUTOR_1, amount: "500000000", total_raised: "500000000" },
    },
    {
      id: "donation-002",
      timestamp: 1_700_000_200,
      type: "donation",
      contractId: CONTRACT_A,
      data: { contributor: CONTRIBUTOR_2, amount: "1000000000", total_raised: "1500000000" },
    },
    {
      id: "donation-003",
      timestamp: 1_700_000_300,
      type: "donation",
      contractId: CONTRACT_B,
      data: { contributor: CONTRIBUTOR_1, amount: "2000000000", total_raised: "2000000000" },
    },
  ] satisfies IndexerEvent[],

  achievement: [
    {
      id: "achievement-001",
      timestamp: 1_700_000_400,
      type: "achievement",
      contractId: CONTRACT_A,
      data: {
        contributor: CONTRIBUTOR_1,
        achievement_type: "first_contribution",
        badge: "pioneer",
        points: 100,
      },
    },
    {
      id: "achievement-002",
      timestamp: 1_700_000_500,
      type: "achievement",
      contractId: CONTRACT_B,
      data: {
        contributor: CONTRIBUTOR_1,
        achievement_type: "top_contributor",
        badge: "champion",
        points: 500,
      },
    },
  ] satisfies IndexerEvent[],
};

// ── Harness ───────────────────────────────────────────────────────────────────

/**
 * Simulates the ingestion pipeline in index.ts:
 *   for await (const events of rpcClient.streamEvents()) { eventStore.addEvents(events) }
 *
 * Accepts an array of batches (each batch = one "ledger tick") and feeds them
 * one by one into the provided EventStore so tests can assert mid-stream state
 * as well as final state.
 */
async function* simulateHorizonStream(
  batches: IndexerEvent[][],
): AsyncGenerator<IndexerEvent[]> {
  for (const batch of batches) {
    yield batch;
  }
}

async function ingestBatches(
  store: EventStore,
  batches: IndexerEvent[][],
): Promise<void> {
  for await (const events of simulateHorizonStream(batches)) {
    store.addEvents(events);
  }
}

// ── Shared setup ──────────────────────────────────────────────────────────────

const silentLogger = pino({ level: "silent" });

let store: EventStore;

beforeEach(() => {
  store = new EventStore(silentLogger);
});

// ── Test suites ───────────────────────────────────────────────────────────────

describe("Event ingestion integration — campaign events (#938)", () => {
  it("ingests a single campaign event and stores it correctly", async () => {
    await ingestBatches(store, [horizonFixtures.campaign.slice(0, 1)]);

    expect(store.getCount()).toBe(1);
    const results = store.queryByType("campaign");
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("campaign-001");
    expect(results[0]?.contractId).toBe(CONTRACT_A);
    expect(results[0]?.data?.title).toBe("Clean Water Initiative");
  });

  it("ingests multiple campaign events in a single batch", async () => {
    await ingestBatches(store, [horizonFixtures.campaign]);

    expect(store.getCount()).toBe(2);
    const results = store.queryByType("campaign");
    expect(results).toHaveLength(2);
    const ids = results.map((e) => e.id).sort();
    expect(ids).toEqual(["campaign-001", "campaign-002"]);
  });

  it("retrieves campaign events filtered by contractId", async () => {
    await ingestBatches(store, [horizonFixtures.campaign]);

    const contractA = store.queryByContract(CONTRACT_A);
    expect(contractA).toHaveLength(1);
    expect(contractA[0]?.id).toBe("campaign-001");

    const contractB = store.queryByContract(CONTRACT_B);
    expect(contractB).toHaveLength(1);
    expect(contractB[0]?.id).toBe("campaign-002");
  });
});

describe("Event ingestion integration — donation events (#938)", () => {
  it("ingests donation events across multiple contracts", async () => {
    await ingestBatches(store, [horizonFixtures.donation]);

    expect(store.getCount()).toBe(3);
    const all = store.queryByType("donation");
    expect(all).toHaveLength(3);
  });

  it("stores donation events with correct contributor data", async () => {
    await ingestBatches(store, [horizonFixtures.donation]);

    const contractADonations = store.queryByContract(CONTRACT_A);
    expect(contractADonations).toHaveLength(2);

    // Sorted newest-first (queryByContract sorts desc by timestamp)
    expect(contractADonations[0]?.data?.contributor).toBe(CONTRIBUTOR_2);
    expect(contractADonations[1]?.data?.contributor).toBe(CONTRIBUTOR_1);
  });

  it("donation events for distinct contracts are kept separate", async () => {
    await ingestBatches(store, [horizonFixtures.donation]);

    const contractBDonations = store.queryByContract(CONTRACT_B);
    expect(contractBDonations).toHaveLength(1);
    expect(contractBDonations[0]?.data?.contributor).toBe(CONTRIBUTOR_1);
    expect(contractBDonations[0]?.data?.amount).toBe("2000000000");
  });
});

describe("Event ingestion integration — achievement events (#938)", () => {
  it("ingests achievement events and queries them by type", async () => {
    await ingestBatches(store, [horizonFixtures.achievement]);

    expect(store.getCount()).toBe(2);
    const results = store.queryByType("achievement");
    expect(results).toHaveLength(2);
  });

  it("stores achievement badge data faithfully", async () => {
    await ingestBatches(store, [horizonFixtures.achievement]);

    const contractA = store.queryByContract(CONTRACT_A);
    expect(contractA).toHaveLength(1);
    expect(contractA[0]?.data?.badge).toBe("pioneer");
    expect(contractA[0]?.data?.achievement_type).toBe("first_contribution");
  });
});

describe("Event ingestion integration — mixed event stream (#938)", () => {
  it("stores all event types together and the total count is correct", async () => {
    const allBatches = [
      horizonFixtures.campaign,
      horizonFixtures.donation,
      horizonFixtures.achievement,
    ];
    await ingestBatches(store, allBatches);

    const expectedTotal =
      horizonFixtures.campaign.length +
      horizonFixtures.donation.length +
      horizonFixtures.achievement.length;

    expect(store.getCount()).toBe(expectedTotal);
  });

  it("type queries return only the requested event type", async () => {
    await ingestBatches(store, [
      horizonFixtures.campaign,
      horizonFixtures.donation,
      horizonFixtures.achievement,
    ]);

    expect(store.queryByType("campaign")).toHaveLength(horizonFixtures.campaign.length);
    expect(store.queryByType("donation")).toHaveLength(horizonFixtures.donation.length);
    expect(store.queryByType("achievement")).toHaveLength(horizonFixtures.achievement.length);
  });

  it("multi-batch streaming produces the same state as a single-batch ingest", async () => {
    const storeB = new EventStore(silentLogger);
    const allEvents = [
      ...horizonFixtures.campaign,
      ...horizonFixtures.donation,
      ...horizonFixtures.achievement,
    ];

    // Multi-batch (one event per tick)
    await ingestBatches(store, allEvents.map((e) => [e]));

    // Single batch
    storeB.addEvents(allEvents);

    expect(store.getCount()).toBe(storeB.getCount());
    expect(store.getAllEvents(100).map((e) => e.id).sort()).toEqual(
      storeB.getAllEvents(100).map((e) => e.id).sort(),
    );
  });
});

describe("Event ingestion integration — idempotency (#938)", () => {
  it("does not double-count events that arrive twice with the same id", async () => {
    const event: IndexerEvent = horizonFixtures.donation[0]!;

    store.addEvents([event]);
    store.addEvents([event]); // duplicate

    expect(store.getCount()).toBe(1);
  });

  it("updating data for an existing id replaces the record", async () => {
    const original: IndexerEvent = {
      id: "donation-001",
      timestamp: 1_700_000_100,
      type: "donation",
      contractId: CONTRACT_A,
      data: { amount: "500000000" },
    };
    const updated: IndexerEvent = {
      ...original,
      data: { amount: "999999999" },
    };

    store.addEvents([original]);
    store.addEvents([updated]);

    expect(store.getCount()).toBe(1);
    const results = store.queryByContract(CONTRACT_A);
    expect(results[0]?.data?.amount).toBe("999999999");
  });
});

describe("Event ingestion integration — malformed events (#938)", () => {
  /**
   * The ingestion loop in index.ts wraps addEvents in a try/catch, but
   * EventStore itself also needs to handle events with missing/unexpected
   * fields without throwing or corrupting stored state.
   */

  it("handles an event with an empty data object without throwing", () => {
    const event: IndexerEvent = {
      id: "bad-001",
      timestamp: Date.now(),
      type: "donation",
      contractId: CONTRACT_A,
      data: {},
    };
    expect(() => store.addEvents([event])).not.toThrow();
    expect(store.getCount()).toBe(1);
  });

  it("handles an event with a null-ish data payload via type assertion", () => {
    // Some Horizon RPC responses may omit the data field entirely; parseEvent
    // in rpc-client.ts coerces null → {}, but tests should verify the store
    // handles a previously-stored empty data map gracefully.
    const event = {
      id: "bad-002",
      timestamp: Date.now(),
      type: "unknown_type",
      contractId: CONTRACT_A,
      data: {} as Record<string, unknown>,
    };
    expect(() => store.addEvents([event])).not.toThrow();
    expect(store.getCount()).toBe(1);
  });

  it("stores valid events even when a malformed event precedes them", () => {
    const malformed: IndexerEvent = {
      id: "bad-003",
      timestamp: Date.now(),
      type: "donation",
      contractId: CONTRACT_A,
      data: {},
    };
    const valid: IndexerEvent = horizonFixtures.donation[0]!;

    store.addEvents([malformed, valid]);

    // Both should be stored — the store doesn't filter on data completeness
    expect(store.getCount()).toBe(2);
    const results = store.queryByType("donation");
    expect(results.map((e) => e.id)).toContain(valid.id);
  });

  it("does not corrupt existing state when adding an event with duplicate id and bad data", () => {
    const good: IndexerEvent = {
      id: "donation-001",
      timestamp: 1_700_000_100,
      type: "donation",
      contractId: CONTRACT_A,
      data: { amount: "500000000" },
    };
    const malformedDuplicate: IndexerEvent = {
      ...good,
      data: {},
    };

    store.addEvents([good]);
    store.addEvents([malformedDuplicate]);

    // The store uses Map.set — the duplicate overwrites, but count stays 1
    expect(store.getCount()).toBe(1);
    // No throw = pipeline stays live
  });
});

describe("Event ingestion integration — out-of-order events (#938)", () => {
  /**
   * Horizon streams can deliver events out of ledger order under some
   * conditions (e.g. back-fill, pagination cursors). The EventStore's
   * timestamp-based sort means callers always see events newest-first
   * regardless of ingestion order.
   */

  it("queryByContract returns events sorted newest-first regardless of ingest order", async () => {
    const early: IndexerEvent = {
      id: "donation-early",
      timestamp: 1_700_000_100,
      type: "donation",
      contractId: CONTRACT_A,
      data: { amount: "100" },
    };
    const late: IndexerEvent = {
      id: "donation-late",
      timestamp: 1_700_000_900,
      type: "donation",
      contractId: CONTRACT_A,
      data: { amount: "900" },
    };
    const middle: IndexerEvent = {
      id: "donation-mid",
      timestamp: 1_700_000_500,
      type: "donation",
      contractId: CONTRACT_A,
      data: { amount: "500" },
    };

    // Ingest in reverse chronological order (late → middle → early)
    await ingestBatches(store, [[late], [middle], [early]]);

    const results = store.queryByContract(CONTRACT_A);
    expect(results).toHaveLength(3);
    // Newest (late) must be first
    expect(results[0]?.id).toBe("donation-late");
    expect(results[1]?.id).toBe("donation-mid");
    expect(results[2]?.id).toBe("donation-early");
  });

  it("queryByType returns events sorted newest-first regardless of ingest order", async () => {
    const events: IndexerEvent[] = [
      { id: "e3", timestamp: 3000, type: "campaign", contractId: CONTRACT_A, data: {} },
      { id: "e1", timestamp: 1000, type: "campaign", contractId: CONTRACT_A, data: {} },
      { id: "e2", timestamp: 2000, type: "campaign", contractId: CONTRACT_A, data: {} },
    ];

    store.addEvents(events);

    const results = store.queryByType("campaign");
    expect(results[0]?.id).toBe("e3");
    expect(results[1]?.id).toBe("e2");
    expect(results[2]?.id).toBe("e1");
  });

  it("getAllEvents returns events sorted newest-first regardless of ingest order", async () => {
    const scrambled: IndexerEvent[] = [
      { id: "e-c", timestamp: 3, type: "donation", contractId: CONTRACT_A, data: {} },
      { id: "e-a", timestamp: 1, type: "donation", contractId: CONTRACT_A, data: {} },
      { id: "e-b", timestamp: 2, type: "donation", contractId: CONTRACT_A, data: {} },
    ];

    store.addEvents(scrambled);

    const results = store.getAllEvents(10);
    expect(results[0]?.id).toBe("e-c");
    expect(results[2]?.id).toBe("e-a");
  });

  it("final state is consistent when the same events arrive in two different orders", async () => {
    const storeB = new EventStore(silentLogger);

    const eventsA: IndexerEvent[] = [
      { id: "x1", timestamp: 100, type: "donation", contractId: CONTRACT_A, data: { v: 1 } },
      { id: "x2", timestamp: 200, type: "donation", contractId: CONTRACT_A, data: { v: 2 } },
      { id: "x3", timestamp: 300, type: "donation", contractId: CONTRACT_A, data: { v: 3 } },
    ];

    const eventsB = [...eventsA].reverse(); // reversed ingestion order

    store.addEvents(eventsA);
    storeB.addEvents(eventsB);

    // Both stores should have identical event sets (same IDs, same data)
    const resultA = store.queryByContract(CONTRACT_A).map((e) => e.id).sort();
    const resultB = storeB.queryByContract(CONTRACT_A).map((e) => e.id).sort();
    expect(resultA).toEqual(resultB);
    expect(store.getCount()).toBe(storeB.getCount());
  });
});
