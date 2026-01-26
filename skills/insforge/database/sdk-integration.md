# Database SDK Integration

Use InsForge SDK to perform CRUD operations in your frontend application.

## Setup

```javascript
import { createClient } from '@insforge/sdk'

const insforge = createClient({
  baseUrl: 'https://your-project.region.insforge.app',
  anonKey: 'your-anon-key'
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

## Best Practices

1. **Generate TypeScript interfaces for every table schema**
   - Use `GET /api/metadata/{tableName}` to get the table schema
   - Create a corresponding TypeScript interface/type for type safety
   - This helps catch errors at compile time and improves developer experience

### Example: Generate Interface from Schema

```typescript
// After checking table schema via GET /api/metadata/posts
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
1. Check table schema     → GET /api/metadata/{tableName}
2. Generate TypeScript interface for the table
3. Cast query results to the interface for type safety
4. Handle errors appropriately
```
