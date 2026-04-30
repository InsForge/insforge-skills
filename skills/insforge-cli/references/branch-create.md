# npx @insforge/cli branch create

Create a branch project from the currently linked parent project.

## Syntax

```bash
npx @insforge/cli branch create <name> [options]
```

## Arguments

| Arg | Description |
|-----|-------------|
| `<name>` | Branch name. 1–64 chars, `[a-zA-Z0-9-]`, must start with letter/digit. Unique per parent. |

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `--mode <full\|schema-only>` | `full` | `full` copies parent's data; `schema-only` skips row data and starts user tables empty (auth.users, storage.objects, etc.). |
| `--no-switch` | (off) | Do not auto-switch the directory context to the new branch after creation. By default, success runs `branch switch <name>`. |

Inherits the global `--json` and `--api-url <url>` flags from the root command.

## What this does

1. Reads `.insforge/project.json` to determine the parent project.
2. Refuses if the directory is already switched onto a branch (would be a nested branch).
3. POSTs to `/projects/v1/{parentId}/branches { mode, name }`.
4. Cloud-backend captures parent T0 fingerprint, runs `pg_dump` on parent, provisions a fresh EC2 + PG for the branch, and `pg_restore`s the dump. State machine: `creating → ready` (typically 30–120 s for small DBs; up to several minutes for larger).
5. Polls `GET /projects/v1/branches/{branchId}` every 3 s until `branch_state=ready` or 5 min timeout.
6. Unless `--no-switch`, runs `branch switch <name>` so `.insforge/project.json` now points at the branch with fresh `api_key` / `oss_host`.
7. Prints a reminder to re-source the dev server's `.env` (the SDK env vars `INSFORGE_URL` / `INSFORGE_ANON_KEY` change on switch).

## Failure modes

| Error | Meaning | Fix |
|-------|---------|-----|
| `branch.quota_exceeded` | Per-org cap (5 parents) or per-parent cap (3 branches) reached | Delete an old branch first |
| `branch.parent_not_branchable` | Parent is itself a branch / not active / pre-2.x | Use a top-level 2.x project |
| `branch.name_conflict` | Branch with this name already exists on the parent | Pick a different name |

## Example

```bash
$ npx @insforge/cli branch create feat-rls-fix --mode schema-only
✓ Branch 'feat-rls-fix' created (appkey: ab7n5z2-x9p). Provisioning…
  state: creating…
✓ Branch 'feat-rls-fix' is ready.
✓ Switched to branch 'feat-rls-fix'.
⚠ Re-source your dev server env (.env) to pick up the new INSFORGE_URL / ANON_KEY.
```

## See also

- [branch-when-to-use](branch-when-to-use.md) — decision guide
- [branch-switch](branch-switch.md) — context-flip mechanics
