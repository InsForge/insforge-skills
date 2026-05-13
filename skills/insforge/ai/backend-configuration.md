# AI Backend Configuration

InsForge's AI feature is now the Model Gateway backed by OpenRouter. New app
code should call OpenRouter directly with the OpenAI SDK and an
`OPENROUTER_API_KEY` copied from the InsForge Dashboard.

The old `ai.configs` / `ai.usage` database tables and AI Settings model
configuration flow are deprecated. Do not query them for new implementations.

## Setup

Ask the user to copy the active key:

```text
InsForge Dashboard -> Model Gateway -> Overview -> Active OpenRouter key -> copy
```

Then add it to the app's server-side environment:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

For framework-specific placement:

| App type | Where to put it |
|----------|-----------------|
| Next.js | `.env.local` as `OPENROUTER_API_KEY` and use it only in server routes/actions |
| Vite/React SPA | Backend/API server env, not `VITE_*` |
| Node service/script | `.env` or deployment secret as `OPENROUTER_API_KEY` |
| Edge function | Function secret/environment variable |

Never expose the key in browser-visible env vars.

## Model Discovery

Use OpenRouter rather than project-local AI config tables:

```bash
# All OpenRouter models
curl https://openrouter.ai/api/v1/models

# Image output models
curl "https://openrouter.ai/api/v1/models?output_modalities=image"

# Embedding models
curl https://openrouter.ai/api/v1/embeddings/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"

# Video models
curl https://openrouter.ai/api/v1/videos/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

The Dashboard Model Gateway model list is also suitable for browsing model IDs,
modalities, release dates, and pricing.

## OpenAI SDK Configuration

```javascript
import OpenAI from 'openai'

export const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})
```

## When the Key Is Missing

If `OPENROUTER_API_KEY` is missing:

1. Stop before implementing AI calls that would fail.
2. Ask the user to copy the active OpenRouter key from the InsForge Dashboard.
3. Add the key as a server-side env var.
4. Restart the dev server so the env var is loaded.

## Deprecated Backend Proxy

The old InsForge backend chat completion and image generation endpoints are
still supported for compatibility, but they are deprecated. Use them only when
maintaining existing code that already depends on `insforge.ai`.

For new work, do not add project model configuration, do not query `ai.configs`,
and do not depend on the old AI Settings flow.

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Asking the user to configure models in AI Settings | Ask them to copy the OpenRouter key from Model Gateway |
| Querying `ai.configs` or `ai.usage` | Use OpenRouter model APIs and activity APIs |
| Putting the key in public frontend env vars | Keep `OPENROUTER_API_KEY` server-side |
| Using the deprecated InsForge SDK AI module for new code | Use OpenRouter with the OpenAI SDK |
