---
name: insforge-verify
description: >-
  Use after making backend or full-stack changes to an InsForge project, when
  you need to verify the change end-to-end before merging — spin up an isolated
  full-stack preview (real backend + data via a branch), point the frontend at
  it, drive a real browser through the actual user flows (functional, auth, and
  cross-user RLS isolation), confirm against backend ground truth, then tear it
  down. Built for "full stack branch per git branch, easy to verify."
license: MIT
metadata:
  author: insforge
  version: "0.1.0-draft"
  organization: InsForge
  date: June 2026
---

# InsForge Verify

> 🔒 **Private preview.** This skill is experimental and not yet generally available. It depends on `insforge preview` commands that are still rolling out (older CLI versions won't have them) and uses manual workarounds for seeding auth — see Known gaps. Behavior and commands may change. Ask the InsForge team for early access.

Verify an InsForge full-stack change the way a real user would: in an **isolated
preview** (a branch backend + the frontend pointed at it), driving a **real
browser** through real flows — not unit tests, not mocked backends.

The test runner is YOURS (you write/run Playwright). InsForge supplies the three
things you cannot get yourself: an **isolated full-stack environment**, an
**authenticated test session**, and **backend ground truth** to check against.

## When to use

- You changed schema / RLS / functions / frontend and want to confirm the app
  actually works before merging the branch to prod.
- You need to verify cross-user data isolation (user A cannot see user B's data).

## The loop

### 1. Create an isolated full-stack preview

```bash
insforge preview create <name> --wire-env .env.local
```

This branches the linked project (real backend + a copy of data), and rewrites
`NEXT_PUBLIC_INSFORGE_URL` in `.env.local` to point the frontend at the branch
backend (a `.env.local.preview-bak` backup is made). Note the printed Backend URL.

> Your test writes now land in the isolated branch, NOT prod.

### 2. Get an authenticated test session

Most real flows (cart, checkout, orders) are behind a login wall, and signup
needs an email OTP you can't read. Get past it with admin access to the branch:

```bash
# get the branch's own admin key (the parent key does NOT work on the branch)
insforge branch switch <name>
BRANCH_URL=$(node -e "console.log(require('./.insforge/project.json').oss_host)")
ADMIN_KEY=$(node -e "console.log(require('./.insforge/project.json').api_key)")

# create a user, then mark it verified (bypasses the email OTP)
curl -s -X POST "$BRANCH_URL/api/auth/users" -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify-test@example.com","password":"Test1234!pass","name":"verify test"}' >/dev/null
curl -s -X POST "$BRANCH_URL/api/database/advance/rawsql" -H "x-api-key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"UPDATE auth.users SET email_verified=true WHERE email='"'"'verify-test@example.com'"'"'","params":[]}'

insforge branch switch --parent   # return context to parent; .env stays pointed at branch
```

> KNOWN GAP: this is a workaround. The clean path (`preview create --seed-user`)
> is not built yet. Until it is, use the two curl calls above.

### 3. Start the frontend

```bash
npm run dev   # picks up the branch backend from the wired .env.local
```

(For a real https domain instead of localhost: `insforge deployments deploy .
--env '{"NEXT_PUBLIC_INSFORGE_URL":"<branch-url>","NEXT_PUBLIC_INSFORGE_ANON_KEY":"<anon>"}'`
and test against the returned `*.insforge.site` URL.)

### 4. Drive a real browser through the flows

Use Playwright Test Agents (`npx playwright init-agents --loop=claude`) to
explore the running app and generate/run tests, OR write Playwright scripts
directly. Cover, at minimum:

- **Functional**: home loads, list pages show real data, a core create/read flow
  round-trips (e.g. upload → status becomes ready; add to cart → cart shows it).
- **Auth**: sign in with the seeded verified user; confirm gated pages
  (cart/checkout/account) are reachable only when signed in.
- **Cross-user RLS** (the highest-value check, see below).

### 5. Cross-user RLS isolation — the check unit tests can't do

Seed a SECOND verified user (repeat step 2). Then probe the data API directly
with each user's token — this catches the "frontend hides it but the API
doesn't" class of leak:

```bash
# log in both users via API to get tokens + ids, then with user2's token:
#   GET {BRANCH_URL}/api/database/records/<table>            -> must contain ONLY user2 rows
#   GET {BRANCH_URL}/api/database/records/<table>?user_id=eq.<user1_id>  -> must be EMPTY
#   GET {BRANCH_URL}/api/database/records/<table>  (no auth) -> must be 401/403/empty
```

A non-empty result on the second probe = an RLS leak. Fail loudly.

### 6. CRITICAL: do not trust pass/fail — confirm against ground truth

Naive assertions give false passes (a cart page that says "Sign in to start"
matches no "empty" pattern and silently passes). Before reporting success:

- **Screenshot** key pages and actually look at them.
- **Cross-check** UI against backend truth: query the branch DB
  (`/api/database/advance/rawsql` with the branch admin key) for what SHOULD
  exist (e.g. `SELECT count(*) FROM cart_items WHERE user_id=...`) and confirm
  the UI matches. The backend is the source of truth — use it.

### 7. Tear down

```bash
insforge preview teardown <name>   # deletes the branch and restores .env.local from backup
```

> KNOWN GAP: if you deployed a frontend in step 3, the deployment is NOT removed
> by teardown (CLI has no delete for a READY deployment) — remove it from the
> dashboard.

## What InsForge provides vs what you do

| You (the agent) | InsForge |
| --- | --- |
| Write + run Playwright / Test Agents | Isolated full-stack branch (`preview create`) |
| Decide what flows to test | Frontend wired to the branch (`--wire-env`) |
| Judge results | Authenticated test session (admin-seeded user) |
| | Backend ground truth (raw SQL on the branch) |

InsForge is NOT a test runner. It is the verifiable full-stack environment your
own testing runs against.

## Known gaps (track these)

1. `preview create --seed-user` not built — auth session is a manual workaround.
2. `preview create` doesn't output the branch admin/anon key — need `branch switch`.
3. `preview teardown` doesn't remove deployments — manual dashboard cleanup.
4. False-pass risk — always confirm against ground truth (step 6).
