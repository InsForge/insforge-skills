# npx @insforge/cli compute deploy — deploy a backend container

> ⚠️ **In progress.** Compute services are still in development; the API and CLI may change.

> 🔧 **DO NOT call `flyctl` directly to manage InsForge compute services.**
> InsForge runs containers on Fly.io under the hood, but the Fly account, org,
> IPs, and machine ownership all live on the InsForge cloud. Using `flyctl`
> with your own credentials will land in the wrong Fly org and fail with
> `unauthorized`. Use `npx @insforge/cli compute …` instead.

Deploy a backend service. Two modes:
1. **Source mode** (`compute deploy [dir]`): you have a Dockerfile and Docker installed. CLI runs `docker build` + `docker push` locally against `registry.fly.io` using a short-lived per-app deploy token minted by InsForge cloud, then asks the cloud to launch the machine.
2. **Image mode** (`compute deploy --image <url>`): deploy a pre-built image from any registry. **No local Docker required.**

> Looking to deploy a **frontend** (static site / SPA / Next.js to Vercel)? Use
> `npx @insforge/cli deployments deploy` instead — see
> [deployments-deploy.md](deployments-deploy.md).

## Two modes

| Mode | Command | When to use | Local Docker? |
|---|---|---|---|
| **Source** | `compute deploy ./my-app --name my-api` | You have a Dockerfile and want one command. CLI builds + pushes from your machine using a per-app token InsForge mints on demand. | **Required** |
| **Image** | `compute deploy --image <url> --name my-api` | You already have a built image (CI pipeline, public image, custom registry). | Not required |

Both deploy to the same Fly.io infrastructure with the same options (`--port`, `--cpu`, `--memory`, `--region`, `--env`).

**Anti-pattern: `flyctl deploy` from your laptop.** Returns 401 — the Fly account is InsForge's, not yours.

## Syntax

