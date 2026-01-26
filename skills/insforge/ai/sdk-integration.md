# AI SDK Integration

Use InsForge SDK to access AI capabilities (chat, images, embeddings) in your frontend application.

## Setup

```javascript
import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: 'https://your-project.region.insforge.app',
  anonKey: 'your-anon-key'
})
```

## Chat Completions

### Basic Usage

```javascript
const completion = await insforge.ai.chat.completions.create({
  model: 'anthropic/claude-3.5-haiku',
  messages: [
    { role: 'user', content: 'What is the capital of France?' }
  ]
})
console.log(completion.choices[0].message.content)
```

### With Parameters

```javascript
const completion = await insforge.ai.chat.completions.create({
  model: 'openai/gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing.' }
  ],
  temperature: 0.7,
  maxTokens: 1000
})
```

### With Images

```javascript
const completion = await insforge.ai.chat.completions.create({
  model: 'anthropic/claude-3.5-haiku',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      { type: 'image_url', image_url: { url: 'https://...' } }
    ]
  }]
})
```

### With File Parsing and Web Search

```javascript
const completion = await insforge.ai.chat.completions.create({
  model: 'anthropic/claude-sonnet-4.5',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'Analyze this PDF' },
      { type: 'file', file: { filename: 'doc.pdf', file_data: 'https://...' } }
    ]
  }],
  fileParser: { enabled: true },
  webSearch: { enabled: true, maxResults: 5 }
})
```

## Embeddings

```javascript
const response = await insforge.ai.embeddings.create({
  model: 'openai/text-embedding-3-small',
  input: 'Hello world'
})
console.log(response.data[0].embedding) // number[]

// Store in database with pgvector
await insforge.database.from('documents').insert([{
  content: 'Important document',
  embedding: response.data[0].embedding
}])
```

## Image Generation

```javascript
const response = await insforge.ai.images.generate({
  model: 'google/gemini-3-pro-image-preview',
  prompt: 'A mountain landscape at sunset',
  size: '1024x1024'
})

// Upload to storage
const base64 = response.data[0].b64_json
const buffer = Buffer.from(base64, 'base64')
const blob = new Blob([buffer], { type: 'image/png' })

const { data } = await insforge.storage.from('ai-images').uploadAuto(blob)
```

---

## Best Practices

1. **Always verify model availability first**
   - Before implementing AI features, check `GET /api/ai/configurations` (see [backend-configuration.md](backend-configuration.md))
   - Only use model IDs that are configured and enabled for the project

2. **Use exact model IDs from configurations**
   - Model IDs must match exactly what's in the configurations
   - Example: `anthropic/claude-3.5-haiku` not `claude-haiku` or `claude-3.5-haiku`

3. **Handle errors gracefully**
   - Always check for errors in the response
   - Provide meaningful feedback to users when AI requests fail

4. **Never store base64 images in the database**
   - Generated images return base64 data - do not save this directly to the database
   - Always upload to storage first, then save the storage URL/key to the database
   - Base64 strings are large and will bloat your database

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| ❌ Using unconfigured model IDs | ✅ Check configurations first via admin API |
| ❌ Hardcoding model IDs without verification | ✅ Verify model exists in project's AI configurations |
| ❌ Ignoring errors | ✅ Always handle `error` in response |
| ❌ Storing base64 image data in database | ✅ Upload to storage, save URL/key to database |

## When AI Requests Fail

If AI requests fail with model-related errors:

1. **Check if the model is configured** for this project
2. **If not configured**, instruct the user:
   > "The AI model is not configured for this project. Please go to the InsForge Dashboard → AI Settings to add and enable the required model."
3. **Do not retry** with guessed model IDs

## Recommended Workflow

```
1. Check available models    → GET /api/ai/configurations (admin API)
2. Confirm model is enabled  → Look for modelId in response
3. Implement SDK calls       → Use exact modelId from configurations
4. Handle errors             → Show user-friendly messages
```
