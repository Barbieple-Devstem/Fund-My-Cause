import { describe, it, expect, vi } from "vitest";
import { GraphQLError } from "graphql";
import { requireAuth, withAuth } from "./auth.js";
import type { Context } from "../types.js";

/** Minimal context stub with no authenticated user. */
function unauthenticatedContext(): Context {
  return {
    cache: {},
    contractService: {},
    dataLoader: {} as any,
    pubsub: {} as any,
    authService: {},
    user: undefined,
    redis: {} as any,
    traceId: "test-trace-id",
    log: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as any,
  };
}

/** Minimal context stub with an authenticated user. */
function authenticatedContext(): Context {
  return {
    ...unauthenticatedContext(),
    user: { address: "GADDRESS123", isAuthenticated: true },
  };
}

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------

describe("requireAuth", () => {
  it("does not throw when user is authenticated", () => {
    expect(() => requireAuth(authenticatedContext())).not.toThrow();
  });

  it("throws UNAUTHENTICATED when context.user is undefined", () => {
    const ctx = unauthenticatedContext();
    expect(() => requireAuth(ctx)).toThrow(GraphQLError);

    try {
      requireAuth(ctx);
    } catch (err) {
      expect(err).toBeInstanceOf(GraphQLError);
      const gqlErr = err as GraphQLError;
      expect(gqlErr.extensions?.code).toBe("UNAUTHENTICATED");
      expect((gqlErr.extensions?.http as any)?.status).toBe(401);
    }
  });

  it("throws UNAUTHENTICATED when isAuthenticated is false", () => {
    const ctx: Context = {
      ...unauthenticatedContext(),
      user: { address: "GADDRESS123", isAuthenticated: false },
    };
    expect(() => requireAuth(ctx)).toThrow(GraphQLError);
  });
});

// ---------------------------------------------------------------------------
// withAuth
// ---------------------------------------------------------------------------

describe("withAuth", () => {
  it("delegates to the wrapped resolver when the user is authenticated", async () => {
    const inner = vi.fn().mockResolvedValue("result");
    const wrapped = withAuth(inner);
    const ctx = authenticatedContext();

    const result = await wrapped({}, {}, ctx, {} as any);

    expect(result).toBe("result");
    expect(inner).toHaveBeenCalledOnce();
  });

  it("throws before calling the wrapped resolver when unauthenticated", async () => {
    const inner = vi.fn();
    const wrapped = withAuth(inner);
    const ctx = unauthenticatedContext();

    await expect(wrapped({}, {}, ctx, {} as any)).rejects.toThrow(GraphQLError);
    expect(inner).not.toHaveBeenCalled();
  });

  it("propagates errors thrown by the inner resolver", async () => {
    const inner = vi.fn().mockRejectedValue(new Error("inner error"));
    const wrapped = withAuth(inner);
    const ctx = authenticatedContext();

    await expect(wrapped({}, {}, ctx, {} as any)).rejects.toThrow("inner error");
  });
});
