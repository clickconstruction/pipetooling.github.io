-- Fix for 20260712190000: bare text literals appended to text[] with || were parsed as
-- array literals ("malformed array literal") — explicit ::text casts. Function otherwise
-- identical.
--
-- merge_user_accounts(p_survivor, p_absorbed, p_dry_run): reassign every reference to the
-- absorbed account onto the survivor, then tombstone the absorbed account (archived_at kept /
-- set; email unchanged; auth ban is done by the merge-users edge function since it needs the
-- service role).
--
-- Rules enforced here (see Active Accounts → Merge users):
--   * caller must be dev
--   * both accounts must have the same role
--   * the absorbed account must be archived OR never signed in (last_sign_in_at IS NULL) —
--     "no more than one of the two can be signed into"
--   * when exactly one account is live, the survivor must be the live one (combined stays
--     live); archived + archived merges leave the survivor archived
--
-- Strategy (house pattern from migrate_job_ledger_costs_and_delete):
--   1. explicit special cases: unique-key membership tables (move-if-absent then drop
--      leftovers), additive activity aggregates, org pair tables (dedupe + drop self-pairs),
--      label slug collisions, personal board layout (survivor's wins), clock_sessions salary
--      guard, customers-before-jobs ordering (job↔customer master invariant), the
--      accept_notify_user_ids uuid[] column, and the roster link
--   2. dynamic sweep: every remaining single-column FK to public.users(id) / auth.users(id)
--      on a public table gets a plain UPDATE — future tables are covered automatically; a
--      future unique-constrained table fails loudly (unique_violation aborts the merge)
--   3. coverage assert: zero remaining references to the absorbed id, or the merge aborts
--
-- p_dry_run=true performs the full merge inside a nested block and rolls it back via a
-- sentinel exception, returning the would-be per-table counts (powers the dialog preview).
--
-- Returns jsonb {ok, dry_run, moved: {"table.column": n, ...}, warnings: [...]} or
-- {ok:false, code, error}. Never RAISEs to the client.

CREATE OR REPLACE FUNCTION public.merge_user_accounts(
  p_survivor_user_id uuid,
  p_absorbed_user_id uuid,
  p_dry_run boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid;
  v_caller_role text;
  v_survivor public.users%ROWTYPE;
  v_absorbed public.users%ROWTYPE;
  v_moved jsonb := '{}'::jsonb;
  v_warnings text[] := ARRAY[]::text[];
  v_handled text[] := ARRAY[]::text[];
  v_n bigint;
  v_salary_collisions bigint;
  r record;
  lbl record;
  v_leftovers text[] := ARRAY[]::text[];
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_authenticated', 'error', 'Not authenticated.');
  END IF;
  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller;
  IF v_caller_role IS DISTINCT FROM 'dev' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden', 'error', 'Only devs can merge users.');
  END IF;
  IF p_survivor_user_id IS NULL OR p_absorbed_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bad_request', 'error', 'Both accounts are required.');
  END IF;
  IF p_survivor_user_id = p_absorbed_user_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'same_account', 'error', 'Pick two different accounts.');
  END IF;
  IF p_absorbed_user_id = v_caller THEN
    RETURN jsonb_build_object('ok', false, 'code', 'self_absorb', 'error', 'You cannot absorb the account you are signed into.');
  END IF;

  SELECT * INTO v_survivor FROM public.users WHERE id = p_survivor_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'survivor_not_found', 'error', 'Surviving account not found.');
  END IF;
  SELECT * INTO v_absorbed FROM public.users WHERE id = p_absorbed_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'absorbed_not_found', 'error', 'Account to merge from not found.');
  END IF;

  IF v_survivor.role IS DISTINCT FROM v_absorbed.role THEN
    RETURN jsonb_build_object('ok', false, 'code', 'role_mismatch',
      'error', format('Both accounts must have the same role (%s vs %s).', v_survivor.role, v_absorbed.role));
  END IF;
  IF v_absorbed.archived_at IS NULL AND v_absorbed.last_sign_in_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'absorbed_in_use',
      'error', 'The account being merged away must be archived, or never signed into. Archive it first.');
  END IF;
  IF v_survivor.archived_at IS NOT NULL AND v_absorbed.archived_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'survivor_must_be_live',
      'error', 'Keep the live account: when one of the two is live, it must be the survivor.');
  END IF;

  -- Two salaried accounts with auto salary-schedule sessions on the same work date cannot be
  -- auto-merged (partial unique indexes on clock_sessions; deleting sessions would corrupt
  -- incrementally-maintained people_hours).
  SELECT count(*) INTO v_salary_collisions
  FROM public.clock_sessions b
  WHERE b.user_id = p_absorbed_user_id
    AND b.origin = 'salary_schedule'
    AND EXISTS (
      SELECT 1 FROM public.clock_sessions a
      WHERE a.user_id = p_survivor_user_id
        AND a.origin = 'salary_schedule'
        AND a.work_date = b.work_date
    );
  IF v_salary_collisions > 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'salary_schedule_overlap',
      'error', format('Both accounts have salary-schedule clock sessions on %s of the same day(s). This pair cannot be auto-merged.', v_salary_collisions));
  END IF;

  BEGIN
    ------------------------------------------------------------------
    -- 1a. customers before jobs (job↔customer master invariant cascade)
    ------------------------------------------------------------------
    UPDATE public.customers SET master_user_id = p_survivor_user_id WHERE master_user_id = p_absorbed_user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object('customers.master_user_id', v_n); END IF;
    v_handled := v_handled || 'customers.master_user_id'::text;

    UPDATE public.jobs_ledger SET master_user_id = p_survivor_user_id WHERE master_user_id = p_absorbed_user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object('jobs_ledger.master_user_id', v_n); END IF;
    v_handled := v_handled || 'jobs_ledger.master_user_id'::text;

    ------------------------------------------------------------------
    -- 1b. personal board layout: survivor's wins, absorbed's is dropped
    ------------------------------------------------------------------
    DELETE FROM public.bid_working_board_placements WHERE user_id = p_absorbed_user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object('bid_working_board_placements.deleted', v_n); END IF;
    DELETE FROM public.bid_working_board_columns WHERE user_id = p_absorbed_user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object('bid_working_board_columns.deleted', v_n); END IF;
    v_handled := v_handled || ARRAY['bid_working_board_placements.user_id', 'bid_working_board_columns.user_id'];

    ------------------------------------------------------------------
    -- 1c. additive activity aggregates
    ------------------------------------------------------------------
    UPDATE public.user_app_activity_daily a
    SET active_seconds = LEAST(86400, a.active_seconds + b.active_seconds),
        first_seen_at = LEAST(a.first_seen_at, b.first_seen_at),
        last_seen_at = GREATEST(a.last_seen_at, b.last_seen_at)
    FROM public.user_app_activity_daily b
    WHERE a.user_id = p_survivor_user_id AND b.user_id = p_absorbed_user_id
      AND a.activity_date = b.activity_date;
    UPDATE public.user_app_activity_page_daily a
    SET active_seconds = LEAST(86400, a.active_seconds + b.active_seconds)
    FROM public.user_app_activity_page_daily b
    WHERE a.user_id = p_survivor_user_id AND b.user_id = p_absorbed_user_id
      AND a.activity_date = b.activity_date AND a.page = b.page;

    ------------------------------------------------------------------
    -- 1d. label slug collisions: keep survivor's label, repoint tags, drop absorbed's
    ------------------------------------------------------------------
    FOR lbl IN
      SELECT b.id AS b_id, a.id AS a_id
      FROM public.labels b
      JOIN public.labels a ON a.master_user_id = p_survivor_user_id AND a.slug = b.slug
      WHERE b.master_user_id = p_absorbed_user_id
    LOOP
      UPDATE public.user_labels t SET label_id = lbl.a_id
      WHERE t.label_id = lbl.b_id
        AND NOT EXISTS (SELECT 1 FROM public.user_labels t2 WHERE t2.user_id = t.user_id AND t2.label_id = lbl.a_id);
      DELETE FROM public.user_labels WHERE label_id = lbl.b_id;
      UPDATE public.people_labels t SET label_id = lbl.a_id
      WHERE t.label_id = lbl.b_id
        AND NOT EXISTS (SELECT 1 FROM public.people_labels t2 WHERE t2.person_id = t.person_id AND t2.label_id = lbl.a_id);
      DELETE FROM public.people_labels WHERE label_id = lbl.b_id;
      DELETE FROM public.labels WHERE id = lbl.b_id;
    END LOOP;
    UPDATE public.labels SET master_user_id = p_survivor_user_id WHERE master_user_id = p_absorbed_user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object('labels.master_user_id', v_n); END IF;
    v_handled := v_handled || 'labels.master_user_id'::text;

    ------------------------------------------------------------------
    -- 1e. org pair tables: rewrite both sides, then drop self-pairs
    ------------------------------------------------------------------
    FOR r IN
      SELECT * FROM (VALUES
        ('master_assistants', 'master_id', 'assistant_id'),
        ('master_primaries', 'master_id', 'primary_id'),
        ('master_shares', 'sharing_master_id', 'viewing_master_id'),
        ('master_superintendents', 'master_id', 'superintendent_id'),
        ('team_leader_assignments', 'leader_user_id', 'member_user_id')
      ) AS v(tbl, col1, col2)
    LOOP
      EXECUTE format(
        'UPDATE public.%I t SET %I = $1 WHERE t.%I = $2 AND NOT EXISTS (SELECT 1 FROM public.%I t2 WHERE t2.%I = $1 AND t2.%I = t.%I)',
        r.tbl, r.col1, r.col1, r.tbl, r.col1, r.col2, r.col2) USING p_survivor_user_id, p_absorbed_user_id;
      EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.tbl, r.col1) USING p_absorbed_user_id;
      EXECUTE format(
        'UPDATE public.%I t SET %I = $1 WHERE t.%I = $2 AND NOT EXISTS (SELECT 1 FROM public.%I t2 WHERE t2.%I = $1 AND t2.%I = t.%I)',
        r.tbl, r.col2, r.col2, r.tbl, r.col2, r.col1, r.col1, r.col1) USING p_survivor_user_id, p_absorbed_user_id;
      EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.tbl, r.col2) USING p_absorbed_user_id;
      EXECUTE format('DELETE FROM public.%I WHERE %I = %I', r.tbl, r.col1, r.col2);
      v_handled := v_handled || (r.tbl || '.' || r.col1) || (r.tbl || '.' || r.col2);
    END LOOP;

    ------------------------------------------------------------------
    -- 1f. membership / per-user-keyed tables: move-if-absent, drop leftovers
    ------------------------------------------------------------------
    FOR r IN
      SELECT * FROM (VALUES
        ('jobs_ledger_team_members', 'user_id', 't2.job_id = t.job_id'),
        ('checklist_instance_assignees', 'user_id', 't2.checklist_instance_id = t.checklist_instance_id'),
        ('checklist_item_assignees', 'user_id', 't2.checklist_item_id = t.checklist_item_id'),
        ('checklist_tech_tree_roadmap_members', 'user_id', 't2.roadmap_id = t.roadmap_id'),
        ('checklist_tech_tree_task_assignees', 'user_id', 't2.task_id = t.task_id'),
        ('step_subscriptions', 'user_id', 't2.step_id = t.step_id'),
        ('prospect_email_sent', 'user_id', 't2.prospect_id = t.prospect_id AND t2.template_key = t.template_key'),
        ('mercury_tally_transaction_notes', 'user_id', 't2.mercury_transaction_id = t.mercury_transaction_id'),
        ('report_reads', 'user_id', 't2.report_id = t.report_id'),
        ('dispatch_request_dismissals', 'user_id', 't2.request_id = t.request_id'),
        ('estimator_request_dismissals', 'user_id', 't2.request_id = t.request_id'),
        ('dev_ignored_checklist_items', 'dev_user_id', 't2.checklist_item_id = t.checklist_item_id'),
        ('dev_read_completed_items', 'dev_user_id', 't2.checklist_instance_id = t.checklist_instance_id'),
        ('user_checklist_item_mute_preferences', 'user_id', 't2.checklist_item_id = t.checklist_item_id'),
        ('recurring_job_report_schedule_recipients', 'recipient_user_id', 't2.schedule_id = t.schedule_id'),
        ('recurring_job_report_dispatch_log', 'recipient_user_id', 't2.schedule_id = t.schedule_id AND t2.reporting_date = t.reporting_date'),
        ('team_feedback_peer_ratings', 'peer_user_id', 't2.submission_id = t.submission_id'),
        ('user_daily_goals_ack', 'user_id', 't2.local_date = t.local_date'),
        ('salary_work_schedule_day_overrides', 'user_id', 't2.work_date = t.work_date'),
        ('user_labels', 'user_id', 't2.label_id = t.label_id'),
        ('user_bid_notes_read_state', 'user_id', 't2.bid_id = t.bid_id'),
        ('user_dashboard_buttons', 'user_id', 't2.button_key = t.button_key'),
        ('user_prospect_copy_templates', 'user_id', 't2.template_key = t.template_key'),
        ('user_prospect_quick_notes', 'user_id', 't2.label = t.label'),
        ('user_report_notification_preferences', 'user_id', 't2.template_id = t.template_id'),
        ('user_pinned_tabs', 'user_id', 't2.path = t.path AND COALESCE(t2.tab, '''') = COALESCE(t.tab, '''')'),
        ('push_subscriptions', 'user_id', 't2.endpoint = t.endpoint'),
        ('user_app_activity_daily', 'user_id', 't2.activity_date = t.activity_date'),
        ('user_app_activity_page_daily', 'user_id', 't2.activity_date = t.activity_date AND t2.page = t.page'),
        ('schedule_day_email_requests', 'recipient_user_id',
          't.status = ''pending'' AND t2.status = ''pending'' AND t2.work_date = t.work_date'),
        ('user_tag_org', 'user_id', 'TRUE'),
        ('banking_user_prefs', 'user_id', 'TRUE'),
        ('bid_estimators_extra_users', 'user_id', 'TRUE'),
        ('cost_matrix_teams_shares', 'shared_with_user_id', 'TRUE'),
        ('dispatch_group_members', 'user_id', 'TRUE'),
        ('estimator_group_members', 'user_id', 'TRUE'),
        ('pay_approved_masters', 'master_id', 'TRUE'),
        ('report_enabled_users', 'user_id', 'TRUE'),
        ('salary_work_schedule_templates', 'user_id', 'TRUE'),
        ('team_feedback_user_state', 'user_id', 'TRUE'),
        ('user_dashboard_preferences', 'user_id', 'TRUE'),
        ('user_app_activity_viewers', 'viewer_user_id', 'TRUE')
      ) AS v(tbl, ucol, match_expr)
    LOOP
      EXECUTE format(
        'UPDATE public.%I t SET %I = $1 WHERE t.%I = $2 AND NOT EXISTS (SELECT 1 FROM public.%I t2 WHERE t2.%I = $1 AND (%s))',
        r.tbl, r.ucol, r.ucol, r.tbl, r.ucol, r.match_expr) USING p_survivor_user_id, p_absorbed_user_id;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object(r.tbl || '.' || r.ucol, v_n); END IF;
      EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.tbl, r.ucol) USING p_absorbed_user_id;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object(r.tbl || '.' || r.ucol || '.duplicates_dropped', v_n); END IF;
      v_handled := v_handled || (r.tbl || '.' || r.ucol);
    END LOOP;

    ------------------------------------------------------------------
    -- 1g. accept_notify_user_ids uuid[] (no FK possible)
    ------------------------------------------------------------------
    UPDATE public.estimates e
    SET accept_notify_user_ids = (
      SELECT array_agg(DISTINCT x)
      FROM unnest(array_replace(e.accept_notify_user_ids, p_absorbed_user_id, p_survivor_user_id)) AS x
    )
    WHERE e.accept_notify_user_ids @> ARRAY[p_absorbed_user_id];
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object('estimates.accept_notify_user_ids', v_n); END IF;

    ------------------------------------------------------------------
    -- 1h. roster link: move only when the survivor has none
    ------------------------------------------------------------------
    IF EXISTS (SELECT 1 FROM public.people WHERE account_user_id = p_absorbed_user_id) THEN
      IF EXISTS (SELECT 1 FROM public.people WHERE account_user_id = p_survivor_user_id) THEN
        v_warnings := v_warnings ||
          'Both accounts are linked to roster people; the absorbed account''s roster link was left in place. Merge the roster entries manually if needed.'::text;
      ELSE
        UPDATE public.people SET account_user_id = p_survivor_user_id WHERE account_user_id = p_absorbed_user_id;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object('people.account_user_id', v_n); END IF;
        v_handled := v_handled || 'people.account_user_id'::text;
      END IF;
    ELSE
      v_handled := v_handled || 'people.account_user_id'::text;
    END IF;

    ------------------------------------------------------------------
    -- 2. dynamic sweep: every remaining FK to public.users / auth.users on public tables
    ------------------------------------------------------------------
    FOR r IN
      SELECT cl.relname AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1] AND NOT a.attisdropped
      WHERE c.contype = 'f'
        AND cardinality(c.conkey) = 1
        AND n.nspname = 'public'
        AND c.confrelid IN ('public.users'::regclass, 'auth.users'::regclass)
        AND NOT (cl.relname = 'users' AND a.attname = 'id')
      ORDER BY cl.relname, a.attname
    LOOP
      CONTINUE WHEN (r.tbl || '.' || r.col) = ANY (v_handled);
      EXECUTE format('UPDATE public.%I SET %I = $1 WHERE %I = $2', r.tbl, r.col, r.col)
        USING p_survivor_user_id, p_absorbed_user_id;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n > 0 THEN v_moved := v_moved || jsonb_build_object(r.tbl || '.' || r.col, v_n); END IF;
    END LOOP;

    ------------------------------------------------------------------
    -- 3. coverage assert: nothing may still reference the absorbed id
    ------------------------------------------------------------------
    FOR r IN
      SELECT cl.relname AS tbl, a.attname AS col
      FROM pg_constraint c
      JOIN pg_class cl ON cl.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1] AND NOT a.attisdropped
      WHERE c.contype = 'f'
        AND cardinality(c.conkey) = 1
        AND n.nspname = 'public'
        AND c.confrelid IN ('public.users'::regclass, 'auth.users'::regclass)
        AND NOT (cl.relname = 'users' AND a.attname = 'id')
      UNION ALL
      SELECT 'user_app_activity_page_daily', 'user_id'
      UNION ALL
      SELECT 'people', 'account_user_id'
    LOOP
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', r.tbl, r.col)
        INTO v_n USING p_absorbed_user_id;
      IF v_n > 0 AND NOT (r.tbl = 'people' AND r.col = 'account_user_id'
          AND EXISTS (SELECT 1 FROM public.people WHERE account_user_id = p_survivor_user_id)) THEN
        v_leftovers := v_leftovers || format('%s.%s (%s rows)', r.tbl, r.col, v_n);
      END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM public.estimates WHERE accept_notify_user_ids @> ARRAY[p_absorbed_user_id]) THEN
      v_leftovers := v_leftovers || 'estimates.accept_notify_user_ids'::text;
    END IF;
    IF cardinality(v_leftovers) > 0 THEN
      RAISE EXCEPTION 'merge left references behind: %', array_to_string(v_leftovers, ', ');
    END IF;

    ------------------------------------------------------------------
    -- 4. tombstone the absorbed account (email kept; auth ban happens in the edge function)
    ------------------------------------------------------------------
    UPDATE public.users
    SET archived_at = COALESCE(archived_at, now())
    WHERE id = p_absorbed_user_id;

    IF p_dry_run THEN
      RAISE EXCEPTION USING errcode = 'P0M01', message = 'dry run rollback';
    END IF;
  EXCEPTION
    WHEN sqlstate 'P0M01' THEN
      RETURN jsonb_build_object('ok', true, 'dry_run', true, 'moved', v_moved, 'warnings', to_jsonb(v_warnings));
  END;

  RETURN jsonb_build_object('ok', true, 'dry_run', false, 'moved', v_moved, 'warnings', to_jsonb(v_warnings));
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', SQLSTATE, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.merge_user_accounts(uuid, uuid, boolean) IS
  'Dev-only: reassign every reference from the absorbed account to the survivor, tombstone the absorbed account. p_dry_run=true previews per-table counts without changing anything. Called via the merge-users edge function (which also bans the absorbed auth account).';

GRANT EXECUTE ON FUNCTION public.merge_user_accounts(uuid, uuid, boolean) TO authenticated;
