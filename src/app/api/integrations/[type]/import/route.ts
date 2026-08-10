import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

// POST /api/integrations/[type]/import - Import selected devices as Assets
export const POST = withTenant(async (req: NextRequest, session: any) => {
  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  const typeIdx = segments.indexOf('integrations') + 1;
  const type = segments[typeIdx] || '';

  if (!['ninja', 'datto'].includes(type)) {
    return errorResponse('Unsupported RMM type', 400);
  }

  const body = await req.json();
  const devices: any[] = body.devices;

  if (!Array.isArray(devices) || devices.length === 0) {
    return errorResponse('No devices provided', 400);
  }

  const tenantId = session.user.tenantId;

  // Check which are already imported
  const existingAssets = await prisma.asset.findMany({
    where: { tenantId, rmmSource: type },
    select: { rmmExternalId: true },
  });
  const importedIds = new Set(existingAssets.map((a) => a.rmmExternalId));

  // Look up company mappings from customData
  const companies = await prisma.company.findMany({
    where: { tenantId },
    select: { id: true, customData: true },
  });

  const externalIdToCompanyId = new Map<string, string>();
  for (const c of companies) {
    const cd = c.customData as Record<string, any>;
    if (cd?.rmmMappings) {
      const mapping = cd.rmmMappings as Record<string, string>;
      if (mapping[type]) {
        externalIdToCompanyId.set(mapping[type], c.id);
      }
    }
  }

  const created: string[] = [];
  const skipped: string[] = [];

  for (const device of devices) {
    if (importedIds.has(String(device.id))) {
      skipped.push(device.name || device.id);
      continue;
    }

    const companyId = externalIdToCompanyId.get(device.customerExternalId) || null;

    await prisma.asset.create({
      data: {
        tenantId,
        companyId,
        name: device.name || 'Unknown Device',
        type: device.type || 'device',
        manufacturer: device.manufacturer || null,
        model: device.model || null,
        serialNumber: device.serialNumber || null,
        status: 'active',
        rmmSource: type,
        rmmExternalId: String(device.id),
        customData: {
          hostname: device.hostname || null,
          os: device.os || null,
          customerExternalId: device.customerExternalId || null,
        },
      },
    });

    created.push(device.name || device.id);
  }

  return jsonResponse({
    imported: created.length,
    skipped: skipped.length,
    importedNames: created,
    skippedNames: skipped,
  });
}, 'settings', 'write');
