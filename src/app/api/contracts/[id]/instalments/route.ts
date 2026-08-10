import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

function extractContractId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split('/');
  const idx = segments.indexOf('contracts');
  if (idx >= 0 && idx + 1 < segments.length) return segments[idx + 1];
  return '';
}

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const contractId = extractContractId(req);
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: session.user.tenantId },
  });
  if (!contract) return errorResponse('Contract not found', 404);

  const instalments = await prisma.contractInstalment.findMany({
    where: { contractId },
    orderBy: { number: 'asc' },
  });

  return jsonResponse(instalments);
}, 'contracts', 'read');

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const contractId = extractContractId(req);
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: session.user.tenantId },
  });
  if (!contract) return errorResponse('Contract not found', 404);

  const body = await req.json();

  if (!body.amount || body.amount <= 0) return errorResponse('Amount is required and must be positive');
  if (!body.dueDate) return errorResponse('Due date is required');

  // Get the next number
  const lastInstalment = await prisma.contractInstalment.findFirst({
    where: { contractId },
    orderBy: { number: 'desc' },
  });
  const nextNumber = body.number || (lastInstalment ? lastInstalment.number + 1 : 1);

  const instalment = await prisma.contractInstalment.create({
    data: {
      contractId,
      number: nextNumber,
      description: body.description || null,
      amount: parseFloat(body.amount),
      dueDate: new Date(body.dueDate),
      projectMilestoneId: body.projectMilestoneId || null,
    },
  });

  return jsonResponse(instalment, 201);
}, 'contracts', 'write');
