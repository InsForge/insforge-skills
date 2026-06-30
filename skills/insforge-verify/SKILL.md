---
name: insforge-verify
description: >-
  Use after making backend or full-stack changes to an InsForge project, when
  you want to verify the change before shipping it. Seeds authenticated test
  users on your dev backend, drives the changed UI flow of your running app in a
  real browser, and — the key part — cross-checks the result against backend
  ground truth: did the data actually persist, and does cross-user RLS isolation
  still hold? That backend/RLS check catches "UI looks right but the backend is
  wrong" false passes a pure UI/e2e test can't. Cleans up the seeded test data
  afterward.
license: MIT
metadata:
  author: insforge
  version: "0.1.0"
  organization: InsForge
  date: June 2026
---

# InsForge Verify

> 🔒 **Private preview.** Experimental, not yet generally available. Runs against the
> dev backend your project is linked to — it seeds test users and writes/reads test rows
> there, so **never run against prod**. Drives the browser via the Playwright MCP
> (`@playwright/mcp`, configured by default at `npx @insforge/cli link` / `create`) and uses
> manual curl workarounds for seeding — see Known gaps. Behavior and commands may change.
> Ask the InsForge team for early access.

Verify an InsForge full-stack change the way a real user would: drive the changed UI flow
of your **running app** in a **real browser**, then **cross-check the result against
backend ground truth** — did the data actually persist, and does cross-user RLS isolation
still hold? That backend/RLS check is the part a pure UI/e2e test structurally can't do —
it catches a "UI looks right but the backend is wrong" false pass, and it's where
InsForge's value is.

You drive the UI yourself (via the browser MCP — see the runbook); this skill gives you
what you **can't get yourself**:

| You do | The skill provides |
| --- | --- |
| Drive the changed UI flow + assert | Seeded authenticated users (the login wall blocks autonomous testing) |
| Decide what to test (scoped to the change) | Backend ground truth + cross-user RLS isolation to check against |
| | Cleanup of the seeded test data afterward |

> Scope to the change — drive the flow you changed and its edge cases, don't explore the
> whole app. The runbook is in [references/verify.md](references/verify.md).

## When to use

After changing schema / RLS / functions / frontend, to confirm the app actually works
before shipping the change.

