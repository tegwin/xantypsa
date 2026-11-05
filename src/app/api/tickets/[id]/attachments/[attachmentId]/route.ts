import { NextRequest } from 'next/server';
import { withTenant, errorResponse } from '@/lib/api';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAttachment } from '@/lib/attachmentStore';

/**
 * Serve one attachment.
 *
 * Through the app rather than from the bucket: the bucket is private, so the
 * only way to read a file is to prove you are signed in to the tenant that
 * owns it.
 */
export const GET = withTenant(async (req: NextRequest, session: any) => {
  // /api/tickets/{ticketId}/attachments/{attachmentId}
  const parts = req.nextUrl.pathname.split('/');
  const attachmentId = parts[parts.length - 1];
  const ticketId = parts[parts.length - 3];

  const attachment = await prisma.ticketAttachment.findFirst({
    where: { id: attachmentId, ticketId, tenantId: session.user.tenantId },
  });
  if (!attachment) return errorResponse('Attachment not found', 404);

  const content = await getAttachment(attachment.storagePath);

  return new NextResponse(content as any, {
    headers: {
      'Content-Type': attachment.contentType,
      // Inline where a browser can show it, so a screenshot opens in a tab.
      'Content-Disposition': `inline; filename="${attachment.filename.replace(/"/g, '')}"`,
      'Content-Length': String(content.length),
      'Cache-Control': 'private, max-age=300',
    },
  });
}, 'service_desk', 'read');
