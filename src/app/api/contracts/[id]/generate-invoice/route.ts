import { NextRequest } from 'next/server';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { createRecurringInvoiceForContract } from '@/lib/contract-billing';

function extractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/');
  const idx = segments.indexOf('contracts');
  if (idx >= 0 && idx + 1 < segments.length) return segments[idx + 1];
  return segments[segments.length - 2] || '';
}

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const contractId = extractId(req);

  try {
    const invoice = await createRecurringInvoiceForContract({
      tenantId: session.user.tenantId,
      contractId,
      userId: session.user.id,
    });
    return jsonResponse(invoice, 201);
  } catch (err: any) {
    if (err.message === 'Contract not found') return errorResponse('Contract not found', 404);
    // Nothing left to bill is a normal answer, not a fault.
    if (err.message?.includes('already been invoiced')) return errorResponse(err.message, 409);
    throw err;
  }
}, 'contracts', 'write');
