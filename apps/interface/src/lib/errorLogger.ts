import { ErrorInfo } from "react";
import { AppError, ErrorSeverity, toAppError } from "@/lib/errors";

// ── Structured log entry ──────────────────────────────────────────────────────

export interface ErrorLog {
  timestamp: string;
  message: string;
  code?: string;
  severity: ErrorSeverity;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
}

// ── Core logging function ─────────────────────────────────────────────────────

/**
 * Logs any error, normalising it to an AppError first.
 * Returns the structured log entry for further use (e.g. assertions in tests).
 */
export function logError(error: unknown, errorInfo?: ErrorInfo): ErrorLog {
  const appError = error instanceof AppError ? error : toAppError(error);

  const entry: ErrorLog = {
    timestamp: new Date().toISOString(),
    message: appError.message,
    code: appError.code,
    severity: appError.severity,
    stack: appError.stack,
    componentStack: errorInfo?.componentStack ?? undefined,
    url: typeof window !== "undefined" ? window.location.href : "unknown",
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
  };

  if (process.env.NODE_ENV === "development") {
    const method =
      appError.severity === "fatal" || appError.severity === "error"
        ? "error"
        : appError.severity === "warning"
          ? "warn"
          : "info";
    /* Development-only mirror of the structured entry, so errors stay visible
       while debugging. Gated on NODE_ENV, so it never ships to production. */
    // eslint-disable-next-line no-console
    console[method](
      `[${appError.severity.toUpperCase()}] ${appError.code}:`,
      appError.message,
      appError.originalError ?? "",
    );
  }

  if (process.env.NEXT_PUBLIC_ERROR_TRACKING_URL) {
    sendErrorToService(entry);
  }

  return entry;
}

// ── Remote reporting ──────────────────────────────────────────────────────────

async function sendErrorToService(entry: ErrorLog): Promise<void> {
  try {
    await fetch(process.env.NEXT_PUBLIC_ERROR_TRACKING_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    });
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to send error to tracking service");
    }
  }
}

// ── Global handler initialisation ─────────────────────────────────────────────

/**
 * Attaches global unhandledrejection and error listeners.
 * Call once from ErrorHandlerInitializer on the client.
 */
export function initializeErrorHandler(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("unhandledrejection", (event) => {
    logError(event.reason);
  });

  window.__errorLogger = (error: Error, errorInfo: ErrorInfo) => {
    logError(error, errorInfo);
  };
}
