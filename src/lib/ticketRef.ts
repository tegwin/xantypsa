import { prisma } from './prisma';

/**
 * The tag appended to every outbound subject, e.g. "[#123]".
 *
 * One form, used everywhere, so a reply can be matched back to its ticket by
 * the subject alone. The brackets are what make it safe to look for in a
 * message body too: a bare "#123" in prose is far too common to trust.
 */
export function ticketTag(ticketNumber: number): string {
  return `[#${ticketNumber}]`;
}

/** Add the tag to a subject unless a reference to this ticket is already in it. */
export function withTicketTag(subject: string, ticketNumber: number): string {
  const existing = refsInSubject(subject);
  if (existing.includes(ticketNumber)) return subject;
  return `${ticketTag(ticketNumber)} ${subject}`.trim();
}

/** A one-line footer carrying the reference, so it survives a stripped subject. */
export function ticketRefFooter(ticketNumber: number): string {
  return `Ticket reference: ${ticketTag(ticketNumber)} - please keep this in your reply.`;
}

// Forms explicit enough to trust anywhere, including inside a quoted body.
const STRICT = [
  /\[\s*#\s*(\d+)\s*\]/g,              // [#123]
  /\[\s*Ticket\s*#?\s*(\d+)\s*\]/gi,   // [Ticket #123]
  /\bTKT-(\d+)\b/gi,                   // TKT-123
  /\bTicket[-\s]*#?\s*(\d+)\b/gi,      // Ticket #123 / Ticket-123 / Ticket 123
];

// Only ever used on a subject line, where a loose "#123" is still a fair guess.
const LOOSE = /#\s*(\d+)\b/g;

function collect(text: string, patterns: RegExp[]): number[] {
  const out: number[] = [];
  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) {
      const n = parseInt(m[1], 10);
      if (n > 0 && !out.includes(n)) out.push(n);
    }
  }
  return out;
}

export function refsInSubject(subject: string): number[] {
  if (!subject) return [];
  return collect(subject, [...STRICT, LOOSE]);
}

export function refsInBody(body: string): number[] {
  if (!body) return [];
  return collect(body, STRICT);
}

/**
 * Work out which ticket an incoming email belongs to: the subject first, then
 * the body if the subject was rewritten or the tag stripped.
 *
 * Every candidate is checked against this tenant's tickets and the first that
 * exists wins, so a stray number in a quoted signature cannot swallow a reply.
 */
export async function findTicketForEmail(
  tenantId: string,
  subject: string,
  body: string,
): Promise<{ id: string; ticketNumber: number; status: string } | null> {
  const candidates = [...refsInSubject(subject), ...refsInBody(body)];
  const seen = new Set<number>();
  for (const ticketNumber of candidates) {
    if (seen.has(ticketNumber)) continue;
    seen.add(ticketNumber);
    const ticket = await prisma.ticket.findFirst({
      where: { tenantId, ticketNumber },
      select: { id: true, ticketNumber: true, status: true },
    });
    if (ticket) return ticket;
  }
  return null;
}
