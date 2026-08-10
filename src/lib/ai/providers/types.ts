// ============================================================
// Provider-neutral LLM interface
// ============================================================
// Every provider - hosted or self-hosted - is reduced to this shape so the
// rest of the app never branches on which vendor is configured.

import type { ProviderKind } from '../provider-catalogue';
export type { ProviderKind };

export interface ProviderConfig {
  kind: ProviderKind;
  model: string;
  apiKey: string;
  /** Required for `local`; optional override for the hosted providers. */
  baseUrl?: string;
}

/** A tool the model may call. JSON Schema, since all three providers accept it. */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; results: ToolResult[] };

export interface ChatRequest {
  system: string;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  maxTokens?: number;
}

/** Streamed back to the browser over SSE. */
export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'done'; stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal' }
  | { type: 'error'; message: string };

export interface LLMProvider {
  readonly kind: ProviderKind;
  /** Streams the assistant turn. Tool calls surface as events; the caller runs the loop. */
  chat(req: ChatRequest): AsyncGenerator<StreamEvent>;
}
