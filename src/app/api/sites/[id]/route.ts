import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const site = await prisma.site.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!site) return errorResponse('Site not found', 404);

  const updated = await prisma.site.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.address1 !== undefined && { address1: body.address1 }),
      ...(body.address2 !== undefined && { address2: body.address2 }),
      ...(body.address3 !== undefined && { address3: body.address3 }),
      ...(body.city !== undefined && { city: body.city }),
      ...(body.state !== undefined && { state: body.state }),
      ...(body.postcode !== undefined && { postcode: body.postcode }),
      ...(body.country !== undefined && { country: body.country }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.email !== undefined && { email: body.email }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });
  return jsonResponse(updated);
}, 'crm', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const site = await prisma.site.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!site) return errorResponse('Site not found', 404);
  if (site.isDefault) return errorResponse('Cannot delete the default site', 400);

  await prisma.site.delete({ where: { id } });
  return jsonResponse({ success: true });
}, 'crm', 'delete');
