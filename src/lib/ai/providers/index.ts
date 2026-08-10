// ============================================================
// Provider resolution
// ============================================================

import { prisma } from '@/lib/prisma';
import { decryptSecret } from '@/lib/crypto';
import { AnthropicProvider } from './anthropic';
import { OpenAICompatibleProvider, DEFAULT_LOCAL_BASE_URL } from './openai-compatible';
import type { LLMProvider, ProviderConfig, ProviderKind } from './types';
import { PRIMARY_PROVIDER_KINDS } from '../provider-catalogue';

export * from './types';
export { DEFAULT_LOCAL_BASE_URL };

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.kind) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
    case 'local':
      return new OpenAICompatibleProvider(config);
    default:
      throw new Error(`Unknown provider: ${config.kind}`);
  }
}

/**
 * Load the provider to use and decrypt its key. Server-side only.
 *
 * Resolution order when no provider is named: the explicit default, then any
 * primary (Anthropic/OpenAI) provider, and only then a self-hosted one. A
 * `local` config is a deliberate fallback, so it is never picked ahead of a
 * hosted provider that is also configured.
 */
export async function getTenantProvider(
  tenantId: string,
  providerId?: string
): Promise<LLMProvider> {
  const record = providerId
    ? await prisma.aiProvider.findFirst({ where: { id: providerId, tenantId, isActive: true } })
    : (await prisma.aiProvider.findFirst({
        where: { tenantId, isActive: true, isDefault: true },
      })) ??
      (await prisma.aiProvider.findFirst({
        where: { tenantId, isActive: true, provider: { in: PRIMARY_PROVIDER_KINDS } },
        orderBy: { createdAt: 'asc' },
      })) ??
      (await prisma.aiProvider.findFirst({
        where: { tenantId, isActive: true },
        orderBy: { createdAt: 'asc' },
      }));

  if (!record) {
    throw new Error(
      'No AI provider configured. Add one under Settings → AI.'
    );
  }

  return createProvider({
    kind: record.provider as ProviderKind,
    model: record.model,
    apiKey: decryptSecret(record.apiKeyEnc),
    baseUrl: record.baseUrl || undefined,
  });
}

// The catalogue lives in a client-safe module so the settings UI can import
// it directly without pulling prisma/node-crypto into the browser bundle.
export * from '../provider-catalogue';
