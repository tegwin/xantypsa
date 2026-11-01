import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { calculateTotals, round2 } from '@/lib/billing';

function extractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/');
  const idx = segments.indexOf('contracts');
  return idx >= 0 && idx + 1 < segments.length ? segments[idx + 1] : '';
}

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const contractId = extractId(req);

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: session.user.tenantId },
    include: { items: { include: { product: { select: { id: true, name: true } } } } },
  });
  if (!contract) return errorResponse('Contract not found', 404);

  const totals = calculateTotals(contract.items);
  return jsonResponse({ items: contract.items, ...totals });
}, 'contracts', 'read');

/**
 * Replace the contract's products/services and re-derive its value.
 *
 * The contract's value is the NET total of what it bills - a contract is never
 * invoiced directly, so this is the figure the recurring invoice charges.
 */
export const PUT = withTenant(async (req: NextRequest, session: any) => {
  const contractId = extractId(req);
  const tenantId = session.user.tenantId;
  const body = await req.json();

  const contract = await prisma.contract.findFirst({ where: { id: contractId, tenantId } });
  if (!contract) return errorResponse('Contract not found', 404);

  const items = (body.items || [])
    .filter((it: any) => it.description || it.productId)
    .map((it: any) => {
      const quantity = parseFloat(it.quantity) || 1;
      const unitPrice = parseFloat(it.unitPrice) || 0;
      const taxRate = it.taxRate !== undefined && it.taxRate !== '' ? parseFloat(it.taxRate) : 20;
      // What this line costs us per unit - e.g. the wholesale price of an M365
      // seat. Feeds profitability alongside engineer time.
      const cost = it.cost !== undefined && it.cost !== '' ? parseFloat(it.cost) || 0 : 0;
      return {
        contractId,
        productId: it.productId || null,
        cost,
        description: it.description || '',
        quantity,
        unitPrice,
        taxRate,
        total: round2(quantity * unitPrice), // stored NET
        recurring: it.recurring !== false,
      };
    });

  const totals = calculateTotals(items);

  await prisma.$transaction([
    prisma.contractItem.deleteMany({ where: { contractId } }),
    ...(items.length ? [prisma.contractItem.createMany({ data: items })] : []),
    prisma.contract.update({
      where: { id: contractId },
      data: {
        // A pre-pay contract is priced by its blocks, hours times rate, so its
        // value is left alone. Every other type is priced by its items.
        ...(contract.type === 'prepay_hours' ? {} : { value: totals.subtotal }), // NET, before tax
        // Keep the type-specific headline in step so the detail page reads right.
        ...(contract.type === 'managed_service' ? { monthlyFee: totals.subtotal } : {}),
        ...(contract.type === 'fixed_price' ? { fixedPrice: totals.subtotal } : {}),
      },
    }),
  ]);

  const saved = await prisma.contractItem.findMany({
    where: { contractId },
    include: { product: { select: { id: true, name: true } } },
  });

  return jsonResponse({ items: saved, ...totals });
}, 'contracts', 'write');
