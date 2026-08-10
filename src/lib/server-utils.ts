// ============================================================
// Server-only helpers
// ============================================================
// Split out of lib/utils.ts: these pull in prisma and next/headers, and
// utils.ts is imported by client components. Keeping them together dragged
// server-only modules into the browser bundle and broke the production build.

import { getAppSession } from './session';
import prisma from './prisma';
import { NextResponse } from 'next/server';
import type { Permission } from './permissions';

export async function getSession() {
  return getAppSession();
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  return session.user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireAuth();
  if (!user.isSuperAdmin && !user.permissions.includes(permission)) {
    throw new Error('Forbidden');
  }
  return user;
}

export async function apiAuth(requiredPermission?: Permission) {
  const session = await getSession();
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (requiredPermission && !session.user.isSuperAdmin && !session.user.permissions.includes(requiredPermission)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user: session.user };
}

// Lives in ./numbering so the MCP server can use it without pulling in
// next/headers. Re-exported here because callers already import it from this
// module.
export { getNextNumber } from './numbering';

export async function fireWebhooks(tenantId: string, event: string, payload: any) {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        tenantId,
        isActive: true,
        events: { array_contains: [event] },
      },
    });

    for (const wh of webhooks) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(wh.headers as Record<string, string>),
      };

      if (wh.secret) {
        const crypto = await import('crypto');
        const sig = crypto.createHmac('sha256', wh.secret).update(JSON.stringify(payload)).digest('hex');
        headers['X-Webhook-Signature'] = sig;
      }

      try {
        const res = await fetch(wh.url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload }),
        });

        await prisma.webhookLog.create({
          data: {
            tenantId,
            webhookId: wh.id,
            event,
            payload,
            statusCode: res.status,
            response: await res.text().catch(() => ''),
            success: res.ok,
          },
        });
      } catch (err: any) {
        await prisma.webhookLog.create({
          data: {
            tenantId,
            webhookId: wh.id,
            event,
            payload,
            response: err.message,
            success: false,
          },
        });
      }
    }
  } catch {
    // Silently fail webhooks - don't break main operations
  }
}
