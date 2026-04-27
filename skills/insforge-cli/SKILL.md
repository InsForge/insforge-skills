---
name: insforge-cli
description: >-
  Use this skill whenever the user needs backend infrastructure management — creating database tables, running SQL, managing database migration files, deploying serverless functions, managing storage buckets, deploying frontend apps, adding secrets, setting up cron jobs, checking logs, or running backend diagnostics — especially if the project uses InsForge. Trigger on any of these contexts: creating or altering database tables/schemas, fetching or applying database migrations, writing RLS policies via SQL, deploying or invoking edge functions, creating storage buckets, deploying frontends to hosting, managing secrets/env vars, setting up scheduled tasks/cron, viewing backend logs, diagnosing backend health or performance issues, or exporting/importing database backups. If the user asks for these operations generically (e.g., "create a users table", "apply a migration", "deploy my app", "set up a cron job", "check backend health") and you're unsure whether they use InsForge, consult this skill and ask. For writing frontend application code with the InsForge SDK (@insforge/sdk), use the insforge skill instead.
license: Apache-2.0
metadata:
  author: insforge
  version: "1.1.0"
  organization: InsForge
  date: February 2026
---

# InsForge CLI

Command-line tool for managing InsForge Backend-as-a-Service projects.

## Critical: Always Use npx (No Global Install)

**NEVER** install the CLI globally (`npm install -g @insforge/cli`). **Always** run commands via `npx`:

```bash
npx @insforge/cli <command>
```

This ensures the latest version is always used without global install issues (permissions, PATH, node version mismatches).

**Session start** — verify authentication and project:

```bash
npx @insforge/cli whoami    # verify authentication
npx @insforge/cli current   # verify linked project
```

If not authenticated: `npx @insforge/cli login`
If no project linked: `npx @insforge/cli create` (new) or `npx @insforge/cli link` (existing)

## Global Options

| Flag | Description |
|------|-------------|
| `--json` | Structured JSON output (for scripts and agents) |
| `-y, --yes` | Skip confirmation prompts |

> All examples below use `npx @insforge/cli`. **Never** call `insforge` directly.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error (e.g., HTTP 400+ from function invoke) |
| 2 | Not authenticated |
| 3 | Project not linked |
| 4 | Resource not found |
| 5 | Permission denied |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `INSFORGE_ACCESS_TOKEN` | Override stored access token |
| `INSFORGE_PROJECT_ID` | Override linked project ID |
| `INSFORGE_EMAIL` | Email for non-interactive login |
| `INSFORGE_PASSWORD` | Password for non-interactive login |

---

## Commands

### Authentication
- `npx @insforge/cli login` — OAuth (browser) or `--email` for password login. See [references/login.md](references/login.md)
- `npx @insforge/cli logout` — clear stored credentials
- `npx @insforge/cli whoami` — show current user

### Project Management
- `npx @insforge/cli create` — create new project. See [references/create.md](references/create.md)
- `npx @insforge/cli link` — link directory to existing project
- `npx @insforge/cli current` — show current user + linked project
- `npx @insforge/cli list` — list all orgs and projects
- `npx @insforge/cli metadata` — show backend metadata (auth config, database tables, storage buckets, edge functions, AI models, realtime channels). Use `--json` for structured output. **Run this first** to discover what's configured before building features.

### Database — `npx @insforge/cli db`
- `npx @insforge/cli db query <sql>` — execute raw SQL. See [references/db-query.md](references/db-query.md)
- `npx @insforge/cli db tables / indexes / policies / triggers / functions` — inspect schema
- `npx @insforge/cli db migrations list / fetch / new / up` — manage developer migration files. See [references/db-migrations.md](references/db-migrations.md)
- `npx @insforge/cli db rpc <fn> [--data <json>]` — call database function (GET if no data, POST if data)
- `npx @insforge/cli db export` — export schema/data. See [references/db-export.md](references/db-export.md)
- `npx @insforge/cli db import <file>` — import from SQL file. See [references/db-import.md](references/db-import.md)

> Use `db migrations` for schema changes. Reserve `db query` for inspecting data and for row-level `SELECT / INSERT / UPDATE / DELETE` work.

### Edge Functions — `npx @insforge/cli functions`
- `npx @insforge/cli functions list` — list deployed functions
- `npx @insforge/cli functions code <slug>` — view function source
- `npx @insforge/cli functions deploy <slug>` — deploy or update. See [references/functions-deploy.md](references/functions-deploy.md)
- `npx @insforge/cli functions invoke <slug> [--data <json>] [--method GET|POST]` — invoke function
- `npx @insforge/cli functions delete <slug>` — delete an edge function (with confirmation)

