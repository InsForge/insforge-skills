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
7. **Open question (not yet tested):** the JWT bridge for InsForge RLS. Better Auth's `jwt()` plugin issues asymmetric tokens (EdDSA/ES256/RS256) that InsForge's PostgREST cannot verify directly — it expects HS256 signed with the InsForge JWT secret. Need to verify whether a small bridge route (`/api/insforge-token` that re-signs the session as HS256 with the InsForge secret) closes the loop, like the existing WorkOS/Auth0 guides do.

## Reproducer files

The test scaffolding lives at `/tmp/ba-insforge-test/`:

- `auth.js` — the Better Auth config used above
- `server.js` — minimal Node HTTP server using `toNodeHandler(auth)`
- `load.js` — 30-concurrent-signups load script (note: requires `Origin` header on POSTs)

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
