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
| `ready` | Usable. Can be switched, modified, merged, or reset. |
| `merging` | Merge in progress (rare; usually < 30 s). |
| `merged` | Last merge succeeded. The branch is **dormant**, not destroyed — `branch reset` will rewind it to T0 and flip it back to `ready` so the same slot can be reused. |
| `resetting` | `branch reset` is restoring the T0 dump in place. Lands back at `ready` on success, or rolls back to the entry state (`ready` or `merged`) on failure. |
| `conflicted` | Reserved for future use. **Not produced by v1** — a conflicted merge leaves the branch in `ready` and surfaces the conflict via the merge response. The DB enum carries the value (added in migration 058) so a future runtime can promote merge to write it without a new migration. |
| `deleted` | Soft-delete tombstone. Listing already filters these out; you'll only see this in raw `--json` against `GET /branches/:id`. |
