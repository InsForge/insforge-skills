# Database SDK Integration

Use InsForge SDK to perform CRUD operations in your frontend application.

## Setup

First, ensure your `.env` file is configured with your InsForge URL and anon key. Get the anon key with `npx @insforge/cli secrets get ANON_KEY`. See the main [SKILL.md](../SKILL.md) for framework-specific variable names and full setup steps.

```javascript
import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL,       // adjust prefix for your framework
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY   // adjust prefix for your framework
})
```

## CRUD Operations

### Select

```javascript
// All records
const { data, error } = await insforge.database.from('posts').select()

// Specific columns
const { data } = await insforge.database.from('posts').select('id, title')

// With relationships
const { data } = await insforge.database.from('posts').select('*, comments(id, content)')
```

### Insert

```javascript
// Single record (MUST use array format)
const { data, error } = await insforge.database
  .from('posts')
  .insert([{ title: 'Hello', content: 'World' }])
  .select()

// Bulk insert
const { data } = await insforge.database
  .from('posts')
  .insert([{ title: 'A' }, { title: 'B' }])
  .select()
```

### Update

```javascript
const { data, error } = await insforge.database
  .from('posts')
  .update({ title: 'Updated' })
  .eq('id', postId)
  .select()
```

### Delete

```javascript
const { error } = await insforge.database
  .from('posts')
  .delete()
  .eq('id', postId)
```

### RPC (Stored Procedures)

```javascript
const { data, error } = await insforge.database.rpc('get_user_stats', { user_id: '123' })
```

## Filters

| Filter | Example |
|--------|---------|
| `.eq(col, val)` | `.eq('status', 'active')` |
| `.neq(col, val)` | `.neq('status', 'deleted')` |
| `.gt(col, val)` | `.gt('age', 18)` |
| `.gte(col, val)` | `.gte('price', 100)` |
| `.lt(col, val)` | `.lt('stock', 10)` |
| `.lte(col, val)` | `.lte('score', 50)` |
| `.like(col, pattern)` | `.like('name', '%Widget%')` |
| `.ilike(col, pattern)` | `.ilike('email', '%@gmail.com')` |
| `.in(col, array)` | `.in('status', ['pending', 'active'])` |
| `.is(col, val)` | `.is('deleted_at', null)` |

## Modifiers

| Modifier | Example |
|----------|---------|
| `.order(col, opts)` | `.order('created_at', { ascending: false })` |
| `.limit(n)` | `.limit(10)` |
| `.range(from, to)` | `.range(0, 9)` |
| `.single()` | Returns object, throws if multiple |
| `.maybeSingle()` | Returns object or null |

## Pagination

```javascript
const page = 1, pageSize = 10
const from = (page - 1) * pageSize
const to = from + pageSize - 1

const { data, count } = await insforge.database
  .from('posts')
  .select('*', { count: 'exact' })
  .range(from, to)
  .order('created_at', { ascending: false })
```

## Important Notes

- **Insert requires array format**: Always use `insert([{...}])` not `insert({...})`
- All methods return `{ data, error }` - always check for errors

---

## InsForge SQL References

When creating tables via `insforge db query` (CLI), use these built-in references:

| Reference | Description |
|-----------|-------------|
| `auth.uid()` | Returns current authenticated user's UUID |
| `auth.users(id)` | Reference to the built-in users table for foreign keys |
| `system.update_updated_at()` | Built-in trigger function that auto-updates `updated_at` columns |

### Complete Example: Table with RLS and Triggers

```sql
-- Create table with user ownership
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Policies (see postgres-rls.md for advanced patterns)
CREATE POLICY "users_own_posts" ON posts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at on every UPDATE
CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();
```

> For RLS best practices (infinite recursion prevention, SECURITY DEFINER, performance), see [postgres-rls.md](postgres-rls.md).

### Bulk Upsert (HTTP API)

Import CSV or JSON files directly into a table. No CLI equivalent yet — use the HTTP API.

```http
POST /api/database/advance/bulk-upsert
Authorization: Bearer {admin-token-or-api-key}
Content-Type: multipart/form-data

Fields:
- file: CSV or JSON file (required)
- table: Target table name (required)
- upsertKey: Column for conflict resolution (optional)
```

| Parameter | Effect |
|-----------|--------|
| Without `upsertKey` | INSERT all records |
| With `upsertKey` | UPSERT — update existing rows on conflict, insert new ones |

---

## Best Practices

1. **Generate TypeScript interfaces for every table schema**
   - Use `insforge db tables` and `insforge db query` (CLI) to inspect the table schema
   - Create a corresponding TypeScript interface/type for type safety
   - This helps catch errors at compile time and improves developer experience

### Example: Generate Interface from Schema

```typescript
// After checking table schema via `insforge db tables`
// Create a typed interface:

interface Post {
  id: string
  user_id: string
  title: string
  content: string | null
  created_at: string
  updated_at: string
}

// Cast data to the interface after select
const { data, error } = await insforge.database
  .from('posts')
  .select()

const posts = data as Post[]
```

## Recommended Workflow

```
1. Check table schema     → insforge db tables / insforge db query
2. Generate TypeScript interface for the table
3. Cast query results to the interface for type safety
4. Handle errors appropriately
```
