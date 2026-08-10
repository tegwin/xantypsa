import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const id = req.nextUrl.pathname.split('/').slice(-1)[0]!;

  const webhook = await prisma.webhook.findFirst({
    where: { id, tenantId },
  });

  if (!webhook) {
    return errorResponse('Webhook not found', 404);
  }

  const logs = await prisma.webhookLog.findMany({
    where: { webhookId: id, tenantId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return jsonResponse({ ...webhook, logs });
});

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const id = req.nextUrl.pathname.split('/').slice(-1)[0]!;
  const body = await req.json();

  const existing = await prisma.webhook.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    return errorResponse('Webhook not found', 404);
  }

  const data: Record<string, any> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.url !== undefined) data.url = body.url;
  if (body.secret !== undefined) data.secret = body.secret;
  if (body.events !== undefined) data.events = body.events;
  if (body.headers !== undefined) data.headers = body.headers;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const updated = await prisma.webhook.update({
    where: { id },
    data,
  });

  return jsonResponse(updated);
});

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const id = req.nextUrl.pathname.split('/').slice(-1)[0]!;

  const existing = await prisma.webhook.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    return errorResponse('Webhook not found', 404);
  }

  await prisma.webhookLog.deleteMany({ where: { webhookId: id } });
  await prisma.webhook.delete({ where: { id } });

  return jsonResponse({ success: true });
});
