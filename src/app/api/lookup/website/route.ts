// ============================================================
// POST /api/lookup/website - read a postal address off a website
// ============================================================

import { NextRequest } from 'next/server';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { lookupAddressFromWebsite, safeWebsiteUrl } from '@/lib/websiteLookup';

export const dynamic = 'force-dynamic';

export const POST = withTenant(async (req: NextRequest) => {
  const { website } = await req.json().catch(() => ({ website: '' }));

  if (!safeWebsiteUrl(String(website ?? ''))) {
    return errorResponse('Enter a website address first, for example acme.com', 400);
  }

  const address = await lookupAddressFromWebsite(String(website));
  if (!address) {
    return jsonResponse({
      address: null,
      message: 'No address published on that website. Enter it by hand.',
    });
  }

  return jsonResponse({ address });
});
