import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse, parseSearchParams } from '@/lib/api';
import { getNextNumber } from '@/lib/server-utils';
import { calculateTotals, round2 } from '@/lib/billing';
import { createRecurringInvoiceForContract } from '@/lib/contract-billing';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const p = parseSearchParams(req.url);
  const tenantId = session.user.tenantId;

  const where: any = { tenantId };
  if (p.search) {
    where.OR = [
      { name: { contains: p.search, mode: 'insensitive' } },
      { contractNumber: { contains: p.search, mode: 'insensitive' } },
    ];
  }
  if (p.status) where.status = p.status;
  if (p.type) where.type = p.type;
  if (p.companyId) where.companyId = p.companyId;

  const [items, total] = await Promise.all([
    prisma.contract.findMany({
      where, skip: p.skip, take: p.limit,
      orderBy: { [p.sortBy]: p.sortDir },
      include: {
        company: { select: { id: true, name: true } },
        exclusions: { include: { billingRate: { select: { id: true, name: true, code: true } } } },
        _count: { select: { tickets: true, invoices: true, timeEntries: true, instalments: true } },
      },
    }),
    prisma.contract.count({ where }),
  ]);

  return jsonResponse({ items, total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) });
}, 'contracts', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.name || !body.companyId) return errorResponse('Contract name and company are required');

  const tenantId = session.user.tenantId;
  const contractNumber = await getNextNumber(tenantId, 'contract');

  // Build contract data based on type
  const data: any = {
    tenantId,
    contractNumber,
    name: body.name,
    companyId: body.companyId,
    type: body.type || 'time_and_materials',
    status: body.status || 'draft',
    startDate: body.startDate ? new Date(body.startDate) : new Date(),
    endDate: body.endDate ? new Date(body.endDate) : null,
    autoRenew: body.autoRenew || false,
    renewalPeriod: body.renewalPeriod ? parseInt(body.renewalPeriod) : null,
    billingCycle: body.billingCycle || 'monthly',
    description: body.description || null,
    terms: body.terms || null,
    notes: body.notes || null,
  };

  // Type-specific fields
  switch (body.type) {
    case 'fixed_price':
      data.fixedPrice = parseFloat(body.fixedPrice) || 0;
      data.value = data.fixedPrice;
      data.billingMode = body.billingMode || 'one_off';
      if (body.billingMode === 'instalment') {
        data.instalmentCount = parseInt(body.instalmentCount) || 1;
        data.instalmentAmount = data.fixedPrice / data.instalmentCount;
      }
      break;
    case 'prepay_hours': {
      data.blockMode = body.blockMode === 'monthly' ? 'monthly' : 'one_off';
      data.blockHourlyRate = body.blockHourlyRate ? parseFloat(body.blockHourlyRate) : null;
      data.overhourRate = body.overhourRate ? parseFloat(body.overhourRate) : null;
      data.alertThreshold = body.alertThreshold ? parseFloat(body.alertThreshold) : 80;

      data.carryOver = !!body.carryOver;
      data.carryOverMaxHours = body.carryOverMaxHours ? parseFloat(body.carryOverMaxHours) : null;
      data.autoTopUp = !!body.autoTopUp;
      data.topUpThresholdHours = body.topUpThresholdHours ? parseFloat(body.topUpThresholdHours) : null;
      data.topUpHours = body.topUpHours ? parseFloat(body.topUpHours) : null;

      // A block is simply a number of hours at a rate. 10 hours at 250 is a
      // 2,500 block: the hours stay 10.
      const rate = data.blockHourlyRate ?? 0;

      if (data.blockMode === 'monthly') {
        data.hoursPerPeriod = parseFloat(body.hoursPerPeriod) || 0;
        // A monthly contract is worth a period at a time. The opening block is
        // raised by the scheduled job, not here.
        data.totalHours = 0;
        data.value = parseFloat(body.value) || Math.round(data.hoursPerPeriod * rate * 100) / 100;
      } else {
        data.totalHours = parseFloat(body.totalHours) || 0;
        data.value = parseFloat(body.value) || Math.round(data.totalHours * rate * 100) / 100;
      }
      break;
    }
    case 'managed_service':
      data.monthlyFee = parseFloat(body.monthlyFee) || 0;
      data.value = data.monthlyFee;
      break;
    default: // time_and_materials
      data.value = 0;
  }

  // Line items (products/services) define what the contract actually charges.
  // Their NET total becomes the contract value for every type, overriding the
  // type-specific defaults above - a contract with items is priced by its items.
  const contractItems = (body.items || [])
    .filter((it: any) => it.description || it.productId)
    .map((it: any) => {
      const quantity = parseFloat(it.quantity) || 1;
      const unitPrice = parseFloat(it.unitPrice) || 0;
      const taxRate = it.taxRate !== undefined && it.taxRate !== '' ? parseFloat(it.taxRate) : 20;
      return {
        productId: it.productId || null,
        cost: it.cost !== undefined && it.cost !== '' ? parseFloat(it.cost) || 0 : 0,
        description: it.description || '',
        quantity,
        unitPrice,
        taxRate,
        total: round2(quantity * unitPrice), // stored NET
        recurring: it.recurring !== false,
      };
    });

  if (contractItems.length > 0) {
    // A pre-pay contract is priced by its blocks: hours times rate. Letting an
    // item overwrite that would bill the customer the wrong figure.
    if (body.type !== 'prepay_hours') {
      data.value = calculateTotals(contractItems).subtotal; // NET, before tax
    }
    data.items = { create: contractItems };
  }

  const contract = await prisma.contract.create({
    data,
    include: { company: { select: { name: true } }, items: true },
  });

  // Create exclusions if provided
  if (body.excludedRateIds?.length) {
    await prisma.contractExclusion.createMany({
      data: body.excludedRateIds.map((rateId: string) => ({
        contractId: contract.id,
        billingRateId: rateId,
      })),
    });
  }

  // Create instalment schedule for fixed_price instalment contracts
  if (body.type === 'fixed_price' && body.billingMode === 'instalment' && data.instalmentCount > 1) {
    // Use custom milestone details if provided, otherwise auto-generate
    if (body.milestoneDetails?.length > 0) {
      const instalments = body.milestoneDetails.map((ms: any) => ({
        contractId: contract.id,
        number: ms.number,
        description: ms.description || null,
        amount: ms.amount || data.instalmentAmount,
        dueDate: new Date(ms.dueDate),
      }));
      await prisma.contractInstalment.createMany({ data: instalments });
    } else {
      const instalments = [];
      const startDate = new Date(data.startDate);
      for (let i = 0; i < data.instalmentCount; i++) {
        const dueDate = new Date(startDate);
        if (body.billingCycle === 'monthly') dueDate.setMonth(dueDate.getMonth() + i);
        else if (body.billingCycle === 'quarterly') dueDate.setMonth(dueDate.getMonth() + i * 3);
        else dueDate.setMonth(dueDate.getMonth() + i);

        instalments.push({
          contractId: contract.id,
          number: i + 1,
          amount: data.instalmentAmount,
          dueDate,
        });
      }
      await prisma.contractInstalment.createMany({ data: instalments });
    }
  }

  // Optionally raise the recurring invoice straight away, so the contract has a
  // billing mechanism from the moment it exists and shows in Ready to Bill.
  let invoice = null;
  if (body.createInvoice) {
    invoice = await createRecurringInvoiceForContract({
      tenantId,
      contractId: contract.id,
      userId: session.user.id,
      paymentTerms: body.paymentTerms,
    });
  }

  return jsonResponse({ ...contract, invoice }, 201);
}, 'contracts', 'write');
