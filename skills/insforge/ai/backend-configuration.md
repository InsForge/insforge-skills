# AI Backend Configuration

Check which AI models are configured for a project.

## Discovering Available Models

### Option 1 — CLI (recommended)

```bash
npx @insforge/cli metadata --json
```

The `ai.configurations` section lists all models with `modelId` and `enabled` status.

### Option 2 — Raw SQL

Query the `ai.configs` table directly:

```bash
npx @insforge/cli db query "SELECT model_id, provider, is_active, input_modality, output_modality FROM ai.configs WHERE is_active = true"
```

**Table: `ai.configs`**

| Column | Type | Description |
|--------|------|-------------|
| `model_id` | VARCHAR(255) | Unique model identifier (use this in SDK calls) |
| `provider` | VARCHAR(255) | AI provider (e.g., `openai`, `anthropic`, `google`) |
| `is_active` | BOOLEAN | Whether the model is enabled |
| `input_modality` | TEXT[] | Supported input types: `text`, `image`, `audio`, `video`, `file` |
| `output_modality` | TEXT[] | Supported output types: `text`, `image`, `audio`, `video`, `file` |
| `system_prompt` | TEXT | Optional default system prompt |

### Option 3 — HTTP endpoint (requires admin auth)

```
GET /api/ai/configurations
Authorization: Bearer {admin-token}
```

## Best Practices

1. **Always check available models first** before implementing AI features
2. **Use exact `model_id`** from the query response — do not shorten or guess
3. Each project has its own configured models — do not assume availability

## When No Models Are Configured

If the query returns no results:

1. **Do not attempt to use AI features** — they will fail
2. **Instruct the user** to configure AI models on the InsForge Dashboard → AI Settings
3. **After configuration**, verify by querying again

## Recommended Workflow

```
1. Check available models    → npx @insforge/cli metadata --json
                               OR query ai.configs table
2. If empty or missing model → Instruct user to configure on Dashboard
3. If model exists           → Use exact model_id in SDK calls
```
