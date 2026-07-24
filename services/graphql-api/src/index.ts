import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { createRedisClient } from "./redis.js";
import { CacheService } from "./services/cache.js";
import { ContractService } from "./services/contract.js";
import { createDataLoaders } from "./services/dataloader.js";
import { getPubSub } from "./services/pubsub.js";
import { AuthService } from "./services/auth.js";
import { RateLimiterService } from "./services/rate-limiter.js";
import { typeDefs } from "./schema.js";
import { resolvers } from "./resolvers.js";
import type { Context } from "./types.js";

const PORT = process.env.GRAPHQL_PORT ? parseInt(process.env.GRAPHQL_PORT) : 4000;
const NODE_ENV = process.env.NODE_ENV || "development";
const RPC_URL = process.env.RPC_URL || "https://soroban-testnet.stellar.org";
const CONTRACT_NETWORK = process.env.CONTRACT_NETWORK || "testnet";
const REGISTRY_CONTRACT_ID = process.env.REGISTRY_CONTRACT_ID || "";
const JWT_SECRET = process.env.JWT_SECRET;

// Validate JWT_SECRET at startup
if (!JWT_SECRET || JWT_SECRET.trim() === "") {
  console.error("FATAL: JWT_SECRET environment variable is required and must not be empty");
  process.exit(1);
}

const knownDefaults = [
  "your-secret-key",
  "your-secret-key-change-in-production",
  "dev-secret-key-change-in-production",
];

// Check for known defaults before length check
if (knownDefaults.includes(JWT_SECRET)) {
  console.error("FATAL: JWT_SECRET appears to be a default/example value and must be changed");
  process.exit(1);
}

if (JWT_SECRET.length < 32) {
  console.error("FATAL: JWT_SECRET must be at least 32 characters for secure operation");
  process.exit(1);
}

/**
 * Initialize and start the GraphQL server
 */
