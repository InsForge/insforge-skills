# Embeddings and RAG

Use `insforge.ai.embeddings.create()` to generate vector embeddings through the
InsForge AI gateway, store them in a pgvector column, and retrieve them for
semantic search or retrieval-augmented generation.

The database-side schema, distance operators, and indexing live in
[../database/pgvector.md](../database/pgvector.md). This guide covers the SDK
usage and end-to-end patterns.

---

## Picking an Embedding Model

Embedding models route through the InsForge AI gateway (OpenRouter under the
hood) and work **without** needing a per-project `ai.configs` entry. Any
OpenRouter-supported embedding model ID is accepted directly.

This is different from chat and image models, which **do** need to be enabled
in the Dashboard → AI Settings (and appear in `ai.configs`). The chat path
validates against `ai.configs` and rejects unknown IDs; the embeddings path
just forwards to OpenRouter.

Practical defaults:

| Model | Dimensions | Notes |
|-------|------------|-------|
| `openai/text-embedding-3-small` | 1536 | Good default — cheap, fast, strong quality |
| `openai/text-embedding-3-large` | 3072 | Higher quality, 2× storage/cost |
| `google/gemini-embedding-001` | 3072 | Gemini alternative |

If an embedding call fails with a model error, it's an OpenRouter availability
issue, not an InsForge configuration issue — don't send the user to the
Dashboard for this.

You can sanity-check what embedding and chat models are exposed via the CLI:

```bash
npx @insforge/cli db query "SELECT model_id, provider, input_modality, output_modality FROM ai.configs WHERE is_active = true"
```

Note: this table tracks chat/image models, not embeddings. Don't use it to
"validate" an embedding model.

## Generate an Embedding

```typescript
const response = await insforge.ai.embeddings.create({
  model: EMBEDDING_MODEL_ID,           // e.g. 'openai/text-embedding-3-small' — see 'Picking an Embedding Model' above
  input: 'Your text here',             // string or string[]
});

const vector = response.data[0].embedding;  // number[]
```

Supported parameters:

| Parameter | Type | Notes |
|-----------|------|-------|
| `model` | string | required; any OpenRouter-supported embedding model ID — does **not** need to be in `ai.configs` |
| `input` | string \| string[] | required; pass an array for batch embedding |
| `encoding_format` | `'float'` \| `'base64'` | default `'float'`; use `'float'` for pgvector |
| `dimensions` | number | override output dimensionality when the model supports it |

`response.data` is aligned with `input` — `data[i].embedding` corresponds to
`input[i]` when you pass an array.

## Store in pgvector

Your table must have a `vector(N)` column whose dimension matches the model's
output. See [../database/pgvector.md](../database/pgvector.md) for schema details.

```typescript
async function storeDocument(content: string) {
  const response = await insforge.ai.embeddings.create({
    model: EMBEDDING_MODEL_ID,
    input: content,
  });

  return insforge.database.from('documents').insert([{
    content,
    embedding: response.data[0].embedding,
  }]).select();
}
```

### Batch Inserts

Embed and insert in batches to respect rate limits and reduce round trips.

```typescript
async function storeDocuments(contents: string[]) {
  const response = await insforge.ai.embeddings.create({
    model: EMBEDDING_MODEL_ID,
    input: contents,                     // array
  });

  const rows = contents.map((content, i) => ({
    content,
    embedding: response.data[i].embedding,
  }));

  return insforge.database.from('documents').insert(rows).select();
}
```

## Similarity Search

Call a SQL RPC — never compute distance in the client.

```typescript
async function searchDocuments(query: string) {
  const queryResponse = await insforge.ai.embeddings.create({
    model: EMBEDDING_MODEL_ID,
    input: query,
  });

  return insforge.database.rpc('match_documents', {
    query_embedding: queryResponse.data[0].embedding,
    match_count: 5,
    match_threshold: 0.78,
  });
}
```

The `match_documents` function is defined in
[../database/pgvector.md](../database/pgvector.md).

## Basic RAG Pipeline

Embed → retrieve → inject as context → generate.

```typescript
async function askQuestion(question: string) {
  // 1. Embed the question
  const embeddingResponse = await insforge.ai.embeddings.create({
    model: EMBEDDING_MODEL_ID,
    input: question,
  });

  // 2. Retrieve relevant documents
  const { data: documents } = await insforge.database.rpc('match_documents', {
    query_embedding: embeddingResponse.data[0].embedding,
    match_count: 5,
    match_threshold: 0.78,
  });

  // 3. Build context
  const context = (documents ?? [])
    .map((doc: { content: string }) => doc.content)
    .join('\n\n');

  // 4. Generate an answer with context
  const completion = await insforge.ai.chat.completions.create({
    model: CHAT_MODEL_ID,                // from ai.configs
    messages: [
      {
        role: 'system',
        content: `Answer the question based on the following context:\n\n${context}`,
      },
      { role: 'user', content: question },
    ],
  });

  return completion.choices[0].message.content;
}
```

This is a prototype-grade flow. For production RAG you will want:

- **Chunking** — split source documents along semantic boundaries, not fixed
  token counts.
- **Query rewriting** — rephrase the user's question to improve recall.
- **Re-ranking** — score retrieved chunks with a cross-encoder before passing
  them to the LLM.
- **Context assembly** — truncate and format chunks to fit the model's window.
- **Evaluation** — measure retrieval precision, faithfulness, and hallucination.

Pair InsForge with an orchestration framework (LangChain, LlamaIndex, Haystack,
Vercel AI SDK) for these concerns. All of them can use InsForge as a
Postgres-backed vector store: call `insforge.ai.embeddings.create()` for
embeddings and `insforge.ai.chat.completions.create()` for generation.

## Quick Reference

| Task | Call |
|------|------|
| Embed one string | `insforge.ai.embeddings.create({ model, input: 'text' })` |
| Embed a batch | `insforge.ai.embeddings.create({ model, input: [...] })` |
| Store | `insforge.database.from('documents').insert([{ content, embedding }])` |
| Search | `insforge.database.rpc('match_documents', { query_embedding, match_count, match_threshold })` |
| Chat with context | `insforge.ai.chat.completions.create({ model, messages })` |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Telling the user to enable an embedding model in the Dashboard | Embedding models don't live in `ai.configs` — they route through OpenRouter directly. If an embed call fails, the model name is wrong or OpenRouter is down |
| Column dimension ≠ model dimension | Match `vector(N)` to the model's output exactly |
| Passing `encoding_format: 'base64'` to pgvector | Use `'float'` (the default) — pgvector expects `number[]` |
| Computing cosine similarity in the client | Use an RPC that does the math inside SQL |
| Storing embeddings for different models in the same column | Pick one model per column; a mixed column gives meaningless distances |
| Ignoring `error` on `.rpc()` | Always check `{ data, error }` — malformed vectors fail here, not at insert time |
