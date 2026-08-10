import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse, parseSearchParams } from '@/lib/api';
import { dispatchWebhookEvent } from '@/lib/webhooks';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const p = parseSearchParams(req.url);
  const tenantId = session.user.tenantId;

  const where: any = { tenantId };
  if (p.search) {
    where.OR = [
      { name: { contains: p.search, mode: 'insensitive' } },
      { assetTag: { contains: p.search, mode: 'insensitive' } },
      { serialNumber: { contains: p.search, mode: 'insensitive' } },
    ];
  }
  if (p.companyId) where.companyId = p.companyId;
  if (p.type) where.type = p.type;
  if (p.status) where.status = p.status;

  const [items, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      skip: p.skip,
      take: p.limit,
      orderBy: { [p.sortBy]: p.sortDir },
      include: {
        company: { select: { id: true, name: true } },
      },
    }),
    prisma.asset.count({ where }),
  ]);

  return jsonResponse({ items, total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) });
}, 'settings', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.name) return errorResponse('Asset name is required');

  const asset = await prisma.asset.create({
    data: {
      tenantId: session.user.tenantId,
      name: body.name,
      companyId: body.companyId || null,
      siteId: body.siteId || null,
      contactId: body.contactId || null,
      assetTag: body.assetTag || null,
      serialNumber: body.serialNumber || null,
      type: body.type || 'device',
      manufacturer: body.manufacturer || null,
      model: body.model || null,
      status: body.status || 'active',
      purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
      warrantyExpiry: body.warrantyExpiry ? new Date(body.warrantyExpiry) : null,
      notes: body.notes || null,
      rmmSource: body.rmmSource || null,
      rmmExternalId: body.rmmExternalId || null,
      customData: body.customData || {},
    },
    include: {
      company: { select: { id: true, name: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      action: 'created',
      entityType: 'asset',
      entityId: asset.id,
      changes: { name: asset.name },
    },
  });

  dispatchWebhookEvent(session.user.tenantId, 'asset.created', asset);

  return jsonResponse(asset, 201);
}, 'settings', 'write');
