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

  constructor(logger: pino.Logger, maxSize: number = 10000) {
    this.logger = logger;
    this.maxSize = maxSize;
  }

  /**
   * Add events to the store
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
   * Clear all events (for testing)
   */
  clear(): void {
    this.events.clear();
  }
}
