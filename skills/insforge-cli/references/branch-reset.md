# npx @insforge/cli branch reset

Reset a branch's database back to **T0** — the parent's snapshot at the moment the branch was created. Use when the branch is in a bad state and you'd rather start over than untangle it. Cheaper than `branch delete` + `branch create`: same EC2, same `appkey`, same `API_KEY` / `ANON_KEY` — only the database content is rewound.

## Syntax

```bash
npx @insforge/cli branch reset <name> [-y]
```

| Option | Description |
|--------|-------------|
| `-y, --yes` | Skip the confirmation prompt. |

Inherits the global `--json` and `--api-url` flags.

## What this does

1. Resolves `<name>` to a branch via the parent's branch list (works whether the directory is on the parent or on a sibling branch).
2. Rejects the call unless `branch_state` is `ready` or `merged`. `creating` / `merging` / `resetting` / `deleted` all return 409 (`BRANCH_BUSY` or `BRANCH_NOT_READY`).
3. Confirms (unless `--yes` or `--json`).
4. `POST /projects/v1/branches/{branchId}/reset` — backend transitions `branch_state` to `resetting` and enqueues `pg_restore` against `branch_metadata.parent_t0.source_backup_s3_key` (the dump captured at branch creation).
5. For `schema-only` branches, the backend re-runs `schema-only-truncate.sql` after the restore — same finalize chain as `branch create --mode schema-only`.
6. CLI polls `GET /branches/{branchId}` every 3 s for up to 5 min until `branch_state` returns to a terminal state.

## Final state

Reset **always lands at `ready`**, even if the branch entered reset from `merged`. A merged branch reset to T0 becomes usable again — you can edit it and merge it a second time without recreating the EC2.

If the SSM restore fails halfway, the backend rolls `branch_state` back to the entry state (`ready` or `merged`). The CLI surfaces this via the polled state. **However**, `pg_restore` is destructive once it starts — the database may be in an indeterminate state between T0 and pre-reset. If reset fails, retry it, or fall back to a project backup (paid plans) instead of trying to recover the in-flight state.

## What reset does NOT touch

- The branch's EC2 instance — same machine, same `appkey`, same URLs.
- `API_KEY` / `ANON_KEY` / `JWT_SECRET` — unchanged. SDK / `.env` keep working without re-sourcing.
- The parent project — completely untouched. Reset is local to the branch.
- Edge functions deployed to the branch's `functions.definitions` table — these are part of the DB and **are** rolled back to T0 along with everything else. Redeploy any branch-specific functions after reset if you need them again.
- Vercel deployments and Fly.io compute services — these live outside the database, so reset won't roll them back. Redeploy manually if their behavior depends on the schema you just rewound.
- `branch_metadata.parent_t0` and `branch_created_at` — not modified. T0 is the same anchor as before.

## Quota

Reset does **not** count against the per-org or per-parent branch quota — quota is computed from the active branch count, and reset doesn't change it.

## Concurrency

Same `BUSY` set as merge: only one of `creating` / `merging` / `resetting` can be in flight per branch. The backend enforces this; the CLI surfaces 409s as `BRANCH_BUSY`.

## Failure modes

| Error | Meaning | Fix |
|-------|---------|-----|
| `branch.not_found` | No branch with that name on the parent | Check `branch list` |
| `branch.not_ready` | Branch is in `creating` / `merging` / `resetting` / `deleted` | Wait for the in-flight op, then retry |
| Reset polled out at 5 min | SSM job is still running on a large DB | Re-run `branch list` periodically; the backend will eventually settle the state |
| Branch lands at entry state instead of `ready` | The async restore rolled back. PG content is indeterminate | Retry reset, or restore from a project backup |

## When to reach for reset vs. delete + recreate

| Want to… | Reach for |
|----------|-----------|
| Rerun the same experiment from a clean T0, keep the same `API_KEY` / URL so dev-server config is unchanged | `branch reset` |
| Need a different `--mode` (e.g. switch from `schema-only` to `full`) | `branch delete` + `branch create` (mode is fixed at create time and reset uses the original dump) |
| Want a fresh `appkey` / API key so callers definitely can't talk to the old branch | `branch delete` + `branch create` |
| Re-merging a branch that was already merged, with new changes layered on T0 | `branch reset` from the `merged` state, then make the new changes, then `branch merge` again |

## Example

```bash
$ npx @insforge/cli branch reset feat-rls-fix
? Reset branch 'feat-rls-fix' back to T0? This wipes all schema/data/policy/function/migration changes made on the branch since creation. › yes
✓ Reset enqueued for branch 'feat-rls-fix'. Restoring T0…
  state: resetting…
✓ Branch 'feat-rls-fix' is back to T0 and ready.
⚠ Reminder: edge functions, website, and compute aren’t touched by reset; redeploy if needed.
```

Resetting a previously-merged branch:

```bash
$ npx @insforge/cli branch reset feat-rls-fix
? Reset branch 'feat-rls-fix' back to T0? … (Branch is currently merged — reset will reopen it for further work.) › yes
✓ Reset enqueued for branch 'feat-rls-fix'. Restoring T0…
✓ Branch 'feat-rls-fix' is back to T0 and ready.
```

## See also

- [branch-when-to-use](branch-when-to-use.md) — when branching pays off
- [branch-create](branch-create.md), [branch-merge](branch-merge.md), [branch-delete](branch-delete.md)
