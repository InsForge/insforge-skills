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
  backend, you test the pre-change schema. ✅ `db migrations up --all` before driving.
- ❌ **Hand-rolling a fragile probe script** (e.g. an unbound var under `set -u` silently
  fails the read). ✅ Use `npx @insforge/cli verify rls/truth` — it runs the deterministic probe and
  records the finding; you supply only the table/owner.
- ❌ **`must be owner` when applying an RLS migration** — the table is `postgres`-owned
  (common on template-scaffolded apps). ✅ `ALTER TABLE … OWNER TO project_admin` once
  (what backend migration 046 does), then `db migrations up` works.

## Known gaps (private preview)

1. **No isolation** — verify runs against the real dev backend your project is linked to.
   Seeded users and test rows land there; clean them up manually (step 6). Don't run
   against prod.
2. **Manual seeding** — user seeding is a curl workaround; the backend-truth / RLS probes
   use the `npx @insforge/cli verify rls/truth` helpers.
3. **You point the browser at your running app yourself** — verify doesn't deploy or start
   it; make sure it's running and aimed at the same backend you seeded.
