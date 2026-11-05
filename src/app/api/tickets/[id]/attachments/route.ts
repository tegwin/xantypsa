import { NextRequest } from 'next/server';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { putAttachment, deleteAttachment } from '@/lib/attachmentStore';

/** What is attached to this ticket. Metadata only: files come one at a time. */
export const GET = withTenant(async (req: NextRequest, session: any) => {
  // Same path-parsing convention as the other nested ticket routes.
  const parts = req.nextUrl.pathname.split('/');
  const ticketId = parts[parts.length - 2];
  const items = await prisma.ticketAttachment.findMany({
    // Scoped by tenant as well as ticket, so a ticket id from another tenant
    // returns nothing rather than someone else's files.
    where: { ticketId, tenantId: session.user.tenantId },
    orderBy: { createdAt: 'desc' },
  });
  return jsonResponse({ items });
}, 'service_desk', 'read');

const MAX_BYTES = 15 * 1024 * 1024;

/** Upload one file to a ticket. */
export const POST = withTenant(async (req: NextRequest, session: any) => {
  // Same path-parsing convention as the other nested ticket routes.
  const parts = req.nextUrl.pathname.split('/');
  const ticketId = parts[parts.length - 2];
  const tenantId = session.user.tenantId;

  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, tenantId } });
  if (!ticket) return errorResponse('Ticket not found', 404);

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return errorResponse('Choose a file to attach', 400);
  if (file.size > MAX_BYTES) return errorResponse('That file is larger than 15 MB', 400);

  const content = Buffer.from(await file.arrayBuffer());
  const storagePath = await putAttachment(
    tenantId,
    ticketId,
    file.name,
    file.type || 'application/octet-stream',
    content
  );

  const attachment = await prisma.ticketAttachment.create({
    data: {
      tenantId,
      ticketId,
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      size: content.length,
      storagePath,
    },
  });

  return jsonResponse(attachment, 201);
}, 'service_desk', 'write');

/** Remove one, from the record and from the bucket. */
export const DELETE = withTenant(async (req: NextRequest, session: any) => {
  // Same path-parsing convention as the other nested ticket routes.
  const parts = req.nextUrl.pathname.split('/');
  const ticketId = parts[parts.length - 2];
  const id = new URL(req.url).searchParams.get('attachmentId');
  if (!id) return errorResponse('Which attachment?', 400);

  const attachment = await prisma.ticketAttachment.findFirst({
    where: { id, ticketId, tenantId: session.user.tenantId },
  });
  if (!attachment) return errorResponse('Attachment not found', 404);

  await prisma.ticketAttachment.delete({ where: { id: attachment.id } });
  // After the row, so a failed delete here leaves an orphaned file rather than
  // a record pointing at nothing.
  await deleteAttachment(attachment.storagePath);

  return jsonResponse({ deleted: true });
}, 'service_desk', 'write');
