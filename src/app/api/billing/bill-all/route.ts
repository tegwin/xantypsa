// ============================================================
// POST /api/billing/bill-all - invoice everything that is ready
// ============================================================
// The whole point is not having to bill each kind of work by hand, so this
// takes everything the Ready for Invoicing screen shows and turns it into
// invoices in one go.
//
// mode: 'combined' puts everything for a customer on one invoice.
//       'separate'  gives each piece of work its own invoice.

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { getNextNumber } from '@/lib/server-utils';
import { gatherReadyWork } from '@/lib/billing/sources';

export const dynamic = 'force-dynamic';

interface Line {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
  sortOrder: number;
}

/** What a single invoice will be made of, and what to mark once it exists. */
interface Pending {
  companyId: string | null;
  title: string;
  lines: Line[];
  quoteId?: string;
  contractId?: string;
  projectId?: string;
  timeEntryIds: string[];
  hourBlockIds: string[];
}

const round = (n: number) => Math.round(n * 100) / 100;

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const { mode, dueInDays } = await req.json().catch(() => ({}));
  if (mode !== 'combined' && mode !== 'separate') {
    return errorResponse("mode must be 'combined' or 'separate'", 400);
  }

  const tenantId = session.user.tenantId;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { taxRate: true },
  });
  const taxRate = tenant?.taxRate ?? 20;

  const work = await gatherReadyWork(tenantId);
  const pending: Pending[] = [];
  // Work that cannot be billed as it stands, reported rather than swallowed.
  const unpriced: { company: string; hours: number; entries: number }[] = [];

  // --- Quotes: the quote's own lines, minus anything optional ---
  for (const quote of work.quotes) {
    const lines = quote.items
      .filter((i) => !i.isOptional)
      .map((i, idx) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxRate: i.taxRate,
        total: i.total,
        sortOrder: idx,
      }));
    if (lines.length === 0) continue;
    pending.push({
      companyId: quote.companyId, title: quote.title || `Quote ${quote.quoteNumber}`,
      lines, quoteId: quote.id, timeEntryIds: [], hourBlockIds: [],
    });
  }

  // --- Prepay blocks: one line per block, hours at the rate it was sold at ---
  for (const contract of work.blockContracts) {
    const blocks = contract.hourBlocks.filter((b) => b.amount > 0);
    if (blocks.length === 0) continue;
    pending.push({
      companyId: contract.companyId,
      title: `${contract.name} - prepaid hours`,
      lines: blocks.map((b, idx) => ({
        description: `${b.hours} hours at ${b.hourlyRate ?? 0}`,
        quantity: b.hours,
        unitPrice: b.hourlyRate ?? 0,
        taxRate,
        total: round(b.amount),
        sortOrder: idx,
      })),
      contractId: contract.id,
      timeEntryIds: [],
      hourBlockIds: blocks.map((b) => b.id),
    });
  }

  // --- Monthly and fixed-price contracts: their recurring lines ---
  for (const contract of work.productContracts) {
    const lines = contract.items.length > 0
      ? contract.items.map((i, idx) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          taxRate: i.taxRate,
          total: round(i.total || i.quantity * i.unitPrice),
          sortOrder: idx,
        }))
      // A contract with no itemised lines still bills its headline figure.
      : [{
          description: contract.name,
          quantity: 1,
          unitPrice: round(contract.monthlyFee || contract.fixedPrice || contract.value || 0),
          taxRate,
          total: round(contract.monthlyFee || contract.fixedPrice || contract.value || 0),
          sortOrder: 0,
        }];
    if (lines.every((l) => l.unitPrice === 0)) continue;
    pending.push({
      companyId: contract.companyId, title: contract.name, lines,
      contractId: contract.id, timeEntryIds: [], hourBlockIds: [],
    });
  }

  // --- Completed fixed-price projects ---
  for (const project of work.projects) {
    const value = round(project.budgetAmount || 0);
    if (value <= 0) continue;
    pending.push({
      companyId: project.companyId,
      title: project.name,
      lines: [{ description: project.name, quantity: 1, unitPrice: value, taxRate, total: value, sortOrder: 0 }],
      projectId: project.id,
      timeEntryIds: [],
      hourBlockIds: [],
    });
  }

  // --- Labour: grouped per company, then per rate, as the single-company
  //     flow already does. Individual time entries never become invoices of
  //     their own, in either mode: nobody wants one invoice per hour logged.
  const labourByCompany = new Map<string, typeof work.labour>();
  for (const entry of work.labour) {
    const companyId = entry.ticket?.companyId ?? entry.project?.companyId ?? null;
    const key = companyId ?? '__none__';
    labourByCompany.set(key, [...(labourByCompany.get(key) ?? []), entry]);
  }

  for (const [key, entries] of labourByCompany) {
    const rates = new Map<string, { name: string; minutes: number; rate: number; total: number; refs: Set<string> }>();
    for (const e of entries) {
      const k = e.billingRateId || 'no_rate';
      const g = rates.get(k) ?? { name: e.billingRate?.name || 'Time', minutes: 0, rate: e.rate || 0, total: 0, refs: new Set<string>() };
      g.minutes += e.minutes || 0;
      g.total += e.billedAmount || 0;
      if (e.ticket) g.refs.add(`#${e.ticket.ticketNumber} ${e.ticket.title}`);
      rates.set(k, g);
    }

    const lines = [...rates.values()].map((g, idx) => {
      const hours = Number((g.minutes / 60).toFixed(2));
      return {
        description: `${g.name} - ${hours}h` + (g.refs.size ? `\n${[...g.refs].join(', ')}` : ''),
        quantity: hours,
        unitPrice: g.rate,
        taxRate,
        total: round(g.total),
        sortOrder: idx,
      };
    }).filter((l) => l.quantity > 0);

    if (lines.length === 0) continue;
    // Time logged with no rate would otherwise become a zero invoice and be
    // marked billed, quietly burying work that still needs pricing. Leave it
    // on the list and say so instead.
    if (lines.every((l) => l.unitPrice === 0)) {
      unpriced.push({
        company: entries[0]?.ticket?.companyId ?? 'No company',
        hours: Number((lines.reduce((t, l) => t + l.quantity, 0)).toFixed(2)),
        entries: entries.length,
      });
      continue;
    }
    pending.push({
      companyId: key === '__none__' ? null : key,
      title: `Time and materials - ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`,
      lines,
      timeEntryIds: entries.map((e) => e.id),
      hourBlockIds: [],
    });
  }

  if (pending.length === 0) {
    return errorResponse(
      unpriced.length
        ? 'Nothing could be billed: the only time waiting has no rate set against it.'
        : 'There is nothing ready to invoice',
      400
    );
  }

  // In combined mode everything for one customer becomes a single invoice.
  // A quote carries a unique link to its invoice, so a combined invoice can
  // only claim one of them; the rest stay listed and are said so in the reply.
  const batches: Pending[][] = mode === 'separate'
    ? pending.map((p) => [p])
    : [...pending.reduce((map, p) => {
        const key = p.companyId ?? '__none__';
        return map.set(key, [...(map.get(key) ?? []), p]);
      }, new Map<string, Pending[]>()).values()];

  const created: any[] = [];
  const deferred: string[] = [];

  for (const batch of batches) {
    const quoteCarriers = batch.filter((p) => p.quoteId);
    // Keep the first quote on this invoice; the others wait for the next run.
    const usable = batch.filter((p) => !p.quoteId || p === quoteCarriers[0]);
    for (const skipped of quoteCarriers.slice(1)) deferred.push(skipped.title);

    const lines = usable.flatMap((p) => p.lines).map((l, idx) => ({ ...l, sortOrder: idx }));
    if (lines.length === 0) continue;

    const subtotal = round(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
    const taxTotal = round(lines.reduce((s, l) => s + l.quantity * l.unitPrice * (l.taxRate / 100), 0));
    const total = round(subtotal + taxTotal);
    if (total <= 0) continue;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (Number(dueInDays) || 30));

    const invoiceNumber = await getNextNumber(tenantId, 'invoice');
    const title = usable.length === 1
      ? usable[0].title
      : `Billing - ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;

    // One transaction per invoice: either it exists and its work is marked
    // billed, or neither happened. A half-applied batch would double-bill on
    // the next run.
    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          tenantId,
          invoiceNumber,
          title,
          status: 'draft',
          companyId: usable.find((p) => p.companyId)?.companyId ?? null,
          createdById: session.user.id,
          quoteId: usable.find((p) => p.quoteId)?.quoteId ?? null,
          contractId: usable.find((p) => p.contractId)?.contractId ?? null,
          projectId: usable.find((p) => p.projectId)?.projectId ?? null,
          issueDate: new Date(),
          dueDate,
          subtotal,
          taxTotal,
          total,
          amountDue: total,
          items: { create: lines },
        },
        include: { company: { select: { name: true } } },
      });

      const entryIds = usable.flatMap((p) => p.timeEntryIds);
      if (entryIds.length > 0) {
        await tx.timeEntry.updateMany({ where: { id: { in: entryIds }, tenantId }, data: { billed: true } });
      }
      const blockIds = usable.flatMap((p) => p.hourBlockIds);
      if (blockIds.length > 0) {
        await tx.contractHourBlock.updateMany({ where: { id: { in: blockIds }, tenantId }, data: { invoiceId: inv.id } });
      }
      return inv;
    });

    created.push({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      company: invoice.company?.name ?? 'No company',
      total: invoice.total,
    });
  }

  return jsonResponse({
    created,
    count: created.length,
    deferred,
    unpriced,
    total: round(created.reduce((s, i) => s + i.total, 0)),
  }, 201);
}, 'invoices', 'write');
