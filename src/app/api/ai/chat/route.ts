import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/api';
import { getTenantProvider } from '@/lib/ai/providers';
import type { ChatMessage, ToolResult } from '@/lib/ai/providers';
import { buildSystemPrompt, executeTool, getToolDefinitions } from '@/lib/ai/tools';

// The tool loop can run several model round-trips; don't let the platform cut it off.
export const maxDuration = 300;

/** Stop a runaway loop rather than billing tokens forever. */
const MAX_TURNS = 8;

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  const { messages: incoming, module, recordId, providerId } = body;

  const ctx = {
    tenantId: session.user.tenantId,
    userId: session.user.id,
    // Writes follow the user's own permissions - the AI is never more
    // privileged than the person driving it.
    allowWrites:
      session.user.isSuperAdmin ||
      (session.user.permissions || []).some((p: string) => p.endsWith(':create') || p.endsWith(':edit')),
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      try {
        const provider = await getTenantProvider(ctx.tenantId, providerId);
        const tools = getToolDefinitions(ctx);
        const system = buildSystemPrompt(module) +
          (recordId ? `\n\nThe user is looking at record id "${recordId}".` : '');

        const messages: ChatMessage[] = (incoming || []).map((m: any) =>
          m.role === 'user'
            ? { role: 'user' as const, content: m.content }
            : { role: 'assistant' as const, content: m.content }
        );

        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const pendingCalls: any[] = [];
          let assistantText = '';
          let stopReason = 'end_turn';

          for await (const event of provider.chat({ system, messages, tools })) {
            switch (event.type) {
              case 'text':
                assistantText += event.text;
                send({ type: 'text', text: event.text });
                break;
              case 'tool_call':
                pendingCalls.push(event.call);
                // Show the user what it's doing rather than a silent pause.
                send({ type: 'tool_start', name: event.call.name, input: event.call.input });
                break;
              case 'done':
                stopReason = event.stopReason;
                break;
              case 'error':
                send({ type: 'error', message: event.message });
                controller.close();
                return;
            }
          }

          if (!pendingCalls.length || stopReason === 'end_turn') {
            send({ type: 'done' });
            controller.close();
            return;
          }

          messages.push({ role: 'assistant', content: assistantText, toolCalls: pendingCalls });

          // Run the calls concurrently; they're independent reads most of the time.
          const results: ToolResult[] = await Promise.all(
            pendingCalls.map(async (call) => {
              const result = await executeTool(call.name, call.input, ctx);
              send({ type: 'tool_end', name: call.name, isError: Boolean(result.isError) });
              return { toolCallId: call.id, content: result.content, isError: result.isError };
            })
          );

          messages.push({ role: 'tool', results });
        }

        send({ type: 'error', message: `Stopped after ${MAX_TURNS} steps without finishing.` });
        controller.close();
      } catch (err: any) {
        send({ type: 'error', message: err?.message || 'AI request failed' });
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}, 'dashboard', 'read');
