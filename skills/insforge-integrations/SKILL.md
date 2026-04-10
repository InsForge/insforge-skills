---
name: insforge-integrations
description: >-
  Use this skill when integrating a third-party auth provider (Clerk, Auth0,
  WorkOS, Kinde, Stytch) with InsForge for authentication and RLS. Covers JWT
  configuration, client setup, database RLS policies, and provider-specific
  gotchas for each supported integration.
license: Apache-2.0
metadata:
  author: insforge
  version: "1.0.0"
  organization: InsForge
  date: April 2026
---

# InsForge Integrations

This skill covers integrating **third-party authentication providers** with InsForge. Each provider has its own guide under this directory.

## Supported Providers

| Provider | Guide | When to use |
|----------|-------|-------------|
| [Clerk](references/clerk.md) | Clerk JWT Templates + InsForge RLS | Clerk signs tokens directly via JWT Template — no server-side signing needed |
| [Auth0](references/auth0.md) | Auth0 Actions + InsForge RLS | Auth0 uses a post-login Action to embed claims into the access token |
| [WorkOS](references/workos.md) | WorkOS AuthKit + InsForge RLS | WorkOS AuthKit middleware + server-side JWT signing with `jsonwebtoken` |
| [Kinde](references/kinde.md) | Kinde + InsForge RLS | Kinde token customization for InsForge integration |
| [Stytch](references/stytch.md) | Stytch + InsForge RLS | Stytch session tokens for InsForge integration |

## Common Pattern

All integrations follow the same core pattern:

1. **Auth provider signs or issues a JWT** containing the user's ID
2. **JWT is passed to InsForge** via `edgeFunctionToken` in `createClient()`
3. **InsForge extracts claims** via `request.jwt.claims` in SQL
4. **RLS policies** use a `requesting_user_id()` function to enforce row-level security

## Choosing a Provider

- **Clerk** — Simplest setup; JWT Template handles signing, no server code needed
- **Auth0** — Flexible; uses post-login Actions for claim injection
- **WorkOS** — Enterprise-focused; AuthKit middleware + server-side JWT signing
- **Kinde** — Developer-friendly; built-in token customization
- **Stytch** — API-first; session-based token flow

## Setup

1. Identify which auth provider the project uses
2. Read the corresponding reference guide from the table above
3. Follow the provider-specific setup steps

## Usage Examples

Each provider guide includes full code examples for:
- Auth provider dashboard configuration
- InsForge client utility with `edgeFunctionToken`
- `requesting_user_id()` SQL function and RLS policies
- Environment variable setup

Refer to the specific `references/<provider>.md` file for complete examples.

## Best Practices

- All provider user IDs are strings (not UUIDs) — always use `TEXT` columns for `user_id`
- Use `requesting_user_id()` instead of `auth.uid()` for RLS policies
- Set `edgeFunctionToken` as an async function (Clerk) or server-signed JWT (Auth0, WorkOS, Kinde, Stytch)
- Always get the JWT secret via `npx @insforge/cli secrets get JWT_SECRET`

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Using `auth.uid()` for RLS | Use `requesting_user_id()` — third-party IDs are strings, not UUIDs |
| Using UUID columns for `user_id` | Use `TEXT` — all supported providers use string-format IDs |
| Hardcoding the JWT secret | Always retrieve via `npx @insforge/cli secrets get JWT_SECRET` |
| Missing `requesting_user_id()` function | Must be created before RLS policies will work |
