# Database Access Control for InsForge

## Overview

Database access control combines SQL privileges, Row Level Security (RLS), helper functions, triggers, constraints, and indexes. RLS provides defense-in-depth for data isolation, but it only works after SQL privileges allow the operation to reach the policy layer.

**Core principle:** grant only the operation surface users need, then enforce row and state invariants with RLS and database-side guards. RLS is your last line of defense, not your only one.

---

## InsForge Access Control Basics

InsForge uses three built-in PostgreSQL roles:

| Role | Description | When active |
|------|-------------|-------------|
| `anon` | Unauthenticated users | No valid session token |
| `authenticated` | Logged-in users | Valid session token present |
| `project_admin` | Project admin | CLI `db query`, migrations, API-key/admin tasks |

The current user's ID is available via `auth.uid()`. All user foreign keys should reference `auth.users(id)`.

Raw SQL from `db query` and migration files runs as `project_admin`. This role can manage and own objects in `public`; access to InsForge-managed schemas is restricted.

### Schema Scope and Managed Modules

For generic application database work, create and modify app-owned objects in the `public` schema.

- Create, alter, drop, grant, revoke, index, trigger, function, view, and policy changes on `public` application objects.
- Do not create custom schemas or write to InsForge-managed/system schemas such as `auth`, `storage`, `realtime`, `payments`, `graphql`, `extensions`, `pg_catalog`, `information_schema`, or `system`, unless you are working on that specific feature module and its docs explicitly allow the operation.
- It is allowed to reference built-in objects such as `auth.users(id)` and `auth.uid()` from public tables or public RLS policies; do not modify those built-in objects.
- Put RLS helper functions in `public` and set a fixed search path, for example `SET search_path = public`.

Managed table RLS belongs to the corresponding storage, realtime, or payments feature context. Use those feature docs when the task is specifically about those modules.

### Minimal RLS Setup

```sql
-- 1. Create table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- 3. Create policies
CREATE POLICY "anyone can read" ON posts
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "owners can insert" ON posts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owners can update" ON posts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owners can delete" ON posts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 4. Grant SQL privileges to the roles that should pass through the policies
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON posts TO authenticated;

-- 5. Auto-update updated_at
CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();
```

Policies decide which rows a role may access after PostgreSQL has allowed the SQL operation. They do not grant `SELECT`, `INSERT`, `UPDATE`, or `DELETE` privileges. If a table has policies but no matching `GRANT`, SDK/REST calls still fail before RLS can allow the row.

### InsForge Public Schema Default Privileges

For smooth SDK/REST development, InsForge treats `public` as the application data surface. New public tables usually inherit broad runtime privileges for `anon` and `authenticated`; RLS policies are expected to decide row-level access.

Do not assume a new table starts with no runtime privileges. A narrow grant such as `GRANT UPDATE (title) ON posts TO authenticated` only adds permission; it does not remove an existing table-level `UPDATE`. For protected columns or operations, revoke first, then grant back the exact surface:

```sql
REVOKE UPDATE ON posts FROM anon, authenticated;
GRANT UPDATE (title) ON posts TO authenticated;
```

For immutable fields, counters, role columns, ownership fields, or trigger-maintained columns, prefer a `BEFORE UPDATE` trigger guard as a second line of defense. Column privileges are useful, but triggers make the invariant independent of inherited grants and API behavior.

### Design the Operation Surface First

Before writing policies, list the exact operations that normal SDK/REST callers should be able to perform:

| Question | Access-control decision |
|----------|-------------------------|
| Can callers create rows? | Grant `INSERT` on every column a legitimate insert payload may send. Do not accidentally omit generated-but-client-supplied columns such as `id` when clients are allowed to provide them. |
| Can callers edit rows? | Prefer row-level `UPDATE` policies plus trigger guards for protected columns. Use column-level `UPDATE` grants only when the legal update surface is intentionally narrow. |
| Can callers delete rows? | Grant `DELETE` only when the domain really allows deletion; otherwise omit the grant and policy, or model archival/soft delete explicitly. |
| Are some fields system-maintained? | Keep the client from mutating them, but make sure internal triggers can still maintain them. |

When using column-level privileges, test at least one legal insert/update payload and one illegal protected-field mutation. A policy can be correct while the SQL privilege layer still blocks legitimate SDK calls.

### Guard Protected Columns with Triggers

