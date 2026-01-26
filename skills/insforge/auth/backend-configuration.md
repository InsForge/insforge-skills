# Authentication Admin Configuration

HTTP endpoints to configure auth settings and manage users. Requires admin authentication.

## Authentication

All admin endpoints require:
```
Authorization: Bearer {admin-token-or-api-key}
```

## Get Public Auth Configuration

Check current auth settings and enabled OAuth providers before implementing authentication flows. This is a **public endpoint** (no auth required).

```
GET /api/auth/public-config
```

Response example:
```json
{
  "requireEmailVerification": true,
  "passwordMinLength": 8,
  "verifyEmailMethod": "code",
  "resetPasswordMethod": "link",
  "oAuthProviders": ["google", "github"]
}
```

### Key Configuration Fields

| Field | Description |
|-------|-------------|
| `requireEmailVerification` | If `true`, users must verify email before accessing the app |
| `verifyEmailMethod` | `"code"` = user enters 6-digit code; `"link"` = user clicks magic link |
| `resetPasswordMethod` | `"code"` = user enters code; `"link"` = user clicks reset link |
| `oAuthProviders` | Array of enabled OAuth provider names (only enabled providers are listed) |

## Update Auth Configuration

```
PUT /api/auth/config
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "requireEmailVerification": true,
  "passwordMinLength": 10,
  "verifyEmailMethod": "code",
  "resetPasswordMethod": "link"
}
```

### Configuration Options

| Option | Values | Description |
|--------|--------|-------------|
| `requireEmailVerification` | `true/false` | Require email verification before login |
| `passwordMinLength` | number | Minimum password length |
| `verifyEmailMethod` | `"code"`, `"link"` | Email verification method |
| `resetPasswordMethod` | `"code"`, `"link"` | Password reset method |

## List Users

```
GET /api/auth/users?offset=0&limit=10&search=john
Authorization: Bearer {admin-token}
```

Query parameters:
- `offset`: Pagination offset
- `limit`: Number of results
- `search`: Search by name or email

## Delete Users

```
DELETE /api/auth/users
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "userIds": ["user-id-1", "user-id-2"]
}
```

## Generate Anonymous Token

Generate a public anonymous token for unauthenticated API access.

```
POST /api/auth/tokens/anon
Authorization: Bearer {admin-token}
```

Response:
```json
{
  "anonKey": "eyJhbGciOiJIUzI1NiIs..."
}
```

## Quick Reference

| Task | Endpoint |
|------|----------|
| Get public auth config (includes OAuth) | `GET /api/auth/public-config` |
| Update auth settings (admin) | `PUT /api/auth/config` |
| List users (admin) | `GET /api/auth/users` |
| Delete users (admin) | `DELETE /api/auth/users` |
| Generate anon token (admin) | `POST /api/auth/tokens/anon` |

---

## Best Practices

1. **Always check auth config first** before implementing authentication
   - Call `GET /api/auth/public-config` to understand the current settings
   - This determines which flows you need to implement

2. **Check OAuth providers** before adding social login buttons
   - Only show OAuth buttons for providers listed in `oAuthProviders` array
   - If a provider is not in the array, it's not configured

3. **Understand verification methods** before building UI
   - `"code"` method requires a code input form
   - `"link"` method requires handling magic link redirects

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Implementing OAuth without checking if provider is enabled | Check `oAuthProviders` array - only listed providers are enabled |
| Building wrong verification UI | Check `verifyEmailMethod` - code vs link |
| Skipping email verification flow | Check `requireEmailVerification` flag |
| Assuming all OAuth providers are available | Only providers in `oAuthProviders` array are configured |

## Recommended Workflow

```
1. Get auth config           → GET /api/auth/public-config
2. Check requirements        → Note: requireEmailVerification, verifyEmailMethod
3. Check OAuth providers     → Note: oAuthProviders array contains enabled providers
4. Plan UI accordingly       → Build forms based on actual config
5. Implement SDK integration → See auth/sdk-integration.md
```

## Configuration Checklist

Before implementing auth, verify these from `GET /api/auth/public-config`:

- [ ] Is email verification required? (`requireEmailVerification`)
- [ ] What verification method? (`verifyEmailMethod`: code or link)
- [ ] What password reset method? (`resetPasswordMethod`: code or link)
- [ ] Which OAuth providers are enabled? (`oAuthProviders` array)
