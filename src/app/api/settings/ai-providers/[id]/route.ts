import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { encryptSecret } from '@/lib/crypto';
import { getProviderMeta, getTenantProvider } from '@/lib/ai/providers';
import type { ProviderKind } from '@/lib/ai/providers';

function extractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/');
  const idx = segments.indexOf('ai-providers');
  return idx >= 0 && idx + 1 < segments.length ? segments[idx + 1] : segments[segments.length - 1];
}

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = extractId(req);
  const tenantId = session.user.tenantId;
  const body = await req.json();

  const existing = await prisma.aiProvider.findFirst({ where: { id, tenantId } });
  if (!existing) return errorResponse('Provider not found', 404);

  const meta = getProviderMeta(existing.provider as ProviderKind);
  const data: any = {};

  if (body.label !== undefined) data.label = body.label;
  if (body.model !== undefined) data.model = body.model;
  if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl || null;
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  // Only replace the key when a new one is actually supplied.
  if (body.apiKey) data.apiKeyEnc = encryptSecret(body.apiKey);

  if (body.isDefault) {
    if (meta.tier !== 'primary') {
      return errorResponse(
        'A self-hosted provider cannot be the default. Set Anthropic or OpenAI as your default and use this one as a fallback.'
      );
    }
    await prisma.aiProvider.updateMany({ where: { tenantId }, data: { isDefault: false } });
    data.isDefault = true;
  }

  const updated = await prisma.aiProvider.update({
    where: { id },
    data,
    select: { id: true, provider: true, label: true, model: true, baseUrl: true, isDefault: true, isActive: true },
  });

  return jsonResponse(updated);
}, 'settings', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = extractId(req);
  const tenantId = session.user.tenantId;

  const existing = await prisma.aiProvider.findFirst({ where: { id, tenantId } });
  if (!existing) return errorResponse('Provider not found', 404);

  await prisma.aiProvider.delete({ where: { id } });

  // Don't leave the tenant without a default if others remain.
  if (existing.isDefault) {
    const next = await prisma.aiProvider.findFirst({
      where: { tenantId, isActive: true, provider: { in: ['anthropic', 'openai'] } },
      orderBy: { createdAt: 'asc' },
    });
    if (next) await prisma.aiProvider.update({ where: { id: next.id }, data: { isDefault: true } });
  }

  return jsonResponse({ success: true });
}, 'settings', 'write');

/** Round-trip a trivial prompt so the user finds out here, not mid-conversation. */
export const POST = withTenant(async (req: NextRequest, session: any) => {
  const id = extractId(req);
  const tenantId = session.user.tenantId;

  try {
    const provider = await getTenantProvider(tenantId, id);
    let text = '';
    let error: string | null = null;

    for await (const event of provider.chat({
      system: 'You are a connection test. Reply with exactly: OK',
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      tools: [],
      maxTokens: 16,
    })) {
      if (event.type === 'text') text += event.text;
      if (event.type === 'error') error = event.message;
    }

    if (error) return jsonResponse({ ok: false, error });
    return jsonResponse({ ok: true, reply: text.trim() || '(empty response)' });
  } catch (err: any) {
    return jsonResponse({ ok: false, error: err?.message || 'Connection failed' });
  }
}, 'settings', 'write');
