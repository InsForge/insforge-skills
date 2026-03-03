# PostgreSQL Row Level Security (RLS) for InsForge

## Overview

Row Level Security (RLS) provides defense-in-depth for data isolation. When implemented correctly, it prevents data leaks even if application code misses a filter. When implemented incorrectly, it creates false security confidence while data bleeds between users or tenants.

**Core principle:** RLS is your last line of defense, not your only one. Get it wrong and you have a data breach.

---

## InsForge RLS Basics

InsForge uses two built-in PostgreSQL roles:

| Role | Description | When active |
|------|-------------|-------------|
| `anon` | Unauthenticated users | No valid session token |
| `authenticated` | Logged-in users | Valid session token present |
| `project_admin` | Project admin | Only used for admin tasks |

The current user's ID is available via `auth.uid()`. All user foreign keys should reference `auth.users(id)`.

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
  FOR SELECT USING (true);

CREATE POLICY "owners can insert" ON posts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "owners can update" ON posts
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owners can delete" ON posts
  FOR DELETE USING (user_id = auth.uid());

-- 4. Auto-update updated_at
CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();
```

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
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

**Rule: Any helper function called from an RLS policy MUST be `SECURITY DEFINER`** if it queries tables that also have RLS enabled.

**Checklist:**
- [ ] Map all RLS policy → function → table dependencies
- [ ] Every helper function that queries RLS-enabled tables is `SECURITY DEFINER`
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
$$ LANGUAGE sql STABLE SECURITY DEFINER;

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

## Common InsForge RLS Patterns

### Public Read, Owner Write

```sql
CREATE POLICY "public read" ON posts
  FOR SELECT USING (true);

CREATE POLICY "owner write" ON posts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner update" ON posts
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner delete" ON posts
  FOR DELETE USING (user_id = auth.uid());
```

### Role-Based Access with Helper Function

```sql
CREATE OR REPLACE FUNCTION is_org_member(org_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = org_uuid AND user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;  -- SECURITY DEFINER: prevents recursive RLS

CREATE POLICY "org members access" ON projects
  FOR ALL
  USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
```

### Authenticated-Only Access

```sql
CREATE POLICY "authenticated users only" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);
```

---

## Checklist

Before completing an RLS implementation:

- [ ] All tables with user data have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] All policies have both `USING` and `WITH CHECK` where applicable
- [ ] No circular RLS dependencies between tables (infinite recursion risk)
- [ ] All helper functions called from policies are `SECURITY DEFINER`
- [ ] Policy columns (`user_id`, `tenant_id`, etc.) are indexed
- [ ] `(SELECT auth.uid())` used in subquery form for performance
- [ ] Views on RLS tables use `security_invoker = true` (PG15+)
- [ ] No overly permissive `USING (true)` on sensitive tables
- [ ] Tested as `authenticated` role, not as superuser/admin

## References

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [SECURITY DEFINER Functions](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [Postgres-rls Skill](https://playbooks.com/skills/troykelly/claude-skills/postgres-rls)
