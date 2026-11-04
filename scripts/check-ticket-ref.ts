/**
 * Does a reply still find its ticket? Run: npx tsx scripts/check-ticket-ref.ts
 *
 * Covers the subject tag, the stripped-subject body fallback, and the cases a
 * loose "#123" must NOT hijack. No database: the pure matchers only.
 */
import assert from 'node:assert';
import { withTicketTag, refsInSubject, refsInBody, ticketRefFooter } from '../src/lib/ticketRef';

// The tag goes on, once, however the subject already reads.
assert.equal(withTicketTag('Printer down', 42), '[#42] Printer down');
assert.equal(withTicketTag('[#42] Printer down', 42), '[#42] Printer down');
assert.equal(withTicketTag('Re: [#42] Printer down', 42), 'Re: [#42] Printer down');

// Subject forms a mail client might hand back.
assert.deepEqual(refsInSubject('Re: [#42] Printer down'), [42]);
assert.deepEqual(refsInSubject('RE: FW: [Ticket #42] Printer'), [42]);
assert.deepEqual(refsInSubject('TKT-42 printer'), [42]);
assert.deepEqual(refsInSubject('Ticket 42 - printer'), [42]);
assert.deepEqual(refsInSubject('printer #42'), [42]);

// Subject rewritten by the customer: the footer in the quoted body saves it.
assert.deepEqual(refsInBody(`Thanks.\n\n> ${ticketRefFooter(42)}`), [42]);
assert.deepEqual(refsInBody('nothing here, invoice #42 paid'), []);
assert.deepEqual(refsInBody('PO 42 and order #99 shipped'), []);

// Several references: every candidate is offered, in the order found, so the
// caller can take the first that is a real ticket.
assert.deepEqual(refsInSubject('[#7] was [#9]'), [7, 9]);

console.log('ticket reference matching: ok');
