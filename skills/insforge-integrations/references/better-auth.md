# InsForge + Better Auth Integration Guide

Better Auth is the only supported auth provider that **runs inside your own Postgres database** — there is no third-party SaaS in the loop. You point Better Auth at InsForge's Postgres via a connection string, it creates `user` / `session` / `account` / `verification` tables in `public`, and a small bridge route on your app server signs an HS256 JWT for the InsForge HTTP API. Better Auth's `id` column is a string (not UUID), the same convention every other third-party integration here uses for `user_id`.

This guide covers two framework setups in detail:

- **Next.js (App Router)** — same-origin, fullstack; the easy path
- **Vite + React** (or any standalone React SPA) — needs a small Node server somewhere to host BA's routes; covered in [its own section](#vite--react-only-setups)

The auth/bridge primitives are framework-agnostic — `lib/auth.ts`, the REVOKE block, RLS policies, plugins, and the `useInsforgeClient` hook are identical across both. Only the route-handler shape and a few env-var prefixes differ.

## Key packages

- `better-auth` — Better Auth core
- `@better-auth/cli` — for `npx @better-auth/cli migrate`
- `pg` — Postgres driver (Better Auth wraps this)
- `jsonwebtoken` + `@types/jsonwebtoken` — server-side JWT signing for the bridge
- `@insforge/sdk` — InsForge client

## Recommended Workflow

```text
1. Create/link InsForge project          → npx @insforge/cli create or link
2. Get InsForge JWT secret + Postgres URL → npx @insforge/cli secrets get JWT_SECRET / DATABASE_URL
3. Install deps + configure env          → npm install, .env.local
4. Configure Better Auth                  → lib/auth.ts pointed at InsForge Postgres
5. Create Better Auth tables              → npx @better-auth/cli migrate
6. Lock down PostgREST exposure          → REVOKE block (REQUIRED — see below)
7. Wire Better Auth route handlers        → Next: app/api/auth/[...all]/route.ts
                                            Vite: server.ts (Hono/Express) on a side port
8. Add the bridge route                   → Next: app/api/insforge-token/route.ts
                                            Vite: same server.ts as step 7
9. Set up requesting_user_id() + RLS      → SQL block
10. Initialize InsForge client            → useInsforgeClient hook (Pattern A)
                                              or createInsForgeClient() (Pattern B, RSC only)
11. Build features                        → CRUD pages using InsForge client
```

Two runnable skeletons live alongside this guide:
- `examples/better-auth-nextjs/` — Next.js App Router, same-origin
- `examples/better-auth-react/` — Vite + React, same-origin via proxy

## Dashboard setup (manual, cannot be automated)

### InsForge Project
- Create via `npx @insforge/cli create` or link via `npx @insforge/cli link --project-id <id>`
- Get the JWT secret: `npx @insforge/cli secrets get JWT_SECRET` — used to sign the bridge JWT
- Get the Postgres connection string for Better Auth's pool — for self-hosted InsForge, the docker-compose exposes `POSTGRES_PORT` (default `5432`) with the project's `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`
- Note **Base URL** and **Anon Key** from the InsForge dashboard

### Better Auth
No SaaS dashboard. Better Auth runs entirely in your code + your Postgres.

## Better Auth configuration

```ts
// lib/auth.ts
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

// Fail at module-load if a required var is missing. Better than `!`
// because the error names the missing var instead of crashing on a
// downstream undefined.
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const auth = betterAuth({
  database: new Pool({
    connectionString: requireEnv('DATABASE_URL'),   // your InsForge Postgres
  }),
  emailAndPassword: { enabled: true },
  secret: requireEnv('BETTER_AUTH_SECRET'),         // Better Auth's own session secret — different from InsForge's JWT_SECRET
  baseURL: requireEnv('BETTER_AUTH_URL'),           // e.g. http://localhost:3000
});
```

```ts
// lib/auth-client.ts
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
});
```

### First migrate

