# Deployments Workflow

Deploy frontend applications to InsForge hosting. This is a multi-step process.

## Authentication

All endpoints require:
```
Authorization: Bearer {admin-token-or-api-key}
```

## Pre-Deployment: Local Build Verification

**CRITICAL: Always verify local build succeeds before deploying to InsForge.**

Local builds are faster to debug and don't waste server resources on avoidable errors.

### Local Build Checklist

```bash
# 1. Install dependencies
npm install

# 2. Create production environment file
# Use the correct prefix for your framework:
# - Vite: VITE_INSFORGE_URL
# - Next.js: NEXT_PUBLIC_INSFORGE_URL
# - CRA: REACT_APP_INSFORGE_URL
# - Astro: PUBLIC_INSFORGE_URL
cat > .env.production << 'EOF'
INSFORGE_URL=https://your-project.insforge.app
INSFORGE_ANON_KEY=your-anon-key
EOF

# 3. Run production build
npm run build
```

### Common Build Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Missing env var errors | Build-time env vars not set | Create `.env.production` with framework-specific prefix |
| Module resolution errors | Edge functions scanned by compiler | Exclude edge function directories from build config |
| Static export conflicts | Dynamic routes with static export | Use SSR or configure static params per framework docs |
| `module_not_found` | Missing dependency | Run `npm install` and verify package.json |

### Framework-Specific Notes

**Environment Variables by Framework:**

| Framework | Prefix | Example |
|-----------|--------|---------|
| Vite | `VITE_` | `VITE_INSFORGE_URL` |
| Next.js | `NEXT_PUBLIC_` | `NEXT_PUBLIC_INSFORGE_URL` |
| Create React App | `REACT_APP_` | `REACT_APP_INSFORGE_URL` |
| Astro | `PUBLIC_` | `PUBLIC_INSFORGE_URL` |
| SvelteKit | `PUBLIC_` | `PUBLIC_INSFORGE_URL` |

**Edge Functions:**
If your project has edge functions in a separate directory (commonly `functions/` for Deno-based functions), exclude them from your frontend build to prevent module resolution errors. Add the directory to your TypeScript or bundler exclude configuration.

## Deployment Flow

### Step 1: Create Deployment Record

Creates a deployment record and returns a presigned upload URL.

```
POST /api/deployments
Authorization: Bearer {admin-token}
```

Response:
```json
{
  "id": "deployment-uuid",
  "uploadUrl": "https://s3.amazonaws.com/...",
  "uploadFields": {
    "key": "...",
    "policy": "...",
    "x-amz-signature": "...",
    ...
  }
}
```

### Step 2: Zip and Upload Source Code

**Zip the project directory**, excluding:

| Exclude | Reason |
|---------|--------|
| `node_modules/` | Installed during build |
| `.git/` | Not needed |
| `.env*` | Pass via envVars instead |
| `dist/`, `build/`, `.next/` | Rebuilt during deployment |

**Upload to presigned URL** using multipart form POST:
- Include all fields from `uploadFields` in the form data
- Add the zip file as `file` field **last** (order matters for S3)

### Step 3: Start Deployment

Trigger the build and deployment process.

```
POST /api/deployments/{id}/start
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "projectSettings": {
    "buildCommand": "npm run build",
    "outputDirectory": "dist",
    "installCommand": "npm install"
  },
  "envVars": [
    { "key": "VITE_INSFORGE_BASE_URL", "value": "https://your-project.insforge.app" },
    { "key": "VITE_INSFORGE_ANON_KEY", "value": "your-anon-key" }
  ]
}
```

#### Project Settings by Framework

| Framework | buildCommand | outputDirectory | installCommand |
|-----------|--------------|-----------------|----------------|
| **Vite (React/Vue)** | `npm run build` | `dist` | `npm install` |
| **Create React App** | `npm run build` | `build` | `npm install` |
| **Next.js** | `npm run build` | `.next` | `npm install` |
| **Astro** | `npm run build` | `dist` | `npm install` |
| **SvelteKit** | `npm run build` | `build` | `npm install` |

| Parameter | Description |
|-----------|-------------|
| `buildCommand` | Command to build the project |
| `outputDirectory` | Directory containing built files |
| `installCommand` | Command to install dependencies |
| `rootDirectory` | Subdirectory containing package.json (optional, for monorepos) |

#### Environment Variables

Pass all required build-time environment variables. Variable prefix depends on framework:

