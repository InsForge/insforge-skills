# npx @insforge/cli compute deploy

Build a Dockerfile and deploy it as a compute service using `flyctl deploy`.

## Syntax

```bash
npx @insforge/cli compute deploy [directory] [options]
```

## Prerequisites

- **`flyctl` CLI** must be installed: `brew install flyctl` or `curl -L https://fly.io/install.sh | sh`
- **`FLY_API_TOKEN`** environment variable must be set: `export FLY_API_TOKEN=<your-token>`
- A **Dockerfile** must exist in the target directory

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `[directory]` | Path to directory containing the Dockerfile | current directory |
| `--name <name>` | Service name (DNS-safe) | **required** |
| `--port <port>` | Container internal port | auto-detect from `fly.toml` or `8080` |
| `--cpu <tier>` | CPU tier | auto-detect from `fly.toml` or `shared-1x` |
| `--memory <mb>` | Memory in MB | auto-detect from `fly.toml` or `512` |
| `--region <region>` | Fly.io region | auto-detect from `fly.toml` or `iad` |
| `--env <json>` | Environment variables as JSON | none |

## What It Does

1. Checks `flyctl` is installed and `FLY_API_TOKEN` is set
2. Verifies a Dockerfile exists in the target directory
3. Reads existing `fly.toml` for default values (port, CPU, memory, region)
4. Checks if a service with this name already exists (redeploy) or creates a new one
5. **For new services:** calls the backend's `/api/compute/services/deploy` endpoint which creates a Fly app (no machine)
6. Backs up any existing `fly.toml` and generates a temporary one for the deploy
7. Runs `flyctl deploy --remote-only` to build and push the Docker image on Fly's builders
8. Calls `/api/compute/services/:id/sync` to sync the machine ID and status back to InsForge
9. Restores the original `fly.toml` (if one existed)

## Examples

```bash
# Deploy from current directory
npx @insforge/cli compute deploy --name my-api

# Deploy from a specific directory
npx @insforge/cli compute deploy ./my-service --name my-api --port 8000

# Deploy with custom resources
npx @insforge/cli compute deploy ./api \
  --name audio-analyzer \
  --port 8000 \
  --cpu performance-1x \
  --memory 2048 \
  --region sin

# Redeploy (existing service gets updated)
npx @insforge/cli compute deploy ./api --name audio-analyzer
```

## fly.toml Auto-Detection

If the target directory contains a `fly.toml`, the command reads it for defaults:

| fly.toml field | CLI option | Precedence |
|---------------|------------|------------|
| `internal_port` in `[http_service]` | `--port` | CLI wins if specified |
| `primary_region` | `--region` | CLI wins if specified |
| `memory` in `[[vm]]` | `--memory` | CLI wins if specified |
| `cpu_kind` + `cpus` in `[[vm]]` | `--cpu` | CLI wins if specified |

The original `fly.toml` is backed up during deploy and restored afterward. The generated `fly.toml` used for the deploy is temporary.

## Create vs Deploy

| | `compute create` | `compute deploy` |
|---|---|---|
| **Input** | Pre-built Docker image from registry | Dockerfile in local directory |
| **Requires flyctl** | No | Yes |
| **Requires FLY_API_TOKEN** | No (backend has it) | Yes (local flyctl needs it) |
| **Build** | None (image pulled by Fly) | Remote build on Fly's builders |
| **Use when** | Image already in registry | Building from source |

## Output

Text mode:
```
Checking for existing service "audio-analyzer"...
Creating service "audio-analyzer"...
Building and deploying (this may take a few minutes)...
Syncing deployment info...
Service "audio-analyzer" deployed [running]
  Endpoint: https://audio-analyzer-default.fly.dev
```

JSON mode (`--json`): same schema as `compute create` output.

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `flyctl is not installed` | Missing CLI | Install: `brew install flyctl` |
| `FLY_API_TOKEN environment variable is required` | Missing token | Set: `export FLY_API_TOKEN=<token>` |
| `No Dockerfile found in <dir>` | Wrong directory | Check path, ensure Dockerfile exists |
| `flyctl deploy failed with exit code N` | Build or deploy error | Check flyctl output for details (shown in terminal) |

## Notes

- The build happens on Fly's remote builders, not locally. Your machine doesn't need Docker installed.
- For redeploys (service already exists), the command skips the create step and goes straight to `flyctl deploy`.
- The `--env` flag sets env vars in the InsForge database. These are passed to the Fly machine at launch. To set Fly-specific secrets, use `flyctl secrets set` directly.
- Deploy can take 1-5 minutes depending on image size and build complexity.
