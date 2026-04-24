# pgvector on InsForge

Store embeddings and run similarity search via the PostgreSQL `vector`
extension. For generating embeddings and RAG flows, see
[../ai/embeddings-and-rag.md](../ai/embeddings-and-rag.md).

---

## Setup

Bring pgvector up on a project with four `npx @insforge/cli db query`
one-liners, in order:

```bash
# 1. Extension (name is `vector`, not `pgvector`)
npx @insforge/cli db query "create extension if not exists vector;"

# 2. Table — dimension must match the embedding model you'll use
npx @insforge/cli db query "
  create table documents (
    id bigserial primary key,
    content text,
    embedding vector(1536),
    created_at timestamptz default now()
  );
"

# 3. Similarity-search RPC
npx @insforge/cli db query "
  create or replace function match_documents(
    query_embedding vector(1536),
    match_count int default 5,
    match_threshold float default 0.78
  ) returns table (id bigint, content text, similarity float)
  language sql stable as \$\$
    select id, content, 1 - (embedding <=> query_embedding) as similarity
    from documents
    where 1 - (embedding <=> query_embedding) > match_threshold
    order by embedding <=> query_embedding
    limit match_count;
  \$\$;
"

# 4. HNSW index (safe on empty tables)
npx @insforge/cli db query "
  create index on documents using hnsw (embedding vector_cosine_ops);
"
```

> In zsh/bash, inner `$$` (PL/pgSQL delimiter) must be escaped as `\$\$` or
> wrapped in a SQL file via `npx @insforge/cli db query --file`.

Match `vector(N)` to the model's output dimension:

| Model | Dimensions |
|-------|------------|
| `openai/text-embedding-3-small` | 1536 |
| `openai/text-embedding-3-large` | 3072 |
| `openai/text-embedding-ada-002` | 1536 |
| `google/gemini-embedding-001` | 3072 |

A vector column's dimension can't be altered in place — prefer the larger
dimension up front if you expect to swap models.

---

## Usage Examples

### Distance Operators

Pick one and stick with it — the index operator class must match.

| Operator | Distance | When to use |
|----------|----------|-------------|
| `<=>` | Cosine | Default for normalized embeddings (OpenAI, Gemini). Similarity = `1 - distance`. |
| `<->` | L2 | Use only for un-normalized embeddings. |
| `<#>` | Inner product (negated) | Advanced. |

### Raw SQL Inserts

Cast a JSON-array literal to `vector(N)`. The syntax is identical for any
dimension — the 3-d demo below is runnable as-is:

```sql
create table vec_demo (id bigserial primary key, embedding vector(3));
insert into vec_demo (embedding) values ('[0.12, 0.34, 0.56]'::vector(3));
select * from vec_demo order by embedding <=> '[0.10, 0.30, 0.55]'::vector(3);
```

For a real 1536-d column, generate the literal via
`insforge.ai.embeddings.create()` rather than writing it by hand.

### SDK Insert

From the SDK, pass a plain `number[]` — no cast needed:

```typescript
await insforge.database.from('documents').insert([{
  content: 'example',
  embedding,  // number[] of length 1536 from embeddings.create()
}]);
```

### Similarity Search via RPC

Server-side math. Never compute distance in the client — it pulls every row
over the wire.

```typescript
const { data, error } = await insforge.database.rpc('match_documents', {
  query_embedding: queryEmbedding,  // number[]
  match_count: 5,
  match_threshold: 0.78,
});
```

Start at `match_threshold: 0.78` for OpenAI embeddings; raise to 0.85 if noisy,
lower to 0.70 if over-filtering.

---

## Best Practices

### Indexing

Without an index, pgvector does exact nearest-neighbor scan — correct but
linear. Add an index around 10k+ vectors. The operator class must match the
query operator or the planner silently skips the index.

| Operator | Operator class |
|----------|----------------|
| `<=>` | `vector_cosine_ops` |
| `<->` | `vector_l2_ops` |
| `<#>` | `vector_ip_ops` |

HNSW (recommended) — faster, more memory, safe on empty tables:

```sql
create index on documents using hnsw (embedding vector_cosine_ops);
```

IVFFlat — lower memory, but must be built **after** inserting representative
data (an empty-table IVFFlat index is useless):

```sql
create index on documents
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);  -- rule of thumb: rows / 1000
```

### RLS with Vector Columns

Standard [RLS](./postgres-rls.md) applies — the `match_*` RPC runs under the
caller's role. If you use `SECURITY DEFINER` to bypass RLS inside the RPC,
re-filter by `auth.uid()` (or `requesting_user_id()` for third-party auth)
inside the function body — otherwise users can query each other's vectors.

### Quick Reference

| Task | How |
|------|-----|
| Extension | `create extension if not exists vector;` |
| Column | `embedding vector(1536)` (match model) |
| Insert (SDK) | `.insert([{ embedding: number[] }])` |
| Insert (SQL) | `'[0.12, 0.34, ...]'::vector(1536)` |
| Search | `.rpc('match_documents', { query_embedding, match_count, match_threshold })` |

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Dimension mismatch between column and model | Set `vector(N)` to the model's exact output dimension |
| Passing the embedding as a string to `.rpc()` | Pass `number[]` — the SDK serializes it |
| IVFFlat on an empty table | Insert data first, then `CREATE INDEX` |
| Operator class ≠ query operator | `vector_l2_ops` index + `<=>` query → index is never used |
| Client-side distance math | Put the math in a SQL RPC |
| Mixing normalized + un-normalized vectors in one column | Cosine is only meaningful for normalized embeddings — pick one |
