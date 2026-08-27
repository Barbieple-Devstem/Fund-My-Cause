"use client";

import React, { ReactNode, Component, ErrorInfo, ComponentType } from "react";
import { AlertCircle, RefreshCw, WifiOff, Lock } from "lucide-react";
import { cn } from "./lib/utils";

export type ErrorBoundaryLevel = "page" | "section" | "component";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: ErrorBoundaryLevel;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Shared error boundary for catching render errors in a subtree.
 * @example
 * <ErrorBoundary level="section">
 *   <SomeComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error caught by boundary:", error, errorInfo);
    }

    this.props.onError?.(error, errorInfo);

    if (typeof window !== "undefined" && window.__errorLogger) {
      window.__errorLogger(error, errorInfo);
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }

      return (
        <ErrorFallback
          error={this.state.error}
          reset={this.reset}
          level={this.props.level}
        />
      );
    }

    return this.props.children;
  }
}

export interface ErrorFallbackProps {
  error: Error;
  reset: () => void;
  level?: ErrorBoundaryLevel;
}

/**
 * Presentational fallback UI shared by `ErrorBoundary` and by route-level
 * `error.tsx` files (Next's own error boundaries take the same
 * `{ error, reset }` shape), so every crash surface in the app renders the
 * same look with the same retry affordance.
 */
export function ErrorFallback({
  error,
  reset,
  level = "component",
}: ErrorFallbackProps) {
  const { icon, title, description } = getErrorMeta(error);

  const containerClasses: Record<ErrorBoundaryLevel, string> = {
    page: "min-h-screen flex items-center justify-center p-4",
    section:
      "p-6 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30",
    component:
      "p-4 rounded border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30",
  };

  const titleClasses: Record<ErrorBoundaryLevel, string> = {
    page: "text-3xl",
    section: "text-xl",
    component: "text-lg",
  };

  return (
    <div className={containerClasses[level]}>
      <div className="max-w-md w-full">
        <div className="flex items-start gap-3">
          {icon}
          <div className="flex-1">
            <h2
              className={cn(
                "font-semibold text-red-900 dark:text-red-200",
                titleClasses[level],
              )}
            >
              {title}
            </h2>
            <p className="text-sm text-red-700 dark:text-red-300 mt-2">
              {process.env.NODE_ENV === "development"
                ? error.message
                : description}
            </p>
            {process.env.NODE_ENV === "development" && (
              <details className="mt-3 text-xs text-red-600 dark:text-red-400">
                <summary className="cursor-pointer font-mono">
                  Error details
                </summary>
                <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/40 rounded overflow-auto max-h-40">
                  {error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={reset}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
            >
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── withErrorBoundary HOC ─────────────────────────────────────────────────────

export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  boundaryProps?: Omit<ErrorBoundaryProps, "children">,
) {
  const displayName =
    WrappedComponent.displayName ?? WrappedComponent.name ?? "Component";
  function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...boundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  }
  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
  return WithErrorBoundary;
}

// ── Typed error messages ──────────────────────────────────────────────────────

function getErrorMeta(error: Error): {
  icon: ReactNode;
  title: string;
  description: string;
} {
  const msg = error.message.toLowerCase();
  if (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("failed to fetch")
  ) {
    return {
      icon: (
        <WifiOff className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
      ),
      title: "Connection error",
      description: "Check your internet connection and try again.",
    };
  }
  if (
    msg.includes("unauthorized") ||
    msg.includes("403") ||
    msg.includes("401")
  ) {
    return {
      icon: <Lock className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />,
      title: "Access denied",
      description: "You don't have permission to view this content.",
    };
  }
  if (msg.includes("not found") || msg.includes("404")) {
    return {
      icon: (
        <AlertCircle className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
      ),
      title: "Not found",
      description: "The requested resource could not be found.",
    };
  }
  return {
    icon: <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />,
    title: "Something went wrong",
    description: "An unexpected error occurred. Please try again.",
  };
}

declare global {
  interface Window {
    __errorLogger?: (error: Error, errorInfo: ErrorInfo) => void;
  }
}
