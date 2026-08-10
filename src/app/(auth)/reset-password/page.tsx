'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button, Input } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

const MIN_LENGTH = 12;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState<boolean | null>(null);

  // Arriving here without a valid recovery session means the link expired or was
  // already used — say so rather than failing silently at submit time.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push('/');
    router.refresh();
  }

  if (ready === false) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-3">
          <Image src="/logo.png" alt="VibePSA" width={56} height={56}
            className="mx-auto rounded-2xl shadow-lg shadow-brand-600/20" />
          <h1 className="text-2xl font-bold text-surface-50">Link expired</h1>
        </div>
        <div className="glass-panel p-6 text-sm text-surface-300">
          This reset link is no longer valid — they expire after an hour and can only be used once.
        </div>
        <p className="text-center text-sm text-surface-500">
          <Link href="/forgot-password" className="text-brand-400 hover:text-brand-300 font-medium">
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <Image src="/logo.png" alt="VibePSA" width={56} height={56}
          className="mx-auto rounded-2xl shadow-lg shadow-brand-600/20" />
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Choose a new password</h1>
          <p className="text-sm text-surface-400 mt-1">At least {MIN_LENGTH} characters.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <Input label="New password" type="password" value={password} required autoFocus
          onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" />
        <Input label="Confirm new password" type="password" value={confirm} required
          onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••••••" />

        <Button type="submit" loading={loading} disabled={ready === null} className="w-full" size="lg">
          Update password
        </Button>
      </form>
    </div>
  );
}
