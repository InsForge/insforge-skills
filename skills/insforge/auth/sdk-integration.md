# Authentication SDK Integration

User authentication, registration, and session management via `insforge.auth`.

> **⚠️ Deprecated Packages**: The packages `@insforge/react`, `@insforge/nextjs`, and `@insforge/react-router` are **deprecated** and should NOT be used. Use `@insforge/sdk` directly for all authentication flows. Build your own auth UI components using the SDK methods documented below.

## Setup

First, ensure your `.env` file is configured with your InsForge URL and anon key (see the main [SKILL.md](../SKILL.md) for framework-specific variable names and how to get your anon key).

```javascript
import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,       // adjust prefix for your framework
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY   // adjust prefix for your framework
})
```

## SSR / Server-Rendered Apps

For Next.js, Remix, SvelteKit, Nuxt server routes, or any other SSR setup, use server mode and server-managed cookies. See [ssr-integration.md](ssr-integration.md) for the full pattern and minimal examples.

## Sign Up (Complete Flow)

Registration may require email verification. Implement the flow based on backend config.

1. **Sign up** — Create the user account
2. **If verification is required** — Branch on `verifyEmailMethod`
3. **Complete the verification flow**
   - `code`: user enters the 6-digit code and your app calls `verifyEmail()`
   - `link`: backend verifies the emailed link first, then redirects to your app via `redirectTo`

> **Important**: For link-based verification, pass `redirectTo` to `signUp()`. Recommended: use your sign-in page as `redirectTo`, then show a success message and ask the user to sign in with their email and password.

```javascript
try {
  // Step 1: Register the user
  const { data, error } = await insforge.auth.signUp({
    email: 'user@example.com',
    password: 'securepassword123',
    name: 'John Doe',
    redirectTo: 'http://localhost:3000/sign-in'
  })

  if (error) throw error

  if (data?.requireEmailVerification) {
    // Code method:
    // - Show a 6-digit code input on the same page
    // - Call verifyEmail({ email, otp })
    //
    // Link method:
    // - Show "Check your email"
    // - Recommended redirectTo: your sign-in page
    // - On redirect success, show a confirmation message and ask the user to sign in

  } else if (data?.accessToken) {
    // No verification required — user is already signed in
    console.log('Signed in:', data.user)
  }

} catch (error) {
  console.error('Registration flow failed:', error.message)
}
```

### Resend Verification Email

```javascript
try {
  await insforge.auth.resendVerificationEmail({
    email: 'user@example.com',
    redirectTo: 'http://localhost:3000/sign-in'
  })
  console.log('Verification email resent.')
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

## Get Current User

```javascript
const { data, error } = await insforge.auth.getCurrentUser()

if (data.user) {
  console.log('User:', data.user.email)
}
```

For browser apps, call `getCurrentUser()` during startup. The SDK will use the httpOnly refresh cookie automatically when it can refresh the session.

For `isServerMode: true`, call `refreshSession({ refreshToken })` explicitly when you need to refresh an expired access token.

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
await insforge.auth.resendVerificationEmail({
  email: 'user@example.com',
  redirectTo: 'http://localhost:3000/sign-in'
})
```

### Link Verification Flow

Use `redirectTo` for link-based verification. Recommended: use your sign-in page.

Your frontend should handle these redirect query params:

- `insforge_status`: `success` or `error`
- `insforge_type`: always `verify_email`
- `insforge_error`: present only on error

When `insforge_status=success`, show a confirmation message and ask the user to sign in with their email and password.

## Password Reset