Use trigger guards for invariants that must hold regardless of grants, REST behavior, or future policy edits. Common protected fields include `owner_id`, `tenant_id`, role columns, counters, status history fields, and foreign keys that define access.

```sql
CREATE OR REPLACE FUNCTION protect_post_owner()
RETURNS trigger AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'owner_id cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_post_owner
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION protect_post_owner();
```

For trigger-maintained fields, do not create a guard that blocks your own maintenance trigger. Prefer a single `BEFORE UPDATE` trigger that both validates user-controlled fields and sets derived fields, or make the guard allow transitions caused by the trusted trigger logic.

### Model ACLs as Positive Capabilities

For owner/editor/viewer/member ACLs, avoid one broad `FOR ALL` policy. Write separate policies for each operation and express the positive capability needed for that operation:

- `SELECT`: owner or active viewer/editor share.
- `UPDATE`: owner or active editor share, with `WITH CHECK` preserving the same ownership and tenant invariants.
- `DELETE`: usually owner/admin only.
- Share mutation: usually owner/admin only; viewers should not reshare or escalate themselves.

Cross-table ACL checks often query RLS-enabled tables. Put those checks in `SECURITY DEFINER` helpers with a fixed `search_path` so policy evaluation does not recurse through the helper's source tables.

### Soft Delete and Active Uniqueness

For "unique while active" rules, use a partial unique index and explicit transition policies/guards:

```sql
CREATE UNIQUE INDEX active_posts_slug_unique
ON posts (owner_id, slug)
WHERE deleted_at IS NULL;
```

Then make the allowed state transitions clear:

- Active row can be soft-deleted by the owner/admin.
- Soft-deleted row can be restored only if it does not violate the active unique index.
- Normal content updates should not silently change `owner_id`, `deleted_at`, or other lifecycle fields unless that transition is allowed.

---

## Critical Vulnerabilities

### 1. Infinite Recursive RLS (CRITICAL — Causes OOM Crash)

**This is the most dangerous RLS bug.** When RLS policies on table A call a function that queries table B, and table B's RLS calls a function that queries table A (or itself), PostgreSQL enters infinite recursion until the server runs out of memory and is killed by the OS.

**Real-world example:**

```
companies → is_company_member() → queries company_memberships
                                     → RLS on company_memberships
                                     → is_company_consultant_or_admin()
                                     → company_role()
                                     → queries company_memberships (LOOP!)
                                     → OOM → SIGKILL
```

**How to detect:**
- Database connection hangs, then the server crashes
- PostgreSQL logs show `SIGKILL` or out-of-memory errors
- `EXPLAIN` on the query runs forever

**The fix — use SECURITY DEFINER:**

```sql
-- DANGEROUS: This function runs as the calling role, so RLS is enforced
-- on every table it touches — creating recursion risk
CREATE OR REPLACE FUNCTION is_company_member(company_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_memberships
    WHERE company_id = company_uuid AND user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE;

-- SAFE: SECURITY DEFINER runs as the function owner (postgres),
-- bypassing RLS on queried tables and breaking the recursion
CREATE OR REPLACE FUNCTION is_company_member(company_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM company_memberships
    WHERE company_id = company_uuid AND user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;
```

**Rule: Any helper function called from an RLS policy MUST be `SECURITY DEFINER`** if it queries tables that also have RLS enabled. Production helpers should set a fixed `search_path`.

**Checklist:**
- [ ] Map all RLS policy → function → table dependencies
- [ ] Every helper function that queries RLS-enabled tables is `SECURITY DEFINER`
- [ ] Every `SECURITY DEFINER` helper sets a fixed search path, for example `SET search_path = public`
- [ ] No circular chains: table A RLS → table B RLS → table A RLS
- [ ] Test with `EXPLAIN (ANALYZE)` to verify queries terminate

### 2. Missing USING or WITH CHECK (HIGH)

`USING` filters reads; `WITH CHECK` validates writes. Missing `WITH CHECK` allows inserting rows you can't read back.

```sql
-- INCOMPLETE: User can INSERT rows for other users
CREATE POLICY "owner access" ON posts
  FOR ALL USING (user_id = auth.uid());

-- COMPLETE: Both read and write protected
CREATE POLICY "owner access" ON posts
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**Checklist:**
- [ ] INSERT/UPDATE policies always include `WITH CHECK`
- [ ] `FOR ALL` policies include both `USING` and `WITH CHECK`

### 3. Overly Permissive Policies (HIGH)

Multiple policies on the same table are combined with OR. One overly broad policy defeats all others.

```sql
-- DANGEROUS: This single policy overrides all restrictions
CREATE POLICY "allow all reads" ON orders
  FOR SELECT USING (true);

