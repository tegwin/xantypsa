import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { projectDependencies, describeDependencies } from '@/lib/inUse';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const project = await prisma.project.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      company: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      tasks: {
        where: { parentTaskId: null },
        include: {
          assignee: { select: { id: true, name: true } },
          milestone: { select: { id: true, name: true } },
          subtasks: {
            include: {
              assignee: { select: { id: true, name: true } },
              milestone: { select: { id: true, name: true } },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
      milestones: { orderBy: { sortOrder: 'asc' } },
      timeEntries: { select: { hours: true, billable: true, rate: true } },
    },
  });
  if (!project) return errorResponse('Project not found', 404);

  // Nothing that real work points at may be deleted.
  const blocked = describeDependencies('project', await projectDependencies(id, session.user.tenantId));
  if (blocked) return errorResponse(blocked, 409);

  const totalHours = project.timeEntries.reduce((s, e) => s + e.hours, 0);
  const billableHours = project.timeEntries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0);
  const billableAmount = project.timeEntries.filter(e => e.billable).reduce((s, e) => s + e.hours * (e.rate || 0), 0);

  // Calculate task stats
  const allTasks = project.tasks.flatMap(t => [t, ...(t.subtasks || [])]);
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter(t => t.status === 'done').length;
  const totalEstimatedHrs = allTasks.reduce((s, t) => s + (t.estimatedHrs || 0), 0);
  const totalActualHrs = allTasks.reduce((s, t) => s + (t.actualHrs || 0), 0);

  return jsonResponse({
    ...project,
    totalHours,
    billableHours,
    billableAmount,
    totalTasks,
    completedTasks,
    totalEstimatedHrs,
    totalActualHrs,
  });
}, 'projects', 'read');

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const project = await prisma.project.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!project) return errorResponse('Project not found', 404);

  const updated = await prisma.project.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.progress !== undefined && { progress: body.progress }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
      ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
      ...(body.deadline !== undefined && { deadline: body.deadline ? new Date(body.deadline) : null }),
      ...(body.budgetHours !== undefined && { budgetHours: body.budgetHours }),
      ...(body.budgetAmount !== undefined && { budgetAmount: body.budgetAmount }),
    },
  });
  return jsonResponse(updated);
}, 'projects', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const project = await prisma.project.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!project) return errorResponse('Project not found', 404);

  await prisma.project.delete({ where: { id } });
  return jsonResponse({ success: true });
}, 'projects', 'write');
