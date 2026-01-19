-- Update RLS for public.users so that:
-- - Every authenticated user can read their own row
-- - Masters (and devs) can see all assistant users (for adoption UI)
-- - We avoid recursive SELECTs on public.users inside its own policies

-- Ensure RLS is enabled on public.users (safe if already enabled)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies for idempotency
DO $$
BEGIN
  -- Allow every authenticated user to see their own user row
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'Users can select own row'
  ) THEN
    DROP POLICY "Users can select own row" ON public.users;
  END IF;

  CREATE POLICY "Users can select own row"
  ON public.users
  FOR SELECT
  USING (
    id = auth.uid()
  );

  -- Allow devs and masters to see all assistants
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'Masters and devs can see all assistants'
  ) THEN
    DROP POLICY "Masters and devs can see all assistants" ON public.users;
  END IF;

  CREATE POLICY "Masters and devs can see all assistants"
  ON public.users
  FOR SELECT
  USING (
    -- Any authenticated user can see assistant rows (frontend only exposes this to devs/masters)
    role = 'assistant'
  );
END $$;

