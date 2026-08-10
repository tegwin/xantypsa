import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: session.user.tenantId } });
  const settings = typeof tenant?.settings === 'string' ? JSON.parse(tenant.settings) : (tenant?.settings || {});
  const ms = (settings as any)?.microsoft || {};
  return jsonResponse({
    clientId: ms.clientId || '',
    clientSecret: ms.clientSecret ? '••••••••' : '',
    tenantId: ms.tenantId || '',
    mailbox: ms.mailbox || '',
  });
}, 'settings', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  const tenant = await prisma.tenant.findUnique({ where: { id: session.user.tenantId } });
  const settings = typeof tenant?.settings === 'string' ? JSON.parse(tenant.settings) : (tenant?.settings || {});

  const currentMs = (settings as any)?.microsoft || {};
  const newMs = {
    clientId: body.clientId || currentMs.clientId || '',
    clientSecret: body.clientSecret === '••••••••' ? currentMs.clientSecret : (body.clientSecret || ''),
    tenantId: body.tenantId || currentMs.tenantId || '',
    mailbox: body.mailbox || currentMs.mailbox || '',
  };

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: { settings: { ...(settings as any), microsoft: newMs } },
  });

  return jsonResponse({ success: true });
}, 'settings', 'write');
