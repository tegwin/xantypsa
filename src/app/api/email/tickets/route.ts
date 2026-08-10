import { NextRequest } from 'next/server';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        tenantId: session.user.tenantId,
        source: 'email',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        contact: { select: { firstName: true, lastName: true, email: true } },
        company: { select: { name: true } },
      },
    });

    return jsonResponse(tickets);
  } catch (err: any) {
    return errorResponse(err.message || 'Failed to fetch email tickets', 500);
  }
}, 'settings', 'read');
