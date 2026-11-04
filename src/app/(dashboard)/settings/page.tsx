import Link from 'next/link';
import { PageHeader } from '@/components/ui';
import { SETTINGS_SECTIONS } from './sections';

export const metadata = { title: 'Administration' };

/**
 * The administration landing page: every section as a block of outlined cards,
 * so somebody who does not yet know where a setting lives can read the whole
 * area on one screen.
 */
export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Administration"
        description="Everything that configures how the system behaves."
      />

      {SETTINGS_SECTIONS.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-sm font-semibold text-surface-200">{section.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {section.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border border-surface-700 bg-surface-800/40 p-4 transition-colors hover:border-brand-500/60 hover:bg-surface-800"
              >
                <p className="font-medium text-surface-100">{link.label}</p>
                <p className="mt-1 text-sm text-surface-400">{link.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
