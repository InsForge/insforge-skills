# Better Auth + InsForge — runnable Next.js example

A minimal end-to-end skeleton showing the full integration. Mirrors the integration guide at `skills/insforge-integrations/references/better-auth.md`.

## What it shows

- **Better Auth** mounted at `/api/auth/[...all]` with email/password.
- **The bridge route** at `/api/insforge-token` that re-signs the BA session as an HS256 JWT for InsForge.
- **`useInsforgeClient` hook** (Pattern A) keeping a long-lived `@insforge/sdk` client in sync with the BA session — propagates the bridged JWT to BOTH the HTTP client AND the realtime TokenManager.
- **`createInsForgeClient` server helper** (Pattern B) for RSC and route handlers.
- **One-page app** that signs you up/in, lists notes the bridged user owns, and inserts new ones via `client.database` — RLS isolates per user.
- **`sql/01-init.sql`** provisions `requesting_user_id()`, an RLS-protected `notes` table, and (optionally) realtime support.
- **`sql/02-revoke.sql`** locks down PostgREST exposure of Better Auth's tables.

## Setup

```bash
# 0. Have InsForge running with Postgres reachable.
#    Default expectation: postgresql://postgres:postgres@127.0.0.1:5432/insforge

# 1. Install
npm install

# 2. Copy env file and fill in real values
cp .env.example .env.local
#  - DATABASE_URL              — Postgres your InsForge runs on (use postgres role)
#  - BETTER_AUTH_SECRET         — openssl rand -base64 32
#  - INSFORGE_JWT_SECRET        — npx @insforge/cli secrets get JWT_SECRET
#  - NEXT_PUBLIC_INSFORGE_*     — from InsForge dashboard

# 3. Create Better Auth tables in InsForge's Postgres (creates user/session/account/verification in public)
npm run auth:migrate

# 4. Initialize app schema + REVOKE the BA tables from anon/authenticated
npm run db:setup

# 5. Run
npm run dev
# → http://localhost:3000
```

## Verifying

Sign up at `/sign-up`, then on the home page:

- The page shows your email + Better Auth `id`
- "Add a note" inserts via `client.database.from('notes').insert(...)`
- Reload — you see only your own notes (RLS works through the bridge)
- Sign out, sign back in — same notes are still yours
- `curl http://localhost:5430/user` (PostgREST anon) — should return `permission denied for table user` (REVOKE works)

## What's not in this skeleton

- OAuth providers — GitHub, Google, etc. (add in `lib/auth.ts` with `socialProviders: { github: { ... } }`; the key is lowercase, that's the Better Auth API)
- Email verification (BA's `sendVerificationEmail` callback wired to `client.emails.send`)
- The Organization plugin (adds `organization`, `member`, `team`, `invitation` tables — REVOKE those too)
- Tests

These are deliberately omitted to keep the skeleton tight. The integration guide covers them.
