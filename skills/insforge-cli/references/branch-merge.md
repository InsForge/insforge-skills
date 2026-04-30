# npx @insforge/cli branch merge

Merge a branch's schema, config, and data-level changes back into the parent.

## Syntax

```bash
npx @insforge/cli branch merge <name> [options]
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--dry-run` | off | Compute the diff and print rendered SQL; do not apply. |
| `-y, --yes` | off | Skip the "are you sure" confirmation when applying. |
| `--save-sql <path>` | — | Write the rendered SQL preview to a file (works with or without `--dry-run`). |

Inherits `--json` and `--api-url`.

## Always run `--dry-run` first

The dry run prints a migration-style SQL preview, organized by section:

```sql
-- Generated 2026-04-29T12:00:00Z
BEGIN;

-- ===== MIGRATION =====
-- [MIGRATION] migration system.060 (add)
-- Migration 060: add_visibility_to_posts
ALTER TABLE public.posts ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
INSERT INTO "system"."custom_migrations" ("version", "name", "statements", "created_at") VALUES (...)
  ON CONFLICT ("version") DO UPDATE SET ...;

-- ===== DATA =====
-- [DATA] config_row email.templates (modify)
INSERT INTO "email"."templates" ("template_type", "subject", ...) VALUES (...)
  ON CONFLICT ("template_type") DO UPDATE SET "subject" = EXCLUDED."subject", ...;

COMMIT;
```

Read it. If anything looks wrong, do **not** run merge without `--dry-run`.

## Merge order (matters)

The cloud-backend orders the SQL such that:

1. **Migrations** (DDL via `system.custom_migrations.statements[]`) run first, so any newly added tables/columns exist when data lands.
2. **Config rows** (UPSERTs into the 13 mergeable matrix tables) and **edge functions** (UPSERTs into `functions.definitions`) run second.

The whole script is wrapped in `BEGIN; … COMMIT;` — any failure rolls the parent's PG back to the pre-merge state, and `branch_state` flips from `merging` back to `ready`.

## Conflicts

If the cloud-backend reports `branch.merge_conflict` (HTTP 409), the
preview SQL is prefixed with:

```sql
-- ⚠️ MERGE BLOCKED: 1 conflict(s) detected. Resolve before applying.
--
-- [CONFLICT] table public.users
--   parent_t0_hash:  <hash>
--   parent_now_hash: <different hash>
--   branch_now_hash: <different hash>
--   hint: Both parent and branch modified this object after branch creation. Resolve manually.
```

The CLI exits with code **2** (distinct from the generic error exit 1).

### Resolution steps

1. Inspect parent's current state and branch's current state for the conflicted object (e.g. `npx @insforge/cli db tables` / `db policies`).
2. Decide which version to keep:
   - **Keep parent**: revert the branch's change (drop the column on branch, etc.) and run `branch merge --dry-run` again.
   - **Keep branch**: forcibly apply the branch's version on parent (manually), then merge — auto-merge will see no conflict because parent_now will match branch_now.
   - **Hand-merge**: write a manual migration that combines both intents, apply it on the branch, then merge.
3. Re-run `branch merge <name> --dry-run` to confirm zero conflicts, then run without `--dry-run`.

## What gets auto-applied

| Diff type | Auto-applied? |
|-----------|---------------|
| `migration` (entries in `system.custom_migrations`) | ✅ — statements[] replayed verbatim on parent |
| `config_row` (any of the 13 mergeable tables) | ✅ — UPSERT keyed on the table's logical key, with matrix exclude rules |
| `edge_function` (`functions.definitions`) | ✅ — UPSERT keyed on `slug` |
| `table` / `policy` / `function` DDL diffs *without* a corresponding migration | ❌ — recorded but skipped. Capture the change in a migration on branch instead. |
| Row deletions (branch removed a row that parent still has) | ❌ — too risky to auto-propagate; do it manually if intended. |

Skipped items appear in the `unsupported` log line on apply.

## Post-merge actions

The branch enters `merged` state (read-only). The parent has the new schema/config. **You still need to redeploy** anything that runs outside the merge:

- `npx @insforge/cli functions deploy <slug>` for each modified edge function
- `npx @insforge/cli deployments deploy` if the website consumes the schema
- `npx @insforge/cli compute update` for fly.io services

The merge does **not** trigger these.

## Example

```bash
$ npx @insforge/cli branch merge feat-rls-fix --dry-run --save-sql /tmp/diff.sql
BEGIN;
…
COMMIT;
2 added, 1 modified, 0 conflict(s).

$ cat /tmp/diff.sql   # review the SQL with a human eye

$ npx @insforge/cli branch merge feat-rls-fix
2 added, 1 modified, 0 conflict(s).
? Apply this merge to parent project 'my-app'? › yes
✓ Merged. Branch 'feat-rls-fix' is now in 'merged' state.
⚠ Reminder: redeploy edge functions, website, and compute as needed.
```

## See also

- [branch-when-to-use](branch-when-to-use.md)
- [branch-create](branch-create.md), [branch-switch](branch-switch.md), [branch-delete](branch-delete.md)
