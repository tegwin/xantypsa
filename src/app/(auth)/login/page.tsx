'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input } from '@/components/ui';
import Link from 'next/link';
import Image from 'next/image';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const callbackUrl = searchParams.get('callbackUrl') || '/';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const body = await res.json();

      if (!res.ok) {
        // The server keeps "no such account" and "wrong password"
        // indistinguishable; don't embellish the message here either.
        setError(body.error ?? 'Incorrect email or password.');
        return;
      }

      // Accounts with an authenticator are only half signed in until the code
      // is entered.
      router.push(body.mfaRequired ? '/verify-2fa' : callbackUrl);
      router.refresh(); // re-run the server layout so the session is picked up
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-5">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <Input
        label="Email address"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        required
        autoFocus
      />

      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        required
      />

      <div className="flex items-center justify-end">
        <Link href="/forgot-password" className="text-sm text-brand-400 hover:text-brand-300">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" loading={loading} className="w-full" size="lg">
        Sign in
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <Image
          src="/logo.png"
          alt="VibePSA"
          width={56}
          height={56}
          className="mx-auto rounded-2xl shadow-lg shadow-brand-600/20"
        />
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Welcome back</h1>
          <p className="text-sm text-surface-400 mt-1">Sign in to VibePSA</p>
        </div>
      </div>

      {/* useSearchParams needs a Suspense boundary, or the production build
          fails to prerender this route. */}
      <Suspense fallback={<div className="glass-panel p-6 h-64" />}>
        <LoginForm />
      </Suspense>

      <p className="text-center text-sm text-surface-500">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-brand-400 hover:text-brand-300 font-medium">
          Create one
        </Link>
      </p>
    </div>
  );
}