```bash
npx @better-auth/cli migrate --config ./lib/auth.ts -y
```

Creates four tables in `public`: `user`, `session`, `account`, `verification`. Idempotent — re-run any time you add `additionalFields`.

### Lock down PostgREST exposure (REQUIRED)

**This is the one step the upstream Better Auth Supabase guide forgets.** Without it, anyone with your anon key can read user emails through the InsForge data API.

```sql
REVOKE ALL ON public."user", public.session, public.account, public.verification
  FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
```

The `REVOKE` survives subsequent `auth migrate` runs (Postgres only re-grants on `CREATE TABLE`, not `ALTER TABLE`). Better Auth itself connects as the `postgres` superuser via the connection string and is unaffected. `project_admin` retains access for InsForge Studio inspection — `REVOKE` from it too if you want full lockdown.

> **Enabling plugins later?** Every Better Auth plugin that adds tables (`organization`, `twoFactor`, `apiKey`, `passkey`, …) creates them in `public` with the same default grants. Re-run an analogous `REVOKE` for the plugin's tables. The Organization plugin specifically is covered in the [Better Auth plugins](#better-auth-plugins-optional) section below.

## Better Auth route handlers (Next.js)

```ts
// app/api/auth/[...all]/route.ts
import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { POST, GET } = toNextJsHandler(auth);
```

For Vite/React or other non-Next setups (Hono, Express, Fastify, Bun), see [Vite / React-only setups](#vite--react-only-setups).

## The bridge route (Next.js)

This is where the integration lives. Better Auth's own `jwt()` plugin issues asymmetric tokens (EdDSA/ES256/RS256) which InsForge's PostgREST cannot verify — it expects HS256 signed with the InsForge JWT secret. So we re-sign:

```ts
// app/api/insforge-token/route.ts
import { auth } from '@/lib/auth';
import jwt from 'jsonwebtoken';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }
  // Mint the smallest claim set InsForge needs. Don't add email or other PII —
  // RLS reads sub via auth.jwt() ->> 'sub' and that's all that matters.
  const token = jwt.sign(
    {
      sub: session.user.id,
      role: 'authenticated',
      aud: 'insforge-api',
    },
    process.env.INSFORGE_JWT_SECRET!,
    { algorithm: 'HS256', expiresIn: '1h' },
  );
  // no-store: bridge tokens are short-lived and per-session — never cache.
  return NextResponse.json(
    { token },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
```

Same shape and claims as the WorkOS / Auth0 / Kinde / Stytch guides — only difference is the session is read from Better Auth instead of a SaaS provider. The non-Next equivalent (Hono / Express) is in [Vite / React-only setups](#vite--react-only-setups).

## InsForge client

Two patterns, same as the existing five guides. **Pattern A** is the default; **Pattern B** is for SSR-heavy apps.

### Pattern A — long-lived client + imperative refresh (SPA / client components)

Same shape as the Clerk integration. Better Auth's `useSession()` provides reactive sign-in/sign-out state. **Framework-agnostic React** — works identically in Next.js client components and standalone Vite/CRA/etc apps; only the env-var accessor differs (`process.env.NEXT_PUBLIC_*` vs `import.meta.env.VITE_*`).

```tsx
// lib/insforge.ts
'use client';   // Next.js — drop this directive in Vite / non-Next setups

import { createClient, type InsForgeClient } from '@insforge/sdk';
import { authClient } from './auth-client';
import { useEffect, useMemo, useState } from 'react';

const REFRESH_INTERVAL_MS = 50 * 60 * 1000;   // 50 min for a 1h bridge JWT

export function useInsforgeClient(): { client: InsForgeClient; isReady: boolean } {
  const session = authClient.useSession();
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
      client.setAccessToken(null);
      setIsReady(false);
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch('/api/insforge-token', { credentials: 'same-origin' });
        if (!res.ok) throw new Error(`bridge ${res.status}`);
        const { token } = await res.json();
        if (cancelled) return;
        client.setAccessToken(token);   // updates HTTP + realtime in one call
        setIsReady(true);
      } catch {
        if (cancelled) return;
        client.setAccessToken(null);
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

> `client.setAccessToken(token)` is a public SDK method (≥1.3.0) that updates the HTTP client AND the realtime TokenManager in one call. On older SDKs you had to call `client.getHttpClient().setAuthToken(token)` plus reach into the private `client.realtime.tokenManager.setAccessToken(token)` separately — forgetting the second one made `senderId` show up as the anon UUID in realtime broadcasts.

### Pattern B — per-request client construction (server components, route handlers)

Same shape as the WorkOS / Auth0 / Kinde / Stytch guides. Use this in RSC or server actions.

```ts
// lib/insforge.server.ts
import { createClient } from '@insforge/sdk';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import jwt from 'jsonwebtoken';

export async function createInsForgeClient() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const insforgeToken = jwt.sign(
    {
      sub: session.user.id,
      role: 'authenticated',
      aud: 'insforge-api',
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    },
    process.env.INSFORGE_JWT_SECRET!,
  );

  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL!,
    edgeFunctionToken: insforgeToken,
  });
}
```

### Sign-out

Better Auth sign-out doesn't clear the InsForge SDK's in-memory token. Pattern A handles this automatically via the `useEffect` cleanup; if you sign out outside of React, do it explicitly. `client.setAccessToken(null)` clears **both** the HTTP token and the realtime token in one call (SDK ≥ 1.3.0):

```ts
await authClient.signOut();
client.setAccessToken(null);   // clears HTTP + realtime; SDK ≥ 1.3.0
```

On older SDKs (< 1.3.0), do the dual-update yourself:

```ts
await authClient.signOut();
client.getHttpClient().setAuthToken(null);
client.realtime['tokenManager'].setAccessToken(null);   // private at compile-time, accessible at runtime
```

## Database setup

Better Auth user IDs are **strings** (e.g. `f5kGYiUXDPEJqRDQ4jgtNTopIzpj5MgK`), not UUIDs. Use `TEXT` for any FK referencing them, and FK to `public.user(id)` — never to `auth.users(id)` (which is InsForge's separate native table).

```sql
-- 1. helper that extracts sub claim from request.jwt.claims
CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::text
$$;

