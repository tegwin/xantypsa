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
  // Two dashes is the standard, but mail clients and people write three or
  // more, and an em dash rule renders as a run of them. Anything from two up.
  /^[-_=]{2,}\s*$/m,
  // Outlook's "sent from" and promotional footer lines sit above the contact
  // block, so the cut has to start at them, not at the name.
  /^Click here to purchase/im,
  /^This e?-?mail (and any attachments )?(is|are) confidential/im,
  /^Please consider the environment/im,
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

// Tags that end a line when a mail client renders them. The old converter
// handled only <br> and </p>, so a signature written in <div>s arrived as one
// run-on line and no marker ever sat on a line of its own.
const BLOCK_END = /<\/(p|div|h[1-6]|li|tr|blockquote|table|section|article)\s*>/gi;

/** HTML as a mail client lays it out: block elements end the line. */
export function htmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(BLOCK_END, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * The same trim, applied to the HTML rather than to a flattened copy.
 *
 * The HTML is split at the boundaries a mail client would break a line on,
 * each piece is read as text, and everything from the first piece that starts
 * a signature or a quoted thread is dropped. Working on the pieces keeps the
 * formatting of what is left intact, which a text-only trim cannot do.
 */
export function cleanEmailHtml(html: string, options: CleanupOptions = {}): string {
  if (!html) return '';
  if (!options.stripSignature && !options.stripQuotedHistory) return html;

  // Keep the separators, so rebuilding the kept part changes nothing about it.
  const pieces = html.split(/(<br\s*\/?>|<\/(?:p|div|h[1-6]|li|tr|blockquote)\s*>)/gi);

  const patterns = [
    ...(options.stripQuotedHistory ? HISTORY_MARKERS : []),
    ...(options.stripSignature ? SIGNATURE_MARKERS : []),
  ];

  for (let i = 0; i < pieces.length; i++) {
    const text = htmlToText(pieces[i] ?? '').trim();
    if (!text) continue;
    // Each marker is anchored to a whole line, so the piece is tested on its
    // own rather than against the document.
    if (patterns.some((p) => new RegExp(p.source, p.flags.replace('g', '')).test(text))) {
      const kept = pieces.slice(0, i).join('');
      // Never return nothing: a reply that is only a sign-off is kept whole.
      if (htmlToText(kept).trim()) return kept;
      return html;
    }
  }

  return html;
}
