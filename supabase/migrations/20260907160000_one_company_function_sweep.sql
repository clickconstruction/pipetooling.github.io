SET lock_timeout = '3s';

-- v2.3070 — One company, the function sweep: the dead adoption branches leave the RPCs.
--
-- After Phase 5 (20260907050000) master_assistants / master_shares are views computed from the
-- roster, so the 45 functions that still name them keep answering — but by reading a cross
-- join to decide something is_office_staff() already knows. This migration rewrites the LIVE
-- definitions (pg_get_functiondef, then EXECUTE — the 20260906010000 role-sweep technique, so
-- nothing a dynamic sweep changed on prod is lost) and replaces exactly five canonical forms:
--
--   EXISTS (SELECT 1 FROM master_assistants [a] WHERE master_id = <col> AND assistant_id = auth.uid())
--   EXISTS (SELECT 1 FROM master_assistants [a] WHERE assistant_id = auth.uid() AND master_id = <col>)
--   EXISTS (SELECT 1 FROM master_assistants [a] WHERE master_id = auth.uid() AND assistant_id = <col>)
--       → public.is_office_or_estimator()   (the view's assistant side: assistant / controller / estimator;
--                                             dev + master added — they pass every one of these gates
--                                             through a sibling branch already)
--   EXISTS (SELECT 1 FROM master_shares [s] WHERE sharing_master_id = <col> AND viewing_master_id = auth.uid())
--   EXISTS (SELECT 1 FROM master_shares [s] WHERE viewing_master_id = auth.uid() AND sharing_master_id = <col>)
--       → public.is_master_or_dev()         (the view: leaders × leaders)
--
-- <col> is a plain column / variable reference (j.master_user_id, v_master_id, jl.master_user_id).
-- Forms that test some OTHER user than the caller (p_viewer, p_recipient, viewer_user_id, NEW.user_id,
-- u.id) and the two master_assistants ⋈ master_shares joins are left alone — they keep reading the
-- views and stay correct. The dry run against the repo bodies: 32 functions fully rewritten,
-- 2 partially (the joins remain), 11 untouched.
--
-- merge_user_accounts is the one function that WRITES the pair (UPDATE / DELETE through a VALUES
-- list of grant tables) — an UPDATE on a view fails, so the two tuples are removed from its list.
--
-- Every EXECUTE runs inside this transaction: a pattern that produced invalid SQL fails the push
-- with nothing changed. Idempotent: a second run finds no canonical form and rewrites nothing.

-- 1) The predicate the assistant-side branches collapse to ----------------------------------

CREATE OR REPLACE FUNCTION public.is_office_or_estimator()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_office_staff() OR public.is_estimator();
$$;

COMMENT ON FUNCTION public.is_office_or_estimator() IS
  'One company (v2.3070): dev, leader, assistant, controller or estimator — what an EXISTS over the master_assistants view used to say about the caller. Used by the swept RPC gates.';

REVOKE EXECUTE ON FUNCTION public.is_office_or_estimator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_office_or_estimator() TO authenticated, service_role;

-- 2) merge_user_accounts stops touching the pair ---------------------------------------------

DO $$
DECLARE
  v_def text;
  v_new text;
  v_oid oid;
BEGIN
  FOR v_oid IN
    SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'merge_user_accounts'
  LOOP
    v_def := pg_get_functiondef(v_oid);
    v_new := regexp_replace(v_def, '\(''master_assistants'',\s*''master_id'',\s*''assistant_id''\),\s*', '', 'g');
    v_new := regexp_replace(v_new, '\(''master_shares'',\s*''sharing_master_id'',\s*''viewing_master_id''\),\s*', '', 'g');
    IF v_new <> v_def THEN
      EXECUTE v_new;
      RAISE NOTICE 'one company fn sweep: merge_user_accounts(oid %) no longer writes master_assistants / master_shares', v_oid;
    ELSE
      RAISE NOTICE 'one company fn sweep: merge_user_accounts(oid %) already clean', v_oid;
    END IF;
  END LOOP;
