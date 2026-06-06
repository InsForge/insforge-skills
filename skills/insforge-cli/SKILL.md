---
name: insforge-cli
description: Use this skill for InsForge CLI database work: SQL migrations, raw SQL inspection, RLS policies, schema grants, indexes, triggers, functions, integrity rules, vector/pgvector setup, imports, and exports. For app code with @insforge/sdk, use the app SDK skill instead.
license: MIT
metadata:
  author: insforge
  version: "database-cli"
  organization: InsForge
  date: June 2026
---

# InsForge CLI Database Skill

Use this skill for database schema, migration, query, and RLS work with the InsForge CLI. For storage, auth, realtime, payments, functions, deployment, or app SDK code, use the corresponding feature guidance instead of treating those modules as generic database work.

## CLI Invocation

Always use:

```bash
npx @insforge/cli <command>
```

When the project is already linked, use the current linked project. Run login, project creation, link, project discovery, organization listing, or cloud project commands only when connection setup is explicitly needed.

## Database Workflow

- Prefer `npx @insforge/cli db migrations new <name>` plus a migration SQL file for schema, grants, indexes, triggers, functions, and RLS policy changes.
- Apply migrations with `npx @insforge/cli db migrations up --all`.
- Use `npx @insforge/cli db query <sql>` for inspection and small corrective SQL only when a migration is not appropriate.
- For generic application database work, create and modify app-owned objects in the `public` schema.
- Create, alter, drop, grant, revoke, index, trigger, function, view, and policy changes on `public` application objects.
- Do not create custom schemas or write to InsForge-managed/system schemas such as `auth`, `storage`, `realtime`, `payments`, `graphql`, `extensions`, `pg_catalog`, `information_schema`, or `system`, unless you are working on that specific feature module and its docs explicitly allow the operation.
- It is allowed to reference built-in objects such as `auth.users(id)` and `auth.uid()` from public tables or public RLS policies; do not modify those built-in objects.
- Do not create users, seed business rows, or run application CRUD workflows unless the user request explicitly asks for data migration, repair, or test setup.

## RLS Guidance

- Use `auth.uid()` or an equivalent authenticated identity expression for user ownership checks.
- Add both SQL privileges and RLS policies. Policies do not replace `GRANT`.
- Prefer helper functions for cross-table RLS checks when direct policy joins can recurse through other RLS policies.
- Helper functions called from RLS policies that query RLS-enabled tables should be `SECURITY DEFINER`.
- Put RLS helper functions in `public` and schema-qualify references such as `public.team_members` and `auth.uid()`.
- Include `WITH CHECK` for INSERT and UPDATE policies so writes cannot create rows the user should not own.

## Integrity Guidance

For counters, balances, latest pointers, append-only history, state transitions, lifecycle guards, protected deletes, or trigger-maintained columns, read `references/db-integrity.md` before writing migrations.

## References

- `references/db-migrations.md` - migration file creation and apply workflow.
- `references/db-query.md` - raw SQL execution and inspection.
- `references/db-integrity.md` - constraints, triggers, derived state, lifecycle guards, append-only history, and server-maintained fields.
- `references/db-rls.md` - InsForge/Postgres RLS patterns, recursion avoidance, and policy guidance.
- `references/db-vector.md` - pgvector extension, vector schema, distance operators, indexes, and vector search SQL/RPC patterns.
- `references/db-export.md` / `references/db-import.md` - schema or data import/export tasks.
