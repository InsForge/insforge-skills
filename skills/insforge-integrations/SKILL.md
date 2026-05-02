---
name: insforge-integrations
description: >-
  Use this skill when integrating a third-party provider with InsForge —
  an auth provider (Clerk, Auth0, WorkOS, Kinde, Stytch) for JWT-based RLS,
  a payment facilitator (OKX x402) for onchain pay-per-use billing, or an
  analytics provider (PostHog) for product analytics, session replay, and
  feature flags. Covers provider-specific setup, client/server code, database
  policies, and common gotchas for each supported integration.
license: Apache-2.0
metadata:
  author: insforge
  version: "1.1.0"
  organization: InsForge
  date: April 2026
---

# InsForge Integrations

This skill covers integrating **third-party providers** with InsForge. Three categories are supported: **auth providers** (RLS via JWT claims), **payment facilitators** (x402 HTTP payment protocol), and **analytics providers** (one-click OAuth into the InsForge dashboard). Each provider has its own guide under this directory.

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

## Analytics Providers

| Provider | Guide | When to use |
|----------|-------|-------------|
| [PostHog](references/posthog.md) | One-click OAuth + `insforge posthog setup` CLI | Product analytics, session replay, feature flags, web analytics surfaced in the InsForge dashboard. **Currently in private beta** — see the guide for known limitations. |

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

### Analytics providers
1. **One CLI command provisions credentials**: `npx @insforge/cli posthog setup` connects the project to PostHog (creates a PostHog account if needed) and installs the SDK in one go
2. **InsForge stores read credentials encrypted server-side**, exposing only the public `phc_` key to client code
3. **The InsForge dashboard renders analytics** (KPIs, retention, replays) by reading PostHog through cloud-backend
4. **Your app sends events directly to PostHog** using `phc_` — InsForge never proxies ingestion traffic

## Choosing a Provider

**Auth**
- **Clerk** — Simplest setup; JWT Template handles signing, no server code needed
- **Auth0** — Flexible; uses post-login Actions for claim injection
- **WorkOS** — Enterprise-focused; AuthKit middleware + server-side JWT signing
- **Kinde** — Developer-friendly; built-in token customization
- **Stytch** — API-first; session-based token flow

**Payment facilitators**
- **OKX x402** — Onchain pay-per-use via USDG on X Layer; zero gas for the payer

**Analytics providers**
- **PostHog** — Product analytics, session replay, feature flags. One-click OAuth via `npx @insforge/cli posthog setup` (provisions a PostHog account if needed, installs the SDK, surfaces analytics in the InsForge dashboard). Currently in private beta.

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

**Analytics providers**
- Run the CLI from inside the app directory so the wizard step writes the SDK init code into the right project (`insforge posthog setup` reads `.insforge/project.json` from the current directory)
- Only the `phc_` (project API key) ever goes into client code — `phx_` (personal API key) and OAuth tokens stay encrypted on the InsForge cloud-backend
- One PostHog project per InsForge project on the Free plan; if reusing one PostHog project across multiple InsForge projects, set `insforge_project_id` as a `posthog.identify` super-property to disambiguate

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

**Analytics (PostHog)**

| Mistake | Solution |
|---------|----------|
| Embedding `phx_` (personal API key) in client code | Only `phc_` (project API key) is safe in client code. `phx_` is server-only and InsForge keeps it encrypted |
| Running `insforge posthog setup` outside the app directory | The CLI reads `.insforge/project.json` from cwd — run it inside the linked app project, not at the workspace root |
| InsForge Analytics dashboard shows zero events even after install | Verify the `phc_` value in your app's `.env` matches the one shown on InsForge → Analytics → API Key card. Mismatched keys mean events go to a different PostHog project |
| `posthog.init` called outside `typeof window !== 'undefined'` guard in Next.js | Wrap in the guard — `posthog-js` is browser-only |
