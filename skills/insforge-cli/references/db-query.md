# npx @insforge/cli db query

Execute a raw SQL query against the project database for inspection and row-level data changes.

## Syntax

```bash
npx @insforge/cli db query <sql> [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--unrestricted` | Access system tables (e.g., `pg_tables`, `information_schema`) |

## Examples

```bash
# Basic query
npx @insforge/cli db query "SELECT * FROM auth.users LIMIT 10"

# Update rows
npx @insforge/cli db query "UPDATE posts SET status = 'published' WHERE id = 'post_123'"

# Insert rows
npx @insforge/cli db query "INSERT INTO posts (title, status) VALUES ('Hello', 'draft')"

# Delete rows
npx @insforge/cli db query "DELETE FROM posts WHERE archived = true"

# Query system tables
npx @insforge/cli db query "SELECT * FROM pg_tables WHERE schemaname = 'public'" --unrestricted

# JSON output for scripting
npx @insforge/cli db query "SELECT count(*) FROM users" --json
```

## Output

- **Human:** Formatted table
- **JSON:** `{ "rows": [...] }`

## Use Migrations for Schema Changes

Do **not** use `db query` for schema changes such as:

- `CREATE TABLE`
- `ALTER TABLE`
- `CREATE INDEX`
- `CREATE POLICY`
- `CREATE TRIGGER`
- other DDL or schema-shaping changes

Use `npx @insforge/cli db migrations new ...` and `npx @insforge/cli db migrations up ...` instead.

Use `db query` for:

- reading data
- backfilling or correcting rows
- one-off row updates
- inspecting database metadata or system tables

## InsForge SQL References

When writing SQL for InsForge, use these built-in references:

| Reference | Description |
|-----------|-------------|
| `auth.uid()` | Returns current authenticated user's UUID (use in RLS policies) |
| `auth.users(id)` | Built-in users table — use for foreign keys, not a custom table |
| `system.update_updated_at()` | Built-in trigger function that auto-updates `updated_at` columns |

### Complete Example: Row-Level Data Fix

```bash
# Inspect the current rows
npx @insforge/cli db query "SELECT id, status FROM posts WHERE status IS NULL"

# Backfill missing row values
npx @insforge/cli db query "UPDATE posts SET status = 'draft' WHERE status IS NULL"
```

## Notes

- Without `--unrestricted`, system tables (`pg_tables`, `information_schema`) are not accessible.
- For schema changes, use the migrations workflow in [db-migrations.md](db-migrations.md).
- For advanced RLS patterns (infinite recursion prevention, SECURITY DEFINER, performance), see the insforge skill's [postgres-rls.md](../../insforge/database/postgres-rls.md).
