import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { encryptSecret, maskKey } from '@/lib/crypto';
import { getProviderMeta, PROVIDERS } from '@/lib/ai/providers';
import type { ProviderKind } from '@/lib/ai/providers';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;

  const items = await prisma.aiProvider.findMany({
    where: { tenantId },
    // apiKeyEnc is deliberately excluded - the key never goes to the browser.
    select: {
      id: true,
      provider: true,
      label: true,
      model: true,
      baseUrl: true,
      isDefault: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });

  return jsonResponse({
    items,
    catalogue: PROVIDERS,
    // Surfaced so the UI can warn instead of failing on save.
    encryptionConfigured: Boolean(process.env.AI_ENCRYPTION_KEY),
  });
}, 'settings', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const body = await req.json();
  const { provider, label, model, apiKey, baseUrl, isDefault } = body;

  if (!provider || !model) return errorResponse('Provider and model are required');

  let meta;
  try {
    meta = getProviderMeta(provider as ProviderKind);
  } catch {
    return errorResponse(`Unknown provider "${provider}"`);
  }

  if (meta.requiresApiKey && !apiKey) return errorResponse(`${meta.label} requires an API key`);
  if (meta.requiresBaseUrl && !baseUrl) {
    return errorResponse(`${meta.label} requires a base URL, e.g. http://localhost:11434/v1`);
  }

  let apiKeyEnc: string;
  try {
    // Self-hosted servers ignore the key, but we still store a placeholder so
    // the decrypt path is uniform across providers.
    apiKeyEnc = encryptSecret(apiKey || 'local');
  } catch (err: any) {
    return errorResponse(err.message || 'Encryption is not configured', 500);
  }

  // A self-hosted provider is a fallback and must never become the default.
  const wantsDefault = Boolean(isDefault) && meta.tier === 'primary';

  const existingCount = await prisma.aiProvider.count({ where: { tenantId } });
  // First primary provider added becomes the default automatically.
  const makeDefault = wantsDefault || (existingCount === 0 && meta.tier === 'primary');

  if (makeDefault) {
    await prisma.aiProvider.updateMany({ where: { tenantId }, data: { isDefault: false } });
  }

  const created = await prisma.aiProvider.create({
    data: {
      tenantId,
      provider,
      label: label || meta.label,
      model,
      apiKeyEnc,
      baseUrl: baseUrl || null,
      isDefault: makeDefault,
    },
    select: { id: true, provider: true, label: true, model: true, isDefault: true },
  });

  return jsonResponse({ ...created, keyPreview: apiKey ? maskKey(apiKey) : null }, 201);
}, 'settings', 'write');