-- 2. example: a notes table owned by Better Auth users
-- All statements below are rerun-safe so this script can be applied repeatedly
-- (Postgres has no CREATE POLICY IF NOT EXISTS through PG17, so DROP IF EXISTS first).
CREATE TABLE IF NOT EXISTS public.notes (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL DEFAULT public.requesting_user_id()
    REFERENCES public."user"(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notes_owner_select ON public.notes;
CREATE POLICY notes_owner_select ON public.notes
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS notes_owner_insert ON public.notes;
CREATE POLICY notes_owner_insert ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS notes_owner_update ON public.notes;
CREATE POLICY notes_owner_update ON public.notes
  FOR UPDATE TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS notes_owner_delete ON public.notes;
CREATE POLICY notes_owner_delete ON public.notes
  FOR DELETE TO authenticated
  USING (user_id = public.requesting_user_id());

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;

NOTIFY pgrst, 'reload schema';
```

Prefer running this through the InsForge CLI (`npx @insforge/cli db migrations new ... && npx @insforge/cli db migrations up`) — the CLI emits the `NOTIFY` automatically. Raw `psql` works but you must send the notify yourself or PostgREST returns `404 {}` until next reload.

## Realtime (optional)

If you use `client.realtime`, two extra one-time setup steps are needed because Better Auth IDs are strings (not UUIDs) and InsForge realtime currently requires both manual channel registration and a column-type fix.

```sql
-- 1. Allow string sender_ids (matches the rest of the third-party convention)
ALTER TABLE realtime.messages ALTER COLUMN sender_id TYPE text;

-- 2. Register a channel pattern (admin-only operation; do this once)
INSERT INTO realtime.channels (pattern, description, enabled)
  VALUES ('chat:%', 'app chat channels', TRUE)
  ON CONFLICT (pattern) DO NOTHING;
```

The channel pattern uses SQL `LIKE` syntax — `chat:%` matches `chat:lobby`, `chat:dm:user_xyz`, etc.

`client.setAccessToken()` (used in Pattern A above) already propagates the token to the realtime `TokenManager` — that's why we call it on every refresh, not just when realtime is in use. Pattern B (`createClient({ edgeFunctionToken: ... })`) handles both automatically.

After the SQL fixes above: a two-user realtime broadcast verifies end-to-end — `senderId` on the received message equals the publisher's Better Auth `id`.

## Email transport (verification + password reset)

Better Auth invokes `sendVerificationEmail` and `sendResetPassword` callbacks on signup and reset flows. Wire those callbacks to InsForge's `client.emails.send()` so all transactional mail goes through one provider.

```ts
// lib/auth.ts
import { betterAuth } from 'better-auth';
import { createClient } from '@insforge/sdk';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

// Per-call helper — BA callbacks fire server-side without an end-user JWT,
// so mint a short-lived service-style HS256 token signed with the SAME
// secret that the bridge route uses. Reusing INSFORGE_JWT_SECRET keeps the
// trust boundary minimal.
function insforgeServerClient() {
  const token = jwt.sign(
    { sub: 'better-auth-service', role: 'authenticated', aud: 'insforge-api' },
    process.env.INSFORGE_JWT_SECRET!,
    { algorithm: 'HS256', expiresIn: '5m' },
  );
  const c = createClient({ baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL! });
  c.getHttpClient().setAuthToken(token);
  return c;
}

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL! }),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const insforge = insforgeServerClient();
      const { error } = await insforge.emails.send({
        to: user.email,
        subject: 'Reset your password',
        html: `<p>Click <a href="${url}">here</a> to reset.</p>`,
      });
      if (error) throw new Error(error.message);
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      const insforge = insforgeServerClient();
      const { error } = await insforge.emails.send({
        to: user.email,
        subject: 'Verify your email',
        html: `<p>Hi ${user.name ?? ''}, click <a href="${url}">here</a> to verify.</p>`,
      });
      if (error) throw new Error(error.message);
    },
  },
});
```

### Where InsForge actually sends from

`client.emails.send` calls `POST /api/email/send-raw`. InsForge resolves the provider per-call:

1. **SMTP** — if you set SMTP credentials via `PUT /api/auth/smtp-config` (admin token), every send goes through your SMTP server.
2. **Cloud fallback** — if no SMTP is configured, InsForge tries its managed cloud relay. Requires `PROJECT_ID` (set automatically on cloud-hosted projects; missing on self-hosted).

For self-hosted dev, configure SMTP first or you'll get `INTERNAL_ERROR: PROJECT_ID is not configured`. The `/api/auth/smtp-config` PUT validates and **rejects loopback / private addresses** as an SSRF guard, so for a local maildev/mailpit you need a non-loopback hostname (e.g. a `.local` record on your LAN, or expose maildev publicly via ngrok).

### Why a service token, not the bridge route

The bridge route (`/api/insforge-token`) is for end-user requests — it reads BA's session cookie and signs a JWT with `sub = user.id`. But `sendVerificationEmail` runs **before** the user has a session (during signup). A 5-minute service-token JWT signed with `INSFORGE_JWT_SECRET` clears the auth check at `/api/email/send-raw` and is the equivalent of a "service role" call.

## Better Auth plugins (optional)

Better Auth ships ~37 plugins. Most are drop-in (`twoFactor`, `magicLink`, `username`) and require no InsForge-side changes. Plugins that **add tables** require an additional `REVOKE` so the new rows aren't readable through PostgREST's `anon` role.

### Organization plugin

Adds five tables (`organization`, `team`, `member`, `teamMember`, `invitation`) and two columns on `session` (`activeOrganizationId`, `activeTeamId`):

```ts
// lib/auth.ts
import { organization } from 'better-auth/plugins';

