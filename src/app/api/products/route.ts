import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse, parseSearchParams } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const p = parseSearchParams(req.url);
  const tenantId = session.user.tenantId;

  const where: any = { tenantId };
  if (p.search) {
    where.OR = [
      { name: { contains: p.search, mode: 'insensitive' } },
      { sku: { contains: p.search, mode: 'insensitive' } },
      { description: { contains: p.search, mode: 'insensitive' } },
    ];
  }
  if (p.type) where.type = p.type;

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where, skip: p.skip, take: p.limit,
      orderBy: { name: 'asc' },
    }),
    prisma.product.count({ where }),
  ]);

  return jsonResponse({ items, total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) });
}, 'settings', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.name) return errorResponse('Product name is required');

  const product = await prisma.product.create({
    data: {
      tenantId: session.user.tenantId,
      name: body.name,
      sku: body.sku || null,
      description: body.description || null,
      category: body.category || null,
      type: body.type || 'service',
      unitPrice: parseFloat(body.unitPrice) || 0,
      cost: parseFloat(body.cost) || 0,
      taxRate: parseFloat(body.taxRate) ?? 20,
      unit: body.unit || 'each',
      isRecurring: body.isRecurring || false,
      recurringFreq: body.recurringFreq || null,
    },
  });

  return jsonResponse(product, 201);
}, 'settings', 'write');
