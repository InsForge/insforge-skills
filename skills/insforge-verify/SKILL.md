---
name: insforge-verify
description: >-
  Use after making backend or full-stack changes to an InsForge project, when
  you want to verify the change end-to-end before merging the branch to prod.
  Spins up an isolated full-stack preview (a branch backend + the frontend
  pointed at it) and an authenticated test session, then hands off to your own
  browser test agent (Playwright Test Agents) to explore and verify the running
  app, cross-checks against backend ground truth, and tears the preview down
  afterward. Built for "full stack branch per git branch, easy to verify."
license: MIT
metadata:
  author: insforge
  version: "0.1.0"
  organization: InsForge
  date: June 2026
---

# InsForge Verify

> 🔒 **Private preview.** Experimental, not yet generally available. Depends on
> `npx @insforge/cli preview` commands that are still rolling out (older CLI versions
> won't have them) and uses a manual workaround for the auth session — see Known
> gaps. Behavior and commands may change. Ask the InsForge team for early access.

Verify an InsForge full-stack change the way a real user would: in an **isolated
preview** (a branch backend + the frontend pointed at it), driven by a **real
browser**, then **cross-checked against backend ground truth**. That backend
cross-check (data persisted correctly? cross-user RLS still holds?) is the part a
pure UI/e2e test structurally can't do — it's what catches a "UI looks right but the
backend is wrong" false pass.

This skill does NOT write or run the tests. It sets up what your browser test agent
**cannot get itself**, then gets out of the way:

| Your test agent does | This skill provides |
| --- | --- |
| Explore the app, write the test plan, drive the browser, judge results | An isolated full-stack environment (`preview create`) |
| Decide what to test and how | The frontend wired to that environment |
| | An authenticated test session (the login wall blocks autonomous testing) |
| | Backend ground truth to check against, and teardown |

> Don't prescribe a test plan here — let the test agent's planner discover the flows
> from the live app. This skill only stands up a verifiable environment.

## When to use

After changing schema / RLS / functions / frontend, to confirm the app actually works
before merging the branch to prod.

## Scope — test only what changed

Do NOT explore and test the whole app. A full-app exploration takes the planner tens
of minutes; a focused run takes a few. Before testing, narrow the scope:

1. **Find what changed.** Prefer `git diff --name-only` / `git diff`; if the repo
   isn't git or the diff is unclear, ask the user what they changed.
2. **Map changes to user flows.** Translate the changed files/functions into the
   specific UI flows they affect (e.g. a cart-quantity function -> the "change cart
   quantity" flow only; an RLS policy on orders -> the "order isolation" flow only).
   Leave unrelated flows out.
3. **Stay safe.** If you can't tell what a change affects, widen by one adjacent flow
   rather than miss it; only fall back to full-app testing as a last resort.

Pass this narrow scope into the planner task in step 4 of the runbook.

## How to run

Follow the full runbook: **[references/verify.md](references/verify.md)**. The flow:

1. **Stand up an isolated preview** — `preview create`, switch to the branch, apply
   migrations, seed verified users, deploy the frontend to the branch's https slug.
2. **Drive the UI** with Playwright Test Agents, scoped to the change.
3. **Cross-check backend truth** — read the branch DB directly + run the cross-user
   RLS isolation probe. A green UI over a wrong backend is a false pass.
4. **Fix → re-verify** if anything fails.
5. **Tear down** — `preview teardown` removes the branch and its deployment.

## References

- **[references/verify.md](references/verify.md)** — the full step-by-step runbook.

## Known gaps (private preview)

1. `preview create --seed-user` not built — user seeding is a manual workaround.
2. `preview create` doesn't output the branch admin/anon key — hence `branch switch`.
3. Deploy MUST happen in branch context. A deploy in parent context targets the prod
   site and isn't cleaned up by teardown — don't switch back to parent before deploying.