```bash
# Source mode — local docker build + push, then cloud launches the machine
# (requires Docker locally; cloud mints a 20-min per-app deploy token)
npx @insforge/cli compute deploy <dir> --name <name> [options]

# Image mode — deploy pre-built image (no Docker required)
npx @insforge/cli compute deploy --image <url> --name <name> [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--name <name>` | Service name (DNS-safe: lowercase, numbers, dashes) | **required** |
| `[dir]` (positional) | Source directory containing a Dockerfile (source mode) | — |
| `--image <url>` | Docker image URL (image mode) | — |
| `--port <port>` | Container internal port | `8080` |
| `--cpu <tier>` | CPU tier in Fly.io standard format `<kind>-<N>x` (see [CPU tier section](#cpu-tier-flyio-standard-format)) | `shared-1x` |
| `--memory <mb>` | Memory in MB (any positive integer; Fly enforces per-tier bounds) | `512` |
| `--region <region>` | Fly.io region | `iad` |
| `--env <json>` | Environment variables as JSON object | none |

Exactly one of `[dir]` or `--image` must be provided.

## Quick examples

```bash
# Source mode — your project, your Dockerfile, Docker installed
npx @insforge/cli compute deploy . --name my-api --port 8000

# Off-the-shelf image
npx @insforge/cli compute deploy --image nginx:alpine --name proxy --port 80

# Pre-built image from GHCR
npx @insforge/cli compute deploy \
  --image ghcr.io/your-org/your-app:v1 \
  --name my-api \
  --port 8000 \
  --cpu performance-1x \
  --memory 2048 \
  --env '{"OPENAI_API_KEY": "sk-..."}'

# Bigger machine (8 cores + 4 GB RAM)
npx @insforge/cli compute deploy ./worker \
  --name batch \
  --port 8080 \
  --cpu performance-8x --memory 4096
```

## Source mode — worked example

```bash
# Project layout:
$ ls
Dockerfile  app.py  requirements.txt

# Deploy:
$ npx @insforge/cli compute deploy . --name my-bot --port 8080
✓ Detected Dockerfile at /path/to/Dockerfile
✓ Creating service "my-bot"...
✓ Created Fly app my-bot-projAbc
✓ Requesting deploy token...
✓ Building image registry.fly.io/my-bot-projAbc:cli-1714003200000...
✓ Logging in to registry.fly.io...
✓ Pushing registry.fly.io/my-bot-projAbc:cli-1714003200000...
✓ Launching machine...
✓ Service "my-bot" deployed [running]
   Endpoint: https://my-bot-projAbc.fly.dev
```

What happens behind the scenes:
1. CLI looks up the service by `--name`. If missing, calls the cloud to provision a Fly app shell (no machine yet) and gets back the `flyAppId`.
2. CLI requests a per-app deploy token from the cloud — a Fly macaroon attenuated to `Apps[<thisAppOnly>] + Registry + 20-min validity window`. The org-wide Fly token never leaves InsForge's servers.
3. CLI runs `docker build --platform linux/amd64 -t registry.fly.io/<app>:<tag> <dir>` locally.
4. CLI runs `docker login registry.fly.io -u x --password-stdin` (token piped via stdin, never on argv) and `docker push registry.fly.io/<app>:<tag>`. Image bytes go straight from your Docker daemon to Fly's registry.
5. CLI sends `PATCH /api/compute/services/<id>` with `imageUrl=registry.fly.io/<app>:<tag>`. Cloud calls Fly Machines API to launch (or restart with the new image) and returns the public URL.

### When to use source mode vs image mode

- **Source mode**: rapid iteration on a single project, Dockerfile in repo, you already have Docker installed.
- **Image mode**: no Docker on the machine running the CLI (e.g. CI runners that build elsewhere), CI/CD pipelines that push their own images, off-the-shelf images like `nginx:alpine`, or multiple deploy targets sharing one image.

### If you don't have a Dockerfile yet

Ask your AI agent to generate one for your stack:
- Node app → typically `FROM node:20-alpine`, `npm ci`, `CMD node index.js`
- Python app → `FROM python:3.12-alpine`, `pip install -r requirements.txt`, `CMD python app.py`
- Go binary → multi-stage build with `FROM golang:1.22 AS build` then `FROM alpine:3.20`

The InsForge skill knows these patterns; ask the agent and it'll write one.

## Producing an image yourself (for image mode)

If you want to build images in CI and deploy via `--image` instead:

```bash
docker build -t ghcr.io/<your-gh-username>/<app-name>:v1 .
echo $GITHUB_TOKEN | docker login ghcr.io -u <your-gh-username> --password-stdin
docker push ghcr.io/<your-gh-username>/<app-name>:v1

npx @insforge/cli compute deploy \
  --image ghcr.io/<your-gh-username>/<app-name>:v1 \
  --name <app-name> \
  --port <port>
```

Any OCI registry works (GHCR, Docker Hub, etc.) as long as the image is publicly pullable. Private registries require per-project credential setup — contact support.

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

CLI → OSS instance → InsForge cloud backend → Fly.io. The cloud:
1. Records the service in its `compute_services` table
2. Creates a Fly.io app named `<name>-<projectId>`
3. Allocates IPv4 + IPv6 addresses
4. Launches a Fly machine pulling the image you specified
5. Returns the public endpoint URL

Total time: typically ~5 seconds (Fly pulls the image and boots the machine).

## Output

Text mode:
```
✓ Service "my-api" deployed [running]
  Endpoint: https://my-api-projID.fly.dev
```

JSON mode (`--json`):
```json
{
  "id": "uuid",
  "name": "my-api",
  "imageUrl": "ghcr.io/you/app:v1",
  "port": 80,
  "cpu": "shared-1x",
  "memory": 256,
  "region": "iad",
  "status": "running",
  "endpointUrl": "https://my-api-projID.fly.dev",
  "flyAppId": "my-api-projID",
  "flyMachineId": "abc123"
}
```

## Common errors

| Error | Cause | Solution |
|-------|-------|----------|
| `COMPUTE_SERVICE_ALREADY_EXISTS` | Duplicate name in project | Choose a different name or delete the existing service |
| `COMPUTE_QUOTA_EXCEEDED` | At per-project quota (5 active services) | Delete unused services or call `compute reconcile` to clear orphans |
| `COMPUTE_INVALID_CPU_TIER` | `--cpu` doesn't match `<kind>-<N>x` | Use the format above, e.g. `performance-2x` |
| `Docker is required for source-mode deploy` | Docker isn't installed or the daemon isn't running | Install Docker Desktop (https://docs.docker.com/get-docker/) and start it, or switch to `--image <pre-built-image>` |
| `docker push ... failed (exit 1): unauthorized` | Per-app deploy token expired (20-min TTL) | Re-run `compute deploy` — the CLI mints a fresh token per invocation |
| `docker build failed (exit 1)` | Dockerfile error | Check the build output above the error; fix the Dockerfile and retry |
| `Image pull error` (image mode) | Registry private without InsForge having creds | Push to a public image, or contact support to configure private registry creds |
| `Unauthorized` from registry (image mode) | Image is private and InsForge cloud doesn't have credentials | Make the image public, or use a public registry |

## FAQ

**Q: Why does source mode require Docker on my machine?**
A: It's the simplest, fastest, most secure path: bytes go straight from your daemon to `registry.fly.io`, the cloud never sees your source, and the deploy token is scoped to a single Fly app for 20 minutes. We evaluated server-side builds (CodeBuild, Fly remote builders, depot.dev) but each had blockers — depot.dev silently no-ops on app-scoped tokens, server-side build OOMs on small instances, and broader-scope tokens leak access to other apps. If you don't want Docker locally, use `--image` with a pre-built image from your CI.

**Q: Can I use a private image from my own registry?**
A: Public images (e.g. Docker Hub public, GHCR public) work out of the box. Private registry support requires per-project credential configuration; contact support to set this up.

**Q: How do I update a running service to a new image?**
A: Use `compute update <service-id> --image <new-image-url>`. The machine is restarted with the new image; ~5s downtime.

**Q: What happens to my service if Fly.io has an outage?**
A: It's down. InsForge runs your containers on Fly's infrastructure — Fly's uptime is your uptime. For HA, you'd typically deploy multiple services in different regions (future feature).

## Notes

- This command never requires `flyctl` or a Fly token. The InsForge cloud holds the org token; the CLI receives short-lived per-app deploy tokens on demand.
- Source mode requires Docker locally; image mode does not. Pick by what you have.
- The machine starts immediately on first deploy. Subsequent deploys to the same `--name` update the existing machine in place. Use `compute stop` to pause without destroying.
- Env vars set via `--env` are encrypted at rest in the InsForge database.
