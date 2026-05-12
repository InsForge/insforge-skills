# npx @insforge/cli config

Deep reference for `config export | plan | apply`. The SKILL.md Configuration section has the principles and rules; this file has output shapes and the error table.

**Scope today:** only `auth.allowed_redirect_urls`. Other auth knobs are dashboard-only.

## Commands

```bash
npx @insforge/cli config export [--out insforge.toml] [--force]
npx @insforge/cli config plan   [--file insforge.toml]
npx @insforge/cli config apply  [--file insforge.toml] [--dry-run] [--auto-approve]
```

## File location

`insforge.toml` lives at the project root, alongside `package.json` and `.insforge/project.json`. Safe to commit to git.

## Output shapes (`--json` mode)

`config export`:
```json
{
  "written": "/abs/path/to/insforge.toml",
  "config": { "auth": { "allowed_redirect_urls": ["https://app.com"] } },
  "skipped": []
}
```

`config plan`:
```json
{
  "changes": [
    {
      "section": "auth",
      "op": "modify",
      "key": "allowed_redirect_urls",
      "from": ["https://app.com"],
      "to": ["https://app.com", "https://staging.app.com"]
    }
  ],
  "summary": { "add": 0, "modify": 1, "remove": 0, "kept": 0 },
  "skipped": []
}
```

`config apply`:
```json
{
  "plan": { /* same shape as plan output */ },
  "applied": [ /* DiffChange objects that were applied */ ],
  "skipped": [
    {
      "key": "auth.allowed_redirect_urls",
      "reason": "your backend doesn't expose auth.allowed_redirect_urls — upgrade the project to apply this section"
    }
  ]
}
```

## Common mistakes

| Mistake | What to do instead |
|---|---|
| Calling `PUT /api/auth/config` directly to change `allowedRedirectUrls` | Use `config apply` — it's version-aware; direct PUTs can silently drop on older backends |
| Treating `skipped[]` as an error to retry | It's intentional; surface verbatim with the upgrade ask and stop |
| Running `config apply` in `--json` mode without `--yes` | Add `-y`/`--yes` (global) or `--auto-approve` (subcommand alias — same effect); otherwise fails fast with `CONFIRMATION_REQUIRED` |
| Re-running with `--force` to "fix" a skip | `--force` is only for `export`'s overwrite gate; skips need a backend upgrade |
| Setting password policy / OAuth providers / SMTP via TOML | Out of scope today — dashboard-only |

## Related

- `npx @insforge/cli metadata` — read-only view of all backend config slices
- **insforge** SDK skill `auth/sdk-integration.md` — how SDK code reads auth config at runtime
