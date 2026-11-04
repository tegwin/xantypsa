import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { dispatchWebhookEvent } from '@/lib/webhooks';
import { normaliseDomains } from '@/lib/emailRouting';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const company = await prisma.company.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      contacts: {
        where: { isActive: true },
        orderBy: { firstName: 'asc' },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, jobTitle: true, isActive: true },
      },
      sites: {
        orderBy: { isDefault: 'desc' },
      },
      tickets: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, ticketNumber: true, title: true, status: true, priority: true, createdAt: true },
      },
      contracts: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, contractNumber: true, name: true, type: true, status: true, startDate: true, endDate: true, value: true },
      },
      opportunities: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, title: true, value: true, stage: true, probability: true, expectedClose: true, createdAt: true },
      },
      quotes: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, quoteNumber: true, title: true, status: true, total: true, createdAt: true },
      },
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, invoiceNumber: true, title: true, status: true, total: true, amountDue: true, dueDate: true },
      },
      _count: {
        select: { contacts: true, tickets: true, contracts: true, quotes: true, invoices: true, opportunities: true },
      },
    },
  });
  if (!company) return errorResponse('Company not found', 404);
  return jsonResponse(company);
}, 'crm', 'read');

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const company = await prisma.company.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!company) return errorResponse('Company not found', 404);

  const updated = await prisma.company.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.website !== undefined && { website: body.website }),
      ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
      // Domains that route incoming email to this client. Normalised so
      // "@Acme.COM " and "acme.com" cannot both be stored and only one match.
      ...(body.emailDomains !== undefined && { emailDomains: normaliseDomains(body.emailDomains) }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.address1 !== undefined && { address1: body.address1 }),
      ...(body.address2 !== undefined && { address2: body.address2 }),
      ...(body.address3 !== undefined && { address3: body.address3 }),
      ...(body.city !== undefined && { city: body.city }),
      ...(body.state !== undefined && { state: body.state }),
      ...(body.postcode !== undefined && { postcode: body.postcode }),
      ...(body.country !== undefined && { country: body.country }),
      ...(body.industry !== undefined && { industry: body.industry }),
      // Portal: whether it is on, its address, and how it is branded.
      ...(body.portalEnabled !== undefined && { portalEnabled: !!body.portalEnabled }),
      ...(body.portalSlug !== undefined && {
        // Lowercase and URL-safe, since it becomes /portal/<slug>.
        portalSlug: body.portalSlug
          ? String(body.portalSlug).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
          : null,
      }),
      ...(body.portalLogoUrl !== undefined && { portalLogoUrl: body.portalLogoUrl || null }),
      ...(body.portalAccent !== undefined && { portalAccent: body.portalAccent || null }),
      ...(body.portalWelcome !== undefined && { portalWelcome: body.portalWelcome || null }),
      ...(body.size !== undefined && { size: body.size }),
      ...(body.taxId !== undefined && { taxId: body.taxId }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.customData !== undefined && { customData: body.customData }),
    },
  });

  dispatchWebhookEvent(session.user.tenantId, 'company.updated', updated);

  return jsonResponse(updated);
}, 'crm', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const company = await prisma.company.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!company) return errorResponse('Company not found', 404);

  // The catch-all and the MSP's own company underpin email routing - deleting
  // either would silently drop incoming mail from unknown senders.
  if (company.isSystem) {
    return errorResponse(
      company.isCatchAll
        ? 'The catch-all company cannot be deleted - incoming email from unrecognised senders is filed against it.'
        : 'Your own organisation cannot be deleted. Rename it instead if the name is wrong.',
      400
    );
  }

  await prisma.company.delete({ where: { id } });

  dispatchWebhookEvent(session.user.tenantId, 'company.deleted', { id, name: company.name });

  return jsonResponse({ success: true });
}, 'crm', 'delete');
