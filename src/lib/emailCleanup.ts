// ============================================================
// Trimming an incoming email down to what was actually written
// ============================================================
// A reply carries the whole thread and a signature block behind it. Left alone,
// every ticket note repeats the conversation back at the reader and buries the
// one new sentence. Both trims are optional, because an MSP that needs the
// quoted history for evidence should be able to keep it.

export interface CleanupOptions {
  /** Remove the sender's sign-off block. */
  stripSignature?: boolean;
  /** Remove the quoted thread below a reply. */
  stripQuotedHistory?: boolean;
}

// A line that starts the quoted thread. Deliberately anchored and specific:
// a loose match would cut a message in half at the word "from".
const HISTORY_MARKERS: RegExp[] = [
  /^-{2,}\s*Original Message\s*-{2,}\s*$/im,
  /^_{10,}\s*$/m,                                  // Outlook's divider
  /^On .{3,200}\s+wrote:\s*$/im,                   // Gmail, Apple Mail
  /^From:\s*.+$/im,                                // Outlook's quoted header
  /^Sent:\s*.+$/im,
  /^>{1,}\s?.*$/m,                                 // plain-text quoting
];

// A line that begins a signature. "-- " on its own line is the standard
// (RFC 3676); the rest are what mail clients actually append.
const SIGNATURE_MARKERS: RegExp[] = [
  /^--\s*$/m,
  /^Sent from my \w+/im,
  /^Get Outlook for \w+/im,
  /^Kind regards[,.]?\s*$/im,
  /^Best regards[,.]?\s*$/im,
  /^Many thanks[,.]?\s*$/im,
  /^Regards[,.]?\s*$/im,
  /^Thanks[,.]?\s*$/im,
  /^Cheers[,.]?\s*$/im,
];

/** The earliest position any of these patterns matches, or -1. */
function earliestMatch(text: string, patterns: RegExp[]): number {
  let best = -1;
  for (const pattern of patterns) {
    const m = pattern.exec(text);
    if (m && m.index >= 0 && (best === -1 || m.index < best)) best = m.index;
  }
  return best;
}

/**
 * Cut an email body back to the new message.
 *
 * Never returns empty: if a trim would take everything, the original is kept.
 * A note that says nothing is worse than one carrying a signature, and a short
 * reply like "Yes, thanks" is exactly the shape that trips a signature match.
 */
export function cleanEmailBody(body: string, options: CleanupOptions = {}): string {
  if (!body) return '';
  let text = body;

  if (options.stripQuotedHistory) {
    const cut = earliestMatch(text, HISTORY_MARKERS);
    if (cut > 0) {
      const kept = text.slice(0, cut).trim();
      if (kept) text = kept;
    }
  }

  if (options.stripSignature) {
    const cut = earliestMatch(text, SIGNATURE_MARKERS);
    if (cut > 0) {
      const kept = text.slice(0, cut).trim();
      if (kept) text = kept;
    }
  }

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/** Read the two switches off a tenant's settings, both on by default. */
export function cleanupOptionsFrom(settings: any): CleanupOptions {
  const email = settings?.emailCleanup ?? {};
  return {
    stripSignature: email.stripSignature !== false,
    stripQuotedHistory: email.stripQuotedHistory !== false,
  };
}