### Storage — `npx @insforge/cli storage`
- `npx @insforge/cli storage buckets` — list buckets
- `npx @insforge/cli storage create-bucket <name> [--private]` — create bucket (default: public)
- `npx @insforge/cli storage delete-bucket <name>` — delete bucket and **all its objects** (destructive)
- `npx @insforge/cli storage list-objects <bucket> [--prefix] [--search] [--limit] [--sort]` — list objects
- `npx @insforge/cli storage upload <file> --bucket <name> [--key <objectKey>]` — upload file
- `npx @insforge/cli storage download <objectKey> --bucket <name> [--output <path>]` — download file

### Frontend Deployments (Vercel) — `npx @insforge/cli deployments`

Deploy a frontend application (static site / SPA / Next.js / etc.) to Vercel,
managed through InsForge. For backend container workloads see **Backend Compute
Services** below.

- `npx @insforge/cli deployments deploy [dir]` — deploy frontend app from its source directory. See [references/deployments-deploy.md](references/deployments-deploy.md)
- `npx @insforge/cli deployments list` — list deployments
- `npx @insforge/cli deployments status <id> [--sync]` — get deployment status (--sync fetches from Vercel)
- `npx @insforge/cli deployments cancel <id>` — cancel running deployment
- `npx @insforge/cli deployments env list` — list all deployment environment variables
- `npx @insforge/cli deployments env set <key> <value>` — create or update a deployment environment variable
- `npx @insforge/cli deployments env delete <id>` — delete a deployment environment variable by ID

### Backend Compute Services (Fly.io) — `npx @insforge/cli compute`

Deploy and manage backend containerized services (APIs, workers, microservices).
Each service runs as a Docker container reachable via a public HTTPS endpoint.
For frontend hosting see **Frontend Deployments** above.

> 🔧 **Implementation note (for agents):** InsForge runs compute on **Fly.io**
> under the hood, but **DO NOT use `flyctl` directly** to deploy or manage
> these services. The Fly account, org, IP allocation, and machine ownership
> all live on the InsForge cloud — `flyctl` invoked with the user's own credentials
> will land in the wrong org and fail with `unauthorized`. Always use
> `npx @insforge/cli compute …`. The CLI is just an HTTP client that calls the
> InsForge backend; the backend talks to Fly. No `flyctl` and no Fly token
> are needed locally.

> ⚠️ **In progress.** Compute services are still in development; the API and CLI may change.
>
> **Availability:** Compute requires the backend to have Fly.io configured. If not enabled, the API returns `COMPUTE_SERVICE_NOT_CONFIGURED` with setup instructions in `nextActions`. Follow those instructions.

- `npx @insforge/cli compute list` — list all compute services (name, status, image, CPU, memory, endpoint)
- `npx @insforge/cli compute get <id>` — get service details
- `npx @insforge/cli compute deploy --image <url> --name <name> [--port] [--cpu] [--memory] [--region] [--env]` — deploy a pre-built Docker image. See [references/compute-deploy.md](references/compute-deploy.md).
- `npx @insforge/cli compute update <id> [--image] [--port] [--cpu] [--memory] [--region]` — update service config
- `npx @insforge/cli compute stop <id>` — stop a running service
- `npx @insforge/cli compute start <id>` — start a stopped service
- `npx @insforge/cli compute logs <id> [--limit 50]` — view machine event logs
- `npx @insforge/cli compute delete <id>` — delete service and destroy Fly.io resources

### Secrets — `npx @insforge/cli secrets`
- `npx @insforge/cli secrets list [--all]` — list secrets (values hidden; `--all` includes deleted)
- `npx @insforge/cli secrets get <key>` — get decrypted value
- `npx @insforge/cli secrets add <key> <value> [--reserved] [--expires <ISO date>]` — create secret
- `npx @insforge/cli secrets update <key> [--value] [--active] [--reserved] [--expires]` — update secret
- `npx @insforge/cli secrets delete <key>` — **soft delete** (marks inactive; restore with `--active true`)

