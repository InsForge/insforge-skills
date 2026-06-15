# SSR Authentication Integration

Use this reference for Next.js SSR auth. The same cookie/session concepts can be adapted to Remix, SvelteKit, Nuxt, or other SSR frameworks, but the examples below use Next.js route handlers, server actions, and Proxy/Middleware.

## Recommended Pattern

- Use `@insforge/sdk/ssr` as the standard SSR auth entrypoint for browser,
  server, refresh-route, and cookie helpers.
- Use `@insforge/sdk/ssr/middleware` for Proxy/Middleware `updateSession()`;
  this keeps the middleware bundle from pulling in the full SDK client.
- Let the SDK helpers manage the InsForge auth cookie names and expiration.
- Keep `insforge_refresh_token` httpOnly and server-owned.
- Allow `insforge_access_token` to be browser-readable so browser SDK calls and Realtime can authenticate.
- Use `/api/auth/refresh` as the app refresh endpoint unless the user already has a clear project convention.
- Use Proxy/Middleware to refresh before Server Components render.

Default cookies:

| Cookie | Visibility | Purpose |
|--------|------------|---------|
| `insforge_access_token` | `httpOnly: false` | Short-lived bearer token for Server Components, Client Components, Storage, and Realtime |
| `insforge_refresh_token` | `httpOnly: true` | Long-lived server-owned refresh credential |

Both cookies should expire at the JWT `exp`; the SDK helpers do this when tokens include `exp`.

`insforge_access_token` is intentionally readable by JavaScript so browser SDK calls, Storage, and Realtime can authenticate directly. Keep access-token TTL short. If a project requires fully httpOnly auth tokens, proxy Storage and Realtime calls through server-side routes instead of direct browser SDK calls.

## Environment Variables

For Next.js, prefer:

```bash
NEXT_PUBLIC_INSFORGE_URL=https://your-project.insforge.app
NEXT_PUBLIC_INSFORGE_ANON_KEY=...
NEXT_PUBLIC_APP_URL=https://your-app.example
```

The SSR helpers use explicit `baseUrl` / `anonKey` when provided. Otherwise they read `NEXT_PUBLIC_INSFORGE_URL` / `NEXT_PUBLIC_INSFORGE_ANON_KEY` in both browser and server code. `NEXT_PUBLIC_APP_URL` is the public app origin used by OAuth redirect examples. Missing config throws a clear error.

## Browser Client

Use this in Client Components and browser-only modules:

```typescript
// app/lib/insforge/client.ts
import { createBrowserClient } from '@insforge/sdk/ssr'

export const insforge = createBrowserClient()
```

`createBrowserClient()` reads `insforge_access_token`, uses it for SDK calls and Realtime, and refreshes through `/api/auth/refresh` when the access token is missing, expired, near expiry, or rejected with an auth-expired response.

## Server Client

Use this in Server Components, Route Handlers, and Server Actions:

```typescript
// app/lib/insforge/server.ts
import { cookies } from 'next/headers'
import { createServerClient } from '@insforge/sdk/ssr'

export async function createInsForgeServerClient() {
  return createServerClient({
    cookies: await cookies()
  })
}
```

`createServerClient()` reads the access-token cookie and passes it as the per-request bearer token. The refresh token remains server-owned.

## Refresh Route

Create the default app refresh endpoint:

```typescript
// app/api/auth/refresh/route.ts
import { createRefreshAuthRouter } from '@insforge/sdk/ssr'

export const { POST } = createRefreshAuthRouter()
```

If the app needs custom side effects, use the lower-level helper:

```typescript
// app/api/auth/refresh/route.ts
import { refreshAuth } from '@insforge/sdk/ssr'

export async function POST(request: Request) {
  const result = await refreshAuth({ request })
  // Optional: app-specific logging, telemetry, redirect validation, etc.
  return result.response
}
```

## Next.js Proxy / Middleware

Use `updateSession()` so Server Components see fresh cookies before rendering. Next.js 16 uses `proxy.ts`; Next.js 15 and earlier use `middleware.ts`.

```typescript
// proxy.ts on Next.js 16+
// middleware.ts on Next.js 15 and earlier
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@insforge/sdk/ssr/middleware'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })

  await updateSession({
    requestCookies: request.cookies,
    responseCookies: response.cookies
  })

  return response
}
```

Import `updateSession()` from `@insforge/sdk/ssr/middleware` in Proxy/Middleware
files. Keep the full `@insforge/sdk/ssr` entrypoint for `createBrowserClient()`,
`createServerClient()`, `createRefreshAuthRouter()`, `refreshAuth()`, and cookie
helpers in route handlers or server/client modules.

For `middleware.ts`, export the same handler body as `middleware`.

## Sign-In Route Or Server Action

Because the refresh token is httpOnly, sign-in and sign-up flows that establish a session should run where cookies can be written: Route Handlers or Server Actions.

