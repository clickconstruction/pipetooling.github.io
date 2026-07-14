-- Dissolve assistant pay-linkage (Phase 2 of the pay-visibility overhaul; RECENT_FEATURES v2.661).
--
-- After the v2.660 lockdown (20260714120000), being an "assistant of a pay-approved master"
-- no longer grants any PAY visibility — but it still gated ~25 operational tables (clock
-- sessions, crew grids, hours, attendance, write-ups, contracts, licenses, vehicles, housing)
-- and 14 clock/HR functions. Decision 2026-07-14: being under a pay-approved master should
-- mean NO role change at all — every assistant gets the same clock-management toolset.
--
-- Mechanics: generic rewriters swap `is_assistant_of_pay_approved_master()` for
-- `is_assistant()` in every policy qual/with_check and every function body that references
-- it (semantics preserved exactly otherwise; a few `... OR is_assistant() OR is_assistant()`
-- duplicates are harmless booleans). The one judgment call — pay_access_clock_week_fence_bypass —
-- becomes `is_pay_approved_master() OR is_assistant()`: assistants (Taunya today) do historical
-- clock-card corrections, so all assistants keep the fence bypass. Then the function is dropped;
-- `master_assistants` reverts to pure team structure.

-- 1) Rewrite every policy referencing the linkage function --------------------------------------

DO $$
DECLARE
  pol record;
  new_qual text;
  new_check text;
  cmd_sql text;
  roles_sql text;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')  -- storage.objects carries the contract-signature policy
      AND (qual ILIKE '%is_assistant_of_pay_approved_master%'
           OR with_check ILIKE '%is_assistant_of_pay_approved_master%')
  LOOP
    -- Bare-name replace: handles both the call form `is_assistant_of_pay_approved_master()`
    -- and the deparsed SELECT-wrapper aliases `AS is_assistant_of_pay_approved_master`.
    new_qual := replace(pol.qual, 'is_assistant_of_pay_approved_master', 'is_assistant');
    new_check := replace(pol.with_check, 'is_assistant_of_pay_approved_master', 'is_assistant');
    cmd_sql := CASE pol.cmd WHEN 'ALL' THEN 'ALL' ELSE pol.cmd END;
    roles_sql := array_to_string(pol.roles, ', ');
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s %s %s',
      pol.policyname,
      pol.schemaname,
      pol.tablename,
      CASE WHEN pol.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      cmd_sql,
      roles_sql,
      CASE WHEN new_qual IS NOT NULL THEN 'USING (' || new_qual || ')' ELSE '' END,
      CASE WHEN new_check IS NOT NULL THEN 'WITH CHECK (' || new_check || ')' ELSE '' END
    );
  END LOOP;
END $$;

-- 2) Rewrite every function body referencing the linkage function -------------------------------

DO $$
DECLARE
  fn record;
  def text;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosrc ILIKE '%is_assistant_of_pay_approved_master%'
      AND p.proname <> 'is_assistant_of_pay_approved_master'
  LOOP
    def := pg_get_functiondef(fn.oid);
    def := replace(def, 'is_assistant_of_pay_approved_master', 'is_assistant');
    EXECUTE def;
  END LOOP;
END $$;

-- 3) Drop the linkage function; assert nothing references it any more ---------------------------

DO $$
DECLARE
  leftover_policies int;
  leftover_functions int;
BEGIN
  SELECT count(*) INTO leftover_policies
  FROM pg_policies
  WHERE qual ILIKE '%is_assistant_of_pay_approved_master%'
     OR with_check ILIKE '%is_assistant_of_pay_approved_master%';
  SELECT count(*) INTO leftover_functions
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosrc ILIKE '%is_assistant_of_pay_approved_master%'
    AND p.proname <> 'is_assistant_of_pay_approved_master';
  IF leftover_policies > 0 OR leftover_functions > 0 THEN
    RAISE EXCEPTION 'dissolve_assistant_pay_linkage: % policies / % functions still reference the linkage fn',
      leftover_policies, leftover_functions;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.is_assistant_of_pay_approved_master();
