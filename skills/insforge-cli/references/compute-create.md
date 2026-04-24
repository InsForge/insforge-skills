# npx @insforge/cli compute create

> ⚠️ **In progress.** Compute services are still in development; the API and CLI may change.

Deploy a pre-built Docker image as a compute service on Fly.io.

## Syntax

```bash
npx @insforge/cli compute create [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--name <name>` | Service name (DNS-safe: lowercase, numbers, dashes) | **required** |
| `--image <image>` | Docker image URL (e.g. `nginx:alpine`, `my-registry/my-app:latest`) | **required** |
| `--port <port>` | Container internal port | `8080` |
| `--cpu <tier>` | CPU tier | `shared-1x` |
| `--memory <mb>` | Memory in MB | `512` |
| `--region <region>` | Fly.io region | `iad` |
| `--env <json>` | Environment variables as JSON object | none |

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

For the authoritative current list and pricing, see Fly.io's machine-size documentation: <https://fly.io/docs/about/pricing/#started-machines>.

## Memory

`--memory <mb>` accepts any positive integer (MB). Fly enforces the per-tier bounds shown above; out-of-range combinations return a Fly validation error. Default: `512`.

Examples: `--memory 256`, `--memory 4096`, `--memory 65536`.

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

## Regions

| Code | Location |
|------|----------|
| `iad` | Ashburn, VA (default) |
| `sin` | Singapore |
| `lax` | Los Angeles |
| `lhr` | London |
| `nrt` | Tokyo |
| `ams` | Amsterdam |
| `syd` | Sydney |

## What It Does

1. Validates input (name must be DNS-safe, port 1-65535, `--cpu` must match `<kind>-<N>x`, memory must be a positive integer)
2. Creates a Fly.io app via the Machines API
3. Launches a machine with the specified Docker image, CPU/memory config, and port mapping
4. Waits for the machine to reach `started` state
5. Returns the service record with a public endpoint URL

Fly.io validates the `<cpu, memory>` combination at step 3. Unsupported combos (e.g. `shared-1x` with 16 GB) return a Fly error surfaced as `COMPUTE_SERVICE_DEPLOY_FAILED`.

## Examples

```bash
# Simple nginx
npx @insforge/cli compute create --name my-proxy --image nginx:alpine --port 80

# Custom API with env vars
npx @insforge/cli compute create \
  --name audio-api \
  --image myregistry/audio-analyzer:latest \
  --port 8000 \
  --cpu performance-1x \
  --memory 2048 \
  --region sin \
  --env '{"HF_TOKEN": "hf_abc123", "PORT": "8000"}'

# 8 cores + 4 GB RAM (e.g. CPU-bound batch worker)
npx @insforge/cli compute create \
  --name batch-worker \
  --image myregistry/batch:latest \
  --port 8080 \
  --cpu performance-8x \
  --memory 4096

# JSON output for scripting
npx @insforge/cli compute create --name my-api --image node:20-alpine --port 3000 --json
```

## Output

Text mode:
```
Service "my-proxy" created [running]
  Endpoint: https://my-proxy-default.fly.dev
```

JSON mode (`--json`):
```json
{
  "id": "uuid",
  "name": "my-proxy",
  "imageUrl": "nginx:alpine",
  "port": 80,
  "cpu": "shared-1x",
  "memory": 256,
  "region": "iad",
  "status": "running",
  "endpointUrl": "https://my-proxy-default.fly.dev",
  "flyAppId": "my-proxy-default",
  "flyMachineId": "abc123"
}
```

## Endpoint URL Format

Services get a public HTTPS endpoint at:
```
https://{name}-{projectId}.fly.dev
```

Fly.io handles TLS termination automatically. Ports 80 and 443 are exposed externally and route to the container's internal port.

## Environment Variables

Env var keys must match `[A-Z_][A-Z0-9_]*`. Values are encrypted at rest in the InsForge database and decrypted when passed to the Fly machine.

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `COMPUTE_SERVICE_NOT_CONFIGURED` | Compute services not enabled | Set `COMPUTE_SERVICES_ENABLED=true` and `FLY_API_TOKEN` in backend |
| `COMPUTE_SERVICE_ALREADY_EXISTS` | Duplicate name in project | Choose a different name or delete the existing service |
| `COMPUTE_SERVICE_DEPLOY_FAILED` | Fly.io API rejected the request | Check image URL is valid and accessible, verify region has capacity |
| `Name has already been taken` | Fly app name collision | The app name is globally unique on Fly. Try a different service name |

## Notes

- This command does NOT require `flyctl` installed locally. It uses the Fly Machines API directly through the InsForge backend.
- The machine starts immediately after creation. Use `compute stop` if you want it paused.
- Env vars can be updated later with `compute update`.
