---
name: insforge-cli
description: >-
  Use this skill whenever the user needs backend infrastructure management — creating database tables, running SQL, deploying serverless functions, managing storage buckets, deploying frontend apps, adding secrets, setting up cron jobs, checking logs, or running backend diagnostics — especially if the project uses InsForge. Trigger on any of these contexts: creating or altering database tables/schemas, writing RLS policies via SQL, deploying or invoking edge functions, creating storage buckets, deploying frontends to hosting, managing secrets/env vars, setting up scheduled tasks/cron, viewing backend logs, diagnosing backend health or performance issues, or exporting/importing database backups. If the user asks for these operations generically (e.g., "create a users table", "deploy my app", "set up a cron job", "check backend health") and you're unsure whether they use InsForge, consult this skill and ask. For writing frontend application code with the InsForge SDK (@insforge/sdk), use the insforge skill instead.
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
- `npx @insforge/cli db rpc <fn> [--data <json>]` — call database function (GET if no data, POST if data)
- `npx @insforge/cli db export` — export schema/data. See [references/db-export.md](references/db-export.md)
- `npx @insforge/cli db import <file>` — import from SQL file. See [references/db-import.md](references/db-import.md)

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

### Deployments — `npx @insforge/cli deployments`
- `npx @insforge/cli deployments deploy [dir]` — deploy frontend app. See [references/deployments-deploy.md](references/deployments-deploy.md)
- `npx @insforge/cli deployments list` — list deployments
- `npx @insforge/cli deployments status <id> [--sync]` — get deployment status (--sync fetches from Vercel)
- `npx @insforge/cli deployments cancel <id>` — cancel running deployment

### Secrets — `npx @insforge/cli secrets`
- `npx @insforge/cli secrets list [--all]` — list secrets (values hidden; `--all` includes deleted)
- `npx @insforge/cli secrets get <key>` — get decrypted value
- `npx @insforge/cli secrets add <key> <value> [--reserved] [--expires <ISO date>]` — create secret
- `npx @insforge/cli secrets update <key> [--value] [--active] [--reserved] [--expires]` — update secret
- `npx @insforge/cli secrets delete <key>` — **soft delete** (marks inactive; restore with `--active true`)

### Schedules — `npx @insforge/cli schedules`
- `npx @insforge/cli schedules list` — list all scheduled tasks (shows ID, name, cron, URL, method, active, next run)
- `npx @insforge/cli schedules get <id>` — get schedule details
- `npx @insforge/cli schedules create --name --cron --url --method [--headers <json>] [--body <json>]` — create a cron job (5-field cron format only)
- `npx @insforge/cli schedules update <id> [--name] [--cron] [--url] [--method] [--headers] [--body] [--active]` — update schedule
- `npx @insforge/cli schedules delete <id>` — delete schedule (with confirmation)
- `npx @insforge/cli schedules logs <id> [--limit] [--offset]` — view execution logs

### Diagnostics — `npx @insforge/cli diagnose`

Run with no subcommand for a full health report across all checks.

- `npx @insforge/cli diagnose` — full health report (runs all diagnostics)
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

**Schedules use 5-field cron only**: `minute hour day month day-of-week`. 6-field (with seconds) is NOT supported. Headers can reference secrets with `${{secrets.KEY_NAME}}`.

---

## Common Workflows

### Set up database schema

```bash
npx @insforge/cli db query "CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
)"
npx @insforge/cli db query "ALTER TABLE posts ENABLE ROW LEVEL SECURITY"
npx @insforge/cli db query "CREATE POLICY \"public_read\" ON posts FOR SELECT USING (true)"
npx @insforge/cli db query "CREATE POLICY \"owner_write\" ON posts FOR INSERT WITH CHECK (auth.uid() = author_id)"
```

> FK to users: always `auth.users(id)`. RLS current user: `auth.uid()`.

### Deploy an edge function

```bash
# Default source path: insforge/functions/{slug}/index.ts
npx @insforge/cli functions deploy my-handler
npx @insforge/cli functions invoke my-handler --data '{"action": "test"}'
```

### Deploy frontend

**Always verify the local build succeeds before deploying.** Local builds are faster to debug and don't waste server resources.

```bash
# 1. Build locally first
npm run build

# 2. Deploy
npx @insforge/cli deployments deploy ./dist --env '{"VITE_API_URL": "https://my-app.us-east.insforge.app"}'
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
- [ ] All required env vars configured with correct framework prefix
- [ ] Edge function directories excluded from frontend build (if applicable)
- [ ] Never include `node_modules`, `.git`, `.env`, `.insforge`, or build output in the zip
- [ ] Build output directory matches framework's expected output (`dist/`, `build/`, `.next/`, etc.)

### Backup and restore database

```bash
npx @insforge/cli db export --output backup.sql
npx @insforge/cli db import backup.sql
```

### Schedule a cron job

```bash
# Create a schedule that calls a function every 5 minutes
npx @insforge/cli schedules create \
  --name "Cleanup Expired" \
  --cron "*/5 * * * *" \
  --url "https://my-app.us-east.insforge.app/functions/cleanup" \
  --method POST \
  --headers '{"Authorization": "Bearer ${{secrets.API_TOKEN}}"}'

# Check execution history
npx @insforge/cli schedules logs <id>
```

#### Cron Expression Format

InsForge uses **5-field cron expressions** (pg_cron format). 6-field expressions with seconds are NOT supported.

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

1. **Use 5-field cron expressions only**
   - pg_cron does not support seconds (6-field format)
   - Example: `*/5 * * * *` for every 5 minutes

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
| Using 6-field cron (with seconds) | Use 5-field format only: `minute hour day month day-of-week` |
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
