import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const segments = req.nextUrl.pathname.split('/');
  const projectId = segments[segments.indexOf('projects') + 1];
  const milestoneId = segments[segments.indexOf('milestones') + 1];
  const body = await req.json();

  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: session.user.tenantId } });
  if (!project) return errorResponse('Project not found', 404);

  const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, projectId } });
  if (!milestone) return errorResponse('Milestone not found', 404);

  const data: any = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.completedAt !== undefined) data.completedAt = body.completedAt ? new Date(body.completedAt) : null;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  const updated = await prisma.milestone.update({
    where: { id: milestoneId },
    data,
    include: {
      tasks: { select: { id: true, status: true } },
    },
  });

  return jsonResponse({
    ...updated,
    totalTasks: updated.tasks.length,
    completedTasks: updated.tasks.filter(t => t.status === 'done').length,
  });
}, 'projects', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const segments = req.nextUrl.pathname.split('/');
  const projectId = segments[segments.indexOf('projects') + 1];
  const milestoneId = segments[segments.indexOf('milestones') + 1];

  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: session.user.tenantId } });
  if (!project) return errorResponse('Project not found', 404);

  const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, projectId } });
  if (!milestone) return errorResponse('Milestone not found', 404);

  // Unlink tasks from this milestone before deleting
  await prisma.task.updateMany({
    where: { milestoneId },
    data: { milestoneId: null },
  });

  await prisma.milestone.delete({ where: { id: milestoneId } });
  return jsonResponse({ success: true });
}, 'projects', 'write');
