# Embeddings and RAG

Use OpenRouter embeddings through the OpenAI SDK, then store vectors in
InsForge Postgres with pgvector. InsForge remains the database/vector store;
OpenRouter provides the AI model gateway.

Schema, distance operators, and indexing: see
[../database/pgvector.md](../database/pgvector.md).

OpenRouter references:

- [Embeddings](https://openrouter.ai/docs/api/reference/embeddings)
- [OpenAI SDK with OpenRouter](https://openrouter.ai/docs/guides/community/openai-sdk)

---

## Setup

### Database

Bring up the `vector` extension, `documents` table, and `match_documents` RPC
via `npx @insforge/cli db query` -- see the Setup section of
[../database/pgvector.md](../database/pgvector.md).

### AI Client

Ask the user to copy the active OpenRouter key from:

```text
InsForge Dashboard -> Model Gateway -> Overview -> Active OpenRouter key -> copy
```

Store it server-side:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

Install and initialize the OpenAI SDK:

```bash
npm install openai
```

```typescript
import OpenAI from 'openai'

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
})
```

Do not expose `OPENROUTER_API_KEY` to the browser. For frontend apps, generate
embeddings through a server route, server action, edge function, or backend.

### Picking an Embedding Model

Use an OpenRouter-supported embedding model. Common choices:

| Model | Dimensions | Notes |
|-------|------------|-------|
| `openai/text-embedding-3-small` | 1536 | Good default |
| `openai/text-embedding-3-large` | 3072 | Higher quality, larger vectors |
| `google/gemini-embedding-001` | 3072 | Gemini alternative |

List embedding models:

```bash
curl https://openrouter.ai/api/v1/embeddings/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

---

## Usage Examples

### Generate an Embedding

```typescript
const response = await openai.embeddings.create({
  model: 'openai/text-embedding-3-small',
  input: 'Your text here',
})

const vector = response.data[0].embedding
```

| Parameter | Type | Notes |
|-----------|------|-------|
| `model` | string | required; any OpenRouter-supported embedding model ID |
| `input` | `string \| string[]` | required; pass an array for batch |
| `encoding_format` | `'float' \| 'base64'` | default `'float'`; pgvector requires float arrays |
| `dimensions` | number | override output dims when the model supports it |

When `input` is an array, `response.data[i].embedding` aligns with `input[i]`.

### `storeDocument`

```typescript
async function storeDocument(content: string) {
  const response = await openai.embeddings.create({
    model: 'openai/text-embedding-3-small',
    input: content,
  })

  return insforge.database.from('documents').insert([{
    content,
    embedding: response.data[0].embedding,
  }]).select()
}
```

### `storeDocuments` (batch)

```typescript
async function storeDocuments(contents: string[]) {
  const response = await openai.embeddings.create({
    model: 'openai/text-embedding-3-small',
    input: contents,
  })

  const rows = contents.map((content, i) => ({
    content,
    embedding: response.data[i].embedding,
  }))

  return insforge.database.from('documents').insert(rows).select()
}
```

### `searchDocuments`

```typescript
async function searchDocuments(query: string) {
  const queryResponse = await openai.embeddings.create({
    model: 'openai/text-embedding-3-small',
    input: query,
  })

  return insforge.database.rpc('match_documents', {
    query_embedding: queryResponse.data[0].embedding,
    match_count: 5,
    match_threshold: 0.78,
  })
}
```

`match_documents` is defined in
[../database/pgvector.md](../database/pgvector.md).

### `askQuestion` (basic RAG)

Embed -> retrieve -> inject as context -> generate.

```typescript
async function askQuestion(question: string) {
  const embeddingResponse = await openai.embeddings.create({
    model: 'openai/text-embedding-3-small',
    input: question,
  })

  const { data: documents } = await insforge.database.rpc('match_documents', {
    query_embedding: embeddingResponse.data[0].embedding,
    match_count: 5,
    match_threshold: 0.78,
  })

  const context = (documents ?? [])
    .map((doc: { content: string }) => doc.content)
    .join('\n\n')

  const completion = await openai.chat.completions.create({
    model: 'openai/gpt-5.5',
    messages: [
      { role: 'system', content: `Answer using the following context:\n\n${context}` },
      { role: 'user', content: question },
    ],
  })

  return completion.choices[0]?.message?.content
}
```

---

## Best Practices

### Prototype -> Production

The basic RAG flow is prototype-grade. For production add chunking, query
rewriting, re-ranking, context truncation, and retrieval evaluation.

Pair InsForge with an orchestration framework for these:

| Framework | Language | Best for |
|-----------|----------|----------|
| LangChain | Python / TypeScript | Full pipeline orchestration |
| LlamaIndex | Python / TypeScript | Document indexing, query engines |
| Haystack | Python | Modular pipelines, evaluation |
| Vercel AI SDK | TypeScript | Streaming UI, React/Next.js |

All of them can use InsForge as a Postgres-backed vector store: generate
embeddings through OpenRouter, store vectors in InsForge, retrieve with
pgvector, then generate with OpenRouter.

### One Model per Column

Vectors from different embedding models live in different spaces. Pick one
model per column; re-embed on migration.

### Always Check `{ data, error }`

InsForge database SDK calls return `{ data, error }`. OpenAI SDK calls throw on
HTTP/API errors. Handle both styles explicitly.

### Quick Reference

| Task | Call |
|------|------|
| Embed one | `openai.embeddings.create({ model, input: 'text' })` |
| Embed batch | `openai.embeddings.create({ model, input: [...] })` |
| Store | `insforge.database.from('documents').insert([{ content, embedding }])` |
| Search | `insforge.database.rpc('match_documents', { query_embedding, match_count, match_threshold })` |
| Chat with context | `openai.chat.completions.create({ model, messages })` |

---

## Deprecated Fallback

`insforge.ai.embeddings.create()` and `insforge.ai.chat.completions.create()`
may still exist in older apps, but they are deprecated. Do not use them for new
RAG implementations unless the user explicitly asks to preserve legacy code.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Asking the user to enable an embedding model in AI Settings | Use OpenRouter embedding models and `OPENROUTER_API_KEY` |
| Querying `ai.configs` for embedding models | Use `/api/v1/embeddings/models` |
| Putting `OPENROUTER_API_KEY` in browser env vars | Keep it server-side |
| Column dimension does not match model dimension | Match `vector(N)` to the model output |
| `encoding_format: 'base64'` into pgvector | Use float arrays |
| Mixing embedding models in one column | Pick one; mixed vectors give meaningless search results |
