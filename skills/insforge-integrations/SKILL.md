---
name: insforge-integrations
description: >-
  Use this skill when integrating a third-party provider with InsForge —
  either an auth provider (Clerk, Auth0, WorkOS, Kinde, Stytch) for JWT-based
  RLS, or a payment facilitator (OKX x402) for onchain pay-per-use billing.
  Covers provider-specific dashboard setup, client/server code, database
  policies, and common gotchas for each supported integration.
license: Apache-2.0
metadata:
  author: insforge
  version: "1.1.0"
  organization: InsForge
  date: April 2026
---

# InsForge Integrations

This skill covers integrating **third-party providers** with InsForge. Currently two categories are supported: **auth providers** (RLS via JWT claims) and **payment facilitators** (x402 HTTP payment protocol). Each provider has its own guide under this directory.

## Auth Providers

| Provider | Guide | When to use |
|----------|-------|-------------|
| [Clerk](references/clerk.md) | Clerk JWT Templates + InsForge RLS | Clerk signs tokens directly via JWT Template — no server-side signing needed |
| [Auth0](references/auth0.md) | Auth0 Actions + InsForge RLS | Auth0 uses a post-login Action to embed claims into the access token |
| [WorkOS](references/workos.md) | WorkOS AuthKit + InsForge RLS | WorkOS AuthKit middleware + server-side JWT signing with `jsonwebtoken` |
| [Kinde](references/kinde.md) | Kinde + InsForge RLS | Kinde token customization for InsForge integration |
| [Stytch](references/stytch.md) | Stytch + InsForge RLS | Stytch session tokens for InsForge integration |

## Payment Facilitators

| Provider | Guide | When to use |
|----------|-------|-------------|
| [OKX x402](references/okx-x402.md) | OKX as x402 facilitator (USDG on X Layer) | Pay-per-use HTTP endpoints settled onchain with zero gas for the payer |

## Common Patterns

### Auth providers
1. **Provider signs or issues a JWT** containing the user's ID
2. **JWT is passed to InsForge** via `edgeFunctionToken` in `createClient()`
3. **InsForge extracts claims** via `request.jwt.claims` in SQL
4. **RLS policies** use a `requesting_user_id()` function to enforce row-level security

### Payment facilitators (x402)
1. **Server returns `402 Payment Required`** with a JSON challenge base64-encoded in `PAYMENT-REQUIRED` header
2. **Client signs an EIP-3009 authorization** using the stablecoin's EIP-712 domain
3. **Server forwards the signed payload** to the facilitator's `/verify` + `/settle` endpoints
4. **Server records the settled payment** in an InsForge table with a realtime trigger for live dashboards

## Choosing a Provider

**Auth**
- **Clerk** — Simplest setup; JWT Template handles signing, no server code needed
- **Auth0** — Flexible; uses post-login Actions for claim injection
- **WorkOS** — Enterprise-focused; AuthKit middleware + server-side JWT signing
- **Kinde** — Developer-friendly; built-in token customization
- **Stytch** — API-first; session-based token flow

**Payment facilitators**
- **OKX x402** — Onchain pay-per-use via USDG on X Layer; zero gas for the payer

## Setup

1. Identify which provider the project uses
2. Read the corresponding reference guide from the tables above
3. Follow the provider-specific setup steps

## Usage Examples

Each provider guide includes full code examples for:
- Provider dashboard configuration (API keys, application settings, etc.)
- Server and client code (JWT utilities for auth; facilitator client + signing utilities for payments)
- Database setup (RLS for auth; payment table + realtime trigger for payments)
- Environment variable setup

Refer to the specific `references/<provider>.md` file for complete examples.

## Best Practices

**Auth**
- All auth provider user IDs are strings (not UUIDs) — always use `TEXT` columns for `user_id`
- Use `requesting_user_id()` instead of `auth.uid()` for RLS policies
- Set `edgeFunctionToken` as an async function (Clerk) or server-signed JWT (Auth0, WorkOS, Kinde, Stytch)
- Always get the JWT secret via `npx @insforge/cli secrets get JWT_SECRET`

**Payment facilitators (x402)**
- Always check the result of the database `insert(...)` after settlement — settlement takes money onchain before the insert runs; a silent DB failure loses the record
- Add `UNIQUE` to the `tx_hash` column to prevent duplicate records from retries
- Verify EIP-712 domain (`name`, `version`) against the token contract's on-chain `DOMAIN_SEPARATOR` — wrong values produce `Invalid Authority` errors
- Use a `MOCK_OKX_FACILITATOR` env flag for local dev so the full flow can be exercised without real funds

## Common Mistakes

**Auth**

| Mistake | Solution |
|---------|----------|
| Using `auth.uid()` for RLS | Use `requesting_user_id()` — third-party IDs are strings, not UUIDs |
| Using UUID columns for `user_id` | Use `TEXT` — all supported providers use string-format IDs |
| Hardcoding the JWT secret | Always retrieve via `npx @insforge/cli secrets get JWT_SECRET` |
| Missing `requesting_user_id()` function | Must be created before RLS policies will work |

**Payments (x402)**

| Mistake | Solution |
|---------|----------|
| Using an OKX exchange trading API key | Create a separate Web3 API key at `web3.okx.com/onchainos/dev-portal` |
| Wrong EIP-712 domain values | Read the token contract's `DOMAIN_SEPARATOR` — for USDG on X Layer use `name: "Global Dollar"`, `version: "1"` |
| Ignoring DB insert error after settlement | Always destructure `{ error }` and log/handle it — money has already moved |
| `MOCK_OKX_FACILITATOR=true` in production | Mock mode is demo-only; it returns fake tx hashes and bypasses verification |
