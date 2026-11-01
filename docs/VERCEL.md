# Putting Xanty PSA on Vercel

End-to-end, from a working local install to logging in from a browser anywhere.
Budget 30 minutes the first time.

There are two separate deployments and they are independent:

| | What it is | Domain |
|---|---|---|
| **The app** | Xanty PSA itself - the thing you log into | `app.xanty.net` |
| **The site** | The marketing page in `xantypsa-site/` | `xanty.net` |

Do the app first; that's the one you asked about.

---

## Part 1 - The app

### 1. Get the code into GitHub

Vercel deploys from a repository, so the project needs to be in one.

The repo is initialised on `main` with no commits yet.

**Check the commit identity before your first commit.** Git stamps every commit
with an author name and email, permanently - GitHub will not let you remove it
later without rewriting history, and it is visible to anyone who clones. Both
repos are already set to a project identity rather than a personal one:

```bash
git config user.name    # → Xanty PSA
git config user.email   # → noreply@xanty.net
```

This is set **per repository**, so your global identity is untouched for other
work. If you would rather use your new GitHub account's private address, take it
from GitHub → Settings → Emails ("Keep my email address private") and set:

```bash
git config --local user.email "<id>+<username>@users.noreply.github.com"
```

Then commit and push:

```bash
cd /path/to/xantypsa
git add -A
git commit -m "Xanty PSA"
gh auth login          # sign in as the new account, not your usual one
gh repo create xantypsa --private --source=. --push
```

> `gh` remembers whichever account you last authenticated. Run `gh auth status`
> to confirm which one is active before creating the repo - pushing to the wrong
> account is annoying to unpick once Vercel is wired to it.

Start it **private**. Make it public when you're ready to open source it.

Before making it public, confirm `.env` never got committed:

```bash
git log --all --full-history -- .env
```

That must print nothing. (Checked as of writing - the history was empty and
`.env` is correctly gitignored, so there is nothing to rotate today. Worth
re-running before you flip the repo to public, in case something slips in
between now and then.) If it ever does print something, the database password
and API keys are in the history and must be rotated - deleting the file in a
later commit does not remove it.

### 2. Fix the database connection strings

This is the step that catches people out. Vercel runs serverless functions, so
every request may open a new connection - a direct Postgres connection will
exhaust the pool. Supabase gives you two URLs and you need both:

| Variable | Which URL | Why |
|---|---|---|
| `DATABASE_URL` | Transaction pooler, **port 6543**, with `?pgbouncer=true` | Normal queries from serverless functions |
| `DIRECT_DATABASE_URL` | Session pooler, **port 5432** | Migrations, which pgbouncer can't run |

In Supabase: **Project Settings → Database → Connection string**. Take the
"Transaction" one for `DATABASE_URL` and append `?pgbouncer=true&connection_limit=1`.

### 3. Import the project

1. [vercel.com/new](https://vercel.com/new) → import the repository
2. Framework preset: **Next.js** (detected automatically)
3. **Don't deploy yet** - add the environment variables first, or the first
   build fails and confuses matters

### 4. Environment variables

Paste these into **Settings → Environment Variables**, for Production, Preview
and Development. Values come from your local `.env`.

| Variable | Where it comes from | Required |
|---|---|---|
| `DATABASE_URL` | Supabase transaction pooler, port 6543 | yes |
| `DIRECT_DATABASE_URL` | Supabase session pooler, port 5432 | yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | same page - **secret**, never expose to the browser | yes |
| `AI_ENCRYPTION_KEY` | `openssl rand -hex 32` - use the **same value as local**, or stored API keys and SMTP passwords won't decrypt | yes |
| `AI_DATABASE_URL` | The restricted role, see [SECURITY-AI.md](SECURITY-AI.md) | recommended |

`NEXTAUTH_URL` and `NEXTAUTH_SECRET` are dead - they're left over from before the
Supabase Auth migration and can be dropped.

> **`AI_ENCRYPTION_KEY` must match your local value.** It encrypts stored LLM keys
> and SMTP passwords. A different key on Vercel means those secrets fail to
> decrypt and email silently stops working.

### 5. Deploy

Click Deploy. You'll get `xantypsa-something.vercel.app`.

**It will not let you log in yet.** One more step.

### 6. Point Supabase Auth at the deployed URL

Supabase rejects auth redirects to URLs it doesn't know, so sign-in and password
reset fail until you add them.

**Supabase → Authentication → URL Configuration:**

- **Site URL:** `https://app.xanty.net` (or the `.vercel.app` URL for now)
- **Redirect URLs** - add every one of these:
  ```
  https://app.xanty.net/auth/callback
  https://app.xanty.net/auth/confirm
  http://localhost:3000/auth/callback
  http://localhost:3000/auth/confirm
  ```

Keep the localhost entries - without them, local development breaks.

Now log in.

### 7. Your own domain

In Vercel: **Settings → Domains → Add** `app.xanty.net`. It shows you a DNS
record:

```
CNAME   app   cname.vercel-dns.com
```

Add that at your registrar. Certificates issue automatically once DNS resolves,
usually a few minutes.

Then go back and update the Supabase Site URL and Redirect URLs to the real
domain - step 6 again, with the final address.

---

## Part 2 - The marketing site

Separate Vercel project, same account, from `xantypsa-site/`.

```bash
cd ../xantypsa-site
git add -A && git commit -m "Xanty PSA site"
gh repo create xantypsa-site --public --source=. --push
```

Already initialised on `main` with the same project commit identity.

Import at [vercel.com/new](https://vercel.com/new). **No environment variables**
- it's a static marketing page with no database and no secrets.

Add the domain `xanty.net`, plus `www.xanty.net` redirecting to it. For an
apex domain the DNS record is an A record rather than a CNAME:

```
A       @     76.76.21.21
CNAME   www   cname.vercel-dns.com
```

Vercel shows the exact values - use those over the ones above if they differ.

### Before you launch it

`src/lib/site.ts` holds three placeholders:

```ts
github:     'https://github.com/tegwin/xantypsa',  // real repo URL
demoReady:  false,   // flip to true once the demo exists
demoUrl:    'https://demo.xanty.net',
```

While `demoReady` is `false` the demo button renders as "coming soon" rather
than a dead link. Don't set it to `true` until there's something behind it.

---

## When it goes wrong

**Build fails: `@prisma/client did not initialize`**
`postinstall` should run `prisma generate`. Confirm it's still in `package.json`.

**Build fails: `Environment variable not found: DATABASE_URL`**
The variable isn't set for the environment being built. Check it's ticked for
Production *and* Preview.

**Login redirects to the login page, forever**
The deployed URL isn't in Supabase's Redirect URLs. Step 6.

**`prepared statement "s0" already exists`**
`DATABASE_URL` is missing `?pgbouncer=true`.

**`Too many connections`**
`DATABASE_URL` is pointing at port 5432 instead of the 6543 pooler.

**Emails stop sending after deploying**
`AI_ENCRYPTION_KEY` differs from the one that encrypted the stored SMTP
password. Set it to match, or re-enter the password in Settings → Email.

**Function timeouts on reports or AI**
Hobby plan caps execution at 10 seconds. Either raise `maxDuration` on the route
(Pro allows 60s) or move the work to a background job.
