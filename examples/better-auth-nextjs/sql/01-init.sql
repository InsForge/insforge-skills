-- Run AFTER `npx @better-auth/cli migrate` has created the four BA tables.
-- This sets up the requesting_user_id() helper, an example notes table with
-- per-user RLS, and (optionally) realtime support.

-- 0. Ensure gen_random_uuid() is available (idempotent — pgcrypto is built-in).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Helper: extract sub claim from request.jwt.claims
CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::text
$$;

-- 2. Example RLS-protected table — notes owned by Better Auth users.
-- Idempotent: `IF NOT EXISTS` on the table, `DROP POLICY IF EXISTS` before
-- each `CREATE POLICY` so reruns don't error and don't drop user data.
CREATE TABLE IF NOT EXISTS public.notes (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text NOT NULL DEFAULT public.requesting_user_id()
    REFERENCES public."user"(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notes_owner_select ON public.notes;
CREATE POLICY notes_owner_select ON public.notes
  FOR SELECT TO authenticated
  USING (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS notes_owner_insert ON public.notes;
CREATE POLICY notes_owner_insert ON public.notes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS notes_owner_update ON public.notes;
CREATE POLICY notes_owner_update ON public.notes
  FOR UPDATE TO authenticated
  USING (user_id = public.requesting_user_id())
  WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS notes_owner_delete ON public.notes;
CREATE POLICY notes_owner_delete ON public.notes
  FOR DELETE TO authenticated
  USING (user_id = public.requesting_user_id());

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated;

-- 3. Realtime support (optional — skip if you don't use client.realtime).
-- 3a. Allow string sender_ids (Better Auth IDs are not UUIDs).
ALTER TABLE realtime.messages ALTER COLUMN sender_id TYPE text;

-- 3b. Register a chat channel pattern. SQL LIKE syntax: `chat:%` matches
-- chat:lobby, chat:dm:user_xyz, etc.
INSERT INTO realtime.channels (pattern, description, enabled)
  VALUES ('chat:%', 'app chat channels', TRUE)
  ON CONFLICT (pattern) DO NOTHING;

-- 4. Force PostgREST to refresh its schema cache.
NOTIFY pgrst, 'reload schema';
