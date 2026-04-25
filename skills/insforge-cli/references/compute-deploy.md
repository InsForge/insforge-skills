# npx @insforge/cli compute deploy — deploy a pre-built Docker image

> ⚠️ **In progress.** Compute services are still in development; the API and CLI may change.

> 🔧 **DO NOT call `flyctl` directly to manage InsForge compute services.**
> InsForge runs containers on Fly.io under the hood, but the Fly account, org,
> IPs, and machine ownership all live on the InsForge cloud. Using `flyctl`
> with your own credentials will land in the wrong Fly org and fail with
> `unauthorized`. Use `npx @insforge/cli compute …` instead.

Deploy a backend service from a **pre-built Docker image**.

> Looking to deploy a **frontend** (static site / SPA / Next.js to Vercel)? Use
> `npx @insforge/cli deployments deploy` instead — see
> [deployments-deploy.md](deployments-deploy.md).

## ⚠️ v1 limitation: image-only

InsForge **deploys** Docker images. **Does not build them.**

| Scenario | v1 |
|---|---|
| Deploy a pre-built image (`--image <url>`) | ✅ |
| Build from a directory + Dockerfile | ❌ roadmap |
| Auto-detect + build (no Dockerfile, Vercel-style) | ❌ roadmap |

**You produce the image; InsForge runs it.** Build locally with Docker and push to a registry (GHCR, Docker Hub, etc.), then deploy via `--image`. Off-the-shelf public images (`nginx:alpine`, etc.) work too — no build needed.

**Anti-pattern: `flyctl deploy` from your laptop.** Returns 401 — the Fly account is InsForge's, not yours.

## Syntax

```bash
npx @insforge/cli compute deploy --image <url> --name <name> [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--name <name>` | Service name (DNS-safe: lowercase, numbers, dashes) | **required** |
| `--image <url>` | Docker image URL | **required** |
| `--port <port>` | Container internal port | `8080` |
| `--cpu <tier>` | CPU tier in Fly.io standard format `<kind>-<N>x` (see [CPU tier section](#cpu-tier-flyio-standard-format)) | `shared-1x` |
| `--memory <mb>` | Memory in MB (any positive integer; Fly enforces per-tier bounds) | `512` |
| `--region <region>` | Fly.io region | `iad` |
| `--env <json>` | Environment variables as JSON object | none |

## Quick examples

```bash
# Off-the-shelf image
npx @insforge/cli compute deploy --image nginx:alpine --name proxy --port 80

# Your own image from GHCR (build + push first; see "Producing the image" below)
npx @insforge/cli compute deploy \
  --image ghcr.io/your-org/your-app:v1 \
  --name my-api \
  --port 8000 \
  --cpu performance-1x \
  --memory 2048 \
  --env '{"OPENAI_API_KEY": "sk-..."}'

# Bigger machine (8 cores + 4 GB RAM)
npx @insforge/cli compute deploy \
  --image ghcr.io/your-org/batch-worker:v1 \
  --name batch \
  --port 8080 \
  --cpu performance-8x --memory 4096
```

## Producing the image

In your project directory with a Dockerfile:

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
| `Image pull error` | Registry private without InsForge having creds | Push to a public image, or contact support to configure private registry creds |
| `Unauthorized` from registry | Image is private and InsForge cloud doesn't have credentials | Make the image public, or use a public registry |

## FAQ

**Q: Why doesn't InsForge build my image for me like Vercel does?**
A: Building images is a separate problem from deploying them. Use local Docker (or your own CI) to produce the image. InsForge focuses on the deploy + run + scale + observe layer. Server-side build is roadmap.

**Q: Can I use a private image from my own registry?**
A: Public images (e.g. Docker Hub public, GHCR public) work out of the box. Private registry support requires per-project credential configuration; contact support to set this up.

**Q: How do I update a running service to a new image?**
A: Use `compute update <service-id> --image <new-image-url>`. The machine is restarted with the new image; ~5s downtime.

**Q: What happens to my service if Fly.io has an outage?**
A: It's down. InsForge runs your containers on Fly's infrastructure — Fly's uptime is your uptime. For HA, you'd typically deploy multiple services in different regions (future feature).

## Notes

- This command does NOT require `flyctl`, Docker, or any other local tool. It just makes an HTTP call to the InsForge backend.
- The machine starts immediately. Use `compute stop` to pause without destroying.
- Env vars set via `--env` are encrypted at rest in the InsForge database.
