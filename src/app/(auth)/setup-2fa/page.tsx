'use client';

// ============================================================
// TOTP enrolment
// ============================================================
// Where a user lands when their admin has required two-factor and they have no
// authenticator set up yet. Supabase issues the secret and the QR code; the
// browser never handles a shared secret we invented.

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button, Input } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

export default function SetupTwoFactorPage() {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const enrol = async () => {
      const supabase = createClient();

      // A previous half-finished attempt leaves an unverified factor behind,
      // and Supabase refuses a second enrolment while one exists. Clear it.
      // `totp` holds only verified factors; abandoned enrolments sit in `all`.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const stale = (factors?.all ?? []).filter(
        (f) => f.factor_type === 'totp' && f.status !== 'verified'
      );
      for (const f of stale) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error: enrolError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `VibePSA ${new Date().toISOString().slice(0, 10)}`,
      });

      if (enrolError) {
        setError(enrolError.message);
        return;
      }

      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
    };

    enrol().catch((e) => setError(e.message));
  }, []);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setError('');
    setVerifying(true);

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });

    if (challengeError) {
      setError(challengeError.message);
      setVerifying(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });

    setVerifying(false);

    if (verifyError) {
      setError(
        verifyError.message.includes('Invalid')
          ? 'That code was not accepted. Codes change every 30 seconds — try the current one.'
          : verifyError.message
      );
      return;
    }

    // Verifying raises the session to aal2, so the middleware will let them in.
    router.push('/');
    router.refresh();
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <Image src="/logo.png" alt="VibePSA" width={56} height={56}
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

        {!qr ? (
          <p className="text-sm text-surface-400">Preparing your authenticator…</p>
        ) : (
          <>
            <div>
              <p className="text-sm text-surface-300 mb-3">
                1. Scan this with your authenticator app — Microsoft Authenticator, Google
                Authenticator, 1Password, or similar.
              </p>
              {/* Supabase returns the QR as an SVG data URL, so no QR library is needed. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Two-factor QR code" className="bg-white rounded-lg p-2 w-48 h-48 mx-auto" />
            </div>

            {secret && (
              <details className="text-xs text-surface-500">
                <summary className="cursor-pointer hover:text-surface-300">
                  Can&apos;t scan? Enter this code manually
                </summary>
                <code className="block mt-2 break-all bg-white/5 rounded p-2 text-surface-300">
                  {secret}
                </code>
              </details>
            )}

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
