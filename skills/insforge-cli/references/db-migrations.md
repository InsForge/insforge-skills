# npx @insforge/cli db migrations

Manage developer database migration files for an InsForge project.

## Commands

```bash
npx @insforge/cli db migrations list
npx @insforge/cli db migrations fetch
npx @insforge/cli db migrations new <migration-name>
npx @insforge/cli db migrations up <migration-file-name-or-sequence-number>
```

## What Each Command Does

| Command | Description |
|--------|-------------|
| `list` | Show applied remote migrations (sequence, name, created date) |
| `fetch` | Download remote applied migrations into `.insforge/migrations/` |
| `new <migration-name>` | Create the next local migration file with the next sequence number |
| `up <filename\\|sequence>` | Apply exactly one local migration file |

## Filename Format

Migration files must be named exactly:

```text
<migration_sequence_number>_<migration-name>.sql
```

Examples:

- valid: `1_create-users.sql`
- valid: `12_add-post-index.sql`
- invalid: `01_create-users.sql`
- invalid: `1_create_users.sql`
- invalid: `1_CreateUsers.sql`
- invalid: `1 create-users.sql`

### Migration Name Rules

The `<migration-name>` portion must use:

- lowercase letters
- numbers
- hyphens

No spaces, underscores, uppercase letters, or other special characters.

## Local Directory

Migration files live under:

```text
.insforge/migrations/
```

## Examples

```bash
# View remote migration history
npx @insforge/cli db migrations list

# Fetch remote migration files into .insforge/migrations/
npx @insforge/cli db migrations fetch

# Create the next migration file
npx @insforge/cli db migrations new create-posts

# Apply by exact filename
npx @insforge/cli db migrations up 3_create-posts.sql

# Apply by sequence number
npx @insforge/cli db migrations up 3

# JSON output
npx @insforge/cli db migrations list --json
```

## Output

- `list` prints a table with sequence number, name, and created date
- `fetch` reports how many files were created and skipped
- `new` prints the created filename
- `up` prints the applied filename on success

## Command Behavior

### `list`

- Reads the current remote migration history from the project backend
- Shows only applied remote migrations

### `fetch`

- Ensures `.insforge/migrations/` exists
- Writes one local `.sql` file per applied remote migration
- Skips existing file paths without overwriting them, even if the contents differ

### `new <migration-name>`

- Validates the migration name
- Looks at the latest remote migration sequence
- Validates local pending migrations before choosing the next sequence number
- Fails if local pending migrations are malformed, duplicated, or non-contiguous

### `up <filename|sequence>`

- Resolves exactly one local file target
- Applies exactly one migration file
- The target must be the next remote sequence
- Fails if the target is ambiguous, missing, empty, invalidly named, or already applied
- Unrelated invalid files elsewhere in `.insforge/migrations/` do not block an explicit valid target

## Best Practices

1. **Start with `list` on unfamiliar projects**
   - Check the current remote migration history before creating or applying anything.

2. **Run `fetch` on a new machine or branch**
   - Sync remote history into `.insforge/migrations/` before adding local pending migrations.

3. **Use `new` instead of naming files by hand**
   - Let the CLI assign the next sequence number safely.

4. **Prefer `up <filename>` over `up <sequence>`**
   - An explicit filename makes the target clearer and avoids ambiguity.

5. **Treat fetched files as history**
   - Once a migration is applied remotely, avoid editing its local file.

## Common Mistakes

| Mistake | Solution |
|---------|----------|
| Naming files manually with underscores or spaces | Use `npx @insforge/cli db migrations new <migration-name>` |
| Applying a file out of order | Only apply the next remote sequence |
| Expecting `up` to apply every pending file | `up` applies exactly one target migration |
| Editing already-fetched remote history casually | Treat fetched files as applied history, not drafts |
| Assuming `fetch` overwrites local files | `fetch` skips existing file paths instead of replacing them |

## Recommended Workflow

```text
1. Inspect remote state             → npx @insforge/cli db migrations list
2. Sync remote history locally      → npx @insforge/cli db migrations fetch
3. Create the next migration file   → npx @insforge/cli db migrations new <migration-name>
4. Edit the SQL file                → .insforge/migrations/<sequence>_<migration-name>.sql
5. Apply one migration explicitly   → npx @insforge/cli db migrations up <filename>
6. Re-check remote state            → npx @insforge/cli db migrations list
```