export const auth = betterAuth({
  // ...
  plugins: [
    organization({ teams: { enabled: true } }),
  ],
});
```

Re-run `npx @better-auth/cli migrate -y`, then **lock down the new tables exactly like the core ones**:

```sql
REVOKE ALL ON
  public.organization, public.team, public.member,
  public."teamMember", public.invitation
FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
```

`teamMember` is camelCase in BA's schema, so it must be quoted in SQL. Verify with `curl http://<insforge>/organization?select=id` — should return `permission denied for table organization`.

For multi-tenant RLS on app tables, add `org_id` to `request.jwt.claims` by reading `session.activeOrganizationId` in the bridge route and including it as a custom claim:

```ts
// app/api/insforge-token/route.ts (delta)
const token = jwt.sign(
  {
    sub: session.user.id,
    role: 'authenticated',
    aud: 'insforge-api',
    org_id: session.session.activeOrganizationId ?? null,   // ← add
  },
  process.env.INSFORGE_JWT_SECRET!,
  { algorithm: 'HS256', expiresIn: '1h' },
);
```

Then in policies use `current_setting('request.jwt.claims', true)::json->>'org_id'` alongside `requesting_user_id()`.

### Other table-adding plugins

| Plugin | Tables added | REVOKE template |
|--------|--------------|-----------------|
| `twoFactor` | `twoFactor` | `REVOKE ALL ON public."twoFactor" FROM anon, authenticated;` |
| `apiKey` | `apikey` | `REVOKE ALL ON public.apikey FROM anon, authenticated;` |
| `passkey` | `passkey` | `REVOKE ALL ON public.passkey FROM anon, authenticated;` |
| `oidcProvider` | `oauthApplication`, `oauthAccessToken`, `oauthConsent` | quote each camelCase name |

