// ============================================================
// Managing inbound payment webhook endpoints
// ============================================================

import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = withTenant(async (_req: NextRequest, session: any) => {
  const hooks = await prisma.paymentWebhook.findMany({
    where: { tenantId: session.user.tenantId },
    // secretHash is deliberately not selected: nothing needs it but the
    // endpoint that verifies a call.
    select: {
      id: true, name: true, publicId: true, provider: true, isActive: true,
      lastReceivedAt: true, createdAt: true,
      events: {
        select: { id: true, success: true, message: true, amount: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return jsonResponse({ items: hooks });
}, 'settings', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const { name, provider } = await req.json().catch(() => ({}));
  if (!name || !String(name).trim()) return errorResponse('Give the endpoint a name', 400);

  // Generated here and shown to the user exactly once. Only its digest is
  // stored, so a leak of the database does not leak the secret.
  const secret = crypto.randomBytes(32).toString('base64url');
  const hook = await prisma.paymentWebhook.create({
    data: {
      tenantId: session.user.tenantId,
      name: String(name).trim(),
      provider: String(provider || 'generic'),
      publicId: crypto.randomBytes(16).toString('hex'),
      secretHash: crypto.createHash('sha256').update(secret).digest('hex'),
    },
    select: { id: true, name: true, publicId: true, provider: true, isActive: true, createdAt: true },
  });

  return jsonResponse({ ...hook, secret }, 201);
}, 'settings', 'write');