### Schedules — `npx @insforge/cli schedules`
- `npx @insforge/cli schedules list` — list all scheduled tasks (shows ID, name, cron, URL, method, active, next run)
- `npx @insforge/cli schedules get <id>` — get schedule details
- `npx @insforge/cli schedules create --name --cron --url --method [--headers <json>] [--body <json>]` — create a cron job. `--cron` accepts either 5-field cron (`*/5 * * * *`) or pg_cron interval syntax for sub-minute cadence (`30 seconds`, `5 minutes`, `1 hour`)
- `npx @insforge/cli schedules update <id> [--name] [--cron] [--url] [--method] [--headers] [--body] [--active]` — update schedule
- `npx @insforge/cli schedules delete <id>` — delete schedule (with confirmation)
- `npx @insforge/cli schedules logs <id> [--limit] [--offset]` — view execution logs

### Diagnostics — `npx @insforge/cli diagnose`

Run with no subcommand for a full health report across all checks.

- `npx @insforge/cli diagnose` — full health report (runs all diagnostics)
- `npx @insforge/cli diagnose --ai "<issue description>"` — hand a natural-language problem description (error, failing URL, HTTP status) to the InsForge debug agent; returns a diagnosis plus suggested solutions
- `npx @insforge/cli diagnose metrics [--range 1h|6h|24h|7d] [--metrics <list>]` — EC2 instance metrics (CPU, memory, disk, network). Default range: `1h`
- `npx @insforge/cli diagnose advisor [--severity critical|warning|info] [--category security|performance|health] [--limit <n>]` — latest advisor scan results and issues. Default limit: 50
- `npx @insforge/cli diagnose db [--check <checks>]` — database health checks. Checks: `connections`, `slow-queries`, `bloat`, `size`, `index-usage`, `locks`, `cache-hit` (default: `all`)
- `npx @insforge/cli diagnose logs [--source <name>] [--limit <n>]` — aggregate error-level logs from all backend sources. Default limit: 100

### Logs — `npx @insforge/cli logs`
- `npx @insforge/cli logs <source> [--limit <n>]` — fetch backend container logs (default: 20 entries)

| Source | Description |
|--------|-------------|
| `insforge.logs` | Main backend logs |
| `postgREST.logs` | PostgREST API layer logs |
| `postgres.logs` | PostgreSQL database logs |
| `function.logs` | Edge function execution logs |
| `function-deploy.logs` | Edge function deployment logs |

> Source names are case-insensitive: `postgrest.logs` works the same as `postgREST.logs`.

### Documentation — `npx @insforge/cli docs`
- `npx @insforge/cli docs` — list all topics
- `npx @insforge/cli docs instructions` — setup guide
- `npx @insforge/cli docs <feature> <language>` — feature docs (`db / storage / functions / auth / ai / realtime` × `typescript / swift / kotlin / rest-api`)

> For writing application code with the InsForge SDK, use the insforge (SDK) skill instead, and use the `npx @insforge/cli docs <feature> <language>` to get specific SDK documentation.

---

## Non-Obvious Behaviors

**Functions invoke URL**: invoked at `{oss_host}/functions/{slug}` — NOT `/api/functions/{slug}`. Exits with code 1 on HTTP 400+.

**Secrets delete is soft**: marks the secret inactive, not destroyed. Restore with `npx @insforge/cli secrets update KEY --active true`. Use `--all` with `secrets list` to see inactive ones.

**Storage delete-bucket is hard**: deletes the bucket and every object inside it permanently.

**db rpc uses GET or POST**: no `--data` → GET; with `--data` → POST.

**db migrations use timestamped files**: migration filenames use `YYYYMMDDHHmmss_name.sql`, for example `20260418091500_create-posts.sql`.

**db migrations up supports safe batch modes**: `npx @insforge/cli db migrations up <filename|version>` applies one explicit local target. `npx @insforge/cli db migrations up --to <version|filename>` and `npx @insforge/cli db migrations up --all` apply pending files in ascending version order and stop on the first failure.

**db migrations run inside a backend-managed transaction**: do not put `BEGIN`, `COMMIT`, or `ROLLBACK` in migration files.

**The live database schema is the source of truth**: before writing a migration, and again if a migration fails, inspect the current database state first (`db tables / indexes / policies / triggers / functions`, plus `db migrations list`) and then adjust the migration statements to match reality. Do not assume local files are still current.

**⚠️ v1 limitation — image-only.** `compute deploy --image <url>` deploys a pre-built image. It does NOT build from source. Build locally with Docker, push to any registry, then deploy via `--image`. Server-side build is roadmap, not v1. Don't reach for `flyctl deploy` as a workaround — it 401s because the Fly account is InsForge's, not yours.

**Compute endpoints use .fly.dev**: Services get a public URL at `https://{name}-{projectId}.fly.dev`. Custom domains require DNS configuration.

