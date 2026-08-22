/**
 * Rate limiting middleware helpers — Issue #675
 *
 * Usage in a Next.js API route:
 *
 * ```ts
 * import { withRateLimit, SEARCH_LIMIT } from '@/lib/rate-limit/middleware';
 *
 * export const GET = withRateLimit(SEARCH_LIMIT, async (req) => {
 *   // handler body
 * });
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, AUTH_MULTIPLIER, type RateLimitOptions } from './rate-limiter';
import { trackThrottledRequest } from './metrics';

/** Extract the best available client identifier from the request. */
function getIdentifier(req: NextRequest): string {
  // Prefer authenticated wallet address if present in header
  const walletHeader = req.headers.get('x-wallet-address');
  if (walletHeader) return `wallet:${walletHeader}`;

  // Forwarded IP (CDN/proxy)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return `ip:${forwarded.split(',')[0].trim()}`;

  // Direct IP
  const ip = (req as NextRequest & { ip?: string }).ip ?? 'unknown';
  return `ip:${ip}`;
}

/** Check query complexity for GraphQL-style endpoints. */
export function checkQueryComplexity(body: unknown, maxComplexity = 100): boolean {
  if (!body || typeof body !== 'object') return true;
  const query = (body as Record<string, unknown>).query;
  if (typeof query !== 'string') return true;
  // Rough complexity: count nested braces and fields
  const nestingDepth = (query.match(/\{/g) ?? []).length;
  const fieldCount = (query.match(/\w+\s*[{(]/g) ?? []).length;
  return nestingDepth * 5 + fieldCount <= maxComplexity;
}

type RouteHandler = (req: NextRequest) => Promise<NextResponse>;

/**
 * Higher-order function that wraps a Next.js route handler with rate limiting.
 *
 * Authenticated users (wallet address in x-wallet-address header) receive
 * AUTH_MULTIPLIER × the base limit.
 */
export function withRateLimit(opts: RateLimitOptions, handler: RouteHandler): RouteHandler {
  return async (req: NextRequest): Promise<NextResponse> => {
    const identifier = getIdentifier(req);
    const isAuth = req.headers.has('x-wallet-address');

    const effectiveOpts: RateLimitOptions = isAuth
      ? { ...opts, max: opts.max * AUTH_MULTIPLIER }
      : opts;

    const result = checkRateLimit(identifier, effectiveOpts);

    // Always set RateLimit headers
    const headers = new Headers();
    headers.set('RateLimit-Limit', String(result.limit));
    headers.set('RateLimit-Remaining', String(result.remaining));
    headers.set('RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
    headers.set('RateLimit-Policy', `${result.limit};w=${Math.ceil(opts.windowMs / 1000)}`);

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      headers.set('Retry-After', String(retryAfter));

      // Emit throttle metric
      trackThrottledRequest({ identifier, prefix: opts.prefix ?? 'api', retryAfter });

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please slow down.',
            retryAfter,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 429, headers },
      );
    }

    const response = await handler(req);

    // Attach headers to the actual response
    result && headers.forEach((v, k) => response.headers.set(k, v));
    return response;
  };
}

/** Request size guard — rejects bodies larger than maxBytes. */
export async function checkRequestSize(req: NextRequest, maxBytes = 1024 * 100): Promise<boolean> {
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) return false;
  return true;
}
