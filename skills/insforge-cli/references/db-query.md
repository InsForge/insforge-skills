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

## Notes

- Use `auth.users(id)` for foreign key references to the auth users table.
- Use `auth.uid()` in RLS policies to reference the current authenticated user.
- Without `--unrestricted`, system tables are not accessible.
