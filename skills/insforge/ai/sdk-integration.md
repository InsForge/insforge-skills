# AI SDK Integration

Use InsForge SDK to access AI capabilities (chat, images, embeddings) in your frontend application.

## 🚨 Discover Available Models First

**Do not hardcode model IDs.** Each project has its own configured models. Check what's available before writing AI code:

```bash
# Option 1: CLI metadata
npx @insforge/cli metadata --json

# Option 2: Query ai.configs table directly
npx @insforge/cli db query "SELECT model_id, provider, is_active, input_modality, output_modality FROM ai.configs WHERE is_active = true"
```

Use the exact `model_id` from the response in SDK calls. If no models are configured, instruct the user to add them via InsForge Dashboard → AI Settings.

---

## Setup

First, ensure your `.env` file is configured with your InsForge URL and anon key (see the main [SKILL.md](../SKILL.md) for framework-specific variable names and how to get your anon key).

```javascript
import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,       // adjust prefix for your framework
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY   // adjust prefix for your framework
})
```

## Usage Examples

### Chat Completions

#### Basic Usage

```javascript
// Use the exact model_id from: npx @insforge/cli metadata --json
// or: npx @insforge/cli db query "SELECT model_id FROM ai.configs WHERE is_active = true"
const completion = await insforge.ai.chat.completions.create({
  model: MODEL_ID, // e.g., 'anthropic/claude-sonnet-4.5' — from metadata, NOT hardcoded
  messages: [
    { role: 'user', content: 'What is the capital of France?' }
  ]
})
console.log(completion.choices[0].message.content)
```

#### With Parameters

```javascript
const completion = await insforge.ai.chat.completions.create({
  model: MODEL_ID, // from metadata or ai.configs query
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing.' }
  ],
  temperature: 0.7,
  maxTokens: 1000
})
```

#### With Images

```javascript
// Verify model supports image input_modality via metadata before using
const completion = await insforge.ai.chat.completions.create({
  model: MODEL_ID, // must have 'image' in input_modality
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      { type: 'image_url', image_url: { url: 'https://...' } }
    ]
  }]
})
```

#### With File Parsing and Web Search

```javascript
const completion = await insforge.ai.chat.completions.create({
  model: MODEL_ID, // from metadata or ai.configs query
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

### Embeddings

```javascript
// Use embedding model_id from metadata (e.g., 'openai/text-embedding-3-small')
const response = await insforge.ai.embeddings.create({
  model: EMBEDDING_MODEL_ID, // from metadata or ai.configs query
  input: 'Hello world'
})
console.log(response.data[0].embedding) // number[]

// Store in database with pgvector
await insforge.database.from('documents').insert([{
  content: 'Important document',
  embedding: response.data[0].embedding
}])
```

### Image Generation

```javascript
// Use image generation model_id from metadata — must have 'image' in output_modality
const response = await insforge.ai.images.generate({
  model: IMAGE_MODEL_ID, // from metadata or ai.configs query
  prompt: 'A mountain landscape at sunset',
  size: '1024x1024'
})

// Upload to storage
const base64 = response.data[0].b64_json
const binary = atob(base64)
const bytes = new Uint8Array(binary.length)
for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
const blob = new Blob([bytes], { type: 'image/png' })

const { data } = await insforge.storage.from('ai-images').uploadAuto(blob)
```

---

## Best Practices

1. **Always discover models first**
   - Run `npx @insforge/cli metadata --json` or query `ai.configs` table before writing AI code
   - Only use `model_id` values that exist and are active

2. **Use exact model IDs from configurations**
   - Model IDs must match exactly what's in `ai.configs`
   - Example: `anthropic/claude-sonnet-4.5` not `claude-sonnet` or `sonnet-4.5`

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
| ❌ Using unconfigured model IDs | ✅ Check `ai.configs` table or CLI metadata first |
| ❌ Hardcoding model IDs without verification | ✅ Query available models, use exact `model_id` from response |
| ❌ Ignoring errors | ✅ Always handle `error` in response |
| ❌ Storing base64 image data in database | ✅ Upload to storage, save URL/key to database |

## When AI Requests Fail

If AI requests fail with model-related errors:

1. **Check if the model is configured** for this project
2. **If not configured**, instruct the user:
   > "The AI model is not configured for this project. Please go to the InsForge Dashboard → AI Settings to add and enable the required model."
3. **Do not retry** with guessed model IDs

## Recommended Workflow

```text
1. Discover available models → npx @insforge/cli metadata --json
                               OR: npx @insforge/cli db query "SELECT model_id, provider, input_modality, output_modality FROM ai.configs WHERE is_active = true"
2. Confirm model is active   → Use only model_id values from the response
3. Implement SDK calls       → Use exact model_id string in SDK calls
4. Handle errors             → Show user-friendly messages
```
