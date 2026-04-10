
# InsForge + Clerk Integration Guide

Clerk signs tokens with InsForge's JWT secret directly via a **JWT Template** — no server-side signing needed. The app calls `getToken({ template: 'insforge' })` and passes the result to the InsForge client as `edgeFunctionToken`.

## Key packages

- `@clerk/clerk-react` (React + Vite) or `@clerk/nextjs` (Next.js)
- `@insforge/sdk` — InsForge client

## Recommended Workflow

```text
1. Create Clerk application        → Clerk Dashboard (manual)
2. Create/link InsForge project    → npx @insforge/cli create or link
3. Create JWT template in Clerk    → Clerk Dashboard (manual)
4. Install deps + configure env    → npm install, .env / .env.local
5. Initialize InsForge client      → Pass getToken({ template: 'insforge' }) as edgeFunctionToken
6. Set up InsForge database        → requesting_user_id() + table + RLS
7. Build features                  → CRUD pages using InsForge client
```

## Dashboard setup (manual, cannot be automated)

### Clerk Application
- Create an application in Clerk Dashboard
- Note down **Publishable Key** and **Secret Key**

### Clerk JWT Template
- Create in Clerk Dashboard > Configure > JWT Templates > New template > Blank
- Name: `insforge`
- Signing algorithm: `HS256`
- Signing key: the InsForge JWT Secret
- Claims: `{ "role": "authenticated", "aud": "insforge-api" }`
- Do NOT add `sub` or `iss` — they are reserved and auto-included

### InsForge Project
- Create via `npx @insforge/cli create` or link via `npx @insforge/cli link --project-id <id>`
- Get the JWT secret via CLI: `npx @insforge/cli secrets get JWT_SECRET`
- Note down **URL** and **Anon Key** from InsForge, then use the CLI output as the signing key in Clerk

## InsForge client

- Use `useAuth()` hook to get `getToken`
- Pass `edgeFunctionToken` as an **async function** that calls `getToken({ template: 'insforge' })` — this ensures token refresh on expiry
- The template name `'insforge'` must match the Clerk dashboard
- React + Vite: use `@clerk/clerk-react`, env vars prefixed with `VITE_`
- Next.js: use `@clerk/nextjs`, env vars prefixed with `NEXT_PUBLIC_`

```javascript
import { createClient } from '@insforge/sdk';
import { useAuth } from '@clerk/clerk-react';

const { getToken } = useAuth();

const insforge = createClient({
  baseUrl: 'YOUR_INSFORGE_URL',
  edgeFunctionToken: async () => {
    const token = await getToken({ template: 'insforge' });
    return token;
  },
});
```

## Database setup

- Clerk user IDs are strings (e.g. `user_2xPnG8KxVQr`), not UUIDs — use `TEXT` columns for `user_id`
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

| Variable | Source | Framework |
|----------|--------|-----------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard | React + Vite |
| `VITE_INSFORGE_BASE_URL` | InsForge Dashboard | React + Vite |
| `VITE_INSFORGE_ANON_KEY` | InsForge Dashboard | React + Vite |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard | Next.js |
| `CLERK_SECRET_KEY` | Clerk Dashboard | Next.js |
| `NEXT_PUBLIC_INSFORGE_URL` | InsForge Dashboard | Next.js |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | InsForge Dashboard | Next.js |

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| ❌ Passing the token as a string | ✅ Pass an async function — ensures token refresh on expiry |
| ❌ Adding `sub` or `iss` to the JWT template | ✅ These are reserved claims, auto-included by Clerk |
| ❌ Using `auth.uid()` for RLS policies | ✅ Use `requesting_user_id()` — Clerk IDs are strings, not UUIDs |
