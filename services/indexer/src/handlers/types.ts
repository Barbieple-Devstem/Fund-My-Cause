import type { IndexerEvent } from "../rpc-client.js";
import type { EventRepository } from "../repository.js";

/**
 * Shared interface for domain-specific event handlers.
 *
 * Each handler is responsible for a single event type (e.g. 'campaign',
 * 'donation', 'achievement').  The EventDispatcher groups incoming events by
 * type and routes each group to the matching handler via this interface.
 *
 * Implementing a new domain handler:
 *  1. Create a class that implements EventHandler.
 *  2. Set `eventType` to the string that appears in IndexerEvent.type.
 *  3. Export the class from handlers/index.ts.
 *  4. Register it in the EventDispatcher instantiation in index.ts.
 */
export interface EventHandler {
  /** The event type this handler processes (e.g. 'campaign', 'donation', 'achievement') */
  readonly eventType: string;
  /** Handle a batch of events of this handler's type */
  handle(events: IndexerEvent[], repository: EventRepository): void;
}
