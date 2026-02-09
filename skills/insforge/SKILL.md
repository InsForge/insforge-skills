---
name: insforge
description: |
  Build applications with InsForge Backend-as-a-Service. Use when developers need to:
  (1) Set up backend infrastructure (create tables, storage buckets, deploy functions, configure auth/AI)
  (2) Integrate InsForge SDK into frontend applications (database CRUD, auth flows, file uploads, AI operations, real-time messaging)
  (3) Deploy frontend applications to InsForge hosting

  IMPORTANT: Before any backend work, you MUST have the user's Project URL and API Key. If not provided, ask the user first.

  Key distinction: Backend configuration uses HTTP API calls to the InsForge project URL. Client integration uses the @insforge/sdk in application code.
license: MIT
metadata:
  author: insforge
  version: "1.1.0"
  organization: InsForge
  date: February 2026
---

# InsForge Agent Skill

## Credential Detection (MCP Mode)

**When using MCP tools**, credentials are often pre-configured. Before asking the user:

1. **Try calling MCP tools first**: Attempt `get-backend-metadata` or `get-anon-key`
2. **If MCP succeeds**: Credentials are already configured, proceed with work
3. **If MCP fails with auth error**: Then ask user for Project URL and API Key

```
Example: User says "deploy to insforge"
✓ Try: get-backend-metadata via MCP
✓ If success: Extract project URL from metadata, get anon key via get-anon-key
✗ If fail: Ask user for credentials
```

## STOP: Check Credentials First (Manual Mode)

**Only ask for credentials if MCP auto-detection fails.** You need:

| Credential | Format | Required For |
|------------|--------|--------------|
| **Project URL** | `https://{project-id}.{region}.insforge.app` | All API calls |
| **API Key** | `ik_xxxx...` | Authorization header |

**Action:** If MCP tools fail and user has not provided credentials, ask now:

```
Do you have an InsForge project? I'll need:
1. Project URL (e.g., https://abc123.us-east-1.insforge.app)
2. API Key (starts with ik_)

You can find these in InsForge Dashboard → Project Settings.
```

---

## When to Use Which Documentation

### Use `sdk-integration.md` files when:
- Integrating InsForge services into the **user's frontend application**
- Implementing features that run in the browser or client app
- Writing code that uses `@insforge/sdk` methods
- Examples: User login flow, fetching data, uploading files, real-time subscriptions

### Use `backend-configuration.md` files when:
- **Configuring the InsForge backend** before the app can use a feature
- Creating database tables, storage buckets, or deploying serverless functions
- Setting up real-time channels or database triggers
- Managing auth settings, AI configurations, or deployments
- Examples: Creating a `posts` table, enabling OAuth providers, deploying an edge function

## Typical Workflow

1. **Backend Configuration** → Configure infrastructure via HTTP API
2. **SDK Integration** → Use SDK in application code

**Example: Adding file uploads**
1. First create a storage bucket → see [storage/backend-configuration.md](storage/backend-configuration.md)
2. Then implement upload in the app → see [storage/sdk-integration.md](storage/sdk-integration.md)

**Example: Adding user authentication**
1. First configure auth settings → see [auth/backend-configuration.md](auth/backend-configuration.md)
2. Then implement login/signup → see [auth/sdk-integration.md](auth/sdk-integration.md)

## First Step: Get Backend Metadata

**Always get the backend metadata first** before doing any work. This gives you the complete picture of the current project structure.

```
GET /api/metadata
Authorization: Bearer {admin-token-or-api-key}
```

This returns the full backend state including:
- **Database**: Tables, columns, relationships, indexes, RLS policies
- **Auth**: Configuration, OAuth providers, user stats
- **Storage**: Buckets and visibility settings
- **Functions**: Deployed functions and status
- **AI**: Configured models
- **Realtime**: Channel patterns

Understanding the existing backend structure before making changes prevents errors and helps you build on what's already there.

## Quick Setup

```bash
npm install @insforge/sdk@latest
```

```javascript
import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: 'https://your-project.region.insforge.app',
  anonKey: 'your-anon-key'
})
```

## Module Reference

