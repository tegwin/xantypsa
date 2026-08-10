import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function authenticateApiKey(
  req: NextRequest
): Promise<{ tenantId: string; apiKeyId: string; permissions: string[] } | null> {
  const key = req.headers.get('X-API-Key');
  if (!key) return null;

  const keyHash = crypto.createHash('sha256').update(key).digest('hex');

  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyHash,
      isActive: true,
    },
  });

  if (!apiKey) return null;

  // Check expiry
  if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
    return null;
  }

  // Update lastUsedAt
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    tenantId: apiKey.tenantId,
    apiKeyId: apiKey.id,
    permissions: (apiKey.permissions as string[]) || [],
  };
}
