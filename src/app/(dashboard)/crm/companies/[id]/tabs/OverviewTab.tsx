'use client';

import Link from 'next/link';
import { StatusBadge } from '@/components/ui';
import { formatRelativeTime } from '@/lib/utils';
import {
  Globe, Phone, Mail, MapPin, ExternalLink,
  AtSign,
} from 'lucide-react';

interface OverviewTabProps {
  company: any;
}

export default function OverviewTab({ company }: OverviewTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Company Details */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Company Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400 block mb-1">Company Name</span>
              <span className="text-white">{company.name}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-1">Type</span>
              <StatusBadge status={company.type} />
            </div>
            {company.industry && (
              <div>
                <span className="text-slate-400 block mb-1">Industry</span>
                <span className="text-white">{company.industry}</span>
              </div>
            )}
            {company.size && (
              <div>
                <span className="text-slate-400 block mb-1">Size</span>
                <span className="text-white">{company.size} employees</span>
              </div>
            )}
            {company.taxId && (
              <div>
                <span className="text-slate-400 block mb-1">Tax ID / VAT</span>
                <span className="text-white font-mono text-xs">{company.taxId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {company.address1 && (
              <div>
                <span className="text-slate-400 block mb-1">Address 1</span>
                <span className="text-white">{company.address1}</span>
              </div>
            )}
            {company.address2 && (
              <div>
                <span className="text-slate-400 block mb-1">Address 2</span>
                <span className="text-white">{company.address2}</span>
              </div>
            )}
            {company.address3 && (
              <div>
                <span className="text-slate-400 block mb-1">Address 3</span>
                <span className="text-white">{company.address3}</span>
              </div>
            )}
            {company.city && (
              <div>
                <span className="text-slate-400 block mb-1">City</span>
                <span className="text-white">{company.city}</span>
              </div>
            )}
            {company.state && (
              <div>
                <span className="text-slate-400 block mb-1">State / County</span>
                <span className="text-white">{company.state}</span>
              </div>
            )}
            {company.postcode && (
              <div>
                <span className="text-slate-400 block mb-1">Postcode / Zip</span>
                <span className="text-white">{company.postcode}</span>
              </div>
            )}
            {company.country && (
              <div>
                <span className="text-slate-400 block mb-1">Country</span>
                <span className="text-white">{company.country}</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {company.notes && (
          <div className="glass rounded-xl p-6">
            <h3 className="text-white font-semibold mb-3">Notes</h3>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{company.notes}</p>
          </div>
        )}

        {/* Recent Tickets */}
        {company.tickets?.length > 0 && (
          <div className="glass rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Recent Tickets</h3>
            <div className="space-y-2">
              {company.tickets.slice(0, 5).map((t: any) => (
                <Link key={t.id} href={`/service-desk/tickets/${t.id}`}
                  className="flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-slate-400">{t.ticketNumber}</span>
                    <span className="text-white text-sm">{t.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={t.priority} />
                    <StatusBadge status={t.status} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        <div className="glass rounded-xl p-6 space-y-3">
          <h3 className="text-white font-semibold">Contact Details</h3>
          {company.website && (
            <a href={company.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300">
              <Globe className="w-4 h-4" /> {company.website.replace(/^https?:\/\//, '')}
              <ExternalLink className="w-3 h-3 ml-auto" />
            </a>
          )}
          {company.phone && (
            <a href={`tel:${company.phone}`} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
              <Phone className="w-4 h-4 text-slate-400" /> {company.phone}
            </a>
          )}
          {company.email && (
            <a href={`mailto:${company.email}`} className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
              <Mail className="w-4 h-4 text-slate-400" /> {company.email}
            </a>
          )}
          {(company.address1 || company.city) && (
            // Opens the address in Google Maps. Built from whichever parts are
            // filled in, so a half complete address still finds the town.
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                [company.address1, company.address2, company.address3, company.city,
                 company.state, company.postcode, company.country].filter(Boolean).join(', ')
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 text-sm text-slate-300 hover:text-white"
            >
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
              <div>
                {company.address1 && <div>{company.address1}</div>}
                {company.address2 && <div>{company.address2}</div>}
                {company.address3 && <div>{company.address3}</div>}
                <div>{[company.city, company.state, company.postcode].filter(Boolean).join(', ')}</div>
                {company.country && <div>{company.country}</div>}
              </div>
              <ExternalLink className="w-3 h-3 ml-auto mt-0.5 shrink-0" />
            </a>
          )}
        </div>

        {/* Which incoming email lands on this company. Shown read-only so the
            routing is visible without opening the edit dialog. */}
        <div className="glass rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <AtSign className="w-4 h-4 text-slate-400" />
            <h3 className="text-white font-semibold">Email routing</h3>
          </div>

          {company.isCatchAll ? (
            <p className="text-sm text-slate-400">
              This is the <strong className="text-slate-200">catch-all</strong>. Email from any
              sender that matches no contact and no client domain is filed here, so nothing is
              ever lost. Move those tickets to the right client and add the domain there.
            </p>
          ) : company.emailDomains?.length ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {company.emailDomains.map((d: string) => (
                  <span
                    key={d}
                    className="px-2 py-0.5 rounded-md bg-brand-600/15 text-brand-300 text-xs font-mono"
                  >
                    @{d}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-500">
                Email from these domains raises a ticket against this company automatically.
              </p>
            </>
          ) : company.website ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-white/5 text-slate-300 text-xs font-mono">
                  @{company.website.replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '').split('/')[0]}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Taken from the website, since no domains are set explicitly. Add them via{' '}
                <span className="text-slate-300">Edit</span> if this client sends from a
                different domain.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-400">
              No domain or website set, so email from this client only matches when the sender is
              already a contact. Anything else goes to the catch-all. Add either via{' '}
              <span className="text-slate-300">Edit</span>.
            </p>
          )}
        </div>

        <div className="glass rounded-xl p-6 space-y-3">
          <h3 className="text-white font-semibold">Quick Actions</h3>
          <div className="space-y-2">
            <Link href={`/service-desk/tickets?companyId=${company.id}`} className="block w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-300 transition-colors">
              View all tickets →
            </Link>
            <Link href={`/quotes/list?companyId=${company.id}`} className="block w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-300 transition-colors">
              View all quotes →
            </Link>
            <Link href={`/invoices/list?companyId=${company.id}`} className="block w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-300 transition-colors">
              View all invoices →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
