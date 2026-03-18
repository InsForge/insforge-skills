# Authentication SDK Integration

User authentication, registration, and session management via `insforge.auth`.

> **⚠️ Deprecated Packages**: The packages `@insforge/react`, `@insforge/nextjs`, and `@insforge/react-router` are **deprecated** and should NOT be used. Use `@insforge/sdk` directly for all authentication flows. Build your own auth UI components using the SDK methods documented below.

## Setup

```javascript
import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: 'https://your-project.region.insforge.app',
  anonKey: 'your-anon-key'
})
```

## SSR / Server-Rendered Apps

For Next.js, Remix, SvelteKit, Nuxt server routes, or any other SSR setup, use server mode and server-managed cookies. See [ssr-integration.md](ssr-integration.md) for the full pattern and minimal examples.

## Sign Up (Complete Flow)

Registration requires email verification. Complete flow:

1. **Sign up** — Create the user account
2. **Verification email sent** — User receives a 6-digit OTP code
3. **Verify OTP** — User enters the code on the same page, `verifyEmail()` verifies and automatically signs the user in

> **Important**: The sign-up page **must** include a verification code input step. After calling `signUp()`, if `requireEmailVerification` is true, show a 6-digit code input on the **same page** — do NOT navigate to the dashboard or any other page. After `verifyEmail()` succeeds, the session is automatically saved and the user is signed in — no separate `signInWithPassword()` call is needed.

```javascript
try {
  // Step 1: Register the user
  const { data, error } = await insforge.auth.signUp({
    email: 'user@example.com',
    password: 'securepassword123',
    name: 'John Doe'
  })

  if (error) throw error

  if (data?.requireEmailVerification) {
    // Step 2: User receives email with 6-digit OTP code
    // IMPORTANT: Show a code input form on the SAME page.
    // Do NOT navigate away.

    // Step 3: After user enters the code, verify it
    const { data: verifyData, error: verifyError } = await insforge.auth.verifyEmail({
      email: 'user@example.com',
      otp: '123456' // code entered by user
    })

    if (verifyError) throw verifyError

    // User is now verified AND signed in — verifyEmail() auto-saves the session.
    // Navigate to the app.
    console.log('Verified and signed in:', verifyData.user)

  } else if (data?.accessToken) {
    // No verification required — user is already signed in
    console.log('Signed in:', data.user)
  }

} catch (error) {
  console.error('Registration flow failed:', error.message)
}
```

### Resend Verification Code

```javascript
try {
  await insforge.auth.resendVerificationEmail({ email: 'user@example.com' })
  console.log('Verification code resent.')
} catch (error) {
  console.error('Failed to resend:', error.message)
}
```

## Sign In

```javascript
const { data, error } = await insforge.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securepassword123'
})

if (error) {
  console.error('Sign in failed:', error.message)
  if (error.statusCode === 403) {
    console.error('Email not verified. Redirect to verification page.')
  }
} else {
  console.log('Signed in:', data.user.email)
}
```

## OAuth Sign In

```javascript
// Auto-redirect to provider
await insforge.auth.signInWithOAuth({
  provider: 'google', // google, github, discord, microsoft, etc.
  redirectTo: 'http://localhost:3000/dashboard'
})

// Get URL without redirect
const { data } = await insforge.auth.signInWithOAuth({
  provider: 'google',
  skipBrowserRedirect: true
})
window.location.href = data.url
```

## Sign Out

```javascript
const { error } = await insforge.auth.signOut()
```

## Get Current Session

```javascript
const { data, error } = await insforge.auth.getCurrentSession()

if (data.session) {
  console.log('User:', data.session.user.email)
  console.log('Token:', data.session.accessToken)
}
```

## Profile Management

```javascript
// Get any user's public profile
const { data } = await insforge.auth.getProfile('user-id')

// Update current user's profile
const { data } = await insforge.auth.setProfile({
  name: 'John',
  avatar_url: 'https://...',
  custom_field: 'value'
})
```

## Email Verification

`verifyEmail()` returns `{ data: { user, accessToken }, error }` and **automatically saves the session** — the user is signed in after successful verification.

```javascript
// Verify with code (6-digit OTP from email)
const { data, error } = await insforge.auth.verifyEmail({
  email: 'user@example.com',
  otp: '123456'
})

if (error) {
  if (error.statusCode === 400) {
    console.error('Invalid or expired code')
  }
} else {
  // User is now verified AND signed in
  console.log('Signed in:', data.user)
}

// Resend verification email
await insforge.auth.resendVerificationEmail({ email: 'user@example.com' })
```

## Password Reset

```javascript
// Step 1: Send reset email
await insforge.auth.sendResetPasswordEmail({ email: 'user@example.com' })

// Step 2: Code method — exchange code for token
const { data } = await insforge.auth.exchangeResetPasswordToken({
  email: 'user@example.com',
  code: '123456'
})

// Step 3: Reset password
await insforge.auth.resetPassword({
  newPassword: 'newPassword123',
  otp: data.token // or token from magic link
})
```

