-- Ensure fixture_types has SELECT policy so price book entries can show names via fixture_types(name) join
-- Without this, embedded fixture_types returns null and users see prices but not fixture names

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fixture_types' AND policyname = 'All authenticated users can read fixture types'
  ) THEN
    CREATE POLICY "All authenticated users can read fixture types"
    ON public.fixture_types
    FOR SELECT
    USING (auth.uid() IS NOT NULL);
  END IF;
END $$;
