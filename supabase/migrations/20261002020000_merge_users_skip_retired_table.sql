SET lock_timeout = '3s';

-- Merge users has failed on every call since 2026-07-15: merge_user_accounts still names
-- cost_matrix_teams_shares in its membership-table list, and 20260715090000 dropped that table
-- (the Cost matrix retirement). The UPDATE on it raises "relation does not exist", so the
-- dry run and the merge both refuse. Found 2026-10-01 on the person desk's new
-- Merge a duplicate… (Account on the desk, PR D1): the preview read
-- `relation "public.cost_matrix_teams_shares" does not exist`.
--
-- The live body is not the repo file: 20260907160000 (one company) already edited it in place
-- with regexp_replace to drop the master_assistants / master_shares tuples. So this edits the
-- live definition the same way, removing only the one tuple, and leaves everything else as it
-- is. Every other table the function names exists (checked 2026-10-01 with to_regclass).
-- Idempotent: a second run finds nothing to remove.

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
    v_new := regexp_replace(v_def, '\(''cost_matrix_teams_shares'',\s*''shared_with_user_id'',\s*''TRUE''\),\s*', '', 'g');
    IF v_new <> v_def THEN
      EXECUTE v_new;
      RAISE NOTICE 'merge_user_accounts(oid %) no longer names the retired cost_matrix_teams_shares', v_oid;
    ELSE
      RAISE NOTICE 'merge_user_accounts(oid %) already clean', v_oid;
    END IF;
  END LOOP;
END $$;
