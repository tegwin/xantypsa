import { NextRequest, NextResponse } from 'next/server';
import { getAppSession } from './session';
import { authenticateApiKey } from './apiKeyAuth';
import { isBlockedInDemo, DEMO_BLOCKED_MESSAGE } from './demo';

// ============================================================
// Response Helpers
// ============================================================

export function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ============================================================
// withTenant HOF - wraps API routes with auth + tenant isolation
// ============================================================

type ApiHandler = (req: NextRequest, session: any) => Promise<NextResponse>;

export function withTenant(
  handler: ApiHandler,
  _module?: string,
  _permission?: string
): (req: NextRequest, context?: any) => Promise<NextResponse> {
  return async (req: NextRequest, context?: any) => {
    try {
      let session: any = await getAppSession();

      // Fallback to API key authentication if no session
      if (!session?.user) {
        const apiKey = await authenticateApiKey(req);
        if (apiKey) {
          session = {
            user: {
              tenantId: apiKey.tenantId,
              id: 'api-key',
              permissions: apiKey.permissions,
            },
          } as any;
        }
      }

      if (!session?.user) {
        return errorResponse('Unauthorized', 401);
      }

      // Demo instances are shared, so deletions are refused centrally here
      // rather than route by route — one missed route would let a visitor
      // empty a list for everybody.
      if (isBlockedInDemo(req.method)) {
        return errorResponse(DEMO_BLOCKED_MESSAGE, 403);
      }
      if (!session.user.tenantId) {
        return errorResponse('No tenant context', 403);
      }
      // Permission check (basic)
      if (_module && _permission && !session.user.isSuperAdmin) {
        const permKey = `${_module}:${_permission === 'read' ? 'view' : _permission === 'write' ? 'edit' : _permission}`;
        const createKey = `${_module}:create`;
        const perms = session.user.permissions || [];
        if (!perms.includes(permKey) && !perms.includes(createKey) && !perms.includes(`${_module}:manage`)) {
          return errorResponse('Forbidden', 403);
        }
      }
      return await handler(req, session);
    } catch (err: any) {
      console.error('API Error:', err);
      return errorResponse(err.message || 'Internal Server Error', 500);
    }
  };
}

// ============================================================
// Parse query parameters for pagination, filtering, sorting
// ============================================================

export function parseSearchParams(url: string) {
  const { searchParams } = new URL(url);
  return {
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '25'),
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || '',
    type: searchParams.get('type') || '',
    companyId: searchParams.get('companyId') || '',
    assigneeId: searchParams.get('assigneeId') || '',
    userId: searchParams.get('userId') || '',
    projectId: searchParams.get('projectId') || '',
    ticketId: searchParams.get('ticketId') || '',
    sortBy: searchParams.get('sortBy') || 'createdAt',
    sortDir: (searchParams.get('sortDir') || 'desc') as 'asc' | 'desc',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    get skip() { return (this.page - 1) * this.limit; },
  };
}
