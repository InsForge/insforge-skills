# npx @insforge/cli branch delete

Delete a branch project and reclaim its EC2 + S3 resources.

## Syntax

```bash
npx @insforge/cli branch delete <name> [-y]
```

| Option | Description |
|--------|-------------|
| `-y, --yes` | Skip the confirmation prompt. |

Inherits `--json`.

## What this does

1. Resolves `<name>` to a branch via the parent's branch list.
2. Confirms (`clack` prompt) unless `--yes` or `--json`.
3. `DELETE /projects/v1/branches/{branchId}` — cloud-backend marks `branch_state = 'deleted'`, enqueues EC2 termination, and removes the project row when termination acks.
4. **If the directory is currently switched onto the deleted branch**, automatically runs `branch switch --parent` so subsequent commands don't operate on a dead instance.

## Failure modes

| Error | Meaning |
|-------|---------|
| `branch.not_found` | No branch with that name on the parent. |
| `branch.busy` | Branch is currently `creating` or `merging`. Wait, then retry. |

## Example

```bash
$ npx @insforge/cli branch delete feat-rls-fix
? Delete branch 'feat-rls-fix'? This terminates its EC2 instance. › yes
✓ Branch 'feat-rls-fix' deletion enqueued.
✓ Switched back to parent.
```

## Lifecycle notes

- Deletion is **irreversible** — there is no undelete. The data on the branch (whatever you tested or modified) is lost.
- Daily backups (paid plans) of the parent are unaffected — they remain.
- Already-merged branches: deletion still works the same. The merge has already landed on parent.
