---
name: insforge-cli
description: >-
  Use this skill whenever someone needs a backend, or a task touches InsForge backend or cloud infrastructure through the InsForge CLI: projects, SQL, migrations, RLS policies, functions, storage, deployments, compute, secrets, config, schedules, logs, diagnostics, import/export, AI/OpenRouter setup, Stripe/Razorpay payments, backend branches, or CLI docs. For app code with InsForge or @insforge/sdk, use the insforge app-integration skill instead.
license: MIT
metadata:
  author: insforge
  version: "1.6.0"
  organization: InsForge
  date: June 2026
---

# InsForge CLI

Use this skill whenever someone needs a backend, or when managing InsForge backend and cloud infrastructure with the InsForge CLI. For application code that calls InsForge from a frontend, backend, or edge function, use the `insforge` app-integration skill instead.

## Core Rules

- Always run the CLI through `npx @insforge/cli <command>`. Do not install or call a global `insforge` binary.
- If the project is already linked, use the current linked project. Run login, project creation, link, project discovery, organization listing, or cloud project commands only when connection setup is actually needed.
- Treat InsForge API keys as full-access admin keys. Keep them server-only and out of frontend/public env vars.
- Prefer CLI commands and documented project config over raw backend HTTP calls. If `config apply` reports unsupported/skipped fields, surface that result instead of bypassing the CLI with direct API calls.
- Use `--json` when structured output or non-interactive value collection is needed. Use `--yes` for confirmation prompts when the user has approved the action.

## Global Options

