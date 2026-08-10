import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, parseSearchParams } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const p = parseSearchParams(req.url);
  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entityType') || '';
  const entityId = searchParams.get('entityId') || '';
  const tenantId = session.user.tenantId;

  const where: any = { tenantId };
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip: p.skip,
      take: p.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return jsonResponse({ items, total, page: p.page, limit: p.limit });
}, 'crm', 'read');
