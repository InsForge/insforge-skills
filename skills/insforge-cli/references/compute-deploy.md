# npx @insforge/cli compute deploy — backend container (image OR Dockerfile)

> ⚠️ **In progress.** Compute services are still in development; the API and CLI may change.

> 🔧 **DO NOT call `flyctl` directly to manage InsForge compute services.**
> InsForge runs containers on Fly.io under the hood, but the Fly account, org,
> IPs, and machine ownership all live on the InsForge cloud. Using `flyctl`
> with your own credentials will land in the wrong Fly org and fail with
> `unauthorized` — even if you have a valid Fly account. Use these `compute …`
> commands instead; they bridge InsForge↔Fly for you (including fetching a
> scoped deploy token transparently). The only place `flyctl` runs at all is
> internally during the build step of mode 2, using a token InsForge mints.

Deploy a backend compute service. **One command, two modes:**

| Mode | When | Command shape |
|---|---|---|
| **Pre-built image** | You already have an image in a registry (`nginx:alpine`, `ghcr.io/...`) | `compute deploy --image <url> --name <name>` |
| **Build from Dockerfile** | You have source code with a Dockerfile | `compute deploy [directory] --name <name>` |

> Looking to deploy a **frontend** (static site / SPA / Next.js to Vercel)? Use
> `npx @insforge/cli deployments deploy` instead — see
> [deployments-deploy.md](deployments-deploy.md).

## Syntax

```bash
npx @insforge/cli compute deploy [directory] [options]
```

`[directory]` is optional and defaults to cwd when in **build-from-Dockerfile** mode. Cannot be combined with `--image`.

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--name <name>` | Service name (DNS-safe) | **required** |
| `--image <url>` | Pre-built Docker image URL. Switches to image mode (no build, no flyctl). | (none — triggers build mode) |
| `--port <port>` | Container internal port | `8080` (image mode) or auto-detect from `fly.toml` |
| `--cpu <tier>` | CPU tier in Fly.io standard format `<kind>-<N>x` (see [CPU tier section](#cpu-tier-flyio-standard-format)) | `shared-1x` |
| `--memory <mb>` | Memory in MB (any positive integer; Fly enforces per-tier bounds) | `512` |
| `--region <region>` | Fly.io region | `iad` |
| `--env <json>` | Environment variables as JSON object | none |

## Mode 1: Pre-built image

No build, no `flyctl`, no Docker locally. Backend pulls the image from your registry directly.

```bash
# Off-the-shelf image
npx @insforge/cli compute deploy --image nginx:alpine --name proxy --port 80

# Custom image from your registry
npx @insforge/cli compute deploy \
  --image ghcr.io/myorg/audio-analyzer:latest \
  --name audio-api \
  --port 8000 \
  --cpu performance-1x \
  --memory 2048 \
  --env '{"HF_TOKEN": "hf_abc123"}'
```

Speed: ~5 seconds. Endpoint URL printed when deploy completes.

## Mode 2: Build from Dockerfile

Builds the image on Fly's remote builders, deploys via `flyctl deploy --remote-only`. Requires `flyctl` installed locally; the Fly access token is fetched automatically from the InsForge backend (you do **NOT** need a Fly account).

### Prerequisites
- **`flyctl` CLI** installed: `brew install flyctl` or `curl -L https://fly.io/install.sh | sh`
- A **Dockerfile** in the target directory

### Examples

```bash
# Deploy from current directory
npx @insforge/cli compute deploy --name my-api

# Deploy from a specific directory
npx @insforge/cli compute deploy ./my-service --name my-api --port 8000

# 8 cores + 4 GB RAM (e.g. CPU-bound batch worker)
npx @insforge/cli compute deploy ./batch-worker \
  --name batch-worker \
  --cpu performance-8x --memory 4096

# Redeploy (existing service gets updated)
npx @insforge/cli compute deploy ./api --name audio-analyzer
```

### fly.toml auto-detection

If the target directory contains a `fly.toml`, the command reads it for defaults:

| fly.toml field | CLI option | Precedence |
|----------------|------------|------------|
| `internal_port` in `[http_service]` | `--port` | CLI wins if specified |
| `primary_region` | `--region` | CLI wins if specified |
| `memory` in `[[vm]]` | `--memory` | CLI wins if specified |
| `cpu_kind` + `cpus` in `[[vm]]` | `--cpu` | CLI wins if specified |

The original `fly.toml` is backed up during deploy and restored afterward. The generated one used for the deploy is temporary.

## CPU Tier (Fly.io standard format)