Rule of thumb: after every `auth migrate`, `\dt public.*` to see the diff, then REVOKE anything Better Auth created.

## Vite / React-only setups

A pure React SPA (Vite, CRA, RSPack, …) has no built-in server, so you need a small Node/Bun process to host BA's `/api/auth/*` routes plus the bridge route. Two well-trodden patterns:

| Pattern | When to use | Origin model |
|---|---|---|
| **A. Vite proxy → Next.js / Hono / Express** | Already have (or want) a backend; cleanest for local dev | Same-origin to the browser (proxy hides the server) |
| **B. Cross-origin React + standalone BA server** | True microservice split; multi-domain prod | Different origins; needs explicit CORS + cookie config |

The runnable skeleton at `examples/better-auth-react/` demonstrates **Pattern A**.

### Pattern A — Vite proxy

`vite.config.ts` proxies `/api` to the BA server. To the browser everything is on `:5173`, so the BA cookie is auto-attached to `/api/insforge-token` with no CORS dance.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3030',          // your BA / bridge server
        changeOrigin: true,
        configure: (proxy) => {
          // Rewrite Origin so BA's CSRF check (which compares the request's
          // Origin against its `baseURL`) sees its own URL. Without this,
          // sign-out (and any other state-changing endpoint that enforces
          // Origin) returns 403 because the browser's Origin is :5173, not
          // :3030. Sign-up has looser Origin handling, which is why this
          // bug only shows up later in the flow and is easy to miss.
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('origin', 'http://localhost:3030');
          });
        },
      },
    },
  },
});
```

Equivalent without the rewrite: add `trustedOrigins: ['http://localhost:5173']` to `betterAuth({...})`. Either approach works; the proxy rewrite keeps `lib/auth.ts` unchanged.

### The bridge route in non-Next servers

The Next.js route handler from earlier maps directly. Hono on Bun:

```ts
// server.ts (Hono — also works on Node via @hono/node-server, or Bun.serve)
import { Hono } from 'hono';
import { auth } from './lib/auth';
import jwt from 'jsonwebtoken';

