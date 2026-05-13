# AI Integration

Use OpenRouter through the OpenAI SDK for new AI features. The legacy
`insforge.ai` SDK module still exists for older apps, but it is deprecated and
should only be used as a fallback.

Official OpenRouter references:

- [OpenAI SDK with OpenRouter](https://openrouter.ai/docs/guides/community/openai-sdk)
- [Image generation](https://openrouter.ai/docs/guides/overview/multimodal/image-generation)
- [Embeddings](https://openrouter.ai/docs/api/reference/embeddings)
- [Video generation](https://openrouter.ai/docs/guides/overview/multimodal/video-generation)
- [Models](https://openrouter.ai/models)

## First: Get the API Key

Ask the user to copy the active OpenRouter key from the InsForge Dashboard:

```text
InsForge Dashboard -> Model Gateway -> Overview -> Active OpenRouter key -> copy
```

Store it as a server-side environment variable:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

Never put this key in public browser env vars such as `NEXT_PUBLIC_*`,
`VITE_*`, `PUBLIC_*`, or `REACT_APP_*`. For browser apps, create a server API
route, server action, edge function, or backend endpoint that calls OpenRouter.

## Setup

```bash
npm install openai
```

For a local script, also install dotenv:

```bash
npm install dotenv
```

```javascript
import OpenAI from 'openai'

export const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})
```

## Text Generation

```javascript
const completion = await openai.chat.completions.create({
  model: 'openai/gpt-5.5',
  messages: [
    { role: 'system', content: 'You are a concise assistant.' },
    { role: 'user', content: 'Explain pgvector in one paragraph.' },
  ],
})

console.log(completion.choices[0]?.message?.content)
```

## Image Generation

OpenRouter image generation uses chat completions with image output
modalities. Pick a model with `image` in `output_modalities`.

```javascript
const completion = await openai.chat.completions.create({
  model: 'google/gemini-2.5-flash-image',
  modalities: ['image', 'text'],
  messages: [
    { role: 'user', content: 'Generate a clean product mockup on a white desk.' },
  ],
})

const message = completion.choices[0]?.message
console.log(message?.content)
console.log(message?.images?.[0]?.image_url?.url)
```

If TypeScript types reject OpenRouter-specific fields like `modalities` or
`images`, use a narrow local cast or call the OpenRouter endpoint with `fetch`.
Do not remove the OpenRouter parameters.

## Embeddings

OpenRouter exposes embeddings at the OpenAI-compatible `/embeddings` endpoint.

```javascript
const response = await openai.embeddings.create({
  model: 'openai/text-embedding-3-small',
  input: 'InsForge is a backend-as-a-service platform.',
})

const embedding = response.data[0].embedding
```

Store the returned `number[]` in an InsForge Postgres `vector(N)` column. See
[embeddings-and-rag.md](./embeddings-and-rag.md) and
[../database/pgvector.md](../database/pgvector.md).

## Video Generation

Video generation is asynchronous and uses OpenRouter's video endpoint directly,
not the OpenAI SDK.

```javascript
const response = await fetch('https://openrouter.ai/api/v1/videos', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'google/veo-3.1',
    prompt: 'A golden retriever playing fetch on a sunny beach.',
    duration: 5,
    resolution: '720p',
  }),
})

const job = await response.json()
console.log(job.id, job.status)
```

Poll `job.polling_url` or `/api/v1/videos/{jobId}` until the status is
`completed`, then download the content URL returned by OpenRouter:

```javascript
let video = job

while (video.status === 'pending' || video.status === 'processing') {
  await new Promise((resolve) => setTimeout(resolve, 5000))

  const pollUrl = new URL(video.polling_url, 'https://openrouter.ai')
  const poll = await fetch(pollUrl, {
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
  })

  video = await poll.json()
}

console.log(video.unsigned_urls?.[0])
```

## Model Discovery

Do not use the old `ai.configs` table. It is deprecated.

Use OpenRouter model discovery instead:

```bash
# All models
curl https://openrouter.ai/api/v1/models

# Image-capable models
curl "https://openrouter.ai/api/v1/models?output_modalities=image"

# Embedding models
curl https://openrouter.ai/api/v1/embeddings/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"

# Video models
curl https://openrouter.ai/api/v1/videos/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

The InsForge Dashboard Model Gateway model list is also a good place for the
user to browse supported model IDs and copy the active key.

## Deprecated Fallback: InsForge SDK AI Module

Use this only when maintaining existing code or when the user explicitly asks
to keep using InsForge SDK AI calls. For new features, prefer OpenRouter
directly.

```javascript
const completion = await insforge.ai.chat.completions.create({
  model: 'openai/gpt-5.5',
  messages: [{ role: 'user', content: 'Hello' }],
})
```

```javascript
const image = await insforge.ai.images.generate({
  model: 'google/gemini-2.5-flash-image',
  prompt: 'A mountain landscape at sunset',
})
```

## Best Practices

1. Use OpenRouter with the OpenAI SDK for new text, image, and embedding code.
2. Keep `OPENROUTER_API_KEY` server-side only.
3. Ask the user to copy the key from the InsForge Dashboard if it is missing.
4. Check OpenRouter model capabilities before using image, embedding, audio, or video features.
5. Upload generated images/videos to storage before saving references in the database.
6. Treat the InsForge SDK AI module as deprecated fallback code.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Querying `ai.configs` for supported models | Use OpenRouter models or the Dashboard Model Gateway model list |
| Putting `OPENROUTER_API_KEY` in `NEXT_PUBLIC_*` or `VITE_*` | Keep it server-side and proxy through an API route |
| Using the legacy `insforge.ai` module for new features | Use OpenRouter through the OpenAI SDK |
| Guessing model capabilities | Check OpenRouter model metadata and modality docs |
| Storing base64 image output in Postgres | Upload to storage, save the URL/key |