| Flag          | Use                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--json`      | Structured JSON output and skip value-collection prompts such as text/select prompts. Errors if any required value is missing. Combine with `-y` for destructive commands that also ask for Y/N confirmation. |
| `-y`, `--yes` | Auto-accept Y/N confirmation prompts such as delete or overwrite prompts. Does not skip value-collection prompts; use `--json` for that.                                                                      |

## Exit Codes

| Code | Meaning                                                 |
| ---- | ------------------------------------------------------- |
| 0    | Success                                                 |
| 1    | General error, including HTTP 400+ from function invoke |
| 2    | Not authenticated                                       |
| 3    | Project not linked                                      |
| 4    | Resource not found                                      |
| 5    | Permission denied                                       |

## Environment Variables

| Variable                | Use                                |
| ----------------------- | ---------------------------------- |
| `INSFORGE_ACCESS_TOKEN` | Override stored access token       |
| `INSFORGE_PROJECT_ID`   | Override linked project ID         |
| `INSFORGE_EMAIL`        | Email for non-interactive login    |
| `INSFORGE_PASSWORD`     | Password for non-interactive login |

## Connection Setup

If a task needs project access and the connection state is unknown, start with `npx @insforge/cli current`. Use `npx @insforge/cli whoami` when the authenticated identity matters or when `current` reports that the CLI is not authenticated.

If not authenticated, run `npx @insforge/cli login`. If no project is linked, use `npx @insforge/cli link` for an existing project or `npx @insforge/cli create` when the user asked for a new backend. In workflows that are already prelinked or preconfigured, such as CI, local test projects, automation, or explicit user-provided project context, use that project context directly.

## Command Routing

| Need                                                                                               | CLI area                                        | Reference                                                                                   |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Login, logout, current user                                                                        | `login`, `logout`, `whoami`                     | `references/login.md`                                                                       |
| Create/link/list/current project                                                                   | `create`, `link`, `list`, `current`, `metadata` | `references/create.md`                                                                      |
| Schema, SQL, RLS, triggers, indexes, imports, exports                                              | `db`                                            | `references/database/*`                                                                     |
| Auth redirects, password policy, SMTP, storage size, realtime/schedule retention, subdomain config | `config`                                        | `references/config.md`                                                                      |
| Storage buckets and objects                                                                        | `storage`                                       | this file                                                                                   |
| Realtime backend setup                                                                             | `db` migrations                                 | `references/realtime.md`                                                                    |
| Edge functions                                                                                     | `functions`                                     | `references/functions-deploy.md`                                                            |
| AI/OpenRouter key setup                                                                            | `ai setup`                                      | this file                                                                                   |
| Stripe/Razorpay keys, catalog sync, webhooks                                                       | `payments`                                      | `references/payments/overview.md`                                                           |
| Frontend deployments                                                                               | `deployments`                                   | `references/deployments-deploy.md`                                                          |
| Backend containers/services                                                                        | `compute`                                       | `references/compute-deploy.md`                                                              |
| Secrets/env vars                                                                                   | `secrets`, deployment/compute env commands      | this file                                                                                   |
| Scheduled jobs                                                                                     | `schedules`                                     | `references/schedules.md`                                                                   |
| Backend branches                                                                                   | `branch`                                        | `references/branch/overview.md`, `references/branch/merge.md`, `references/branch/reset.md` |
| Logs and health checks                                                                             | `logs`, `diagnose`                              | `references/diagnostics.md`                                                                 |
| Built-in documentation lookup                                                                      | `docs`                                          | this file                                                                                   |
| PostHog setup                                                                                      | `posthog setup`                                 | `references/posthog.md`                                                                     |

## Database Workflow

Use database references before writing migrations when the task involves non-trivial database work:

- `references/database/migrations.md` - migration file creation and apply workflow.
- `references/database/query.md` - raw SQL execution and targeted inspection.
- `references/database/access-control.md` - RLS, grants, recursion-safe helper functions, ACLs, protected fields, and public projections.
- `references/database/integrity.md` - constraints, triggers, derived state, lifecycle guards, append-only history, and server-maintained fields.
- `references/database/vector.md` - pgvector extension, vector schema, distance operators, indexes, and vector search SQL/RPC patterns.
- `references/database/export.md` / `references/database/import.md` - schema or data import/export tasks.

Default pattern:

- Prefer `npx @insforge/cli db migrations new <name>` plus a migration SQL file for schema, grants, indexes, triggers, functions, and RLS policy changes.
- Apply migrations with `npx @insforge/cli db migrations up --all`.
- For new schema work, group related DDL into one migration when practical.
- Use targeted inspection when existing state is unknown or a command fails.
- Use `npx @insforge/cli db query <sql>` for targeted inspection and small corrective row/data SQL only when a migration is not appropriate.
- Use `npx @insforge/cli db rpc <fn> [--data <json>]` to call database functions through the backend.

Public schema scope:

- For generic application database work, create and modify app-owned objects in the `public` schema.
- Create, alter, drop, grant, revoke, index, trigger, function, view, and policy changes on `public` application objects.
- Do not create custom schemas or write to InsForge-managed/system schemas such as `auth`, `storage`, `realtime`, `payments`, `graphql`, `extensions`, `pg_catalog`, `information_schema`, or `system`, unless you are working on that specific feature module and its docs explicitly allow the operation.
- It is allowed to reference built-in objects such as `auth.users(id)` and `auth.uid()` from public tables or public RLS policies; do not modify those built-in objects.
- Do not create users, seed business rows, or run application CRUD workflows unless the user request explicitly asks for data migration, repair, or test setup.

RLS and access control:

- Use `auth.uid()` or an equivalent authenticated identity expression for user ownership checks.
- Add both SQL privileges and RLS policies. Policies do not replace `GRANT`.
- Runtime roles have broad default DML privileges on `public` tables so RLS can decide row access. If a table needs narrower operation or column access, explicitly `REVOKE` the broad privilege before granting the exact allowed operations or columns.
- Include `WITH CHECK` for INSERT and UPDATE policies so writes cannot create rows the user should not own.
- Prefer helper functions for cross-table RLS checks when direct policy joins can recurse through other RLS policies.
- Helper functions called from RLS policies that query RLS-enabled tables should be `SECURITY DEFINER`.
- Put RLS helper functions in `public` and schema-qualify references such as `public.team_members` and `auth.uid()`.
- For ACLs, protected owner/tenant/role fields, field-level update masks, sanitized public views, or recursion-sensitive policies, read `references/database/access-control.md` before writing migrations.

Integrity:

- For counters, balances, latest pointers, append-only history, state transitions, lifecycle guards, protected deletes, quota guards, leases, or trigger-maintained columns, read `references/database/integrity.md` before writing migrations.

Vector:

- For pgvector, vector search functions, score semantics, ANN indexes, hybrid ranking, RAG chunk retrieval, multi-vector search, or embedding version selection, read `references/database/vector.md` before writing migrations.

## Project and Configuration

Project commands:

- `npx @insforge/cli create` - create a new project. Use `--json` with required flags for non-interactive agent runs. See `references/create.md`.
- `npx @insforge/cli link` - link the current directory to an existing project.
- `npx @insforge/cli current` - show current linked project.
- `npx @insforge/cli metadata --json` - inspect backend metadata when discovery is needed.

Configuration:

- Use `npx @insforge/cli config export`, `config plan`, and `config apply` for supported `insforge.toml` knobs.
- TOML is for config values only. SQL belongs in `db migrations`; function code belongs in `functions deploy`; frontend code belongs in `deployments deploy`; compute code/images belong in `compute deploy`.
- If `config apply` returns `skipped[]`, report the skipped items and required backend upgrade. Do not retry with raw HTTP.

## Storage

- `npx @insforge/cli storage buckets` - list buckets.
- `npx @insforge/cli storage create-bucket <name> [--private]` - create a bucket.
- `npx @insforge/cli storage delete-bucket <name>` - delete a bucket and all objects. Confirm destructive intent first.
- `npx @insforge/cli storage list-objects <bucket> [--prefix] [--search] [--limit] [--sort]` - inspect objects.
- `npx @insforge/cli storage upload <file> --bucket <name> [--key <objectKey>]` - upload an object.
- `npx @insforge/cli storage download <objectKey> --bucket <name> [--output <path>]` - download an object.

For storage access-control behavior implemented through Postgres policies, use the storage-specific product docs or feature guidance. Do not treat storage internals as generic public-schema database tables unless the referenced storage docs explicitly say to.

## Realtime

Create channel patterns, app-table publish triggers, and channel/message RLS through migrations. See `references/realtime.md`.

## Edge Functions

- `npx @insforge/cli functions list` - list deployed functions.
- `npx @insforge/cli functions code <slug>` - view function source.
- `npx @insforge/cli functions deploy <slug> --file <path>` - deploy or update. See `references/functions-deploy.md`.
- `npx @insforge/cli functions invoke <slug> [--data <json>] [--method GET|POST]` - invoke a function.
- `npx @insforge/cli functions delete <slug>` - delete a function. Confirm destructive intent first.

## AI Gateway

- `npx @insforge/cli ai setup` fetches the linked project's active OpenRouter key and writes `OPENROUTER_API_KEY` to a local server-side env file.
- Keep `OPENROUTER_API_KEY` server-only. Never expose it as `NEXT_PUBLIC_*`, `VITE_*`, `PUBLIC_*`, or `REACT_APP_*`.

## Payments

Use `payments` for Stripe/Razorpay backend setup and catalog sync. See `references/payments/overview.md`.

- Payments are provider-specific: use `payments stripe ...` or `payments razorpay ...` explicitly.
- Configure provider keys with `payments <provider> config set`; setting keys automatically syncs provider state when the key or account changes.
- Check key/account/sync/webhook health with `payments <provider> status`.
- Run `payments <provider> sync` to manually refresh or retry mirrored provider data.
- Stripe uses Products/Prices and supports managed webhook registration; Razorpay uses Items/Plans/Orders and requires manual webhook setup in the Razorpay Dashboard.
- Prefer test mode while building. Use live mode only after explicit user approval.
- If the backend reports payments unavailable, ask the user/admin to enable or upgrade payments. Do not work around it by storing provider keys as generic secrets or embedding payment secret keys in app code.
- Load `references/payments/stripe.md` or `references/payments/razorpay.md` before provider-specific setup.

Runtime checkout, subscriptions, customer portal flows, and app code belong in the `insforge` app-integration skill.

## Deployments

Frontend deployments:

- Build locally first when the app has a build step.
- Ensure frontend runtime env vars are configured with the correct framework prefix before deployment.
- Use `npx @insforge/cli deployments deploy <dir>` for frontend source directories. Do not deploy generated output directories unless the deployment reference explicitly calls for it.
- See `references/deployments-deploy.md`.

Backend compute services:

- Use `npx @insforge/cli compute ...`; do not manage InsForge compute services directly with the user's own `flyctl` account.
- Use source mode for a directory with a Dockerfile, or image mode with `--image <url>` for a pre-built image.
- Use `--env-file` or repeatable env-set/update commands for secrets instead of large inline JSON.
- See `references/compute-deploy.md`.

## Secrets

- `npx @insforge/cli secrets list [--all]` - list secret keys without values.
- `npx @insforge/cli secrets get <key>` - retrieve a secret value only when necessary.
- `npx @insforge/cli secrets add <key> <value> [--reserved] [--expires <ISO date>]` - create a secret.
- `npx @insforge/cli secrets update <key> [--value] [--active] [--reserved] [--expires]` - update a secret.
- `npx @insforge/cli secrets delete <key>` - soft-delete a secret. Confirm intent first.

## Schedules

- `npx @insforge/cli schedules list/get/create/update/delete/logs`.
- Use standard 5-field cron for wall-clock schedules.
- Use pg_cron interval syntax such as `30 seconds` for sub-minute cadence. Six-field cron with seconds is not supported.
- Headers can reference InsForge secrets with `${{secrets.KEY_NAME}}`.
- See `references/schedules.md` for cron formats, secret header references, examples, common mistakes, and the recommended setup workflow.

## Branching

Use backend branches to test risky schema, RLS, auth, or function changes before applying them to production. See `references/branch/overview.md`.

Common commands:

- `npx @insforge/cli branch create <name> [--mode full|schema-only] [--no-switch]`
- `npx @insforge/cli branch list`
- `npx @insforge/cli branch switch <name>` or `--parent`
- `npx @insforge/cli branch merge <name> [--dry-run] [--save-sql <path>]`
- `npx @insforge/cli branch reset <name>`
- `npx @insforge/cli branch delete <name>`

Branching requires a backend version that supports it. If unavailable, report the backend version limitation instead of inventing a workaround.

## Diagnostics and Logs

- `npx @insforge/cli diagnose` - full health report.
- `npx @insforge/cli diagnose --ai "<issue description>"` - ask the InsForge debug agent to diagnose a concrete backend issue.
- `npx @insforge/cli diagnose metrics [--range 1h|6h|24h|7d]` - EC2 metrics.
- `npx @insforge/cli diagnose advisor [--severity critical|warning|info] [--category security|performance|health]` - advisor issues.
- `npx @insforge/cli diagnose db [--check <checks>]` - database health checks.
- `npx @insforge/cli diagnose logs [--source <name>] [--limit <n>]` - aggregate error logs.
- `npx @insforge/cli logs <source> [--limit <n>]` - source-specific backend logs.

Typical log sources include `function.logs`, `function-deploy.logs`, `postgres.logs`, `postgrest.logs`, and `insforge.logs`. See `references/diagnostics.md` for common debugging scenarios and source selection.

## Documentation

- `npx @insforge/cli docs` - list documentation topics.
- `npx @insforge/cli docs instructions` - setup guide.
- `npx @insforge/cli docs <feature> <language>` - feature docs for `db`, `storage`, `functions`, `auth`, `ai`, or `realtime` in `typescript`, `swift`, `kotlin`, or `rest-api`.

For application code with InsForge or `@insforge/sdk`, use the `insforge` app-integration skill and use `docs` only as official feature reference.

## PostHog

- `npx @insforge/cli posthog setup` ensures the dashboard has a PostHog connection, then prints the official PostHog wizard command plus the connected project's public `phc_` API key and host.
- ⚠️ `posthog setup` alone does NOT instrument the app: no env vars, no SDK, no events until the wizard step happens. The wizard is interactive and may open a browser; ask the user to run it in their real terminal, or instrument manually using the printed `phc_` key/host (PostHog's public client key, safe in frontend env vars).
- Cloud only: self-hosted backends don't expose the integration. Do not substitute a `phc_` key from a separate PostHog account into app env vars — the Analytics page reads from the server-side connection that only `posthog setup` populates; use the key it prints.

## Non-Interactive CI/CD

Use env vars and JSON mode for automated contexts:

```bash
INSFORGE_EMAIL=$EMAIL INSFORGE_PASSWORD=$PASSWORD npx @insforge/cli login --email -y
npx @insforge/cli link --project-id $PROJECT_ID --org-id $ORG_ID -y
npx @insforge/cli db query "SELECT 1 AS ok" --json
```

## Project Configuration File

After `create` or `link`, `.insforge/project.json` contains the linked project ID, app key, region, API key, and backend URL.

- Never commit `.insforge/project.json` or share it publicly.
- Do not edit it manually. Use `npx @insforge/cli link` or branch commands to switch projects.
