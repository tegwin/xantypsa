// ============================================================
// POST /api/webhooks/payments/<publicId> - a payment provider calls this
// ============================================================
// Unauthenticated in the session sense: the caller is a payment provider, not
// a signed-in user. It proves itself with the shared secret, so every path out
// of here is careful about what it reveals.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { recordPayment } from '@/lib/payments';

export const dynamic = 'force-dynamic';

/** Constant-time compare, so a wrong secret cannot be guessed by timing. */
function secretMatches(provided: string, expectedHash: string): boolean {
  const providedHash = crypto.createHash('sha256').update(provided).digest();
  const expected = Buffer.from(expectedHash, 'hex');
  if (providedHash.length !== expected.length) return false;
  return crypto.timingSafeEqual(providedHash, expected);
}

export async function POST(req: NextRequest) {
  const segments = req.nextUrl.pathname.split('/');
  const publicId = segments[segments.length - 1];

  const hook = await prisma.paymentWebhook.findUnique({
    where: { publicId },
    select: { id: true, tenantId: true, secretHash: true, isActive: true, provider: true },
  });

  // The same answer whether the endpoint is unknown, switched off, or the
  // secret is wrong: a caller who cannot authenticate learns nothing.
  const secret = req.headers.get('x-webhook-secret') ?? '';
  if (!hook || !hook.isActive || !secret || !secretMatches(secret, hook.secretHash)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    await log(hook, {}, false, 'Body was not JSON');
    return NextResponse.json({ error: 'Expected a JSON body' }, { status: 400 });
  }

  const { invoiceNumber, invoiceId, amount, reference, paidAt, method } = payload as any;
  const value = Number(amount);

  if (!invoiceNumber && !invoiceId) {
    await log(hook, payload, false, 'Neither invoiceNumber nor invoiceId was given');
    return NextResponse.json({ error: 'Give either invoiceNumber or invoiceId' }, { status: 400 });
  }
  if (!Number.isFinite(value) || value <= 0) {
    await log(hook, payload, false, `Amount was not a positive number: ${amount}`);
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }

  // Scoped to the endpoint's own tenant, so one customer's webhook can never
  // settle another customer's invoice.
  const invoice = await prisma.invoice.findFirst({
    where: {
      tenantId: hook.tenantId,
      ...(invoiceId ? { id: String(invoiceId) } : { invoiceNumber: String(invoiceNumber) }),
    },
    select: { id: true, invoiceNumber: true },
  });

  if (!invoice) {
    const wanted = invoiceId ?? invoiceNumber;
    await log(hook, payload, false, `No invoice ${wanted}`);
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  // A provider that retries must not pay the invoice twice, so a reference we
  // have already recorded is accepted and ignored.
  if (reference) {
    const seen = await prisma.payment.findFirst({
      where: { tenantId: hook.tenantId, invoiceId: invoice.id, reference: String(reference) },
      select: { id: true },
    });
    if (seen) {
      await log(hook, payload, true, `Already recorded, reference ${reference}`, invoice.id, value);
      return NextResponse.json({ ok: true, duplicate: true, paymentId: seen.id });
    }
  }

  try {
    const { invoice: updated } = await recordPayment({
      tenantId: hook.tenantId,
      invoiceId: invoice.id,
      amount: value,
      method: method || hook.provider,
      reference: reference ? String(reference) : null,
      paidAt: paidAt ? new Date(paidAt) : undefined,
    });

    await log(hook, payload, true, `Paid ${value} against ${updated.invoiceNumber}`, invoice.id, value);
    await prisma.paymentWebhook.update({
      where: { id: hook.id },
      data: { lastReceivedAt: new Date() },
    });

    return NextResponse.json({
      ok: true,
      invoiceNumber: updated.invoiceNumber,
      status: updated.status,
      amountPaid: updated.amountPaid,
      amountDue: updated.amountDue,
    });
  } catch (err: any) {
    await log(hook, payload, false, err.message ?? 'Failed', invoice.id, value);
    return NextResponse.json({ error: 'Could not record the payment' }, { status: 500 });
  }
}

/** Every call is logged, accepted or not: otherwise this is undebuggable. */
async function log(
  hook: { id: string; tenantId: string },
  payload: unknown,
  success: boolean,
  message: string,
  invoiceId?: string,
  amount?: number
) {
  await prisma.paymentWebhookEvent.create({
    data: {
      tenantId: hook.tenantId,
      webhookId: hook.id,
      payload: (payload ?? {}) as any,
      success,
      message,
      invoiceId: invoiceId ?? null,
      amount: amount ?? null,
    },
  }).catch(() => { /* Logging must never break the response. */ });
}
