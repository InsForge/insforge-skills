# npx @insforge/cli db query

Execute a raw SQL query against the project database for targeted inspection and row-level data changes.

## Syntax

```bash
npx @insforge/cli db query <sql> [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--json` | Return rows as JSON for scripting |

## Examples

```bash
# Basic query
npx @insforge/cli db query "SELECT * FROM posts LIMIT 10"

# Update rows
npx @insforge/cli db query "UPDATE posts SET status = 'published' WHERE id = 'post_123'"

# Insert rows
npx @insforge/cli db query "INSERT INTO posts (title, status) VALUES ('Hello', 'draft')"

# Delete rows
npx @insforge/cli db query "DELETE FROM posts WHERE archived = true"

# Inspect Postgres system catalog
npx @insforge/cli db query "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'public'"

# Inspect InsForge-managed schema data
npx @insforge/cli db query "SELECT * FROM auth.users LIMIT 10"

# JSON output for scripting
npx @insforge/cli db query "SELECT count(*) FROM posts" --json
```

## Output

- **Human:** Formatted table
- **JSON:** `{ "rows": [...] }`

## Permission Model and Schema Changes

`db query` runs as `project_admin`.

- `public`: full access for normal data changes and schema work.
- Postgres system catalogs such as `pg_catalog` and `information_schema`: read-only inspection is allowed.
- InsForge-managed/system schemas such as `auth`, `storage`, `realtime`, `payments`, `graphql`, `extensions`, `pg_catalog`, `information_schema`, or `system`: do not write or run DDL unless you are working on that specific feature module and its docs explicitly allow the operation.

Use `npx @insforge/cli db migrations new ...` and `npx @insforge/cli db migrations up ...` for schema changes on `public` application objects.

Use `db query` for:

- reading app data and inspecting managed-schema data
- inspecting Postgres system catalogs such as `pg_catalog` and `information_schema`
- backfilling or correcting rows in `public`
- one-off row updates in `public`

For schema, RLS, grants, triggers, functions, indexes, and extensions, create a
migration and apply it.

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

- For schema changes and RLS policy changes, use the migrations workflow in [migrations.md](migrations.md).
- For advanced access-control patterns (RLS recursion prevention, SECURITY DEFINER, performance), see [access-control.md](access-control.md).
