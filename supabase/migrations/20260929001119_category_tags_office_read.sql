SET lock_timeout = '3s';

-- Office staff read the bank-category tags (punch list #52, the owner's call 2026-09-28).
--
-- The tags decide what is fuel — the Job window's ⛽ line, the cost timeline's ⛽ stream and
-- People → Spending. They were readable only by Banking staff (dev / master / controller,
-- `can_manage_mercury_category_tags()` = `is_banking_staff()`), so an assistant saw every job's
-- fuel folded into card charges. READ widens to `is_office_staff()` (dev / master / assistant /
-- controller) — the set that already reads the accounting labels, attributions and job
-- allocations the tags classify. INSERT / UPDATE / DELETE stay Banking-only, unchanged.
--
-- Only the two SELECT policies are replaced; nothing else is touched.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mercury_category_tags' AND policyname = 'mercury_category_tags office staff select') THEN
    CREATE POLICY "mercury_category_tags office staff select" ON public.mercury_category_tags
      FOR SELECT TO authenticated USING (public.is_office_staff());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mercury_category_tag_members' AND policyname = 'mercury_category_tag_members office staff select') THEN
    CREATE POLICY "mercury_category_tag_members office staff select" ON public.mercury_category_tag_members
      FOR SELECT TO authenticated USING (public.is_office_staff());
  END IF;
END $$;

-- The Banking-staff SELECT policies are now a subset of the office-staff ones (permissive
-- policies OR together); drop them so one policy says who reads.
DROP POLICY IF EXISTS "mercury_category_tags banking staff select" ON public.mercury_category_tags;
DROP POLICY IF EXISTS "mercury_category_tag_members banking staff select" ON public.mercury_category_tag_members;
