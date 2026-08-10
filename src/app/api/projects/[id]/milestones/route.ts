import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const segments = req.nextUrl.pathname.split('/');
  const projectId = segments[segments.indexOf('projects') + 1];

  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: session.user.tenantId } });
  if (!project) return errorResponse('Project not found', 404);

  const milestones = await prisma.milestone.findMany({
    where: { projectId },
    include: {
      tasks: {
        select: { id: true, status: true, title: true },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const result = milestones.map(m => ({
    ...m,
    totalTasks: m.tasks.length,
    completedTasks: m.tasks.filter(t => t.status === 'done').length,
  }));

  return jsonResponse(result);
}, 'projects', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const segments = req.nextUrl.pathname.split('/');
  const projectId = segments[segments.indexOf('projects') + 1];
  const body = await req.json();
  const { name, description, dueDate, sortOrder } = body;

  if (!name) return errorResponse('Name is required', 400);

  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: session.user.tenantId } });
  if (!project) return errorResponse('Project not found', 404);

  const maxOrder = await prisma.milestone.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  });

  const milestone = await prisma.milestone.create({
    data: {
      projectId,
      name,
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      sortOrder: sortOrder ?? (maxOrder._max.sortOrder || 0) + 1,
    },
  });

  return jsonResponse(milestone, 201);
}, 'projects', 'write');
