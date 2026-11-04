import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;

  // Get billing mode setting
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as any) || {};
  const billingMode = settings.serviceDeskBillingMode || 'anytime';

  // Build time entry filter
  const where: any = {
    tenantId,
    billable: true,
    billed: false,
    // Labour on a contract is already paid for, and non-billable work is never
    // charged. Neither may reach an invoice.
    chargeType: { notIn: ['contract', 'non_billable'] },
  };

  // If billing mode is 'on_close', only show entries from tickets with closed statuses
  if (billingMode === 'on_close') {
    // Get all closed status slugs
    const closedStatuses = await prisma.ticketStatus.findMany({
      where: { tenantId, isClosed: true },
      select: { slug: true },
    });
    const closedSlugs = closedStatuses.length > 0
      ? closedStatuses.map(s => s.slug)
      : ['closed']; // fallback if no custom statuses
    where.ticket = { status: { in: closedSlugs } };
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      user: { select: { id: true, name: true } },
      ticket: { select: { id: true, ticketNumber: true, title: true, status: true, companyId: true, company: { select: { id: true, name: true } } } },
      billingRate: { select: { id: true, name: true, code: true } },
    },
    orderBy: { date: 'desc' },
  });

  // Group by company
  const grouped: Record<string, { company: any; entries: any[]; total: number; totalMinutes: number }> = {};

  for (const entry of entries) {
    const companyId = entry.ticket?.companyId || 'no_company';
    const companyName = entry.ticket?.company?.name || 'No Company';

    if (!grouped[companyId]) {
      grouped[companyId] = {
        company: companyId === 'no_company' ? { id: null, name: 'No Company' } : { id: companyId, name: companyName },
        entries: [],
        total: 0,
        totalMinutes: 0,
      };
    }

    grouped[companyId].entries.push(entry);
    grouped[companyId].total += entry.billedAmount || 0;
    grouped[companyId].totalMinutes += entry.minutes || 0;
  }

  // === Uninvoiced Contracts ===
  // Prepay blocks, managed service fees, and fixed-price one-offs that need billing
  const billableContracts = await prisma.contract.findMany({
    where: {
      tenantId,
      status: 'active',
      type: { in: ['prepay_hours', 'managed_service', 'fixed_price'] },
    },
    include: {
      company: { select: { id: true, name: true } },
      _count: { select: { invoices: true } },
      // Blocks not yet put on an invoice. These, not the labour, are what a
      // pre-pay contract bills.
      hourBlocks: {
        where: { invoiceId: null },
        orderBy: { createdAt: 'asc' },
      },
      // Labour the block absorbed. It is never charged again, but the customer
      // should still see the work their hours went on.
      timeEntries: {
        where: { chargeType: 'contract', billed: false },
        select: {
          id: true, hours: true, date: true, description: true,
          ticket: { select: { ticketNumber: true, title: true } },
        },
        orderBy: { date: 'asc' },
      },
    },
  });

  // Filter to contracts that haven't been invoiced yet (or recurring ones due again)
  const uninvoicedContracts = billableContracts.filter(c => {
    // A pre-pay contract is due whenever it has a block that has not been
    // billed, which covers the monthly block as well as the opening one.
    if (c.type === 'prepay_hours') return c.hourBlocks.some(b => b.amount > 0);
    if (c.type === 'fixed_price' && c.billingMode === 'one_off' && c._count.invoices === 0) return true;
    if (c.type === 'managed_service' && c._count.invoices === 0) return true; // First month
    return false;
  });

  // === Draft invoices awaiting billing ===
  // Contract recurring charges and standalone recurring invoices both land here
  // as drafts. A contract is never billed directly - this is its billing
  // mechanism - so they must be actionable the moment they are created.
  // Quotes the customer accepted that nobody converted, and completed
  // fixed-price projects. Read alongside the drafts: the database is a network
  // hop away, so these must not run one after another.
  const [draftInvoices, acceptedQuotes, completedProjects] = await Promise.all([
    prisma.invoice.findMany({
      where: { tenantId, status: 'draft' },
      include: {
        company: { select: { id: true, name: true } },
        contract: { select: { id: true, contractNumber: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.quote.findMany({
      where: { tenantId, status: 'accepted', invoice: null },
      select: {
        id: true, quoteNumber: true, title: true, total: true, currency: true, updatedAt: true,
        company: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'asc' },
    }),
    // There is no invoice-to-project link in the schema, so a project stays
    // listed once completed. Treat this section as a prompt, not a ledger.
    prisma.project.findMany({
      where: { tenantId, status: 'completed', billingMethod: 'fixed' },
      select: {
        id: true, name: true, budgetAmount: true, endDate: true,
        company: { select: { id: true, name: true } },
      },
      orderBy: { endDate: 'desc' },
      take: 100,
    }),
  ]);

  return jsonResponse({
    billingMode,
    quotes: acceptedQuotes.map(q => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      title: q.title,
      company: q.company,
      total: q.total,
      currency: q.currency,
      acceptedAt: q.updatedAt,
    })),
    quoteTotal: acceptedQuotes.reduce((s, q) => s + (q.total || 0), 0),
    projects: completedProjects.map(p => ({
      id: p.id,
      name: p.name,
      company: p.company,
      value: p.budgetAmount || 0,
      endDate: p.endDate,
    })),
    projectTotal: completedProjects.reduce((s, p) => s + (p.budgetAmount || 0), 0),
    groups: Object.values(grouped).sort((a, b) => b.total - a.total),
    totalEntries: entries.length,
    grandTotal: entries.reduce((sum, e) => sum + (e.billedAmount || 0), 0),
    draftInvoices: draftInvoices.map(inv => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      title: inv.title,
      company: inv.company,
      contract: inv.contract,
      isRecurring: inv.isRecurring,
      recurringFreq: inv.recurringFreq,
      nextRecurring: inv.nextRecurring,
      lineCount: inv._count.items,
      subtotal: inv.subtotal, // NET
      total: inv.total,
      currency: inv.currency,
      dueDate: inv.dueDate,
      source: inv.contractId ? 'contract' : 'standalone',
    })),
    draftInvoiceTotal: draftInvoices.reduce((s, i) => s + (i.total || 0), 0),
    uninvoicedContracts: uninvoicedContracts.map(c => ({
      id: c.id,
      contractNumber: c.contractNumber,
      name: c.name,
      type: c.type,
      company: c.company,
      value: c.type === 'prepay_hours'
        ? Math.round(c.hourBlocks.reduce((a, b) => a + b.amount, 0) * 100) / 100
        : c.type === 'fixed_price' ? c.fixedPrice : c.monthlyFee,
      totalHours: c.totalHours,
      coveredTime: c.type === 'prepay_hours'
        ? c.timeEntries.map(t => ({
            id: t.id,
            hours: t.hours,
            date: t.date,
            description: t.description,
            ticketNumber: t.ticket?.ticketNumber ?? null,
            ticketTitle: t.ticket?.title ?? null,
          }))
        : [],
      // Each unbilled block becomes its own invoice line: hours at the rate.
      hourBlocks: c.hourBlocks
        .filter(b => b.amount > 0)
        .map(b => ({
          id: b.id,
          source: b.source,
          hours: b.hours,
          hourlyRate: b.hourlyRate,
          amount: b.amount,
          periodStart: b.periodStart,
        })),
    })),
  });
}, 'invoices', 'read');