**Schedules accept two cron formats**: 5-field cron (`minute hour day month day-of-week`, e.g. `*/5 * * * *`) **or** pg_cron interval syntax for sub-minute cadence (`2 seconds`, `30 seconds`, `5 minutes`, `1 hour`). 6-field cron with seconds (Quartz/Spring's `*/2 * * * * *`) is **not** supported — use the interval form for sub-minute work. Headers can reference secrets with `${{secrets.KEY_NAME}}`.

---

## Common Workflows

### Set up database schema with migrations

```bash
# Inspect the current live schema first
npx @insforge/cli db tables
npx @insforge/cli db indexes
npx @insforge/cli db policies
npx @insforge/cli db migrations list

# Sync applied remote migration history locally
npx @insforge/cli db migrations fetch

# Create the next schema migration file
npx @insforge/cli db migrations new create-posts

# Edit migrations/20260418091500_create-posts.sql with CREATE TABLE / ALTER TABLE / policies

# Apply pending migrations safely
npx @insforge/cli db migrations up --all
```

> Use migrations for schema changes. Use `db query` for row changes and inspection. In migrations, FK to users with `auth.users(id)` and use `auth.uid()` in RLS policies.

### Manage database migrations

```bash
# Inspect remote migration history
npx @insforge/cli db migrations list

# Sync applied remote migrations into migrations/
npx @insforge/cli db migrations fetch

# Create the next local migration file
npx @insforge/cli db migrations new create-posts

# Apply all pending local migrations
npx @insforge/cli db migrations up --all
```

### Deploy an edge function

```bash
# Default source path: insforge/functions/{slug}/index.ts
npx @insforge/cli functions deploy my-handler
npx @insforge/cli functions invoke my-handler --data '{"action": "test"}'
```

### Deploy frontend

**Always verify the local build succeeds before deploying.** Local builds are faster to debug and don't waste server resources. After the build passes, deploy the project source directory (usually `.`), not `dist/` or other generated build output.

**Environment variables are required.** Frontend apps need env vars (API URL, anon key) to connect to InsForge at runtime. Deploying without them produces a broken app. Before deploying, you must ensure env vars are set using one of these two approaches:

**Option A — Persistent env vars (recommended):** Set once, applied to every future deployment automatically. Best for projects that will be redeployed.

```bash
# Check what's already set
npx @insforge/cli deployments env list

# Set the vars your app needs (use the correct framework prefix)
npx @insforge/cli deployments env set VITE_INSFORGE_URL https://my-app.us-east.insforge.app
npx @insforge/cli deployments env set VITE_INSFORGE_ANON_KEY ik_xxx

# Deploy the project source — persistent env vars are applied automatically
npx @insforge/cli deployments deploy .
```

**Option B — Inline `--env` flag:** Pass env vars as JSON directly on the deploy command. Useful for one-off deploys or overriding persistent vars.

```bash
npx @insforge/cli deployments deploy . --env '{"VITE_INSFORGE_URL": "https://my-app.us-east.insforge.app", "VITE_INSFORGE_ANON_KEY": "ik_xxx"}'
```

**Full workflow:**

```bash
# 1. Build locally first
npm run build

# 2. Ensure env vars are set (check existing, add missing)
npx @insforge/cli deployments env list
npx @insforge/cli deployments env set VITE_INSFORGE_URL https://my-app.us-east.insforge.app
npx @insforge/cli deployments env set VITE_INSFORGE_ANON_KEY ik_xxx

# 3. Deploy the project source directory
npx @insforge/cli deployments deploy .
```

**Environment variable prefix by framework:**

| Framework | Prefix | Example |
|-----------|--------|---------|
| Vite | `VITE_` | `VITE_INSFORGE_URL` |
| Next.js | `NEXT_PUBLIC_` | `NEXT_PUBLIC_INSFORGE_URL` |
| Create React App | `REACT_APP_` | `REACT_APP_INSFORGE_URL` |
| Astro | `PUBLIC_` | `PUBLIC_INSFORGE_URL` |
| SvelteKit | `PUBLIC_` | `PUBLIC_INSFORGE_URL` |

**Pre-deploy checklist:**
- [ ] `npm run build` succeeds locally
- [ ] Env vars are set — run `deployments env list` to verify, or pass `--env` on the deploy command
- [ ] All env vars use the correct framework prefix
- [ ] Deploy the project source directory (usually `.`), not `dist/`, `build/`, or `.next/`
- [ ] Edge function directories excluded from frontend build (if applicable)
- [ ] Never include `node_modules`, `.git`, `.env`, or `.insforge` in the upload
- [ ] Framework build output is configured correctly (`dist/`, `build/`, `.next/`, etc.)

### Deploy a Docker container (compute service)

InsForge deploys pre-built Docker images. Build the image with your own toolchain, then deploy.

**Off-the-shelf image:**
```bash
npx @insforge/cli compute deploy --image nginx:alpine --name my-api --port 80 --region iad
npx @insforge/cli compute list
# Service is running with a public https://{name}-{project}.fly.dev endpoint
# No flyctl, no FLY_API_TOKEN, no local Docker required.
```

**Your own image (local Docker):**
```bash
docker build -t ghcr.io/you/app:v1 .
docker push ghcr.io/you/app:v1
npx @insforge/cli compute deploy --image ghcr.io/you/app:v1 --name my-api --port 8000
```

**Lifecycle management:**
```bash
npx @insforge/cli compute stop <id>       # stop the machine
npx @insforge/cli compute start <id>      # restart it
npx @insforge/cli compute logs <id>       # check machine events
npx @insforge/cli compute delete <id>     # destroy everything
```

**CPU tiers:** `shared-1x` (default), `shared-2x`, `performance-1x`, `performance-2x`, `performance-4x`
**Memory options:** 256, 512 (default), 1024, 2048, 4096, 8192 MB
**Regions:** `iad` (default), `sin`, `lax`, `lhr`, `nrt`, `ams`, `syd`

> The `deploy` command requires `flyctl` CLI and `FLY_API_TOKEN` env var. It backs up any existing `fly.toml`, generates one for the deploy, then restores the original.

### Backup and restore database

```bash
npx @insforge/cli db export --output backup.sql
npx @insforge/cli db import backup.sql
```

### Schedule a cron job

```bash
# Wall-clock cadence — every 5 minutes (5-field cron)
npx @insforge/cli schedules create \
  --name "Cleanup Expired" \
  --cron "*/5 * * * *" \
  --url "https://my-app.us-east.insforge.app/functions/cleanup" \
  --method POST \
  --headers '{"Authorization": "Bearer ${{secrets.API_TOKEN}}"}'

# Sub-minute cadence — every 30 seconds (pg_cron interval syntax)
npx @insforge/cli schedules create \
  --name "Health Probe" \
  --cron "30 seconds" \
  --url "https://my-app.us-east.insforge.app/functions/probe" \
  --method GET

# Check execution history
npx @insforge/cli schedules logs <id>
```

#### Cron Expression Format

InsForge accepts **two cron formats**: standard 5-field cron expressions, **or** pg_cron interval syntax for sub-minute cadence. 6-field cron expressions with seconds (Quartz/Spring style) are NOT supported — use the interval form below for sub-minute work.

**5-field cron format:**

```
┌─────────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌─────────── day of month (1-31)
│ │ │ ┌───────── month (1-12)
│ │ │ │ ┌─────── day of week (0-6, Sunday=0)
│ │ │ │ │
* * * * *
```

| Expression | Description |
|------------|-------------|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour (at minute 0) |
| `0 9 * * *` | Daily at 9:00 AM |
| `0 9 * * 1` | Every Monday at 9:00 AM |
| `0 0 1 * *` | First day of every month at midnight |
| `30 14 * * 1-5` | Weekdays at 2:30 PM |

**Interval syntax (for sub-minute cadence):**

Accepts `<positive integer> <unit>` where unit is `second(s)`, `minute(s)`, or `hour(s)`. Case-insensitive.

| Expression | Description |
|------------|-------------|
| `1 second` | Every second |
| `2 seconds` | Every 2 seconds |
| `30 seconds` | Every 30 seconds |
| `90 seconds` | Every 90 seconds |
| `5 minutes` | Every 5 minutes |
| `1 hour` | Every hour |

> **When to pick which:** use 5-field cron for "wall-clock" cadence (every Monday at 9 AM, daily midnight, every 5 minutes on the dot). Use interval syntax when you need sub-minute cadence or simple "every N seconds" semantics. At very high cadence, watch the size of `net._http_response` — InsForge prunes responses older than 1 day every 15 minutes, but a runaway high-frequency schedule can still bloat the table.

#### Secret References in Headers

Headers can reference secrets stored in InsForge using the syntax `${{secrets.KEY_NAME}}`.

```json
{
  "headers": {
    "Authorization": "Bearer ${{secrets.API_TOKEN}}",
    "X-API-Key": "${{secrets.EXTERNAL_API_KEY}}"
  }
}
```

Secrets are resolved at schedule creation/update time. If a referenced secret doesn't exist, the operation fails with a 404 error.

#### Best Practices

1. **Pick the right cron format for the cadence**
   - Wall-clock cadence (daily/hourly/weekly) → 5-field cron (`*/5 * * * *`, `0 9 * * 1-5`)
   - Sub-minute cadence → pg_cron interval form (`2 seconds`, `30 seconds`, `5 minutes`)
   - 6-field cron with seconds (`*/2 * * * * *`) is **not** supported — use the interval form

2. **Store sensitive values as secrets**
   - Use `${{secrets.KEY_NAME}}` in headers for API keys and tokens
   - Create secrets first via the secrets API before referencing them

3. **Target InsForge functions for serverless tasks**
   - Use the function URL format: `https://your-project.region.insforge.app/functions/{slug}`
   - Ensure the target function exists and has `status: "active"`

4. **Monitor execution logs**
   - Check logs regularly to ensure schedules are running successfully
   - Look for non-200 status codes and failed executions

#### Common Mistakes

| Mistake | Solution |
|---------|----------|
| Using 6-field cron (e.g. `*/2 * * * * *`) | Not supported — use pg_cron interval form (`2 seconds`) for sub-minute, or 5-field cron for everything else |
| Referencing non-existent secret | Create the secret first via secrets API |
| Targeting non-existent function | Verify function exists and is `active` before scheduling |
| Schedule not running | Check `isActive` is `true` and cron expression is valid |

#### Recommended Workflow

```
1. Create secrets if needed     -> `npx @insforge/cli secrets add KEY VALUE`
2. Create/verify target function -> `npx @insforge/cli functions list`
3. Create schedule              -> `npx @insforge/cli schedules create`
4. Verify schedule is active    -> `npx @insforge/cli schedules get <id>`
5. Monitor execution logs       -> `npx @insforge/cli schedules logs <id>`
```

### Diagnose backend health

```bash
# Full health report (all checks)
npx @insforge/cli diagnose

# Check specific areas
npx @insforge/cli diagnose metrics --range 24h          # CPU/memory/disk over last 24h
npx @insforge/cli diagnose advisor --severity critical   # critical issues only
npx @insforge/cli diagnose db --check bloat,slow-queries # specific DB checks
npx @insforge/cli diagnose logs                          # aggregate errors from all sources
```

### Debug with logs

```bash
npx @insforge/cli logs function.logs          # function execution issues
npx @insforge/cli logs postgres.logs          # database query problems
npx @insforge/cli logs insforge.logs          # API / auth errors
npx @insforge/cli logs postgrest.logs --limit 50
```

#### Best Practices

1. **Start with function.logs for function issues**
   - Check execution errors, timeouts, and runtime exceptions

2. **Use postgres.logs for query problems**
   - Debug slow queries, constraint violations, connection issues

3. **Check insforge.logs for API errors**
   - Authentication failures, request validation, general backend errors

#### Common Debugging Scenarios

| Problem | Check |
|---------|-------|
| Function not working | `function.logs` |
| Database query failing | `postgres.logs`, `postgREST.logs` |
| Auth issues | `insforge.logs` |
| API returning 500 errors | `insforge.logs`, `postgREST.logs` |
| General health / performance | `diagnose` (full report) or `diagnose metrics` |
| Database bloat / slow queries | `diagnose db` |
| Security / config issues | `diagnose advisor --category security` |
| Compute service not starting | `compute logs <id>`, check Fly machine events |
| Compute deploy failed | Check `FLY_API_TOKEN` is set, `flyctl` installed |

### Non-interactive CI/CD

```bash
INSFORGE_EMAIL=$EMAIL INSFORGE_PASSWORD=$PASSWORD npx @insforge/cli login --email -y
npx @insforge/cli link --project-id $PROJECT_ID --org-id $ORG_ID -y
npx @insforge/cli db query "SELECT count(*) FROM users" --json
```

---

## Project Configuration

After `create` or `link`, `.insforge/project.json` is created:

```json
{
  "project_id": "...",
  "appkey": "...",
  "region": "us-east",
  "api_key": "ik_...",
  "oss_host": "https://{appkey}.{region}.insforge.app"
}
```

`oss_host` is the base URL for all SDK and API operations. `api_key` is the admin key for backend API calls.

> **Never commit this file to version control or share it publicly**.
> Do not edit this file manually. Use `npx @insforge/cli link` to switch projects.
