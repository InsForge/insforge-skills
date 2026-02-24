# insforge deployments deploy

Deploy a frontend project to InsForge hosting (via Vercel).

## Syntax

```bash
insforge deployments deploy [directory] [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--env <vars>` | Environment variables as JSON: `'{"KEY":"value"}'` |
| `--meta <meta>` | Metadata as JSON |

## Default Directory

Current directory (`.`) if not specified.

## What It Does

1. Creates a deployment record (gets presigned upload URL)
2. Zips the source directory (max compression)
3. Uploads the zip to the presigned URL
4. Starts the deployment with env vars and metadata
5. Polls status every 5 seconds for up to 2 minutes
6. Returns the live URL and deployment ID

## Excluded Files

The following are automatically excluded from the zip:
- `node_modules/`, `.git/`, `.next/`, `dist/`, `build/`
- `.env*`, `.DS_Store`, `.insforge/`, `*.log`

## Examples

```bash
# Deploy current directory
insforge deployments deploy

# Deploy a specific directory
insforge deployments deploy ./dist

# Deploy with environment variables
insforge deployments deploy . --env '{"VITE_API_URL": "https://my-app.us-east.insforge.app", "VITE_ANON_KEY": "ik_xxx"}'

# JSON output
insforge deployments deploy --json
```

## Typical Workflow

```bash
# 1. Build locally first
npm run build

# 2. Deploy
insforge deployments deploy ./dist --env '{"VITE_API_URL": "https://my-app.us-east.insforge.app"}'
```

## Notes

- **Always build locally first** to catch errors before deploying.
- Use the correct env var prefix for your framework: `VITE_*`, `NEXT_PUBLIC_*`, `REACT_APP_*`, etc.
- If the build times out (>2 minutes), check status with `insforge deployments status <id>`.
