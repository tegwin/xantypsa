'use client';

// ============================================================
// The embedded assistant
// ============================================================
// Mounted once in the dashboard layout, so it is present on every screen and
// knows which module it is sitting in. Not a bolt-on integration - it reads and
// writes through the same tenant-scoped tools the rest of the app uses.

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { moduleForPath, recordIdForPath } from '@/lib/ai/modules';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  /** Tool activity shown inline so the user can see what it did. */
  steps?: { name: string; done: boolean; isError?: boolean }[];
}

const TOOL_LABELS: Record<string, string> = {
  describe_schema: 'Looking up the data model',
  query_records: 'Querying records',
  run_analytics_query: 'Running an analysis',
  create_record: 'Creating a record',
};

export default function AiPanel() {
  const pathname = usePathname() || '';
  const ctx = moduleForPath(pathname);
  const recordId = recordIdForPath(pathname);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;

    const history = [...messages, { role: 'user' as const, content: text }];
    setMessages([...history, { role: 'assistant', content: '', steps: [] }]);
    setInput('');
    setBusy(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          module: ctx.module,
          recordId,
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const patchLast = (fn: (m: Msg) => Msg) =>
        setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? fn(m) : m)));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          if (!chunk.startsWith('data: ')) continue;
          const event = JSON.parse(chunk.slice(6));

          if (event.type === 'text') {
            patchLast((m) => ({ ...m, content: m.content + event.text }));
          } else if (event.type === 'tool_start') {
            patchLast((m) => ({
              ...m,
              steps: [...(m.steps ?? []), { name: event.name, done: false }],
            }));
          } else if (event.type === 'tool_end') {
            patchLast((m) => ({
              ...m,
              steps: (m.steps ?? []).map((s) =>
                s.name === event.name && !s.done ? { ...s, done: true, isError: event.isError } : s
              ),
            }));
          } else if (event.type === 'error') {
            patchLast((m) => ({ ...m, content: `${m.content}\n\n⚠️ ${event.message}` }));
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, content: `⚠️ ${err.message}` } : m
        )
      );
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title={`Ask about ${ctx.label}`}
        className="fixed bottom-6 right-6 z-30 h-12 w-12 rounded-full bg-brand-600 hover:bg-brand-500 shadow-lg flex items-center justify-center transition-colors"
      >
        <Sparkles className="h-5 w-5 text-white" />
      </button>
    );
  }

  // Docked as a flex sibling of the main column (not floating), so opening it
  // shrinks the page rather than covering it. Solid background — a translucent
  // one let the table bleed through and made both unreadable.
  return (
    <aside className="w-[400px] shrink-0 h-full bg-surface-900 border-l border-white/10 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-brand-400 shrink-0" />
          <span className="text-sm font-medium text-surface-100 truncate">
            Ask about {ctx.label}
          </span>
        </div>
        <button onClick={() => setOpen(false)} className="text-surface-400 hover:text-surface-200">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-surface-400">
              I can query your {ctx.label.toLowerCase()} and create records. Try:
            </p>
            {ctx.suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full text-left text-sm bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 text-surface-300 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            {m.steps && m.steps.length > 0 && (
              <div className="mb-2 space-y-1">
                {m.steps.map((s, j) => (
                  <div key={j} className="flex items-center gap-2 text-xs text-surface-500">
                    {s.done ? (
                      <span className={s.isError ? 'text-red-400' : 'text-green-400'}>
                        {s.isError ? '✕' : '✓'}
                      </span>
                    ) : (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    {TOOL_LABELS[s.name] ?? s.name}
                  </div>
                ))}
              </div>
            )}
            {m.content && (
              <div
                className={
                  m.role === 'user'
                    ? 'inline-block bg-brand-600/20 text-surface-100 rounded-lg px-3 py-2 text-sm text-left max-w-[85%]'
                    : 'text-sm text-surface-200 whitespace-pre-wrap'
                }
              >
                {m.content}
              </div>
            )}
          </div>
        ))}

        {busy && messages[messages.length - 1]?.content === '' && (
          <Loader2 className="h-4 w-4 animate-spin text-surface-500" />
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="p-3 border-t border-white/10 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about ${ctx.label.toLowerCase()}…`}
          className="flex-1 bg-white/5 rounded-lg px-3 py-2 text-sm text-surface-100 placeholder:text-surface-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="px-3 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="h-4 w-4 text-white" />
        </button>
      </form>
    </aside>
  );
}
