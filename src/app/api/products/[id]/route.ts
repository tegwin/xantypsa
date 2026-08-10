import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const product = await prisma.product.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!product) return errorResponse('Product not found', 404);
  return jsonResponse(product);
}, 'settings', 'read');

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const product = await prisma.product.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!product) return errorResponse('Product not found', 404);

  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description || null;
  if (body.sku !== undefined) data.sku = body.sku || null;
  if (body.category !== undefined) data.category = body.category || null;
  if (body.type !== undefined) data.type = body.type;
  if (body.unitPrice !== undefined) data.unitPrice = parseFloat(body.unitPrice) || 0;
  if (body.cost !== undefined) data.cost = parseFloat(body.cost) || 0;
  if (body.taxRate !== undefined) data.taxRate = parseFloat(body.taxRate) ?? 20;
  if (body.unit !== undefined) data.unit = body.unit;
  if (body.billingType !== undefined) data.billingType = body.billingType;
  if (body.billingPeriod !== undefined) data.billingPeriod = body.billingPeriod || null;
  if (body.isService !== undefined) data.isService = body.isService;
  if (body.isBundle !== undefined) data.isBundle = body.isBundle;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.isRecurring !== undefined) data.isRecurring = body.isRecurring;
  if (body.recurringFreq !== undefined) data.recurringFreq = body.recurringFreq || null;

  const updated = await prisma.product.update({ where: { id }, data });
  return jsonResponse(updated);
}, 'settings', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const product = await prisma.product.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!product) return errorResponse('Product not found', 404);
  await prisma.product.delete({ where: { id } });
  return jsonResponse({ success: true });
}, 'settings', 'write');
