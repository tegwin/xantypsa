// ============================================================
// Deciding which client an incoming email belongs to
// ============================================================
// Three steps, most specific first:
//
//   1. A contact with that exact email address — the strongest signal, and it
//      also tells us who to attribute the ticket to.
//   2. The sender's email domain against Company.emailDomains.
//   2b. Failing that, against the domain of the company's website — most
//       clients send from the domain they host their site on, so routing works
//       without maintaining a second list by hand.
//   3. The catch-all company, so an email is never dropped for not matching.
//
// Step 3 is why the catch-all cannot be deleted: without it, mail from an
// unknown sender would have nowhere to go.

import { prisma } from './prisma';

export interface EmailRoute {
  companyId: string | null;
  contactId: string | null;
  /** How the company was decided, for the ticket's audit trail. */
  matchedBy: 'contact' | 'domain' | 'website' | 'catch_all' | 'none';
}

/** Domain part of an address, lowercased. Null if it isn't an address. */
export function emailDomain(address?: string | null): string | null {
  if (!address) return null;
  const at = address.lastIndexOf('@');
  if (at < 0 || at === address.length - 1) return null;
  return address.slice(at + 1).trim().toLowerCase();
}

/**
 * The bare domain of a company's website, for matching senders against it.
 * "https://www.sondelaconsulting.com/about" → "sondelaconsulting.com".
 */
export function websiteDomain(website?: string | null): string | null {
  if (!website) return null;
  const host = website
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
    .split(':')[0];
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return null;
  return isGenericDomain(host) ? null : host;
}

/**
 * Public mailbox providers. A sender at gmail.com tells us nothing about which
 * client they are, so these never match a company by domain — otherwise the
 * first client who listed gmail.com would collect everyone else's email.
 */
const GENERIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.co.uk',
  'live.com', 'live.co.uk', 'msn.com', 'yahoo.com', 'yahoo.co.uk', 'aol.com',
  'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'gmx.com',
  'zoho.com', 'yandex.com', 'mail.com', 'btinternet.com', 'sky.com',
]);

export function isGenericDomain(domain: string | null): boolean {
  return !!domain && GENERIC_DOMAINS.has(domain);
}

/** The tenant's catch-all, which every install has. */
export async function getCatchAllCompany(tenantId: string) {
  return prisma.company.findFirst({
    where: { tenantId, isCatchAll: true },
    select: { id: true, name: true },
  });
}

export async function routeIncomingEmail(
  tenantId: string,
  senderEmail?: string | null
): Promise<EmailRoute> {
  const address = senderEmail?.trim().toLowerCase() || null;

  // 1. Known contact.
  if (address) {
    const contact = await prisma.contact.findFirst({
      where: { tenantId, email: { equals: address, mode: 'insensitive' } },
      select: { id: true, companyId: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (contact?.companyId) {
      return { companyId: contact.companyId, contactId: contact.id, matchedBy: 'contact' };
    }
    // A contact with no company still identifies the person.
    if (contact) {
      const catchAll = await getCatchAllCompany(tenantId);
      return { companyId: catchAll?.id ?? null, contactId: contact.id, matchedBy: 'catch_all' };
    }
  }

  // 2. Sender's domain against the client's registered domains.
  const domain = emailDomain(address);
  if (domain && !isGenericDomain(domain)) {
    const company = await prisma.company.findFirst({
      where: { tenantId, emailDomains: { has: domain } },
      select: { id: true },
    });
    if (company) {
      return { companyId: company.id, contactId: null, matchedBy: 'domain' };
    }

    // 2b. Nothing explicit, so fall back to the company's website. Most clients
    // send from the same domain they host their site on, and it is already
    // filled in — this makes routing work without anyone maintaining a second
    // list. An explicit entry above always wins.
    const byWebsite = await prisma.company.findMany({
      where: { tenantId, website: { not: null }, isCatchAll: false },
      select: { id: true, website: true },
    });
    const match = byWebsite.find((c) => websiteDomain(c.website) === domain);
    if (match) {
      return { companyId: match.id, contactId: null, matchedBy: 'website' };
    }
  }

  // 3. Catch-all.
  const catchAll = await getCatchAllCompany(tenantId);
  return {
    companyId: catchAll?.id ?? null,
    contactId: null,
    matchedBy: catchAll ? 'catch_all' : 'none',
  };
}

/**
 * Clean a user-entered domain list before storing it.
 *
 * People paste "@acme.com", "https://acme.com/", "Acme.COM" and full email
 * addresses. Store one canonical lowercase host for each so a match cannot be
 * missed on formatting alone, and drop generic mailbox providers — listing
 * gmail.com against a client would hijack every personal sender.
 */
export function normaliseDomains(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[\s,;]+/)
      : [];

  const cleaned = raw
    .map((v) => String(v).trim().toLowerCase())
    .filter(Boolean)
    .map((v) => v.replace(/^https?:\/\//, '').replace(/^www\./, ''))
    // Accept a whole address and keep just the domain.
    .map((v) => (v.includes('@') ? v.slice(v.lastIndexOf('@') + 1) : v))
    .map((v) => v.replace(/\/.*$/, '').replace(/^\.+|\.+$/g, ''))
    // Must look like a domain: at least one dot, no spaces.
    .filter((v) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(v))
    .filter((v) => !isGenericDomain(v));

  return Array.from(new Set(cleaned));
}
