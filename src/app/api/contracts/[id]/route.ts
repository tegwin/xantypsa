import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

function extractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/');
  const idx = segments.indexOf('contracts');
  if (idx >= 0 && idx + 1 < segments.length) return segments[idx + 1];
  return segments.pop()!;
}

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const id = extractId(req);
  const contract = await prisma.contract.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      company: { select: { id: true, name: true } },
      exclusions: { include: { billingRate: { select: { id: true, name: true, code: true, rate: true } } } },
      instalments: { orderBy: { number: 'asc' } },
      tickets: {
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: { id: true, ticketNumber: true, title: true, status: true, timeSpent: true },
      },
      timeEntries: {
        where: { chargeType: 'contract' },
        orderBy: { date: 'desc' },
        take: 100,
        include: {
          user: { select: { id: true, name: true } },
          ticket: { select: { id: true, ticketNumber: true, title: true } },
          billingRate: { select: { id: true, name: true, code: true } },
        },
      },
      _count: { select: { tickets: true, invoices: true, timeEntries: true } },
    },
  });
  if (!contract) return errorResponse('Contract not found', 404);

  // Calculate hours used from time entries
  const hoursAgg = await prisma.timeEntry.aggregate({
    where: { contractId: id, chargeType: 'contract' },
    _sum: { minutes: true },
  });
  const hoursUsedCalc = (hoursAgg._sum.minutes || 0) / 60;

  return jsonResponse({ ...contract, hoursUsedCalc });
}, 'contracts', 'read');

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = extractId(req);
  const body = await req.json();
  const contract = await prisma.contract.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!contract) return errorResponse('Contract not found', 404);

  const data: any = {};
  const fields = ['name', 'status', 'description', 'notes', 'terms', 'billingCycle', 'autoRenew',
    'renewalPeriod', 'fixedPrice', 'billingMode', 'instalmentCount', 'instalmentAmount',
    'totalHours', 'overhourRate', 'alertThreshold', 'monthlyFee', 'value',
    'blockMode', 'blockHourlyRate', 'hoursPerPeriod', 'carryOver',
    'carryOverMaxHours', 'autoTopUp', 'topUpThresholdHours', 'topUpHours'];
  
  for (const f of fields) {
    if (body[f] !== undefined) data[f] = body[f];
  }

  // A form sends everything as a string. Coerce the pre-pay fields so Prisma
  // is not handed "12" where it wants a number.
  const numeric = ['blockHourlyRate', 'hoursPerPeriod', 'carryOverMaxHours',
    'topUpThresholdHours', 'topUpHours', 'totalHours', 'overhourRate', 'alertThreshold'];
  for (const f of numeric) {
    if (data[f] !== undefined) {
      data[f] = data[f] === '' || data[f] === null ? null : parseFloat(data[f]);
      if (Number.isNaN(data[f])) data[f] = null;
    }
  }
  for (const f of ['carryOver', 'autoTopUp']) {
    if (data[f] !== undefined) data[f] = !!data[f];
  }
  if (body.startDate) data.startDate = new Date(body.startDate);
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;

  // Handle exclusions update
  if (body.excludedRateIds !== undefined) {
    await prisma.contractExclusion.deleteMany({ where: { contractId: id } });
    if (body.excludedRateIds.length) {
      await prisma.contractExclusion.createMany({
        data: body.excludedRateIds.map((rateId: string) => ({
          contractId: id,
          billingRateId: rateId,
        })),
      });
    }
  }

  const updated = await prisma.contract.update({
    where: { id },
    data,
    include: {
      company: { select: { id: true, name: true } },
      exclusions: { include: { billingRate: { select: { id: true, name: true, code: true } } } },
      instalments: { orderBy: { number: 'asc' } },
    },
  });
  return jsonResponse(updated);
}, 'contracts', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = extractId(req);
  const contract = await prisma.contract.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!contract) return errorResponse('Contract not found', 404);
  await prisma.contract.delete({ where: { id } });
  return jsonResponse({ success: true });
}, 'contracts', 'write');
