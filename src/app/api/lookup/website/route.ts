// ============================================================
// POST /api/lookup/website - read a postal address off a website
// ============================================================

import { NextRequest } from 'next/server';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { lookupCompanyFromWebsite, safeWebsiteUrl } from '@/lib/websiteLookup';

export const dynamic = 'force-dynamic';

export const POST = withTenant(async (req: NextRequest) => {
  const { website } = await req.json().catch(() => ({ website: '' }));

  if (!safeWebsiteUrl(String(website ?? ''))) {
    return errorResponse('Enter a website address first, for example acme.com', 400);
  }

  const company = await lookupCompanyFromWebsite(String(website));
  if (!company) {
    return jsonResponse({
      company: null,
      address: null,
      message: 'Nothing published on that website to read. Fill it in by hand.',
    });
  }

  // `address` is kept at the top level for the company edit form, which asks
  // only for an address.
  return jsonResponse({ company, address: company.address ?? null });
});
