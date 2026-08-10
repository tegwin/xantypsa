'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@/components/ui';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', company: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      toast.success('Account created! Please sign in.');
      router.push('/login');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <Image src="/logo.png" alt="VibePSA" width={56} height={56} className="mx-auto rounded-2xl shadow-lg shadow-brand-600/20" />
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Create account</h1>
          <p className="text-sm text-surface-400 mt-1">Get started with VibePSA</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-5">
        <Input label="Company name" value={form.company} onChange={update('company')} placeholder="Acme IT Services" required />
        <Input label="Your name" value={form.name} onChange={update('name')} placeholder="John Smith" required />
        <Input label="Email" type="email" value={form.email} onChange={update('email')} placeholder="you@company.com" required />
        <Input label="Password" type="password" value={form.password} onChange={update('password')} placeholder="Min. 8 characters" required minLength={8} />
        <Button type="submit" loading={loading} className="w-full" size="lg">Create account</Button>
      </form>

      <p className="text-center text-sm text-surface-500">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
      </p>
    </div>
  );
}
