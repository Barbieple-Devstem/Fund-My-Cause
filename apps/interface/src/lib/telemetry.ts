import {
  NodeSDK,
  context,
  trace,
  metrics,
  SpanStatusCode,
} from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { logger } from "@/lib/logger";

const telemetryLogger = logger.child("telemetry");

// Global tracer and meter
let globalTracer: trace.Tracer | null = null;
let globalMeter: metrics.Meter | null = null;

interface TelemetryConfig {
  serviceName: string;
  environment: string;
  version: string;
  otlpEndpoint: string;
  samplingRate: number;
}

const defaultConfig: TelemetryConfig = {
  serviceName: "fund-my-cause-interface",
  environment: process.env.NODE_ENV || "development",
  version: process.env.APP_VERSION || "1.0.0",
  otlpEndpoint:
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318",
  samplingRate: parseFloat(process.env.OTEL_SAMPLER_PROBABILITY || "0.1"),
};

/**
 * Initialize OpenTelemetry SDK
 * Must be called at application startup (before other imports)
 */
export function initTelemetry(config: Partial<TelemetryConfig> = {}): void {
  const finalConfig = { ...defaultConfig, ...config };

  const resource = Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: finalConfig.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: finalConfig.version,
      environment: finalConfig.environment,
      region: process.env.AWS_REGION || "unknown",
      platform: process.env.VERCEL_ENV || "unknown",
    }),
  );

  const traceExporter = new OTLPTraceExporter({
    url: `${finalConfig.otlpEndpoint}/v1/traces`,
    headers: {
      Authorization: `Bearer ${process.env.OTEL_AUTH_TOKEN || ""}`,
    },
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${finalConfig.otlpEndpoint}/v1/metrics`,
    headers: {
      Authorization: `Bearer ${process.env.OTEL_AUTH_TOKEN || ""}`,
    },
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    intervalMillis: 15000, // 15 seconds
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
    metricReader,
  });

  try {
    sdk.start();
    telemetryLogger.info("OpenTelemetry SDK initialized successfully");

    globalTracer = trace.getTracer(
      finalConfig.serviceName,
      finalConfig.version,
    );
    globalMeter = metrics.getMeter(
      finalConfig.serviceName,
      finalConfig.version,
    );
  } catch (error) {
    telemetryLogger.error("Failed to initialize OpenTelemetry SDK", { error });
  }
}

/**
 * Get the global tracer instance
 */
export function getTracer(): trace.Tracer {
  if (!globalTracer) {
    throw new Error("Tracer not initialized. Call initTelemetry() first");
  }
  return globalTracer;
}

/**
 * Get the global meter instance
 */
export function getMeter(): metrics.Meter {
  if (!globalMeter) {
    throw new Error("Meter not initialized. Call initTelemetry() first");
  }
  return globalMeter;
}

/**
 * Wrap async function with tracing span
 */
export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, async (span) => {
    try {
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });
      }
      return await fn();
    } catch (error) {
      span.recordException(
        error instanceof Error ? error : new Error(String(error)),
      );
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Wrap sync function with tracing span
 */
export function withSpanSync<T>(
  name: string,
  fn: () => T,
  attributes?: Record<string, string | number | boolean>,
): T {
  const tracer = getTracer();
  const span = tracer.startSpan(name);

  return context.with(trace.setSpan(context.active(), span), () => {
    try {
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });
      }
      return fn();
    } catch (error) {
      span.recordException(
        error instanceof Error ? error : new Error(String(error)),
      );
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Business Metrics Recorder
 */
export class BusinessMetrics {
  private meter: metrics.Meter;

  constructor(meter: metrics.Meter) {
    this.meter = meter;
  }

  /**
   * Record campaign creation
   */
  recordCampaignCreated(campaignId: string, targetAmount: number): void {
    const counter = this.meter.createCounter("campaign_total_created", {
      description: "Total campaigns created",
      unit: "1",
    });
    counter.add(1, {
      campaign_id: campaignId,
      target_amount: targetAmount,
    });
  }

  /**
   * Record donation
   */
  recordDonation(campaignId: string, amount: number, currency: string): void {
    const counter = this.meter.createCounter("campaign_donations_total", {
      description: "Total donations by campaign",
      unit: "USD",
    });
    counter.add(amount, {
      campaign_id: campaignId,
      currency,
    });
  }

  /**
   * Record campaign success
   */
  recordCampaignSuccess(campaignId: string): void {
    const counter = this.meter.createCounter("campaign_success_total", {
      description: "Successfully funded campaigns",
      unit: "1",
    });
    counter.add(1, { campaign_id: campaignId });
  }

  /**
   * Record user signup
   */
  recordUserSignup(): void {
    const counter = this.meter.createCounter("new_user_signups_total", {
      description: "New user registrations",
      unit: "1",
    });
    counter.add(1);
  }

  /**
   * Record TVL change
   */
  recordTVLChange(tvlAmount: number): void {
    const gauge = this.meter.createUpDownCounter("tvl_total", {
      description: "Total Value Locked",
      unit: "USD",
    });
    gauge.add(tvlAmount);
  }

  /**
   * Record blockchain transaction
   */
  recordBlockchainTransaction(
    success: boolean,
    gasUsed: number,
    gasPrice: number,
  ): void {
    if (success) {
      const counter = this.meter.createCounter(
        "blockchain_transactions_total",
        {
          description: "Successful blockchain transactions",
          unit: "1",
        },
      );
      counter.add(1, { gas_used: gasUsed, gas_price: gasPrice });
    } else {
      const counter = this.meter.createCounter(
        "blockchain_transaction_failures_total",
        {
          description: "Failed blockchain transactions",
          unit: "1",
        },
      );
      counter.add(1);
    }
  }

  /**
   * Record smart contract call
   */
  recordSmartContractCall(success: boolean, functionName: string): void {
    if (!success) {
      const counter = this.meter.createCounter(
        "smart_contract_calls_failed_total",
        {
          description: "Failed smart contract calls",
          unit: "1",
        },
      );
      counter.add(1, { function_name: functionName });
    }
  }
}

/**
 * Performance Metrics Recorder
 */
export class PerformanceMetrics {
  private meter: metrics.Meter;

  constructor(meter: metrics.Meter) {
    this.meter = meter;
  }

  /**
   * Record HTTP request
   */
  recordHttpRequest(
    method: string,
    path: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const requestCounter = this.meter.createCounter("http_requests_total", {
      description: "Total HTTP requests",
      unit: "1",
    });
    requestCounter.add(1, {
      method,
      path,
      status: statusCode,
    });

    const durationHistogram = this.meter.createHistogram(
      "http_request_duration_seconds",
      {
        description: "HTTP request duration",
        unit: "s",
      },
    );
    durationHistogram.record(durationSeconds, {
      method,
      path,
      status: statusCode,
    });

    if (statusCode >= 400) {
      const errorCounter = this.meter.createCounter("http_errors_total", {
        description: "Total HTTP errors",
        unit: "1",
      });
      errorCounter.add(1, {
        method,
        path,
        status: statusCode,
      });
    }
  }

  /**
   * Record database query
   */
  recordDatabaseQuery(
    duration: number,
    operation: string,
    success: boolean,
  ): void {
    const histogram = this.meter.createHistogram("db_query_duration_seconds", {
      description: "Database query duration",
      unit: "s",
    });
    histogram.record(duration, {
      operation,
      success,
    });
  }

  /**
   * Record cache operation
   */
  recordCacheOperation(
    hit: boolean,
    operation: string,
    _duration: number,
  ): void {
    if (hit) {
      const counter = this.meter.createCounter("cache_hits_total", {
        description: "Cache hits",
        unit: "1",
      });
      counter.add(1, { operation });
    } else {
      const counter = this.meter.createCounter("cache_misses_total", {
        description: "Cache misses",
        unit: "1",
      });
      counter.add(1, { operation });
    }
  }

  /**
   * Record API latency
   */
  recordAPILatency(endpoint: string, duration: number, service: string): void {
    const histogram = this.meter.createHistogram(
      "api_request_duration_seconds",
      {
        description: "API request latency",
        unit: "s",
      },
    );
    histogram.record(duration, {
      endpoint,
      service,
    });
  }
}

/**
 * Cost Tracking Metrics
 */
export class CostMetrics {
  private meter: metrics.Meter;

  constructor(meter: metrics.Meter) {
    this.meter = meter;
  }

  /**
   * Record compute cost
   */
  recordComputeCost(amount: number, region: string): void {
    const counter = this.meter.createCounter("cost_compute_total", {
      description: "Total compute costs",
      unit: "USD",
    });
    counter.add(amount, { region });
  }

  /**
   * Record storage cost
   */
  recordStorageCost(amount: number, storageType: string): void {
    const counter = this.meter.createCounter("cost_storage_total", {
      description: "Total storage costs",
      unit: "USD",
    });
    counter.add(amount, { storage_type: storageType });
  }

  /**
   * Record bandwidth cost
   */
  recordBandwidthCost(amount: number): void {
    const counter = this.meter.createCounter("cost_bandwidth_total", {
      description: "Total bandwidth costs",
      unit: "USD",
    });
    counter.add(amount);
  }
}

// Export metric instances
export const businessMetrics = new BusinessMetrics(getMeter());
export const performanceMetrics = new PerformanceMetrics(getMeter());
export const costMetrics = new CostMetrics(getMeter());

// Export for external use
export type { TelemetryConfig };
