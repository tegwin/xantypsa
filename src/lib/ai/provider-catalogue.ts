// ============================================================
// Provider catalogue (client-safe)
// ============================================================
// Static configuration only - no prisma, no node crypto - so this can be
// imported directly by client components. The settings screen therefore does
// not need a successful API round-trip just to render the available options.

export type ProviderKind = 'anthropic' | 'openai' | 'local';
export type ProviderTier = 'primary' | 'secondary';

export interface ProviderMeta {
  kind: ProviderKind;
  label: string;
  tier: ProviderTier;
  description: string;
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
  models: { value: string; label: string }[];
}

/**
 * Ordered as the settings screen should present them. Anthropic and OpenAI are
 * primary and one of them should always be the default; `local` is a secondary
 * fallback for private or offline use, since smaller self-hosted models are
 * markedly less reliable at multi-step tool calling.
 */
export const PROVIDERS: ProviderMeta[] = [
  {
    kind: 'anthropic',
    label: 'Anthropic (Claude)',
    tier: 'primary',
    description: 'Recommended. Strongest tool use and the most reliable at multi-step tasks.',
    requiresApiKey: true,
    requiresBaseUrl: false,
    models: [
      { value: 'claude-opus-5', label: 'Claude Opus 5 (most capable)' },
      { value: 'claude-sonnet-5', label: 'Claude Sonnet 5 (balanced)' },
      { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (fastest)' },
    ],
  },
  {
    kind: 'openai',
    label: 'OpenAI',
    tier: 'primary',
    description: 'Recommended alternative to Anthropic.',
    requiresApiKey: true,
    requiresBaseUrl: false,
    models: [
      { value: 'gpt-5', label: 'GPT-5' },
      { value: 'gpt-5-mini', label: 'GPT-5 mini' },
      { value: 'gpt-4.1', label: 'GPT-4.1' },
    ],
  },
  {
    kind: 'local',
    label: 'Self-hosted (Ollama / vLLM / LM Studio)',
    tier: 'secondary',
    description:
      'Optional fallback for private or offline use. Data never leaves your infrastructure, but smaller models are less reliable at tool calling — keep Anthropic or OpenAI as your default.',
    requiresApiKey: false,
    requiresBaseUrl: true,
    models: [
      { value: 'qwen2.5:14b', label: 'Qwen 2.5 14B (best local tool use)' },
      { value: 'llama3.1:8b', label: 'Llama 3.1 8B' },
      { value: 'mistral-nemo', label: 'Mistral Nemo' },
    ],
  },
];

/** What the "add provider" form should preselect. */
export const DEFAULT_PROVIDER_KIND: ProviderKind = 'anthropic';

export const PRIMARY_PROVIDER_KINDS: ProviderKind[] = PROVIDERS
  .filter((p) => p.tier === 'primary')
  .map((p) => p.kind);

export function getProviderMeta(kind: ProviderKind): ProviderMeta {
  const meta = PROVIDERS.find((p) => p.kind === kind);
  if (!meta) throw new Error(`Unknown provider: ${kind}`);
  return meta;
}

export const SUGGESTED_MODELS: Record<ProviderKind, { value: string; label: string }[]> =
  Object.fromEntries(PROVIDERS.map((p) => [p.kind, p.models])) as Record<
    ProviderKind,
    { value: string; label: string }[]
  >;
