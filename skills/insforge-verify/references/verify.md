# Verify runbook

The full step-by-step flow. `SKILL.md` has the overview, when-to-use, and scope; this
is the runbook you follow once you've decided to verify. **You drive the changed UI flow
yourself with the browser MCP — no spec generation, no `.spec.ts` files.**

> ⚠️ **This runs against the backend your project is linked to** (your dev project) — it
> seeds test users and the cross-user probe writes/reads real rows there. **Only run
> against a dev/staging project, never prod**, and clean up afterwards (step 6).

## 1. Prepare the backend: apply the change, seed two verified users

Real flows sit behind a login wall and signup needs an email OTP a test agent can't read,
so create two verified accounts directly with the admin key — A drives the flow (step 3),
B is the cross-user isolation probe (step 4). The `verify` helpers in step 4 log the users
in themselves; you just need them to exist (with the default emails/password below).

```bash
BASE_URL=$(node -e "console.log(require('./.insforge/project.json').oss_host)")
ADMIN_KEY=$(node -e "console.log(require('./.insforge/project.json').api_key)")

# If your change includes a migration you haven't applied to this backend yet, do it now —
# otherwise you verify the OLD schema (a loosened RLS policy would still look correct).
npx @insforge/cli db migrations up --all     # skip if already applied during development

# Seed BOTH users as runnable code. Both must exist — an unseeded B makes the isolation
# check silently pass (a false pass on the highest-value check).
for EMAIL in verify-a@example.com verify-b@example.com; do
  curl -s -X POST "$BASE_URL/api/auth/users" -H "Authorization: Bearer $ADMIN_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"Test1234!pass\",\"name\":\"$EMAIL\"}" >/dev/null
  curl -s -X POST "$BASE_URL/api/database/advance/rawsql" -H "Authorization: Bearer $ADMIN_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"UPDATE auth.users SET email_verified=true WHERE email='$EMAIL'\",\"params\":[]}"
done
```

## 2. Point the browser at your running app

No separate deploy — you verify the app **you're already running** on this branch: your
local dev server (`http://localhost:3000`) or your existing deployment. Confirm it's
pointed at the same `BASE_URL` backend you seeded above, then use that URL as `APP_URL` in
the next step.

## 3. Drive and verify the changed UI flow

Drive the change yourself with the Playwright browser MCP (`@playwright/mcp`). **Do NOT
generate or run `.spec.ts` files** — drive the flow live and assert in the moment. This is
fast (minutes, not tens), leaves no artifacts, and works on any MCP-capable agent (Claude
Code / Codex / Cursor …).

**One-time setup:** the `@playwright/mcp` browser MCP is configured for your agent by
default at `npx @insforge/cli link` (and `create`). It exposes `browser_navigate /
browser_click / browser_type / browser_snapshot` (the accessibility tree you read + assert
from) / `browser_console_messages` / `browser_network_requests` / `browser_take_screenshot`.

**Start authenticated, don't re-login per step.** Get the browser into user A's session —
drive the login form once with `verify-a@example.com` / `Test1234!pass`, or inject a token
if the app reads the session from storage (fetch one via `POST /api/auth/sessions`).

**Drive the changed flow, then explore around it — scoped to THIS flow, not the app:**

1. `browser_navigate` to the changed flow → `browser_snapshot` to read the live page and
   find real elements (**don't guess selectors — read them off the snapshot**).
2. **Drive the main path** of the change (e.g. change cart quantity 1 → 2).
3. **Flow-local exploration** — probe the obvious variations *of this flow*, NOT
   unrelated flows: the inverse action, boundary values, error states, directly-adjacent
   state. (e.g. for "change quantity": decrement; decrement at 1 → item removed; exceed
   stock → rejected; cart total / checkout updates.) Derive these from the UI affordances
   you see + what the change touched.
4. For each, assert the UI claim by reading the `browser_snapshot`, and **note any
   identifying value the UI shows** (a record id, a count) — step 4 cross-checks the SAME
   record against backend truth.
5. **Catch loud errors too** — check `browser_console_messages` and
   `browser_network_requests` for anything the page threw during the drive (a 4xx/5xx, a
   `column does not exist`, a console exception). Those are findings, not just the
   assertions you planned.

> A green UI here only means "the app *looks* right." It is NOT a pass on its own — a
> write can return HTTP 200 + optimistic UI while the DB never changed. **Every UI
> assertion must be confirmed against backend ground truth in step 4.**

## 4. Cross-check against backend truth

A green UI can still be a false pass — a write that returned 200 + optimistic UI but never
persisted, a stale value, or another user's row that leaked. Confirm the UI against ground
truth with the `verify` helpers: they run the deterministic probe **and record the
finding** (so it doesn't depend on you remembering to log it), reading the admin key from
`.insforge/project.json` and logging the seeded users in themselves. They **exit non-zero
when they find something** — that's a finding to fix (go to step 5), not a broken command.

- **Backend truth.** For each UI assertion (and the record id you noted in step 3), check
  the DB agrees with what the UI claimed:

  ```bash
  npx @insforge/cli verify truth --table cart_items \
    --query "select quantity from cart_items where id='<the id>'" --expect 3
  ```

  A mismatch (DB ≠ what the UI showed) is a FALSE PASS.

- **Cross-user isolation.** Probe whether user B can reach user A's rows. Supply the
  user-scoped `--table` + `--owner` column from the schema + what the change touched (for a
  table scoped through a parent, probe the parent too):

  ```bash
  npx @insforge/cli verify rls --table orders --owner user_id
  ```

  Under the hood it runs **B reads A's rows** (must be empty), **A reads own** (positive
  control, must be non-empty — catches a policy that silently empties a real user's data,
  the break no scanner sees because it returns 200 + `[]`), and an **anonymous read** (must
  be blocked). Any of A's data reachable by B is an RLS leak.

> A single-user own-token test CANNOT catch a leak — a wide-open `using(true)` policy passes
> the owner's own read identically. The probe brings in user B for exactly this.

(Older CLI without `verify`: fall back to hand-rolled curl — log both seeded users in, read
the data API as each, and compare. The helper just makes it deterministic + recorded.)

Report each flow as UI result + backend-truth result. Never report success on UI alone.

## 5. If verification fails: fix, then re-verify

A real bug stays red. Fix it, then re-verify — nothing to regenerate, so this is fast:

1. **Locate it in the source** (the change you're verifying is the prime suspect).
2. **Fix the app code or migration** (you, the main session).
3. **Make the fix live** — your dev server hot-reloads; if it was a migration/RLS fix,
   re-apply it to `BASE_URL` (`npx @insforge/cli db migrations up --all`).
4. **Re-drive the same flow** (the failing path + the backend-truth read for it) — seconds,
   not minutes, since there's no spec to regenerate.
5. Repeat until green in both UI and backend, or you've confirmed the behaviour is intended.

Report the bug, the fix, and the passing re-verification.

## 6. Clean up

There's no branch to tear down, so undo what you wrote to the shared backend: the seeded
users and any rows the probes/flows created.

```bash
curl -s -X POST "$BASE_URL/api/database/advance/rawsql" -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"delete from auth.users where email in ('verify-a@example.com','verify-b@example.com')\",\"params\":[]}"
# Also delete any test rows your flow created (cart items, orders, …) keyed to those users.
```
