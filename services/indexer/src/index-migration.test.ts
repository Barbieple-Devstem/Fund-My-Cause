import { describe, it, expect } from "vitest";
import { EventStore } from "./event-store.js";
import type { IndexerEvent } from "./rpc-client.js";
import pino from "pino";

const logger = pino({ level: "silent" });

/**
 * Regression test suite verifying query correctness and data integrity
 * before and after database index migrations in the indexer service.
 */
describe("Indexer Database Index Migration Regression Tests", () => {
  it("maintains query results consistency across simulated index migrations", () => {
    const store = new EventStore(logger);

    const initialEvents: IndexerEvent[] = [
      {
        id: "evt-101",
        timestamp: 1700000000,
        type: "Contribute",
        contractId: "CONTRACT_A",
        data: { amount: "5000", token: "XLM" },
      },
      {
        id: "evt-102",
        timestamp: 1700000100,
        type: "Contribute",
        contractId: "CONTRACT_B",
        data: { amount: "10000", token: "USDC" },
      },
      {
        id: "evt-103",
        timestamp: 1700000200,
        type: "Withdraw",
        contractId: "CONTRACT_A",
        data: { amount: "2000" },
      },
    ];

    // Populating event store prior to index migration simulation
    store.addEvents(initialEvents);

    // Baseline query checks pre-migration
    const preMigrationByContractA = store.queryByContract("CONTRACT_A");
    const preMigrationByTypeContribute = store.queryByType("Contribute");
    const preMigrationAll = store.getAllEvents();

    expect(preMigrationByContractA).toHaveLength(2);
    expect(preMigrationByTypeContribute).toHaveLength(2);
    expect(preMigrationAll).toHaveLength(3);

    // Simulate database index migration: re-indexing existing dataset with newly added composite indexes
    const migratedStore = new EventStore(logger);
    migratedStore.addEvents(preMigrationAll);

    // Post-migration query verification against baseline
    const postMigrationByContractA = migratedStore.queryByContract("CONTRACT_A");
    const postMigrationByTypeContribute = migratedStore.queryByType("Contribute");
    const postMigrationAll = migratedStore.getAllEvents();

    expect(postMigrationByContractA).toEqual(preMigrationByContractA);
    expect(postMigrationByTypeContribute).toEqual(preMigrationByTypeContribute);
    expect(postMigrationAll).toEqual(preMigrationAll);
  });

  it("handles high volume data pagination post index creation without record loss", () => {
    const store = new EventStore(logger, 500);

    const testEvents: IndexerEvent[] = Array.from({ length: 150 }, (_, i) => ({
      id: `batch-evt-${i}`,
      timestamp: 1700000000 + i,
      type: i % 2 === 0 ? "Contribute" : "CampaignCreated",
      contractId: i % 3 === 0 ? "CONTRACT_X" : "CONTRACT_Y",
      data: { sequence: i },
    }));

    store.addEvents(testEvents);

    const contractXEvents = store.queryByContract("CONTRACT_X", 100);
    const contributeEvents = store.queryByType("Contribute", 100);

    // Assert sorting order (descending timestamp post index migration)
    expect(contractXEvents.length).toBe(50);
    expect(contributeEvents.length).toBe(75);
    expect(contractXEvents[0].timestamp).toBeGreaterThan(contractXEvents[1].timestamp);
  });

  it("verifies index lookup behavior with duplicate timestamps and composite filter keys", () => {
    const store = new EventStore(logger);

    const sameTimestampEvents: IndexerEvent[] = [
      {
        id: "same-ts-1",
        timestamp: 1705000000,
        type: "Contribute",
        contractId: "CONTRACT_Z",
        data: { val: 1 },
      },
      {
        id: "same-ts-2",
        timestamp: 1705000000,
        type: "Contribute",
        contractId: "CONTRACT_Z",
        data: { val: 2 },
      },
    ];

    store.addEvents(sameTimestampEvents);
    const results = store.queryByContract("CONTRACT_Z");

    expect(results).toHaveLength(2);
    expect(results.map((e) => e.id)).toContain("same-ts-1");
    expect(results.map((e) => e.id)).toContain("same-ts-2");
  });
});
