# Embeddings and RAG

`insforge.ai.embeddings.create()` generates vector embeddings through the
InsForge AI gateway. Store them in a pgvector column and retrieve them for
semantic search or RAG.

Schema, distance operators, and indexing: see
[../database/pgvector.md](../database/pgvector.md).

---

## Setup

### Database

Bring up the `vector` extension, `documents` table, and `match_documents` RPC
via `npx @insforge/cli db query` — see the Setup section of
[../database/pgvector.md](../database/pgvector.md).

### Client

Standard `@insforge/sdk` init — see the main [SKILL.md](../SKILL.md) for
framework-specific env var names.

### Picking an Embedding Model

Embedding models route through the InsForge AI gateway (OpenRouter under the
hood) and work **without** needing a per-project `ai.configs` entry. Any
OpenRouter-supported embedding model ID is accepted directly.

This differs from chat/image models, which **do** need to be enabled in the
Dashboard → AI Settings (and appear in `ai.configs`). The chat path validates
against `ai.configs` and rejects unknown IDs; the embeddings path just forwards
to OpenRouter.

| Model | Dimensions | Notes |
|-------|------------|-------|
| `openai/text-embedding-3-small` | 1536 | Good default |
| `openai/text-embedding-3-large` | 3072 | Higher quality, 2× cost |
| `google/gemini-embedding-001` | 3072 | Gemini alternative |

If an embedding call fails with a model error, it's an OpenRouter availability
or typo issue — don't send the user to the Dashboard.

Sanity-check what chat/image models are exposed on a project (embeddings do
**not** appear here):

```bash
npx @insforge/cli db query "SELECT model_id, provider, input_modality, output_modality FROM ai.configs WHERE is_active = true"
```

---

## Usage Examples

### Generate an Embedding

```typescript
const response = await insforge.ai.embeddings.create({
  model: 'openai/text-embedding-3-small',
  input: 'Your text here',   // string or string[]
});

const vector = response.data[0].embedding;  // number[] of length 1536
```

| Parameter | Type | Notes |
|-----------|------|-------|
| `model` | string | required; any OpenRouter-supported embedding model ID — does **not** need `ai.configs` |
| `input` | `string \| string[]` | required; pass an array for batch |
| `encoding_format` | `'float' \| 'base64'` | default `'float'`; pgvector requires `'float'` |
| `dimensions` | number | override output dims when the model supports it |

When `input` is an array, `response.data[i].embedding` aligns with `input[i]`.

### `storeDocument`

```typescript
async function storeDocument(content: string) {
  const response = await insforge.ai.embeddings.create({
    model: 'openai/text-embedding-3-small',
    input: content,
  });

  return insforge.database.from('documents').insert([{
    content,
    embedding: response.data[0].embedding,
  }]).select();
}
```

### `storeDocuments` (batch)

```typescript
async function storeDocuments(contents: string[]) {
  const response = await insforge.ai.embeddings.create({
    model: 'openai/text-embedding-3-small',
    input: contents,
  });

  const rows = contents.map((content, i) => ({
    content,
    embedding: response.data[i].embedding,
  }));

  return insforge.database.from('documents').insert(rows).select();
}
```

### `searchDocuments`

```typescript
async function searchDocuments(query: string) {
  const queryResponse = await insforge.ai.embeddings.create({
    model: 'openai/text-embedding-3-small',
    input: query,
  });

  return insforge.database.rpc('match_documents', {
    query_embedding: queryResponse.data[0].embedding,
    match_count: 5,
    match_threshold: 0.78,
  });
}
```

`match_documents` is defined in
[../database/pgvector.md](../database/pgvector.md).

### `askQuestion` (basic RAG)

Embed → retrieve → inject as context → generate.

```typescript
async function askQuestion(question: string) {
  const embeddingResponse = await insforge.ai.embeddings.create({
    model: 'openai/text-embedding-3-small',
    input: question,
  });

  const { data: documents } = await insforge.database.rpc('match_documents', {
    query_embedding: embeddingResponse.data[0].embedding,
    match_count: 5,
    match_threshold: 0.78,
  });

  const context = (documents ?? [])
    .map((doc: { content: string }) => doc.content)
    .join('\n\n');

  // chat model MUST be enabled in ai.configs (unlike embeddings)
  const completion = await insforge.ai.chat.completions.create({
    model: 'openai/gpt-4o-mini',
    messages: [
      { role: 'system', content: `Answer using the following context:\n\n${context}` },
      { role: 'user', content: question },
    ],
  });

  return completion.choices[0].message.content;
}
```

---

## Best Practices

### Prototype → Production

The basic RAG flow is prototype-grade. For production add chunking (semantic
boundaries, not fixed tokens), query rewriting, re-ranking, context
truncation, and retrieval evaluation.

Pair InsForge with an orchestration framework for these:

| Framework | Language | Best for |
|-----------|----------|----------|
| LangChain | Python / TypeScript | Full pipeline orchestration |
| LlamaIndex | Python / TypeScript | Document indexing, query engines |
| Haystack | Python | Modular pipelines, evaluation |
| Vercel AI SDK | TypeScript | Streaming UI, React/Next.js |

All of them plug into InsForge as a Postgres-backed vector store: call
`insforge.ai.embeddings.create()` for embeddings and
`insforge.ai.chat.completions.create()` for generation.

### One Model per Column

Vectors from different embedding models live in different spaces — mixing them
makes cosine distance meaningless. Pick one model per column; re-embed on
migration.

### Always Check `{ data, error }`

Every SDK call returns `{ data, error }`. Malformed vectors typically fail at
`.rpc()` rather than at insert, so check `error` before using `data`.

### Quick Reference

| Task | Call |
|------|------|
| Embed one | `insforge.ai.embeddings.create({ model, input: 'text' })` |
| Embed batch | `insforge.ai.embeddings.create({ model, input: [...] })` |
| Store | `insforge.database.from('documents').insert([{ content, embedding }])` |
| Search | `insforge.database.rpc('match_documents', { query_embedding, match_count, match_threshold })` |
| Chat w/ context | `insforge.ai.chat.completions.create({ model, messages })` |

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Sending the user to the Dashboard to "enable an embedding model" | Embedding models don't live in `ai.configs` — they route through OpenRouter. Failed call = wrong model name or OpenRouter outage |
| Column dimension ≠ model dimension | Match `vector(N)` to the model's output exactly |
| `encoding_format: 'base64'` into pgvector | Use `'float'` (default) — pgvector expects `number[]` |
| Client-side cosine math | Use an RPC |
| Mixing embedding models in one column | Pick one; mixed vectors give meaningless distances |
| Ignoring `error` on `.rpc()` | Check `{ data, error }` — malformed vectors fail here, not at insert |
