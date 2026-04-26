-- REQUIRED. Without this, anyone with the InsForge anon key can read all
-- Better Auth user emails through the data API. Run once after the first
-- `npx @better-auth/cli migrate`. Survives subsequent migrations (Postgres
-- only re-grants on CREATE TABLE, not ALTER TABLE).
REVOKE ALL ON public."user", public.session, public.account, public.verification
  FROM anon, authenticated;

-- Verify (should show only postgres + project_admin retain access):
-- \dp public.user

-- ─────────────────────────────────────────────────────────────
-- Plugins addendum
-- ─────────────────────────────────────────────────────────────
-- Every BA plugin that adds tables (organization, twoFactor, apiKey, passkey,
-- oidcProvider, ...) creates them in `public` with the same default grants.
-- After enabling a plugin and re-running `auth:migrate`, REVOKE the new ones.
--
-- Organization plugin (uncomment if you enable it):
--
--   REVOKE ALL ON
--     public.organization, public.team, public.member,
--     public."teamMember", public.invitation
--   FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
