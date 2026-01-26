# Authentication SDK Integration

Use InsForge SDK to implement authentication flows in your frontend application.

## Setup

```javascript
import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: 'https://your-project.region.insforge.app',
  anonKey: 'your-anon-key'
})
```

## Sign Up

```javascript
const { data, error } = await insforge.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword123',
  name: 'John Doe'
})

if (data?.requireEmailVerification) {
  // Redirect to verify email page
} else if (data?.accessToken) {
  // User signed in
}
```

## Sign In

```javascript
const { data, error } = await insforge.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securepassword123'
})

if (data) {
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

```javascript
// Resend verification email
await insforge.auth.resendVerificationEmail({ email: 'user@example.com' })

// Verify with code
const { data } = await insforge.auth.verifyEmail({
  email: 'user@example.com',
  otp: '123456'
})
```

## Password Reset

```javascript
// Send reset email
await insforge.auth.sendResetPasswordEmail({ email: 'user@example.com' })

// Code method: exchange code for token
const { data } = await insforge.auth.exchangeResetPasswordToken({
  email: 'user@example.com',
  code: '123456'
})

// Reset password
await insforge.auth.resetPassword({
  newPassword: 'newPassword123',
  otp: data.token // or token from magic link
})
```

## Important Notes

- **Web vs Mobile**: Web uses httpOnly cookies + CSRF; mobile/desktop returns refreshToken in response
- All methods return `{ data, error }` - always check for errors
- OAuth uses PKCE flow for security

---

## Best Practices

1. **Always check auth config first** before implementing
   - Call `GET /api/auth/public-config` (see [backend-configuration.md](backend-configuration.md))
   - This tells you what features to implement

2. **Implement email verification if required**
   - Check `requireEmailVerification` in config
   - If `verifyEmailMethod` is `"code"`: build a 6-digit code input form
   - If `verifyEmailMethod` is `"link"`: handle magic link redirect

3. **Only implement OAuth for configured providers**
   - Check `oAuthProviders` array in config
   - The array contains only enabled provider names (e.g., `["google", "github"]`)

4. **Handle the sign-up response correctly**
   ```javascript
   const { data, error } = await insforge.auth.signUp({...})

   if (error) {
     // Handle error
   } else if (data?.requireEmailVerification) {
     // Redirect to verification page
   } else if (data?.accessToken) {
     // User is signed in, redirect to app
   }
   ```

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| ❌ Implementing OAuth without checking config | ✅ Only show buttons for providers in `oAuthProviders` array |
| ❌ Skipping email verification flow | ✅ Check `requireEmailVerification` and implement if true |
| ❌ Building link-based UI when code is configured | ✅ Check `verifyEmailMethod` to build correct UI |
| ❌ Ignoring `requireEmailVerification` response | ✅ Always check and redirect to verification |
| ❌ Hardcoding OAuth providers | ✅ Dynamically show based on `oAuthProviders` array |

## Conditional Implementation Guide

### Email Verification Flow

```javascript
// After sign-up, check if verification is needed
if (data?.requireEmailVerification) {
  // Check config for verification method
  // If verifyEmailMethod === "code":
  //   Show code input form, then call:
  await insforge.auth.verifyEmail({ email, otp: userEnteredCode })

  // If verifyEmailMethod === "link":
  //   Show "check your email" message
  //   User clicks link, handle redirect with token
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
1. Get auth config           → GET /api/auth/public-config
2. Check what's enabled      → Email verification? Which OAuth providers?
3. Build appropriate UI      → Code input vs magic link, OAuth buttons
4. Implement sign-up         → Handle requireEmailVerification response
5. Implement verification    → Based on verifyEmailMethod (code vs link)
6. Implement OAuth           → Only for providers in oAuthProviders array
7. Implement password reset  → Based on resetPasswordMethod (code vs link)
```

## Implementation Checklist

Based on auth config, implement:

- [ ] Sign up form with password (respecting `passwordMinLength`)
- [ ] Sign in form
- [ ] Email verification flow (if `requireEmailVerification` is true)
  - [ ] Code input (if `verifyEmailMethod` is "code")
  - [ ] Magic link handling (if `verifyEmailMethod` is "link")
- [ ] OAuth buttons (only for enabled providers)
- [ ] Password reset flow
  - [ ] Code input (if `resetPasswordMethod` is "code")
  - [ ] Magic link handling (if `resetPasswordMethod` is "link")
- [ ] Sign out
