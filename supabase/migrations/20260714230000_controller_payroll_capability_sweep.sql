-- Controller payroll-capability sweep (Phase 3 fix-up; RECENT_FEATURES v2.663).
--
-- The controller role verification found a gap: policies written before has_payroll_access()
-- existed still gate on is_pay_approved_master() directly, so a controller could read pay
-- stubs (Phase 1 rewrote those onto the capability fn) but not people_pay_config wages, the
-- cost-matrix/teams family, or people_hours_display_order. Everywhere a policy or function
-- treats "pay-approved master" as the payroll principal, the controller belongs too — swap
-- is_pay_approved_master() for has_payroll_access() (identical for devs/masters by definition;
-- has_payroll_access() = is_pay_approved_master() OR is_controller()).

-- 1) Policies -----------------------------------------------------------------------------------

DO $$
DECLARE
  pol record;
  new_qual text;
  new_check text;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
      AND (qual ILIKE '%is_pay_approved_master%' OR with_check ILIKE '%is_pay_approved_master%')
  LOOP
    -- Bare-name replace handles both call form and deparsed SELECT-wrapper aliases.
    new_qual := replace(pol.qual, 'is_pay_approved_master', 'has_payroll_access');
    new_check := replace(pol.with_check, 'is_pay_approved_master', 'has_payroll_access');
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s %s %s',
      pol.policyname,
      pol.schemaname,
      pol.tablename,
      CASE WHEN pol.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      CASE pol.cmd WHEN 'ALL' THEN 'ALL' ELSE pol.cmd END,
      array_to_string(pol.roles, ', '),
      CASE WHEN new_qual IS NOT NULL THEN 'USING (' || new_qual || ')' ELSE '' END,
      CASE WHEN new_check IS NOT NULL THEN 'WITH CHECK (' || new_check || ')' ELSE '' END
    );
  END LOOP;
END $$;

-- 2) Function bodies (skip has_payroll_access itself — it wraps is_pay_approved_master) ----------

DO $$
DECLARE
  fn record;
  def text;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosrc ILIKE '%is_pay_approved_master%'
      AND p.proname NOT IN ('is_pay_approved_master', 'has_payroll_access')
  LOOP
    def := replace(pg_get_functiondef(fn.oid), 'is_pay_approved_master', 'has_payroll_access');
    EXECUTE def;
  END LOOP;
END $$;

-- 3) Assert the sweep is complete -----------------------------------------------------------------

DO $$
DECLARE
  leftover int;
BEGIN
  SELECT count(*) INTO leftover
  FROM pg_policies
  WHERE qual ILIKE '%is_pay_approved_master%' OR with_check ILIKE '%is_pay_approved_master%';
  IF leftover > 0 THEN
    RAISE EXCEPTION 'controller payroll sweep: % policies still reference is_pay_approved_master', leftover;
  END IF;
END $$;
