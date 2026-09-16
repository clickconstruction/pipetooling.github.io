SET lock_timeout = '3s';

-- v2.3529 — Money with no bill, PR 2: the reason-coded close-out.
--
-- A deposit that is genuinely not a customer's payment (bank interest, a vendor refund, an
-- owner deposit) has no bill and no job, so today it nags in Accounts Receivable forever —
-- the only exits are a bill (there is none) or Mark returned (a lie: the money did not bounce).
-- This adds the third exit, modelled on `mercury_transaction_ar_returned`: a per-deposit
-- sidecar carrying the REASON, who closed it and when. The row drops the deposit from
-- To match (both the list and the count read it); Banking's accounting label still carries
-- the books. Reopening deletes the row.
--
-- The write refuses a deposit that already has money applied to a job — that money is a
-- customer's, and its leftover is the tip strip's job (v2.3496), not this door's.

CREATE TABLE IF NOT EXISTS public.mercury_transaction_ar_closed (
  mercury_transaction_id uuid PRIMARY KEY REFERENCES public.mercury_transactions(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('bank_interest', 'vendor_refund', 'owner_deposit', 'other')),
  note text,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES public.users(id)
);

COMMENT ON TABLE public.mercury_transaction_ar_closed IS
  'Org flag (v2.3529): a Mercury deposit closed out of Accounts Receivable with a reason (bank_interest · vendor_refund · owner_deposit · other + note) because it is not a customer''s payment. Hides the row from To match; Banking''s label carries the accounting. Sync-owned mercury_transactions is not updated. Delete the row to reopen.';

CREATE INDEX IF NOT EXISTS mercury_transaction_ar_closed_closed_at_idx
  ON public.mercury_transaction_ar_closed (closed_at DESC);

ALTER TABLE public.mercury_transaction_ar_closed ENABLE ROW LEVEL SECURITY;

-- Same audience as mercury_transaction_ar_returned (20260911183606): office staff + primary.
DROP POLICY IF EXISTS "mercury_transaction_ar_closed_select_ar_roles" ON public.mercury_transaction_ar_closed;
CREATE POLICY "mercury_transaction_ar_closed_select_ar_roles" ON public.mercury_transaction_ar_closed FOR SELECT TO authenticated USING (public.is_office_staff() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary'::public.user_role));
DROP POLICY IF EXISTS "mercury_transaction_ar_closed_insert_ar_roles" ON public.mercury_transaction_ar_closed;
CREATE POLICY "mercury_transaction_ar_closed_insert_ar_roles" ON public.mercury_transaction_ar_closed FOR INSERT TO authenticated WITH CHECK (public.is_office_staff() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary'::public.user_role));
DROP POLICY IF EXISTS "mercury_transaction_ar_closed_update_ar_roles" ON public.mercury_transaction_ar_closed;
CREATE POLICY "mercury_transaction_ar_closed_update_ar_roles" ON public.mercury_transaction_ar_closed FOR UPDATE TO authenticated USING (public.is_office_staff() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary'::public.user_role)) WITH CHECK (public.is_office_staff() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary'::public.user_role));
DROP POLICY IF EXISTS "mercury_transaction_ar_closed_delete_ar_roles" ON public.mercury_transaction_ar_closed;
CREATE POLICY "mercury_transaction_ar_closed_delete_ar_roles" ON public.mercury_transaction_ar_closed FOR DELETE TO authenticated USING (public.is_office_staff() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role = 'primary'::public.user_role));

-- The one write. p_reason NULL reopens (deletes the row), mirroring set_mercury_transaction_ar_returned(false).
CREATE OR REPLACE FUNCTION public.set_mercury_transaction_ar_closed(
  p_mercury_transaction_id uuid,
  p_reason text,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 240), '');
  v_tx public.mercury_transactions%ROWTYPE;
  v_applied numeric;
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_closed: not authenticated';
  END IF;

  IF NOT (
    public.is_office_staff()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'primary'::public.user_role)
  ) THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_closed: not authorized';
  END IF;

  IF p_mercury_transaction_id IS NULL THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_closed: mercury transaction required';
  END IF;

  -- Reopen.
  IF v_reason IS NULL THEN
    DELETE FROM public.mercury_transaction_ar_closed WHERE mercury_transaction_id = p_mercury_transaction_id;
    RETURN jsonb_build_object('ok', true, 'closed', false);
  END IF;

  IF v_reason NOT IN ('bank_interest', 'vendor_refund', 'owner_deposit', 'other') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick a reason from the list.');
  END IF;
  IF v_reason = 'other' AND v_note IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Say what it is — a note is required for Something else.');
  END IF;

  SELECT * INTO v_tx FROM public.mercury_transactions t WHERE t.id = p_mercury_transaction_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That bank transaction no longer exists.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.mercury_transaction_ar_returned r
    WHERE r.mercury_transaction_id = p_mercury_transaction_id AND r.returned
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This deposit is marked returned. Unmark it first if it did not bounce.');
  END IF;

  SELECT coalesce(sum(p.amount), 0) INTO v_applied
  FROM public.jobs_ledger_payments p
  WHERE p.mercury_transaction_id = p_mercury_transaction_id;
  IF v_applied > 0.0005 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Money from this deposit is already applied to a job, so it is a customer''s payment. Remove that payment first, or record the leftover as a tip.');
  END IF;

  INSERT INTO public.mercury_transaction_ar_closed (mercury_transaction_id, reason, note, closed_at, closed_by)
  VALUES (p_mercury_transaction_id, v_reason, v_note, v_now, auth.uid())
  ON CONFLICT (mercury_transaction_id) DO UPDATE SET
    reason = excluded.reason,
    note = excluded.note,
    closed_at = excluded.closed_at,
    closed_by = excluded.closed_by;

  RETURN jsonb_build_object('ok', true, 'closed', true, 'reason', v_reason, 'note', v_note, 'closed_at', v_now, 'closed_by', auth.uid());
