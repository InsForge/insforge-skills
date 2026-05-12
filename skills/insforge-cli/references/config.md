# npx @insforge/cli config

Manage `auth.allowed_redirect_urls` declaratively via `insforge.toml`. The path for "settings page" knobs a user would edit on a dashboard form rather than write code for.

**Scope today:** only `auth.allowed_redirect_urls`. Other auth knobs (password policy, OAuth providers, SMTP, custom subdomain) will land in TOML later — for now, manage those via the dashboard.

## Commands

```bash
npx @insforge/cli config export [--out insforge.toml] [--force]
npx @insforge/cli config plan   [--file insforge.toml]
npx @insforge/cli config apply  [--file insforge.toml] [--dry-run] [--auto-approve]
```

| Command | What it does |
|---|---|
| `export` | Read live config from the backend, write to `insforge.toml`. Sections the backend doesn't expose are omitted. |
| `plan` | Diff the TOML against live state. Shows which changes will apply vs. be skipped on the connected backend. Read-only. |
| `apply` | Apply the TOML. Per-change capability gate — supported changes apply, unsupported go to `skipped[]` with an upgrade message; **no PUT issued for unsupported sections**. |

## Why this exists

Per-project InsForge backends evolve independently. A user's CLI is always npm @latest; their project's backend may be on any prior release. Without a probe:

- A new CLI sends a PUT for a field an old backend doesn't accept.
- The PUT might 400, 200-with-silent-drop, or 500 depending on the server's permissiveness.
- The user thinks the change applied. It didn't.

`config apply` reads `/api/metadata` first, checks each TOML field for presence in the response, and **only sends PUT requests for fields the backend exposes**. Unsupported sections become a clean `skipped[]` entry, not a silently-dropped write.

## File location

`insforge.toml` lives at the **project root**, alongside `package.json` and `.insforge/project.json`. Same directory the user runs the CLI from. Safe to commit to git.

## Typical workflow

```bash
# 1. Pull current config
npx @insforge/cli --json config export

# 2. Edit insforge.toml — add/remove [auth] allowed_redirect_urls entries

# 3. Preview what apply would do
npx @insforge/cli --json config plan

# 4. Apply (--yes for non-interactive)
npx @insforge/cli --json --yes config apply
```

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

## Handling `skipped[]`

When `apply` returns `skipped: [...]`, the user's project backend doesn't yet support that section. **Surface this to the user verbatim.** Do not retry. Do not bypass with `curl` or direct API calls — those will silently drop on the same older backend. Sample agent response:

> "I tried to set `auth.allowed_redirect_urls` but your project's backend is on an older version that doesn't support this yet. Upgrade your backend (or contact your InsForge admin) and re-run `npx @insforge/cli config apply`."

Partial apply is intentional: supported sections still apply, unsupported ones surface cleanly. Never abort the whole batch when one section is unsupported.

## TOML is for knobs, never programs

| Belongs in `insforge.toml` | Does NOT belong in `insforge.toml` |
|---|---|
| Booleans, strings, arrays | SQL DDL — use `db migrations` |
| `[auth] allowed_redirect_urls = [...]` | Function source — use `functions deploy` |
| (future knobs as they land) | Container images — use `compute deploy` |
|  | Frontend builds — use `deployments deploy` |

If a value would naturally live in its own file (a `.sql`, `.ts`, `Dockerfile`, etc.), it doesn't go in TOML.

## Non-interactive (`--json`) consent

`config apply` in `--json` mode requires explicit consent — either `--auto-approve` or the global `-y/--yes` flag. Without one of those it fails fast with `CONFIRMATION_REQUIRED` rather than hanging on a TTY prompt. Pattern for scripts:

```bash
npx @insforge/cli --json --yes config apply
```

## Common mistakes

| Mistake | What to do instead |
|---|---|
| Calling `PUT /api/auth/config` directly to change `allowedRedirectUrls` | Use `config apply` — it's version-aware; direct PUTs can silently drop on older backends |
| Putting SQL DDL in `insforge.toml` | SQL goes in `migrations/`, applied via `db migrations up` |
| Treating `skipped[]` as an error to retry | It's intentional; surface to the user with the upgrade message and stop |
| Running `config apply` in `--json` mode without `--yes` | Add `--yes` (or `--auto-approve`); otherwise the command fails fast |
| Re-running with `--force` to "fix" a skip | `--force` is only for `export`'s overwrite gate. Skips need a backend upgrade. |
| Trying to set password policy / OAuth providers / SMTP via TOML today | Out of scope today; use the dashboard |

## Coming soon

Additional sections will land in TOML over time — password policy, OAuth providers, SMTP, custom subdomain. The same `export → plan → apply` flow applies; capability gating means you can adopt new sections as the backend exposes them, with no CLI upgrade required to keep working against an older backend.

## Related

- `npx @insforge/cli metadata` — read-only view of all backend config slices
- See **insforge** SDK skill `auth/sdk-integration.md` for how SDK code reads auth config at runtime
