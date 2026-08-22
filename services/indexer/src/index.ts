import "dotenv/config";
import express, { Express } from "express";
import pino from "pino";
import { SorobanRPCClient } from "./rpc-client.js";
import { HealthChecker } from "./health-checker.js";
import { EventStore } from "./event-store.js";
import { EventStoreRepository } from "./repository-impl.js";
import { runMigrations } from "./migrations/run-migrations.js";
import {
  CampaignHandler,
  DonationHandler,
  AchievementHandler,
  EventDispatcher,
} from "./handlers/index.js";
import type { EventRepository } from "./repository.js";
import { loadStoreConfig } from "./store-config.js";

// Environment variables
const PORT = parseInt(process.env.PORT ?? "3001", 10);
const RPC_URL =
  process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org:443";
const CONTRACT_ID = process.env.CROWDFUND_CONTRACT_ID ?? "";
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

// Resolve store / RPC capacity configuration from environment (#902)
const storeConfig = loadStoreConfig();

// Logger
const logger = pino({ level: LOG_LEVEL });

// Express app
const app: Express = express();

// Global state
const rpcClient = new SorobanRPCClient(
  { url: RPC_URL, contractId: CONTRACT_ID },
  logger,
);
const healthChecker = new HealthChecker(logger);

// Build the repository once at startup.  All handlers interact with
// `eventRepository` (the interface) rather than `eventStore` directly,
// so the storage layer can be replaced without touching handler code.
const eventStore = new EventStore(logger, 10000, storeConfig.maxEventCapacity);
const eventRepository: EventRepository = new EventStoreRepository(
  eventStore,
  logger,
);

let isRunning = false;

/**
 * Start the indexer service
 */
async function startIndexer(): Promise<void> {
  logger.info(
    { rpc: RPC_URL, contract: CONTRACT_ID },
    "Starting indexer service",
  );
  logger.info({ storeConfig }, "Effective store configuration");

  // Connect to RPC
  const connected = await rpcClient.connect();
  if (!connected) {
    logger.error("Failed to connect to Soroban RPC. Retrying in 10 seconds...");
    setTimeout(startIndexer, 10000);
    return;
  }

  isRunning = true;

  // Stream events
  logger.info("Streaming events from Soroban RPC");
  for await (const events of rpcClient.streamEvents()) {
    try {
      // Route events to domain handlers via the dispatcher (#896).
      // Each handler stores events and emits domain-specific log lines.
      // Unknown event types fall back to the repository directly.
      dispatcher.dispatch(events);

      // Update health
      for (const event of events) {
        healthChecker.recordEvent(parseInt(event.id.split("-")[0] ?? "0", 10));
      }

      // Log batch
      logger.debug({ eventCount: events.length }, "Ingested events");
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Error processing events",
      );
    }
  }
}

/**
 * Routes
 */

// Health endpoint (liveness)
app.get("/health", (req, res) => {
  const status = healthChecker.getStatus();
  const statusCode =
    status.status === "healthy"
      ? 200
      : status.status === "degraded"
        ? 202
        : 503;
  res.status(statusCode).json(status);
});

// Kubernetes-style liveness probe — alias of /health.
// Returns 200 as long as the process is up and responding.
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Readiness endpoint — checks actual downstream dependency (Soroban RPC).
// Returns 200 only when the indexer has successfully connected to the RPC
// and is actively ingesting events; 503 otherwise.
app.get("/readyz", async (req, res) => {
  const rpcReachable = rpcClient.isConnected();
  if (isRunning && rpcReachable) {
    res.status(200).json({
      ready: true,
      checks: { rpc: "ok", indexer: "running" },
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      ready: false,
      checks: {
        rpc: rpcReachable ? "ok" : "unreachable",
        indexer: isRunning ? "running" : "not_started",
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Readiness endpoint (original — kept for backwards compatibility)
app.get("/ready", (req, res) => {
  if (isRunning) {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({ ready: false });
  }
});

// Events query endpoint — uses EventRepository interface
app.get("/events", (req, res) => {
  const { contractId, type, limit = "100" } = req.query;
  const limitNum = Math.min(parseInt(limit as string, 10) || 100, 1000);

  let events = [];
  if (contractId) {
    events = eventRepository.queryByContract(contractId as string, limitNum);
  } else if (type) {
    events = eventRepository.queryByType(type as string, limitNum);
  } else {
    events = eventRepository.getAllEvents(limitNum);
  }

  res.json({ count: events.length, events });
});

// Stats endpoint — uses EventRepository interface
app.get("/stats", (req, res) => {
  const health = healthChecker.getStatus();
  res.json({
    eventCount: eventRepository.getCount(),
    health: health.status,
    uptime: health.uptime,
    lastLedger: health.lastLedger,
    eventsProcessed: health.eventsProcessed,
    // Circuit breaker metrics — expose for observability (Issue #906)
    circuitBreaker: rpcClient.getCircuitBreakerMetrics(),
  });
});

/**
 * Start server
 */
app.listen(PORT, async () => {
  logger.info({ port: PORT }, "Indexer service listening");

  // Start indexing in background
  startIndexer().catch((error) => {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Indexer crashed",
    );
    process.exit(1);
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("Received SIGINT, shutting down gracefully");
  process.exit(0);
});
