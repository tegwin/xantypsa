// ============================================================
// POST /api/lookup/website - read a company's logo off its site
// ============================================================

import { NextRequest } from 'next/server';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';
import { lookupLogoFromWebsite, safeWebsiteUrl } from '@/lib/websiteLookup';

export const dynamic = 'force-dynamic';

export const POST = withTenant(async (req: NextRequest) => {
  const { website } = await req.json().catch(() => ({ website: '' }));

  if (!safeWebsiteUrl(String(website ?? ''))) {
    return errorResponse('Enter a website address first, for example acme.com', 400);
  }

  const logoUrl = await lookupLogoFromWebsite(String(website));
  if (!logoUrl) {
    return jsonResponse({ logoUrl: null, message: 'No logo found on that website.' });
  }

  return jsonResponse({ logoUrl });
});
