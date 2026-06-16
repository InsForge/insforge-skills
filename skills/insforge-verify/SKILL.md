---
name: insforge-verify
description: >-
  Use after making backend or full-stack changes to an InsForge project, when
  you want to verify the change end-to-end before merging the branch to prod.
  Spins up an isolated full-stack preview (a branch backend + the frontend
  pointed at it) and an authenticated test session, then hands off to your own
  browser test agent (Playwright Test Agents) to explore and verify the running
  app, and tears the preview down afterward. Built for "full stack branch per
  git branch, easy to verify."
license: MIT
metadata:
  author: insforge
  version: "0.1.0"
  organization: InsForge
  date: June 2026
---

# InsForge Verify

> 🔒 **Private preview.** Experimental, not yet generally available. Depends on
> `insforge preview` commands that are still rolling out (older CLI versions
> won't have them) and uses a manual workaround for the auth session — see Known
> gaps. Behavior and commands may change. Ask the InsForge team for early access.

Verify an InsForge full-stack change the way a real user would: in an **isolated
preview** (a branch backend + the frontend pointed at it), driven by a **real
browser**.

This skill does NOT write or run the tests. It sets up the things your browser
test agent **cannot get itself**, then gets out of the way:

| Your test agent does | This skill provides |
| --- | --- |
| Explore the app, write the test plan, drive the browser, judge results | An isolated full-stack environment (`preview create`) |
| Decide what to test and how | The frontend wired to that environment (`--wire-env`) |
| | An authenticated test session (the login wall blocks autonomous testing) |
| | Backend ground truth to check against, and teardown |

> Do not prescribe a test plan here — let the test agent's planner discover the
> flows from the live app. This skill only stands up a verifiable environment.

## When to use

After changing schema / RLS / functions / frontend, to confirm the app actually
works before merging the branch to prod.

## Scope — test only what changed

Do NOT explore and test the whole app. A full-app exploration takes the planner
tens of minutes; a focused run takes a few. Before testing, narrow the scope:

1. **Find what changed.** Prefer `git diff --name-only` / `git diff`; if the repo
   isn't git or the diff is unclear, ask the user what they changed.
2. **Map changes to user flows.** Translate the changed files/functions into the
   specific UI flows they affect (e.g. a change in a cart-quantity function -> the
   "change cart quantity" flow only; an RLS policy on orders -> the "order
   isolation" flow only). Leave unrelated flows (login UI, checkout, account, …)
   out.
3. **Stay safe.** If you can't tell what a change affects, widen by one adjacent
   flow rather than miss it; only fall back to full-app testing as a last resort.

Pass this narrow scope into the steps below — especially the planner task in
step 4.

## Steps

### 1. Stand up an isolated branch backend

```bash
insforge preview create <name>
```

Branches the linked project — a real backend plus a copy of its data. All your
test writes (and the frontend you deploy below) land in this isolated branch,
never prod.

### 2. Switch to the branch and seed verified test users

Switch context to the branch (so the admin key, and the deploy below, target the
branch — not prod), then apply any pending migrations and seed accounts. Real flows
sit behind a login wall and signup needs an email OTP a test agent can't read, so
create verified accounts directly with the branch admin key. **Stay in branch
context** until teardown.

```bash
insforge branch switch <name>      # context + admin key + deploy target -> the branch
BRANCH_URL=$(node -e "console.log(require('./.insforge/project.json').oss_host)")
ADMIN_KEY=$(node -e "console.log(require('./.insforge/project.json').api_key)")

# Did your change include a migration (schema / RLS / functions)? The branch is a
# snapshot from create time, so apply pending local migrations to it before testing —
# otherwise you verify the old backend (a loosened RLS policy would still look correct).
insforge db migrations up --all

# Seed a verified account (repeat for a second account to test cross-user isolation):
curl -s -X POST "$BRANCH_URL/api/auth/users" -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"verify-a@example.com","password":"Test1234!pass","name":"verify a"}' >/dev/null
curl -s -X POST "$BRANCH_URL/api/database/advance/rawsql" -H "x-api-key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"UPDATE auth.users SET email_verified=true WHERE email='"'"'verify-a@example.com'"'"'","params":[]}'
```

Hand the credentials to the test agent so it can sign in.

### 3. Deploy the frontend to a real, isolated https URL

Deploy from **branch context** (you switched in step 2). The deploy targets the
**branch's own** site slug — a real https domain, isolated from prod — and is
removed when the branch is torn down. `NEXT_PUBLIC_*` are baked at build time, so
pass them with `--env` (the deploy excludes `.env.local`).

```bash
ANON=<your project's NEXT_PUBLIC_INSFORGE_ANON_KEY>   # shared with the branch
insforge deployments deploy . \
  --env "{\"NEXT_PUBLIC_INSFORGE_URL\":\"$BRANCH_URL\",\"NEXT_PUBLIC_INSFORGE_ANON_KEY\":\"$ANON\"}"
```

Note the returned `https://<branch-appkey>.insforge.site` URL — this is what you
test against. It runs the real production build over real https against the
isolated branch backend (so cookie/domain/CORS behaviour matches prod, which a
localhost dev server can't confirm).

### 4. Test the UI with Playwright Test Agents

Let the official Playwright Test Agents (planner -> generator -> healer) test the
deployed https app, signed in as a seeded user. They own the UI layer: exploring
routes, writing specs, driving a real browser, self-healing.

Give the planner a **narrow task scoped to the change** (from the Scope section),
not "test the app". State what to test and what to skip, e.g.:

> "Plan ONE test: add an item to cart, change its quantity, verify the new
> quantity persisted. Sign in programmatically; do NOT test login UI, checkout,
> account, or other cart operations."

The planner explores only what the task needs, so a focused task is minutes, not
tens of minutes. Generated specs land in `tests/*.spec.ts` — reuse them on
re-verification (step 6) instead of re-running the planner.

```bash
# One-time SETUP (not part of a test run): install the agent definitions, then
# RESTART Claude Code so planner/generator/healer load as usable subagents.
# Subagents load at session start — running init-agents mid-session leaves them
# unavailable ("Agent type 'playwright-test-planner' not found"). The CLI can do
# this for you at link time: `insforge link --with-test-agents`.
npx playwright init-agents --loop=claude
```

If the Test Agents aren't available this session (just installed, or you can't
restart), fall back to writing and running Playwright specs directly — same UI
coverage, you just lose the planner/healer automation.

This step answers only **"does the app look right in the UI?"** The next step is
what makes this an InsForge verification.

### 5. Cross-check against backend truth (the part only InsForge can do)

A green UI assertion can still be a false pass — a page that silently redirected,
served a stale value, or leaked another user's row. The isolated branch backend
plus the admin key let you confirm the UI against ground truth, against whatever
user-scoped tables and flows the UI exercised:

- **Backend truth.** For each UI assertion, read the branch DB directly and
  confirm it agrees with what the UI claimed:

  ```bash
  curl -s -X POST "$BRANCH_URL/api/database/advance/rawsql" \
    -H "x-api-key: $ADMIN_KEY" -H "Content-Type: application/json" \
    -d '{"query":"<a read that proves what the UI showed>","params":[...]}'
  ```

  UI asserts a state the backend doesn't reflect -> FALSE PASS. Fail it.

- **Cross-user isolation (double-sided).** With two seeded users and the data API
  (`/api/database/records/<table>`, PostgREST-style) plus each user's session token:
  - User B lists a user-scoped table -> only B's own rows appear.
  - User B filters for user A's rows -> must be empty.
  - **Positive control:** user A reads A's own rows -> must be non-empty. This
    rules out "the API returns empty for everyone" — a fake isolation that would
    otherwise pass silently.
  - Anonymous (no token) -> must be 401/403/empty.

  Any of A's data reachable by B is an RLS leak. Fail loudly.

Report each flow as UI result + backend-truth result + whether they agree. Never
report success on UI assertions alone.

### 6. If verification fails: fix, then re-verify

The Test Agents' healer fixes flaky *tests*, not your app — a real bug stays red.
When a UI case or a backend-truth check reveals an actual defect:

1. **Locate it in the source** (the change you're verifying is the prime suspect).
2. **Fix the app code** (you, the main session — not a subagent).
3. **Redeploy the branch frontend** so the fix is live:
   `insforge deployments deploy . --env "{…branch URL + anon key…}"` (still in
   branch context).
4. **Re-verify by re-running the existing spec**, not the planner:
   `npx playwright test tests/<the-failing-spec>.spec.ts` — plus the backend-truth
   read for that flow. This is seconds, not minutes.
5. Repeat until the flow is green in both UI and backend, or you've confirmed the
   behaviour is intended.

Report the bug, the fix, and the passing re-verification.

### 7. Tear down

```bash
insforge branch switch --parent    # leave branch context
insforge preview teardown <name>   # deletes the branch — the branch-scoped deployment goes with it
```

## Known gaps (private preview)

1. `preview create --seed-user` not built — step 2 is a manual workaround.
2. `preview create` doesn't output the branch admin/anon key — hence `branch switch`.
3. Deploy MUST happen in branch context (step 2 switches you there). A deploy run
   in parent context would target the prod site and would not be cleaned up by
   teardown — don't switch back to parent before deploying.

## Versioning

Pre-1.0 (`0.x.y`) means private preview / unstable: commands and flow may change
without notice. Bump the minor (`0.2.0`, `0.3.0`) as the workarounds above are
replaced by real commands. Promote to `1.0.0` and drop the Private-preview
callout only when `preview create --seed-user` lands and the flow is stable.
