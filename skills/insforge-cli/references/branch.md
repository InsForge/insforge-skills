# Backend Branches — `npx @insforge/cli branch`

A branch is a full child of the parent project: own EC2, own PostgreSQL, own storage namespace. It shares the parent's `JWT_SECRET` (same users authenticate) but gets fresh `API_KEY` / `ANON_KEY`. Use it to test schema, RLS, auth, or function changes in isolation before merging back to parent.

Branching is **not free** — each branch consumes an EC2 instance. Use it when isolation pays off.

## When to use a branch

**Strong signals — branch first:**
- Destructive DDL on existing tables (`DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN TYPE`). `git revert` doesn't restore lost data.
- New or modified RLS policies on user-data tables. RLS bugs are silent — prod users lock out or get unintended access.
- Auth provider config changes (OAuth providers, redirect URIs, SMTP). Bricks prod login if wrong.
- Multi-step refactors touching >3 tables or >1 schema.

**Moderate signals — branch if convenient:**
- Adding a new table or column (additive).
- Email templates, AI gateway config, cron schedule changes.

**Skip the branch:**
- Row-data-only changes (insert/update). Branching is about schema, not data.
- Client-side fixes that don't touch the backend.
- Edge-function logic-only changes covered by unit tests.
- Anything `git revert` handles faster.

## Mode selection

| Mode | When |
|------|------|
| `full` (default) | Need realistic data — RLS testing with real rows, query plan tuning, large-table migrations. |
| `schema-only` | Synthetic seed rows are enough. Faster to create. User-data tables (`auth.users`, `storage.objects`, …) start empty. |

Mode is **fixed at create time** — `branch reset` uses the original dump. Need a different mode → delete + recreate.

## Lifecycle commands

### `branch create <name> [--mode full|schema-only] [--no-switch]`

Creates a branch from the linked parent and auto-switches the directory's context to it (unless `--no-switch`). Provisioning takes 30–120 s for small DBs, longer for large.

`<name>`: 1–64 chars, `[a-zA-Z0-9-]`, must start with letter/digit, unique per parent.

After creation, **re-source your dev server's `.env`** — `INSFORGE_URL` / `INSFORGE_ANON_KEY` change with the switch.

### `branch list`

Lists active branches of the parent (or, when on a branch, that branch's siblings). The leading column shows `*` for the branch the directory is currently switched onto.

| State | Meaning |
|-------|---------|
| `creating` | Provisioning EC2 + restoring pg_dump (30–120 s). |
| `ready` | Usable — can be switched, modified, merged, or reset. |
| `merging` | Merge in progress (usually < 30 s). |
| `merged` | Last merge succeeded. Dormant — `branch reset` rewinds to T0 and flips back to `ready` so the same slot can be reused. |
| `resetting` | `branch reset` is restoring the T0 dump in place. |
| `deleted` | Soft-delete tombstone (filtered from `list`). |

### `branch switch <name>` / `--parent`

Repoints `.insforge/project.json` at the branch (or back at the original parent). Refuses if the target branch isn't `ready`.

> **Critical:** the dev server's `.env` is **not** updated by `switch`. The SDK reads `INSFORGE_URL` / `INSFORGE_ANON_KEY` from `.env`, so without re-sourcing, the SDK silently keeps hitting the previous backend. This is the #1 source of "I switched but my changes aren't showing up."

The first hop off the parent backs up `.insforge/project.json` to `.insforge/project.parent.json`. Subsequent branch ↔ branch switches don't touch the backup — `--parent` always returns to the original.

### `branch delete <name> [-y]`

Deletes a branch and reclaims its EC2. Auto-`switch --parent` if the directory is currently on the deleted branch. **Irreversible** — branch data is lost. Already-merged branches: deletion still works (the merge has already landed on parent).

## Reset vs. delete + recreate

| Want to… | Reach for |
|----------|-----------|
| Rerun the experiment from a clean T0, keep the same `API_KEY` / URL so dev-server config is unchanged | `branch reset` |
| A different `--mode` (mode is fixed at create time) | delete + create |
| A fresh `appkey` / API key so callers can't talk to the old branch | delete + create |
| Re-merge a branch already in `merged` with new changes layered on T0 | `branch reset` (re-opens the slot), make new changes, `branch merge` again |

See [branch-reset](branch-reset.md) for what reset does and does not touch.

## Failure modes

| Error | Meaning | Fix |
|-------|---------|-----|
| `branch.quota_exceeded` | Per-org cap (5 parents) or per-parent cap (3 branches) reached | Delete an old branch first |
| `branch.parent_not_branchable` | Parent is itself a branch / not active / pre-2.x | Use a top-level 2.x project |
| `branch.name_conflict` | Branch name already exists on this parent | Pick a different name |
| `branch.not_found` | No branch with that name on the parent | Check `branch list` |
| `branch.busy` | Branch is `creating` / `merging` / `resetting` | Wait for the in-flight op |
| `branch.not_ready` | Branch isn't in `ready` state for this op | Wait or check state |

## Limits

- Per-org: max 5 parent projects with active branches (configurable).
- Per-parent: max 3 active branches (configurable).
- Branches do not nest (no branch-of-a-branch).
- Branches do not auto-resume when the parent resumes — resume manually.
- Branches are deleted (cascade) when the parent project is deleted.

## See also

- [branch-merge](branch-merge.md) — merging a branch back to parent (dry-run, conflict resolution, what gets applied)
- [branch-reset](branch-reset.md) — rewinding a branch to T0 (recovery / re-merge)
