'use client';

import { useState } from 'react';

export default function LoginForm({ slug }: { slug: string }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${slug}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Something went wrong.');
      setSent(body.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-sm text-slate-200">{sent}</p>
        <p className="mt-3 text-xs text-slate-500">
          The link works once and expires in 20 minutes. You can close this page.
        </p>
        <button
          onClick={() => { setSent(null); setEmail(''); }}
          className="mt-4 text-xs text-brand-400 hover:underline"
        >
          Use a different address
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm text-slate-300 mb-1.5">
          Your email address
        </label>
        <input
          id="email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourcompany.com"
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-white
                     placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={sending || !email}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 font-medium text-white
                   transition-colors hover:bg-brand-500 disabled:opacity-50"
      >
        {sending ? 'Sending…' : 'Email me a sign-in link'}
      </button>

      <p className="text-center text-xs text-slate-500">
        No password needed. We email you a link that signs you in.
      </p>
    </form>
  );
}
