import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { getNextNumber } from '@/lib/server-utils';

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  const { entryIds, companyId, contactId, title, notes, dueInDays } = body;

  if (!entryIds?.length) return errorResponse('No time entries selected');

  const tenantId = session.user.tenantId;

  // Fetch the time entries
  const entries = await prisma.timeEntry.findMany({
    where: {
      id: { in: entryIds },
      tenantId,
      billable: true,
      billed: false,
    },
    include: {
      billingRate: { select: { name: true, code: true } },
      // companyId is read below to attribute the invoice when none is supplied.
      ticket: { select: { ticketNumber: true, title: true, companyId: true } },
      user: { select: { name: true } },
    },
  });

  if (entries.length === 0) return errorResponse('No valid unbilled entries found');

  // Group entries by billing rate for line items
  const rateGroups: Record<string, { rateName: string; entries: typeof entries; totalMinutes: number; rate: number; total: number }> = {};

  for (const entry of entries) {
    const rateKey = entry.billingRateId || 'no_rate';
    const rateName = entry.billingRate?.name || 'Time Entry';

    if (!rateGroups[rateKey]) {
      rateGroups[rateKey] = { rateName, entries: [], totalMinutes: 0, rate: entry.rate || 0, total: 0 };
    }

    rateGroups[rateKey].entries.push(entry);
    rateGroups[rateKey].totalMinutes += entry.minutes || 0;
    rateGroups[rateKey].total += entry.billedAmount || 0;
  }

  // Get tenant tax rate
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { taxRate: true },
  });
  const taxRate = tenant?.taxRate ?? 20;

  // Build line items from rate groups
  const lineItems = Object.values(rateGroups).map((group, i) => {
    const hours = parseFloat((group.totalMinutes / 60).toFixed(2));
    // Build description with ticket references
    const ticketRefs = group.entries
      .filter(e => e.ticket)
      .map(e => `#${e.ticket!.ticketNumber} ${e.ticket!.title}`)
      .filter((v, idx, arr) => arr.indexOf(v) === idx) // unique
      .join(', ');

    const description = `${group.rateName} - ${hours}h` + (ticketRefs ? `\n${ticketRefs}` : '');

    return {
      description,
      quantity: hours,
      unitPrice: group.rate,
      taxRate,
      total: group.total * (1 + taxRate / 100),
      sortOrder: i,
    };
  });

  const subtotal = lineItems.reduce((s, li) => s + (li.quantity * li.unitPrice), 0);
  const taxTotal = subtotal * (taxRate / 100);
  const total = subtotal + taxTotal;

  const invoiceNumber = await getNextNumber(tenantId, 'invoice');
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (dueInDays || 30));

  // Create invoice
  const invoice = await prisma.invoice.create({
    data: {
      tenantId,
      invoiceNumber,
      title: title || `Time & Materials - ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`,
      companyId: companyId || entries[0]?.ticket?.companyId || null,
      contactId: contactId || null,
      createdById: session.user.id,
      dueDate,
      notes: notes || null,
      subtotal,
      taxTotal,
      total,
      amountDue: total,
      items: { create: lineItems },
    },
    include: { items: true, company: { select: { name: true } } },
  });

  // Mark all time entries as billed
  await prisma.timeEntry.updateMany({
    where: { id: { in: entryIds } },
    data: { billed: true },
  });

  return jsonResponse(invoice, 201);
}, 'invoices', 'write');
