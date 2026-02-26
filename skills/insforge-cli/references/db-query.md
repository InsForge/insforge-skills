# insforge db query

Execute a raw SQL query against the project database.

## Syntax

```bash
insforge db query <sql> [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--unrestricted` | Access system tables (e.g., `pg_tables`, `information_schema`) |

## Examples

```bash
# Basic query
insforge db query "SELECT * FROM auth.users LIMIT 10"

# Create a table
insforge db query "CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
)"

# Enable RLS
insforge db query "ALTER TABLE posts ENABLE ROW LEVEL SECURITY"

# Create RLS policy
insforge db query "CREATE POLICY \"public_read\" ON posts FOR SELECT USING (true)"

# Query system tables
insforge db query "SELECT * FROM pg_tables WHERE schemaname = 'public'" --unrestricted

# JSON output for scripting
insforge db query "SELECT count(*) FROM users" --json
```

## Output

- **Human:** Formatted table
- **JSON:** `{ "rows": [...] }`

## InsForge SQL References

When writing SQL for InsForge, use these built-in references:

| Reference | Description |
|-----------|-------------|
| `auth.uid()` | Returns current authenticated user's UUID (use in RLS policies) |
| `auth.users(id)` | Built-in users table — use for foreign keys, not a custom table |
| `system.update_updated_at()` | Built-in trigger function that auto-updates `updated_at` columns |

### Complete Example: Table with RLS and Triggers

```bash
insforge db query "CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)"

insforge db query "ALTER TABLE posts ENABLE ROW LEVEL SECURITY"

insforge db query "CREATE POLICY \"public_read\" ON posts FOR SELECT USING (true)"

insforge db query "CREATE POLICY \"owner_write\" ON posts
  FOR INSERT WITH CHECK (user_id = auth.uid())"

insforge db query "CREATE POLICY \"owner_update\" ON posts
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid())"

insforge db query "CREATE POLICY \"owner_delete\" ON posts
  FOR DELETE USING (user_id = auth.uid())"

insforge db query "CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at()"
```

## Notes

- Without `--unrestricted`, system tables (`pg_tables`, `information_schema`) are not accessible.
- For advanced RLS patterns (infinite recursion prevention, SECURITY DEFINER, performance), see the insforge skill's [postgres-rls.md](../../insforge/database/postgres-rls.md).
