import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;

  const apiKeys = await prisma.apiKey.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      expiresAt: true,
      isActive: true,
      createdAt: true,
      permissions: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return jsonResponse({ items: apiKeys });
});

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const body = await req.json();
  const { name, expiresAt, permissions } = body;

  if (!name) {
    return errorResponse('Name is required');
  }

  const rawKey = `vcrm_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 12);

  const apiKey = await prisma.apiKey.create({
    data: {
      name,
      keyHash,
      keyPrefix,
      tenantId,
      isActive: true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      permissions: permissions || [],
    },
  });

  return jsonResponse({
    id: apiKey.id,
    name: apiKey.name,
    key: rawKey,
    keyPrefix,
    expiresAt: apiKey.expiresAt,
    permissions: apiKey.permissions,
    createdAt: apiKey.createdAt,
  }, 201);
});
