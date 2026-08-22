/**
 * Structured application logger.
 *
 * Diagnostic logging that used to go through bare `console.log` / `console.debug`
 * calls routes through here instead, so that:
 *   - `debug` and `info` are silent in production builds — internal state never
 *     leaks to a real user's browser console;
 *   - every entry has a consistent, machine-readable shape (level, scope,
 *     message, context, timestamp) rather than ad-hoc positional arguments.
 *
 * `warn` and `error` are always emitted: they signal something an operator or
 * user genuinely needs to see, and are the only console methods the
 * `no-console` lint rule still permits directly.
 *
 * For thrown errors prefer `logError` in `@/lib/errorLogger`, which normalises
 * to an `AppError` and forwards to the error-tracking service.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Arbitrary structured context attached to a log entry. */
export type LogContext = Record<string, unknown>;

/** A single structured log entry, as handed to the underlying sink. */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  /** Subsystem the entry came from, e.g. `"react-query"`. */
  scope?: string;
  message: string;
  context?: LogContext;
}

const isProduction = () => process.env.NODE_ENV === "production";

/**
 * `debug`/`info` are development-only; `warn`/`error` always pass through so
 * production problems remain visible.
 */
function isLevelEnabled(level: LogLevel): boolean {
  if (level === "warn" || level === "error") return true;
  return !isProduction();
}

function emit(entry: LogEntry): void {
  if (!isLevelEnabled(entry.level)) return;

  const prefix = entry.scope ? `[${entry.scope}]` : "[app]";

  /* The logger is the one sanctioned place that talks to the console directly;
     everywhere else `no-console` is an error. */
  // eslint-disable-next-line no-console
  const write = console[entry.level] ?? console.log;
  if (entry.context) {
    write(`${prefix} ${entry.message}`, entry.context);
  } else {
    write(`${prefix} ${entry.message}`);
  }
}

function log(
  level: LogLevel,
  message: string,
  context?: LogContext,
  scope?: string,
): void {
  emit({
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    context,
  });
}

export interface Logger {
  /** Verbose tracing. Stripped from production builds. */
  debug(message: string, context?: LogContext): void;
  /** Notable lifecycle events. Stripped from production builds. */
  info(message: string, context?: LogContext): void;
  /** Recoverable problems. Always emitted. */
  warn(message: string, context?: LogContext): void;
  /** Failures. Always emitted. */
  error(message: string, context?: LogContext): void;
  /** Derives a logger that tags every entry with `scope`. */
  child(scope: string): Logger;
}

function createLogger(scope?: string): Logger {
  return {
    debug: (message, context) => log("debug", message, context, scope),
    info: (message, context) => log("info", message, context, scope),
    warn: (message, context) => log("warn", message, context, scope),
    error: (message, context) => log("error", message, context, scope),
    child: (childScope) =>
      createLogger(scope ? `${scope}:${childScope}` : childScope),
  };
}

/** Default application logger. Use `logger.child("subsystem")` to scope it. */
export const logger: Logger = createLogger();
