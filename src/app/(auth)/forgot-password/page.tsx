'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button, Input } from '@/components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    }).catch(() => undefined);

    // Always report success, whether or not the address exists. Reporting
    // "no such account" would turn this form into an account-enumeration oracle.
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-3">
          <Image src="/logo.svg" alt="Xanty PSA" width={56} height={56}
            className="mx-auto rounded-2xl shadow-lg shadow-brand-600/20" />
          <h1 className="text-2xl font-bold text-surface-50">Check your email</h1>
        </div>
        <div className="glass-panel p-6 space-y-4 text-sm text-surface-300">
          <p>
            If an account exists for <strong className="text-surface-100">{email}</strong>, we&apos;ve
            sent a link to reset your password.
          </p>
          <p className="text-surface-500">
            The link expires in one hour and can only be used once. Check your spam folder if it
            hasn&apos;t arrived in a few minutes.
          </p>
        </div>
        <p className="text-center text-sm text-surface-500">
          <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <Image src="/logo.svg" alt="Xanty PSA" width={56} height={56}
          className="mx-auto rounded-2xl shadow-lg shadow-brand-600/20" />
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Reset your password</h1>
          <p className="text-sm text-surface-400 mt-1">
            We&apos;ll email you a link to set a new one.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-5">
        <Input
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
          autoFocus
        />
        <Button type="submit" loading={loading} className="w-full" size="lg">
          Send reset link
        </Button>
      </form>

      <p className="text-center text-sm text-surface-500">
        Remembered it?{' '}
        <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
