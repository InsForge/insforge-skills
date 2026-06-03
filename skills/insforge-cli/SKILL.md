---
name: insforge-cli
description: Use this skill for InsForge CLI database work: SQL migrations, raw SQL inspection, RLS policies, schema grants, indexes, triggers, functions, imports, and exports. For app code with @insforge/sdk, use the app SDK skill instead.
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
- Use `npx @insforge/cli db query <sql>` for inspection, targeted SQL checks, schema-cache reloads, and small corrective SQL only when a migration is not appropriate.
- Inspect current state with `db tables`, `db indexes`, `db policies`, `db triggers`, `db functions`, and `db migrations list`.
- Reload PostgREST schema cache after schema or policy changes when needed: `npx @insforge/cli db query "NOTIFY pgrst, 'reload schema'"`.
- For generic application database work, create and modify app-owned objects in the `public` schema.
- Create, alter, drop, grant, revoke, index, trigger, function, view, and policy changes on `public` application objects.
- Do not create custom schemas or write to InsForge-managed/system schemas such as `auth`, `storage`, `realtime`, `payments`, `graphql`, `extensions`, `pg_catalog`, `information_schema`, or `system`, unless you are working on that specific feature module and its docs explicitly allow the operation.
- It is allowed to reference built-in objects such as `auth.users(id)` and `auth.uid()` from public tables or public RLS policies; do not modify those built-in objects.
- Do not create users, seed business rows, or run application CRUD workflows unless the user request explicitly asks for data migration, repair, or test setup.

## RLS Guidance

- Use `auth.uid()` or an equivalent authenticated identity expression for user ownership checks.
- Add both SQL privileges and RLS policies. Policies do not replace `GRANT`.
- InsForge keeps `public` app tables broadly granted to runtime roles for smooth SDK/REST DX. A narrow column-level `GRANT` does not remove existing table-level privileges; explicitly `REVOKE UPDATE/INSERT/DELETE/SELECT` first when an operation or column must be restricted, then grant back only the allowed operations/columns.
- Prefer helper functions for cross-table RLS checks when direct policy joins can recurse through other RLS policies.
- Helper functions called from RLS policies that query RLS-enabled tables should be `SECURITY DEFINER`.
- Put RLS helper functions in `public`.
- For production-quality `SECURITY DEFINER` helpers, set a fixed search path, for example `SET search_path = public`.
- Include `WITH CHECK` for INSERT and UPDATE policies so writes cannot create rows the user should not own.

## References

- `references/db-migrations.md` - migration file creation and apply workflow.
- `references/db-query.md` - raw SQL execution and inspection.
- `references/db-rls.md` - InsForge/Postgres RLS patterns, recursion avoidance, and policy guidance.
- `references/db-export.md` / `references/db-import.md` - schema or data import/export tasks.
