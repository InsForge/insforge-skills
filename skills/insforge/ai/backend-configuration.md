# AI Backend Configuration

HTTP endpoints to check AI configurations. Requires admin authentication.

## Authentication

All admin endpoints require:
```
Authorization: Bearer {admin-token-or-api-key}
```

## List AI Configurations

Check which AI models are available for this project.

```
GET /api/ai/configurations
Authorization: Bearer {admin-token}
```

Response example:
```json
{
  "configurations": [
    {
      "id": "config-uuid",
      "name": "Claude Haiku",
      "modelId": "anthropic/claude-3.5-haiku",
      "enabled": true
    },
    {
      "id": "config-uuid-2",
      "name": "GPT-4",
      "modelId": "openai/gpt-4",
      "enabled": true
    }
  ]
}
```

## Quick Reference

| Task | Endpoint |
|------|----------|
| List AI configs | `GET /api/ai/configurations` |

---

## Best Practices

1. **Always check available configurations first** before implementing AI features
   - Call `GET /api/ai/configurations` to see which models are enabled
   - Only use model IDs that appear in the configurations list

2. **Verify the exact model ID** from the configurations response
   - Model IDs must match exactly (e.g., `anthropic/claude-3.5-haiku`, not `claude-haiku`)

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Using a model ID that isn't configured | Check configurations first, use only enabled models |
| Guessing model IDs | Always verify against `GET /api/ai/configurations` |
| Assuming all models are available | Each project has its own configured models |

## When No Configurations Exist

If `GET /api/ai/configurations` returns an empty list or the requested model is not configured:

1. **Do not attempt to use AI features** - they will fail
2. **Instruct the user** to configure AI models on the InsForge Dashboard:
   - Go to the InsForge Dashboard → AI Settings
   - Add and enable the desired AI model configurations
   - Save changes
3. **After configuration**, verify by calling `GET /api/ai/configurations` again

## Recommended Workflow

```
1. Check configurations     → GET /api/ai/configurations
2. If empty or missing model → Instruct user to configure on Dashboard
3. If model exists          → Proceed with SDK integration
```
