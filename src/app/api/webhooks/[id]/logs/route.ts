import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse, parseSearchParams } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const tenantId = session.user.tenantId;
  const segments = req.nextUrl.pathname.split('/');
  const webhookId = segments[segments.indexOf('webhooks') + 1];
  const params = parseSearchParams(req.url);

  const webhook = await prisma.webhook.findFirst({
    where: { id: webhookId, tenantId },
  });

  if (!webhook) {
    return errorResponse('Webhook not found', 404);
  }

  const [logs, total] = await Promise.all([
    prisma.webhookLog.findMany({
      where: { webhookId, tenantId },
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.limit,
    }),
    prisma.webhookLog.count({
      where: { webhookId, tenantId },
    }),
  ]);

  return jsonResponse({
    items: logs,
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  });
});
