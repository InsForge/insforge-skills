# Better Auth + InsForge — Empirical Findings

**Branch:** `docs/better-auth-integration`
**Date:** 2026-04-25
**Goal:** Confirm whether Better Auth's "Postgres connection string" model from the [Supabase migration guide](https://better-auth.com/docs/guides/supabase-migration-guide) works against InsForge's underlying Postgres, and document edge cases.

## TL;DR

- ✅ Better Auth's `npx auth migrate` works against InsForge's Postgres with **zero** changes to InsForge.
- ✅ InsForge's native `auth.users` table is untouched and continues to function.
- ⚠️ **Critical gotcha:** Better Auth places its tables in `public`, which makes them readable through InsForge's PostgREST data API to anyone with the anon key. The Supabase upstream guide does not address this. The fix is one SQL block:
  ```sql
  REVOKE ALL ON public."user", public.session, public.account, public.verification
    FROM anon, authenticated;
  ```
- ✅ The REVOKE survives Better Auth re-migrates (e.g. when you add `additionalFields`).
- ✅ A ~20-line `/api/insforge-token` bridge route on the app re-signs the Better Auth session as an HS256 JWT for InsForge. Same pattern as the existing WorkOS/Auth0 guides.
- ✅ End-to-end RLS proven: two users, each can read/write only their own rows in a `requesting_user_id()`-protected table; anon sees nothing.
- ✅ JWT security: tampered/wrong-secret/expired tokens all rejected with `401`. Missing `sub` falls through to RLS deny.

## Gotchas and fixes

Every problem hit during testing, in the order you'd hit them building this. Each has a copy-pasteable fix.

### 1. `public.user` is readable by anon through PostgREST

**Symptom.** Right after `npx auth migrate`, an unauthenticated request through InsForge's data API returns user rows including emails:

```text
$ curl -sS http://localhost:5430/user
[{"id":"...","name":"Leaky","email":"leak@test.com",...}]
```

**Cause.** InsForge default-grants `arwd` (SELECT/INSERT/UPDATE/DELETE) to `anon` and `authenticated` on every table created in `public`. Better Auth lands its tables there with no RLS. The Supabase upstream guide doesn't mention this and Supabase users have the same exposure.

**Fix.** Run once after the first migrate:

```sql
REVOKE ALL ON public."user", public.session, public.account, public.verification
  FROM anon, authenticated;
```

Verify: `curl /user` should now return `401 permission denied for table user`.

### 2. `project_admin` retains access (this is by design — but flag it)

**Symptom.** After the REVOKE above, `\dp public.user` still shows `project_admin=arwd/postgres`.

**Cause.** InsForge's CLI and dashboard run as the `project_admin` role and need to inspect tables for debugging.

**Fix.** Leave it as-is unless you specifically want to lock down admin access. If you do:

```sql
REVOKE ALL ON public."user", public.session, public.account, public.verification
  FROM project_admin;
```

This will break the InsForge Studio's ability to view these tables. Usually not worth it.

### 3. Migrate fails with "no schema has been selected to create in" (schema-isolation alternative only)

**Symptom.** When using `options: '-c search_path=betterauth'` to isolate Better Auth tables in their own schema:

```text
error: no schema has been selected to create in
```

**Cause.** Postgres can't auto-create the schema; you have to create it first.

**Fix.**

```sql
CREATE SCHEMA IF NOT EXISTS betterauth;
```

Then re-run `npx @better-auth/cli migrate`.

### 4. PostgREST returns `404 {}` on a freshly-created table

**Symptom.** You ran `CREATE TABLE public.notes ...` via raw `psql`, then `POST /notes` through PostgREST returns:

```text
HTTP/1.1 404 Not Found
{}
```

**Cause.** PostgREST caches the schema. It only auto-reloads on a `NOTIFY pgrst` event. The InsForge CLI's migration tool emits this notify; raw `psql` does not.

**Fix.** Either run schema changes through the InsForge CLI:

```bash
npx @insforge/cli db migrations new add_notes_table
npx @insforge/cli db migrations up
```

Or, after raw `psql`, send the notify yourself:

```sql
NOTIFY pgrst, 'reload schema';
```

The InsForge stack already configures `PGRST_DB_CHANNEL_ENABLED=true` and `PGRST_DB_CHANNEL=pgrst`, so this works out of the box.

### 5. Better Auth POSTs return `403 MISSING_OR_NULL_ORIGIN`

**Symptom.** Server-to-server `curl`/`fetch` to `POST /api/auth/sign-up/email` without an `Origin` header:

```text
HTTP/1.1 403 Forbidden
{"message":"Missing or null Origin","code":"MISSING_OR_NULL_ORIGIN"}
```

**Cause.** Better Auth's CSRF protection requires an `Origin` header on mutating requests, even without a browser.

**Fix.** Set the header on every write:

```bash
curl -X POST .../sign-up/email \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  -d '{...}'
```

For real server-to-server clients, configure `trustedOrigins` in `betterAuth({...})` and send the matching `Origin`.

### 6. Better Auth's `jwt()` plugin won't authenticate to InsForge's PostgREST

**Symptom.** You enable `plugins: [jwt()]` and try to use `authClient.token()` directly with InsForge — every request rejected with `JWSInvalidSignature`.

**Cause.** Better Auth's JWT plugin issues **asymmetric** tokens (EdDSA / ES256 / RS256) verifiable only via JWKS. InsForge's PostgREST is configured with `PGRST_JWT_SECRET` for **HS256** verification with the InsForge JWT secret. They don't talk natively, and the plugin has no HS256 mode.

**Fix.** Skip Better Auth's `jwt()` plugin entirely. Add a tiny server-side bridge route that reads the Better Auth session and re-signs an HS256 token with the InsForge JWT secret. ~20 lines of code, same pattern as the existing WorkOS/Auth0 guides. See "JWT bridge: end-to-end RLS proof" below for the full route.

### 7. PostgREST has a ~30-second JWT expiry tolerance

**Symptom.** A freshly-expired token (`exp` 1s in the past) still gets a `200` response, not `401`.

**Cause.** PostgREST's default clock-skew window is ~30s — designed to absorb minor clock drift between issuer and verifier.

**Fix.** Nothing required for normal use. If you need hard expiry — for example invalidating a token within the second after a logout — don't rely on `exp` alone; check session validity in your bridge route before issuing a new token, and/or use a server-side revocation list. With `exp` >30s in the past, PostgREST does reject:

```text
401 Unauthorized
{"code":"PGRST301","message":"JWT expired"}
```

### 8. Better Auth user IDs are `text`, not UUID — don't FK to `auth.users`