async function startServer() {
  try {
    console.log(`🚀 Starting GraphQL API Server...`);
    console.log(`   Environment: ${NODE_ENV}`);
    console.log(`   Port: ${PORT}`);

    // Initialize Redis connection
    const redis = await createRedisClient();
    console.log("✅ Redis connection established");

    // Initialize services
    const cacheService = new CacheService(redis);
    const contractService = new ContractService({
      rpcUrl: RPC_URL,
      networkPassphrase:
        CONTRACT_NETWORK === "mainnet"
          ? "Public Global Stellar Network ; September 2015"
          : "Test SDF Network ; September 2015",
      registryContractId: REGISTRY_CONTRACT_ID || undefined,
    });
    const dataLoaders = createDataLoaders(contractService);
    const pubsub = getPubSub();
    const authService = new AuthService(JWT_SECRET);
    const rateLimiter = new RateLimiterService(redis);

    console.log("✅ Services initialized");

    // Create Express app
    const app = express();
    const httpServer = createServer(app);

    // CORS configuration
    const corsOptions = {
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : ["http://localhost:3000", "http://localhost:5173"],
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    };

    app.use(cors(corsOptions));
    app.use(express.json({ limit: "10mb" }));

    // Health check endpoint
    app.get("/health", (req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Status endpoint — aggregates component health
    app.get("/status", async (req, res) => {
      const start = Date.now();

      // Check Redis/cache
      let cacheStatus: "healthy" | "degraded" | "unhealthy" = "unhealthy";
      let cacheLatencyMs = -1;
      try {
        const t0 = Date.now();
        await redis.ping();
        cacheLatencyMs = Date.now() - t0;
        cacheStatus = cacheLatencyMs < 200 ? "healthy" : "degraded";
      } catch {
        cacheStatus = "unhealthy";
      }

      // Check RPC connectivity
      let rpcStatus: "healthy" | "degraded" | "unhealthy" = "unhealthy";
      let rpcLatencyMs = -1;
      try {
        const t0 = Date.now();
        const resp = await fetch(RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth", params: [] }),
          signal: AbortSignal.timeout(3000),
        });
        rpcLatencyMs = Date.now() - t0;
        rpcStatus = resp.ok ? (rpcLatencyMs < 500 ? "healthy" : "degraded") : "unhealthy";
      } catch {
        rpcStatus = "unhealthy";
      }

      const apiStatus = "healthy";
      const overallStatus =
        cacheStatus === "unhealthy" || rpcStatus === "unhealthy"
          ? "degraded"
          : "healthy";

      const body = {
        status: overallStatus,
        version: process.env.npm_package_version ?? "unknown",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        components: {
          api:   { status: apiStatus,   latencyMs: Date.now() - start },
          cache: { status: cacheStatus, latencyMs: cacheLatencyMs },
          rpc:   { status: rpcStatus,   latencyMs: rpcLatencyMs },
        },
      };

      const httpStatus = overallStatus === "healthy" ? 200 : 207;
      res.status(httpStatus).json(body);
    });

    // Metrics endpoint
    app.get("/metrics", async (req, res) => {
      try {
        const cacheStats = await cacheService.getStats();
        res.json({
          cache: cacheStats,
          uptime: process.uptime(),
          environment: NODE_ENV,
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to get metrics" });
      }
    });

    // Build the executable schema once so it can be shared between Apollo
    // Server (HTTP) and graphql-ws (subscriptions over WebSocket).
    const schema = makeExecutableSchema<Context>({ typeDefs, resolvers });

    // Create Apollo Server
    const apolloServer = new ApolloServer<Context>({
      schema,
      introspection: NODE_ENV !== "production",
      plugins: [
        {
          async serverWillStart() {
            console.log("✅ Apollo Server starting");
            return {
              async drainServer() {
                await pubsub.close();
              },
            };
          },
        },
      ],
    });

    await apolloServer.start();
    console.log("✅ Apollo Server started");

    // Setup WebSocket server for subscriptions
    const wsServer = new WebSocketServer({ server: httpServer, path: "/graphql" });

    useServer({ schema }, wsServer);
    console.log("✅ WebSocket server configured");

    // Apply Apollo middleware
    app.post("/graphql", expressMiddleware(apolloServer, {
      context: async ({ req, res }) => {
        try {
          // Rate limiting
          const ip = req.ip || "unknown";
          await rateLimiter.checkIpLimit(ip);

          // Extract and verify JWT token
          let user: any = undefined;
          const authHeader = req.headers.authorization;
          if (authHeader) {
            const token = authService.extractTokenFromHeader(authHeader);
            if (token) {
              const decoded = authService.verifyToken(token);
              if (decoded) {
                // Check user rate limit
                await rateLimiter.checkUserLimit(decoded.address);
                user = {
                  address: decoded.address,
                  isAuthenticated: true,
                };
              }
            }
          }

          return {
            cache: cacheService,
            contractService,
            dataLoader: dataLoaders,
            pubsub,
            authService,
            user,
            redis,
          } as Context;
        } catch (error: any) {
          console.error("Context error:", error);
          if (error.retryAfter) {
            res.set("Retry-After", error.retryAfter.toString());
          }
          throw error;
        }
      },
    }));

    // Error handling middleware
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error("Request error:", err);

      if (err.message?.includes("rate limit")) {
        return res.status(429).json({
          error: err.message,
          retryAfter: err.retryAfter || 60,
        });
      }

      res.status(500).json({
        error: NODE_ENV === "production" ? "Internal server error" : err.message,
      });
    });

    // Start server
    await new Promise<void>((resolve, reject) => {
      httpServer.listen(PORT, "0.0.0.0", () => {
        console.log(`\n🎉 GraphQL API Server is running!`);
        console.log(`📝 GraphQL Endpoint: http://localhost:${PORT}/graphql`);
        console.log(`🔔 WebSocket Subscriptions: ws://localhost:${PORT}/graphql`);
        console.log(`💚 Health Check: http://localhost:${PORT}/health`);
        console.log(`📊 Metrics: http://localhost:${PORT}/metrics\n`);
        resolve();
      }).on("error", reject);
    });

    // Graceful shutdown
    const signals = ["SIGTERM", "SIGINT"];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
        await apolloServer.stop();
        await pubsub.close();
        httpServer.close(() => {
          console.log("✅ Server closed");
          process.exit(0);
        });
      });
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