```typescript
// app/api/auth/sign-in/route.ts
import { NextResponse } from 'next/server'
import { createServerClient, setAuthCookies } from '@insforge/sdk/ssr'

export async function POST(request: Request) {
  const client = createServerClient()
  const { data, error } = await client.auth.signInWithPassword(await request.json())

  if (error || !data?.accessToken) {
    return Response.json(
      { error: error?.error ?? 'AUTH_UNAUTHORIZED', message: error?.message ?? 'Sign in failed' },
      { status: error?.statusCode ?? 401 }
    )
  }

  const response = NextResponse.json({ user: data.user })
  setAuthCookies(response.cookies, {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken
  })

  return response
}
```

For Server Actions, call the same SDK methods and `setAuthCookies()` with the response/cookie surface available in that framework. In Next.js Route Handlers, pass `response.cookies`.

## OAuth In Next.js

The browser SDK auto-detects `insforge_code` for SPA flows. In SSR apps, handle OAuth on the server so the refresh token lands in an httpOnly cookie.

### Step 1: Start OAuth

```typescript
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@insforge/sdk/ssr'

export async function initiateOAuth(provider: string) {
  const client = createServerClient()
  const { data, error } = await client.auth.signInWithOAuth(provider, {
    redirectTo: new URL('/api/auth/callback', process.env.NEXT_PUBLIC_APP_URL).toString(),
    // additionalParams: { prompt: 'select_account' }, // optional provider-specific hints
    skipBrowserRedirect: true
  })

  if (error || !data.url || !data.codeVerifier) {
    throw new Error(error?.message ?? 'OAuth init failed')
  }

  const cookieStore = await cookies()
  cookieStore.set('insforge_code_verifier', data.codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600
  })

  redirect(data.url)
}
```

Use `additionalParams` only for provider-specific optional hints. Do not pass server-owned OAuth fields such as `client_id`, `scope`, `redirect_uri`, `code_challenge`, `state`, or `response_type`; InsForge sets those server-side and ignores colliding client-provided keys.

Set `redirectTo` to your app URL. The backend appends `?insforge_code=<code>` and redirects there.

### Step 2: Handle Callback

```typescript
// app/api/auth/callback/route.ts
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, setAuthCookies } from '@insforge/sdk/ssr'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('insforge_code')
  const oauthError = request.nextUrl.searchParams.get('error')

  if (oauthError || !code) {
    if (oauthError) {
      console.warn('OAuth callback failed', { error: oauthError })
    }
    return NextResponse.redirect(new URL('/login?error=oauth_failed', request.url))
  }

  const cookieStore = await cookies()
  const codeVerifier = cookieStore.get('insforge_code_verifier')?.value
  if (!codeVerifier) {
    return NextResponse.redirect(new URL('/login?error=missing_verifier', request.url))
  }

  const client = createServerClient()
  const { data, error } = await client.auth.exchangeOAuthCode(code, codeVerifier)
  if (error || !data?.accessToken) {
    if (error) {
      console.error('OAuth code exchange failed', error)
    }
    return NextResponse.redirect(new URL('/login?error=exchange_failed', request.url))
  }

  const response = NextResponse.redirect(new URL('/dashboard', request.url))
  setAuthCookies(response.cookies, {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken
  })
  response.cookies.delete('insforge_code_verifier')

  return response
}
```

## Storage And Realtime

For browser uploads, downloads, and Realtime subscriptions, use `createBrowserClient()`. Keep the refresh token server-owned and route browser refresh through `/api/auth/refresh`. When the access token expires, the browser client receives a fresh access token, updates the SDK token, and Realtime reconnects with the new token.

For server-mediated uploads, use a backend route to create a signed upload path or otherwise proxy the operation. Use direct browser SDK upload when the app wants user-scoped Storage/RLS checks and the browser has the access token cookie.

## Refresh Best Practices

- Keep the default refresh path `/api/auth/refresh` unless the app has an existing auth namespace.
- Use `createRefreshAuthRouter()` for standard apps.
- Use `refreshAuth()` only when the route needs custom side effects.
- Use `updateSession()` from `@insforge/sdk/ssr/middleware` in Proxy/Middleware to keep Server Components and browser cookies aligned without bundling the full SDK client.
- Validate post-auth redirects and only allow safe internal paths.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Creating separate cookie names across routes | Let `@insforge/sdk/ssr` helpers manage the standard auth cookie names |
| Hiding the access token from Client Components | Keep `insforge_refresh_token` httpOnly and `insforge_access_token` browser-readable |
| Missing the browser refresh route | Use `/api/auth/refresh` with `createRefreshAuthRouter()` |
| Manually guessing cookie lifetimes | Use `setAuthCookies()` so cookie expiry follows JWT `exp` |
| Appending `Set-Cookie` through `response.headers` in Next.js | Pass `response.cookies` to `setAuthCookies()` |
| Server Components reading stale cookies | Use `updateSession()` from `@insforge/sdk/ssr/middleware` in Proxy/Middleware before rendering |
| Client Components creating an unauthenticated SDK client | Use `createBrowserClient()` so the app refresh route can refresh access |
| Sending OAuth users back to the backend URL | Set `redirectTo` to the app URL where the user lands after auth |
| Exchanging OAuth codes in a Client Component | Initiate and exchange OAuth on the server, then set cookies |