| Module | SDK Integration | Backend Configuration |
|--------|-----------------|----------------------|
| **Database** | [database/sdk-integration.md](database/sdk-integration.md) | [database/backend-configuration.md](database/backend-configuration.md) |
| **Auth** | [auth/sdk-integration.md](auth/sdk-integration.md) | [auth/backend-configuration.md](auth/backend-configuration.md) |
| **Storage** | [storage/sdk-integration.md](storage/sdk-integration.md) | [storage/backend-configuration.md](storage/backend-configuration.md) |
| **Functions** | [functions/sdk-integration.md](functions/sdk-integration.md) | [functions/backend-configuration.md](functions/backend-configuration.md) |
| **AI** | [ai/sdk-integration.md](ai/sdk-integration.md) | [ai/backend-configuration.md](ai/backend-configuration.md) |
| **Real-time** | [realtime/sdk-integration.md](realtime/sdk-integration.md) | [realtime/backend-configuration.md](realtime/backend-configuration.md) |
| **Schedules** | — | [schedules/backend-configuration.md](schedules/backend-configuration.md) |
| **Deployments** | — | [deployments/workflow.md](deployments/workflow.md) |
| **Logs** | — | [logs/debugging.md](logs/debugging.md) |

### What Each Module Covers

| Module | sdk-integration.md | backend-configuration.md |
|--------|-------------------|-------------------------|
| **Database** | CRUD operations, filters, pagination | Create tables, RLS policies, triggers, indexes |
| **Auth** | Sign up/in, OAuth, sessions, profiles | Auth config, user management, anon tokens |
| **Storage** | Upload, download, delete files | Create/manage buckets |
| **Functions** | Invoke functions | Deploy, update, delete functions |
| **AI** | Chat, images, embeddings | Models, credits, usage stats |
| **Real-time** | Connect, subscribe, publish events | Channel patterns, database triggers |
| **Schedules** | — | Cron jobs, HTTP triggers, execution logs |
| **Deployments** | — | Deploy frontend apps |
| **Logs** | — | Fetch container logs for debugging |

## SDK Quick Reference

All SDK methods return `{ data, error }`.

| Module | Methods |
|--------|---------|
| `insforge.database` | `.from().select()`, `.insert()`, `.update()`, `.delete()`, `.rpc()` |
| `insforge.auth` | `.signUp()`, `.signInWithPassword()`, `.signInWithOAuth()`, `.signOut()`, `.getCurrentSession()` |
| `insforge.storage` | `.from().upload()`, `.uploadAuto()`, `.download()`, `.remove()` |
| `insforge.functions` | `.invoke()` |
| `insforge.ai` | `.chat.completions.create()`, `.images.generate()`, `.embeddings.create()` |
| `insforge.realtime` | `.connect()`, `.subscribe()`, `.publish()`, `.on()`, `.disconnect()` |

## Backend API Quick Reference

**Base URL**: `https://your-project.region.insforge.app`

**Authentication**: `Authorization: Bearer {admin-token-or-api-key}`

| Task | Endpoint |
|------|----------|
| Execute SQL | `POST /api/database/advance/rawsql` |
| Create bucket | `POST /api/storage/buckets` |
| Deploy function | `POST /api/functions` |
| Configure auth | `PUT /api/auth/config` |
| Get metadata | `GET /api/metadata` |
| Create schedule | `POST /api/schedules` |
| Deploy frontend | `POST /api/deployments` |
| Get logs | `GET /api/logs/{source}` |

## Deployment Best Practices

### ALWAYS: Local Build First

**Before deploying to InsForge, verify the build works locally.** Local builds are faster to debug and don't waste server resources on avoidable errors.

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables for your framework
cp .env.example .env.local  # or create .env.production

# 3. Run production build
npm run build
```

**Common build-time issues to fix before deploying:**

| Issue | Common Cause | General Solution |
|-------|--------------|------------------|
| Missing environment variables | Build-time env vars not set | Create `.env.production` with required variables |
| Module resolution errors | Edge functions mixed with app code | Exclude edge function directories from TypeScript/compiler config |
| Static export conflicts | Dynamic routes with static export | Use server-side rendering or configure static params |
| Missing dependencies | Incomplete node_modules | Run `npm install` and verify package.json |

### Framework-Specific Notes

- **Environment Variable Prefix**: Use the correct prefix for your framework:
  - Vite: `VITE_*`
  - Next.js: `NEXT_PUBLIC_*`
  - Create React App: `REACT_APP_*`
  - Astro: `PUBLIC_*`

- **Edge Functions**: If your project has Deno/edge functions in a separate directory (commonly `functions/`), exclude them from your frontend build to avoid module resolution errors.

### Deployment Checklist

- [ ] Local `npm run build` succeeds
- [ ] All required environment variables configured for production
- [ ] Edge function directories excluded from frontend build (if applicable)
- [ ] Build output directory matches your framework's expected output

## Important Notes

- **Database inserts require array format**: `insert([{...}])` not `insert({...})`
- **Storage**: Save both `url` AND `key` to database for download/delete operations
- **Functions invoke URL**: `/functions/{slug}` (without `/api` prefix)
- **Use Tailwind CSS v3.4** (do not upgrade to v4)
- **Always local build before deploy**: Prevents wasted build resources and faster debugging
