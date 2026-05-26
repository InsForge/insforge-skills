# npx @insforge/cli db migrations

Manage developer database migration files for an InsForge project.

## Commands

```bash
npx @insforge/cli db migrations list
npx @insforge/cli db migrations fetch
npx @insforge/cli db migrations new <migration-name>
npx @insforge/cli db migrations up <migration-file-name-or-version>
npx @insforge/cli db migrations up --to <migration-file-name-or-version>
npx @insforge/cli db migrations up --all
```

## What Each Command Does

| Command | Description |
|--------|-------------|
| `list` | Show applied remote migrations (version, name, created date) |
| `fetch` | Download remote applied migrations into `migrations/` |
| `new <migration-name>` | Create the next local migration file with the next timestamp version |
| `up <filename\\|version>` | Apply exactly one explicit local migration file |
| `up --to <filename\\|version>` | Apply pending local migrations up to a chosen target |
| `up --all` | Apply every pending local migration file |

## Filename Format

Migration files must be named exactly:

```text
<migration_version>_<migration-name>.sql
```

Examples:

- valid: `20260418091500_create-users.sql`
- valid: `20260418103045_add-post-index.sql`
- invalid: `20260418_create-users.sql`
- invalid: `20260418091500_create_users.sql`
- invalid: `20260418091500_CreateUsers.sql`
- invalid: `20260418091500 create-users.sql`

### Migration Name Rules

The `<migration-name>` portion must use:

- lowercase letters
- numbers
- hyphens

No spaces, underscores, uppercase letters, or other special characters.

## Local Directory

Migration files live under:

```text
migrations/
```

## Examples

```bash
# View remote migration history
npx @insforge/cli db migrations list

# Fetch remote migration files into migrations/
npx @insforge/cli db migrations fetch

# Create the next migration file
npx @insforge/cli db migrations new create-posts

# Apply by exact filename
npx @insforge/cli db migrations up 20260418091500_create-posts.sql

# Apply by version
npx @insforge/cli db migrations up 20260418091500

# Apply all pending migrations through a target
npx @insforge/cli db migrations up --to 20260418110000

# Apply all pending migrations
npx @insforge/cli db migrations up --all

# JSON output
npx @insforge/cli db migrations list --json
```

## Output

- `list` prints a table with version, name, and created date
- `fetch` reports how many files were created and skipped
- `new` prints the created filename
- `up` prints the applied filename(s) on success

## Command Behavior

### `list`

- Reads the current remote migration history from the project backend
- Shows only applied remote migrations

### `fetch`

- Ensures `migrations/` exists
- Writes one local `.sql` file per applied remote migration
- Skips existing file paths without overwriting them, even if the contents differ

### `new <migration-name>`

- Validates the migration name
- Looks at the latest remote migration version
- Validates local filenames before choosing the next timestamp version
- Uses the greater of current UTC time or the latest known local/remote version, bumping by one second when needed
- Fails if local migration filenames are malformed or duplicated

### `up <filename|version>`

- Resolves exactly one local file target
- Applies exactly one migration file
- The target must be the next pending local migration after the latest remote version
- Fails if the target is ambiguous, missing, empty, invalidly named, or already applied
- Unrelated invalid files elsewhere in `migrations/` do not block an explicit valid target

### `up --to <filename|version>`

- Strictly validates every local migration filename first
- Applies pending local migrations in ascending version order
- Stops after the chosen target migration is applied
- Fails if the target is missing, already applied, ambiguous, or not present in the pending set

### `up --all`

- Strictly validates every local migration filename first
- Applies every pending local migration in ascending version order
- Stops on the first failure

## Best Practices

1. **Start with `list` on unfamiliar projects**
   - Check the current remote migration history before creating or applying anything.

2. **Use migrations for schema changes**
   - Migration SQL runs as `project_admin`.
   - `project_admin` can manage and own objects in `public`, but access to InsForge-managed schemas is restricted.
   - Create and evolve tables, indexes, policies, triggers, and other schema changes through migration files.
   - Only specific InsForge-managed tables allow developer RLS changes. For those documented tables, put RLS changes in migrations.
   - For managed tables that support triggers, create the trigger function in `public` and delete the trigger by dropping that function with `CASCADE`.
   - Reserve `db query` for row-level data fixes, backfills, and inspection.

