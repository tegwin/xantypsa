import assert from 'node:assert';
import { cleanEmailBody, cleanupOptionsFrom } from '../src/lib/emailCleanup';

const both = { stripSignature: true, stripQuotedHistory: true };

// The new message survives, the sign-off goes.
assert.equal(
  cleanEmailBody('The printer is offline again.\n\nKind regards\nAlex\nAcme Ltd\n07700 900000', both),
  'The printer is offline again.'
);

// A quoted thread is cut at the marker, not mid-sentence.
assert.equal(
  cleanEmailBody('Yes, that fixed it.\n\nOn 3 Nov 2026 at 09:12, Support wrote:\n> Please try again.', both),
  'Yes, that fixed it.'
);

// Outlook's quoted header.
assert.equal(
  cleanEmailBody('Any update?\n\nFrom: Support\nSent: Monday\nTo: Alex', both),
  'Any update?'
);

// Trimming never empties a message: a bare sign-off is kept as-is.
assert.equal(cleanEmailBody('Thanks', both), 'Thanks');

// Switched off, nothing is touched.
const raw = 'Hello\n\nKind regards\nAlex';
assert.equal(cleanEmailBody(raw, { stripSignature: false, stripQuotedHistory: false }), raw);

// Both default to on, and an explicit false is honoured.
assert.deepEqual(cleanupOptionsFrom(undefined), { stripSignature: true, stripQuotedHistory: true });
assert.deepEqual(
  cleanupOptionsFrom({ emailCleanup: { stripSignature: false } }),
  { stripSignature: false, stripQuotedHistory: true }
);

console.log('email cleanup: ok');

// Three dashes, which is what people and mail clients actually write.
assert.equal(
  cleanEmailBody(
    'Thanks for letting me know this should be updated\n\n---\nClick here to purchase my book.\n\nChris Timm | Sondela Consulting\nM: 07887998167',
    both
  ),
  'Thanks for letting me know this should be updated'
);

// A promotional footer above the contact block starts the cut.
assert.equal(
  cleanEmailBody('Please update it.\n\nClick here to purchase my book, PSA Profitability.\nChris', both),
  'Please update it.'
);

console.log('email cleanup: separators ok');
