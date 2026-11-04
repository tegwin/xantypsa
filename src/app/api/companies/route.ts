import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse, parseSearchParams } from '@/lib/api';
import { dispatchWebhookEvent } from '@/lib/webhooks';
import { normaliseDomains } from '@/lib/emailRouting';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const p = parseSearchParams(req.url);
  const tenantId = session.user.tenantId;

  const where: any = { tenantId };
  if (p.search) {
    where.OR = [
      { name: { contains: p.search, mode: 'insensitive' } },
      { email: { contains: p.search, mode: 'insensitive' } },
      { phone: { contains: p.search, mode: 'insensitive' } },
    ];
  }
  if (p.type) where.type = p.type;
  if (p.status === 'active') where.isActive = true;
  if (p.status === 'inactive') where.isActive = false;

  const [items, total] = await Promise.all([
    prisma.company.findMany({
      where,
      skip: p.skip,
      take: p.limit,
      orderBy: { [p.sortBy]: p.sortDir },
      include: {
        _count: { select: { contacts: true, tickets: true, contracts: true, invoices: true } },
      },
    }),
    prisma.company.count({ where }),
  ]);

  return jsonResponse({ items, total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) });
}, 'crm', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.name) return errorResponse('Company name is required');

  const company = await prisma.company.create({
    data: {
      tenantId: session.user.tenantId,
      name: body.name,
      type: body.type || 'prospect',
      email: body.email || null,
      phone: body.phone || null,
      website: body.website || null,
      logoUrl: body.logoUrl || null,
      emailDomains: normaliseDomains(body.emailDomains),
      address1: body.address1 || null,
      address2: body.address2 || null,
      address3: body.address3 || null,
      city: body.city || null,
      state: body.state || null,
      postcode: body.postcode || body.zip || null,
      country: body.country || null,
      industry: body.industry || null,
      notes: body.notes || null,
      // Auto-create "Main" site with company address
      sites: {
        create: {
          tenantId: session.user.tenantId,
          name: 'Main',
          isDefault: true,
          address1: body.address1 || null,
          address2: body.address2 || null,
          address3: body.address3 || null,
          city: body.city || null,
          state: body.state || null,
          postcode: body.postcode || body.zip || null,
          country: body.country || null,
          phone: body.phone || null,
          email: body.email || null,
        },
      },
    },
    include: { sites: true },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      action: 'created',
      entityType: 'company',
      entityId: company.id,
      changes: { name: company.name },
    },
  });

  // Dispatch webhook
  dispatchWebhookEvent(session.user.tenantId, 'company.created', company);

  return jsonResponse(company, 201);
}, 'crm', 'write');
