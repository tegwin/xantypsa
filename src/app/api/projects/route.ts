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
    ];
  }
  if (p.status) where.status = p.status;
  if (p.companyId) where.companyId = p.companyId;

  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where, skip: p.skip, take: p.limit,
      orderBy: { [p.sortBy]: p.sortDir },
      include: {
        company: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        milestones: { orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, dueDate: true, completedAt: true } },
        _count: { select: { tasks: true, members: true, timeEntries: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  return jsonResponse({ items, total, page: p.page, limit: p.limit, pages: Math.ceil(total / p.limit) });
}, 'projects', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  if (!body.name) return errorResponse('Project name is required');

  const tenantId = session.user.tenantId;

  const project = await prisma.project.create({
    data: {
      tenantId,
      name: body.name,
      description: body.description || null,
      companyId: body.companyId || null,
      managerId: session.user.id,
      priority: body.priority || 'medium',
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      deadline: body.deadline ? new Date(body.deadline) : null,
      budgetHours: body.budgetHours ? parseFloat(body.budgetHours) : null,
      budgetAmount: body.budgetAmount ? parseFloat(body.budgetAmount) : null,
      billingMethod: body.billingMethod || 'fixed',
      notes: body.notes || null,
      members: {
        create: { userId: session.user.id, role: 'manager' },
      },
    },
    include: { company: { select: { name: true } }, manager: { select: { name: true } } },
  });

  return jsonResponse(project, 201);
}, 'projects', 'write');
