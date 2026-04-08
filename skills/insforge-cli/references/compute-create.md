# npx @insforge/cli compute create

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

## CPU Tiers

| Tier | Description |
|------|-------------|
| `shared-1x` | Shared CPU, 1 vCPU (default) |
| `shared-2x` | Shared CPU, 2 vCPU |
| `performance-1x` | Dedicated CPU, 1 vCPU |
| `performance-2x` | Dedicated CPU, 2 vCPU |
| `performance-4x` | Dedicated CPU, 4 vCPU |

## Memory Options

256, 512 (default), 1024, 2048, 4096, 8192 MB

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

1. Validates input (name must be DNS-safe, port 1-65535, memory must be an allowed value)
2. Creates a Fly.io app via the Machines API
3. Launches a machine with the specified Docker image, CPU/memory config, and port mapping
4. Waits for the machine to reach `started` state
5. Returns the service record with a public endpoint URL

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
