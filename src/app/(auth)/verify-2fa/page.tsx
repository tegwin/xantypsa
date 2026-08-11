'use client';

// The second factor at sign-in. The password is already proven; this raises the
// session so the rest of the app becomes reachable.

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button, Input } from '@/components/ui';

export default function VerifyTwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerifying(true);
    try {
      const res = await fetch('/api/auth/totp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'That code was not accepted.');
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <Image src="/logo.png" alt="VibePSA" width={56} height={56}
          className="mx-auto rounded-2xl shadow-lg shadow-brand-600/20" />
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Two-factor</h1>
          <p className="text-sm text-surface-400 mt-1">
            Enter the code from your authenticator app.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="glass-panel p-6 space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <Input
          label="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="123456"
          inputMode="numeric"
          autoFocus
          required
        />

        <Button type="submit" loading={verifying} disabled={code.length !== 6}
          className="w-full" size="lg">
          Verify
        </Button>

        <p className="text-center text-xs text-surface-500">
          Lost your authenticator? An administrator can reset it for you.
        </p>
      </form>
    </div>
  );
}
