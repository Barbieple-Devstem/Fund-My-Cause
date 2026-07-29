import pino from "pino";
import type { IndexerEvent } from "./rpc-client.js";

// Re-export so tests can import IndexerEvent from "./event-store" consistently
export type { IndexerEvent };

/**
 * In-memory event store (for MVP - replace with database)
 */
export class EventStore {
  private events: Map<string, IndexerEvent> = new Map();
  private logger: pino.Logger;
  private maxSize: number;
  private readonly maxCapacity: number | undefined;

  /**
   * @param logger  - pino logger instance
   * @param maxSize - legacy hard cap (default 10,000); used when maxCapacity is not set
   * @param maxCapacity - optional capacity bound from StoreConfig (#902).
   *   When provided, this takes precedence over maxSize and acts as the
   *   pool-size equivalent: bounds total RAM usage by evicting oldest events
   *   once the store exceeds this limit.
   */
  constructor(logger: pino.Logger, maxSize: number = 10000, maxCapacity?: number) {
    this.logger = logger;
    // maxCapacity (from StoreConfig) takes precedence when explicitly supplied.
    this.maxCapacity = maxCapacity;
    this.maxSize = maxCapacity ?? maxSize;
  }

  /**
   * Add events to the store.
   * When the store exceeds maxCapacity (or maxSize), the oldest event by
   * timestamp is evicted to keep memory bounded.
   */
  addEvents(events: IndexerEvent[]): void {
    for (const event of events) {
      this.events.set(event.id, event);

      // Simple LRU: remove oldest events if over capacity
      if (this.events.size > this.maxSize) {
        const oldest = Array.from(this.events.entries()).sort(
          (a, b) => a[1].timestamp - b[1].timestamp
        )[0];
        if (oldest) {
          this.events.delete(oldest[0]);
        }
      }
    }

    this.logger.debug({ count: events.length, total: this.events.size }, "Events stored");
  }

  /**
   * Query events by contract ID
   */
  queryByContract(contractId: string, limit: number = 100): IndexerEvent[] {
    return Array.from(this.events.values())
      .filter((e) => e.contractId === contractId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Query events by type
   */
  queryByType(type: string, limit: number = 100): IndexerEvent[] {
    return Array.from(this.events.values())
      .filter((e) => e.type === type)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get all events
   */
  getAllEvents(limit: number = 100): IndexerEvent[] {
    return Array.from(this.events.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get event count
   */
  getCount(): number {
    return this.events.size;
  }

  /**
   * Get the effective capacity limit (maxSize in use).
   * Useful for exposing in /stats or health endpoints.
   */
  getCapacity(): number {
    return this.maxSize;
  }

  /**
   * Get configuration snapshot for this store instance.
   * Exposes maxCapacity so callers can distinguish between a capacity set
   * explicitly via StoreConfig and the legacy maxSize default.
   */
  getConfig(): { maxCapacity: number | undefined } {
    return { maxCapacity: this.maxCapacity };
  }

  /**
   * Clear all events (for testing)
   */
  clear(): void {
    this.events.clear();
  }
}
