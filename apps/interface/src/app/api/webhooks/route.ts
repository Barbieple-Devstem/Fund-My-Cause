/**
 * GET  /api/webhooks  — List webhooks for the authenticated user
 * POST /api/webhooks  — Register a new webhook
 *
 * Issue #677
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  registerWebhook,
  listWebhooks,
  type WebhookEventType,
} from '@/lib/webhooks/webhook.service';

export async function GET(req: NextRequest) {
  const ownerId = req.headers.get('x-wallet-address');
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const hooks = listWebhooks(ownerId);
  return NextResponse.json({ success: true, data: hooks, timestamp: new Date().toISOString() });
}

export async function POST(req: NextRequest) {
  const ownerId = req.headers.get('x-wallet-address');
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { url: string; events: WebhookEventType[] };
  const { url, events } = body;

  if (!url || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_BODY', message: 'url and events are required' } },
      { status: 400 },
    );
  }

  try {
    const hook = registerWebhook(ownerId, url, events);
    return NextResponse.json(
      { success: true, data: hook, timestamp: new Date().toISOString() },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: { code: 'REGISTER_FAILED', message: String(err) } },
      { status: 400 },
    );
  }
}