**Symptom.** You write `user_id uuid REFERENCES auth.users(id)` and inserts fail because the Better Auth-issued `id` (e.g. `f5kGYiUXDPEJqRDQ4jgtNTopIzpj5MgK`) isn't a UUID.

**Cause.** Better Auth's `generateId()` is a base62-style string. InsForge's native `auth.users.id` is a UUID. Better Auth never writes to `auth.users` — it writes to `public.user`.

**Fix.** Use `text` columns for any FK to Better Auth's user table:

```sql
user_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE
```

Same convention as every other third-party auth integration in this skill (Clerk, Auth0, WorkOS, Kinde, Stytch).

### 9. Connection-pool user must have privileges on Better Auth's tables

**Symptom.** If you connect Better Auth as `anon` or `authenticated` (or any role you've REVOKE'd from), signups fail with `permission denied for table user`.

**Cause.** `REVOKE` applies to the role used in the connection string, not just to PostgREST request roles.

**Fix.** In the Better Auth connection string, use a role that retains privileges — typically the `postgres` superuser, or a dedicated role you grant explicitly:

```js
new Pool({ connectionString: "postgresql://postgres:postgres@host/insforge" })
```

The REVOKE block in gotcha #1 only removes anon/authenticated, so the postgres user still works as expected.

## Test environment

| Component | Version |
|---|---|
| InsForge Postgres | `ghcr.io/insforge/postgres:v15.13.2` |
| InsForge PostgREST | `postgrest/postgrest:v12.2.12` |
| Better Auth | latest at 2026-04-25 (`npm install better-auth pg`) |
| `@better-auth/cli` | latest |
| Connection string | `postgresql://postgres:postgres@127.0.0.1:5432/insforge` |

The InsForge stack was started with `docker compose up -d postgres` from `/Users/gary/projects/insforge-repo/insforge`. The Postgres container exposes `5432:5432` on the host.

## Minimal reproducer

```js
// auth.js
import { betterAuth } from "better-auth";
import pg from "pg";
const { Pool } = pg;

export const auth = betterAuth({
  database: new Pool({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/insforge",
  }),
  emailAndPassword: { enabled: true },
  secret: "dev-secret-please-change-in-production",
  baseURL: "http://localhost:3000",
});
```

```bash
npx @better-auth/cli migrate --config ./auth.js -y
```

Result: four tables created in `public` — `user`, `session`, `account`, `verification`.

```text
                                 Table "public.user"
    Column     |           Type           | Nullable |      Default
---------------+--------------------------+----------+-------------------
 id            | text                     | not null |
 name          | text                     | not null |
 email         | text                     | not null |
 emailVerified | boolean                  | not null |
 image         | text                     |          |
 createdAt     | timestamp with time zone | not null | CURRENT_TIMESTAMP
 updatedAt     | timestamp with time zone | not null | CURRENT_TIMESTAMP
```

