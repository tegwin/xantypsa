'use client';

// Second step of sign-in for anyone with an authenticator enrolled. Supabase
// treats the session as aal1 until this succeeds; the middleware blocks the app
// until it reaches aal2.

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button, Input } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

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
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp?.find((f) => f.status === 'verified');

      if (!factor) {
        setError('No authenticator is set up on this account.');
        return;
      }

      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) throw verifyError;

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(
        err.message?.includes('Invalid')
          ? 'That code was not accepted. Codes change every 30 seconds — try the current one.'
          : err.message || 'Verification failed'
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <Image src="/logo.png" alt="VibePSA" width={56} height={56}
          className="mx-auto rounded-2xl shadow-lg shadow-brand-600/20" />
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Two-factor code</h1>
          <p className="text-sm text-surface-400 mt-1">
            Open your authenticator app and enter the current code.
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
        <Button type="submit" loading={verifying} disabled={code.length !== 6} className="w-full" size="lg">
          Verify
        </Button>
      </form>
    </div>
  );
}