| Framework | Env Var Prefix | Example |
|-----------|----------------|---------|
| **Vite** | `VITE_` | `VITE_INSFORGE_BASE_URL` |
| **Create React App** | `REACT_APP_` | `REACT_APP_INSFORGE_BASE_URL` |
| **Next.js** | `NEXT_PUBLIC_` | `NEXT_PUBLIC_INSFORGE_BASE_URL` |

**Example for Vite:**
```json
[
  { "key": "VITE_INSFORGE_BASE_URL", "value": "https://your-project.insforge.app" },
  { "key": "VITE_INSFORGE_ANON_KEY", "value": "your-anon-key" }
]
```

### Step 4: Check Deployment Status

Wait 30 seconds to 1 minute, then check status.

**Via API:**
```
GET /api/deployments/{id}
Authorization: Bearer {admin-token}
```

**Via raw SQL:**
```sql
SELECT id, status, url, created_at
FROM system.deployments
WHERE id = '{deployment-id}'
```

**Or sync status from provider:**
```
POST /api/deployments/{id}/sync
Authorization: Bearer {admin-token}
```

### Status Values

| Status | Description |
|--------|-------------|
| `WAITING` | Waiting for source upload |
| `UPLOADING` | Uploading to build server |
| `QUEUED` | Queued for build |
| `BUILDING` | Building (typically ~1 min) |
| `READY` | Complete - URL available |
| `ERROR` | Build or deployment failed |
| `CANCELED` | Deployment cancelled |

## SPA Routing

For React, Vue, etc. single-page apps, add `vercel.json` to project root:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

## Quick Reference

### MCP Tools

| Task | MCP Tool | Notes |
|------|----------|-------|
| Get project info | `get-backend-metadata` | Returns tables, functions, config |
| Get anon key | `get-anon-key` | Returns JWT for client auth |
| Deploy app | `create-deployment` | Requires local build to pass first |
| Check status | `run-raw-sql` | Query `system.deployments` table |
| View logs | `get-container-logs` | Debug build failures |

### HTTP API Endpoints

| Task | Endpoint |
|------|----------|
| Create deployment | `POST /api/deployments` |
| Start deployment | `POST /api/deployments/{id}/start` |
| Get deployment | `GET /api/deployments/{id}` |
| List deployments | `GET /api/deployments` |
| Sync status | `POST /api/deployments/{id}/sync` |
| Cancel deployment | `POST /api/deployments/{id}/cancel` |

---

## Best Practices

1. **Exclude unnecessary files from zip**
   - Never include `node_modules`, `.git`, `.env`, or build output
   - Large assets should go to InsForge Storage, not the deployment

2. **Pass sensitive values via envVars, not in code**
   - API keys, secrets should be in `envVars` array
   - Never commit `.env` files to source or include in zip

3. **Include vercel.json for SPAs**
   - Required for client-side routing to work properly

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Including node_modules in zip | Exclude it - will be installed during build |
| Including .env files | Pass via `envVars` parameter instead |
| Missing VITE_* env vars | Add all required build-time variables to `envVars` |
| Checking status too early | Wait 30sec-1min before checking status |
| Missing vercel.json for SPA | Add rewrites config for client-side routing |

## Recommended Workflow

### With MCP Tools (Recommended)

```
1. Try MCP get-backend-metadata → Verify credentials auto-configured
2. If MCP succeeds              → Extract project URL from metadata
3. If MCP fails                 → Ask user for Project URL and API Key
4. Local build check            → npm run build with .env.production
5. Fix any build errors         → See Common Build Errors table above
6. Create deployment            → Use create-deployment MCP tool
7. Check deployment status      → Query system.deployments table
8. Get URL when READY           → Access deployed application
```

### Manual API Flow

```
1. Create deployment         → POST /api/deployments (get uploadUrl, id)
2. Zip source code           → Exclude node_modules, .git, .env, dist
3. Upload zip                → POST to uploadUrl with uploadFields
4. Start deployment          → POST /api/deployments/{id}/start with envVars
5. Wait 30sec-1min           → Build takes time
6. Check status              → GET /api/deployments/{id} or sync
7. Get URL when READY        → url field in response
```

### Key Principle: Local Build First

**Why local builds matter:**
- **Faster feedback**: Local builds fail in seconds vs. minutes for remote builds
- **Resource efficiency**: Prevents wasting server resources on avoidable errors
- **Easier debugging**: Full error output and stack traces visible locally
- **Faster iteration**: Fix issues locally before deploying

**Always run `npm run build` locally before using `create-deployment`.**
