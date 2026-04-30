# npx @insforge/cli branch list

List active branches of the currently linked parent project.

## Syntax

```bash
npx @insforge/cli branch list
```

Inherits the global `--json` flag.

## What this does

`GET /projects/v1/{parentId}/branches`. Result excludes branches with
`branch_state = 'deleted'`. When the directory is itself switched onto
a branch, the listing is the **siblings of the parent** (so you see all
branches of the same parent regardless of current context).

## Output

Pretty (default): a 4-column table. Leftmost column shows `*` next to
the branch the directory is currently switched onto.

```
┌───┬───────────────┬───────┬─────────────┬──────────────────────────┐
│   │ Name          │ State │ Mode        │ Created                  │
├───┼───────────────┼───────┼─────────────┼──────────────────────────┤
│ * │ feat-rls-fix  │ ready │ schema-only │ 2026-04-29 12:01:23      │
│   │ experiment-A  │ ready │ full        │ 2026-04-29 11:42:08      │
└───┴───────────────┴───────┴─────────────┴──────────────────────────┘
```

`--json` output: `{ "data": [Branch...] }` — the cloud-backend's raw
shape.

## Branch states

| State | Meaning |
|-------|---------|
| `creating` | Provisioning EC2 + restoring pg_dump. Usually 30–120 s. |
| `ready` | Usable. Can be switched, modified, merged. |
| `merging` | Merge in progress (rare; usually < 30 s). |
| `merged` | Merge succeeded. Branch is read-only post-merge. |
| `conflicted` | Last merge attempt hit a conflict — branch is back to a usable state, retry merge after resolving. |
