import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "./ErrorBoundary";

// Component that throws an error
function ThrowError() {
  throw new Error("Test error");
}

// Component that renders normally
function NormalComponent() {
  return <div>Normal content</div>;
}

// Component that throws different error types
function ThrowNetworkError() {
  throw new Error("Failed to fetch from API");
}

function ThrowNotFoundError() {
  throw new Error("404 not found");
}

function ThrowUnauthorizedError() {
  throw new Error("401 unauthorized");
}

describe("ErrorBoundary", () => {
  // Suppress console.error for these tests
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <NormalComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Normal content")).toBeInTheDocument();
  });

  it("renders error fallback when error is thrown", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("calls onError callback when error occurs", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalled();
  });

  it("renders custom fallback when provided", () => {
    const customFallback = (error: Error, reset: () => void) => (
      <div>
        <div>Custom error: {error.message}</div>
        <button onClick={reset}>Custom Reset</button>
      </div>
    );

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom error: Test error")).toBeInTheDocument();
  });

  it("resets error state when reset button is clicked", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Click reset button
    const resetButton = screen.getByRole("button", { name: /try again/i });
    await user.click(resetButton);

    // Rerender with normal component
    rerender(
      <ErrorBoundary>
        <NormalComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Normal content")).toBeInTheDocument();
  });

  it("applies correct styling for page level", () => {
    const { container } = render(
      <ErrorBoundary level="page">
        <ThrowError />
      </ErrorBoundary>
    );

    expect(container.querySelector(".min-h-screen")).toBeInTheDocument();
  });

  it("applies correct styling for section level", () => {
    const { container } = render(
      <ErrorBoundary level="section">
        <ThrowError />
      </ErrorBoundary>
    );

    expect(container.querySelector(".p-6")).toBeInTheDocument();
  });

  it("applies correct styling for component level", () => {
    const { container } = render(
      <ErrorBoundary level="component">
        <ThrowError />
      </ErrorBoundary>
    );

    expect(container.querySelector(".p-4")).toBeInTheDocument();
  });

  it("shows network error message for fetch errors", () => {
    render(
      <ErrorBoundary>
        <ThrowNetworkError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Connection error")).toBeInTheDocument();
  });

  it("shows not found error message for 404 errors", () => {
    render(
      <ErrorBoundary>
        <ThrowNotFoundError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Not found")).toBeInTheDocument();
  });

  it("shows access denied error message for unauthorized errors", () => {
    render(
      <ErrorBoundary>
        <ThrowUnauthorizedError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });

  it("renders error details in development mode", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText("Error details")).toBeInTheDocument();
    expect(screen.getByText("Test error")).toBeInTheDocument();

    process.env.NODE_ENV = originalNodeEnv;
  });

  it("does not render error details in production mode", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.queryByText("Error details")).not.toBeInTheDocument();

    process.env.NODE_ENV = originalNodeEnv;
  });

  it("has a retry button that allows recovery", async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    function ConditionalThrowComponent() {
      if (shouldThrow) {
        throw new Error("Conditional error");
      }
      return <div>Recovered successfully</div>;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalThrowComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Click retry button
    const retryButton = screen.getByRole("button", { name: /try again/i });
    await user.click(retryButton);

    // Stop throwing and rerender
    shouldThrow = false;
    rerender(
      <ErrorBoundary>
        <ConditionalThrowComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Recovered successfully")).toBeInTheDocument();
  });
});
