import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse, parseSearchParams } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const p = parseSearchParams(req.url);
  const tenantId = session.user.tenantId;
  const where: any = { tenantId };
  if (p.search) {
    where.OR = [
      { title: { contains: p.search, mode: 'insensitive' } },
    ];
  }
  if (p.status) where.stage = p.status;
  if (p.companyId) where.companyId = p.companyId;

  const [items, total] = await Promise.all([
    prisma.opportunity.findMany({
      where, skip: p.skip, take: p.limit,
      orderBy: { [p.sortBy]: p.sortDir },
      include: {
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        owner: { select: { id: true, name: true } },
        _count: { select: { quotes: true } },
      },
    }),
    prisma.opportunity.count({ where }),
  ]);
  return jsonResponse({ items, total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) });
}, 'crm', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.title) return errorResponse('Title is required');

  const opportunity = await prisma.opportunity.create({
    data: {
      tenantId: session.user.tenantId,
      title: body.title,
      value: body.value || 0,
      stage: body.stage || 'lead',
      probability: body.probability || 0,
      companyId: body.companyId || null,
      contactId: body.contactId || null,
      ownerId: session.user.id,
      source: body.source || null,
      notes: body.notes || null,
      expectedClose: body.expectedClose ? new Date(body.expectedClose) : null,
      customData: body.customData || {},
    },
  });
  return jsonResponse(opportunity, 201);
}, 'crm', 'write');
