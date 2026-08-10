// ============================================================
// Anthropic adapter
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import type {
  ChatRequest, LLMProvider, ProviderConfig, StreamEvent, ToolCall,
} from './types';

export class AnthropicProvider implements LLMProvider {
  readonly kind = 'anthropic' as const;
  private client: Anthropic;
  private model: string;

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
    });
    this.model = config.model;
  }

  async *chat(req: ChatRequest): AsyncGenerator<StreamEvent> {
    const messages: Anthropic.MessageParam[] = [];

    for (const m of req.messages) {
      if (m.role === 'user') {
        messages.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant') {
        const content: Anthropic.ContentBlockParam[] = [];
        if (m.content) content.push({ type: 'text', text: m.content });
        for (const call of m.toolCalls ?? []) {
          content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input });
        }
        messages.push({ role: 'assistant', content });
      } else {
        // Tool results must all come back in a single user turn, or the model
        // learns to stop calling tools in parallel.
        messages.push({
          role: 'user',
          content: m.results.map((r) => ({
            type: 'tool_result' as const,
            tool_use_id: r.toolCallId,
            content: r.content,
            ...(r.isError ? { is_error: true } : {}),
          })),
        });
      }
    }

    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: req.maxTokens ?? 16000,
        // The schema index is large and identical every turn - cache it.
        system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
        thinking: { type: 'adaptive' },
        tools: req.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
        })),
        messages,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'text', text: event.delta.text };
        }
      }

      const final = await stream.finalMessage();

      const calls: ToolCall[] = final.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
        .map((b) => ({ id: b.id, name: b.name, input: b.input as Record<string, unknown> }));

      for (const call of calls) yield { type: 'tool_call', call };

      yield {
        type: 'done',
        stopReason:
          final.stop_reason === 'tool_use' ? 'tool_use'
          : final.stop_reason === 'max_tokens' ? 'max_tokens'
          : final.stop_reason === 'refusal' ? 'refusal'
          : 'end_turn',
      };
    } catch (err: any) {
      yield { type: 'error', message: err?.message || 'Anthropic request failed' };
    }
  }
}
