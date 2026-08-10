import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const segments = req.nextUrl.pathname.split('/');
  const projectId = segments[segments.length - 2];
  const body = await req.json();
  const { title, description, assigneeId, status, priority, estimatedHrs, dueDate, parentTaskId, milestoneId } = body;

  if (!title) return errorResponse('Title is required', 400);

  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: session.user.tenantId } });
  if (!project) return errorResponse('Project not found', 404);

  const maxOrder = await prisma.task.aggregate({
    where: { projectId, parentTaskId: parentTaskId || null },
    _max: { sortOrder: true },
  });

  const task = await prisma.task.create({
    data: {
      tenantId: session.user.tenantId,
      projectId,
      title,
      description: description || null,
      assigneeId: assigneeId || null,
      createdById: session.user.id,
      status: status || 'todo',
      priority: priority || 'medium',
      estimatedHrs: estimatedHrs ? parseFloat(estimatedHrs) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      parentTaskId: parentTaskId || null,
      milestoneId: milestoneId || null,
      sortOrder: (maxOrder._max.sortOrder || 0) + 1,
    },
    include: {
      assignee: { select: { id: true, name: true } },
      milestone: { select: { id: true, name: true } },
    },
  });

  return jsonResponse(task, 201);
}, 'projects', 'write');

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const segments = req.nextUrl.pathname.split('/');
  const projectId = segments[segments.length - 2];

  const project = await prisma.project.findFirst({ where: { id: projectId, tenantId: session.user.tenantId } });
  if (!project) return errorResponse('Project not found', 404);

  const tasks = await prisma.task.findMany({
    where: { projectId, tenantId: session.user.tenantId },
    include: {
      assignee: { select: { id: true, name: true } },
      milestone: { select: { id: true, name: true } },
      subtasks: {
        include: { assignee: { select: { id: true, name: true } } },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  return jsonResponse(tasks);
}, 'projects', 'read');

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const body = await req.json();
  const { taskId, ...updates } = body;

  if (!taskId) return errorResponse('taskId is required', 400);

  const task = await prisma.task.findFirst({ where: { id: taskId, tenantId: session.user.tenantId } });
  if (!task) return errorResponse('Task not found', 404);

  const data: any = {};
  if (updates.title !== undefined) data.title = updates.title;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.assigneeId !== undefined) data.assigneeId = updates.assigneeId || null;
  if (updates.status !== undefined) {
    data.status = updates.status;
    if (updates.status === 'done') data.completedAt = new Date();
    else data.completedAt = null;
  }
  if (updates.priority !== undefined) data.priority = updates.priority;
  if (updates.estimatedHrs !== undefined) data.estimatedHrs = updates.estimatedHrs ? parseFloat(updates.estimatedHrs) : null;
  if (updates.dueDate !== undefined) data.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
  if (updates.milestoneId !== undefined) data.milestoneId = updates.milestoneId || null;
  if (updates.sortOrder !== undefined) data.sortOrder = updates.sortOrder;

  const updated = await prisma.task.update({
    where: { id: taskId },
    data,
    include: {
      assignee: { select: { id: true, name: true } },
      milestone: { select: { id: true, name: true } },
    },
  });

  return jsonResponse(updated);
}, 'projects', 'write');
