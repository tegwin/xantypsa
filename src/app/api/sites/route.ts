import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse, parseSearchParams } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const p = parseSearchParams(req.url);
  const tenantId = session.user.tenantId;

  const where: any = { tenantId };
  if (p.companyId) where.companyId = p.companyId;
  if (p.search) {
    where.OR = [
      { name: { contains: p.search, mode: 'insensitive' } },
      { city: { contains: p.search, mode: 'insensitive' } },
      { address1: { contains: p.search, mode: 'insensitive' } },
    ];
  }

  const items = await prisma.site.findMany({
    where,
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    include: { company: { select: { id: true, name: true } } },
  });

  return jsonResponse({ items });
}, 'crm', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.companyId) return errorResponse('Company is required');
  if (!body.name) return errorResponse('Site name is required');

  const site = await prisma.site.create({
    data: {
      tenantId: session.user.tenantId,
      companyId: body.companyId,
      name: body.name,
      isDefault: body.isDefault || false,
      address1: body.address1 || null,
      address2: body.address2 || null,
      address3: body.address3 || null,
      city: body.city || null,
      state: body.state || null,
      postcode: body.postcode || null,
      country: body.country || null,
      phone: body.phone || null,
      email: body.email || null,
      notes: body.notes || null,
    },
  });

  return jsonResponse(site, 201);
}, 'crm', 'write');
