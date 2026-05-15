---
name: insforge-debug
description: >-
  Use this skill when encountering errors, bugs, or unexpected behavior in an
  InsForge project that has a concrete symptom — an SDK error object, an HTTP
  4xx/5xx response, a failing edge function, a login that won't go through,
  a realtime channel that won't connect, or a deploy that just errored.
  This skill guides diagnostic command execution to locate the cause. The
  manual scenarios surface logs/status only; the AI-assisted path
  (`diagnose --ai`) additionally returns suggested causes and solutions.
  For proactive health audits without a concrete symptom (security review,
  performance scan, system health check), use `insforge-backend-advisor`
  instead.
license: MIT
metadata:
  author: insforge
  version: "1.1.0"
  organization: InsForge
  date: May 2026
---

# InsForge Debug

Diagnose concrete problems in InsForge projects — from frontend SDK errors to edge function failures. This skill helps you **locate** the cause of a known symptom by running the right commands and surfacing logs/status. The manual scenarios below locate problems without suggesting fixes; the [AI-assisted path](#ai-assisted-diagnosis-fastest-path) additionally returns suggested causes and solutions.

For a proactive audit (security review, slow-query hunt, backend health check) without a specific failing request in hand, use `insforge-backend-advisor` instead.

**Always use `npx @insforge/cli`** — never install the CLI globally.

## AI-Assisted Diagnosis (Fastest Path)

When the user gives a concrete description of the problem (error message, failing URL, HTTP status), hand it to the InsForge debug agent. It inspects backend state on its own and returns a diagnosis plus possible solutions.

```bash
npx @insforge/cli diagnose --ai "<issue description>"
```

**When to use this path first**:
- The user pastes an error, request URL, or status code and asks "why?"
- You want a fast first pass before drilling into the manual scenarios below
- The problem spans multiple subsystems (frontend + backend + database) and you're not sure where to start

**Examples**:

```bash
# Edge function error
npx @insforge/cli diagnose --ai "I invoked edge function https://kttprzh4.functions.insforge.app/newton, got error: 508: Loop Detected (LOOP_DETECTED)\n\nRecursive requests to the same deployment cannot be processed."

# Slow database query
npx @insforge/cli diagnose --ai "I query data with https://kttprzh4.us-west.insforge.app/api/database/records/order_customer_details?select=*&order=total_amount.desc, it costs 1.4s, why?"

# Unresponsive backend / 504
npx @insforge/cli diagnose --ai "my backend is unresponsive, request https://kttprzh4.us-west.insforge.app/api/database/records/todo?select=*&order=created_at.desc got 504 error, why?"
```

Unlike the other commands in this skill, `diagnose --ai` returns both a diagnosis and suggested solutions. Relay them to the user as a starting point, but verify against the underlying logs/metrics (the scenarios below) before committing to a fix.

## Quick Triage

Match the symptom to a scenario, then follow that scenario's steps.

| Symptom | Scenario |
|---------|----------|
| SDK returns `{ data: null, error: {...} }` | [#1 SDK Error](#scenario-1-sdk-returns-error-object) |
| HTTP 400 / 401 / 403 / 404 / 429 / 500 | [#2 HTTP Status Code](#scenario-2-http-status-code-anomaly) |
| Function throws or times out | [#3 Edge Function Failure](#scenario-3-edge-function-execution-failuretimeout) |
| Login fails / token expired / OAuth error | [#4 Auth Failure](#scenario-4-authenticationauthorization-failure) |
| Channel won't connect / messages missing | [#5 Realtime Issues](#scenario-5-realtime-channel-issues) |
| `functions deploy` fails | [#6 Function Deploy](#scenario-6-edge-function-deploy-failure) |
| `deployments deploy` fails / Vercel error | [#7 Frontend Deploy](#scenario-7-frontend-vercel-deploy-failure) |

For symptoms like "queries are slow", "EC2 looks pegged", or "I want to audit my RLS policies" — switch to `insforge-backend-advisor`.

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

> If the 403 turns out to be a misconfigured RLS policy (not just a runtime denial), the policy review itself belongs in `insforge-backend-advisor` under [Security Audit](../insforge-backend-advisor/SKILL.md#security-audit).

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

## Scenario 4: Authentication/Authorization Failure

**Symptoms**: Login fails at runtime, signup errors, token expired, OAuth callback errors, a specific request returns 403 with an RLS denial.

**Steps**:

1. Check insforge.logs for auth-related errors (login failures, token issues, OAuth errors):

```bash
npx @insforge/cli logs insforge.logs --limit 50
```

2. Check postgREST.logs for RLS policy violations at runtime:

```bash
npx @insforge/cli logs postgREST.logs --limit 50
```

3. Verify the project's auth configuration:

```bash
npx @insforge/cli metadata --json
```

**Information gathered**: Auth error details, RLS violation logs around the failing request, auth configuration state.

> This scenario covers **runtime** auth failures (a specific login or request failed). For a proactive audit of RLS policies, secrets, or auth provider configuration without a concrete failing request, use `insforge-backend-advisor` → [Security Audit](../insforge-backend-advisor/SKILL.md#security-audit).

---

## Scenario 5: Realtime Channel Issues

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

4. If the issue is widespread (all channels affected), the underlying cause is likely backend-wide — switch to `insforge-backend-advisor` for a system health audit.

**Information gathered**: WebSocket error logs, channel configuration, realtime RLS policies.

---

## Scenario 6: Edge Function Deploy Failure

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

## Scenario 7: Frontend (Vercel) Deploy Failure

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

# AI-powered diagnosis from a natural-language problem description
# Returns diagnosis + suggested solutions
npx @insforge/cli diagnose --ai "<issue description>"

# EC2 instance metrics (CPU, memory, disk, network)
npx @insforge/cli diagnose metrics [--range 1h|6h|24h|7d] [--metrics <list>]

# Database health checks
npx @insforge/cli diagnose db [--check <checks>]
# checks: connections, slow-queries, bloat, size, index-usage, locks, cache-hit (default: all)

# Aggregate error logs from all sources
npx @insforge/cli diagnose logs [--source <name>] [--limit <n>]
```

For `diagnose advisor` and proactive backend audits, see `insforge-backend-advisor`.

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
