-- Staff follow-up: list stale unlinked Mercury tally rows for users the viewer may manage, and assign splits on behalf of the card owner.

-- Who may viewer see as a "target" user for tally follow-up (SECURITY DEFINER; not granted to authenticated — called only from other definer RPCs).
CREATE OR REPLACE FUNCTION public.staff_can_view_user_for_tally_followup(p_viewer uuid, p_target uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF p_viewer IS NULL OR p_target IS NULL THEN
    RETURN false;
  END IF;
  IF p_viewer = p_target THEN
    RETURN true;
  END IF;

  SELECT u.role INTO v_role FROM public.users u WHERE u.id = p_viewer;
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_dev() OR v_role = 'dev' THEN
    RETURN true;
  END IF;

  IF v_role = 'master_technician' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.master_assistants ma
      WHERE ma.master_id = p_viewer AND ma.assistant_id = p_target
    )
    OR EXISTS (
      SELECT 1
      FROM public.jobs_ledger jl
      INNER JOIN public.jobs_ledger_team_members jtm
        ON jtm.job_id = jl.id AND jtm.user_id = p_target
      WHERE jl.master_user_id = p_viewer
    );
  END IF;

  IF v_role = 'assistant' THEN
    RETURN public.assistants_share_master(p_viewer, p_target)
      OR EXISTS (
        SELECT 1 FROM public.master_assistants ma
        WHERE ma.master_id = p_target AND ma.assistant_id = p_viewer
      );
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.staff_can_view_user_for_tally_followup(uuid, uuid) IS
  'Whether p_viewer (dev/master/assistant rules) may list or assign tally for p_target''s linked-card Mercury rows.';

REVOKE ALL ON FUNCTION public.staff_can_view_user_for_tally_followup(uuid, uuid) FROM PUBLIC;

