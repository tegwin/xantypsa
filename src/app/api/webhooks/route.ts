import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;

  const webhooks = await prisma.webhook.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  return jsonResponse({ items: webhooks });
});

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const body = await req.json();
  const { name, url, secret, events, headers } = body;

  if (!name || !url || !events?.length) {
    return errorResponse('name, url, and events are required');
  }

  const webhook = await prisma.webhook.create({
    data: {
      name,
      url,
      secret: secret || null,
      events,
      headers: headers || {},
      isActive: true,
      tenantId,
    },
  });

  return jsonResponse(webhook, 201);
});
