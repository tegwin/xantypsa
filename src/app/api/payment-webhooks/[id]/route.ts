import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop() as string;
  const { isActive, name } = await req.json().catch(() => ({}));

  const existing = await prisma.paymentWebhook.findFirst({
    where: { id, tenantId: session.user.tenantId },
    select: { id: true },
  });
  if (!existing) return errorResponse('Endpoint not found', 404);

  const hook = await prisma.paymentWebhook.update({
    where: { id },
    data: {
      ...(typeof isActive === 'boolean' ? { isActive } : {}),
      ...(name ? { name: String(name).trim() } : {}),
    },
    select: { id: true, name: true, publicId: true, provider: true, isActive: true },
  });
  return jsonResponse(hook);
}, 'settings', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop() as string;

  const existing = await prisma.paymentWebhook.findFirst({
    where: { id, tenantId: session.user.tenantId },
    select: { id: true },
  });
  if (!existing) return errorResponse('Endpoint not found', 404);

  // Deleting takes its log with it, so the provider's calls stop being
  // recorded as well as stopping working. Switching it off keeps the history.
  await prisma.paymentWebhook.delete({ where: { id } });
  return jsonResponse({ ok: true });
}, 'settings', 'write');
