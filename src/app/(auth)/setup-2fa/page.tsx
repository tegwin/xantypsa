'use client';

// ============================================================
// TOTP enrolment
// ============================================================
// Where a user lands when their administrator has required two-factor. The
// secret is generated server-side and only stored once a code proves the
// authenticator has it.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button, Input } from '@/components/ui';

export default function SetupTwoFactorPage() {
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetch('/api/auth/totp/enrol')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else { setSecret(d.secret); setUri(d.uri); }
      })
      .catch(() => setError('Could not start enrolment.'));
  }, []);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerifying(true);
    try {
      const res = await fetch('/api/auth/totp/enrol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, code: code.trim() }),
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
        <Image src="/logo.png" alt="XantyPSA" width={56} height={56}
          className="mx-auto rounded-2xl shadow-lg shadow-brand-600/20" />
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Set up two-factor</h1>
          <p className="text-sm text-surface-400 mt-1">
            Your administrator requires this before you can continue.
          </p>
        </div>
      </div>

      <div className="glass-panel p-6 space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!secret ? (
          <p className="text-sm text-surface-400">Preparing…</p>
        ) : (
          <>
            <div>
              <p className="text-sm text-surface-300 mb-2">
                1. Add this to your authenticator — Microsoft Authenticator, Google
                Authenticator, 1Password or similar.
              </p>
              <code className="block break-all rounded-lg bg-white/5 p-3 text-center
                               font-mono text-lg tracking-widest text-brand-300">
                {secret.match(/.{1,4}/g)?.join(' ')}
              </code>
              {uri && (
                <p className="mt-2 text-center text-xs text-surface-500">
                  On this device?{' '}
                  <a href={uri} className="text-brand-400 hover:underline">
                    Open in your authenticator
                  </a>
                </p>
              )}
            </div>

            <form onSubmit={verify} className="space-y-4">
              <Input
                label="2. Enter the 6-digit code it shows"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                autoFocus
                required
              />
              <Button type="submit" loading={verifying} disabled={code.length !== 6}
                className="w-full" size="lg">
                Confirm and continue
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