**Run it at a checkpoint, don't wait to be asked.** When you've made a backend or
full-stack change and are about to **declare the task done** or **deploy**, verify first —
that's the moment the change is complete enough to check. A change that only touches the
backend can still break the frontend (a dropped column, a tightened RLS policy that
silently empties a user's data), so don't skip verify just because "I only changed the
backend."

## Scope — test only what changed

Do NOT explore and test the whole app — verify confirms a *known* change, so driving the
whole app is slow and pointless. Before testing, narrow the scope:

1. **Find what changed.** Prefer `git diff --name-only` / `git diff`; if the repo
   isn't git or the diff is unclear, ask the user what they changed.
2. **Map changes to user flows.** Translate the changed files/functions into the
   specific UI flows they affect (e.g. a cart-quantity function -> the "change cart
   quantity" flow only; an RLS policy on orders -> the "order isolation" flow only).
   Leave unrelated flows out.
3. **Stay safe.** If you can't tell what a change affects, widen by one adjacent flow
   rather than miss it; only fall back to full-app testing as a last resort.

Drive only this scoped flow (and its edge cases) in step 3 of the runbook.

## How to run

**Default: run this as a background detection subagent** (see *Execution mode* below) so the
slow UI-driving doesn't block your main session — only drive it inline yourself when the user
asks to watch it run. Either way the underlying flow is the same.

Follow the full runbook: **[references/verify.md](references/verify.md)**. The flow:

1. **Prepare the backend** — against the dev backend your project is linked to (**never
   prod**): apply your change, seed two verified users, get their tokens + the anon key.
2. **Point the browser at your running app** — your local dev server or existing deploy,
   pointed at that same backend.
3. **Drive the changed UI flow yourself** (via the browser MCP), scoped to the change and
   its edge cases — no spec generation, no `.spec.ts` files.
4. **Cross-check backend truth** — read the DB directly + run the cross-user RLS isolation
   probe. A green UI over a wrong backend is a false pass.
5. **Fix → re-verify** if anything fails.
6. **Clean up** — delete the seeded users and any test rows the run created.

## Execution mode — default to a background subagent

**This is the default way to run verify.** The UI-driving is slow (minutes), so unless the
user asks to watch it run, you **must** hand that off to a background detection subagent
rather than driving it inline and blocking the main session. Do the foreground prep
yourself, then **dispatch and stop — do not keep driving the flow inline.** Finishing it
yourself defeats the point: once prep is done, dispatching *is* the next action, not more
driving. Run inline in the foreground **only** when the user explicitly asks to watch it /
run it in the main session.

Why this is the default: a passing verify never interrupts you; a failing one pulls you back
**only** when there's a real finding to fix — which is exactly when you want the interrupt.

The split is fixed:
- **You, foreground (prep — can't move to the subagent):** scope the change (*Scope*
  above), pre-authorize the wildcards (below), seed the users + apply any migration to the
  dev backend (step 1), and clean up afterward (step 6). These need your context or a
  permission prompt, so they stay with you.
- **Subagent, background (the slow part you hand off):** drive the changed UI flow and
  cross-check backend truth/RLS (steps 2–4), then return a **structured findings report**.
  Pass it the scope explicitly — it starts fresh, so hand over the `git diff` / changed
  files + which flow to drive. Have it run the probes with `--json` (`npx @insforge/cli
  verify rls/truth --json`) and return those verdicts verbatim — e.g. `false_pass on
  cart_items: UI=3, DB=1` plus evidence. The finding is still recorded by the CLI regardless
  of who invokes it, so telemetry is unaffected.
- **You (fix).** The subagent does **not** edit code — it reports. You own the change
  context and the files, so you apply the fix, then re-dispatch the subagent to re-verify.
  This avoids two subagents editing the same files concurrently and avoids handing your
  change rationale to a fresh agent.
- **Give the subagent its own browser.** The Playwright MCP is stateful — a verify
  subagent must drive its **own headless browser instance**, not share the session you're
  using, or the two will fight over browser state.
- **Pre-authorize in the foreground first — a background subagent can't prompt.** Running
  unattended, the subagent has no way to surface a permission request, so any command not
  already allowed is silently auto-denied (you'll see it drive the browser but the `verify`
  probes fail). Before dispatching, make sure both of these are allowed **as wildcards** in
  your agent's permission allowlist — approving one specific command tends to record a
  one-off exact string (with that run's table/id baked in) that the next run's different
  args won't match, so it must be a pattern:
  - `npx @insforge/cli verify *` — the probes
  - the browser MCP tools (e.g. `mcp__playwright__*`)

  Authorize these once in the foreground, where permission prompts work; the wildcard makes
  it a one-time step. Then dispatch — the subagent inherits the same allowlist and runs
  silently, leaving your main session free.

This makes verify *asynchronous*, not faster — the subagent still spends the same minutes
driving the UI; you just aren't blocked while it does.

## What to assert — target what agents miss

A coding agent's blind spots are exactly where verify earns its keep, so point your
assertions there (not at generic UI):

- **Did it persist?** A write can return 200 + optimistic UI while the DB never changed.
- **Cross-user isolation.** Agents code single-user; another user must not see/modify A's
  rows (and A *must* see A's own — positive control).
- **Did the error path surface?** Agents swallow errors (happy-path only). Drive an error
  case and confirm it's actually rejected/shown, not silently a 200.
- **Boundaries / the "second item".** Empty, max/limit, the inverse action — agents pass
  the one example and miss the rest.

## References

- **[references/verify.md](references/verify.md)** — the full step-by-step runbook.

## Common Mistakes

- ❌ **Running verify against your prod project.** It seeds users and writes test rows. ✅
  Run against a dev/staging project, and clean up afterward (step 6).
- ❌ **Trusting a green UI on its own.** A write can return 200 + optimistic UI while the
  DB never changed. ✅ Every UI assertion must be confirmed against backend ground truth.
- ❌ **Single-user isolation "test".** Reading your own rows with your own token passes
  even under a wide-open `using(true)` policy. ✅ Bring in user B — B must not see A's
  rows, and A *must* see A's own (positive control).
- ❌ **Probing with an empty token/anon.** A failed/missing login yields an empty token,
  turning every probe into an anonymous request that "passes" isolation silently. ✅ Assert
  both tokens (and the anon key) are non-empty before probing; seed BOTH users as runnable
  code, not a prose hint.
- ❌ **Verifying the old backend.** If your change had a migration you didn't apply to this
  backend, you test the pre-change schema. ✅ `npx @insforge/cli db migrations up --all` before driving.
- ❌ **Hand-rolling a fragile probe script** (e.g. an unbound var under `set -u` silently
  fails the read). ✅ Use `npx @insforge/cli verify rls/truth` — it runs the deterministic probe and
  records the finding; you supply only the table/owner.
- ❌ **`must be owner` when applying an RLS migration** — the table is `postgres`-owned
  (common on template-scaffolded apps). ✅ `ALTER TABLE … OWNER TO project_admin` once
  (what backend migration 046 does), then `npx @insforge/cli db migrations up` works.

## Known gaps (private preview)

1. **No isolation** — verify runs against the real dev backend your project is linked to.
   Seeded users and test rows land there; clean them up manually (step 6). Don't run
   against prod.
2. **Manual seeding** — user seeding is a curl workaround; the backend-truth / RLS probes
   use the `npx @insforge/cli verify rls/truth` helpers.
3. **You point the browser at your running app yourself** — verify doesn't deploy or start
   it; make sure it's running and aimed at the same backend you seeded.
