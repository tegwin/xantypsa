import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse } from '@/lib/api';

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
    // Exclude entries covered by contracts (only show T&M and excluded-from-contract entries)
    chargeType: { not: 'contract' },
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
    },
  });

  // Filter to contracts that haven't been invoiced yet (or recurring ones due again)
  const uninvoicedContracts = billableContracts.filter(c => {
    if (c.type === 'prepay_hours' && c._count.invoices === 0) return true; // Block never invoiced
    if (c.type === 'fixed_price' && c.billingMode === 'one_off' && c._count.invoices === 0) return true;
    if (c.type === 'managed_service' && c._count.invoices === 0) return true; // First month
    return false;
  });

  // === Draft invoices awaiting billing ===
  // Contract recurring charges and standalone recurring invoices both land here
  // as drafts. A contract is never billed directly - this is its billing
  // mechanism - so they must be actionable the moment they are created.
  const draftInvoices = await prisma.invoice.findMany({
    where: { tenantId, status: 'draft' },
    include: {
      company: { select: { id: true, name: true } },
      contract: { select: { id: true, contractNumber: true, name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return jsonResponse({
    billingMode,
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
      value: c.type === 'prepay_hours' ? c.value : c.type === 'fixed_price' ? c.fixedPrice : c.monthlyFee,
      totalHours: c.totalHours,
    })),
  });
}, 'invoices', 'read');
