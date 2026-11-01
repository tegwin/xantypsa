// ============================================================
// Auth smoke test
// ============================================================
// Drives a running instance the way a browser would: sign in, hold the session
// cookie, reach a protected page, sign out, confirm the door shut again.
//
//   node scripts/smoke-auth.mjs http://localhost:3000 admin@admin.com <password>
//
// Exists because the auth path is the one thing that must never quietly break,
// and typechecking cannot tell you a cookie round-trips.

import { randomUUID } from 'node:crypto';

const [, , baseArg, email, password] = process.argv;
const base = (baseArg ?? 'http://localhost:3000').replace(/\/$/, '');

if (!email || !password) {
  console.error('usage: node scripts/smoke-auth.mjs <baseUrl> <email> <password>');
  process.exit(2);
}

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

/** Keep cookies between requests, as a browser would. */
let jar = '';
function remember(res) {
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) {
    const [pair] = c.split(';');
    const [name] = pair.split('=');
    // Replace any previous value for this cookie name.
    const others = jar.split('; ').filter((v) => v && !v.startsWith(`${name}=`));
    jar = [...others, pair].join('; ');
  }
}
const get = (path, opts = {}) =>
  fetch(`${base}${path}`, { redirect: 'manual', headers: { cookie: jar }, ...opts });

async function main() {
  // Health, which must answer without any session at all.
  const health = await get('/api/health');
  const healthBody = await health.json().catch(() => ({}));
  check('health is ok', health.status === 200 && healthBody.status === 'ok', `db=${healthBody.database}`);

  // A protected page must not be readable while signed out.
  const guarded = await get('/dashboard');
  check(
    'protected page redirects when signed out',
    guarded.status === 307 || guarded.status === 302,
    `HTTP ${guarded.status} → ${guarded.headers.get('location') ?? ''}`
  );

  // Wrong password is refused.
  const bad = await get('/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: jar },
    // Generated, never a literal: a scanner cannot tell a test password from a
    // real one, and neither can someone reading the diff.
    body: JSON.stringify({ email, password: randomUUID() }),
  });
  check('wrong password refused', bad.status === 401, `HTTP ${bad.status}`);

  // Unknown account gives the *same* answer, so the form cannot be used to
  // discover which addresses exist.
  const unknown = await get('/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: jar },
    body: JSON.stringify({ email: 'nobody@example.invalid', password: 'whatever' }),
  });
  const badBody = await bad.json().catch(() => ({}));
  const unknownBody = await unknown.json().catch(() => ({}));
  check(
    'unknown account is indistinguishable from wrong password',
    unknown.status === bad.status && unknownBody.error === badBody.error,
    unknownBody.error
  );

  // The real thing.
  const ok = await get('/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: jar },
    body: JSON.stringify({ email, password }),
  });
  remember(ok);
  const okBody = await ok.json().catch(() => ({}));
  check('sign in succeeds', ok.status === 200 && okBody.ok === true, `HTTP ${ok.status}`);
  check('session cookie issued', jar.includes('xantypsa_session='), jar.split('=')[0]);

  // Cookie must be httpOnly, or any script on the page could steal it.
  const setCookie = (ok.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('xantypsa_session='));
  check('session cookie is httpOnly', /httponly/i.test(setCookie ?? ''));

  // Now the protected page should render.
  const inside = await get('/dashboard');
  check('protected page reachable once signed in', inside.status === 200, `HTTP ${inside.status}`);

  // A tampered cookie must not be accepted — this is the whole point of signing.
  const tampered = jar.replace(/xantypsa_session=[^;]+/, 'xantypsa_session=eyJmYWtlIjoxfQ.bogus');
  const forged = await fetch(`${base}/dashboard`, {
    redirect: 'manual',
    headers: { cookie: tampered },
  });
  check(
    'forged session cookie rejected',
    forged.status === 307 || forged.status === 302,
    `HTTP ${forged.status}`
  );

  // Sign out, and the door closes again.
  const out = await get('/api/auth/signout', { method: 'POST' });
  remember(out);
  const after = await get('/dashboard');
  check('signed out again after logout', after.status === 307 || after.status === 302, `HTTP ${after.status}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error('smoke test could not run:', err.message);
  process.exit(2);
});