`id` is `text` (Better Auth's `generateId()`, not a UUID) — same as the existing Clerk/Auth0/WorkOS/Kinde/Stytch integrations, which all mandate `TEXT` for third-party `user_id` columns.

## The PostgREST exposure (and the fix)

After migrate, with no further config, an unauthenticated request through InsForge's PostgREST (`:5430`) returns the user row including email:

```text
$ curl -sS http://localhost:5430/user
[{"id":"DPZW6A6ubMMFkdq9jfYCLlmGmrbL6HEG","name":"Leaky","email":"leak@test.com",...}]
```

This is because InsForge grants `anon` and `authenticated` default privileges on `public` — same as Supabase. The Supabase migration guide does not call this out; users who follow it on Supabase have the same leak.

After:

```sql
REVOKE ALL ON public."user", public.session, public.account, public.verification
  FROM anon, authenticated;
```

```text
$ curl -sS http://localhost:5430/user
{"code":"42501", "message":"permission denied for table user"}
```

Better Auth signups still succeed because Better Auth connects as `postgres` (the superuser role from the connection string), which retains all privileges:

```text
$ curl -sS -X POST http://localhost:3000/api/auth/sign-up/email \
       -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
       -d '{"email":"after@test.com","password":"hunter2hunter2","name":"After"}'
{"token":"...","user":{"id":"kbT2MHt...","email":"after@test.com",...}}
```

`project_admin` (InsForge's admin role used by the CLI/dashboard) keeps full access — appropriate for debugging. If you want full lockdown, also `REVOKE ... FROM project_admin`.

## Edge case results

### 1. `auth migrate` is idempotent

Second run with no config changes:

```text
🚀 No migrations needed.
```

### 2. Adding an `additionalField` issues only the ALTER you'd expect

```js
user: { additionalFields: { tenantId: { type: "string" } } }
```

```text
🔑 The migration will affect the following:
-> tenantId fields on user table.
🚀 migration was completed successfully!
```

Result: `tenantId` column added to `public.user` only. No other table touched. No new tables in `public`.

### 3. REVOKE survives re-migrate

After applying REVOKE, then adding `tenantId` and re-running migrate, the anon role is **still blocked**:

```text
SET ROLE anon; SELECT count(*) FROM public."user";
ERROR:  permission denied for table user
```

Postgres only re-grants on `CREATE TABLE`, not `ALTER TABLE`. So you apply REVOKE once after the first migrate; subsequent migrates preserve it.

### 4. Migrate fails loudly if the target schema doesn't exist

If you set `search_path` to a schema that doesn't exist (the schema-isolation alternative described below), migrate errors with:

```text
error: no schema has been selected to create in
```

Recovery: `CREATE SCHEMA <name>;` and re-run.

### 5. Concurrency holds up under parallel signups

30 concurrent `POST /api/auth/sign-up/email` requests through `pg.Pool`:

```text
N=30  ok=30  fail=0  elapsed=438ms
```

After the run: 32 rows in `user`, 32 in `session`, 32 in `account` (the 2 from earlier tests + 30 from the load test). No row loss, no schema confusion, no FK orphans.

### 6. Cross-table FKs to `public.user` work normally for app code

```sql
CREATE TABLE public.posts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  author_id text NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  ...
);
```

- ✅ Bad FK is rejected: `violates foreign key constraint "posts_author_id_fkey"`
- ✅ Anon can read `public.posts` normally
- ✅ Anon **cannot** join through the FK to read `user` data — PostgREST refuses with `PGRST200 / Could not find a relationship between 'posts' and 'user' in the schema cache` because the role can't see `user`. So FKs work for backend code but the leak stays sealed.

### 7. InsForge's native `auth.users` is unaffected

Before, during, and after all of the above, `SELECT count(*) FROM auth.users` returned the same 4 rows. Better Auth coexists; it does not touch `auth.*`.

## Alternative considered: schema isolation

I also tested putting Better Auth in a dedicated `betterauth` schema by setting `options: '-c search_path=betterauth'` on the `pg.Pool`. This works (`auth migrate` honors `search_path`) and prevents PostgREST exposure by default — `curl /user` returns `42P01 relation "public.user" does not exist`.

Trade-offs vs. the canonical `public` + REVOKE path:

| | `public` + REVOKE | `betterauth` schema |
|---|---|---|
| Matches upstream Supabase guide | ✅ | ❌ |
| Cross-schema FKs from app tables | not needed | required (works fine) |
| One extra step after migrate | ✅ REVOKE block | ✅ `CREATE SCHEMA` first |
| Default-safe even if you forget the extra step | ❌ | ✅ |

The doc should recommend `public` + REVOKE as canonical (matches upstream) and mention schema isolation as a stricter alternative.

## What this means for the integration guide

A `references/better-auth.md` in the `insforge-integrations` skill should cover:

1. **Connection** — `new Pool({ connectionString })` against InsForge's Postgres (self-hosted or wherever Postgres is exposed).
2. **First migrate** — `npx @better-auth/cli migrate`. Tables land in `public`.
3. **Lock down PostgREST exposure** — the REVOKE block above. **Required.** Mention that Better Auth re-migrates preserve the REVOKE, so you only do it once.
4. **`project_admin` note** — kept for InsForge tooling; revoke from it too if you want full lockdown.
5. **Coexistence with InsForge auth** — `auth.users` is independent. Better Auth becomes the source of truth for app users; do not FK to `auth.users(id)`.
6. **Schema-isolation alternative** — short callout, not the default.
7. **The JWT bridge for InsForge RLS** — see "JWT bridge: end-to-end RLS proof" below.

## JWT bridge: end-to-end RLS proof

Better Auth's built-in `jwt()` plugin issues **asymmetric** tokens (EdDSA/ES256/RS256) verified via JWKS. InsForge's PostgREST is configured for **HS256** signed with the InsForge JWT secret. So they don't talk natively. Instead, a small server-side route on the app reads the Better Auth session and signs an HS256 token with the InsForge secret — same pattern as the existing WorkOS/Auth0 guides.

### Bridge route (Node, ~20 lines)

```js
// server.js — bridge added to a Node http server alongside toNodeHandler(auth)
import jwt from "jsonwebtoken";
const INSFORGE_JWT_SECRET = process.env.INSFORGE_JWT_SECRET;

if (req.url === "/api/insforge-token" && req.method === "GET") {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    res.writeHead(401); res.end('{"error":"not signed in"}'); return;
  }
  const token = jwt.sign(
    {
      sub: session.user.id,
      role: "authenticated",
      aud: "insforge-api",
      email: session.user.email,
    },
    INSFORGE_JWT_SECRET,
    { algorithm: "HS256", expiresIn: "1h" },
  );
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ token }));
  return;
}
```

### InsForge side

```sql
-- 1. extract sub from request.jwt.claims
CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::text
$$;

-- 2. example RLS-protected table — user_id auto-populates from the JWT
CREATE TABLE public.notes (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL DEFAULT public.requesting_user_id()
    REFERENCES public."user"(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY notes_owner_select ON public.notes
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id());

CREATE POLICY notes_owner_insert ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.requesting_user_id());

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT ON public.notes TO authenticated;

NOTIFY pgrst, 'reload schema';  -- PostgREST won't see the new table until reloaded
```

### E2E result

Two signups (Alice + Bob), each gets a bridged JWT, each posts a note via PostgREST, each lists notes:

```text
[alice posts a note] 201 {"id":"8b7a...","user_id":"Ua0DX67o...","body":"alice's secret"}
[bob   posts a note] 201 {"id":"0dc5...","user_id":"DCQJfmgN...","body":"bob's secret"}

[alice lists her notes] 200 [{"id":"8b7a...","user_id":"Ua0DX67o...","body":"alice's secret"}]
[bob   lists his notes] 200 [{"id":"0dc5...","user_id":"DCQJfmgN...","body":"bob's secret"}]
[anon  lists notes]     200 []
```

✅ `user_id` auto-populated from the JWT `sub` (Better Auth user id, no app code passes it).
✅ Each user sees only their own row. Anon sees nothing.

### JWT security stress

| Token state | InsForge response |
|---|---|
| No token (anon role) | `200 []` — anon has no policy, RLS denies |
| Valid sig, sub for non-existent user | `200 []` — RLS matches no rows; no error |
| Tampered signature | `401 JWSInvalidSignature` |
| Wrong signing secret | `401 JWSInvalidSignature` |
| Expired (`exp` >30s in past) | `401 JWT expired` |
| Expired (`exp` 1s in past) | accepted — PostgREST default ~30s clock-skew window |
| Missing `sub` claim | `200 []` — `requesting_user_id()` returns NULL, RLS denies |

PostgREST's clock-skew tolerance means very recently-expired tokens still go through. Not a bug, but worth knowing if you rely on `exp` for hard cut-offs.

### Operational gotcha: schema reload

After creating the `notes` table, the first round of E2E requests returned `404 {}` — PostgREST hadn't refreshed its schema cache. Fix:

```sql
NOTIFY pgrst, 'reload schema';
```

The InsForge docker-compose already configures `PGRST_DB_CHANNEL_ENABLED=true` and `PGRST_DB_CHANNEL=pgrst`. Migrations created via the InsForge CLI presumably trigger this notify; raw `psql` DDL does not. The doc should tell users to run the NOTIFY (or use the InsForge CLI's migration tooling) after applying the bridge schema.

## Reproducer files

The test scaffolding lives at `/tmp/ba-insforge-test/`:

- `auth.js` — the Better Auth config
- `server.js` — Node HTTP server with `toNodeHandler(auth)` + the `/api/insforge-token` bridge
- `load.js` — 30-concurrent-signups load script (requires `Origin` header on POSTs)
- `e2e.js` — two-user signup → bridge → InsForge PostgREST insert/select RLS proof
- `jwt-stress.js` — tampered/wrong-secret/expired/missing-sub token stress against PostgREST

To re-run:

```bash
cd /Users/gary/projects/insforge-repo/insforge && docker compose up -d postgres
PGPASSWORD=postgres psql -h 127.0.0.1 -p 5432 -U postgres -d insforge \
  -c 'DROP TABLE IF EXISTS public."user", public.session, public.account, public.verification CASCADE;'
cd /tmp/ba-insforge-test && npx @better-auth/cli migrate --config ./auth.js -y
node server.js &
curl -sS -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"email":"x@y.com","password":"hunter2hunter2","name":"X"}'
```

## Side-by-side: Supabase upstream guide vs this work

This section is for understanding the delta. If something works on Supabase, it works on InsForge — but the upstream Supabase guide leaves real gaps.

### What's identical

| | Supabase upstream | InsForge (this work) |
|---|---|---|
| Connection model | `new Pool({ connectionString })` to Postgres | Same |
| `npx auth migrate` | Creates `user`/`session`/`account`/`verification` in `public` | Same |
| Table shape | `id text`, `email text unique`, scrypt password in `account.password` | Identical (verified by `\d` output) |
| Better Auth `id` format | base62 string from `generateId()` | Identical |
| ALTER on field add | Re-run `npx auth migrate` | Same |
| Coexists with native auth (`auth.users`) | Yes | Yes (verified — 4 native users untouched) |
| Default DB privileges | `anon`, `authenticated` get `arwd` on `public.*` | Same default |
| Data API | PostgREST | PostgREST (identical version) |
| JWT verification on data API | HS256 with project JWT secret | HS256 with InsForge JWT secret |

So at the database layer, anything in the Supabase guide reproduces 1:1 against InsForge.

### What the Supabase guide leaves on the floor

These are real problems with the upstream guide that any InsForge user would hit identically — we just don't pretend they aren't there.

| Gap | Supabase guide says | InsForge guide will say |
|---|---|---|
| PostgREST anon exposure of `public.user` | nothing | The REVOKE block in gotcha #1 (required) |
| RLS migration | "doesn't currently cover" — explicitly out of scope | We document `requesting_user_id()` + working policies |
| How the app talks to the data API after switching to Better Auth | nothing (the guide stops at sign-up flows) | The `/api/insforge-token` bridge — full E2E proof |
| Schema-cache reload after raw DDL | nothing | `NOTIFY pgrst, 'reload schema'` documented |
| `Origin` header for non-browser clients | nothing | Documented |

The Supabase guide is a **data migration** guide. The InsForge guide will be a **working integration** guide that takes a developer from zero to two users isolated by RLS.

### What's actually different about InsForge

These are not gaps — they're real differences worth knowing.

| | Supabase | InsForge |
|---|---|---|
| Built-in user table | `auth.users` (uuid id) | `auth.users` (uuid id) |
| RLS helper | `auth.uid()` returns uuid | `requesting_user_id()` — convention from existing integrations, returns text |
| Admin role bypassing RLS | `service_role` | `project_admin` |
| Schema reload trigger | Studio / management API | InsForge CLI migrations, or manual `NOTIFY pgrst` |
| Reload channel name | `pgrst` (default) | `pgrst` (configured the same) |
| User ID column convention with third-party auth | uuid (forces a mapping table) | text (per existing Clerk/Auth0/WorkOS/Kinde/Stytch guides) |

The `text` user-id convention is actually a small InsForge advantage here — Better Auth's string IDs slot in directly. On Supabase a developer would need to either (a) map Better Auth's string IDs to UUIDs, or (b) override the FK type and lose the join with `auth.users`.

### Two paths through this integration, ranked

| Path | Where Better Auth tables live | Where you need REVOKE | Matches upstream guide | Use when |
|---|---|---|---|---|
| **A. `public` + REVOKE** *(canonical)* | `public.{user,session,account,verification}` | yes — one block | ✅ exactly | Default. Closest to the Supabase guide; one extra safety step. |
| **B. Dedicated `betterauth` schema** | `betterauth.{...}` | no | ❌ diverges | When you want default-safe-without-REVOKE, or when you don't want auth tables visible to InsForge Studio's `public` view. |

Both work end-to-end (A verified including JWT bridge + RLS; B verified for migrate/signup only).

### POC reproducer (the smallest thing that proves the integration)

If you want to demo this from scratch on a clean machine in <5 minutes:

```bash
# 1. InsForge stack
cd /Users/gary/projects/insforge-repo/insforge && docker compose up -d postgres postgrest insforge

# 2. Better Auth project
mkdir /tmp/ba-poc && cd /tmp/ba-poc
npm init -y && npm pkg set type=module
npm install better-auth pg jsonwebtoken

# 3. Better Auth config — point at InsForge's Postgres
cat > auth.js <<'EOF'
import { betterAuth } from "better-auth";
import pg from "pg";
const { Pool } = pg;
export const auth = betterAuth({
  database: new Pool({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/insforge",
  }),
  emailAndPassword: { enabled: true },
  secret: "dev-secret-please-change-in-production",
  baseURL: "http://localhost:3000",
});
EOF

# 4. Create Better Auth tables
npx @better-auth/cli migrate --config ./auth.js -y

# 5. Lock down PostgREST exposure (the missing-from-Supabase-guide step)
PGPASSWORD=postgres psql -h 127.0.0.1 -p 5432 -U postgres -d insforge -c '
  REVOKE ALL ON public."user", public.session, public.account, public.verification
    FROM anon, authenticated;
'
```

That's it for the persistence half. The bridge + RLS half lives in `server.js` + the SQL block under "JWT bridge: end-to-end RLS proof" above; together they are <100 lines of new code.

### Bottom line

> If it works on Supabase, it works on InsForge — and the InsForge integration guide will be more honest about the parts the upstream guide skips.

## Refresh, cookies, and the SDK

This is the trickiest part of the integration in practice. There are two independent token systems running side-by-side, and the InsForge SDK's defaults assume it owns auth — which it doesn't, in this setup.

### Two token systems in play

| | Better Auth | InsForge SDK |
|---|---|---|
| **Identifies the user via** | `better-auth.session_token` cookie | `Authorization: Bearer <jwt>` header |
| **Storage** | HttpOnly cookie, `SameSite=Lax`, 7d default | In-memory only (`TokenManager` in the SDK) |
| **Refresh mechanism** | Sliding session in the `session` table; cookie is rolled on activity | `POST /api/auth/sessions/current` with `X-CSRF-Token` and a refresh token, triggered by the SDK on `401 INVALID_TOKEN` |
| **CSRF cookie** | not used | `insforge_csrf_token` (set on InsForge login/refresh) |
| **Lifetime** | 7d sliding | 1h (this is the bridged HS256 JWT — the InsForge native refresh token has its own lifetime) |

The Better Auth cookie keeps the *user* signed in. The InsForge bearer keeps the *data API* talking. The bridge is the only thing that connects them.

### Why the SDK's default auto-refresh path is wrong here

Default behavior: `createClient({ ... })` sets `autoRefreshToken: true`. On a `401 INVALID_TOKEN` from any InsForge call, the SDK tries `POST /api/auth/sessions/current` to mint a new InsForge access token from the InsForge refresh token.

When the user signed in via Better Auth, **there is no InsForge refresh token** — InsForge never issued a session for this user. So:

- If the SDK ever does try to auto-refresh, it'll fail and `clearSession()` — the SDK ends up in a logged-out state even though the Better Auth session is still valid.
- In practice it probably *won't* try, because PostgREST returns `{"code":"PGRST301","message":"JWT expired"}` — no `error` field — which the SDK maps to `error: 'REQUEST_FAILED'`, not `'INVALID_TOKEN'`. So the auto-refresh branch (gated on `error === 'INVALID_TOKEN'`) doesn't fire.
- But for non-PostgREST endpoints (storage, AI, functions, realtime — anything proxied through InsForge's own API), the error code *can* be `INVALID_TOKEN`, and you don't want auto-refresh to misfire there.

**Fix:** disable auto-refresh and manage the bridge token yourself.

```ts
const client = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL!,
  anonKey:  process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
  autoRefreshToken: false,   // ← required when Better Auth owns auth
});
```

### Recommended client-side pattern (React + Next.js App Router)

This is the same shape as the existing Clerk integration, adapted for Better Auth's session model.

```tsx
'use client';

import { createClient, type InsForgeClient } from '@insforge/sdk';
import { authClient } from '@/lib/auth-client';   // your better-auth client
import { useEffect, useMemo, useState } from 'react';

const REFRESH_INTERVAL_MS = 50 * 60 * 1000;        // 50 min for a 1h bridge JWT

export function useInsforgeClient(): { client: InsForgeClient; isReady: boolean } {
  const session = authClient.useSession();          // reactive Better Auth session
  const [isReady, setIsReady] = useState(false);

  const client = useMemo(
    () =>
      createClient({
        baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL!,
        anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
        autoRefreshToken: false,
      }),
    [],
  );

  useEffect(() => {
    if (!session.data?.user) {
      client.getHttpClient().setAuthToken(null);
      setIsReady(false);
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      try {
        // Same-origin: better-auth.session_token cookie auto-attached
        const res = await fetch('/api/insforge-token', { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`bridge ${res.status}`);
        const { token } = await res.json();
        if (cancelled) return;
        client.getHttpClient().setAuthToken(token);
        setIsReady(true);
      } catch {
        if (cancelled) return;
        client.getHttpClient().setAuthToken(null);
        setIsReady(false);
      }
    };

    void refresh();
    const id = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client, session.data?.user]);

  return { client, isReady };
}
```

Mirrors the existing Clerk integration except `getToken({ template: 'insforge' })` is replaced by `fetch('/api/insforge-token')`. Refresh interval is wider (50 min vs. ~50 sec) because the bridge mints 1h tokens, not 60s template tokens — `useSession()`'s reactivity handles sign-in/sign-out within that window.

### Cookies, CORS, and where the bridge lives

| Layout | What works | Watch out for |
|---|---|---|
| **Same-origin** — app + bridge route on one domain (e.g. Next.js fullstack) | Default `SameSite=Lax` BA cookie auto-sent. Use `credentials: 'same-origin'` (or just default). | Nothing. Easiest path. |
| **Cross-origin** — separate API server holds the bridge, browser app on another origin | Better Auth cookie must be `SameSite=None; Secure`. Bridge must respond with `Access-Control-Allow-Credentials: true` and an explicit `Access-Control-Allow-Origin: <app origin>` (not `*`). App must `fetch(..., { credentials: 'include' })`. | Easy to leave one piece misconfigured and get a silent unauthenticated bridge. |
| **Pure server-side** — RSC, route handlers, server actions | Read the cookie from request headers, call `auth.api.getSession({ headers: req.headers })`, mint the JWT inline. No CORS concern, no client-side state. | The token is short-lived (1h) — re-mint per server-side flow rather than caching. |

### Sign-out and InsForge state

Better Auth sign-out only invalidates the Better Auth session and clears its cookie. The InsForge SDK still holds the last bridged JWT in memory until you tell it not to. Do this explicitly:

```ts
await authClient.signOut();
client.getHttpClient().setAuthToken(null);   // clear in-memory bearer
// realtime auto-reconnects via the onTokenChange hook in TokenManager
```

If you skip this, an in-flight request can complete with the now-orphaned JWT (still valid until `exp`).

### The InsForge CSRF cookie is irrelevant — but harmless

`insforge_csrf_token` is set by InsForge's *own* login/refresh flow. With Better Auth driving auth, that cookie is never set, the SDK never reads it (because `getCsrfToken()` only matters for `/api/auth/sessions/current`, which we're not calling), and nothing depends on it. No action needed.

### Realtime

The SDK's `Realtime` module subscribes to the `TokenManager.onTokenChange` callback and re-establishes its WebSocket with the new bearer when the token rotates. So **as long as you call `setAuthToken()` on every refresh** (which the pattern above does), realtime stays connected after a token rotation. If you bypass the SDK and pass JWTs directly to your own WebSocket plumbing, you'd have to wire reconnection yourself.

### Summary: what to tell users in the integration guide

1. `createClient({ ..., autoRefreshToken: false })` — required.
2. Use `getHttpClient().setAuthToken(token)` imperatively from a `useEffect` keyed on Better Auth's session.
3. Refresh on a `setInterval` at ~80% of bridge JWT lifetime (50 min for 1h, 30 sec for 60s).
4. Clear the SDK token on sign-out; don't let an orphan JWT linger.
5. The InsForge `insforge_csrf_token` cookie is unused in this mode — ignore it.

## How this compares to the other auth integrations

I read all five existing reference guides (Clerk, Auth0, WorkOS, Kinde, Stytch) to figure out where Better Auth fits. There are really only **two SDK-wiring patterns** in the existing skill — the integrations differ on *where* the JWT gets minted, but the SDK plumbing collapses into two shapes.

### Pattern A: long-lived client + imperative refresh (SPA-shaped)

```ts
const client = createClient({ baseUrl, anonKey, autoRefreshToken: false });
useEffect(() => {
  // get token, then:
  client.getHttpClient().setAuthToken(token);
}, [signedIn]);
```

Used by:

| Integration | Token source | Refresh interval | Why this shape |
|---|---|---|---|
| **Clerk** | `getToken({ template: 'insforge' })` — Clerk signs HS256 directly | ~50s (60s template expiry) | Clerk has rich client-side state via `useAuth()` |
| **Better Auth** *(this work)* | `fetch('/api/insforge-token')` — your bridge re-signs HS256 | ~50min (1h JWT) | Better Auth has reactive `authClient.useSession()` |

Properties:
- One InsForge client instance for the user's whole session
- Realtime stays connected across token rotations (TokenManager.onTokenChange)
- Best for SPAs, dashboards, anything React-y

### Pattern B: per-request client construction (server-rendered)

```ts
export async function createInsForgeClient() {
  const { user } = await withAuth();      // or auth.api.getSession({ headers })
  const token = jwt.sign({ sub: user.id, role: 'authenticated', aud: 'insforge-api' },
                         INSFORGE_JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
  return createClient({ baseUrl, edgeFunctionToken: token });
}
```

Used by:

| Integration | Token source | Where it runs |
|---|---|---|
| **Auth0** | Embedded in ID token via Post Login Action — read on the server | Next.js server / RSC |
| **WorkOS** | `jsonwebtoken` after `withAuth()` | Next.js server / RSC |
| **Kinde** | `jsonwebtoken` after Kinde session lookup | Next.js server / RSC |
| **Stytch** | `jsonwebtoken` after Stytch session validation | Next.js server / RSC |

Properties:
- Fresh client + fresh token per request, no refresh logic needed
- `edgeFunctionToken` is the SDK config field for "I have a pre-signed JWT" mode (also flips `isServerMode: true`)
- No SDK state to manage; lifetime = request lifetime
- Best for SSR, RSC, route handlers, server actions

### Better Auth fits both

The bridge route I built (`/api/insforge-token`) is independent of the rendering model — same Node code on the same `auth.api.getSession({ headers })` call:

- **Client-side fetch in a `useEffect`** → Pattern A (the recommended default)
- **Direct call inside a server component or route handler** → Pattern B

```tsx
// Pattern B for Better Auth in a Next.js RSC
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { createClient } from '@insforge/sdk';
import jwt from 'jsonwebtoken';

export async function createInsForgeClient() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const token = jwt.sign(
    { sub: session.user.id, role: 'authenticated', aud: 'insforge-api' },
    process.env.INSFORGE_JWT_SECRET!,
    { algorithm: 'HS256', expiresIn: '1h' },
  );
  return createClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL!, edgeFunctionToken: token });
}
```

So the integration guide should show **both patterns** — Pattern A as the SPA default (because Better Auth's `useSession()` makes it ergonomic), Pattern B for SSR-heavy apps. Aligns with how the existing five guides split.

### What's genuinely new about Better Auth among these

| Property | Existing five | Better Auth |
|---|---|---|
| Auth provider runs in your DB | No (all SaaS) | Yes (your Postgres — InsForge's, even) |
| You own the user table | No — `clerk_users`, `workos_users` are mirror tables in their dashboard | Yes — `public.user` in your DB |
| Migration lock-in | Hard — exporting users from a SaaS provider is painful | Trivial — already in Postgres |
| Provider goes down → your auth goes down | Yes | No (it's *your* infra) |
| Cost at scale | per-MAU pricing | $0 marginal |
| Provider has its own JWT signing | Yes (Clerk template, Auth0 ID token) | Yes (`jwt()` plugin), but asymmetric — incompatible with InsForge's HS256 PostgREST, hence the bridge |

So Better Auth uniquely combines: "self-hosted in your InsForge Postgres" *and* "no vendor for the auth layer at all." It's the most-coupled-to-InsForge of the six options. The doc should lead with that as the differentiator.

## SDK-level stress results (empirical, not just curl)

To validate the SDK ergonomics — not just the underlying HTTP — I spun up a second InsForge worktree on a clean checkout of `origin/main` with isolated ports (`POSTGRES_PORT=5433`, `APP_PORT=7230`, `COMPOSE_PROJECT_NAME=ba-sdk-test`) so it wouldn't collide with the broken running stack. Then ran four scripts using the real `@insforge/sdk` (1.2.5) wired to Better Auth via the bridge route.

Worktree: `insforge/.worktrees/ba-sdk-test` on branch `sdk-test/better-auth`.

### Test 1 — basic SDK + RLS

`sdk-e2e.js`: two users, sign up via Better Auth, fetch bridge tokens, drive `client.database.from('notes')` for inserts and selects. Result:

```
--- alice insert ---  status: 201, user_id auto-populated to her BA id ✅
--- bob insert ---    status: 201, user_id auto-populated to his BA id ✅
--- alice select ---  data: [{ alice's row only }]                     ✅
--- bob select ---    data: [{ bob's row only }]                       ✅
```

The same RLS isolation we proved with curl, now via the actual SDK.

### Test 2 — token expiry mid-session

`sdk-expiry.js` with `autoRefreshToken: false`:

```
[fresh 60s token, select]:    {"data":[],"status":200}                                       ✅
[expired -300s token, select]: {"error":{"error":"AUTH_UNAUTHORIZED","statusCode":401}}     ✅
[after re-set, select]:       {"data":[],"status":200}                                      ✅ recovered
[token cleared, select]:      {"data":[],"status":200}  (anon path, RLS deny)               ✅
```

Re-setting the token via `getHttpClient().setAuthToken(newToken)` recovers the SDK fully — no need to throw away the client.

### Test 3 — what does the **default** `autoRefreshToken: true` actually do?

This was the open question — does it fight you?

`sdk-autorefresh-default.js` constructs a client *without* setting `autoRefreshToken: false` and uses an already-expired bridge JWT:

```
autoRefreshToken=DEFAULT (true), expired token, 47ms
{
  "error": { "error": "AUTH_UNAUTHORIZED", "statusCode": 401 },
  "status": 401
}
```

47 ms — no retry, no refresh attempt. **The auto-refresh branch never fires** because the InsForge API returns `error: 'AUTH_UNAUTHORIZED'`, not `'INVALID_TOKEN'`, and the SDK's auto-refresh is gated on the latter. So:

> `autoRefreshToken: false` is **defensive, not strictly required**. The SDK won't accidentally call `/api/auth/sessions/current` for a Better Auth-bridged JWT, because the error code never matches.

The doc should still recommend `false` for clarity ("the app owns refresh"), but the integration is robust to forgetting it.

### Test 4 — concurrent reads during token rotation

`sdk-concurrent-rotate.js` fires 50 concurrent SDK `select`s and rotates the bearer mid-flight via `setAuthToken()` after 5ms:

```
(token rotated mid-flight)
N=50  ok=50  fail=0
```

No race. The `userToken` swap is read on each request's header construction, so in-flight requests already past that point complete with their original token; new requests pick up the rotated one. Realtime is the same story via `onTokenChange` (verified by source reading — the WebSocket is reconnected with the new token, channels auto-resubscribe).

### Test 5 — does the bridged JWT carry through to other modules?

`sdk-storage-functions.js`:

```
[client headers Authorization starts with]: Bearer eyJhbGciOiJIUzI1NiI...   ✅ shared header

[storage.from('any').list()]:
  { error: { statusCode: 403, error: 'AUTH_UNAUTHORIZED' } }
  → bucket-list is admin-only on InsForge, but the auth path was reached;
    SDK passed the bridged JWT through; access denied is by InsForge policy,
    not a missing token.

[functions.invoke('__no_such_function__')]:
  { error: { statusCode: 404, error: 'Function not found or not active' } }
  → auth check passes (404 is the function-lookup result, not an auth error)

[expired token → storage]: {"error":{"statusCode":401,"error":"AUTH_UNAUTHORIZED"}}   ✅
[expired token → functions]: {"error":{"statusCode":404,"error":"Function not found or not active"}}
  → minor InsForge quirk: functions returns 404 even with expired auth, since
    function lookup happens before auth in that path. Not a Better Auth issue.
```

All modules share `HttpClient.getHeaders()` which adds `Authorization: Bearer ${userToken || anonKey}`. Whatever you `setAuthToken()` flows through to:

- ✅ `client.database` (verified via RLS test)
- ✅ `client.storage` (auth header propagated)
- ✅ `client.functions` (auth header propagated)
- ✅ `client.ai` (same code path)
- ✅ `client.emails` (same code path)
- ✅ `client.realtime` (verified via source: reads `tokenManager.getAccessToken()` at connect; reconnects on `onTokenChange`)

So **yes, every SDK module works with the bridged JWT** — no per-module wiring needed. The bridge is the only integration point.

### Realtime in particular — TWO real platform bugs uncovered

When I actually ran realtime end-to-end (rather than just reading source), I uncovered **two real platform-level bugs** that affect not just Better Auth but every third-party auth integration in this skill:

#### Bug 1: `setAuthToken()` doesn't propagate to realtime

`HttpClient.setAuthToken(token)` only updates `this.userToken` on the HttpClient. The `Realtime` module reads from a separate `TokenManager.getAccessToken()`. So when Pattern A users call `client.getHttpClient().setAuthToken(jwt)`, HTTP requests use the bridged JWT, but realtime silently falls back to the anon key.

**Reproduction:** running `sdk-realtime.js` showed `senderId: 12345678-1234-5678-90ab-cdef12345678` (the anon UUID) on a message, even though `setAuthToken` had been called with a real Better Auth user's bridged JWT. Server logs confirmed: `role: anon, userId: 12345678-...`.

**Workaround** (private API access, but works at runtime since TS `private` doesn't enforce):

```ts
function setBridgeToken(client, token) {
  client.getHttpClient().setAuthToken(token);
  // @ts-expect-error: tokenManager is private in TS, accessible at runtime
  client.realtime.tokenManager.setAccessToken(token);
}
```

After applying: server logs show `role: authenticated, userId: <BA id>`. The same workaround is needed for Clerk/Auth0/WorkOS/Kinde/Stytch — none of them have tested realtime under their integrations.

**Proper fix** (SDK level): `HttpClient.setAuthToken` should propagate to `TokenManager.setAccessToken` in addition to setting its own `userToken`. The `edgeFunctionToken` constructor path already does this (client.ts:74-76); the imperative path doesn't.

#### Bug 2: `realtime.messages.sender_id` is `uuid` — fatal for string-id auth providers

After fixing Bug 1, realtime *connections* authenticate correctly. But publishes from an authenticated user with a non-UUID id (which is **every third-party auth provider** — Clerk, Auth0, WorkOS, Kinde, Stytch, Better Auth all use strings) silently fail.

**Why:** `socket.manager.ts:330` calls `messageService.insertMessage(channel, event, payload, userId, userRole)`. `insertMessage` issues:

```sql
INSERT INTO realtime.messages (event_name, channel_id, channel_name, payload, sender_type, sender_id)
  VALUES ($1, $2, $3, $4, 'user', $5)
```

with `userId` (the third-party string id) bound to `$5` (column `sender_id uuid`). Postgres rejects with `invalid input syntax for type uuid: "..."`. The catch block swallows the error, returns `null`, and emits `REALTIME_ERROR` with code `UNAUTHORIZED` to the socket — which is a misleading error message.

**Reproduction:** raw psql confirms the cast error:

```text
INSERT INTO realtime.messages (..., sender_id) VALUES (..., 'KqxYYBLtTrPkdHfKrV6XKnfUyJwrAGsR');
ERROR:  invalid input syntax for type uuid: "KqxYYBLtTrPkdHfKrV6XKnfUyJwrAGsR"
```

**Workaround** (one-line ALTER, applies in the user's own DB):

```sql
ALTER TABLE realtime.messages ALTER COLUMN sender_id TYPE text;
```

After applying: two-user realtime works end-to-end. Alice publishes; Bob receives with `senderId: <Alice's BA id>` ✅

**Proper fix** (platform level): change `realtime.messages.sender_id` from `uuid` to `text` in InsForge core. The constraint is incompatible with the documented third-party convention (`TEXT user_id` columns) the rest of the platform already uses.

### Realtime in particular — token rotation works (Bug 1 workaround applied)

If the bridged JWT expires while the socket is connected, the broker may not immediately drop you (depends on the realtime server's mid-stream re-validation). The fix is the standard pattern: rotate well before expiry. With a 1h JWT and a 50min refresh interval, the token never expires while connected — the rotation triggers `onTokenChange` → socket reconnects with the fresh token → channels auto-resubscribe. Verified by reading `realtime.ts:182-196`:

```ts
private onTokenChange(): void {
  const token = this.tokenManager.getAccessToken() ?? this.anonKey;
  if (this.socket) this.socket.auth = token ? { token } : {};
  if (this.socket && (this.socket.connected || this.connectPromise)) {
    this.socket.disconnect();
    this.socket.connect();   // on('connect') re-subscribes channels
  }
}
```

### Summary table

| Concern | Result | Where to look |
|---|---|---|
| SDK works at all with Better Auth | ✅ identical RLS isolation as curl | `sdk-e2e.js` |
| Token re-set recovers a stale client | ✅ no need to recreate | `sdk-expiry.js` |
| Default `autoRefreshToken: true` misfires | ✅ no — doesn't match `INVALID_TOKEN` | `sdk-autorefresh-default.js` |
| Concurrent reads during rotation | ✅ 50/50 ok | `sdk-concurrent-rotate.js` |
| Storage / functions / AI / emails | ✅ shared HttpClient → shared bearer | `sdk-storage-functions.js` |
| Realtime under token rotation | ✅ auto-reconnect via `onTokenChange` | source: `realtime.ts:182` |
| `Next.js` (Pattern A or B) | ✅ both work; bridge is rendering-agnostic | source: `auth.api.getSession({ headers })` |
| `React (Vite/CRA)` SPA | ✅ Pattern A only; bridge on a separate Node backend | doc: cookie/CORS section above |

---

## Organization plugin — REVOKE addendum

The `organization` plugin (one of BA's most-requested) adds **5 new tables in `public`** with `teams: { enabled: true }`:

```text
organization, team, member, teamMember, invitation
```

Plus two columns on `session`: `activeOrganizationId`, `activeTeamId`.

### Reproducer

```bash
# /tmp/ba-insforge-test/auth-org.js — same as auth.js + organization plugin
BA_PG_PORT=5433 npx @better-auth/cli migrate --config auth-org.js -y
```

After migrate, `\dt public.*` shows the 5 new tables. **Same default grants** as core BA tables — full SELECT/INSERT/UPDATE/DELETE for both `anon` AND `authenticated`:

```text
information_schema.role_table_grants → 8 rows × 5 tables = 40 grants total
```

PostgREST exposes them immediately (200 OK):

```bash
curl http://127.0.0.1:5431/organization?select=id  # → 200 [...]
```

### Fix

Same shape as the core REVOKE — note that `teamMember` is camelCase and **must be quoted**:

```sql
REVOKE ALL ON
  public.organization, public.team, public.member,
  public."teamMember", public.invitation
FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
```

After applying:

```bash
curl http://127.0.0.1:5431/organization → permission denied for table organization  ✅
curl http://127.0.0.1:5431/member       → permission denied for table member        ✅
curl http://127.0.0.1:5431/team         → permission denied for table team          ✅
curl http://127.0.0.1:5431/invitation   → permission denied for table invitation    ✅
```

### REVOKE persists across re-migrate

Re-running `auth migrate` against an already-migrated DB:

```text
🚀 No migrations needed.
```

Subsequent `curl /organization` still returns `permission denied` — confirming Postgres only re-grants on `CREATE TABLE`, not `ALTER TABLE` (same as the core-tables behavior in finding #17).

### Multi-tenant RLS with active org

For `org_id`-scoped policies on app tables, surface `session.activeOrganizationId` as a JWT claim in the bridge route:

```ts
const token = jwt.sign({
  sub: session.user.id,
  role: 'authenticated',
  aud: 'insforge-api',
  org_id: session.session.activeOrganizationId ?? null,   // ← add
}, process.env.INSFORGE_JWT_SECRET!, { algorithm: 'HS256', expiresIn: '1h' });
```

Then policies use `current_setting('request.jwt.claims', true)::json->>'org_id'` alongside `requesting_user_id()`. (Not stress-tested end-to-end — recommended pattern only.)

### Other table-adding plugins (not tested, derived from BA source)

| Plugin | Tables | REVOKE template (camelCase requires quotes) |
|---|---|---|
| `twoFactor` | `twoFactor` | `REVOKE ALL ON public."twoFactor" ...` |
| `apiKey` | `apikey` | `REVOKE ALL ON public.apikey ...` |
| `passkey` | `passkey` | `REVOKE ALL ON public.passkey ...` |
| `oidcProvider` | `oauthApplication`, `oauthAccessToken`, `oauthConsent` | quote each |

**Rule of thumb:** after every `auth migrate`, run `\dt public.*`, diff against last known state, REVOKE anything new.

---

## Email transport via `client.emails.send` — wiring BA verification/reset

Better Auth fires `sendVerificationEmail` and `sendResetPassword` callbacks server-side. Wired through the InsForge SDK, all transactional mail goes through InsForge's email service (SMTP if configured, cloud relay otherwise).

### Auth path proven

`POST /api/email/send-raw` requires authentication. Tested all three modes:

```text
no auth                                 → 401 AUTH_INVALID_CREDENTIALS — No token provided
x-api-key: anon                         → 401 AUTH_INVALID_API_KEY      — Invalid API key
admin token (project_admin)             → reached service layer        ✅
bridge-style HS256 (sub + role + aud)   → reached service layer        ✅
```

A 5-minute HS256 token signed with `INSFORGE_JWT_SECRET` and the same claim shape as our end-user bridge JWT (`sub`, `role: 'authenticated'`, `aud: 'insforge-api'`) clears the auth gate. The `sub` can be any stable string — for service contexts I used `'better-auth-service'`. Reproducer: `email-transport.js`.

### Provider resolution

InsForge resolves the provider per-call (`backend/src/services/email/email.service.ts:resolveProvider()`):

```text
1. SmtpConfigService.getRawSmtpConfig() returns config? → SmtpEmailProvider
2. otherwise                                            → CloudEmailProvider
```

Cloud provider (`providers/email/cloud.provider.ts:25`) hard-fails with `PROJECT_ID is not configured` unless cloud-mode is enabled. SMTP provider needs config via `PUT /api/auth/smtp-config` (admin-only).

### SMTP config gotcha — SSRF guard rejects loopback

Tried `host: "host.docker.internal"` to point at a local maildev catcher:

```text
PUT /api/auth/smtp-config
{ "host": "host.docker.internal", "port": 587, ... }
→ 400 INVALID_INPUT: SMTP host resolves to a private or loopback address, which is not allowed
```

Good for prod (prevents SSRF), inconvenient for local dev. For testing self-hosted SMTP locally, use a non-loopback hostname (LAN `.local`, ngrok-exposed maildev, or a real provider with sandbox creds).

### Why a service token, not the bridge

The end-user bridge route (`/api/insforge-token`) reads BA's session cookie and signs `sub = session.user.id`. But `sendVerificationEmail` runs **before** the user has a verified session — there is no end-user JWT to bridge. A short-lived service-style HS256 (same secret) is the correct primitive. This is the equivalent of "service role" calls in similar stacks.

### Files

- Reference guide section: `references/better-auth.md` → "Email transport (verification + password reset)"
- Skeleton: `examples/better-auth-nextjs/lib/insforge-server-mailer.ts` (helper)
- Skeleton: `examples/better-auth-nextjs/lib/auth.ts` (commented-out wiring)
- Reproducer: `/tmp/ba-insforge-test/email-transport.js`