```javascript
// Step 1: Send reset email
await insforge.auth.sendResetPasswordEmail({
  email: 'user@example.com',
  redirectTo: 'http://localhost:3000/reset-password'
})

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

### Link Reset Flow

Use `redirectTo` for link-based reset. Recommended: use your app's dedicated reset-password page.

Your frontend should handle these redirect query params:

- `token`: present only when the reset form should be shown
- `insforge_status`: `ready` or `error`
- `insforge_type`: always `reset_password`
- `insforge_error`: present only on error

Only render the reset form when `insforge_status=ready` and `token` is present.

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
   - After calling `signUp()`, if `requireEmailVerification` is true, branch on `verifyEmailMethod`
   - For `"code"`, switch the UI to show a 6-digit code input on the **same page**
   - For `"link"`, pass `redirectTo` to `signUp()` and show a "check your email" state
   - Do NOT navigate to the app until verification is completed
   - Recommended verification `redirectTo`: your sign-in page
   - `verifyEmail()` automatically saves the session only for the code flow

3. **Only implement OAuth for configured providers**
   - Check `oAuthProviders` array in config
   - The array contains only enabled provider names (e.g., `["google", "github"]`)

4. **Handle the sign-up response correctly**
   ```javascript
   const { data, error } = await insforge.auth.signUp({...})

   if (error) {
     // Show error message to user
   } else if (data?.requireEmailVerification) {
     // Usually: switch UI to show 6-digit code input — do NOT navigate away
     // If verifyEmailMethod === "link", show a "check your email" state instead
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
| Navigating to dashboard/home after sign-up when verification is required | Stay in the verification flow and branch on `verifyEmailMethod` instead of navigating to the app |
| Skipping email verification flow entirely | Check `requireEmailVerification` in sign-up response and implement the verification step |
| Forgetting `redirectTo` for link flows | When the backend config uses `"link"`, pass the app URL in the request and make sure it is in `allowedRedirectUrls` |
| Building link-based UI when code is configured | Check `verifyEmailMethod` to build the correct UI |
| Treating link verification like code verification | For link verification, handle the redirect result and send the user to sign in instead of calling `verifyEmail()` with a token |
| Calling `signInWithPassword` after code-based `verifyEmail` | `verifyEmail()` auto-saves the session for the code flow — no separate sign-in call needed |
| Implementing OAuth without checking config | Only show buttons for providers in `oAuthProviders` array |
| Hardcoding OAuth providers | Dynamically show based on `oAuthProviders` array |
| Using the browser SDK pattern inside SSR auth routes | In SSR frameworks, create a server-mode client and manage httpOnly cookies on the server |

## Conditional Implementation Guide

### Email Verification Flow

```javascript
// After sign-up, check if verification is needed
if (data?.requireEmailVerification) {
  // If verifyEmailMethod === "code":
  //   Show 6-digit code input on the SAME page, then call:
  const { data: verifyData, error } = await insforge.auth.verifyEmail({ email, otp: userEnteredCode })
  //   On success, user is automatically signed in — navigate to the app

  // If verifyEmailMethod === "link":
  //   Pass redirectTo to signUp() / resendVerificationEmail()
  //   Show "Check your email and click the verification link" message
  //   Recommended redirectTo: your sign-in page
  //   On redirect success, show a confirmation message and ask the user to sign in
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
5. Implement verification    → Code input or redirectTo-based link flow
6. Implement OAuth           → Only for providers in oAuthProviders array
7. Implement password reset  → Based on resetPasswordMethod (code vs link)
```

## Implementation Checklist

Based on auth config, implement:

- [ ] Sign up form with password (respecting `passwordMinLength`)
- [ ] Email verification step on the sign-up page (if `requireEmailVerification` is true)
  - [ ] 6-digit code input (if `verifyEmailMethod` is "code")
  - [ ] "Check your email" state plus sign-in-page `redirectTo` handling (if `verifyEmailMethod` is "link")
- [ ] Sign in form
- [ ] OAuth buttons (only for enabled providers)
- [ ] Password reset flow
  - [ ] Code input (if `resetPasswordMethod` is "code")
  - [ ] App reset page using `redirectTo` (if `resetPasswordMethod` is "link")
- [ ] Sign out
