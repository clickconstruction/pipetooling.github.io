SET lock_timeout = '3s';

-- v2.2999 — One company, Phase 5c: drop the retired adoption / sharing tables.
--
-- 20260907050000 renamed master_assistants / master_shares to retired_* and put same-named
-- views in their place; 20260907060000 made the views opaque to PostgREST. The first push of
-- this file (2026-09-07 06:40 UTC) failed exactly as designed — no CASCADE — because four
-- policies still depended on the retired tables: the three customer_addresses policies
-- (created by dynamic SQL in 20260817224600, invisible to the file-based census that drove the
-- 20260907050000 re-bind) and retired_master_shares' own reader policy.
--
-- So the database is the census now: step 1 finds, through pg_depend, every policy on any
-- other table whose expression still binds to either retired table, and re-creates it with the
-- same name / command / permissive flag / roles / expression text, with `retired_` stripped so
-- the expression resolves to the view (pg_get_expr renders the current relation name, so the
-- text of a policy bound to the renamed table literally says retired_master_assistants).
-- Same technique as 20260906010000's role sweep. Step 2 drops the tables — shares first (its own
-- policy depends on assistants) — still without CASCADE, so anything else that depends on them
-- fails the push with nothing lost. Rows are listed by name in the migration doc. Idempotent.

-- 1) Re-bind every policy that still points at the retired tables ------------------------

DO $$
DECLARE
  r record;
  v_qual text;
  v_check text;
  v_roles text;
  v_cmd text;
  v_sql text;
  v_n integer := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT
      p.oid,
      p.polname,
      p.polrelid,
      p.polrelid::regclass AS tbl,
      p.polcmd,
      p.polpermissive,
      p.polroles,
      pg_get_expr(p.polqual, p.polrelid) AS qual,
      pg_get_expr(p.polwithcheck, p.polrelid) AS chk
    FROM pg_policy p
    JOIN pg_depend d ON d.classid = 'pg_policy'::regclass AND d.objid = p.oid
    WHERE d.refclassid = 'pg_class'::regclass
      AND d.refobjid IN (
        (SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'retired_master_assistants'),
        (SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'retired_master_shares'))
      AND p.polrelid NOT IN (
        SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname IN ('retired_master_assistants', 'retired_master_shares'))
  LOOP
    v_qual := replace(replace(r.qual, 'retired_master_assistants', 'master_assistants'), 'retired_master_shares', 'master_shares');
    v_check := replace(replace(r.chk, 'retired_master_assistants', 'master_assistants'), 'retired_master_shares', 'master_shares');
    v_cmd := CASE r.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' ELSE 'ALL' END;
    IF r.polroles = '{0}'::oid[] THEN
      v_roles := NULL;
    ELSE
      SELECT string_agg(quote_ident(rolname), ', ') INTO v_roles FROM pg_roles WHERE oid = ANY (r.polroles);
    END IF;

    EXECUTE format('DROP POLICY %I ON %s', r.polname, r.tbl);
    v_sql := format('CREATE POLICY %I ON %s AS %s FOR %s', r.polname, r.tbl,
                    CASE WHEN r.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END, v_cmd);
    IF v_roles IS NOT NULL THEN
      v_sql := v_sql || ' TO ' || v_roles;
    END IF;
    IF v_qual IS NOT NULL THEN
      v_sql := v_sql || ' USING (' || v_qual || ')';
    END IF;
    IF v_check IS NOT NULL THEN
      v_sql := v_sql || ' WITH CHECK (' || v_check || ')';
    END IF;
    EXECUTE v_sql;
    v_n := v_n + 1;
    RAISE NOTICE 'one company 5c: re-bound policy % on % to the views', r.polname, r.tbl;
  END LOOP;
  RAISE NOTICE 'one company 5c: % policy(ies) re-bound', v_n;
END $$;

-- 2) Drop the retired tables (no CASCADE) --------------------------------------------------

DROP TABLE IF EXISTS public.retired_master_shares;
DROP TABLE IF EXISTS public.retired_master_assistants;
