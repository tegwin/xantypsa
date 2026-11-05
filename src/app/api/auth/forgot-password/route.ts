import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createResetToken, RESET_TTL_MINUTES } from '@/lib/auth/local';
import { deliverEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// Identical whatever happens, so this cannot be used to discover which email
// addresses have accounts.
const GENERIC = {
  ok: true,
  message: 'If that address has an account, a reset link is on its way.',
};

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json(GENERIC);
  }

  const user = await prisma.user.findFirst({
    where: { email: email.trim().toLowerCase(), isActive: true },
    select: {
      id: true, email: true, name: true,
      tenants: { take: 1, select: { tenantId: true } },
    },
  });
  if (!user?.tenants[0]) return NextResponse.json(GENERIC);

  try {
    const token = await createResetToken(
      user.id,
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    );
    const base = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
    const link = `${base.replace(/\/$/, '')}/reset-password?token=${token}`;

    const reset = await deliverEmail(
      user.tenants[0].tenantId,
      user.email,
      'Reset your XantyPSA password',
      `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
         <p>Hello ${user.name},</p>
         <p>Use the link below to choose a new password.</p>
         <p style="margin:28px 0">
           <a href="${link}" style="background:#1e6af5;color:#fff;padding:12px 24px;
              text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block">
             Choose a new password
           </a>
         </p>
         <p style="color:#666;font-size:13px">
           This link works once and expires in ${RESET_TTL_MINUTES} minutes.
           If you did not request it, nothing has changed and you can ignore this email.
         </p>
       </div>`
    );
  } catch (err: any) {
    console.error('[auth] reset email failed:', err.message);
  }

  return NextResponse.json(GENERIC);
}
