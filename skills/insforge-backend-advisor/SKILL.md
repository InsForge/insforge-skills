---
name: insforge-backend-advisor
description: >-
  Use this skill for proactive backend health audits in an InsForge project —
  security misconfigurations, performance regressions, and system health issues
  surfaced by `diagnose advisor`, plus the backend-side deep-dives that pair
  with each advisor issue. Trigger on requests like "health check", "audit my
  backend", "review security", "check RLS policies", "find slow queries",
  "backend performance review", "EC2/database/system health", or pre-launch
  readiness audits. For reactive runtime errors (SDK error objects, HTTP 4xx/5xx,
  function failures, deploy failures), use `insforge-debug` instead.
license: MIT
metadata:
  author: insforge
  version: "1.0.0"
  organization: InsForge
  date: May 2026
---

# InsForge Backend Advisor

Proactive backend health auditing for InsForge projects. This skill drives the `diagnose advisor` scan — security misconfigurations, performance regressions, and system health issues — then pairs each issue category with hands-on commands to verify and reproduce findings before changing anything.

**Always use `npx @insforge/cli`** — never install the CLI globally.

## When to Use This Skill vs `insforge-debug`

| You should be here when... | You should be in `insforge-debug` when... |
|---|---|
| Doing a periodic health check / pre-launch audit | A specific request just returned an error or unexpected status |
| Reviewing security posture (RLS, secrets, auth config) | A user can't log in / token expired / OAuth callback failing |
| Looking for slow queries, bloat, missing indexes proactively | A specific endpoint is slow *right now* and the user pasted the URL |
| "What's wrong with my backend?" without a concrete symptom | "Why did THIS request fail?" with a concrete symptom |

If you're not sure which side you're on: a concrete error/URL/status code → `insforge-debug`. A general "look for problems" → here.

## Run a Scan First

Every workflow in this skill starts from a fresh advisor scan. The scan aggregates checks across security, performance, and health categories and ranks each issue by severity.

```bash
npx @insforge/cli diagnose advisor
```

By default the latest scan summary plus up to 50 issues is shown. Narrow with `--severity` and `--category`:

```bash
# Only critical issues (start here in any audit)
npx @insforge/cli diagnose advisor --severity critical

# Security category only
npx @insforge/cli diagnose advisor --category security

# JSON for full issue payload (ruleId, affectedObject, recommendation, isResolved)
npx @insforge/cli diagnose advisor --json
```

Each issue object includes `ruleId`, `severity`, `category`, `title`, `description`, `affectedObject`, and `recommendation`. Read `affectedObject` to know which table/policy/secret/resource the issue is about before drilling in.

> **Note**: `diagnose advisor` requires InsForge Platform login. It is not available on projects linked via `--api-key`.

## Quick Triage

Match the issue's `category` to a deep-dive section.

