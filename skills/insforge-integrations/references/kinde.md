
# InsForge + Kinde Integration Guide

Kinde **does not support custom JWT signing keys**, so you sign a separate JWT server-side using `jsonwebtoken`. The flow: get the Kinde user from the server session → sign a JWT with InsForge's secret → pass it to InsForge as `edgeFunctionToken`.

## Key packages

- `@kinde-oss/kinde-auth-nextjs` — Kinde SDK for Next.js
- `@insforge/sdk` — InsForge client
- `jsonwebtoken` + `@types/jsonwebtoken` — for server-side JWT signing

## Recommended Workflow

```text
1. Create Kinde application        → Kinde Dashboard (manual)
2. Create/link InsForge project    → npx @insforge/cli create or link
3. Install deps + configure env    → npm install, .env.local
4. Create Kinde auth route         → app/api/auth/[kindeAuth]/route.js
5. Create InsForge client utility  → lib/insforge.ts (server-side JWT signing)
6. Set up InsForge database        → requesting_user_id() + table + RLS
7. Build features                  → CRUD pages using InsForge client
```

## Dashboard setup (manual, cannot be automated)

### Kinde Application
- Create in Kinde Dashboard > Add application
- Type: **Back-end web**, SDK: **Next.js**
- Set **Allowed callback URL** to `http://localhost:3000/api/auth/kinde_callback`
- Set **Allowed logout redirect URL** to `http://localhost:3000`
- Enable desired auth methods (Email, Google, etc.) under Authentication
- Note down **Domain**, **Client ID**, **Client Secret** from App Keys

### InsForge Project
- Create via `npx @insforge/cli create` or link via `npx @insforge/cli link --project-id <id>`
- Get the JWT secret via CLI: `npx @insforge/cli secrets get JWT_SECRET`
- Note down **URL** and **Anon Key** from InsForge, then export the CLI value as `INSFORGE_JWT_SECRET`

## Kinde auth route

- Create `app/api/auth/[kindeAuth]/route.js` that exports `handleAuth()` from `@kinde-oss/kinde-auth-nextjs/server`

```javascript
// app/api/auth/[kindeAuth]/route.js
import { handleAuth } from "@kinde-oss/kinde-auth-nextjs/server";

export const GET = handleAuth();
```

## InsForge client

- Create a server-side utility at `lib/insforge.ts` — cannot be used in client components
- Use `getKindeServerSession()` to get `getUser`
- Sign a JWT with `jsonwebtoken` using `process.env.INSFORGE_JWT_SECRET`
- Required claims: `sub` (from `user.id`), `role: "authenticated"`, `aud: "insforge-api"`, `email`
- Set `expiresIn: '1h'`
- Pass the signed token as `edgeFunctionToken` to `createClient`

```typescript
// lib/insforge.ts
import { createClient } from '@insforge/sdk';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import jwt from 'jsonwebtoken';

export async function createInsForgeClient() {
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  let edgeFunctionToken: string | undefined;
  if (user) {
    edgeFunctionToken = jwt.sign(
      {
        sub: user.id,
        role: 'authenticated',
        aud: 'insforge-api',
        email: user.email,
      },
      process.env.INSFORGE_JWT_SECRET!,
      { expiresIn: '1h' }
    );
  }

  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    edgeFunctionToken,
  });
}
```

## Database setup

- Kinde user IDs are strings (e.g. `kp_1234abcd`), not UUIDs — use `TEXT` columns for `user_id`
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
| `KINDE_CLIENT_ID` | Kinde Dashboard > App Keys |
| `KINDE_CLIENT_SECRET` | Kinde Dashboard > App Keys |
| `KINDE_ISSUER_URL` | `https://YOUR_DOMAIN.kinde.com` |
| `KINDE_SITE_URL` | `http://localhost:3000` |
| `KINDE_POST_LOGOUT_REDIRECT_URL` | `http://localhost:3000` |
| `KINDE_POST_LOGIN_REDIRECT_URL` | `http://localhost:3000` |
| `NEXT_PUBLIC_INSFORGE_URL` | InsForge Dashboard |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | InsForge Dashboard |
| `INSFORGE_JWT_SECRET` | InsForge CLI (`npx @insforge/cli secrets get JWT_SECRET`) |

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| ❌ Using Kinde's JWT directly with InsForge | ✅ Kinde doesn't sign with your secret — sign a separate JWT server-side |
| ❌ Using InsForge client in a client component | ✅ `getKindeServerSession` is server-only — keep the utility server-side |
| ❌ Using `auth.uid()` for RLS policies | ✅ Use `requesting_user_id()` — Kinde IDs are strings, not UUIDs |
