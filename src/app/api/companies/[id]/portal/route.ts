// ============================================================
// A company's portal settings
// ============================================================

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { validateSlug, suggestSlug } from '@/lib/portal/slug';

function companyId(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split('/');
  return parts[parts.indexOf('companies') + 1];
}

export const GET = withTenant(async (req: NextRequest, session: any) => {
  const id = companyId(req);
  const company = await prisma.company.findFirst({
    where: { id, tenantId: session.user.tenantId },
    select: { id: true, name: true, portalSlug: true, portalEnabled: true },
  });
  if (!company) return errorResponse('Company not found', 404);

  const contacts = await prisma.contact.findMany({
    where: { companyId: id, tenantId: session.user.tenantId, isActive: true },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      portalEnabled: true, portalLastLogin: true,
    },
    orderBy: [{ portalEnabled: 'desc' }, { firstName: 'asc' }],
  });

  return jsonResponse({
    ...company,
    suggestedSlug: company.portalSlug ?? suggestSlug(company.name),
    contacts,
  });
}, 'crm', 'read');

export const PATCH = withTenant(async (req: NextRequest, session: any) => {
  const id = companyId(req);
  const body = await req.json();

  const company = await prisma.company.findFirst({
    where: { id, tenantId: session.user.tenantId },
    select: { id: true, name: true, portalSlug: true },
  });
  if (!company) return errorResponse('Company not found', 404);

  const data: Record<string, any> = {};

  if (body.portalSlug !== undefined) {
    const check = validateSlug(body.portalSlug);
    if (!check.ok) return errorResponse(check.error!, 400);

    // Slugs are globally unique because the URL carries no tenant, so this can
    // collide with another MSP's client on a shared install. Say so plainly
    // rather than surfacing a constraint violation.
    const taken = await prisma.company.findFirst({
      where: { portalSlug: check.slug, NOT: { id } },
      select: { id: true },
    });
    if (taken) {
      return errorResponse('That portal address is already taken. Try another.', 409);
    }
    data.portalSlug = check.slug;
  }

  if (body.portalEnabled !== undefined) {
    const slug = data.portalSlug ?? company.portalSlug;
    if (body.portalEnabled && !slug) {
      return errorResponse('Set a portal address before switching the portal on.', 400);
    }
    data.portalEnabled = !!body.portalEnabled;
  }

  const updated = await prisma.company.update({
    where: { id },
    data,
    select: { id: true, portalSlug: true, portalEnabled: true },
  });

  return jsonResponse(updated);
}, 'crm', 'write');
