'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SETTINGS_SECTIONS } from './sections';

/**
 * The administration menu.
 *
 * Grouped, because a flat list of fourteen screens is a list nobody reads. The
 * section a page belongs to stays visible while you are on it.
 */
export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings" className="w-full lg:w-60 shrink-0">
      <ul className="space-y-5">
        {SETTINGS_SECTIONS.map((section) => (
          <li key={section.title}>
            <p className="px-3 mb-1.5 text-xs font-medium uppercase tracking-wide text-surface-500">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.links.map((link) => {
                // An exact match, so /settings/email does not light up while
                // you are on /settings/email/processing.
                const active = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
                        active
                          ? 'bg-brand-500/15 text-white border-l-2 border-brand-500'
                          : 'text-surface-400 hover:text-white hover:bg-white/5 border-l-2 border-transparent'
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  );
}
