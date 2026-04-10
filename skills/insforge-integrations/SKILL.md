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
| [Clerk](clerk/SKILL.md) | Clerk JWT Templates + InsForge RLS | Clerk signs tokens directly via JWT Template — no server-side signing needed |
| [Auth0](auth0/SKILL.md) | Auth0 Actions + InsForge RLS | Auth0 uses a post-login Action to embed claims into the access token |
| [WorkOS](workos/SKILL.md) | WorkOS AuthKit + InsForge RLS | WorkOS AuthKit middleware + server-side JWT signing with `jsonwebtoken` |
| [Kinde](kinde/SKILL.md) | Kinde + InsForge RLS | Kinde token customization for InsForge integration |
| [Stytch](stytch/SKILL.md) | Stytch + InsForge RLS | Stytch session tokens for InsForge integration |

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

## Quick Start

Refer to the specific provider guide for detailed setup instructions. Each guide covers:

- Dashboard/provider configuration (manual steps)
- Package installation and environment variables
- Client utility setup
- Database schema and RLS policy creation
- Common mistakes and troubleshooting
