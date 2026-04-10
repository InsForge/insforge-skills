
# InsForge + Stytch Integration Guide

Stytch handles authentication via email magic links on the client side. On the server, the Stytch Node SDK validates the session cookie, retrieves the user ID, and signs a JWT with InsForge's secret. The token is passed to InsForge as `edgeFunctionToken`.

## Key packages

- `@stytch/nextjs` + `@stytch/vanilla-js` — Stytch frontend SDK
- `stytch` — Stytch Node SDK (server-side session validation)
- `@insforge/sdk` — InsForge client
- `jsonwebtoken` — for server-side JWT signing

## Recommended Workflow

```text
1. Configure Stytch project        → Stytch Dashboard (manual)
2. Create/link InsForge project    → npx @insforge/cli create or link
3. Install deps + configure env    → npm install, .env.local
4. Create Stytch provider          → app/stytch-provider.tsx (client component)
5. Create login page               → app/login/page.tsx with magic links
6. Create auth callback page       → app/authenticate/page.tsx (client component, NOT route handler)
7. Create InsForge client utility  → lib/insforge.ts (server-side session validation + JWT signing)
8. Set up InsForge database        → requesting_user_id() + table + RLS
9. Build features                  → CRUD pages using InsForge client
```

## Dashboard setup (manual, cannot be automated)

### Stytch Project
- In Stytch Dashboard > Redirect URLs, add `http://localhost:3000/authenticate` (Type: All)
- In Frontend SDK > Configuration, add `http://localhost:3000` as an authorized domain
- Note down **Project ID**, **Public Token**, **Secret** from Project overview > API keys

### InsForge Project
- Create via `npx @insforge/cli create` or link via `npx @insforge/cli link --project-id <id>`
- Get the JWT secret via CLI: `npx @insforge/cli secrets get JWT_SECRET`
- Note down **URL** and **Anon Key** from InsForge, then export the CLI value as `INSFORGE_JWT_SECRET`

## Stytch provider

- Create a `StytchProviderWrapper` **client component** at `app/stytch-provider.tsx` using `createStytchUIClient` with the public token
- Wrap the app with it in `app/layout.tsx`

```typescript
// app/stytch-provider.tsx
'use client';

import { StytchProvider, createStytchUIClient } from '@stytch/nextjs';

const stytch = createStytchUIClient(
  process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN!
);

export default function StytchProviderWrapper({ children }: { children: React.ReactNode }) {
  return <StytchProvider stytch={stytch}>{children}</StytchProvider>;
}
```

## Login page

- Create `app/login/page.tsx` as a client component
- Use `StytchLogin` component with `Products.emailMagicLinks`
- Configure redirect URLs to point to `/authenticate`

```typescript
// app/login/page.tsx
'use client';

import { Products, StytchLogin } from '@stytch/nextjs';

export default function Login() {
  const config = {
    products: [Products.emailMagicLinks],
    emailMagicLinksOptions: {
      loginRedirectURL: 'http://localhost:3000/authenticate',
      loginExpirationMinutes: 30,
      signupRedirectURL: 'http://localhost:3000/authenticate',
      signupExpirationMinutes: 30,
    },
  };

  return <StytchLogin config={config} />;
}
```

## Authentication callback

- **Must be a client-side page** at `app/authenticate/page.tsx`, NOT a route handler — Stytch SDK handles magic link tokens on the client
- Use `useStytch().magicLinks.authenticate()` to exchange the token
- Use a `useRef` to prevent double-authentication (React strict mode / re-renders)
- Check `stytch_token_type === 'magic_links'` from search params before authenticating
- Redirect to `/` on success, `/login` on failure

```typescript
// app/authenticate/page.tsx
'use client';

import { useStytch, useStytchSession } from '@stytch/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function Authenticate() {
  const stytch = useStytch();
  const { session } = useStytchSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const authenticating = useRef(false);

  useEffect(() => {
    if (session) { router.replace('/'); return; }
    const token = searchParams.get('token');
    const type = searchParams.get('stytch_token_type');
    if (token && type === 'magic_links' && !authenticating.current) {
      authenticating.current = true;
      stytch.magicLinks
        .authenticate(token, { session_duration_minutes: 60 })
        .then(() => router.replace('/'))
        .catch(() => router.replace('/login'));
    }
  }, [stytch, session, router, searchParams]);

  return <div>Authenticating...</div>;
}
```

## InsForge client

- Create a server-side utility at `lib/insforge.ts`
- Create a Stytch `Client` instance with `project_id` and `secret` (use `envs.test` for dev)
- Read `stytch_session` from cookies via `next/headers`
- Validate the session via `stytchClient.sessions.authenticate({ session_token })`
- Sign a JWT with `jsonwebtoken` using `INSFORGE_JWT_SECRET`
- Required claims: `sub` (from `session.user_id`), `role: "authenticated"`, `aud: "insforge-api"`
- Pass the signed token as `edgeFunctionToken` to `createClient`

```typescript
// lib/insforge.ts
import { createClient } from '@insforge/sdk';
import jwt from 'jsonwebtoken';
import { Client, envs } from 'stytch';
import { cookies } from 'next/headers';

const stytchClient = new Client({
  project_id: process.env.STYTCH_PROJECT_ID!,
  secret: process.env.STYTCH_SECRET!,
  env: envs.test,
});

export async function createInsForgeClient() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('stytch_session')?.value;
  if (!sessionToken) return null;

  const { session } = await stytchClient.sessions.authenticate({
    session_token: sessionToken,
  });

  const insforgeToken = jwt.sign(
    {
      sub: session.user_id,
      role: 'authenticated',
      aud: 'insforge-api',
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    },
    process.env.INSFORGE_JWT_SECRET!
  );

  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    edgeFunctionToken: insforgeToken,
  });
}
```

## Database setup

- Stytch user IDs are strings (e.g. `user-test-...`), not UUIDs — use `TEXT` columns for `user_id`
- Create a `requesting_user_id()` SQL function that extracts the `sub` claim from `request.jwt.claims` as text
- Set `user_id` column default to `requesting_user_id()` so it auto-populates on insert
- Enable RLS and create policies that compare `user_id = requesting_user_id()`

```sql
create or replace function public.requesting_user_id()
returns text
language sql stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::json->>'sub',
    ''
  )::text
$$;
```

## Environment variables

| Variable | Source |
|----------|--------|
| `STYTCH_PROJECT_ENV` | `test` for dev |
| `STYTCH_PROJECT_ID` | Stytch Dashboard |
| `NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN` | Stytch Dashboard |
| `STYTCH_SECRET` | Stytch Dashboard |
| `NEXT_PUBLIC_INSFORGE_URL` | InsForge Dashboard |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | InsForge Dashboard |
| `INSFORGE_JWT_SECRET` | InsForge CLI (`npx @insforge/cli secrets get JWT_SECRET`) |

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| ❌ Making the callback a route handler | ✅ Must be a client-side page — Stytch SDK handles magic links on the client |
| ❌ Forgetting redirect URL / domain in Stytch dashboard | ✅ Add both `http://localhost:3000/authenticate` and `http://localhost:3000` |
| ❌ Not guarding against double-authentication | ✅ Use a `useRef` to prevent re-entry on re-renders |
| ❌ Using `auth.uid()` for RLS policies | ✅ Use `requesting_user_id()` — Stytch IDs are strings, not UUIDs |