const app = new Hono();

// 1. Better Auth catch-all — equivalent of toNextJsHandler
app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw));

// 2. Bridge route — exact same JWT shape as the Next version
app.get('/api/insforge-token', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) return c.json({ error: 'not signed in' }, 401);
  const token = jwt.sign(
    {
      sub: session.user.id,
      role: 'authenticated',
      aud: 'insforge-api',
      email: session.user.email,
    },
    process.env.INSFORGE_JWT_SECRET!,
    { algorithm: 'HS256', expiresIn: '1h' },
  );
  return c.json({ token });
});

export default { port: 3030, fetch: app.fetch };
```

Express is the same shape — `app.all('/api/auth/*', toNodeHandler(auth))` (use `better-auth/node` instead of `better-auth/next-js`), then a regular `app.get('/api/insforge-token', ...)` handler. The JWT signing block is identical.

### Env vars in Vite

Vite exposes `import.meta.env.VITE_*` instead of `process.env.NEXT_PUBLIC_*`. Anything server-only (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `INSFORGE_JWT_SECRET`) reads from `process.env` in the BA server process — same as Next.

```bash
# .env.local  (Vite project)
VITE_BETTER_AUTH_URL=http://localhost:5173      # the SPA origin (or BA origin if cross-origin)
VITE_INSFORGE_BASE_URL=http://localhost:7130
VITE_INSFORGE_ANON_KEY=<from InsForge dashboard>
```

`lib/auth-client.ts` and `lib/insforge.ts` then read `import.meta.env.VITE_BETTER_AUTH_URL` etc. The Pattern A hook code shown earlier is otherwise identical.

### Pattern B — true cross-origin (no proxy)

If you really want the React app and the BA server on different origins (e.g., `app.example.com` and `auth.example.com`), four changes vs the same-origin path:

1. **BA cookie config**: `advanced: { defaultCookieAttributes: { sameSite: 'none', secure: true } }` so the cookie crosses origins. `secure: true` requires HTTPS — `localhost` counts as a secure context in Chrome/Firefox/Safari, so this works in dev too.
2. **`trustedOrigins`** on the BA config: `trustedOrigins: ['https://app.example.com']`. Without this, BA's CSRF check rejects POSTs from the SPA with 403 (sign-out, etc. — sign-up is more lenient and won't fail, masking the issue).
3. **Bridge route CORS**: `Access-Control-Allow-Credentials: true` and an explicit `Access-Control-Allow-Origin: <app origin>` (not `*`). Plus a preflight `OPTIONS` handler.
4. **Client fetch**: `fetch('/api/insforge-token', { credentials: 'include' })` — without it the BA cookie isn't sent.

Forget any of the four and the bridge silently sees no session.

## Environment variables

Server-only vars (read via `process.env` in the BA process) are the same across both setups. Browser-exposed vars use `NEXT_PUBLIC_*` in Next.js and `VITE_*` in Vite.

| Variable | Source | Where read |
|----------|--------|-----------|
| `DATABASE_URL` | InsForge Postgres connection string | Server (BA's `Pool`) |
| `BETTER_AUTH_SECRET` | random — `openssl rand -base64 32` | Server (BA session signing) |
| `BETTER_AUTH_URL` | your BA server URL | Server (`baseURL` in `betterAuth()`) |
| `INSFORGE_JWT_SECRET` | `npx @insforge/cli secrets get JWT_SECRET` | Server (bridge route HS256 signing) |
| `NEXT_PUBLIC_BETTER_AUTH_URL` *(Next.js)* / `VITE_BETTER_AUTH_URL` *(Vite)* | same as `BETTER_AUTH_URL` (or the SPA origin if proxying) | Browser (`authClient` baseURL) |
| `NEXT_PUBLIC_INSFORGE_BASE_URL` / `VITE_INSFORGE_BASE_URL` | InsForge dashboard | Browser (SDK baseUrl) |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` / `VITE_INSFORGE_ANON_KEY` | InsForge dashboard | Browser (SDK anonKey) |

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| ❌ Skipping the REVOKE block | ✅ Anyone with your anon key can read all user emails through PostgREST. Always run the REVOKE after the first migrate. |
| ❌ Forgetting `NOTIFY pgrst, 'reload schema'` after raw psql DDL | ✅ PostgREST returns `404 {}` until reloaded. Use the InsForge CLI for migrations and the notify happens automatically. |
| ❌ Using Better Auth's `jwt()` plugin directly with InsForge | ✅ It issues asymmetric (EdDSA/ES256/RS256) tokens; InsForge's PostgREST verifies HS256. Use the bridge route instead. |
| ❌ Using `auth.uid()` for RLS policies | ✅ Use `requesting_user_id()` — Better Auth IDs are strings, not UUIDs. |
| ❌ FK'ing to `auth.users(id)` | ✅ FK to `public.user(id)` — Better Auth's table. `auth.users` is InsForge's separate native table and irrelevant here. |
| ❌ Re-using `BETTER_AUTH_SECRET` as the InsForge JWT secret | ✅ They are independent. `BETTER_AUTH_SECRET` is for Better Auth's session cookies; `INSFORGE_JWT_SECRET` is the HS256 key for the bridge JWT. |
| ❌ Setting the token only once on mount (Pattern A) | ✅ Refresh on a ~50min interval for a 1h JWT, keyed on Better Auth's `useSession()`. |
| ❌ Forgetting `credentials: 'same-origin'` (or `'include'` cross-origin) on the bridge fetch | ✅ Without credentials, the Better Auth cookie isn't sent and the bridge always returns 401. |
| ❌ Cross-origin without `sameSite: 'none'; secure` on the BA cookie | ✅ The browser drops the cookie on cross-origin requests by default. Configure Better Auth's cookies for cross-origin explicitly. |
| ❌ Missing `Origin` header on direct `fetch`/`curl` to Better Auth POSTs | ✅ Better Auth requires `Origin` for CSRF. Browsers send it automatically; server-side clients must add `'Origin: <baseURL>'`. |
| ❌ Connecting Better Auth as `anon` or `authenticated` after REVOKE | ✅ The connection-pool role must retain privileges. Use `postgres` (or another fully-granted role) in `DATABASE_URL`. |
| ❌ Realtime client shows `senderId` as the anon UUID instead of the user's BA id (Pattern A only) | ✅ Use `client.setAccessToken(token)` (SDK ≥ 1.3.0) — it updates HTTP and realtime in one call. On older SDKs the workaround is `client.getHttpClient().setAuthToken(token)` plus `client.realtime['tokenManager'].setAccessToken(token)`. Pattern B's `edgeFunctionToken` already does both. |
| ❌ Realtime publish silently fails for authenticated users (`UNAUTHORIZED`) | ✅ `realtime.messages.sender_id` is `uuid` in core InsForge; Better Auth IDs are strings. One-time fix: `ALTER TABLE realtime.messages ALTER COLUMN sender_id TYPE text;` |
| ❌ Vite SPA proxying to a separate BA server, sign-out (or any state-changing endpoint) returns 403 | ✅ BA's CSRF check compares the request's `Origin` against its `baseURL`. Either rewrite the proxy's `Origin` header to BA's URL (Vite `proxy.configure`) or add the SPA origin to BA's `trustedOrigins`. Sign-up has looser handling and won't trip this — the bug shows up later. |
| ❌ Cross-origin missing `trustedOrigins` even with `sameSite: 'none'; secure: true` | ✅ Cookie config alone isn't enough — BA's CSRF gate also reads `trustedOrigins`. Add the SPA's full origin (no trailing slash) to the array. |
