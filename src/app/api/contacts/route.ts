import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse, parseSearchParams } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const p = parseSearchParams(req.url);
  const tenantId = session.user.tenantId;

  const where: any = { tenantId };
  if (p.search) {
    where.OR = [
      { firstName: { contains: p.search, mode: 'insensitive' } },
      { lastName: { contains: p.search, mode: 'insensitive' } },
      { email: { contains: p.search, mode: 'insensitive' } },
    ];
  }
  if (p.companyId) {
    where.OR = [
      ...(where.OR || []),
      { companyId: p.companyId },
      { companies: { some: { companyId: p.companyId } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.contact.findMany({
      where, skip: p.skip, take: p.limit,
      orderBy: { [p.sortBy]: p.sortDir },
      include: {
        company: { select: { id: true, name: true } },
        companies: {
          include: { company: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.contact.count({ where }),
  ]);

  return jsonResponse({ items, total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) });
}, 'crm', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.firstName || !body.lastName) return errorResponse('First and last name are required');

  const tenantId = session.user.tenantId;

  const contact = await prisma.contact.create({
    data: {
      tenantId,
      companyId: body.companyId || null,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      phone: body.phone || null,
      mobile: body.mobile || null,
      jobTitle: body.jobTitle || null,
      department: body.department || null,
      notes: body.notes || null,
    },
  });

  // Also create junction record for many-to-many
  if (body.companyId) {
    await prisma.contactCompany.create({
      data: {
        contactId: contact.id,
        companyId: body.companyId,
        isPrimary: true,
        role: body.role || null,
      },
    });
  }

  // Link additional companies if provided
  if (body.additionalCompanyIds?.length) {
    await prisma.contactCompany.createMany({
      data: body.additionalCompanyIds.map((cid: string) => ({
        contactId: contact.id,
        companyId: cid,
        isPrimary: false,
      })),
      skipDuplicates: true,
    });
  }

  return jsonResponse(contact, 201);
}, 'crm', 'write');
