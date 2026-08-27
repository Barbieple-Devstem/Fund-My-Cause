import type pino from "pino";
import type { IndexerEvent } from "../../rpc-client.js";
import type { EventRepository } from "../../repository.js";
import type { EventHandler } from "../types.js";

/**
 * Handles campaign-registration events emitted by the registry contract.
 *
 * The registry contract (`contracts/registry`) emits a `("registry",
 * "registered")` event from its `register`, `register_with_category`, and
 * `register_with_status` entry points whenever a campaign is added to the
 * global registry. The event carries the registered campaign's contract
 * address and the registry's schema version.
 *
 * Part of the `registry` contract-type module (#1125) — see
 * `services/indexer/src/handlers/index.ts` for the full module layout.
 */
export class RegisteredHandler implements EventHandler {
  readonly eventType = "registered";
  readonly contractType = "registry" as const;

  private readonly logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger;
  }

  /**
   * Persist a batch of registry "registered" events and log domain-specific
   * diagnostics.
   *
   * @param events     Batch of events whose type is 'registered'.
   * @param repository Repository instance to store events into.
   */
  handle(events: IndexerEvent[], repository: EventRepository): void {
    repository.addEvents(events);

    for (const event of events) {
      this.logger.info(
        {
          eventId: event.id,
          contractId: event.contractId,
          campaignId: event.data["campaign_id"],
          schemaVersion: event.data["schema_version"],
        },
        "RegisteredHandler: campaign registration event ingested",
      );
    }

    this.logger.debug(
      { count: events.length },
      "RegisteredHandler: batch stored",
    );
  }
}