-- Flat rows for staff modal: stale unlinked linked-card transactions per user in scope.
CREATE OR REPLACE FUNCTION public.list_stale_unlinked_mercury_transactions_for_tally_staff(min_age_days integer DEFAULT 2)
RETURNS TABLE (
  target_user_id uuid,
  target_name text,
  target_email text,
  target_phone text,
  mercury_transaction_id uuid,
  posted_at timestamptz,
  amount numeric(18, 4),
  counterparty_name text,
  note text,
  mercury_account_id uuid,
  currency text,
  mercury_id uuid,
  raw jsonb,
  job_splits jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  floor_ymd text;
  use_floor boolean;
  age_int integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_stale_unlinked_mercury_transactions_for_tally_staff: not authenticated';
  END IF;

  IF NOT (
    public.is_dev()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  ) THEN
    RETURN;
  END IF;

  age_int := GREATEST(0, min_age_days);

  SELECT NULLIF(trim(both FROM value_text), '') INTO floor_ymd
  FROM public.app_settings
  WHERE key = 'job_tally_min_posted_ymd';

  use_floor := floor_ymd IS NOT NULL AND floor_ymd ~ '^\d{4}-\d{2}-\d{2}$';

  RETURN QUERY
  SELECT
    u.id AS target_user_id,
    u.name::text AS target_name,
    COALESCE(NULLIF(trim(both FROM u.email), ''), pp.p_email)::text AS target_email,
    COALESCE(NULLIF(trim(both FROM u.phone), ''), pp.p_phone)::text AS target_phone,
    t.id AS mercury_transaction_id,
    t.posted_at,
    t.amount,
    t.counterparty_name,
    t.note,
    t.mercury_account_id,
    t.currency,
    t.mercury_id,
    t.raw,
    '[]'::jsonb AS job_splits
  FROM public.mercury_transactions t
  INNER JOIN public.mercury_debit_card_user_links l
    ON l.mercury_debit_card_id = public.mercury_debit_card_id_from_raw(t.raw)
  INNER JOIN public.users u ON u.id = l.user_id
  LEFT JOIN LATERAL (
    SELECT
      p.email::text AS p_email,
      p.phone::text AS p_phone
    FROM public.people p
    WHERE p.archived_at IS NULL
      AND lower(trim(both FROM p.name)) = lower(trim(both FROM u.name))
    ORDER BY p.id
    LIMIT 1
  ) pp ON true
  WHERE public.staff_can_view_user_for_tally_followup(auth.uid(), l.user_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.mercury_transaction_job_allocations m
      WHERE m.mercury_transaction_id = t.id
    )
    AND (
      NOT use_floor
      OR (
        t.posted_at IS NOT NULL
        AND to_char(t.posted_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') >= floor_ymd
      )
    )
    AND t.posted_at IS NOT NULL
    AND (
      (now() AT TIME ZONE 'America/Chicago')::date
      - (t.posted_at AT TIME ZONE 'America/Chicago')::date
    ) > age_int
  ORDER BY u.name ASC, t.posted_at DESC NULLS LAST, t.id ASC
  LIMIT 500;
END;
$$;

COMMENT ON FUNCTION public.list_stale_unlinked_mercury_transactions_for_tally_staff(integer) IS
  'Dev/master/assistant: stale unlinked Mercury rows for linked-card users visible via staff_can_view_user_for_tally_followup.';

REVOKE ALL ON FUNCTION public.list_stale_unlinked_mercury_transactions_for_tally_staff(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_stale_unlinked_mercury_transactions_for_tally_staff(integer) TO authenticated;

-- Job search when staff assigns on behalf of p_for_user_id (subcontractor = team jobs only).
CREATE OR REPLACE FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(
  p_for_user_id uuid,
  search_text text DEFAULT ''
)
RETURNS TABLE (
  id uuid,
  hcp_number text,
  job_name text,
  job_address text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jl.id,
    COALESCE(jl.hcp_number, '')::text,
    COALESCE(jl.job_name, '')::text,
    COALESCE(jl.job_address, '')::text
  FROM public.jobs_ledger jl
  WHERE public.staff_can_view_user_for_tally_followup(auth.uid(), p_for_user_id)
  AND (
    search_text IS NULL OR search_text = ''
    OR jl.hcp_number ILIKE '%' || search_text || '%'
    OR (
      length(search_text) >= 2
      AND lower(left(search_text, 1)) = 'j'
      AND jl.hcp_number ILIKE '%' || substring(search_text from 2) || '%'
    )
    OR jl.job_name ILIKE '%' || search_text || '%'
    OR jl.job_address ILIKE '%' || search_text || '%'
  )
  AND (
    NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = p_for_user_id AND u.role = 'subcontractor'
    )
    OR EXISTS (
      SELECT 1 FROM public.jobs_ledger_team_members jtm
      WHERE jtm.job_id = jl.id AND jtm.user_id = p_for_user_id
    )
  )
  ORDER BY (CASE WHEN jl.hcp_number = '' OR jl.hcp_number IS NULL THEN 1 ELSE 0 END), jl.hcp_number DESC
  LIMIT 50;
$$;

COMMENT ON FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(uuid, text) IS
  'Staff tally assign: job search scoped as for p_for_user_id (subcontractors limited to jobs_ledger_team_members).';

REVOKE ALL ON FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_jobs_for_tally_mercury_assign_as_user(uuid, text) TO authenticated;

-- Replace job splits for a transaction on p_for_user_id's linked card (staff only).
CREATE OR REPLACE FUNCTION public.replace_mercury_job_splits_for_linked_card_as_staff(
  p_for_user_id uuid,
  p_mercury_transaction_id uuid,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_amount numeric(18, 4);
  v_raw jsonb;
  v_card uuid;
  v_sum numeric(18, 4);
  v_len int;
  elem jsonb;
  v_note text;
  v_role_target text;
  v_job uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: not authenticated';
  END IF;

  IF NOT (
    public.is_dev()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  ) THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: not authorized';
  END IF;

  IF NOT public.staff_can_view_user_for_tally_followup(auth.uid(), p_for_user_id) THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: not authorized for this user';
  END IF;

  SELECT u.role INTO v_role_target FROM public.users u WHERE u.id = p_for_user_id;
  IF v_role_target IS NULL THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: target user not found';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: p_rows must be a JSON array';
  END IF;

  SELECT t.amount, t.raw INTO v_tx_amount, v_raw
  FROM public.mercury_transactions t
  WHERE t.id = p_mercury_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: transaction not found';
  END IF;

  v_card := public.mercury_debit_card_id_from_raw(v_raw);
  IF v_card IS NULL THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: transaction has no debit card on file';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.mercury_debit_card_user_links l
    WHERE l.user_id = p_for_user_id AND l.mercury_debit_card_id = v_card
  ) THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: not authorized for this transaction';
  END IF;

  v_len := jsonb_array_length(p_rows);

  SELECT COALESCE(SUM((e->>'amount')::numeric(18, 4)), 0) INTO v_sum
  FROM jsonb_array_elements(p_rows) AS e;

  IF v_len > 0 AND v_sum IS DISTINCT FROM v_tx_amount THEN
    RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: allocation sum must equal transaction amount';
  END IF;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_job := (elem->>'job_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger jl WHERE jl.id = v_job) THEN
      RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: invalid job';
    END IF;
    IF v_role_target = 'subcontractor' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.jobs_ledger_team_members jtm
        WHERE jtm.job_id = v_job AND jtm.user_id = p_for_user_id
      ) THEN
        RAISE EXCEPTION 'replace_mercury_job_splits_for_linked_card_as_staff: job not on target user team';
      END IF;
    END IF;
  END LOOP;

  DELETE FROM public.mercury_transaction_job_allocations
  WHERE mercury_transaction_id = p_mercury_transaction_id;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_note := NULLIF(trim(both FROM elem->>'note'), '');
    INSERT INTO public.mercury_transaction_job_allocations (
      mercury_transaction_id,
      job_id,
      amount,
      note,
      created_by
    )
    VALUES (
      p_mercury_transaction_id,
      (elem->>'job_id')::uuid,
      (elem->>'amount')::numeric(18, 4),
      v_note,
      auth.uid()
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.replace_mercury_job_splits_for_linked_card_as_staff(uuid, uuid, jsonb) IS
  'Dev/master/assistant: replace job splits for a Mercury tx on p_for_user_id''s linked card if staff_can_view_user_for_tally_followup.';

REVOKE ALL ON FUNCTION public.replace_mercury_job_splits_for_linked_card_as_staff(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_mercury_job_splits_for_linked_card_as_staff(uuid, uuid, jsonb) TO authenticated;