| Issue category | Deep-dive section |
|----------------|-------------------|
| `security` (RLS, exposed config, secrets) | [Security Audit](#security-audit) |
| `performance` (slow queries, indexes, bloat) | [Performance Audit](#performance-audit) |
| `health` (connections, locks, system metrics) | [System Health Audit](#system-health-audit) |

For a mixed report or a "what should I fix first?" question, work through critical issues across all categories before warnings.

---

## Security Audit

**Triggers**: advisor issues with `category=security`, or a request like "review RLS", "audit auth config", "any secrets exposed?".

### Steps

1. List security issues from the latest scan:

```bash
npx @insforge/cli diagnose advisor --category security
```

2. For each RLS-related issue (`affectedObject` is a table name or policy), inspect the live policies on that table:

```bash
npx @insforge/cli db policies
```

3. Verify the project's auth configuration matches expectation (providers enabled, redirect URLs, JWT settings):

```bash
npx @insforge/cli metadata --json
```

4. For secrets-related issues, list current secrets (names only — values are not printed unless explicitly requested) and check for ones marked `--reserved` or with expired `--expires`:

```bash
npx @insforge/cli secrets list --all
```

5. If an advisor `ruleId` flags exposure (e.g., public bucket holding sensitive data, RLS disabled on a user-data table), confirm the affected object's actual state before recommending a change — do not blindly apply advisor's recommendation.

**Information gathered**: active RLS policies, auth providers and redirect URLs, secret inventory, ground-truth state of every `affectedObject` flagged by advisor.

---

## Performance Audit

**Triggers**: advisor issues with `category=performance`, or a request like "find slow queries", "do I have missing indexes?", "is my DB bloated?".

### Steps

1. List performance issues:

```bash
npx @insforge/cli diagnose advisor --category performance
```

2. Pull the full database performance picture — slow queries, index efficiency, bloat, cache hit ratio, size:

```bash
npx @insforge/cli diagnose db --check slow-queries,index-usage,bloat,cache-hit,size
```

3. For a specific table flagged by `affectedObject`, inspect it directly with SQL:

```bash
npx @insforge/cli db query "SELECT pg_size_pretty(pg_total_relation_size('<table>')) AS total_size, pg_size_pretty(pg_indexes_size('<table>')) AS indexes_size"
```

4. Cross-check against EC2 instance metrics — a "slow query" report can also be CPU/memory pressure, not the query itself:

```bash
npx @insforge/cli diagnose metrics --range 6h
```

5. If the issue is index-related, look at actual index usage via postgres logs to see whether the missing index is being hit at runtime:

```bash
npx @insforge/cli logs postgres.logs --limit 50
```

**Information gathered**: slow query plans, index usage, table bloat, cache hit ratio, current EC2 resource utilization, postgres query patterns.

---

## System Health Audit

**Triggers**: advisor issues with `category=health`, or a request like "is my backend healthy?", "any locks?", "connection pool OK?", "EC2 looking right?".

### Steps

1. List health issues:

```bash
npx @insforge/cli diagnose advisor --category health
```

2. Run the full database health sweep — connections, locks, and other live state:

```bash
npx @insforge/cli diagnose db --check connections,locks
```

3. Pull EC2 instance metrics over a meaningful window (default 1h; widen for trend):

```bash
npx @insforge/cli diagnose metrics --range 24h
```

4. Aggregate error logs to see whether health issues correlate with recent error spikes:

```bash
npx @insforge/cli diagnose logs
```

5. If connection-pool exhaustion or lock contention is flagged, drill into postgres logs around the scan time:

```bash
npx @insforge/cli logs postgres.logs --limit 100
```

**Information gathered**: connection pool state, lock contention, CPU/memory/disk/network metrics with trend, error log summary, postgres-level activity.

---

## Iteration Workflow

Advisor issues persist across scans until resolved (issue objects carry `isResolved`). The recommended audit loop:

1. **Scan** — `diagnose advisor --severity critical` to get the working set.
2. **Drill** — for each issue, use the relevant deep-dive section above to verify the live state matches advisor's report.
3. **Decide** — only proceed to a fix after you've confirmed the issue is real. Advisor surfaces rule violations; whether they're business-relevant is a judgment call.
4. **Fix** — apply the change (RLS edit, index, query rewrite, etc.) via `insforge-cli`.
5. **Re-scan** — run `diagnose advisor` again. The fixed issue should appear with `isResolved: true` on the next scheduled scan, or drop off the active set.

Do not rely on the same scan twice across a fix — always re-scan after applying changes.

---

## Command Quick Reference

### Advisor scan

```bash
npx @insforge/cli diagnose advisor [--severity critical|warning|info] [--category security|performance|health] [--limit <n>] [--json]
```

Default `--limit` is 50. `--json` returns scan summary + full issue objects (with `ruleId`, `recommendation`, `isResolved`).

### Backend deep-dive

```bash
# Database health checks
npx @insforge/cli diagnose db [--check connections,slow-queries,bloat,size,index-usage,locks,cache-hit]

# EC2 instance metrics
npx @insforge/cli diagnose metrics [--range 1h|6h|24h|7d] [--metrics <list>]

# Aggregate error logs from all sources
npx @insforge/cli diagnose logs [--source <name>] [--limit <n>]

# Postgres-level logs
npx @insforge/cli logs postgres.logs --limit 50
```

### Supporting

```bash
# Project metadata (auth config, tables, buckets, functions, RLS policies)
npx @insforge/cli metadata --json

# Live RLS policies
npx @insforge/cli db policies

# Ad-hoc SQL against the project
npx @insforge/cli db query "<sql>"

# Secrets inventory
npx @insforge/cli secrets list --all
```

For reactive debugging (a concrete error, status code, or failing URL), switch to `insforge-debug`.
