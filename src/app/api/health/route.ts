// ============================================================
// Health check
// ============================================================
// Railway, Render and the container's own HEALTHCHECK poll this. It reports
// unhealthy when the database is unreachable, so a bad deploy is rolled back
// rather than left serving errors.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ok',
      database: 'up',
      latencyMs: Date.now() - startedAt,
      uptimeSeconds: Math.round(process.uptime()),
    });
  } catch (err: any) {
    // 503 so the platform stops routing traffic here.
    return NextResponse.json(
      { status: 'degraded', database: 'down', error: err?.message ?? 'unknown' },
      { status: 503 }
    );
  }
}
