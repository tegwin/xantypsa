// ============================================================
// OpenAI-compatible adapter
// ============================================================
// Serves both hosted OpenAI and self-hosted servers (Ollama, vLLM, LM Studio,
// llama.cpp) - they all expose the same wire format, so the only difference is
// the base URL. `local` therefore needs no separate implementation.

import OpenAI from 'openai';
import type {
  ChatRequest, LLMProvider, ProviderConfig, ProviderKind, StreamEvent, ToolCall,
} from './types';

/** Ollama's default OpenAI-compatible endpoint. */
export const DEFAULT_LOCAL_BASE_URL = 'http://localhost:11434/v1';

export class OpenAICompatibleProvider implements LLMProvider {
  readonly kind: ProviderKind;
  private client: OpenAI;
  private model: string;

  constructor(config: ProviderConfig) {
    this.kind = config.kind;
    this.model = config.model;
    this.client = new OpenAI({
      // Self-hosted servers ignore the key but the SDK requires a non-empty one.
      apiKey: config.apiKey || 'local',
      baseURL:
        config.baseUrl || (config.kind === 'local' ? DEFAULT_LOCAL_BASE_URL : undefined),
    });
  }

  async *chat(req: ChatRequest): AsyncGenerator<StreamEvent> {
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: req.system },
    ];

    for (const m of req.messages) {
      if (m.role === 'user') {
        messages.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant') {
        messages.push({
          role: 'assistant',
          content: m.content || null,
          ...(m.toolCalls?.length
            ? {
                tool_calls: m.toolCalls.map((c) => ({
                  id: c.id,
                  type: 'function' as const,
                  function: { name: c.name, arguments: JSON.stringify(c.input) },
                })),
              }
            : {}),
        });
      } else {
        // OpenAI wants one message per tool result, unlike Anthropic's single turn.
        for (const r of m.results) {
          messages.push({ role: 'tool', tool_call_id: r.toolCallId, content: r.content });
        }
      }
    }

    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        max_completion_tokens: req.maxTokens ?? 16000,
        messages,
        tools: req.tools.map((t) => ({
          type: 'function' as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema as Record<string, unknown>,
          },
        })),
        stream: true,
      });

      // Tool calls arrive as fragments keyed by index; arguments stream as
      // partial JSON that is only parseable once the stream ends.
      const pending = new Map<number, { id: string; name: string; args: string }>();
      let finishReason: string | null = null;

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        if (choice.delta?.content) {
          yield { type: 'text', text: choice.delta.content };
        }

        for (const tc of choice.delta?.tool_calls ?? []) {
          const slot = pending.get(tc.index) ?? { id: '', name: '', args: '' };
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.name += tc.function.name;
          if (tc.function?.arguments) slot.args += tc.function.arguments;
          pending.set(tc.index, slot);
        }

        if (choice.finish_reason) finishReason = choice.finish_reason;
      }

      const calls: ToolCall[] = [];
      for (const slot of pending.values()) {
        let input: Record<string, unknown> = {};
        try {
          input = slot.args ? JSON.parse(slot.args) : {};
        } catch {
          // Smaller local models sometimes emit malformed argument JSON. Surface
          // it as a tool error rather than throwing away the whole turn.
          yield {
            type: 'error',
            message: `Model produced invalid JSON arguments for ${slot.name}`,
          };
          continue;
        }
        calls.push({ id: slot.id || `call_${slot.name}`, name: slot.name, input });
      }

      for (const call of calls) yield { type: 'tool_call', call };

      yield {
        type: 'done',
        stopReason:
          finishReason === 'tool_calls' || calls.length ? 'tool_use'
          : finishReason === 'length' ? 'max_tokens'
          : 'end_turn',
      };
    } catch (err: any) {
      const hint =
        this.kind === 'local'
          ? ' (is your local model server running?)'
          : '';
      yield { type: 'error', message: `${err?.message || 'Request failed'}${hint}` };
    }
  }
}