`--cpu` accepts any well-formed Fly.io machine size in the format **`<kind>-<N>x`** where:
- `<kind>` is `shared` or `performance`
- `<N>` is the vCPU count

InsForge does **not** maintain a hardcoded allow-list — Fly.io is the source of truth for which sizes actually exist. If you pass an unsupported combination (e.g. `performance-32x`), Fly returns a clean validation error at machine-create time.

Common standard tiers (current as of writing):

| Tier | Kind | vCPU | Typical RAM range |
|------|------|------|-------------------|
| `shared-1x` (default) | shared | 1 | 256 MB – 2 GB |
| `shared-2x` | shared | 2 | 512 MB – 4 GB |
| `shared-4x` | shared | 4 | 1 GB – 8 GB |
| `shared-8x` | shared | 8 | 2 GB – 16 GB |
| `performance-1x` | dedicated | 1 | 2 GB – 8 GB |
| `performance-2x` | dedicated | 2 | 4 GB – 16 GB |
| `performance-4x` | dedicated | 4 | 8 GB – 32 GB |
| `performance-8x` | dedicated | 8 | 16 GB – 64 GB |
| `performance-16x` | dedicated | 16 | 32 GB – 128 GB |

Authoritative current list and pricing: <https://fly.io/docs/about/pricing/#started-machines>.

### Common picks

| Use case | Recommended `--cpu --memory` |
|----------|------------------------------|
| Static site / proxy | `shared-1x 256` |
| Small Node/Python API | `shared-1x 512` |
| Mid API with caching | `shared-2x 1024` |
| API needing 4 GB RAM | `shared-2x 4096` or `shared-4x 4096` |
| 8 cores + 4 GB (CPU-heavy short jobs) | `performance-8x 4096` |
| ML inference (CPU) | `performance-4x 8192` |
| Heavy data processing | `performance-8x 16384` |

## What happens internally

**Mode 1 (`--image`):** CLI → `POST /api/compute/services` → backend stores row + calls Fly Machines API to create app + launch machine using the image you specified. Returns `{ id, name, status, endpointUrl, ... }`.

**Mode 2 (build):**
1. CLI checks for existing service via `GET /api/compute/services`
2. If new: `POST /api/compute/services/deploy` (creates Fly app, no machine)
3. CLI fetches a short-lived Fly deploy token via `POST /api/compute/services/:id/deploy-token`
4. CLI generates a temporary `fly.toml`
5. CLI runs `flyctl deploy --remote-only --access-token <token>` (Fly's builder builds the image, then creates 2 machines for HA)
6. CLI calls `POST /api/compute/services/:id/sync` to record machine ID + status

Both modes return the public endpoint URL: `https://{name}-{projectId}.fly.dev`.

## Output

Text mode:
```
✓ Service "my-api" deployed [running]
  Endpoint: https://my-api-default.fly.dev
```

JSON mode (`--json`):
```json
{
  "id": "uuid",
  "name": "my-api",
  "imageUrl": "nginx:alpine",
  "port": 80,
  "cpu": "shared-1x",
  "memory": 256,
  "region": "iad",
  "status": "running",
  "endpointUrl": "https://my-api-default.fly.dev",
  "flyAppId": "my-api-default",
  "flyMachineId": "abc123"
}
```

## Common errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Cannot pass both --image and a directory` | Both modes specified | Pick one: `--image <url>` OR a directory |
| `No Dockerfile found in <dir>` | Build mode but no Dockerfile | Add a Dockerfile, or use `--image <url>` |
| `flyctl is not installed` | Build mode, missing CLI | `brew install flyctl` |
| `COMPUTE_SERVICE_ALREADY_EXISTS` | Duplicate name in project | Choose a different name or delete the existing service |
| `COMPUTE_QUOTA_EXCEEDED` | At per-project quota (5 active) | Delete unused services or call `compute reconcile` to clear orphans |
| `COMPUTE_INVALID_CPU_TIER` | `--cpu` doesn't match `<kind>-<N>x` | Use the format above, e.g. `performance-2x` |

## Notes

- **Mode 1 is faster** (~5s). **Mode 2 is for source-driven workflows** (~30-120s for build + deploy).
- The **build happens on Fly's remote builders** (mode 2), not locally. Your machine doesn't need Docker installed.
- For redeploys (service already exists), the command skips the create step and goes straight to `flyctl deploy`.
- The `--env` flag sets env vars in the InsForge database. These are passed to the Fly machine at launch.
- Mode 2 deploy can take 1-5 minutes depending on image size and build complexity.
