---
name: insforge-cli
description: Create and manage InsForge projects using the CLI. Handles authentication, project setup, database management, edge functions, storage, deployments, and secrets. For writing application code with the InsForge SDK, use the insforge (SDK) skill instead.
license: Apache-2.0
metadata:
  author: insforge
  version: "1.0.0"
  organization: InsForge
  date: February 2026
---

# InsForge CLI

Command-line tool for managing InsForge Backend-as-a-Service projects.

## Installation

```bash
npm install -g @insforge/cli
```

## Critical: Session Start Checks

```bash
insforge whoami    # verify authentication
insforge current   # verify linked project
```

If not authenticated: `insforge login`
If no project linked: `insforge create` (new) or `insforge link` (existing)

## Global Options

| Flag | Description |
|------|-------------|
| `--json` | Structured JSON output (for scripts and agents) |
| `--project-id <id>` | Override linked project ID |
| `-y, --yes` | Skip confirmation prompts |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
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
- `insforge login` — OAuth (browser) or `--email` for password login. See [references/login.md](references/login.md)
- `insforge logout` — clear stored credentials
- `insforge whoami` — show current user

### Project Management
- `insforge create` — create new project. See [references/create.md](references/create.md)
- `insforge link` — link directory to existing project
- `insforge current` — show current user + linked project
- `insforge list` — list all orgs and projects

### Database — `insforge db`
- `insforge db query <sql>` — execute raw SQL. See [references/db-query.md](references/db-query.md)
- `insforge db tables / indexes / policies / triggers / functions` — inspect schema
- `insforge db rpc <fn> [--data <json>]` — call database function (GET if no data, POST if data)
- `insforge db export` — export schema/data. See [references/db-export.md](references/db-export.md)
- `insforge db import <file>` — import from SQL file. See [references/db-import.md](references/db-import.md)

### Edge Functions — `insforge functions`
- `insforge functions list` — list deployed functions
- `insforge functions code <slug>` — view function source
- `insforge functions deploy <slug>` — deploy or update. See [references/functions-deploy.md](references/functions-deploy.md)
- `insforge functions invoke <slug> [--data <json>] [--method GET|POST]` — invoke function

### Storage — `insforge storage`
- `insforge storage buckets` — list buckets
- `insforge storage create-bucket <name> [--private]` — create bucket (default: public)
- `insforge storage delete-bucket <name>` — delete bucket and **all its objects** (destructive)
- `insforge storage list-objects <bucket> [--prefix] [--search] [--limit] [--sort]` — list objects
- `insforge storage upload <file> --bucket <name> [--key <objectKey>]` — upload file
- `insforge storage download <objectKey> --bucket <name> [--output <path>]` — download file

### Deployments — `insforge deployments`
- `insforge deployments deploy [dir]` — deploy frontend app. See [references/deployments-deploy.md](references/deployments-deploy.md)
- `insforge deployments list` — list deployments
- `insforge deployments status <id> [--sync]` — get deployment status (--sync fetches from Vercel)
- `insforge deployments cancel <id>` — cancel running deployment

### Secrets — `insforge secrets`
- `insforge secrets list [--all]` — list secrets (values hidden; `--all` includes deleted)
- `insforge secrets get <key>` — get decrypted value
- `insforge secrets add <key> <value> [--reserved] [--expires <ISO date>]` — create secret
- `insforge secrets update <key> [--value] [--active] [--reserved] [--expires]` — update secret
- `insforge secrets delete <key>` — **soft delete** (marks inactive; restore with `--active true`)

### Documentation — `insforge docs`
- `insforge docs` — list all topics
- `insforge docs instructions` — setup guide
- `insforge docs <feature> <language>` — feature docs (`db / storage / functions / auth / ai / realtime` × `typescript / swift / kotlin / rest-api`)

---

## Non-Obvious Behaviors

**Functions invoke URL**: invoked at `{oss_host}/functions/{slug}` — NOT `/api/functions/{slug}`. Exits with code 1 on HTTP 400+.

**Secrets delete is soft**: marks the secret inactive, not destroyed. Restore with `insforge secrets update KEY --active true`. Use `--all` with `secrets list` to see inactive ones.

**Storage delete-bucket is hard**: deletes the bucket and every object inside it permanently.

**db rpc uses GET or POST**: no `--data` → GET; with `--data` → POST.

---

## Common Workflows

### Set up database schema

```bash
insforge db query "CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
)"
insforge db query "ALTER TABLE posts ENABLE ROW LEVEL SECURITY"
insforge db query "CREATE POLICY \"public_read\" ON posts FOR SELECT USING (true)"
insforge db query "CREATE POLICY \"owner_write\" ON posts FOR INSERT WITH CHECK (auth.uid() = author_id)"
```

> FK to users: always `auth.users(id)`. RLS current user: `auth.uid()`.

### Deploy an edge function

```bash
# Default source path: insforge/functions/{slug}/index.ts
insforge functions deploy my-handler
insforge functions invoke my-handler --data '{"action": "test"}'
```

### Deploy frontend

```bash
npm run build
insforge deployments deploy ./dist --env '{"VITE_API_URL": "https://my-app.us-east.insforge.app"}'
```

> Always build locally first. Env var prefix depends on framework: `VITE_*`, `NEXT_PUBLIC_*`, `REACT_APP_*`.

### Backup and restore database

```bash
insforge db export --output backup.sql
insforge db import backup.sql
```

### Non-interactive CI/CD

```bash
INSFORGE_EMAIL=$EMAIL INSFORGE_PASSWORD=$PASSWORD insforge login --email -y
insforge link --project-id $PROJECT_ID --org-id $ORG_ID -y
insforge db query "SELECT count(*) FROM users" --json
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
