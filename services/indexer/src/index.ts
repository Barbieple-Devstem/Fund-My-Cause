import "dotenv/config";
import express, { Express } from "express";
import pino from "pino";
import { SorobanRPCClient } from "./rpc-client.js";
import { HealthChecker } from "./health-checker.js";
import { EventStore } from "./event-store.js";

// Environment variables
const PORT = parseInt(process.env.PORT ?? "3001", 10);
const RPC_URL = process.env.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org:443";
const CONTRACT_ID = process.env.CROWDFUND_CONTRACT_ID ?? "";
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

// Logger
const logger = pino({ level: LOG_LEVEL });

// Express app
const app: Express = express();

// Global state
const rpcClient = new SorobanRPCClient(
  { url: RPC_URL, contractId: CONTRACT_ID },
  logger
);
const healthChecker = new HealthChecker(logger);
const eventStore = new EventStore(logger);

let isRunning = false;

/**
 * Start the indexer service
 */
async function startIndexer(): Promise<void> {
  logger.info({ rpc: RPC_URL, contract: CONTRACT_ID }, "Starting indexer service");

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
      // Store events
      eventStore.addEvents(events);

      // Update health
      for (const event of events) {
        healthChecker.recordEvent(parseInt(event.id.split("-")[0] ?? "0", 10));
      }

      // Log batch
      logger.debug({ eventCount: events.length }, "Ingested events");
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        "Error processing events"
      );
    }
  }
}

/**
 * Routes
 */

// Health endpoint
app.get("/health", (req, res) => {
  const status = healthChecker.getStatus();
  const statusCode = status.status === "healthy" ? 200 : status.status === "degraded" ? 202 : 503;
  res.status(statusCode).json(status);
});

// Readiness endpoint
app.get("/ready", (req, res) => {
  if (isRunning) {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({ ready: false });
  }
});

// Events query endpoint
app.get("/events", (req, res) => {
  const { contractId, type, limit = "100" } = req.query;
  const limitNum = Math.min(parseInt(limit as string, 10) || 100, 1000);

  let events = [];
  if (contractId) {
    events = eventStore.queryByContract(contractId as string, limitNum);
  } else if (type) {
    events = eventStore.queryByType(type as string, limitNum);
  } else {
    events = eventStore.getAllEvents(limitNum);
  }

  res.json({ count: events.length, events });
});

// Stats endpoint
app.get("/stats", (req, res) => {
  const health = healthChecker.getStatus();
  res.json({
    eventCount: eventStore.getCount(),
    health: health.status,
    uptime: health.uptime,
    lastLedger: health.lastLedger,
    eventsProcessed: health.eventsProcessed,
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
      "Indexer crashed"
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