END $$;

-- 3) The five canonical forms, on every live function that still names the pair --------------

DO $$
DECLARE
  r record;
  v_def text;
  v_new text;
  v_hits integer;
  v_left integer;
  v_fns integer := 0;
  v_total integer := 0;
  -- pieces (Postgres ARE syntax; flags 'gi')
  c_uid constant text := '\(?\s*(?:SELECT\s+)?auth\.uid\(\)\s*\)?';
  c_col constant text := '[A-Za-z_][A-Za-z0-9_.]*';
  c_from_a constant text := 'EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+(?:public\.)?master_assistants(?:\s+(?:AS\s+)?\w+)?\s+WHERE\s+';
  c_from_s constant text := 'EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+(?:public\.)?master_shares(?:\s+(?:AS\s+)?\w+)?\s+WHERE\s+';
  c_office constant text := 'public.is_office_or_estimator()';
  c_leader constant text := 'public.is_master_or_dev()';
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname NOT IN ('merge_user_accounts', 'sync_company_access_grants')
      AND pg_get_functiondef(p.oid) ~* '\m(master_assistants|master_shares)\M'
    ORDER BY p.proname
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_new := v_def;
    -- A_fwd: master_id = <col> AND assistant_id = auth.uid()
    v_new := regexp_replace(v_new, c_from_a || '(?:\w+\.)?master_id\s*=\s*' || c_col || '\s+AND\s+(?:\w+\.)?assistant_id\s*=\s*' || c_uid || '\s*\)', c_office, 'gi');
    -- A_fwd2: assistant_id = auth.uid() AND master_id = <col>
    v_new := regexp_replace(v_new, c_from_a || '(?:\w+\.)?assistant_id\s*=\s*' || c_uid || '\s+AND\s+(?:\w+\.)?master_id\s*=\s*' || c_col || '\s*\)', c_office, 'gi');
    -- A_rev: master_id = auth.uid() AND assistant_id = <col>
    v_new := regexp_replace(v_new, c_from_a || '(?:\w+\.)?master_id\s*=\s*' || c_uid || '\s+AND\s+(?:\w+\.)?assistant_id\s*=\s*' || c_col || '\s*\)', c_office, 'gi');
    -- S_fwd: sharing_master_id = <col> AND viewing_master_id = auth.uid()
    v_new := regexp_replace(v_new, c_from_s || '(?:\w+\.)?sharing_master_id\s*=\s*' || c_col || '\s+AND\s+(?:\w+\.)?viewing_master_id\s*=\s*' || c_uid || '\s*\)', c_leader, 'gi');
    -- S_rev: viewing_master_id = auth.uid() AND sharing_master_id = <col>
    v_new := regexp_replace(v_new, c_from_s || '(?:\w+\.)?viewing_master_id\s*=\s*' || c_uid || '\s+AND\s+(?:\w+\.)?sharing_master_id\s*=\s*' || c_col || '\s*\)', c_leader, 'gi');

    IF v_new = v_def THEN
      RAISE NOTICE 'one company fn sweep: %(%) — no canonical form, left as is', r.proname, r.args;
      CONTINUE;
    END IF;
    v_hits := (length(v_def) - length(regexp_replace(v_def, '\m(master_assistants|master_shares)\M', '', 'gi')))
            - (length(v_new) - length(regexp_replace(v_new, '\m(master_assistants|master_shares)\M', '', 'gi')));
    v_left := (SELECT count(*) FROM regexp_matches(v_new, '\m(master_assistants|master_shares)\M', 'gi'));
    EXECUTE v_new;
    v_fns := v_fns + 1;
    RAISE NOTICE 'one company fn sweep: %(%) rewritten — % reference(s) left', r.proname, r.args, v_left;
  END LOOP;
  RAISE NOTICE 'one company fn sweep: % function(s) rewritten', v_fns;
END $$;
