// ============================================================
// Attachments arriving on an email
// ============================================================
// Graph hands these back base64-encoded on the message. They are fetched in a
// second call rather than expanded on the first, because a message with a
// 20 MB file attached makes the notification handler's own fetch enormous.

import { prisma } from './prisma';
import { putAttachment } from './attachmentStore';

/**
 * Anything larger is recorded as a note rather than stored.
 *
 * A single oversized file should not be able to fill the bucket or stall the
 * webhook, and the agent can still fetch it from the mailbox.
 */
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Below this, an inline image is assumed to be furniture.
 *
 * A pasted screenshot is the thing the customer is showing you and must be
 * kept; a signature logo or a tracking pixel repeats on every reply and must
 * not be. Size is the only honest signal Graph gives us for the difference.
 *
 * ponytail: a size floor, not real classification. If logos start getting
 * through, read the image dimensions instead.
 */
const INLINE_FLOOR_BYTES = 20 * 1024;

/**
 * Copy an email's attachments onto a ticket.
 *
 * Embedded images count: somebody pasting a screenshot into the body has
 * attached it as far as they are concerned, so it is stored like any other
 * file and marked as inline.
 *
 * Never throws. An attachment that cannot be stored must not cost the ticket
 * or the note it belongs to, so each failure is logged and the rest continue.
 */
export async function saveEmailAttachments(
  tenantId: string,
  ticketId: string,
  messageResource: string,
  token: string,
  fromEmail?: string
): Promise<{ saved: number; skipped: string[] }> {
  const skipped: string[] = [];
  let saved = 0;

  try {
    const res = await fetch(`https://graph.microsoft.com/v1.0/${messageResource}/attachments`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error(`[ms-email] could not list attachments (${res.status})`);
      return { saved, skipped };
    }

    const data = await res.json();
    for (const att of data.value ?? []) {
      // Only real files. An itemAttachment is a nested message or appointment,
      // and has no contentBytes to store.
      if (att['@odata.type'] !== '#microsoft.graph.fileAttachment') {
        skipped.push(att.name || 'unnamed');
        continue;
      }
      const size = att.size ?? 0;

      // Embedded, and small enough to be a logo or a tracking pixel.
      if (att.isInline && size < INLINE_FLOOR_BYTES) continue;
      if (size > MAX_BYTES) {
        skipped.push(`${att.name} (too large)`);
        continue;
      }

      try {
        const content = Buffer.from(att.contentBytes, 'base64');
        const storagePath = await putAttachment(
          tenantId,
          ticketId,
          att.name,
          att.contentType || 'application/octet-stream',
          content
        );

        await prisma.ticketAttachment.create({
          data: {
            tenantId,
            ticketId,
            filename: att.name || 'attachment',
            contentType: att.contentType || 'application/octet-stream',
            size: content.length,
            storagePath,
            sourceEmail: fromEmail ?? null,
            isInline: !!att.isInline,
          },
        });
        saved++;
      } catch (err: any) {
        console.error(`[ms-email] attachment "${att.name}" not stored:`, err.message);
        skipped.push(att.name || 'unnamed');
      }
    }
  } catch (err: any) {
    console.error('[ms-email] attachment fetch failed:', err.message);
  }

  return { saved, skipped };
}

export { MAX_BYTES as MAX_ATTACHMENT_BYTES };
