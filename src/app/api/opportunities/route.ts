import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCrmRequired, missingFields } from '@/lib/crmRequired';
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

  // A deal raised against a new lead creates the prospect, so it appears under
  // CRM, Prospects like any other company. Previously the name was only kept as
  // text on the opportunity, which meant the lead existed nowhere.
  if (!body.companyId && body.prospectName) {
    const existing = await prisma.company.findFirst({
      where: { tenantId: session.user.tenantId, name: body.prospectName },
    });

    const company = existing ?? await prisma.company.create({
      data: {
        tenantId: session.user.tenantId,
        name: body.prospectName,
        type: 'prospect',
        email: body.prospectEmail || null,
        phone: body.prospectPhone || null,
      },
    });
    body.companyId = company.id;

    // A named person becomes a contact on that prospect, so there is somebody
    // to put on a quote later.
    if (!body.contactId && (body.prospectContactName || body.prospectEmail)) {
      const full = String(body.prospectContactName || body.prospectName).trim();
      const [firstName, ...rest] = full.split(/\s+/);
      const contact = await prisma.contact.create({
        data: {
          tenantId: session.user.tenantId,
          companyId: company.id,
          firstName: firstName || full,
          lastName: rest.join(' ') || '',
          email: body.prospectEmail || null,
          phone: body.prospectPhone || null,
        },
      });
      body.contactId = contact.id;
    }
  }

  // Whatever the business has decided it needs, enforced here as well as in
  // the form so the API cannot be used to get around it.
  const required = await getCrmRequired(session.user.tenantId);
  const missing = missingFields(required, body);
  if (missing) return errorResponse(missing);

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
