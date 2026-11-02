import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { contactDependencies, describeDependencies } from '@/lib/inUse';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const contact = await prisma.contact.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      company: { select: { id: true, name: true, type: true, portalEnabled: true, portalSlug: true } },
      opportunities: {
        orderBy: { createdAt: 'desc' }, take: 20,
        select: { id: true, opportunityNumber: true, title: true, stage: true, value: true },
      },
      quotes: {
        orderBy: { createdAt: 'desc' }, take: 20,
        select: { id: true, quoteNumber: true, title: true, status: true, total: true },
      },
      tickets: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, ticketNumber: true, title: true, status: true, priority: true, createdAt: true },
      },
      _count: { select: { tickets: true, opportunities: true, quotes: true } },
    },
  });
  if (!contact) return errorResponse('Contact not found', 404);
  return jsonResponse(contact);
}, 'crm', 'read');

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const contact = await prisma.contact.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!contact) return errorResponse('Contact not found', 404);

  const updated = await prisma.contact.update({
    where: { id },
    data: {
      ...(body.firstName !== undefined && { firstName: body.firstName }),
      ...(body.lastName !== undefined && { lastName: body.lastName }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.mobile !== undefined && { mobile: body.mobile }),
      ...(body.customData !== undefined && { customData: body.customData }),
      ...(body.jobTitle !== undefined && { jobTitle: body.jobTitle }),
      ...(body.department !== undefined && { department: body.department }),
      ...(body.companyId !== undefined && { companyId: body.companyId || null }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      // Portal access is granted per person, not implied by being a contact.
      ...(body.portalEnabled !== undefined && { portalEnabled: !!body.portalEnabled }),
    },
  });
  return jsonResponse(updated);
}, 'crm', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const contact = await prisma.contact.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!contact) return errorResponse('Contact not found', 404);

  // Nothing that real work points at may be deleted.
  const blocked = describeDependencies('contact', await contactDependencies(id, session.user.tenantId));
  if (blocked) return errorResponse(blocked, 409);

  await prisma.contact.delete({ where: { id } });
  return jsonResponse({ success: true });
}, 'crm', 'delete');
