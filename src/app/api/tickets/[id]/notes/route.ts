import { NextRequest } from 'next/server';
import { calculateInternalCost } from '@/lib/costing';
import { consumeHours, blockBalance } from '@/lib/prepay';
import { round2 } from '@/lib/billing';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { sendTicketNotification, sendPublicNoteEmail } from '@/lib/ticketEmail';

export const POST = withTenant(async (req: NextRequest, session: any) => {
  const parts = req.nextUrl.pathname.split('/');
  const ticketId = parts[parts.length - 2];
  const body = await req.json();

  if (!body.content && !body.timeMinutes && !body.newStatus) {
    return errorResponse('Note content, time entry, or status change is required');
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, tenantId: session.user.tenantId },
  });
  if (!ticket) return errorResponse('Ticket not found', 404);

  const results: any = { note: null, timeEntry: null, statusChanged: false, emailed: false };

  // 1. Create note if content provided
  if (body.content?.trim()) {
    results.note = await prisma.ticketNote.create({
      data: {
        ticketId,
        userId: session.user.id,
        content: body.content,
        isInternal: body.isInternal ?? false,
      },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  // 2. Create time entry if time provided
  if (body.timeMinutes && parseInt(body.timeMinutes) > 0) {
    const rawMinutes = parseInt(body.timeMinutes);
    let billingRate = null;
    let actualRate = 0;
    let billedAmount = 0;
    let billableMinutes = rawMinutes;
    const isOOH = body.isOOH === true;

    if (body.billingRateId) {
      billingRate = await prisma.billingRate.findFirst({
        where: { id: body.billingRateId, tenantId: session.user.tenantId },
      });
    }

    if (!billingRate && body.billable !== false) {
      billingRate = await prisma.billingRate.findFirst({
        where: { tenantId: session.user.tenantId, isDefault: true, isActive: true },
      });
    }

    if (billingRate) {
      // Apply minimum
      if (billableMinutes < billingRate.minimumMinutes) {
        billableMinutes = billingRate.minimumMinutes;
      }
      // Apply rounding increment
      if (billingRate.roundingMinutes > 0) {
        billableMinutes = Math.ceil(billableMinutes / billingRate.roundingMinutes) * billingRate.roundingMinutes;
      }
      // Calculate rate (with OOH multiplier if applicable)
      actualRate = isOOH ? billingRate.rate * billingRate.oohMultiplier : billingRate.rate;
      // Calculate billed amount
      billedAmount = (billableMinutes / 60) * actualRate;
    }

    // A non-billable rate is charged to nobody: not time and materials, and
    // not a contract either.
    const isNonBillableRate = !!billingRate?.isNonBillable;
    if (isNonBillableRate) {
      actualRate = 0;
      billedAmount = 0;
    }

    const hours = parseFloat((billableMinutes / 60).toFixed(2));

    // === CONTRACT-AWARE BILLING ===
    let contractId: string | null = null;
    let chargeType = 'tam'; // default: time & materials
    let contractNote = '';

    if (isNonBillableRate) {
      // Deliberately no contract lookup: non-billable work must not consume a
      // prepaid block or be recorded as covered by a managed service.
      chargeType = 'non_billable';
      contractNote = ' [Non-billable: not charged, no contract hours used]';
    } else if (ticket.contractId) {
      const contract = await prisma.contract.findFirst({
        where: { id: ticket.contractId, status: 'active' },
        include: { exclusions: { select: { billingRateId: true } } },
      });

      if (contract && (contract.type === 'prepay_hours' || contract.type === 'managed_service')) {
        const isExcluded = billingRate && contract.exclusions.some((ex: any) => ex.billingRateId === billingRate!.id);
        
        if (isExcluded) {
          chargeType = 'excluded';
          contractNote = ` [Rate excluded from contract → T&M]`;
        } else {
          chargeType = 'contract';
          contractId = contract.id;

          if (contract.type === 'prepay_hours') {
            // Draw the hours off the blocks, oldest first. Anything the blocks
            // cannot cover falls to the overhour rate, or is refused when the
            // contract has none.
            const { uncovered } = await consumeHours(contract.id, session.user.tenantId, hours);
            const { remaining } = await blockBalance(contract.id, session.user.tenantId);

            if (uncovered > 0) {
              // Hours past the block are chargeable. The overage rate takes
              // precedence where one is set; otherwise they bill at the normal
              // time and materials rate for the work.
              const overRate = contract.overhourRate ?? actualRate;
              billedAmount = round2(uncovered * overRate);
              chargeType = 'overhour';
              const covered = round2(hours - uncovered);
              contractNote = covered > 0
                ? ` [${covered.toFixed(2)}h from ${contract.name}, ${uncovered.toFixed(2)}h over the block at ${overRate.toFixed(2)}/h]`
                : ` [Block exhausted: ${uncovered.toFixed(2)}h at ${overRate.toFixed(2)}/h]`;
            } else {
              billedAmount = 0;
              contractNote = ` [Deducted from ${contract.name}: ${remaining.toFixed(1)}h remaining]`;
            }
          } else {
            // managed_service: labour is included, zero out billing
            contractNote = ` [Covered by ${contract.name}]`;
            billedAmount = 0;
          }
        }
      }
    }

    results.timeEntry = await prisma.timeEntry.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        ticketId,
        billingRateId: billingRate?.id || null,
        contractId,
        chargeType,
        description: body.content || body.timeDescription || '',
        date: body.timeDate ? new Date(body.timeDate) : new Date(),
        hours,
        minutes: billableMinutes,
        billable: isNonBillableRate ? false : body.billable !== false,
        billed: false,
        isOOH,
        rate: actualRate || null,
        billedAmount: billedAmount || null,
        // Prefer the engineer's own cost rate; fall back to the rate card's.
        internalCost: await calculateInternalCost(
          session.user.id,
          session.user.tenantId,
          billableMinutes / 60,
          billingRate?.id
        ),
      },
      include: {
        user: { select: { id: true, name: true } },
        billingRate: { select: { id: true, name: true, code: true } },
      },
    });

    // Update ticket timeSpent (stored in minutes)
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { timeSpent: { increment: billableMinutes } },
    });

    // System note for time entry
    const timeNote = isOOH
      ? `⏱ Logged ${rawMinutes} mins (billed ${billableMinutes} mins OOH @ £${actualRate.toFixed(2)}/hr = £${billedAmount.toFixed(2)})${contractNote}`
      : billingRate
        ? `⏱ Logged ${rawMinutes} mins (billed ${billableMinutes} mins @ £${actualRate.toFixed(2)}/hr = £${billedAmount.toFixed(2)})${contractNote}`
        : `⏱ Logged ${rawMinutes} mins (non-billable)`;

    await prisma.ticketNote.create({
      data: { ticketId, userId: session.user.id, content: timeNote, isInternal: true, isSystem: true },
    });
  }

  // 3. Update ticket status if requested
  if (body.newStatus && body.newStatus !== ticket.status) {
    const data: any = { status: body.newStatus };

    // Check if the new status is a "closed" type
    const statusDef = await prisma.ticketStatus.findFirst({
      where: { tenantId: session.user.tenantId, slug: body.newStatus },
    });
    const isClosed = statusDef?.isClosed ?? (body.newStatus === 'closed');
    const isResolved = body.newStatus === 'resolved';

    if (isResolved) data.resolvedAt = new Date();
    if (isClosed) data.closedAt = new Date();
    if (!ticket.firstResponse && !isClosed && !isResolved) {
      data.firstResponse = new Date();
    }

    // Get status name for the note
    const oldStatusDef = await prisma.ticketStatus.findFirst({
      where: { tenantId: session.user.tenantId, slug: ticket.status },
    });
    const oldName = oldStatusDef?.name || ticket.status;
    const newName = statusDef?.name || body.newStatus;

    await prisma.ticket.update({ where: { id: ticketId }, data });

    await prisma.ticketNote.create({
      data: { ticketId, userId: session.user.id, content: `Status changed from ${oldName} to ${newName}`, isInternal: true, isSystem: true },
    });

    results.statusChanged = true;

    // Awaited for the same reason as every other notification: the host
    // freezes the function the moment it responds.
    if (body.newStatus === 'resolved' || body.newStatus === 'closed') {
      await sendTicketNotification(session.user.tenantId, ticketId, 'ticket_closed');
    } else {
      await sendTicketNotification(session.user.tenantId, ticketId, 'ticket_updated');
    }
  }

  // Email the note to the customer only when asked, and only for a public one.
  // A private note must never leave the system.
  if (body.emailCustomer && body.content?.trim() && !(body.isInternal ?? false)) {
    const author = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    });
    const outcome = await sendPublicNoteEmail(
      session.user.tenantId,
      ticketId,
      body.content,
      author?.name || 'Support',
    );
    results.emailed = outcome.sent;
    if (!outcome.sent) results.emailError = outcome.reason;
  }

  return jsonResponse(results, 201);
}, 'service_desk', 'write');

// Flip an existing note between customer-visible and internal. System notes are
// not editable: they are the audit trail.
export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const parts = req.nextUrl.pathname.split('/');
  const ticketId = parts[parts.length - 2];
  const body = await req.json();

  if (!body.noteId) return errorResponse('noteId is required');
  if (typeof body.isInternal !== 'boolean') return errorResponse('isInternal must be true or false');

  // Match on the ticket's tenant so a note id alone cannot reach another tenant.
  const note = await prisma.ticketNote.findFirst({
    where: {
      id: body.noteId,
      ticketId,
      ticket: { tenantId: session.user.tenantId },
    },
  });
  if (!note) return errorResponse('Note not found', 404);
  if (note.isSystem) return errorResponse('System notes cannot be changed', 400);

  const updated = await prisma.ticketNote.update({
    where: { id: note.id },
    data: { isInternal: body.isInternal },
  });

  return jsonResponse({ note: updated });
});
