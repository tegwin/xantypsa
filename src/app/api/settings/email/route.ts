import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { encryptSecret } from '@/lib/crypto';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenant = await prisma.tenant.findUnique({ where: { id: session.user.tenantId } });
  const settings = typeof tenant?.settings === 'string' ? JSON.parse(tenant.settings) : (tenant?.settings || {});
  const smtp = (settings as any)?.smtp || {};
  return jsonResponse({
    host: smtp.host || '',
    port: smtp.port || 587,
    username: smtp.username || '',
    password: smtp.password ? '••••••••' : '',
    tls: smtp.tls !== false,
    fromEmail: smtp.fromEmail || tenant?.email || '',
    fromName: smtp.fromName || tenant?.name || '',
  });
}, 'settings', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  const tenant = await prisma.tenant.findUnique({ where: { id: session.user.tenantId } });
  const settings = typeof tenant?.settings === 'string' ? JSON.parse(tenant.settings) : (tenant?.settings || {});

  const currentSmtp = (settings as any)?.smtp || {};

  // The browser is sent bullets rather than the password, so that value coming
  // back means "unchanged" — keep the stored ciphertext as-is. Anything else is
  // a new password and is encrypted before it touches the database.
  const password =
    body.password === '••••••••'
      ? currentSmtp.password || ''
      : body.password
        ? encryptSecret(body.password)
        : '';

  const newSmtp = {
    host: body.host || currentSmtp.host || '',
    port: body.port || currentSmtp.port || 587,
    username: body.username || currentSmtp.username || '',
    password,
    tls: body.tls !== undefined ? body.tls : true,
    fromEmail: body.fromEmail || '',
    fromName: body.fromName || '',
  };

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: { settings: { ...(settings as any), smtp: newSmtp } },
  });

  return jsonResponse({ success: true });
}, 'settings', 'write');
