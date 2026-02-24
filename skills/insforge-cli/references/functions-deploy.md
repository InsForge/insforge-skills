# insforge functions deploy

Deploy (create or update) an edge function.

## Syntax

```bash
insforge functions deploy <slug> [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--file <path>` | Path to function source file |
| `--name <name>` | Display name |
| `--description <desc>` | Function description |

## Default File Path

If `--file` is not specified, the CLI looks for:

```
insforge/functions/{slug}/index.ts
```

## What It Does

1. Checks if the function already exists (GET)
2. If exists: updates (PUT)
3. If new: creates (POST)

## Examples

```bash
# Deploy from default path (insforge/functions/my-handler/index.ts)
insforge functions deploy my-handler

# Deploy from custom file
insforge functions deploy cleanup-expired --file ./handler.ts --name "Cleanup Expired" --description "Removes expired records"

# Update an existing function
insforge functions deploy payment-webhook --file ./webhooks/payment.ts
```

## Output

Success message with the slug and action taken (created or updated).
