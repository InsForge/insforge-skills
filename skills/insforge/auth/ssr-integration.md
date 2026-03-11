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

## OAuth Callback / Refresh Best Practices

- Save the PKCE code verifier in an httpOnly cookie before redirecting to the provider
- In the OAuth callback route, exchange the code on the server, then set auth cookies on the response
- Keep a dedicated refresh route or middleware path that reads the refresh token cookie, calls `refreshSession`, and rewrites both cookies
- Validate post-auth redirects and only allow safe internal paths

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Creating the SDK client in client components for SSR auth flows | Create the client in server actions, route handlers, loaders, or API routes with `isServerMode: true` |
| Storing tokens in client-readable storage | Keep `accessToken` and `refreshToken` in httpOnly cookies |
| Calling authenticated server-side APIs without the current access token | Pass the token with `createClient({ edgeFunctionToken: accessToken })` |
| Handling the OAuth code exchange in the browser | Exchange the OAuth code on the server, then set cookies on the response |
| Redirecting to arbitrary external URLs after sign-in or refresh | Validate redirects and only allow safe internal paths |
