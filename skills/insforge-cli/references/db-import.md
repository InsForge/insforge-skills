# insforge db import

Import database from a SQL file.

## Syntax

```bash
insforge db import <file> [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--truncate` | Truncate existing tables before import |

## Examples

```bash
# Import SQL file
insforge db import backup.sql

# Import with table truncation
insforge db import backup.sql --truncate
```

## Output

Displays filename, number of tables processed, and rows imported.

## Notes

- The file must be a valid SQL file (e.g., from `insforge db export`).
- Use `--truncate` carefully — it removes all existing data from tables before importing.
