# pgvector on InsForge

InsForge supports the PostgreSQL `vector` extension (commonly called pgvector) for
storing embeddings and running similarity search. Use it for semantic search,
recommendations, and RAG pipelines.

For generating the embeddings themselves and wiring up a RAG flow, see
[../ai/embeddings-and-rag.md](../ai/embeddings-and-rag.md).

---

## Enable the Extension

Run once per project via the CLI:

```bash
npx @insforge/cli db query "create extension if not exists vector;"
```

The extension is named `vector` in PostgreSQL — not `pgvector`.

## Schema Design

The column dimension **must match the embedding model** you plan to use. Mismatched
dimensions are rejected at insert time.

```sql
create table documents (
  id          bigserial primary key,
  content     text,
  embedding   vector(1536),        -- matches openai/text-embedding-3-small
  created_at  timestamptz default now()
);
```

Common dimensions for the embedding models exposed through the InsForge AI gateway:

| Model | Dimensions |
|-------|------------|
| `openai/text-embedding-3-small` | 1536 |
| `openai/text-embedding-3-large` | 3072 |
| `openai/text-embedding-ada-002` | 1536 |
| `google/gemini-embedding-001` | 3072 |

If you plan to swap models later, prefer the larger dimension up front — you cannot
alter a vector column's dimension in place without a migration.

## Distance Operators

pgvector ships three distance operators. Pick one and stick with it: the index
operator class (below) must match.

| Operator | Distance | When to use |
|----------|----------|-------------|
| `<=>` | Cosine | Default for normalized embeddings (OpenAI, Gemini). Similarity = `1 - distance`. |
| `<->` | L2 (Euclidean) | Use only if your embeddings are not normalized. |
| `<#>` | Inner product (negated) | Advanced; negated so `ORDER BY ... ASC` still works. |

Ad-hoc search from SQL:

```sql
select id, content
from documents
order by embedding <=> '[0.1, 0.2, ...]'
limit 5;
```

## Similarity Search as an RPC

Client-side similarity math is almost always the wrong choice — it pulls every row
over the wire. Put similarity logic in a SQL function and call it via `.rpc()`.

```sql
create or replace function match_documents(
  query_embedding  vector(1536),
  match_count      int    default 5,
  match_threshold  float  default 0.78
)
returns table (
  id         bigint,
  content    text,
  similarity float
)
language sql stable
as $$
  select
    id,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

Call it from the SDK:

```typescript
const { data, error } = await insforge.database.rpc('match_documents', {
  query_embedding: queryEmbedding,  // number[]
  match_count: 5,
  match_threshold: 0.78,
});
```

Tune `match_threshold` per use case — higher values return fewer but more relevant
results. 0.78 is a reasonable starting point for OpenAI `text-embedding-3-small`.

## Indexing

Without an index, pgvector runs an exact nearest-neighbor scan. Correct but linear
in table size. Add an index when you have roughly 10k+ vectors.

Always match the index's operator class to the distance operator you query with:

| Distance operator | Operator class |
|-------------------|----------------|
| `<=>` cosine | `vector_cosine_ops` |
| `<->` L2 | `vector_l2_ops` |
| `<#>` inner product | `vector_ip_ops` |

### HNSW (recommended)

Faster queries, more memory. Works on empty tables.

```sql
create index on documents
using hnsw (embedding vector_cosine_ops);
```

### IVFFlat

Lower memory, but **create it after inserting representative data** — it builds
clusters from what's already in the table. Creating it empty gives you a useless
index.

```sql
create index on documents
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);  -- rule of thumb: rows / 1000, capped at ~sqrt(rows) for large tables
```

## RLS with Vector Columns

pgvector columns play nicely with [Row Level Security](./postgres-rls.md). The
`match_*` RPC runs under the caller's role, so the usual policies apply. If you
use `SECURITY DEFINER` to bypass RLS inside the function, re-filter by
`auth.uid()` (or `requesting_user_id()` for third-party auth) inside the function
body — otherwise users can query each other's vectors.

## Quick Reference

| Task | How |
|------|-----|
| Enable extension | `create extension if not exists vector;` |
| Create column | `embedding vector(<dim>)` |
| Insert | `.insert([{ embedding: number[] }])` via SDK |
| Exact search | `order by embedding <=> $1 limit N` |
| Indexed search | HNSW on `vector_cosine_ops`, then same query |
| Call from SDK | `.rpc('match_documents', { query_embedding, ... })` |

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Dimension mismatch between column and model | Set `vector(N)` to exactly the model's output dimension |
| Sending the embedding as a string to `.rpc()` | Pass the raw `number[]` — the SDK serializes it correctly |
| Creating IVFFlat on an empty table | Insert data first, then `CREATE INDEX` |
| Index operator class ≠ query operator | e.g. `vector_l2_ops` index but querying with `<=>` means the index is never used |
| Client-side distance math | Always compute distance inside SQL via an RPC |
| Mixing normalized and un-normalized vectors | Pick one. Cosine distance is only meaningful for normalized embeddings |
