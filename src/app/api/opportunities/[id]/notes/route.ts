import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { getCrmRequired, missingCloseReason } from '@/lib/crmRequired';

function opportunityIdFrom(req: NextRequest) {
  const parts = req.nextUrl.pathname.split('/');
  return parts[parts.length - 2];
}

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const opportunityId = opportunityIdFrom(req);
  const notes = await prisma.opportunityNote.findMany({
    where: { opportunityId, tenantId: session.user.tenantId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return jsonResponse({ items: notes });
}, 'crm', 'read');

/**
 * Add a note, and optionally move the deal on in the same action.
 *
 * Stage changes are recorded as a system note so the history of a deal reads
 * in one place rather than being split between a note list and an audit log.
 */
export const POST = withTenant(async (req: NextRequest, session: any) => {
  const opportunityId = opportunityIdFrom(req);
  const tenantId = session.user.tenantId;
  const body = await req.json();

  if (!body.content?.trim() && !body.stage) {
    return errorResponse('Add a note or change the stage');
  }

  const opportunity = await prisma.opportunity.findFirst({
    where: { id: opportunityId, tenantId },
  });
  if (!opportunity) return errorResponse('Opportunity not found', 404);

  const results: any = { note: null, stageChanged: false };

  if (body.content?.trim()) {
    results.note = await prisma.opportunityNote.create({
      data: {
        tenantId,
        opportunityId,
        userId: session.user.id,
        content: body.content,
      },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  if (body.stage && body.stage !== opportunity.stage) {
    const stages = await prisma.pipelineStage.findMany({ where: { tenantId } });
    const from = stages.find((s) => s.slug === opportunity.stage);
    const to = stages.find((s) => s.slug === body.stage);

    // Closing from the notes panel must obey the same rules as the Won and
    // Lost buttons.
    const outcome = to?.isWon ? 'won' : to?.isLost ? 'lost' : null;
    const reasonProblem = missingCloseReason(
      await getCrmRequired(tenantId),
      outcome as 'won' | 'lost' | null,
      body.reasonId ?? opportunity.reasonId,
    );
    if (reasonProblem) return errorResponse(reasonProblem);

    const data: any = { stage: body.stage };

    // A terminal stage closes the deal and takes the probability with it.
    if (to?.isWon) {
      data.probability = 100;
      data.closedAt = new Date();
    } else if (to?.isLost) {
      data.probability = 0;
      data.closedAt = new Date();
    } else {
      if (to) data.probability = to.probability;
      data.closedAt = null;
    }

    if (body.reasonId !== undefined) data.reasonId = body.reasonId || null;

    await prisma.opportunity.update({ where: { id: opportunityId }, data });

    await prisma.opportunityNote.create({
      data: {
        tenantId,
        opportunityId,
        userId: session.user.id,
        isSystem: true,
        content: `Stage changed from ${from?.name || opportunity.stage} to ${to?.name || body.stage}`,
      },
    });

    results.stageChanged = true;
  }

  return jsonResponse(results, 201);
}, 'crm', 'write');
