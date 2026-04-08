# SSR Authentication Integration

Use this reference for Next.js, Remix, SvelteKit, Nuxt server routes, or any other SSR setup where auth should run on the server and cookies must be managed explicitly.

## Recommended Pattern

- Create the InsForge client in server code only
- Use `createClient({ isServerMode: true })`
- Store `accessToken` and `refreshToken` in httpOnly cookies you control
- Pass the current access token as `edgeFunctionToken` for authenticated server-side requests
- Run sign-in, sign-up, OAuth callback, and refresh logic in server actions, route handlers, loaders, or API routes

## Minimal Next.js Server Client

```typescript
import { createClient } from '@insforge/sdk'

export function createInsForgeServerClient(accessToken?: string) {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_ANON_KEY!,
    isServerMode: true,
    edgeFunctionToken: accessToken
  })
}
```

## Minimal Cookie Helpers

```typescript
import { cookies } from 'next/headers'

const accessCookie = 'insforge_access_token'
const refreshCookie = 'insforge_refresh_token'

const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/'
}

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies()
  cookieStore.set(accessCookie, accessToken, { ...authCookieOptions, maxAge: 60 * 15 })
  cookieStore.set(refreshCookie, refreshToken, { ...authCookieOptions, maxAge: 60 * 60 * 24 * 7 })
}
```

## Minimal Sign-In Server Action

```typescript
'use server'

export async function signIn(formData: FormData) {
  const insforge = createInsForgeServerClient()
  const { data, error } = await insforge.auth.signInWithPassword({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? '')
  })

  if (error || !data?.accessToken || !data?.refreshToken) {
    return { success: false, error: error?.message ?? 'Sign in failed.' }
  }

  await setAuthCookies(data.accessToken, data.refreshToken)
  return { success: true }
}
```

## Minimal Current-User Check on the Server

```typescript
import { cookies } from 'next/headers'

export async function getCurrentUser() {
  const accessToken = (await cookies()).get('insforge_access_token')?.value
  if (!accessToken) return null

  const insforge = createInsForgeServerClient(accessToken)
  const { data, error } = await insforge.auth.getCurrentUser()
  if (error || !data?.user) return null

  return data.user
}
```

## OAuth in Next.js (Full Server-Side Flow)

The browser SDK auto-detects `insforge_code` and exchanges it automatically. That doesn't work in SSR because `sessionStorage` is unavailable and `detectAuthCallback()` skips in server mode. Handle the full flow server-side instead.

### Step 1: Initiate OAuth (Server Action)

```typescript
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createInsForgeServerClient } from '@/lib/insforge-server'

export async function initiateOAuth(provider: string) {
  const insforge = createInsForgeServerClient()

  const { data, error } = await insforge.auth.signInWithOAuth({
    provider,
    redirectTo: new URL('/api/auth/callback', process.env.NEXT_PUBLIC_APP_URL).toString(),
    skipBrowserRedirect: true
  })

  if (error || !data.url) throw new Error(error?.message ?? 'OAuth init failed')

  // Store PKCE verifier in httpOnly cookie (sessionStorage unavailable on server)
  const cookieStore = await cookies()
  cookieStore.set('insforge_code_verifier', data.codeVerifier!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600
  })

  redirect(data.url)
}
```

> **`redirectTo` must be your app URL** (`NEXT_PUBLIC_APP_URL`), not the InsForge backend URL (`NEXT_PUBLIC_INSFORGE_URL`). The backend appends `?insforge_code=<code>` and redirects here. If it points to the backend, you get `Cannot GET /auth/callback`.

### Step 2: Handle Callback (API Route)

```typescript
// app/api/auth/callback/route.ts
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createInsForgeServerClient } from '@/lib/insforge-server'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const code = params.get('insforge_code')
  const error = params.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL(`/login?error=${error ?? 'oauth_failed'}`, request.url))
  }

  const cookieStore = await cookies()
  const codeVerifier = cookieStore.get('insforge_code_verifier')?.value

  if (!codeVerifier) {
    return NextResponse.redirect(new URL('/login?error=missing_verifier', request.url))
  }

  const insforge = createInsForgeServerClient()
  const { data, error: exchangeError } = await insforge.auth.exchangeOAuthCode(code, codeVerifier)

  if (exchangeError || !data) {
    return NextResponse.redirect(new URL(`/login?error=${exchangeError?.message ?? 'exchange_failed'}`, request.url))
  }

  // Save tokens in httpOnly cookies
  cookieStore.set('insforge_access_token', data.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 15
  })
  if (data.refreshToken) {
    cookieStore.set('insforge_refresh_token', data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    })
  }

  // Clean up PKCE cookie
  cookieStore.delete('insforge_code_verifier')

  return NextResponse.redirect(new URL('/dashboard', request.url))
}
```

### Step 3: Login Page (Client Component)

```tsx
'use client'

import { initiateOAuth } from './actions'

export default function LoginPage() {
  return (
    <form action={() => initiateOAuth('google')}>
      <button type="submit">Sign in with Google</button>
    </form>
  )
}
```

### Refresh Best Practices

- Keep a dedicated refresh route or middleware that reads the refresh token cookie, calls `refreshSession({ refreshToken })`, and rewrites both cookies
- Validate post-auth redirects — only allow safe internal paths

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Using `NEXT_PUBLIC_INSFORGE_URL` as `redirectTo` | Use `NEXT_PUBLIC_APP_URL` — `redirectTo` is your app, not the backend |
| Expecting browser auto-detection in SSR | SDK skips `detectAuthCallback()` in server mode — exchange manually |
| Forgetting to store `codeVerifier` before redirect | Store in httpOnly cookie — `sessionStorage` is unavailable on the server |
| Creating SDK client in client components for auth flows | Use `isServerMode: true` in server actions and API routes |
| Storing tokens in client-readable storage | Keep `accessToken` and `refreshToken` in httpOnly cookies |
| Handling the OAuth code exchange in the browser | Exchange on the server, then set cookies on the response |
| Redirecting to arbitrary external URLs after sign-in | Validate redirects and only allow safe internal paths |
