import SettingsNav from './SettingsNav';

/**
 * Administration: a grouped menu down the left, the screen itself on the right.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row gap-8">
      <SettingsNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
