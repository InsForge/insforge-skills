# InsForge + Better Auth Integration Guide

Better Auth is the only supported auth provider that **runs inside your own Postgres database** — there is no third-party SaaS in the loop. You point Better Auth at InsForge's Postgres via a connection string, it creates `user` / `session` / `account` / `verification` tables in `public`, and a small bridge route on your app server signs an HS256 JWT for the InsForge HTTP API. Better Auth's `id` column is a string (not UUID), the same convention every other third-party integration here uses for `user_id`.

This guide targets **Next.js (App Router)**. The same pattern works in any Node-server-backed React app, with one extra step for cross-origin browsers (covered at the end).

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
7. Wire Better Auth route handlers        → app/api/auth/[...all]/route.ts
8. Add the bridge route                   → app/api/insforge-token/route.ts
9. Set up requesting_user_id() + RLS      → SQL block
10. Initialize InsForge client            → useInsforgeClient hook (Pattern A)
                                              or createInsForgeClient() (Pattern B)
11. Build features                        → CRUD pages using InsForge client
```

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

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL!,   // your InsForge Postgres
  }),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET!,         // Better Auth's own session secret — different from InsForge's JWT_SECRET
  baseURL: process.env.BETTER_AUTH_URL!,           // e.g. http://localhost:3000
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

## Better Auth route handlers

```ts
// app/api/auth/[...all]/route.ts
import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { POST, GET } = toNextJsHandler(auth);
```

## The bridge route

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
  return NextResponse.json({ token });
}
```

Same shape and claims as the WorkOS / Auth0 / Kinde / Stytch guides — only difference is the session is read from Better Auth instead of a SaaS provider.

## InsForge client

Two patterns, same as the existing five guides. **Pattern A** is the default; **Pattern B** is for SSR-heavy apps.

### Pattern A — long-lived client + imperative refresh (SPA / client components)

Same shape as the Clerk integration. Better Auth's `useSession()` provides reactive sign-in/sign-out state.

```tsx
// lib/insforge.ts
'use client';

import { createClient, type InsForgeClient } from '@insforge/sdk';
import { authClient } from '@/lib/auth-client';
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
      client.getHttpClient().setAuthToken(null);
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

Better Auth sign-out doesn't clear the InsForge SDK's in-memory token. Pattern A handles this automatically via the `useEffect` cleanup; if you sign out outside of React, do it explicitly:

```ts
await authClient.signOut();
client.getHttpClient().setAuthToken(null);   // realtime auto-reconnects on token clear
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

In the client, when using **Pattern A**, you must update **both** the HTTP token and the realtime token (the SDK's `setAuthToken` only updates HTTP):

```ts
// helper that keeps both in sync
function setBridgeToken(client, token) {
  client.getHttpClient().setAuthToken(token);
  // tokenManager is `private` in TypeScript but accessible at runtime;
  // calling setAccessToken here also fires onTokenChange, which reconnects
  // the realtime socket with the new bearer.
  // @ts-expect-error: private at compile time, public at runtime
  client.realtime.tokenManager.setAccessToken(token);
}
```

Use `setBridgeToken(client, token)` everywhere the existing `useInsforgeClient` hook calls `setAuthToken`. Pattern B (`createClient({ edgeFunctionToken: ... })`) handles both automatically.

After both fixes: a two-user realtime broadcast verifies end-to-end — `senderId` on the received message equals the publisher's Better Auth `id`.

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

## Cross-origin (React SPA without a Next.js server)

Same-origin (Next.js fullstack) is the easy path — Better Auth's session cookie is auto-attached to `/api/insforge-token` requests. If your React app and your Better Auth server are on different origins:

1. Better Auth cookie config: `cookies: { ..., sameSite: 'none', secure: true }` so the cookie crosses origins.
2. Bridge route CORS: `Access-Control-Allow-Credentials: true` and an explicit `Access-Control-Allow-Origin: <app origin>` (not `*`).
3. Client fetch: `fetch('/api/insforge-token', { credentials: 'include' })`.

Forget any of the three and the bridge silently sees no session.

## Environment variables

| Variable | Source | Notes |
|----------|--------|-------|
| `DATABASE_URL` | InsForge Postgres connection string | Server-only; what Better Auth's `Pool` reads |
| `BETTER_AUTH_SECRET` | random — `openssl rand -base64 32` | Server-only; Better Auth's session secret. Distinct from InsForge's JWT secret. |
| `BETTER_AUTH_URL` | your app URL | e.g. `http://localhost:3000` |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | same as above | Exposed to the browser for `authClient` |
| `INSFORGE_JWT_SECRET` | `npx @insforge/cli secrets get JWT_SECRET` | Server-only; what the bridge route signs HS256 tokens with |
| `NEXT_PUBLIC_INSFORGE_BASE_URL` | InsForge Dashboard | Exposed to the browser |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | InsForge Dashboard | Exposed to the browser |

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
| ❌ Realtime client shows `senderId` as the anon UUID instead of the user's BA id (Pattern A only) | ✅ `getHttpClient().setAuthToken()` doesn't propagate to realtime's `TokenManager`. Also call `client.realtime['tokenManager'].setAccessToken(token)` (private API at runtime). Pattern B's `edgeFunctionToken` doesn't need this. |
| ❌ Realtime publish silently fails for authenticated users (`UNAUTHORIZED`) | ✅ `realtime.messages.sender_id` is `uuid` in core InsForge; Better Auth IDs are strings. One-time fix: `ALTER TABLE realtime.messages ALTER COLUMN sender_id TYPE text;` |