END;
$$;

COMMENT ON FUNCTION public.set_mercury_transaction_ar_closed(uuid, text, text) IS
  'Jobs AR (v2.3529): close a Mercury deposit out of To match with a reason (bank_interest · vendor_refund · owner_deposit · other + note), or reopen it with p_reason NULL. Refuses returned deposits and deposits with money applied to a job. Office staff + primary.';

REVOKE ALL ON FUNCTION public.set_mercury_transaction_ar_closed(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_mercury_transaction_ar_closed(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_mercury_transaction_ar_closed(uuid, text, text) TO authenticated, service_role;

-- The two readers of To match learn the sidecar: a closed deposit leaves the pile (and the
-- Dashboard's count) unless the caller asks for hidden rows (To match · All). Bodies are the
-- baseline definitions with one clause added after the returned-flag clause.

CREATE OR REPLACE FUNCTION "public"."list_mercury_transactions_for_bank_payments"("p_filter" "jsonb" DEFAULT NULL::"jsonb") RETURNS TABLE("mercury_transaction_id" "uuid", "amount" numeric, "posted_at" timestamp with time zone, "counterparty_name" "text", "note" "text", "external_memo" "text", "kind" "text", "mercury_account_id" "uuid", "raw" "jsonb", "mercury_id" "uuid", "consumed" numeric, "remaining_available" numeric, "returned" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_kinds text[] := ARRAY[]::text[];
  v_account_ids text[] := ARRAY[]::text[];
  v_debit_ids text[] := ARRAY[]::text[];
  v_start_ymd text;
  v_exclude_cp text[] := ARRAY[]::text[];
  v_exclude_note text[] := ARRAY[]::text[];
  v_include_hidden boolean := false;
  o jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_mercury_transactions_for_bank_payments: not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'primary')
  ) THEN
    RAISE EXCEPTION 'list_mercury_transactions_for_bank_payments: not authorized';
  END IF;

  IF p_filter IS NOT NULL AND jsonb_typeof(p_filter) = 'object' THEN
    o := p_filter;
    IF o ? 'kinds' AND jsonb_typeof(o->'kinds') = 'array' THEN
      SELECT coalesce(array_agg(value::text), ARRAY[]::text[])
      INTO v_kinds
      FROM jsonb_array_elements_text(o->'kinds');
    END IF;
    IF o ? 'accountIds' AND jsonb_typeof(o->'accountIds') = 'array' THEN
      SELECT coalesce(array_agg(value::text), ARRAY[]::text[])
      INTO v_account_ids
      FROM jsonb_array_elements_text(o->'accountIds');
    END IF;
    IF o ? 'debitCardIds' AND jsonb_typeof(o->'debitCardIds') = 'array' THEN
      SELECT coalesce(array_agg(lower(trim(value::text))), ARRAY[]::text[])
      INTO v_debit_ids
      FROM jsonb_array_elements_text(o->'debitCardIds');
    END IF;
    IF o ? 'startDateYmd' AND jsonb_typeof(o->'startDateYmd') = 'string' THEN
      v_start_ymd := trim(o->>'startDateYmd');
    END IF;
    IF o ? 'excludeCounterpartyContains' AND jsonb_typeof(o->'excludeCounterpartyContains') = 'array' THEN
      WITH elements AS (
        SELECT left(btrim(value), 120) AS p
        FROM jsonb_array_elements_text(o->'excludeCounterpartyContains')
        WHERE length(btrim(value)) > 0
        LIMIT 50
      )
      SELECT coalesce(array_agg(p ORDER BY p), ARRAY[]::text[])
      INTO v_exclude_cp
      FROM elements;
    END IF;
    IF o ? 'excludeNoteContains' AND jsonb_typeof(o->'excludeNoteContains') = 'array' THEN
      WITH elements AS (
        SELECT left(btrim(value), 120) AS p
        FROM jsonb_array_elements_text(o->'excludeNoteContains')
        WHERE length(btrim(value)) > 0
        LIMIT 50
      )
      SELECT coalesce(array_agg(p ORDER BY p), ARRAY[]::text[])
      INTO v_exclude_note
      FROM elements;
    END IF;
    IF o ? 'includeHiddenArDeposits' AND jsonb_typeof(o->'includeHiddenArDeposits') = 'boolean' THEN
      v_include_hidden := (o->>'includeHiddenArDeposits')::boolean;
    ELSIF o ? 'includeFullyApplied' AND jsonb_typeof(o->'includeFullyApplied') = 'boolean' THEN
      v_include_hidden := (o->>'includeFullyApplied')::boolean;
    END IF;
  END IF;

  IF v_start_ymd IS NULL OR v_start_ymd !~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_start_ymd := to_char((CURRENT_TIMESTAMP AT TIME ZONE 'America/Chicago')::date - 90, 'YYYY-MM-DD');
  END IF;

  RETURN QUERY
  SELECT
    t.id AS mercury_transaction_id,
    t.amount::numeric,
    t.posted_at,
    t.counterparty_name,
    t.note,
    t.external_memo,
    t.kind,
    t.mercury_account_id,
    t.raw,
    t.mercury_id,
    coalesce((
      SELECT sum(p.amount)
      FROM public.jobs_ledger_payments p
      WHERE p.mercury_transaction_id = t.id
    ), 0)::numeric AS consumed,
    (abs(t.amount) - coalesce((
      SELECT sum(p.amount)
      FROM public.jobs_ledger_payments p
      WHERE p.mercury_transaction_id = t.id
    ), 0))::numeric AS remaining_available,
    coalesce(r.returned, false) AS returned
  FROM public.mercury_transactions t
  LEFT JOIN public.mercury_transaction_ar_returned r ON r.mercury_transaction_id = t.id
  WHERE t.posted_at IS NOT NULL
    AND to_char((t.posted_at AT TIME ZONE 'America/Chicago')::date, 'YYYY-MM-DD') >= v_start_ymd
    AND (cardinality(v_kinds) = 0 OR t.kind = ANY (v_kinds))
    AND (cardinality(v_account_ids) = 0 OR t.mercury_account_id::text = ANY (v_account_ids))
    AND (
      cardinality(v_debit_ids) = 0
      OR public._mercury_raw_debit_card_id_lower(t.raw) = ANY (v_debit_ids)
    )
    AND abs(t.amount) > 0
    AND (
      v_include_hidden
      OR (
        abs(t.amount) - coalesce((
          SELECT sum(p.amount)
          FROM public.jobs_ledger_payments p
          WHERE p.mercury_transaction_id = t.id
        ), 0)
      ) > 0.0005
    )
    AND (
      v_include_hidden
      OR NOT EXISTS (
        SELECT 1
        FROM public.mercury_transaction_ar_returned r2
        WHERE r2.mercury_transaction_id = t.id
          AND r2.returned
      )
    )
    AND (
      v_include_hidden
      OR NOT EXISTS (
        SELECT 1
        FROM public.mercury_transaction_ar_closed c2
        WHERE c2.mercury_transaction_id = t.id
      )
    )
    AND NOT (
      cardinality(v_exclude_cp) > 0
      AND EXISTS (
        SELECT 1
        FROM unnest(v_exclude_cp) AS x(pat)
        WHERE position(lower(x.pat) IN lower(coalesce(t.counterparty_name, ''))) > 0
      )
    )
    AND NOT (
      cardinality(v_exclude_note) > 0
      AND EXISTS (
        SELECT 1
        FROM unnest(v_exclude_note) AS x(pat)
        WHERE position(lower(x.pat) IN lower(coalesce(t.note, ''))) > 0
      )
    )
  ORDER BY t.posted_at DESC NULLS LAST, t.id DESC;
END;
$_$;

CREATE OR REPLACE FUNCTION "public"."count_mercury_transactions_for_bank_payments"("p_filter" "jsonb" DEFAULT NULL::"jsonb") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_kinds text[] := array[]::text[];
  v_account_ids text[] := array[]::text[];
  v_debit_ids text[] := array[]::text[];
  v_start_ymd text;
  v_exclude_cp text[] := array[]::text[];
  v_exclude_note text[] := array[]::text[];
  v_include_hidden boolean := false;
  o jsonb;
  v_count bigint;
begin
  if auth.uid() is null then
    raise exception 'count_mercury_transactions_for_bank_payments: not authenticated';
  end if;

  if not exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('dev', 'master_technician', 'assistant', 'primary')
  ) then
    raise exception 'count_mercury_transactions_for_bank_payments: not authorized';
  end if;

  if p_filter is not null and jsonb_typeof(p_filter) = 'object' then
    o := p_filter;
    if o ? 'kinds' and jsonb_typeof(o->'kinds') = 'array' then
      select coalesce(array_agg(value::text), array[]::text[])
      into v_kinds
      from jsonb_array_elements_text(o->'kinds');
    end if;
    if o ? 'accountIds' and jsonb_typeof(o->'accountIds') = 'array' then
      select coalesce(array_agg(value::text), array[]::text[])
      into v_account_ids
      from jsonb_array_elements_text(o->'accountIds');
    end if;
    if o ? 'debitCardIds' and jsonb_typeof(o->'debitCardIds') = 'array' then
      select coalesce(array_agg(lower(trim(value::text))), array[]::text[])
      into v_debit_ids
      from jsonb_array_elements_text(o->'debitCardIds');
    end if;
    if o ? 'startDateYmd' and jsonb_typeof(o->'startDateYmd') = 'string' then
      v_start_ymd := trim(o->>'startDateYmd');
    end if;
    if o ? 'excludeCounterpartyContains' and jsonb_typeof(o->'excludeCounterpartyContains') = 'array' then
      with elements as (
        select left(btrim(value), 120) as p
        from jsonb_array_elements_text(o->'excludeCounterpartyContains')
        where length(btrim(value)) > 0
        limit 50
      )
      select coalesce(array_agg(p order by p), array[]::text[])
      into v_exclude_cp
      from elements;
    end if;
    if o ? 'excludeNoteContains' and jsonb_typeof(o->'excludeNoteContains') = 'array' then
      with elements as (
        select left(btrim(value), 120) as p
        from jsonb_array_elements_text(o->'excludeNoteContains')
        where length(btrim(value)) > 0
        limit 50
      )
      select coalesce(array_agg(p order by p), array[]::text[])
      into v_exclude_note
      from elements;
    end if;
    if o ? 'includeHiddenArDeposits' and jsonb_typeof(o->'includeHiddenArDeposits') = 'boolean' then
      v_include_hidden := (o->>'includeHiddenArDeposits')::boolean;
    elsif o ? 'includeFullyApplied' and jsonb_typeof(o->'includeFullyApplied') = 'boolean' then
      v_include_hidden := (o->>'includeFullyApplied')::boolean;
    end if;
  end if;

  if v_start_ymd is null or v_start_ymd !~ '^\d{4}-\d{2}-\d{2}$' then
    v_start_ymd := to_char((current_timestamp at time zone 'America/Chicago')::date - 90, 'YYYY-MM-DD');
  end if;

  select count(*)::bigint
  into v_count
  from public.mercury_transactions t
  where t.posted_at is not null
    and t.duplicate_of_transaction_id is null
    and to_char((t.posted_at at time zone 'America/Chicago')::date, 'YYYY-MM-DD') >= v_start_ymd
    and (cardinality(v_kinds) = 0 or t.kind = any (v_kinds))
    and (cardinality(v_account_ids) = 0 or t.mercury_account_id::text = any (v_account_ids))
    and (
      cardinality(v_debit_ids) = 0
      or public._mercury_raw_debit_card_id_lower(t.raw) = any (v_debit_ids)
    )
    and abs(t.amount) > 0
    and (
      v_include_hidden
      or (
        abs(t.amount) - coalesce((
          select sum(p.amount)
          from public.jobs_ledger_payments p
          where p.mercury_transaction_id = t.id
        ), 0)
      ) > 0.0005
    )
    and (
      v_include_hidden
      or not exists (
        select 1
        from public.mercury_transaction_ar_returned r2
        where r2.mercury_transaction_id = t.id
          and r2.returned
      )
    )
    and (
      v_include_hidden
      or not exists (
        select 1
        from public.mercury_transaction_ar_closed c2
        where c2.mercury_transaction_id = t.id
      )
    )
    and not (
      cardinality(v_exclude_cp) > 0
      and exists (
        select 1
        from unnest(v_exclude_cp) as x(pat)
        where position(lower(x.pat) in lower(coalesce(t.counterparty_name, ''))) > 0
      )
    )
    and not (
      cardinality(v_exclude_note) > 0
      and exists (
        select 1
        from unnest(v_exclude_note) as x(pat)
        where position(lower(x.pat) in lower(coalesce(t.note, ''))) > 0
      )
    );

  return coalesce(v_count, 0);
end;
$_$;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
