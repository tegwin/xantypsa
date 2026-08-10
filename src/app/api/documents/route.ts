import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entityType') || '';
  const entityId = searchParams.get('entityId') || '';
  const tenantId = session.user.tenantId;

  const where: any = { tenantId };
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  const items = await prisma.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  return jsonResponse({ items });
}, 'crm', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const entityType = formData.get('entityType') as string | null;
  const entityId = formData.get('entityId') as string | null;

  if (!entityType || !entityId) return errorResponse('entityType and entityId are required');
  if (!file) return errorResponse('File is required');

  // TODO: Add actual file storage (S3, etc.) - for now store metadata only
  const document = await prisma.document.create({
    data: {
      tenantId: session.user.tenantId,
      userId: session.user.id,
      entityType,
      entityId,
      fileName: file.name,
      fileUrl: `/uploads/${file.name}`, // Placeholder URL
      fileSize: file.size,
      mimeType: file.type || null,
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  return jsonResponse(document, 201);
}, 'crm', 'write');
