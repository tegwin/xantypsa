import { isDemoMode } from '@/lib/demo';

/**
 * Tells visitors where they are. Rendered server-side from an environment
 * variable, so it cannot be dismissed away by a client that would rather not
 * see it — and it never ships on a real install.
 */
export default function DemoBanner() {
  if (!isDemoMode()) return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2">
      <p className="text-center text-sm text-amber-200">
        <strong>Demo.</strong> Invented data, shared by everyone, reset nightly.
        Create and edit anything — deleting and new sign-ups are switched off.
      </p>
    </div>
  );
}
