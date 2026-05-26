# Auth Backend Configuration

Use migrations for database-side auth lifecycle hooks. The common case is creating an app-owned profile row whenever a new InsForge user is created.

## Create a Profile on Sign Up

```sql
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_owner_select ON public.profiles
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY profiles_owner_update ON public.profiles
FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_profile_after_auth_user_insert
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_for_new_user();
```

Create the trigger function in `public`, then attach the trigger to `auth.users`. To remove the hook later, drop the function with `CASCADE`:

```sql
DROP FUNCTION IF EXISTS public.create_profile_for_new_user() CASCADE;
```

Keep app data in app-owned tables such as `public.profiles`; do not add custom columns to `auth.users`.
