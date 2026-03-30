# AI Backend Configuration

Check which AI models are configured for a project.

## Setup

Ensure you're authenticated and linked to a project:

```bash
npx @insforge/cli whoami      # verify authentication
npx @insforge/cli current     # verify linked project
```

If not set up, run `npx @insforge/cli login` and `npx @insforge/cli link`.

## Discovering Available Models

### Option 1 — CLI (recommended)

```bash
npx @insforge/cli metadata --json
```

The `ai.configurations` section lists all models with `modelId` and `enabled` status.

> **Note:** CLI metadata uses camelCase (`modelId`, `enabled`) while the database uses snake_case (`model_id`, `is_active`). They refer to the same fields.

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

```http
GET /api/ai/configurations
Authorization: Bearer {admin-token}
```

## Usage Examples

### Query models via CLI and use in SDK

```bash
# 1. Get available models
npx @insforge/cli metadata --json
# Response includes: ai.configurations[].modelId

# 2. Use the returned modelId in your SDK code
# e.g., if metadata returns modelId: "anthropic/claude-sonnet-4.5"
```

```javascript
const completion = await insforge.ai.chat.completions.create({
  model: 'anthropic/claude-sonnet-4.5', // exact modelId from metadata
  messages: [{ role: 'user', content: 'Hello' }]
})
```

### Query models via raw SQL

```bash
npx @insforge/cli db query "SELECT model_id FROM ai.configs WHERE is_active = true"
# Use the returned model_id values in SDK calls
```

## Best Practices

1. **Always check available models first** before implementing AI features
2. **Use exact `model_id`** from the query response — do not shorten or guess
3. Each project has its own configured models — do not assume availability

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Hardcoding model IDs (e.g., `claude-haiku`) | Query `ai.configs` or CLI metadata first, use exact `model_id` |
| Using shortened model names | Use the full `model_id` value (e.g., `anthropic/claude-sonnet-4.5`) |
| Assuming all models are available | Each project has its own configured models — always check |
| Calling AI features with no models configured | Check first, instruct user to configure on Dashboard if empty |

## When No Models Are Configured

If the query returns no results:

1. **Do not attempt to use AI features** — they will fail
2. **Instruct the user** to configure AI models on the InsForge Dashboard → AI Settings
3. **After configuration**, verify by querying again

## Recommended Workflow

```text
1. Check available models    → npx @insforge/cli metadata --json
                               OR query ai.configs table
2. If empty or missing model → Instruct user to configure on Dashboard
3. If model exists           → Use exact model_id in SDK calls
```
