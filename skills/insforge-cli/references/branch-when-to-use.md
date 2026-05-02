# When to Use a Backend Branch

A branch project is a full child of the parent: own EC2, own PostgreSQL,
own storage namespace. It shares the parent's `JWT_SECRET` so the same
users authenticate, but has fresh `API_KEY` and `ANON_KEY`.

Branching is **not free** — each branch consumes an EC2 instance and
costs developer time to create / merge / clean up. Use it when the
isolation actually pays off.

## Strong signals (branch first, no question)

- **Destructive DDL on existing tables**: `DROP TABLE`, `DROP COLUMN`,
  `ALTER COLUMN TYPE` (especially type narrowing). Rollback via
  `git revert` doesn't restore lost data.
- **New or modified RLS policies on user-data tables**. RLS bugs are
  silent: prod users can be locked out or, worse, granted access they
  shouldn't have. Test the policy on a branch with realistic data.
- **Auth provider configuration changes**. Adding/removing OAuth
  providers, changing redirect URIs, modifying SMTP settings. Bricks
  prod login if wrong.
- **Multi-step refactors touching >3 tables or >1 schema**. Risk of
  partial application is high; branch lets you stage and verify the
  whole transformation before parent sees any of it.

## Moderate signals (branch if convenient)

- Adding a new table or column to an existing schema (additive).
- Tweaking an email template — mergeable, low blast radius, but a
  branch keeps the diff isolated and reviewable.
- Tuning AI gateway config (model selection, prompt templates).
- Adjusting cron schedules.

## Skip the branch

- Inserting / updating row data — branching is about schema, not data.
- Client-side bug fixes that don't touch the backend.
- Edge function logic-only changes covered by the function's own
  unit tests.
- Anything where `git revert` is faster than the branch round-trip.

## Mode selection: full vs. schema-only

| Mode | Use it when |
|------|-------------|
| `full` (default) | You need realistic data to validate the change. RLS testing, query plan tuning, large-table migrations. |
| `schema-only` | You can verify with synthetic seed rows. Faster to create. User-data tables (auth.users, storage.objects, etc.) start empty. |

## When the branch goes sideways

If the experiment dead-ends — broken migration, schema you no longer want, RLS policy that locked you out — `npx @insforge/cli branch reset <name>` rewinds the branch's database to T0 (parent's snapshot at branch creation) without touching the EC2, `appkey`, or API keys. Cheaper than `branch delete` + `branch create` because the dev server's `INSFORGE_URL` / `ANON_KEY` stay valid. Reset works from both `ready` and `merged`, so a previously-merged branch can be re-opened for a second round of changes against the same parent T0 anchor. See [branch-reset](branch-reset.md).

## After the merge

The merge does **not** auto-redeploy compute / functions / website. Re-run:

```bash
npx @insforge/cli functions deploy <slug>      # for each modified edge function
npx @insforge/cli deployments deploy           # if the website consumes the schema
npx @insforge/cli compute update               # for fly.io services that depend on the schema
```

## Limits

- Per-org: max 5 distinct parent projects with active branches (configurable).
- Per-parent: max 3 active branches (configurable).
- Branches do not nest (no branch-of-a-branch).
- Branches do not auto-resume when the parent resumes — resume manually.
- Branches are deleted (cascade) when the parent project is deleted.
