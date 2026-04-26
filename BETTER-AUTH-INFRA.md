# Better Auth — Infrastructure Research

This is research about Better Auth itself (separate from the InsForge integration). Compiled to back the integration guide with a clear picture of what we're integrating with.

## What it is, plainly

> "A framework-agnostic, universal authentication and authorization framework for TypeScript."

Concretely:

| Property | Value |
|---|---|
| Language | TypeScript |
| Distribution | npm package (`better-auth`) — **library, not a service** |
| Mounting | Wrapper helpers per framework: `toNextJsHandler`, `toNodeHandler`, `svelteKitHandler`, `toExpressHandler`, etc. |
| Default route | `/api/auth/*` (catch-all, single mount point) |
| Repo | [github.com/better-auth/better-auth](https://github.com/better-auth/better-auth) |
| License | MIT |
| Stars | ~28k at time of writing |
| Latest version | 1.6.x (releases dated 2026-04-24) |
| Maturity | Active; ~922 releases shipped |

Slogan-style summary from the docs: **"Your auth lives in your codebase."** Everything runs in-process inside your existing app server. There is no Better Auth server to deploy, no SaaS dashboard, no separate process.

## Runtimes

Officially supported:

- **Node.js** (default, primary target)
- **Bun**
- **Cloudflare Workers** — with `nodejs_compat` flag

Not listed in installation docs:

- Deno (works in practice for some configurations, not officially supported)
- Vercel Edge runtime (caveat: depends on database adapter — `pg` doesn't work on Edge; HTTP-protocol DB adapters do)

For InsForge users this means: **anywhere you already run Next.js / Remix / Express / SvelteKit / Hono / Bun / Workers, Better Auth runs.** It's not exotic infra.

## Database support

Native adapters built into the package:

- **SQLite** via `better-sqlite3`
- **PostgreSQL** via `pg` *(this is what we use against InsForge)*
- **MySQL** via `mysql2/promise`
- **MongoDB** via `mongodbAdapter`

Plus ORM adapters:

- **Drizzle**
- **Prisma**
- **Kysely** *(the built-in one)*

Schema-evolution commands:

| Command | Behavior |
|---|---|
| `npx @better-auth/cli migrate` | Applies schema changes directly to the DB. **Only works with the built-in Kysely adapter** (which is what `pg` falls under). What we used. |
| `npx @better-auth/cli generate` | Generates schema files for your ORM (Prisma `schema.prisma`, Drizzle TS schema, or raw SQL for Kysely). For users who run their own migrations. |

The integration we wrote uses `migrate` because we're using `pg` directly. A user who prefers managing migrations through InsForge's CLI would use `generate` and feed the resulting SQL through `npx @insforge/cli db migrations new ...`.

## Default schema

Four tables, identical to what we observed against InsForge:

| Table | Purpose | Key columns |
|---|---|---|
| `user` | identity | `id` (text), `email` (unique), `emailVerified`, `name`, `image` |
| `session` | per-device sessions | `id`, `userId` FK, `token` (cookie value), `expiresAt`, `ipAddress`, `userAgent` |
| `account` | provider accounts (incl. `credential` for password) | `id`, `userId` FK, `providerId`, `accountId`, `password` (hashed) for credential, `accessToken`/`refreshToken` for OAuth |
| `verification` | email tokens, OTPs, magic links | `identifier`, `value`, `expiresAt` |

`id` is **always a base62 string** from Better Auth's `generateId()` — never a UUID. This is what lets the InsForge convention of `TEXT user_id` work directly without a mapping table. (On Supabase, `auth.users.id` is `uuid` and would force a translation.)

## Session model

> "Better Auth manages session using a traditional cookie-based session management. The session is stored in a cookie and is sent to the server on every request."

Mechanics:

| Aspect | Detail |
|---|---|
| Source of truth | A row in the `session` table |
| Cookie | `better-auth.session_token` — HttpOnly, `SameSite=Lax` by default, 7-day `Max-Age` |
| Default lifetime | 7 days, sliding |
| Sliding refresh | "whenever the session is used and the `updateAge` is reached, the session expiration is updated" — default `updateAge` is 1 day |
| Multi-device | One row per device. `listSessions` enumerates active devices; revoke individually |
| Validation per request | Default: DB read on every request |
| Cookie caching | Optional optimization: `compact` (HMAC-SHA256), `jwt` (HS256), or `jwe` (A256CBC-HS512) — short-lived signed cookie carries session data, falling back to DB on miss |
| Stateless mode | Possible but not recommended for production |

### Implications for the InsForge integration

- **Default DB-on-every-request** is fine for low-mid scale, but on hot paths consider `cookie caching` (shipped via plugin/config) — same DB you're already hitting, but reads cached for short windows.
- **Cookie caching `jwt` mode** uses HS256 with `BETTER_AUTH_SECRET`. Confusingly close in name to the bridge JWT (also HS256, but signed with `INSFORGE_JWT_SECRET`). They are independent — different keys, different consumers.
- **`SameSite=Lax`** is what makes the same-origin pattern (Pattern A) work seamlessly. Cross-origin requires switching to `SameSite=None; Secure` — covered in the integration guide.

## Rate limiting

Built into the core (not a plugin), enabled by default in production.

| Setting | Default |
|---|---|
| Global | 100 requests / 60 seconds per IP |
| Email sign-in | 3 / 10 seconds |
| 2FA verify | 3 / 10 seconds |
| Tracking | IP-based, reads `x-forwarded-for` |
| IPv6 | normalized; optional subnet (`/64`) limiting |
| Storage | In-memory (default), DB, or custom |
| Bypass | `auth.api.*` server-side calls bypass rate limiting |

For our bridge route: when the bridge calls `auth.api.getSession({ headers })`, that's a server-side call and bypasses rate limits. So the bridge itself isn't rate-limited; if we want rate-limiting on `/api/insforge-token` we'd add it ourselves at the route level.

## Plugin ecosystem (verbatim catalog)

Better Auth's plugin list is large. Grouped by category from their docs:

### Authentication methods (12)
- Two-Factor Authentication, Passkey, Magic Link, Email OTP, Phone Number, Anonymous, Username, One Tap (Google), Sign In With Ethereum, Generic OAuth, Multi Session, Last Login Method

### Authorization & management (4)
- Admin, Organization (teams + members), SSO (SAML 2.0), SCIM

### API & tokens (6)
- Agent Auth (for AI agents), API Key, JWT (asymmetric), Bearer, One-Time Token, OAuth Proxy

### OAuth & OIDC providers (4)
- OAuth 2.1 Provider, OIDC Provider, MCP provider auth, Device Authorization Grant

### Payments & billing (5)
- Stripe, Polar, Autumn, Creem, Dodo Payments

### Security & utilities (5)
- Captcha, Have I Been Pwned (breached-password check), i18n, OpenAPI generator, Test Utils

### Analytics & tracking (1)
- Dub (lead tracking via Dub links)

### Implications for InsForge users

- **Organization plugin** is the big one — it adds `organization` / `member` / `team` / `invitation` tables. Users of multi-tenant apps will turn this on. The same REVOKE pattern applies: `REVOKE ALL ON public.organization, public.member, public.team, public.invitation FROM anon, authenticated;`. Worth adding to the integration guide as a follow-up section.
- **Admin plugin** adds `is_super_admin` / `banned_until` columns to `user`. The REVOKE we wrote already covers `user`, so no new tables to lock down — just be aware of the columns.
- **SSO plugin** adds an `ssoProvider` table. Same lockdown pattern.
- **API Key plugin** is interesting for InsForge: it lets your end-users mint their own API keys. Combined with the bridge route, you could expose a per-user API token without needing a separate API key system on the InsForge side.
- **Stripe / Polar / Autumn / Creem / Dodo** turn Better Auth into a thin billing wrapper. Out of scope for this integration but worth knowing.

## What Better Auth does NOT do (and where InsForge picks up)

| Concern | Better Auth | InsForge | Bridge / glue |
|---|---|---|---|
| Authentication | ✅ owns | — | — |
| Session storage | ✅ owns (DB + cookie) | — | — |
| Email delivery | ❌ "BYO" — you wire a transport | ✅ `client.emails` (or InsForge built-in) | call InsForge from your `sendVerificationEmail` callback |
| OAuth provider config | ✅ in code | — | — |
| Password hashing | ✅ scrypt default, bcrypt available | — | — |
| Row-Level Security | ❌ outside its scope | ✅ via PostgREST + `request.jwt.claims` | the `/api/insforge-token` bridge |
| File storage | ❌ | ✅ `client.storage` | bridge JWT |
| Real-time / pub-sub | ❌ | ✅ `client.realtime` | bridge JWT (auto-reconnect via `onTokenChange`) |
| Edge functions | ❌ | ✅ `client.functions` | bridge JWT |
| Vector / AI | ❌ | ✅ `client.ai` | bridge JWT |
| Admin dashboard | ❌ in core (plugin available) | ✅ InsForge Studio | Studio sees Better Auth tables since `project_admin` retains access |

This split is what makes them complementary: Better Auth owns identity + session; InsForge owns data + storage + compute; the bridge JWT is the seam.

## Operational notes

| Concern | Detail |
|---|---|
| Background jobs | Better Auth has none. Cleanup of expired sessions/verifications is a `delete from session where expires_at < now()` you run yourself (e.g., as an InsForge cron). |
| Logging | Console-style by default. Plug your logger via the `logger` option in `betterAuth({...})`. |
| Observability | No built-in metrics. Roll your own around the handler. |
| Telemetry | None reported in docs (project doesn't appear to phone home). |
| Email transport | You provide one. Common pattern: pass an `async sendVerificationEmail` that calls `insforge.emails.send(...)`. |
| Hot reload | Standard Next.js / Bun / Express dev server reloads. The DB pool can be a footgun on hot reload — Better Auth's docs recommend a singleton `Pool` (which our `auth.ts` already implements via the module-scoped `betterAuth({ database: new Pool(...) })`). |
| Production secret | `BETTER_AUTH_SECRET` ≥ 32 chars, high entropy. Different from `INSFORGE_JWT_SECRET`. |

## Project health

Based on the GitHub repo:

- **License:** MIT — permissive, no copyleft, fine for any commercial use
- **Stars:** ~28k (signal of active community, comparable to Lucia at peak)
- **Releases:** ~922 total releases — extremely active iteration
- **Latest version:** 1.6.9 (post-1.0, semver-stable in the sense that breaking changes are clearly versioned)
- **Maintenance pattern:** Solo lead developer with growing contributor base; sponsorship model; not VC-funded SaaS, so no incentive misalignment between the OSS package and a paid tier

For InsForge users contemplating Better Auth: **the dependency risk is real but bounded.** It's not an Anthropic-sized engineering org — it's a focused OSS project with active commits. If it became unmaintained tomorrow, you still have working source code (MIT-licensed, in your codebase) and your data (in your Postgres). Compare to Clerk or Auth0 where outage = your auth down.

## Versus the alternatives in this lineup

| | Clerk | Auth0 | WorkOS | Kinde | Stytch | **Better Auth** |
|---|---|---|---|---|---|---|
| Hosting | SaaS | SaaS | SaaS | SaaS | SaaS | **Self-hosted in your DB** |
| User table location | Their DB | Their DB | Their DB | Their DB | Their DB | **Your DB (`public.user`)** |
| Pricing | Per-MAU | Per-MAU | Per-org | Per-MAU | Per-MAU | **Free (MIT)** |
| Vendor outage risk | High | High | Med | Med | Med | **None** |
| Migration lock-in | High | High | Med | Med | Med | **None** |
| Dashboard / admin UI | Excellent | Excellent | Good | Good | Good | **None core; plugin available** |
| Built-in features beyond auth | Lots (organizations, billing) | Lots | SSO + SCIM | Some | Some | **Plugins (organizations, Stripe, etc.)** |
| Time-to-first-signup | Minutes | Minutes | Minutes | Minutes | Minutes | **Minutes (after the migrate + REVOKE)** |
| Code surface in your codebase | Small | Small | Small | Small | Small | **Largest of the six (auth runs in-process)** |

The trade is: **own the runtime + own the data, in exchange for owning the ops.** For most InsForge users — who are already running their own DB in InsForge — the math favors Better Auth. The fact that auth lives in the same Postgres they're already operating means there's no new component to monitor.

## Recommendations for the integration guide (already incorporated)

1. ✅ **Lead with the differentiator** — auth in your own DB, no SaaS, no vendor lockin
2. ✅ **Document the REVOKE prominently** — it's the only step the upstream Better Auth Supabase guide forgets
3. ✅ **Cover both Pattern A and Pattern B** — Better Auth supports both rendering models cleanly
4. ✅ **Cover the cookie/CORS for cross-origin** — relevant for React SPAs without a Next.js backend
5. ✅ **Don't re-export Better Auth's `jwt()` plugin** — it's asymmetric, incompatible with InsForge's PostgREST; the bridge route is the right answer
6. ⏭️ **Future follow-up:** Organization plugin REVOKE addendum (org/member/team/invitation tables in `public`)
7. ⏭️ **Future follow-up:** Email transport using `client.emails.send` — a 10-line `sendVerificationEmail` snippet in the doc
8. ⏭️ **Future follow-up:** Cron for stale-session cleanup using InsForge's scheduled tasks