CREATE POLICY "tenant isolation" ON orders
  FOR SELECT USING (tenant_id = auth.uid());
-- ^ This is useless — the first policy already allows everything
```

**Checklist:**
- [ ] Audit all policies per table — they combine with OR
- [ ] No `USING (true)` on sensitive tables unless intentional (e.g., public blog posts)

### 4. View Bypass (MEDIUM)

Views run with the creator's privileges by default.

```sql
-- DANGEROUS: View owned by superuser bypasses RLS
CREATE VIEW all_orders AS SELECT * FROM orders;

-- SAFE (PostgreSQL 15+): Respects caller's RLS
CREATE VIEW user_orders
WITH (security_invoker = true)
AS SELECT * FROM orders;
```

---

## Performance Considerations

### Index Policy Columns

Every column referenced in an RLS policy should be indexed:

```sql
CREATE INDEX idx_posts_user_id ON posts(user_id);
```

### Wrap Functions in Subqueries

Functions called per-row are expensive. Wrap in a subquery for single evaluation:

```sql
-- SLOW: auth.uid() called per row
CREATE POLICY "owner access" ON posts
  USING (user_id = auth.uid());

-- FASTER: Evaluated once
CREATE POLICY "owner access" ON posts
  USING (user_id = (SELECT auth.uid()));
```

### Use SECURITY DEFINER for Cross-Table Checks

Avoid RLS-on-RLS chains (see Infinite Recursive RLS above). Wrap cross-table lookups in `SECURITY DEFINER` functions:

```sql
CREATE OR REPLACE FUNCTION user_accessible_document_ids(uid UUID)
RETURNS SETOF UUID AS $$
  SELECT document_id FROM permissions WHERE user_id = uid;
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

CREATE POLICY "access check" ON documents
  USING (id IN (SELECT * FROM user_accessible_document_ids((SELECT auth.uid()))));
```

### Denormalize for Performance

Store `user_id` or `tenant_id` directly on every table instead of relying on joins:

```sql
-- SLOW: Must join to resolve ownership
CREATE POLICY "item access" ON order_items
  USING (order_id IN (
    SELECT id FROM orders WHERE user_id = auth.uid()
  ));

-- FAST: Direct column check
ALTER TABLE order_items ADD COLUMN user_id UUID REFERENCES auth.users(id);
CREATE POLICY "item access" ON order_items
  USING (user_id = (SELECT auth.uid()));
```

---

## Common InsForge Access Control Patterns

### Public Read, Owner Write

```sql
CREATE POLICY "public read" ON posts
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "owner write" ON posts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner update" ON posts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner delete" ON posts
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON posts TO authenticated;
```

### Role-Based Access with Helper Function

```sql
CREATE OR REPLACE FUNCTION is_org_member(org_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = org_uuid AND user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;  -- SECURITY DEFINER: prevents recursive RLS

CREATE POLICY "org members access" ON projects
  FOR ALL TO authenticated
  USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO authenticated;
```

### Authenticated-Only Access

```sql
CREATE POLICY "authenticated users only" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON profiles TO authenticated;
```

---

## Checklist

Before completing an RLS implementation:

- [ ] All tables with user data have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] Matching SQL privileges are granted to `anon`/`authenticated` (`GRANT USAGE ON SCHEMA ...`, `GRANT SELECT/INSERT/UPDATE/DELETE ON ...`)
- [ ] If relying on column-level or operation-level privileges, broad inherited public privileges are explicitly revoked before narrow grants are added
- [ ] All policies have both `USING` and `WITH CHECK` where applicable
- [ ] No circular RLS dependencies between tables (infinite recursion risk)
- [ ] All helper functions called from policies are `SECURITY DEFINER`
- [ ] All `SECURITY DEFINER` helpers set a fixed search path
- [ ] Policy columns (`user_id`, `tenant_id`, etc.) are indexed
- [ ] `(SELECT auth.uid())` used in subquery form for performance
- [ ] Views on RLS tables use `security_invoker = true` (PG15+)
- [ ] No overly permissive `USING (true)` on sensitive tables
- [ ] Tested as `authenticated` role, not as superuser/admin

## References

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [SECURITY DEFINER Functions](https://www.postgresql.org/docs/current/sql-createfunction.html)
