# Database Backend Configuration

Configure database schema using raw SQL. Requires admin authentication.

## Authentication

```
Authorization: Bearer {admin-token-or-api-key}
```

## Get Table Schema

Retrieve detailed schema information for a specific table.

```
GET /api/metadata/{tableName}
Authorization: Bearer {admin-token-or-api-key}
```

Response includes columns, types, constraints, indexes, and RLS policies.

## Execute Raw SQL

Single endpoint to perform any database operation.

```
POST /api/database/advance/rawsql
Authorization: Bearer {admin-token-or-api-key}
Content-Type: application/json

{
  "query": "YOUR SQL QUERY HERE",
  "params": []
}
```

## Bulk Upsert Data

Import CSV or JSON files directly into a table.

```
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
| With `upsertKey` | UPSERT - update existing, insert new |

## Quick Reference

| Task | Endpoint |
|------|----------|
| Get table schema | `GET /api/metadata/{tableName}` |
| Execute raw SQL | `POST /api/database/advance/rawsql` |
| Bulk import data | `POST /api/database/advance/bulk-upsert` |

---

## InsForge-Specific References

When writing SQL for InsForge, use these built-in references:

| Reference | Description |
|-----------|-------------|
| `auth.uid()` | Returns current authenticated user's UUID |
| `auth.users(id)` | Reference to the users table for foreign keys |
| `system.update_updated_at()` | Built-in trigger function for `updated_at` columns |

### Example: Table with User Ownership

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_posts" ON posts
  FOR ALL USING (user_id = auth.uid());

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();
```

---

## Best Practices

1. **Always enable RLS on tables with user data**
   - Use `auth.uid()` in policies to restrict access to the current user

2. **Reference `auth.users(id)` for user foreign keys**
   - This is the InsForge users table, not a custom table

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Forgetting to enable RLS | Always `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` |
| Using custom user table instead of `auth.users` | Reference `auth.users(id)` for user foreign keys |
| Not using `auth.uid()` in RLS policies | Use `auth.uid()` to get current user's ID |

## Recommended Workflow

```
1. Create table with auth.users reference
2. Enable RLS
3. Create policies using auth.uid()
4. Test with SDK
5. Populate data with bulk-upsert (optional)
```
