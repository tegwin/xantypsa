import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenant, jsonResponse, errorResponse } from '@/lib/api';

interface NormalizedDevice {
  id: string;
  name: string;
  hostname: string;
  type: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  os: string;
  customerExternalId: string;
  alreadyImported: boolean;
}

// Normalize NinjaOne device response
function normalizeNinjaDevice(d: any): NormalizedDevice {
  return {
    id: String(d.id),
    name: d.systemName || d.dnsName || d.displayName || 'Unknown',
    hostname: d.dnsName || d.systemName || '',
    type: d.nodeClass === 'WINDOWS_SERVER' || d.nodeClass === 'LINUX_SERVER' || d.nodeClass === 'MAC_SERVER' ? 'server' : 'device',
    manufacturer: d.system?.manufacturer || '',
    model: d.system?.model || '',
    serialNumber: d.system?.serialNumber || '',
    os: d.os?.name || '',
    customerExternalId: String(d.organizationId || ''),
    alreadyImported: false,
  };
}

// Normalize Datto RMM device response
function normalizeDattoDevice(d: any): NormalizedDevice {
  return {
    id: String(d.uid || d.id),
    name: d.hostname || d.description || 'Unknown',
    hostname: d.hostname || '',
    type: d.deviceType?.category === 'Server' ? 'server' : 'device',
    manufacturer: d.manufacturer || '',
    model: d.model || '',
    serialNumber: d.serialNumber || '',
    os: d.operatingSystem || '',
    customerExternalId: String(d.siteUid || d.siteId || ''),
    alreadyImported: false,
  };
}

// GET /api/integrations/[type]/devices - Fetch devices from RMM
export const GET = withTenant(async (req: NextRequest, session: any) => {
  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  // path: /api/integrations/{type}/devices
  const typeIdx = segments.indexOf('integrations') + 1;
  const type = segments[typeIdx] || '';

  if (!['ninja', 'datto'].includes(type)) {
    return errorResponse('Unsupported RMM type. Must be ninja or datto.', 400);
  }

  const integration = await prisma.integration.findFirst({
    where: { tenantId: session.user.tenantId, type, isActive: true },
  });

  if (!integration) {
    return errorResponse(`No active ${type} integration found. Configure it first.`, 404);
  }

  const config = integration.config as Record<string, string>;

  let devices: NormalizedDevice[] = [];

  try {
    if (type === 'ninja') {
      const apiUrl = config.apiUrl || 'https://app.ninjarmm.com';
      const res = await fetch(`${apiUrl}/v2/devices?pageSize=1000`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        const text = await res.text();
        return errorResponse(`NinjaOne API error: ${res.status} ${text}`, 502);
      }
      const data = await res.json();
      devices = (Array.isArray(data) ? data : data.results || []).map(normalizeNinjaDevice);
    } else if (type === 'datto') {
      const apiUrl = config.apiUrl;
      if (!apiUrl) return errorResponse('Datto API URL is required', 400);
      const res = await fetch(`${apiUrl}/api/v2/device?max=250`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        const text = await res.text();
        return errorResponse(`Datto RMM API error: ${res.status} ${text}`, 502);
      }
      const data = await res.json();
      devices = (data.devices || data.data || []).map(normalizeDattoDevice);
    }
  } catch (err: any) {
    return errorResponse(`Failed to fetch devices: ${err.message}`, 502);
  }

  // Mark devices that are already imported
  const existingAssets = await prisma.asset.findMany({
    where: { tenantId: session.user.tenantId, rmmSource: type },
    select: { rmmExternalId: true },
  });
  const importedIds = new Set(existingAssets.map((a) => a.rmmExternalId));
  devices = devices.map((d) => ({ ...d, alreadyImported: importedIds.has(d.id) }));

  return jsonResponse({ devices, total: devices.length });
}, 'settings', 'read');
