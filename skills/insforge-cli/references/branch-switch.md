# npx @insforge/cli branch switch

Repoint this directory's `.insforge/project.json` at a branch (or back at the parent).

## Syntax

```bash
npx @insforge/cli branch switch <name>      # switch to a branch by name
npx @insforge/cli branch switch --parent    # switch back to the original parent
```

## Arguments / Options

| Arg / Option | Description |
|--------------|-------------|
| `<name>` | Branch name in the parent's branch list. |
| `--parent` | Switch back to the parent project (the one this directory was originally linked to before any branch switches). |

## What this does

### Switching to a branch

1. Resolves `<name>` to a branch row via the parent's branch list.
2. Refuses if the branch is not in `ready` state (creating / merging / merged / etc.).
3. **First hop off the parent**: copies `.insforge/project.json` to `.insforge/project.parent.json` as backup. Subsequent branch ↔ branch switches do **not** overwrite this — it always represents the original parent.
4. Fetches the branch's API key, builds `oss_host = {appkey}.{region}.insforge.app`, writes a fresh `project.json` with `branched_from: { project_id, project_name }` of the original parent.

### Switching back with `--parent`

1. Verifies `.insforge/project.parent.json` exists.
2. Restores it as `project.json`. Removes the backup file.
3. Fails clearly if the backup is absent (run `insforge link --project-id <parent>` to re-link manually).

## Why context-switching matters

The branch has **fresh** `API_KEY` and `ANON_KEY` (different from parent), but **shares** `JWT_SECRET` (so existing user JWTs continue to authenticate). After `branch switch`:

- `.insforge/project.json` has new `api_key` / `oss_host`
- The SDK in your app reads `INSFORGE_URL` / `INSFORGE_ANON_KEY` from `.env`
- Your dev server's `.env` is **not** updated — it still has parent's keys
- **You must restart the dev server** (or re-source `.env`) for the SDK to start talking to the branch backend

If you don't, the SDK silently keeps hitting parent's instance (since the URLs are valid). This is the #1 source of "I switched to a branch but my changes aren't showing up" confusion.

## Example

```bash
# Switch to a branch
$ npx @insforge/cli branch switch feat-rls-fix
✓ Switched to branch 'feat-rls-fix'.

# (Restart your dev server here so the SDK picks up the new INSFORGE_URL.)

# Later, switch back to parent
$ npx @insforge/cli branch switch --parent
✓ Switched back to parent.
```

## See also

- [branch-create](branch-create.md) — auto-switches by default
- [branch-delete](branch-delete.md) — auto-`switch --parent` if deleting the currently-switched branch
