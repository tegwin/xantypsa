import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { blockBalance, refreshContractTotals } from '@/lib/prepay';
import { round2 } from '@/lib/billing';

function contractIdFrom(req: NextRequest) {
  const parts = req.nextUrl.pathname.split('/');
  return parts[parts.length - 2];
}

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const contractId = contractIdFrom(req);
  const tenantId = session.user.tenantId;

  const blocks = await prisma.contractHourBlock.findMany({
    where: { contractId, tenantId },
    orderBy: [{ createdAt: 'desc' }],
  });

  return jsonResponse({
    items: blocks,
    balance: await blockBalance(contractId, tenantId),
  });
}, 'invoices', 'read');

/**
 * Raise a block by hand: the one-off block a contract is sold with, or an
 * ad-hoc top-up the customer has asked for.
 */
export const POST = withTenant(async (req: NextRequest, session: any) => {
  const contractId = contractIdFrom(req);
  const tenantId = session.user.tenantId;
  const body = await req.json();

  const contract = await prisma.contract.findFirst({ where: { id: contractId, tenantId } });
  if (!contract) return errorResponse('Contract not found', 404);
  if (contract.type !== 'prepay_hours') {
    return errorResponse('Only a pre-pay hours contract has blocks');
  }

  const hours = parseFloat(body.hours);
  if (!hours || hours <= 0) return errorResponse('Hours must be more than zero');

  const hourlyRate = body.hourlyRate !== undefined
    ? parseFloat(body.hourlyRate)
    : (contract.blockHourlyRate ?? 0);

  const block = await prisma.contractHourBlock.create({
    data: {
      tenantId,
      contractId,
      source: body.source === 'top_up' ? 'top_up' : 'one_off',
      hours,
      hourlyRate,
      amount: round2(hours * hourlyRate),
    },
  });

  await refreshContractTotals(contractId, tenantId);
  return jsonResponse(block, 201);
}, 'invoices', 'write');

/**
 * Mark blocks as billed, so the same hours cannot be invoiced twice.
 */
export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const contractId = contractIdFrom(req);
  const tenantId = session.user.tenantId;
  const body = await req.json();

  if (!Array.isArray(body.blockIds) || body.blockIds.length === 0) {
    return errorResponse('blockIds is required');
  }

  const result = await prisma.contractHourBlock.updateMany({
    // Scoped by contract and tenant, so a block id alone cannot reach another
    // tenant's data.
    where: { id: { in: body.blockIds }, contractId, tenantId },
    data: { invoiceId: body.invoiceId || null },
  });

  return jsonResponse({ updated: result.count });
}, 'invoices', 'write');