## Important Notes

- **Web vs Mobile**: Web uses httpOnly cookies + CSRF; mobile/desktop returns refreshToken in response
- **SSR apps should use server mode**: For Next.js and similar SSR frameworks, create the SDK client on the server with `isServerMode: true` and manage cookies yourself. See [ssr-integration.md](ssr-integration.md)
- All methods return `{ data, error }` — always check for errors
- OAuth uses PKCE flow for security

---

## Best Practices

1. **Always check auth config first** before implementing
   - Run `insforge metadata --json` to get auth config, or see [backend-configuration.md](backend-configuration.md)
   - This tells you what features to implement

2. **The sign-up page must handle the full registration flow**
   - After calling `signUp()`, if `requireEmailVerification` is true, switch the UI to show a 6-digit code input on the **same page**
   - Do NOT navigate to the dashboard, home page, or any other page
   - The user enters the OTP code from their email, then call `verifyEmail()`
   - `verifyEmail()` automatically saves the session — the user is signed in after verification
   - Only after successful verification should you navigate to the app

3. **Only implement OAuth for configured providers**
   - Check `oAuthProviders` array in config
   - The array contains only enabled provider names (e.g., `["google", "github"]`)

4. **Handle the sign-up response correctly**
   ```javascript
   const { data, error } = await insforge.auth.signUp({...})

   if (error) {
     // Show error message to user
   } else if (data?.requireEmailVerification) {
     // Switch UI to show 6-digit code input — do NOT navigate away
   } else if (data?.accessToken) {
     // No verification needed — user is signed in, navigate to app
   }
   ```

5. **Use server mode for SSR auth**
   - For Next.js or other SSR frameworks, perform auth mutations on the server
   - Keep tokens in httpOnly cookies instead of exposing them to client components
   - Pass the access token into `createClient({ edgeFunctionToken })` for authenticated server-side requests
   - Use [ssr-integration.md](ssr-integration.md) as the reference implementation

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Navigating to dashboard/home after sign-up when verification is required | Stay on the sign-up page and show a 6-digit code input for OTP verification |
| Skipping email verification flow entirely | Check `requireEmailVerification` in sign-up response and implement the verification step |
| Building link-based UI when code is configured | Check `verifyEmailMethod` to build correct UI |
| Calling `signInWithPassword` after `verifyEmail` | `verifyEmail()` auto-saves the session — no separate sign-in call needed |
| Implementing OAuth without checking config | Only show buttons for providers in `oAuthProviders` array |
| Hardcoding OAuth providers | Dynamically show based on `oAuthProviders` array |
| Using the browser SDK pattern inside SSR auth routes | In SSR frameworks, create a server-mode client and manage httpOnly cookies on the server |

## Conditional Implementation Guide

### Email Verification Flow

```javascript
// After sign-up, check if verification is needed
if (data?.requireEmailVerification) {
  // If verifyEmailMethod === "code" (default):
  //   Show 6-digit code input on the SAME page, then call:
  const { data: verifyData, error } = await insforge.auth.verifyEmail({ email, otp: userEnteredCode })
  //   On success, user is automatically signed in — navigate to the app

  // If verifyEmailMethod === "link":
  //   Show "Check your email and click the verification link" message
  //   User clicks link in email, which redirects back to your app with a token
}
```

### OAuth Implementation

```javascript
// oAuthProviders is already an array of enabled provider names
// e.g., ["google", "github"]
const enabledProviders = authConfig.oAuthProviders

// Show OAuth buttons only for enabled providers:
if (enabledProviders.includes('google')) {
  // Show Google login button
}
if (enabledProviders.includes('github')) {
  // Show GitHub login button
}
```

## Recommended Workflow

```
1. Get auth config           → See backend-configuration.md
2. Check what's enabled      → Email verification? Which OAuth providers?
3. Build appropriate UI      → Code input vs magic link, OAuth buttons
4. Implement sign-up         → Handle requireEmailVerification response
5. Implement verification    → Show code input on same page, call verifyEmail()
6. Implement OAuth           → Only for providers in oAuthProviders array
7. Implement password reset  → Based on resetPasswordMethod (code vs link)
```

## Implementation Checklist

Based on auth config, implement:

- [ ] Sign up form with password (respecting `passwordMinLength`)
- [ ] Email verification step on the sign-up page (if `requireEmailVerification` is true)
  - [ ] 6-digit code input (if `verifyEmailMethod` is "code")
  - [ ] "Check your email" message (if `verifyEmailMethod` is "link")
- [ ] Sign in form
- [ ] OAuth buttons (only for enabled providers)
- [ ] Password reset flow
  - [ ] Code input (if `resetPasswordMethod` is "code")
  - [ ] Magic link handling (if `resetPasswordMethod` is "link")
- [ ] Sign out
