import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { dispatchWebhookEvent } from '@/lib/webhooks';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const asset = await prisma.asset.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      company: { select: { id: true, name: true } },
    },
  });
  if (!asset) return errorResponse('Asset not found', 404);
  return jsonResponse(asset);
}, 'settings', 'read');

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const asset = await prisma.asset.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!asset) return errorResponse('Asset not found', 404);

  const updated = await prisma.asset.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.companyId !== undefined && { companyId: body.companyId || null }),
      ...(body.siteId !== undefined && { siteId: body.siteId || null }),
      ...(body.contactId !== undefined && { contactId: body.contactId || null }),
      ...(body.assetTag !== undefined && { assetTag: body.assetTag }),
      ...(body.serialNumber !== undefined && { serialNumber: body.serialNumber }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.manufacturer !== undefined && { manufacturer: body.manufacturer }),
      ...(body.model !== undefined && { model: body.model }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.purchaseDate !== undefined && { purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null }),
      ...(body.warrantyExpiry !== undefined && { warrantyExpiry: body.warrantyExpiry ? new Date(body.warrantyExpiry) : null }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.rmmSource !== undefined && { rmmSource: body.rmmSource }),
      ...(body.rmmExternalId !== undefined && { rmmExternalId: body.rmmExternalId }),
      ...(body.customData !== undefined && { customData: body.customData }),
    },
    include: {
      company: { select: { id: true, name: true } },
    },
  });

  dispatchWebhookEvent(session.user.tenantId, 'asset.updated', updated);

  return jsonResponse(updated);
}, 'settings', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const asset = await prisma.asset.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!asset) return errorResponse('Asset not found', 404);

  await prisma.asset.delete({ where: { id } });

  dispatchWebhookEvent(session.user.tenantId, 'asset.deleted', { id, name: asset.name });

  return jsonResponse({ success: true });
}, 'settings', 'delete');
