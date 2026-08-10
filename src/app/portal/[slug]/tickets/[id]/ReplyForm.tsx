'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ReplyForm({ slug, ticketId }: { slug: string; ticketId: string }) {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not send your reply.');
      setContent('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6">
      <label htmlFor="reply" className="mb-1.5 block text-sm text-slate-300">
        Add a reply
      </label>
      <textarea
        id="reply"
        rows={4}
        required
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Anything else the team should know?"
        className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm
                   text-white placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
      />
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={sending || !content.trim()}
        className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white
                   transition-colors hover:bg-brand-500 disabled:opacity-50"
      >
        {sending ? 'Sending…' : 'Send reply'}
      </button>
    </form>
  );
}
