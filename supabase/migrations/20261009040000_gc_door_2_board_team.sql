SET lock_timeout = '3s';

-- GC mode, door 2 (v2.4937): the Project Board, Trade partners, Follow up, the Ask window and the
-- company window open to the office and estimators (to-dos/gc-mode/mockups/door-2-board.md on
-- branch spike/gc-mode).
--   1) public.gc_office_team() names its roles, the way gc_money_team() does, so access.test.ts can
--      hold the client's copy (GC_OFFICE_TEAM in src/lib/gc/access.ts) to it. The answer is the same
--      as door 1's is_office_or_estimator(): dev, the leaders, the assistants, the controller and
--      estimators. A role added to the office later joins GC mode only when it is named here.
--   2) B1's eight tables, and B5-a's two bid-tab tables, which it kept dev only "until the Board's
--      door", swap their dev-only policy for the GC office team. The functions on them
--      (gc_add_company, gc_vet_company, gc_invite_companies, gc_office_decline, gc_record_promise,
--      gc_keep_promise, gc_keep_promises) are SECURITY INVOKER, so this is their gate too.
-- What stays dev only, each behind its own door: the trade portal links and messages (P1, the trade
-- wave), and our number (gc_project_money keeps gc_money_team()). anon has no grant on these tables
-- (B1, B5-a), and the append-only three keep their missing UPDATE and DELETE privileges, which no
-- policy can open. src/lib/gc/doors.ts lists every GC table with its door; doors.test.ts holds the
-- migrations to it.

-- 1) The team, by name.
CREATE OR REPLACE FUNCTION public.gc_office_team()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator')
  );
$$;

COMMENT ON FUNCTION public.gc_office_team() IS
  'GC mode (door 1, v2.4832; roles named in door 2): who may read and write the GC office''s tables: dev, the leaders (master_technician), the assistants, the controller and estimators. Change the audience here, never in a policy. The client''s copy is GC_OFFICE_TEAM in src/lib/gc/access.ts; access.test.ts fails when they differ.';

REVOKE EXECUTE ON FUNCTION public.gc_office_team() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_office_team() TO authenticated, service_role;

-- 2) The Board's tables: one policy each for every verb, asked once a statement.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gc_companies', 'gc_company_people', 'gc_company_vetting_forms', 'gc_invites',
    'gc_quotes', 'gc_company_contacts', 'gc_trade_promises', 'gc_trade_promise_moves',
    'gc_bid_tabs', 'gc_bid_tab_views'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_dev', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_team', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT public.gc_office_team())) WITH CHECK ((SELECT public.gc_office_team()))',
      t || '_team', t);
  END LOOP;
END $$;
