---
name: insforge-debug
description: >-
  Use this skill when encountering errors, bugs, performance issues, or
  unexpected behavior in an InsForge project — from frontend SDK errors
  to backend infrastructure problems. Trigger on: SDK returning error objects,
  HTTP 4xx/5xx responses, edge function failures or timeouts, slow database
  queries, authentication/authorization failures, realtime channel issues,
  backend performance degradation (high CPU/memory/slow responses),
  edge function deploy failures, or frontend Vercel deploy failures.
  This skill guides diagnostic command execution to locate problems;
  it does not provide fix suggestions.
license: Apache-2.0
metadata:
  author: insforge
  version: "1.0.0"
  organization: InsForge
  date: March 2026
---

# InsForge Debug

Diagnose problems in InsForge projects — from frontend SDK errors to backend infrastructure issues. This skill helps you **locate** problems by running the right commands and surfacing logs/status. It does NOT suggest fixes; hand the diagnostic output to the developer or their agent for repair decisions.

**Always use `npx @insforge/cli`** — never install the CLI globally.

## Quick Triage

Match the symptom to a scenario, then follow that scenario's steps.

| Symptom | Scenario |
|---------|----------|
| SDK returns `{ data: null, error: {...} }` | [#1 SDK Error](#scenario-1-sdk-returns-error-object) |
| HTTP 400 / 401 / 403 / 404 / 429 / 500 | [#2 HTTP Status Code](#scenario-2-http-status-code-anomaly) |
| Function throws or times out | [#3 Edge Function Failure](#scenario-3-edge-function-execution-failuretimeout) |
| Query slow or hangs | [#4 Database Slow](#scenario-4-database-query-slow-or-unresponsive) |
| Login fails / token expired / RLS denied | [#5 Auth Failure](#scenario-5-authenticationauthorization-failure) |
| Channel won't connect / messages missing | [#6 Realtime Issues](#scenario-6-realtime-channel-issues) |
| High CPU/memory, all responses slow | [#7 Backend Performance](#scenario-7-backend-performance-degradation) |
| `functions deploy` fails | [#8 Function Deploy](#scenario-8-edge-function-deploy-failure) |
| `deployments deploy` fails / Vercel error | [#9 Frontend Deploy](#scenario-9-frontend-vercel-deploy-failure) |

---

## Scenario 1: SDK Returns Error Object

**Symptoms**: SDK call returns `{ data: null, error: { code, message, details } }`. PostgREST error codes like `PGRST301`, `PGRST204`, etc.

**Steps**:

1. Read the error object — extract `code`, `message`, `details` from the SDK response.
2. Check aggregated error logs to find matching backend errors:

```bash
npx @insforge/cli diagnose logs
```

3. Based on the error code prefix, drill into the relevant log source:

| Error pattern | Log source | Command |
|---------------|------------|---------|
| `PGRST*` (PostgREST) | postgREST.logs | `npx @insforge/cli logs postgREST.logs --limit 50` |
| Database/SQL errors | postgres.logs | `npx @insforge/cli logs postgres.logs --limit 50` |
| Generic 500 / server error | insforge.logs | `npx @insforge/cli logs insforge.logs --limit 50` |

4. If the error is DB-related, check database health for additional context:

```bash
npx @insforge/cli diagnose db --check connections,locks,slow-queries
```

**Information gathered**: Error code, backend log entries around the error timestamp, database health status.

---

## Scenario 2: HTTP Status Code Anomaly

**Symptoms**: API calls return 400, 401, 403, 404, 429, or 500.

**Steps**:

1. Identify the status code from the response.
2. Follow the path for that status code:

| Status | What to check | Command |
|--------|---------------|---------|
| 400 | Request payload/params malformed | `npx @insforge/cli logs postgREST.logs --limit 50` |
| 401 | Auth token missing or expired | `npx @insforge/cli logs insforge.logs --limit 50` |
| 403 | RLS policy or permission denied | `npx @insforge/cli logs insforge.logs --limit 50` |
| 404 | Endpoint or resource doesn't exist | `npx @insforge/cli metadata --json` |
| 429 | Rate limit hit — **no backend logs recorded** | See 429 note below |
| 500 | Server-side error | `npx @insforge/cli diagnose logs` |

3. For 500 errors, also check aggregate error logs across all sources:

```bash
npx @insforge/cli diagnose logs
```

4. **429 Rate Limit**: The backend does not log 429 responses and does not return `Retry-After` or `X-RateLimit-*` headers. Checking logs will not help. Instead:
   - Review client code for high-frequency request patterns: loops without throttling, missing debounce, retry without exponential backoff, or parallel calls that could be batched.
   - Check overall backend load to see if the system is under heavy traffic:
     ```bash
     npx @insforge/cli diagnose metrics --range 1h
     ```
   - A 429 status confirms the request was rate-limited. The fix is always on the client side: reduce request frequency, add backoff/debounce, or batch operations.

**Information gathered**: Status code context, relevant log entries, request/response details from logs. For 429: client-side request patterns and backend load metrics.

---

## Scenario 3: Edge Function Execution Failure/Timeout

**Symptoms**: `functions invoke` returns error, function times out, or throws runtime exception.

**Steps**:

1. Check function execution logs:

```bash
npx @insforge/cli logs function.logs --limit 50
```

2. Verify the function exists and is active:

```bash
npx @insforge/cli functions list
```

3. Inspect the function source for obvious issues:

```bash
npx @insforge/cli functions code <slug>
```

**Information gathered**: Function runtime errors, function status, source code, EC2 resource metrics.

---

## Scenario 4: Database Query Slow or Unresponsive

**Symptoms**: Queries take too long, hang indefinitely, or connection pool is exhausted.

**Steps**:

1. Check database health — slow queries, active connections, locks:

```bash
npx @insforge/cli diagnose db --check slow-queries,connections,locks
```

2. Check postgres logs for query errors or warnings:

```bash
npx @insforge/cli logs postgres.logs --limit 50
```

3. Check index usage and table bloat:

```bash
npx @insforge/cli diagnose db --check index-usage,bloat,cache-hit,size
```

4. If the whole system feels slow, check EC2 instance metrics:

```bash
npx @insforge/cli diagnose metrics --range 1h
```

**Information gathered**: Slow query details, connection pool state, lock contention, index efficiency, table bloat, cache hit ratio, EC2 resource usage.

---

## Scenario 5: Authentication/Authorization Failure

**Symptoms**: Login fails, signup errors, token expired, OAuth callback error, RLS policy denies access.

**Steps**:

1. Check insforge.logs for auth-related errors (login failures, token issues, OAuth errors):

```bash
npx @insforge/cli logs insforge.logs --limit 50
```

2. Check postgREST.logs for RLS policy violations:

```bash
npx @insforge/cli logs postgREST.logs --limit 50
```

3. Verify the project's auth configuration:

```bash
npx @insforge/cli metadata --json
```

4. If RLS suspected, inspect current policies:

```bash
npx @insforge/cli db policies
```

**Information gathered**: Auth error details, RLS violation logs, auth configuration state, active RLS policies.

---

## Scenario 6: Realtime Channel Issues

**Symptoms**: WebSocket won't connect, channel subscription fails, messages not received or lost.

**Steps**:

1. Check insforge.logs for realtime/WebSocket errors:

```bash
npx @insforge/cli logs insforge.logs --limit 50
```

2. Verify the channel pattern exists and is enabled:

```bash
npx @insforge/cli db query "SELECT pattern, description, enabled FROM realtime.channels"
```

3. If access is restricted, check RLS on realtime tables:

```bash
npx @insforge/cli db policies
```

4. If the issue is widespread (all channels affected), check overall backend health:

```bash
npx @insforge/cli diagnose
```

**Information gathered**: WebSocket error logs, channel configuration, realtime RLS policies, overall backend health.

---

## Scenario 7: Backend Performance Degradation

**Symptoms**: All responses slow, high latency, intermittent failures across the board.

**Steps**:

1. Check EC2 instance metrics — CPU, memory, disk, network:

```bash
npx @insforge/cli diagnose metrics --range 1h
```

2. Check database health (often the bottleneck):

```bash
npx @insforge/cli diagnose db
```

3. Check aggregate error logs:

```bash
npx @insforge/cli diagnose logs
```

4. Check advisor for known critical issues:

```bash
npx @insforge/cli diagnose advisor --severity critical
```

**Information gathered**: CPU/memory/disk/network metrics (current and trend), database health, error log summary, advisor warnings.

---

## Scenario 8: Edge Function Deploy Failure

**Symptoms**: `functions deploy <slug>` command fails, function not appearing in the list after deploy.

**Steps**:

1. Re-run the deploy command and capture the error output:

```bash
npx @insforge/cli functions deploy <slug>
```

2. Check deployment-related errors:

```bash
npx @insforge/cli logs function-deploy.logs --limit 50
```

3. Verify whether the function exists in the list:

```bash
npx @insforge/cli functions list
```

**Information gathered**: Deploy command error output, function deployment logs, function list status, backend error logs.

---

## Scenario 9: Frontend (Vercel) Deploy Failure

**Symptoms**: `deployments deploy` command fails, deployment status shows error, Vercel build errors.

**Steps**:

1. Check recent deployment attempts:

```bash
npx @insforge/cli deployments list
```

2. Get the status and error details for the failed deployment:

```bash
npx @insforge/cli deployments status <id> --json
```

The `--json` output includes a `metadata` object with Vercel-specific context: `target`, `fileCount`, `projectId`, `startedAt`, `envVarKeys`, `webhookEventType` (e.g., `deployment.succeeded` or `deployment.error`), etc. This metadata captures the full deployment context and can be used for debugging or AI-assisted investigation.

3. Verify the local build succeeds before investigating further:

```bash
npm run build
```

**Information gathered**: Deployment history, deployment metadata (Vercel context, status, webhook events), local build output, backend deployment API logs.

---

## Command Quick Reference

### Logs

```bash
npx @insforge/cli logs <source> [--limit <n>]
```

| Source | Description |
|--------|-------------|
| `insforge.logs` | Main backend logs |
| `postgREST.logs` | PostgREST API layer logs |
| `postgres.logs` | PostgreSQL database logs |
| `function.logs` | Edge function execution logs |
| `function-deploy.logs` | Edge function deployment logs |

Source names are case-insensitive.

### Diagnostics

```bash
# Full health report (all checks)
npx @insforge/cli diagnose

# EC2 instance metrics (CPU, memory, disk, network)
npx @insforge/cli diagnose metrics [--range 1h|6h|24h|7d] [--metrics <list>]

# Advisor scan results
npx @insforge/cli diagnose advisor [--severity critical|warning|info] [--category security|performance|health] [--limit <n>]

# Database health checks
npx @insforge/cli diagnose db [--check <checks>]
# checks: connections, slow-queries, bloat, size, index-usage, locks, cache-hit (default: all)

# Aggregate error logs from all sources
npx @insforge/cli diagnose logs [--source <name>] [--limit <n>]
```

### Supporting Commands

```bash
# Project metadata (auth config, tables, buckets, functions, etc.)
npx @insforge/cli metadata --json

# Edge functions
npx @insforge/cli functions list
npx @insforge/cli functions code <slug>

# Secrets
npx @insforge/cli secrets list [--all]
npx @insforge/cli secrets get <key>
npx @insforge/cli secrets add <key> <value> [--reserved] [--expires <ISO date>]

# Database
npx @insforge/cli db policies
npx @insforge/cli db query "<sql>"

# Deployments
npx @insforge/cli deployments list
npx @insforge/cli deployments status <id> --json
```
