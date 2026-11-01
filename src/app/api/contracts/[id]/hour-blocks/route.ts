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
      note: body.note || null,
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


/**
 * Correct one block: its hours, its rate or its note.
 *
 * A block already on an invoice is left alone. Changing what was billed after
 * the fact would put the invoice and the contract out of step.
 */
export const PUT = withTenant(async (req: NextRequest, session: any) => {
  const contractId = contractIdFrom(req);
  const tenantId = session.user.tenantId;
  const body = await req.json();

  if (!body.blockId) return errorResponse('blockId is required');

  const block = await prisma.contractHourBlock.findFirst({
    where: { id: body.blockId, contractId, tenantId },
  });
  if (!block) return errorResponse('Block not found', 404);
  if (block.invoiceId) {
    return errorResponse('This block has been invoiced, so it can no longer be changed', 409);
  }

  const hours = body.hours !== undefined ? parseFloat(body.hours) : block.hours;
  const hourlyRate = body.hourlyRate !== undefined ? parseFloat(body.hourlyRate) : (block.hourlyRate ?? 0);

  if (!hours || hours <= 0) return errorResponse('Hours must be more than zero');
  if (hours < block.hoursUsed) {
    return errorResponse(
      `${block.hoursUsed}h have already been used from this block, so it cannot be reduced below that`,
      400,
    );
  }

  const updated = await prisma.contractHourBlock.update({
    where: { id: block.id },
    data: {
      hours,
      hourlyRate,
      amount: round2(hours * hourlyRate),
      ...(body.note !== undefined && { note: body.note || null }),
    },
  });

  await refreshContractTotals(contractId, tenantId);
  return jsonResponse(updated);
}, 'invoices', 'write');

/**
 * Remove a block that was added by mistake. Only while it is unbilled and
 * nothing has been drawn from it.
 */
export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const contractId = contractIdFrom(req);
  const tenantId = session.user.tenantId;
  const blockId = req.nextUrl.searchParams.get('blockId');

  if (!blockId) return errorResponse('blockId is required');

  const block = await prisma.contractHourBlock.findFirst({
    where: { id: blockId, contractId, tenantId },
  });
  if (!block) return errorResponse('Block not found', 404);
  if (block.invoiceId) return errorResponse('This block has been invoiced and cannot be removed', 409);
  if (block.hoursUsed > 0) {
    return errorResponse(`${block.hoursUsed}h have been used from this block, so it cannot be removed`, 409);
  }

  await prisma.contractHourBlock.delete({ where: { id: block.id } });
  await refreshContractTotals(contractId, tenantId);
  return jsonResponse({ deleted: true });
}, 'invoices', 'write');
