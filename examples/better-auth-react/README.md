# Better Auth + InsForge — Vite + React example

A pure React SPA (no Next.js) that integrates with Better Auth and InsForge. Mirrors `examples/better-auth-nextjs/` feature-for-feature: sign-up / sign-in, the bridge JWT, RLS-isolated note CRUD, sign-out.

A SPA can't host Better Auth's `/api/auth/*` routes by itself — those need a server. This skeleton uses the **Vite proxy** pattern: the SPA runs on `:5173`, a separate Node process runs the BA + bridge routes (this example proxies to the sibling `better-auth-nextjs/` skeleton on `:3030`, but any Hono/Express/Bun server with the same routes works). To the browser everything looks same-origin, so the BA cookie is auto-attached to `/api/insforge-token` with no CORS dance.

## What it shows

- **`lib/auth-client.ts`** — `createAuthClient()` from `better-auth/react`; identical to the Next skeleton.
- **`lib/insforge.ts`** — the framework-agnostic `useInsforgeClient` hook. Uses the new `client.setAccessToken()` (SDK ≥ 1.3.0) so HTTP and realtime stay in sync without reaching into private state.
- **`vite.config.ts`** — proxies `/api` to the BA server AND rewrites the `Origin` header to `http://localhost:3030` so BA's CSRF check (which compares `Origin` against its `baseURL`) doesn't 403 on sign-out. See the integration guide's "Vite / React-only setups" section for why this is needed.
- **`src/App.tsx`** — single-component SPA: sign-up / sign-in form when signed out, notes panel when signed in.

## Setup

```bash
# 1. Spin up the BA + bridge server. Easiest path: use the Next skeleton next door.
cd ../better-auth-nextjs
npm install
cp .env.example .env.local   # fill in real values
npm run auth:migrate
npm run db:setup
npm run dev                  # listens on :3030

# 2. In another terminal, run this React app.
cd ../better-auth-react
npm install
cp .env.example .env.local   # fill in InsForge anon key + base url
npm run dev                  # listens on :5173 → http://localhost:5173
```

Sign up at `/`, then add notes. RLS isolates per user — sign in as a second user and confirm you see only your own rows.

## Verifying

- BA cookie set after sign-up: open DevTools → Application → Cookies → `localhost:5173` → `better-auth.session_token`
- Bridge route reachable: `curl -b <browser-cookie-jar> http://localhost:5173/api/insforge-token` returns `{"token":"..."}`
- Sign-out clears the bridge: same curl after sign-out returns `401`
- REVOKE works: `curl -H "apikey: $VITE_INSFORGE_ANON_KEY" "http://localhost:5431/user?select=id"` → `permission denied for table user`

## Pattern B (cross-origin, no proxy)

If you'd rather have the SPA and BA server on truly different origins (e.g., `app.example.com` and `auth.example.com`), see the integration guide's "Pattern B — true cross-origin" subsection. You'll need:
- `advanced.defaultCookieAttributes: { sameSite: 'none', secure: true }` on the BA config
- `trustedOrigins: ['<your SPA origin>']` on the BA config
- `Access-Control-Allow-*` headers on the BA + bridge routes
- `credentials: 'include'` on the SPA's bridge fetch

## What's not in this skeleton

- OAuth providers (configure in `lib/auth.ts` of the BA server with `socialProviders: { github: { ... } }` — same as Next)
- Email verification / reset password (BA's `sendVerificationEmail` / `sendResetPassword` callbacks wired to InsForge's email service)
- Tests
- A Hono/Express variant of the BA server (see the integration guide for the code; this skeleton just reuses the Next one as the BA host)
