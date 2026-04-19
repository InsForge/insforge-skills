
# InsForge + Clerk Integration Guide (Next.js)

Clerk signs tokens with InsForge's JWT secret directly via a **JWT Template** — no server-side signing needed. The app calls `getToken({ template: 'insforge' })` and forwards the token to the InsForge client via the HTTP client's `setAuthToken()`.

This guide targets **Next.js (App Router)**. The same pattern works in other React setups, but all examples and env vars assume Next.js.

## Key packages

- `@clerk/nextjs` — Clerk SDK for Next.js (includes `clerkMiddleware`, `ClerkProvider`, hooks, and prebuilt `<SignIn>` / `<SignUp>` components)
- `@insforge/sdk` — InsForge client

## Recommended Workflow

```text
1. Create Clerk application        → Clerk Dashboard (manual)
2. Create/link InsForge project    → npx @insforge/cli create or link
3. Create JWT template in Clerk    → Clerk Dashboard (manual)
4. Install deps + configure env    → npm install, .env.local
5. Wire ClerkProvider + middleware → app/layout.tsx + middleware.ts
6. Initialize InsForge client      → createClient + setAuthToken with Clerk token (refresh on interval)
7. Set up InsForge database        → requesting_user_id() + table + RLS
8. Build features                  → CRUD pages using InsForge client
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

## Next.js wiring

### `middleware.ts` (project root)

```ts
import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

### `app/layout.tsx`

Wrap the app in `<ClerkProvider>` (it's a server component — no `'use client'` needed).

```tsx
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

### Sign-in / sign-up routes

Use Clerk's optional catch-all routes so Clerk's internal redirects work:

```text
app/sign-in/[[...sign-in]]/page.tsx
app/sign-up/[[...sign-up]]/page.tsx
```

```tsx
// app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs';

export default function Page() {
  return <SignIn path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/" />;
}
```

## InsForge client

- Create the client once with `createClient({ baseUrl, anonKey })`
- Use Clerk's `useAuth()` to get `getToken`
- In a `useEffect` keyed on `isSignedIn`, call `getToken({ template: 'insforge' })` and pipe the result into `client.getHttpClient().setAuthToken(token)`
- Clerk JWT templates default to **60-second expiry** — refresh the token on a ~50-second interval while the user is signed in; clear the token on sign-out
- The template name `'insforge'` must match the Clerk dashboard exactly
- `@insforge/sdk`'s `edgeFunctionToken` config field is a **static string**, not a function — it cannot auto-refresh on its own, which is why we use `setAuthToken()` imperatively
- This hook uses Clerk hooks, so the file must start with `'use client'`

```tsx
// lib/insforge.ts
'use client';

import { createClient, type InsForgeClient } from '@insforge/sdk';
import { useAuth } from '@clerk/nextjs';
import { useEffect, useMemo, useState } from 'react';

const TOKEN_REFRESH_MS = 50_000; // Clerk template tokens expire in 60s by default

export function useInsforgeClient(): { client: InsForgeClient; isReady: boolean } {
  const { getToken, isSignedIn } = useAuth();
  const [isReady, setIsReady] = useState(false);

  const client = useMemo(
    () =>
      createClient({
        baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL!,
        anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
      }),
    [],
  );

  useEffect(() => {
    if (!isSignedIn) {
      client.getHttpClient().setAuthToken(null);
      setIsReady(false);
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      try {
        const token = await getToken({ template: 'insforge' });
        if (cancelled) return;
        client.getHttpClient().setAuthToken(token ?? null);
        setIsReady(!!token);
      } catch (err) {
        if (cancelled) return;
        client.getHttpClient().setAuthToken(null);
        setIsReady(false);
        console.error('Failed to refresh Clerk token for InsForge client', err);
      }
    };

    void refresh();
    const id = setInterval(() => void refresh(), TOKEN_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client, getToken, isSignedIn]);

  return { client, isReady };
}
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

| Variable | Source | Notes |
|----------|--------|-------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard | Exposed to the browser |
| `CLERK_SECRET_KEY` | Clerk Dashboard | Server-only; required by `clerkMiddleware()` |
| `NEXT_PUBLIC_INSFORGE_BASE_URL` | InsForge Dashboard | Exposed to the browser |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | InsForge Dashboard | Exposed to the browser |

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| ❌ Passing an async function as `edgeFunctionToken` | ✅ SDK accepts only a static string there — use `setAuthToken()` from the HTTP client instead |
| ❌ Setting the token only once on mount | ✅ Refresh on a ~50s interval — Clerk JWT templates expire in 60s by default |
| ❌ Adding `sub` or `iss` to the JWT template | ✅ These are reserved claims, auto-included by Clerk |
| ❌ Using `auth.uid()` for RLS policies | ✅ Use `requesting_user_id()` — Clerk IDs are strings, not UUIDs |
| ❌ Omitting `CLERK_SECRET_KEY` in `.env.local` | ✅ `clerkMiddleware()` reads it at runtime — add it alongside the publishable key |
| ❌ Forgetting `'use client'` on `lib/insforge.ts` | ✅ The hook uses React + Clerk hooks; the file must be a client module |
