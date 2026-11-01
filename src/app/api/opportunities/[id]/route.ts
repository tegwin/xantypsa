import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { opportunityDependencies, describeDependencies } from '@/lib/inUse';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const opportunity = await prisma.opportunity.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      company: { select: { id: true, name: true, type: true } },
      contact: { select: { id: true, firstName: true, lastName: true, email: true } },
      owner: { select: { id: true, name: true } },
      quotes: { select: { id: true, title: true, quoteNumber: true, status: true, total: true } },
      reason: { select: { id: true, name: true, type: true } },
      tickets: {
        select: { id: true, ticketNumber: true, title: true, status: true, priority: true },
        orderBy: { createdAt: 'desc' },
      },
      opportunityNotes: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!opportunity) return errorResponse('Opportunity not found', 404);

  // Nothing that real work points at may be deleted.
  const blocked = describeDependencies('opportunity', await opportunityDependencies(id, session.user.tenantId));
  if (blocked) return errorResponse(blocked, 409);
  return jsonResponse(opportunity);
}, 'crm', 'read');

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const opportunity = await prisma.opportunity.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!opportunity) return errorResponse('Opportunity not found', 404);

  const updated = await prisma.opportunity.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.value !== undefined && { value: body.value }),
      ...(body.probability !== undefined && { probability: body.probability }),
      ...(body.stage !== undefined && { stage: body.stage }),
      ...(body.source !== undefined && { source: body.source }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.lostReason !== undefined && { lostReason: body.lostReason }),
      ...(body.reasonId !== undefined && { reasonId: body.reasonId || null }),
      ...(body.companyId !== undefined && { companyId: body.companyId || null }),
      ...(body.contactId !== undefined && { contactId: body.contactId || null }),
      ...(body.ownerId !== undefined && { ownerId: body.ownerId || null }),
      ...(body.expectedClose !== undefined && { expectedClose: body.expectedClose ? new Date(body.expectedClose) : null }),
      ...(body.closedAt !== undefined && { closedAt: body.closedAt ? new Date(body.closedAt) : null }),
      ...(body.customData !== undefined && { customData: body.customData }),
      // Legacy field name support
      ...(body.stageId !== undefined && body.stage === undefined && { stage: body.stageId }),
      ...(body.status !== undefined && body.stage === undefined && { stage: body.status }),
      ...(body.expectedCloseDate !== undefined && body.expectedClose === undefined && {
        expectedClose: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
      }),
    },
  });

  return jsonResponse(updated);
}, 'crm', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const opportunity = await prisma.opportunity.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!opportunity) return errorResponse('Opportunity not found', 404);

  await prisma.opportunity.delete({ where: { id } });
  return jsonResponse({ success: true });
}, 'crm', 'write');
