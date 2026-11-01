// ============================================================
// Demo mode
// ============================================================
// A public instance filled with invented data that strangers can click around
// in. Set DEMO_MODE=true.
//
// Everyone shares one tenant, so the guards here are about keeping the demo
// usable for the next visitor rather than protecting anything valuable:
//
//   * No deleting. One person emptying the tickets list ruins it for everyone.
//   * No new accounts. Sign-ups would let people lock others out, and the
//     account list is part of what is on show.
//   * No outbound email. A demo wired to real SMTP is a spam relay, and the
//     invented contacts might not stay invented if someone edits one.
//
// None of this is a security boundary - the demo holds nothing worth taking.
// It stops accidents and casual vandalism.

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true';
}

/** Methods that change data. Reads stay open so the demo is worth visiting. */
const MUTATING = new Set(['DELETE']);

export function isBlockedInDemo(method: string): boolean {
  return isDemoMode() && MUTATING.has(method.toUpperCase());
}

export const DEMO_BLOCKED_MESSAGE =
  'This is a demo, so nothing can be deleted - everyone shares it. ' +
  'Create and edit freely; it resets nightly.';

export const DEMO_NO_SIGNUP_MESSAGE =
  'New accounts are disabled on the demo. Sign in with the details on the login page.';
