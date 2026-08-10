import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { getNextNumber } from '@/lib/server-utils';

function extractIds(req: NextRequest): { contractId: string; instalmentId: string } {
  const segments = req.nextUrl.pathname.split('/');
  const cIdx = segments.indexOf('contracts');
  const iIdx = segments.indexOf('instalments');
  return {
    contractId: cIdx >= 0 ? segments[cIdx + 1] : '',
    instalmentId: iIdx >= 0 ? segments[iIdx + 1] : '',
  };
}

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const { contractId, instalmentId } = extractIds(req);
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: session.user.tenantId },
  });
  if (!contract) return errorResponse('Contract not found', 404);

  const instalment = await prisma.contractInstalment.findFirst({
    where: { id: instalmentId, contractId },
  });
  if (!instalment) return errorResponse('Instalment not found', 404);

  const body = await req.json();
  const data: any = {};

  if (body.description !== undefined) data.description = body.description;
  if (body.amount !== undefined) data.amount = parseFloat(body.amount);
  if (body.dueDate !== undefined) data.dueDate = new Date(body.dueDate);
  if (body.projectMilestoneId !== undefined) data.projectMilestoneId = body.projectMilestoneId || null;

  if (body.status === 'paid' && instalment.status !== 'paid') {
    data.status = 'paid';
    data.paidAt = new Date();
  } else if (body.status === 'invoiced') {
    data.status = 'invoiced';
  } else if (body.status === 'pending') {
    data.status = 'pending';
    data.paidAt = null;
  }

  const updated = await prisma.contractInstalment.update({
    where: { id: instalmentId },
    data,
  });

  return jsonResponse(updated);
}, 'contracts', 'write');

// POST creates an invoice from the instalment
export const POST = withTenant(async (req: NextRequest, session: any) => {
  const { contractId, instalmentId } = extractIds(req);
  const tenantId = session.user.tenantId;

  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
    include: { company: { select: { id: true, name: true } } },
  });
  if (!contract) return errorResponse('Contract not found', 404);

  const instalment = await prisma.contractInstalment.findFirst({
    where: { id: instalmentId, contractId },
  });
  if (!instalment) return errorResponse('Instalment not found', 404);
  if (instalment.status !== 'pending') return errorResponse('Instalment is already invoiced or paid');

  const invoiceNumber = await getNextNumber(tenantId, 'invoice');
  const description = instalment.description
    ? `${contract.name} - ${instalment.description}`
    : `${contract.name} - Milestone ${instalment.number}`;

  const subtotal = instalment.amount;
  const taxRate = 20;
  const taxTotal = subtotal * taxRate / 100;
  const total = subtotal + taxTotal;

  const invoice = await prisma.invoice.create({
    data: {
      tenantId,
      invoiceNumber,
      title: description,
      companyId: contract.companyId,
      contractId: contract.id,
      createdById: session.user.id,
      dueDate: instalment.dueDate,
      paymentTerms: 'net_30',
      subtotal,
      taxTotal,
      total,
      amountDue: total,
      items: {
        create: [{
          description,
          quantity: 1,
          unitPrice: instalment.amount,
          taxRate,
          discount: 0,
          total,
          sortOrder: 0,
        }],
      },
    },
    include: { items: true },
  });

  // Update instalment status
  await prisma.contractInstalment.update({
    where: { id: instalmentId },
    data: { status: 'invoiced', invoiceId: invoice.id },
  });

  return jsonResponse(invoice, 201);
}, 'contracts', 'write');

export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  const { contractId, instalmentId } = extractIds(req);
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: session.user.tenantId },
  });
  if (!contract) return errorResponse('Contract not found', 404);

  const instalment = await prisma.contractInstalment.findFirst({
    where: { id: instalmentId, contractId },
  });
  if (!instalment) return errorResponse('Instalment not found', 404);
  if (instalment.status !== 'pending') return errorResponse('Cannot delete an invoiced or paid instalment');

  await prisma.contractInstalment.delete({ where: { id: instalmentId } });
  return jsonResponse({ success: true });
}, 'contracts', 'write');
