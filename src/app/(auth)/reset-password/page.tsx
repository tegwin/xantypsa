'use client';

// Reached from the emailed link. The token in the URL is the only proof, so it
// is single-use and short-lived; the server enforces both.

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button, Input } from '@/components/ui';

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Those two passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not reset your password.');
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!token) {
    return (
      <div className="glass-panel p-6 text-center space-y-3">
        <p className="text-sm text-surface-300">This link is missing its token.</p>
        <Link href="/forgot-password" className="text-sm text-brand-400 hover:underline">
          Request a new one
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="glass-panel p-6 text-center space-y-4">
        <p className="text-sm text-surface-200">Your password has been changed.</p>
        <Button onClick={() => router.push('/login')} className="w-full">
          Sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="glass-panel p-6 space-y-5">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <Input
        label="New password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 12 characters"
        autoFocus
        required
      />
      <Input
        label="Confirm it"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
      />

      <Button type="submit" loading={saving} disabled={password.length < 12}
        className="w-full" size="lg">
        Change password
      </Button>

      <p className="text-xs text-surface-500">
        Twelve characters or more. A memorable phrase beats a short password with
        symbols in it.
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <Image src="/logo.svg" alt="Xanty PSA" width={56} height={56}
          className="mx-auto rounded-2xl shadow-lg shadow-brand-600/20" />
        <h1 className="text-2xl font-bold text-surface-50">Choose a new password</h1>
      </div>
      {/* useSearchParams needs a Suspense boundary or the production build fails. */}
      <Suspense fallback={<div className="glass-panel p-6 text-sm text-surface-400">Loading…</div>}>
        <ResetForm />
      </Suspense>
    </div>
  );
}