3. **Check the live schema first**
   - Treat the current database schema as the source of truth.
   - Before writing a migration, inspect the newest state with `db tables / indexes / policies / triggers / functions` and `db migrations list`.

4. **Normalize large JSONB payloads into columns or child tables**
   - Avoid designing tables where app code reads/writes large JSONB blobs through PostgREST; large JSONB rows can drive excessive PostgREST memory use.
   - Use typed columns for fields used in filters, sorting, list views, RLS policies, or partial updates.
   - Use child tables for repeated nested objects, with foreign keys and indexes on ownership/lookup columns.
   - Keep JSONB for small, rarely queried metadata/config where whole-object reads and writes are acceptable.

5. **Run `fetch` on a new machine or branch**
   - Sync remote history into `migrations/` before adding local pending migrations.

6. **Use `new` instead of naming files by hand**
   - Let the CLI assign the next timestamp version safely.

7. **Use explicit single-target apply for focused changes**
   - `up <filename>` or `up <version>` is ideal when you want one specific migration.

8. **Use batch apply for CI or bootstrap**
   - `up --to <target>` or `up --all` is safer than hand-looping files in shell scripts because the CLI keeps ordering and fail-fast behavior consistent.

9. **Re-check schema after failures**
   - If a migration fails, inspect the live database state again before editing the migration file.
   - Adjust the SQL to match the newest schema instead of assuming the previous file is still correct.

10. **Treat fetched files as history**
   - Once a migration is applied remotely, avoid editing its local file.

11. **Do not include transaction statements in migration files**
   - The backend executes each migration inside its own transaction.
   - Do not add `BEGIN`, `COMMIT`, or `ROLLBACK` to the migration SQL.

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Naming files manually with underscores or spaces | Use `npx @insforge/cli db migrations new <migration-name>` |
| Reaching for `db query` to create or alter schema | Use migration files for schema changes; reserve `db query` for row changes |
| Trying to alter InsForge-managed tables like app-owned tables | Change only the RLS policies or trigger hooks that the module docs explicitly support; put normal schema changes in `public` tables |
| Storing large app state or repeated nested objects in one JSONB column | Normalize into typed columns and child tables before exposing the table through SDK/PostgREST CRUD |
| Applying a file out of order | Apply the next pending local migration, or fix/delete the earlier local file that is blocking it |
| Keeping a local file older than the current remote head | Rename it with a newer timestamp or delete it locally if it is stale |
| Adding `BEGIN` / `COMMIT` / `ROLLBACK` to migration SQL | Remove them; the backend already wraps the migration in its own transaction |
| Editing a failed migration without checking live state first | Re-inspect the current schema and adjust the SQL to match reality |
| Editing already-fetched remote history casually | Treat fetched files as applied history, not drafts |
| Assuming `fetch` overwrites local files | `fetch` skips existing file paths instead of replacing them |

## Recommended Workflow

```text
1. Inspect live schema first        → npx @insforge/cli db tables / indexes / policies / triggers / functions
2. Inspect remote migration state   → npx @insforge/cli db migrations list
3. Sync remote history locally      → npx @insforge/cli db migrations fetch
4. Design large JSONB as columns/child tables when needed → see rule 4 above
5. Create the next migration file   → npx @insforge/cli db migrations new <migration-name>
6. Edit the SQL file                → migrations/<version>_<migration-name>.sql
7. Apply one migration explicitly   → npx @insforge/cli db migrations up <filename>
8. Or batch apply safely            → npx @insforge/cli db migrations up --to <target> / --all
9. If it fails, fix/delete the local blocker → if an earlier file is broken or stale, fix it or remove it before retrying later ones
10. If SQL failed, inspect live state → check current schema again, then adjust the migration SQL
11. Re-check remote state           → npx @insforge/cli db migrations list
```
