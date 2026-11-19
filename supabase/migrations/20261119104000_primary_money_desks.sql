SET lock_timeout = '3s';

-- The money desks close to a primary (punch list #400, PR 5 of 5; to-dos/primary-job-doors.md, the owner's call 1 of
-- 2026-11-19). Three desks named the role in their office lists: the bank payments desk, returned checks and
-- disputes, and the GC review week. None of them takes a job, so no job predicate can narrow them, and a primary has
-- no screen onto any of them: their Jobs page is the Reports tab alone, the bank payments window opens from the
-- Stages tab, /accounts-receivable turns them away, and the Needs-you items that open these are the office's. On a
-- whole-schema bed a primary on no job read the bank deposits, every unlinked payment and the return cases.
--
-- Each function below is its live definition (pg_get_functiondef on prod, read on 2026-11-19, the same text a bed
-- holding every migration on main at aa0e5ff7f gives) with ONE change: the role comes out of its office list. Two
-- of them, list_ar_allocations_for_mercury_transaction and list_ar_deposit_trails, also carried the role in their
-- job check, and that clause comes out with it. The read policies of ar_stripe_cases and ar_unbanked_check_cases
-- are re-created without the role. close_out_ar_deposit names no role: it asks
-- set_mercury_transaction_ar_closed, which is narrowed here.
--
-- What stays open, on purpose: get_billed_customer_pay_speeds, list_job_promised_pay_dates,
-- can_read_payment_promises() with the reads behind it, and list_ar_returned_check_payers. The card took them for
-- desk reads with no screen. The client search found otherwise: the Bill tab of a primary's own job draws its
-- expected-pay dates, its pay calendar and its returned-checks warning from them (canSeeBilledExpectedPay names
-- the role). They read every payer in the company, so they are a call for the owner, not a clause.
-- Dev, master, assistant and controller are untouched. No name, argument or returned shape changes.
-- CREATE OR REPLACE keeps each function's grants and owner. No CREATE TABLE. Idempotent: CREATE OR REPLACE and
-- DROP POLICY IF EXISTS + CREATE, so a second run changes nothing.

-- ---------- list_mercury_transactions_for_bank_payments(jsonb): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.list_mercury_transactions_for_bank_payments(p_filter jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(mercury_transaction_id uuid, amount numeric, posted_at timestamp with time zone, counterparty_name text, note text, external_memo text, kind text, mercury_account_id uuid, raw jsonb, mercury_id uuid, consumed numeric, remaining_available numeric, returned boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
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
$function$;

-- ---------- count_mercury_transactions_for_bank_payments(jsonb): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.count_mercury_transactions_for_bank_payments(p_filter jsonb DEFAULT NULL::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and u.role in ('dev', 'master_technician', 'assistant', 'controller')
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
    -- v2.4313: a check the bank sent back is not money to match (it already leaves the list).
    and (v_include_hidden or t.status is distinct from 'failed')
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
$function$;

-- ---------- list_unlinked_payments_for_bank_payments(): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.list_unlinked_payments_for_bank_payments()
 RETURNS TABLE(payment_id uuid, job_id uuid, amount numeric, paid_on date, note text, payment_type text, reference_number text, invoice_id uuid, hcp_number text, click_number text, job_name text, stripe_hosted boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.job_id,
    p.amount::numeric,
    p.paid_on,
    p.note,
    p.payment_type,
    p.reference_number,
    p.invoice_id,
    j.hcp_number,
    j.click_number,
    j.job_name,
    (coalesce(trim(i.stripe_invoice_id), '') <> '') AS stripe_hosted
  FROM public.jobs_ledger_payments p
  JOIN public.jobs_ledger j ON j.id = p.job_id
  LEFT JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
  WHERE EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
    )
    AND p.mercury_transaction_id IS NULL
    AND lower(coalesce(trim(p.note), '')) <> 'stripe'
    AND coalesce(p.amount, 0) > 0
    -- v2.6816: an in-kind payment is not money; no deposit will ever carry it.
    AND NOT (lower(coalesce(trim(p.payment_type), '')) ~ '(^|[^a-z])in[[:space:]-]?kind')
    AND (
      p.paid_on IS NULL
      OR p.paid_on >= ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Chicago')::date - 180)
    )
  ORDER BY p.paid_on DESC NULLS LAST, p.id DESC
  LIMIT 500;
$function$;

-- ---------- list_ar_allocations_for_mercury_transaction(uuid): the office list and the job check, without the role ----------

CREATE OR REPLACE FUNCTION public.list_ar_allocations_for_mercury_transaction(p_mercury_transaction_id uuid)
 RETURNS TABLE(payment_id uuid, job_id uuid, amount numeric, paid_on date, invoice_id uuid, note text, hcp_number text, job_name text, invoice_sequence_order integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_ar_allocations_for_mercury_transaction: not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')) THEN
    RAISE EXCEPTION 'list_ar_allocations_for_mercury_transaction: not authorized';
  END IF;
  IF p_mercury_transaction_id IS NULL THEN
    RAISE EXCEPTION 'list_ar_allocations_for_mercury_transaction: mercury transaction required';
  END IF;
  RETURN QUERY
  SELECT
    p.id AS payment_id, p.job_id, p.amount::numeric, p.paid_on, p.invoice_id,
    nullif(trim(coalesce(p.note, '')), '') AS note,
    COALESCE(NULLIF(j.hcp_number, ''), NULLIF(j.click_number, ''), ''),
    j.job_name, inv.sequence_order AS invoice_sequence_order
  FROM public.jobs_ledger_payments p
  INNER JOIN public.jobs_ledger j ON j.id = p.job_id
  LEFT JOIN public.jobs_ledger_invoices inv ON inv.id = p.invoice_id
  WHERE p.mercury_transaction_id = p_mercury_transaction_id
    AND (j.master_user_id = auth.uid() OR public.is_dev()
      OR public.is_office_or_estimator()
      OR public.is_office_or_estimator()
      OR public.assistants_share_master(auth.uid(), j.master_user_id))
  ORDER BY p.paid_on DESC NULLS LAST, p.id;
END;
$function$;

-- ---------- list_ar_deposit_trails(uuid[]): the office list and the job check, without the role ----------

CREATE OR REPLACE FUNCTION public.list_ar_deposit_trails(p_tx_ids uuid[])
 RETURNS TABLE(mercury_transaction_id uuid, payment_id uuid, live boolean, job_id uuid, job_number text, job_name text, invoice_id uuid, amount numeric, applied_at timestamp with time zone, applied_by text, removed_at timestamp with time zone, removed_by text, payment_type text, reference_number text, recorded_by_hand boolean, linked_at timestamp with time zone, linked_by text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'list_ar_deposit_trails: not authenticated';
  end if;
  if not exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role in ('dev', 'master_technician', 'assistant', 'controller')
  ) then
    raise exception 'list_ar_deposit_trails: not authorized';
  end if;
  if p_tx_ids is null or cardinality(p_tx_ids) = 0 then
    return;
  end if;
  if cardinality(p_tx_ids) > 1000 then
    raise exception 'list_ar_deposit_trails: at most 1000 deposits per call';
  end if;

  return query
  with live as (
    select p.mercury_transaction_id, p.id as payment_id, true as live, p.job_id, p.invoice_id,
           p.amount::numeric as amount, p.created_at as applied_at, p.created_by,
           null::timestamptz as removed_at, null::uuid as removed_by,
           p.payment_type, p.reference_number, p.linked_at, p.linked_by
    from public.jobs_ledger_payments p
    where p.mercury_transaction_id = any(p_tx_ids)
  ), gone as (
    select (a.row_data->>'mercury_transaction_id')::uuid, (a.row_data->>'id')::uuid, false,
           (a.row_data->>'job_id')::uuid, (a.row_data->>'invoice_id')::uuid,
           (a.row_data->>'amount')::numeric, (a.row_data->>'created_at')::timestamptz,
           (a.row_data->>'created_by')::uuid,
           a.deleted_at, a.deleted_by,
           a.row_data->>'payment_type', a.row_data->>'reference_number',
           (a.row_data->>'linked_at')::timestamptz, (a.row_data->>'linked_by')::uuid
    from public.deleted_records_archive a
    where a.table_name = 'jobs_ledger_payments'
      and a.restored_at is null
      and (a.row_data->>'mercury_transaction_id') = any(p_tx_ids::text[])
  ), allp as (
    select * from live union all select * from gone
  )
  select r.mercury_transaction_id, r.payment_id, r.live, r.job_id,
         coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), '') as job_number,
         j.job_name, r.invoice_id, r.amount, r.applied_at,
         coalesce(
           (select coalesce(nullif(u.name, ''), u.email) from public.users u where u.id = r.created_by),
           (select coalesce(nullif(u.name, ''), u.email)
              from public.job_activity_events e
              join public.users u on u.id = e.actor_user_id
             where e.event_type = 'payment_added'
               and (e.detail->>'source_id') = r.payment_id::text
             order by e.occurred_at
             limit 1)
         ) as applied_by,
         r.removed_at,
         (select coalesce(nullif(u.name, ''), u.email) from public.users u where u.id = r.removed_by) as removed_by,
         r.payment_type,
         r.reference_number,
         (r.reference_number is distinct from t.mercury_id::text) as recorded_by_hand,
         r.linked_at,
         (select coalesce(nullif(u.name, ''), u.email) from public.users u where u.id = r.linked_by) as linked_by
  from allp r
  left join public.jobs_ledger j on j.id = r.job_id
  left join public.mercury_transactions t on t.id = r.mercury_transaction_id
  where j.id is null
     or (j.master_user_id = auth.uid() or public.is_dev()
         or public.is_office_or_estimator()
         or public.assistants_share_master(auth.uid(), j.master_user_id))
  order by r.applied_at, r.payment_id;
end;
$function$;

-- ---------- ar_book_applied_deposit_income(uuid): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.ar_book_applied_deposit_income(p_mercury_transaction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tx public.mercury_transactions%ROWTYPE;
  v_income uuid;
  v_current uuid;
  v_current_name text;
  v_pay public.jobs_ledger_payments%ROWTYPE;
  v_applied numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ar_book_applied_deposit_income: not authenticated';
  END IF;
  IF NOT (
    public.is_office_staff()
  ) THEN
    RAISE EXCEPTION 'ar_book_applied_deposit_income: not authorized';
  END IF;

  SELECT * INTO v_tx FROM public.mercury_transactions t WHERE t.id = p_mercury_transaction_id;
  IF NOT FOUND OR v_tx.amount IS NULL OR v_tx.amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That bank deposit no longer exists.');
  END IF;

  SELECT coalesce(sum(p.amount), 0) INTO v_applied
  FROM public.jobs_ledger_payments p
  WHERE p.mercury_transaction_id = p_mercury_transaction_id;
  IF v_applied <= 0.0005 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only a deposit that paid a bill is booked as Income here.');
  END IF;

  SELECT l.id INTO v_income
  FROM public.mercury_drag_sort_labels l
  WHERE l.default_key = 'income_part_i'
  ORDER BY l.sort_order
  LIMIT 1;
  IF v_income IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Banking has no Income label.');
  END IF;

  SELECT d.label_id, l.name INTO v_current, v_current_name
  FROM public.mercury_transaction_drag_sort_assignments d
  JOIN public.mercury_drag_sort_labels l ON l.id = d.label_id
  WHERE d.mercury_transaction_id = p_mercury_transaction_id
  FOR UPDATE OF d;

  IF v_current = v_income THEN
    RETURN jsonb_build_object('ok', true, 'booked', 'kept');
  END IF;

  INSERT INTO public.mercury_transaction_drag_sort_assignments (mercury_transaction_id, label_id)
  VALUES (p_mercury_transaction_id, v_income)
  ON CONFLICT (mercury_transaction_id) DO UPDATE SET
    label_id = EXCLUDED.label_id,
    assigned_at = now();

  SELECT * INTO v_pay
  FROM public.jobs_ledger_payments p
  WHERE p.mercury_transaction_id = p_mercury_transaction_id
  ORDER BY p.created_at, p.id
  LIMIT 1;

  INSERT INTO public.mercury_transaction_ar_income_labels (
    mercury_transaction_id, job_id, invoice_id, payment_id, source, labelled_at, previous_label_id, relabelled_by
  )
  VALUES (
    p_mercury_transaction_id, v_pay.job_id, v_pay.invoice_id, v_pay.id, 'relabel', now(), v_current, auth.uid()
  )
  ON CONFLICT (mercury_transaction_id) DO UPDATE SET
    job_id = EXCLUDED.job_id,
    invoice_id = EXCLUDED.invoice_id,
    payment_id = EXCLUDED.payment_id,
    source = EXCLUDED.source,
    labelled_at = EXCLUDED.labelled_at,
    previous_label_id = EXCLUDED.previous_label_id,
    relabelled_by = EXCLUDED.relabelled_by;

  RETURN jsonb_build_object('ok', true, 'booked', 'set', 'previous_label_name', v_current_name);
END;
$function$;

-- ---------- ar_deposit_booking(uuid): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.ar_deposit_booking(p_mercury_transaction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tx public.mercury_transactions%ROWTYPE;
  v_cp text;
  v_label_id uuid;
  v_label jsonb;
  v_label_at timestamptz;
  v_label_by text;
  v_rule_name text;
  v_pending jsonb;
  v_usual jsonb;
  v_last jsonb;
  v_labels jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ar_deposit_booking: not authenticated';
  END IF;
  IF NOT (
    public.is_office_staff()
  ) THEN
    RAISE EXCEPTION 'ar_deposit_booking: not authorized';
  END IF;

  SELECT * INTO v_tx FROM public.mercury_transactions t WHERE t.id = p_mercury_transaction_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  v_cp := lower(btrim(coalesce(v_tx.counterparty_name, '')));

  -- The label it carries now, and who put it there.
  SELECT d.label_id, d.assigned_at,
         jsonb_build_object('id', l.id, 'name', l.name, 'default_key', l.default_key, 'account_type', l.account_type)
    INTO v_label_id, v_label_at, v_label
  FROM public.mercury_transaction_drag_sort_assignments d
  JOIN public.mercury_drag_sort_labels l ON l.id = d.label_id
  WHERE d.mercury_transaction_id = p_mercury_transaction_id;

  IF v_label_id IS NOT NULL THEN
    SELECT r.name INTO v_rule_name
    FROM public.mercury_accounting_label_suggestions s
    JOIN public.mercury_accounting_label_rules r ON r.id = s.rule_id
    WHERE s.mercury_transaction_id = p_mercury_transaction_id
      AND s.status = 'approved'
      AND s.final_label_id = v_label_id
      AND s.final_label_id = s.suggested_label_id
    ORDER BY s.resolved_at DESC NULLS LAST
    LIMIT 1;

    IF EXISTS (
      SELECT 1 FROM public.mercury_transaction_ar_close_labels c
      WHERE c.mercury_transaction_id = p_mercury_transaction_id AND c.label_id = v_label_id AND c.source = 'close_out'
    ) THEN
      v_label_by := 'close_out';
    ELSIF v_rule_name IS NOT NULL THEN
      v_label_by := 'rule';
    ELSIF EXISTS (
      SELECT 1 FROM public.mercury_transaction_ar_income_labels i WHERE i.mercury_transaction_id = p_mercury_transaction_id
    ) THEN
      v_label_by := 'ar_income';
    ELSE
      v_label_by := 'person';
    END IF;
  END IF;

  -- A rule match still waiting for someone to approve it.
  SELECT jsonb_build_object(
           'suggestion_id', s.id,
           'rule_name', r.name,
           'label', jsonb_build_object('id', l.id, 'name', l.name, 'default_key', l.default_key, 'account_type', l.account_type)
         )
    INTO v_pending
  FROM public.mercury_accounting_label_suggestions s
  JOIN public.mercury_accounting_label_rules r ON r.id = s.rule_id AND r.enabled
  JOIN public.mercury_drag_sort_labels l ON l.id = s.suggested_label_id
  WHERE s.mercury_transaction_id = p_mercury_transaction_id
    AND s.status = 'pending'
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_cp <> '' THEN
    -- How this payee's money going out is booked: the label most of its payments carry.
    SELECT jsonb_build_object(
             'label', jsonb_build_object('id', l.id, 'name', l.name, 'default_key', l.default_key, 'account_type', l.account_type),
             'count', u.n
           )
      INTO v_usual
    FROM (
      SELECT d.label_id, count(*) AS n, max(o.posted_at) AS last_at
      FROM public.mercury_transactions o
      JOIN public.mercury_transaction_drag_sort_assignments d ON d.mercury_transaction_id = o.id
      WHERE o.amount < 0
        AND o.id <> p_mercury_transaction_id
        AND o.status IS DISTINCT FROM 'failed'
        AND o.duplicate_of_transaction_id IS NULL
        AND lower(btrim(coalesce(o.counterparty_name, ''))) = v_cp
      GROUP BY d.label_id
      ORDER BY count(*) DESC, max(o.posted_at) DESC NULLS LAST
      LIMIT 1
    ) u
    JOIN public.mercury_drag_sort_labels l ON l.id = u.label_id;

    -- The payee's last deposit that was closed out: the one guess the strip may make.
    SELECT jsonb_build_object('reason', c.reason, 'closed_at', c.closed_at, 'posted_at', o.posted_at, 'amount', o.amount)
      INTO v_last
    FROM public.mercury_transaction_ar_closed c
    JOIN public.mercury_transactions o ON o.id = c.mercury_transaction_id
    WHERE o.id <> p_mercury_transaction_id
      AND lower(btrim(coalesce(o.counterparty_name, ''))) = v_cp
    ORDER BY c.closed_at DESC
    LIMIT 1;
  END IF;

  SELECT coalesce(jsonb_agg(
           jsonb_build_object('id', l.id, 'name', l.name, 'default_key', l.default_key, 'account_type', l.account_type)
           ORDER BY l.sort_order, l.name
         ), '[]'::jsonb)
    INTO v_labels
  FROM public.mercury_drag_sort_labels l;

  RETURN jsonb_build_object(
    'label', v_label,
    'label_by', v_label_by,
    'label_at', v_label_at,
    'rule_name', v_rule_name,
    'pending', v_pending,
    'usual', v_usual,
    'last_close_out', v_last,
    'labels', v_labels
  );
END;
$function$;

-- ---------- set_mercury_transaction_ar_closed(uuid,text,text): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.set_mercury_transaction_ar_closed(p_mercury_transaction_id uuid, p_reason text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_note text := nullif(left(btrim(coalesce(p_note, '')), 240), '');
  v_tx public.mercury_transactions%ROWTYPE;
  v_applied numeric;
  v_now timestamptz := now();
  v_undo text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_closed: not authenticated';
  END IF;

  IF NOT (
    public.is_office_staff()
  ) THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_closed: not authorized';
  END IF;

  IF p_mercury_transaction_id IS NULL THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_closed: mercury transaction required';
  END IF;

  -- Reopen. v2.4363: a label the close-out chose comes off with it.
  IF v_reason IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.mercury_transaction_ar_closed c WHERE c.mercury_transaction_id = p_mercury_transaction_id) THEN
      v_undo := public._ar_close_label_undo(p_mercury_transaction_id);
    END IF;
    DELETE FROM public.mercury_transaction_ar_closed WHERE mercury_transaction_id = p_mercury_transaction_id;
    RETURN jsonb_build_object('ok', true, 'closed', false, 'label_undone', v_undo);
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
$function$;

-- ---------- set_mercury_transaction_ar_returned(uuid,boolean): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.set_mercury_transaction_ar_returned(p_mercury_transaction_id uuid, p_returned boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bank text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_returned: not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  ) THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_returned: not authorized';
  END IF;

  IF p_mercury_transaction_id IS NULL THEN
    RAISE EXCEPTION 'set_mercury_transaction_ar_returned: mercury transaction required';
  END IF;

  SELECT public.mercury_bank_return_reason(t.status, t.posted_at, t.amount, t.kind, t.raw->>'reasonForFailure')
  INTO v_bank
  FROM public.mercury_transactions t
  WHERE t.id = p_mercury_transaction_id;

  IF p_returned THEN
    INSERT INTO public.mercury_transaction_ar_returned AS r (mercury_transaction_id, returned, updated_by, source, opened_at, bank_reason)
    VALUES (p_mercury_transaction_id, true, auth.uid(), CASE WHEN v_bank IS NOT NULL THEN 'bank' ELSE 'hand' END, now(), nullif(v_bank, ''))
    ON CONFLICT (mercury_transaction_id) DO UPDATE SET
      returned = excluded.returned,
      updated_at = now(),
      updated_by = excluded.updated_by,
      source = coalesce(r.source, excluded.source),
      opened_at = coalesce(r.opened_at, excluded.opened_at);
  ELSE
    IF v_bank IS NOT NULL THEN
      RAISE EXCEPTION 'The bank returned this check, so it stays returned. Close it in Accounts Receivable instead.'
        USING ERRCODE = 'P0001', HINT = 'bank_returned';
    END IF;
    DELETE FROM public.mercury_transaction_ar_returned
    WHERE mercury_transaction_id = p_mercury_transaction_id;
  END IF;
END;
$function$;

-- ---------- take_returned_check_off_jobs(uuid): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.take_returned_check_off_jobs(p_mercury_transaction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pay record;
  v_res jsonb;
  v_removed integer := 0;
  v_jobs jsonb := '[]'::jsonb;
  v_label text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'take_returned_check_off_jobs: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  ) THEN
    RAISE EXCEPTION 'take_returned_check_off_jobs: not authorized';
  END IF;
  IF p_mercury_transaction_id IS NULL THEN
    RAISE EXCEPTION 'take_returned_check_off_jobs: deposit required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.mercury_transaction_ar_returned r
    WHERE r.mercury_transaction_id = p_mercury_transaction_id AND r.returned
  ) AND NOT EXISTS (
    SELECT 1 FROM public.mercury_transactions t
    WHERE t.id = p_mercury_transaction_id
      AND public.mercury_bank_return_reason(t.status, t.posted_at, t.amount, t.kind, t.raw->>'reasonForFailure') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'This check has not come back, so nothing comes off.' USING ERRCODE = 'P0001';
  END IF;

  -- Serialize with anyone else working this deposit.
  PERFORM 1 FROM public.mercury_transactions t WHERE t.id = p_mercury_transaction_id FOR UPDATE;

  FOR v_pay IN
    SELECT p.id, p.job_id, p.amount,
           coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), '') AS job_number,
           j.job_name
    FROM public.jobs_ledger_payments p
    LEFT JOIN public.jobs_ledger j ON j.id = p.job_id
    WHERE p.mercury_transaction_id = p_mercury_transaction_id
    ORDER BY p.amount DESC, p.id
  LOOP
    v_res := public.remove_jobs_ledger_payment_and_reconcile(v_pay.id);
    v_label := btrim(concat_ws(' ', CASE WHEN v_pay.job_number <> '' THEN '#' || v_pay.job_number END, v_pay.job_name));
    IF v_res IS NULL OR v_res ? 'error' THEN
      RAISE EXCEPTION '%: %', coalesce(nullif(v_label, ''), 'A job'), coalesce(v_res->>'error', 'the payment could not come off')
        USING ERRCODE = 'P0001';
    END IF;
    v_removed := v_removed + 1;
    v_jobs := v_jobs || jsonb_build_object('job_id', v_pay.job_id, 'label', v_label, 'amount', v_pay.amount, 'warning', v_res->>'warning');
  END LOOP;

  -- A hand-marked case keeps its mark; a bank return is marked by the removals above.
  INSERT INTO public.mercury_transaction_ar_returned AS r (mercury_transaction_id, returned, updated_by, source, opened_at)
  VALUES (p_mercury_transaction_id, true, auth.uid(), 'bank', now())
  ON CONFLICT (mercury_transaction_id) DO UPDATE SET returned = true, updated_at = now(), updated_by = auth.uid();

  RETURN jsonb_build_object('ok', true, 'removed', v_removed, 'jobs', v_jobs);
END;
$function$;

-- ---------- list_ar_return_cases(boolean): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.list_ar_return_cases(p_include_closed boolean DEFAULT false)
 RETURNS TABLE(mercury_transaction_id uuid, counterparty_name text, amount numeric, kind text, posted_at timestamp with time zone, failed_at timestamp with time zone, bank_reason text, source text, opened_at timestamp with time zone, closed_at timestamp with time zone, closed_reason text, closed_note text, closed_by text, replaced_by_mercury_transaction_id uuid, notified_at timestamp with time zone, live_payments jsonb, last_job jsonb, recorded_payment jsonb, promise jsonb, stripe_case jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'list_ar_return_cases: not authenticated';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
    ) THEN
      RAISE EXCEPTION 'list_ar_return_cases: not authorized';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.counterparty_name,
    abs(t.amount)::numeric,
    t.kind,
    t.posted_at,
    public._ar_try_timestamptz(t.raw->>'failedAt'),
    coalesce(r.bank_reason, nullif(btrim(t.raw->>'reasonForFailure'), '')),
    coalesce(r.source, CASE WHEN t.status = 'failed' THEN 'bank' ELSE 'hand' END),
    coalesce(r.opened_at, r.updated_at),
    r.closed_at,
    r.closed_reason,
    r.closed_note,
    (SELECT coalesce(nullif(u.name, ''), u.email) FROM public.users u WHERE u.id = r.closed_by),
    r.replaced_by_mercury_transaction_id,
    (SELECT n.notified_at FROM public.mercury_bank_return_notices n WHERE n.mercury_transaction_id = t.id),
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'payment_id', p.id,
               'job_id', p.job_id,
               'job_number', coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), ''),
               'job_name', j.job_name,
               'amount', p.amount,
               'invoice_id', p.invoice_id,
               'invoice_sequence_order', i.sequence_order,
               'invoice_status', i.status,
               'invoice_amount', i.amount,
               'stripe_bill', (nullif(btrim(coalesce(i.stripe_invoice_id, '')), '') IS NOT NULL),
               'stripe_credit_note', (nullif(btrim(coalesce(p.stripe_credit_note_id, '')), '') IS NOT NULL),
               'job_status', j.status,
               'job_revenue', j.revenue,
               'job_payments_made', j.payments_made
             ) ORDER BY p.amount DESC, p.id)
      FROM public.jobs_ledger_payments p
      LEFT JOIN public.jobs_ledger j ON j.id = p.job_id
      LEFT JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
      WHERE p.mercury_transaction_id = t.id
    ), '[]'::jsonb),
    (
      SELECT jsonb_build_object(
               'job_id', j.id,
               'job_number', coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), ''),
               'job_name', j.job_name,
               'removed_at', a.deleted_at,
               'removed_by', (SELECT coalesce(nullif(u.name, ''), u.email) FROM public.users u WHERE u.id = a.deleted_by),
               'job_revenue', j.revenue,
               'job_payments_made', j.payments_made
             )
      FROM public.deleted_records_archive a
      JOIN public.jobs_ledger j ON j.id = (a.row_data->>'job_id')::uuid
      WHERE a.table_name = 'jobs_ledger_payments'
        AND a.restored_at IS NULL
        AND (a.row_data->>'mercury_transaction_id') = t.id::text
      ORDER BY a.deleted_at DESC
      LIMIT 1
    ),
    -- A payment recorded by hand that matches a check no job carries: a rejected check, or a
    -- bank return nobody linked (Peter Garza's $2,700 on #120, Jul 2025).
    CASE WHEN NOT EXISTS (SELECT 1 FROM public.jobs_ledger_payments lp WHERE lp.mercury_transaction_id = t.id) THEN (
      SELECT jsonb_build_object(
               'payment_id', p.id,
               'job_id', p.job_id,
               'job_number', coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), ''),
               'job_name', j.job_name,
               'amount', p.amount,
               'paid_on', p.paid_on,
               'job_revenue', j.revenue,
               'job_payments_made', j.payments_made
             )
      FROM public.jobs_ledger_payments p
      LEFT JOIN public.jobs_ledger j ON j.id = p.job_id
      WHERE p.mercury_transaction_id IS NULL
        AND p.amount > 0
        AND abs(p.amount - t.amount) < 0.005
        AND p.paid_on BETWEEN (coalesce(public._ar_try_timestamptz(t.raw->>'failedAt'), t.created_at) AT TIME ZONE 'America/Chicago')::date - CASE WHEN r.source = 'rejected' THEN 3 ELSE 14 END
                          AND (coalesce(public._ar_try_timestamptz(t.raw->>'failedAt'), t.created_at) AT TIME ZONE 'America/Chicago')::date + 10
        AND NOT EXISTS (
          SELECT 1 FROM public.deleted_records_archive a2
          WHERE a2.table_name = 'jobs_ledger_payments' AND a2.restored_at IS NULL
            AND (a2.row_data->>'mercury_transaction_id') = t.id::text
        )
      ORDER BY p.paid_on, p.id
      LIMIT 1
    ) END,
    -- The newest promise the customer made after the check came back, on any job it touched.
    (
      SELECT jsonb_build_object(
               'job_id', pp.job_id,
               'promised_date', pp.promised_date,
               'said_by', pp.said_by,
               'created_at', pp.created_at
             )
      FROM public.job_payment_promises pp
      WHERE pp.voided_at IS NULL
        AND pp.created_at > coalesce(r.opened_at, r.updated_at)
        AND pp.job_id IN (
          SELECT p.job_id FROM public.jobs_ledger_payments p WHERE p.mercury_transaction_id = t.id
          UNION
          SELECT (a.row_data->>'job_id')::uuid FROM public.deleted_records_archive a
          WHERE a.table_name = 'jobs_ledger_payments' AND a.restored_at IS NULL
            AND (a.row_data->>'mercury_transaction_id') = t.id::text
        )
      ORDER BY pp.created_at DESC
      LIMIT 1
    ),
    NULL::jsonb
  FROM public.mercury_transaction_ar_returned r
  JOIN public.mercury_transactions t ON t.id = r.mercury_transaction_id
  WHERE r.returned
    AND (p_include_closed OR r.closed_at IS NULL)
  ORDER BY coalesce(r.opened_at, r.updated_at) DESC, t.id;

  -- v2.4902: a check typed in by hand that never reached the bank. The case's id stands in for the
  -- deposit; the payment, live or as the case kept it, is the recorded payment.
  RETURN QUERY
  SELECT
    c.id,
    coalesce(
      CASE WHEN j.bill_to_party = 'gc' THEN nullif(btrim(coalesce(gcc.name, '')), '') END,
      nullif(btrim(coalesce(j.customer_name, '')), ''),
      nullif(btrim(coalesce(cc.name, '')), '')
    ),
    abs(c.amount)::numeric,
    coalesce(c.payment_type, 'check'),
    NULL::timestamptz,
    NULL::timestamptz,
    NULL::text,
    'unbanked'::text,
    c.opened_at,
    c.closed_at,
    c.closed_reason,
    c.closed_note,
    (SELECT coalesce(nullif(u.name, ''), u.email) FROM public.users u WHERE u.id = c.closed_by),
    NULL::uuid,
    c.notified_at,
    '[]'::jsonb,
    NULL::jsonb,
    jsonb_build_object(
      'payment_id', c.payment_id,
      'job_id', coalesce(p.job_id, c.job_id),
      'job_number', coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), ''),
      'job_name', j.job_name,
      'amount', coalesce(p.amount, c.amount),
      'paid_on', coalesce(p.paid_on, c.paid_on),
      'reference_number', c.reference_number,
      'job_revenue', j.revenue,
      'job_payments_made', j.payments_made
    ),
    NULL::jsonb,
    NULL::jsonb
  FROM public.ar_unbanked_check_cases c
  LEFT JOIN public.jobs_ledger_payments p ON p.id = c.payment_id
  LEFT JOIN public.jobs_ledger j ON j.id = coalesce(p.job_id, c.job_id)
  LEFT JOIN public.customers cc ON cc.id = j.customer_id
  LEFT JOIN public.customers gcc ON gcc.id = j.gc_customer_id
  WHERE p_include_closed OR c.closed_at IS NULL
  ORDER BY c.opened_at DESC, c.id;

  -- v2.4950: a card dispute or a failed bank debit on a Stripe bill. The case's id stands in for
  -- the deposit; what Stripe said rides in stripe_case, the payment (a dispute's) in recorded_payment.
  RETURN QUERY
  SELECT
    c.id,
    coalesce(
      CASE WHEN j.bill_to_party = 'gc' THEN nullif(btrim(coalesce(gcc.name, '')), '') END,
      nullif(btrim(coalesce(j.customer_name, '')), ''),
      nullif(btrim(coalesce(cc.name, '')), '')
    ),
    abs(c.amount)::numeric,
    CASE WHEN c.kind = 'dispute' THEN 'card' ELSE 'bank debit' END,
    NULL::timestamptz,
    c.occurred_at,
    c.reason,
    CASE WHEN c.kind = 'dispute' THEN 'stripe_dispute' ELSE 'stripe_debit' END,
    c.opened_at,
    c.closed_at,
    c.closed_reason,
    c.closed_note,
    (SELECT coalesce(nullif(u.name, ''), u.email) FROM public.users u WHERE u.id = c.closed_by),
    NULL::uuid,
    c.notified_at,
    '[]'::jsonb,
    NULL::jsonb,
    CASE WHEN p.id IS NOT NULL THEN jsonb_build_object(
      'payment_id', p.id,
      'job_id', p.job_id,
      'job_number', coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), ''),
      'job_name', j.job_name,
      'amount', p.amount,
      'paid_on', p.paid_on,
      'job_revenue', j.revenue,
      'job_payments_made', j.payments_made
    ) END,
    (
      SELECT jsonb_build_object(
               'job_id', pp.job_id,
               'promised_date', pp.promised_date,
               'said_by', pp.said_by,
               'created_at', pp.created_at
             )
      FROM public.job_payment_promises pp
      WHERE pp.voided_at IS NULL
        AND pp.created_at > c.opened_at
        AND pp.job_id = c.job_id
      ORDER BY pp.created_at DESC
      LIMIT 1
    ),
    jsonb_build_object(
      'kind', c.kind,
      'object_id', c.stripe_object_id,
      'mode', c.stripe_mode,
      'status', c.stripe_status,
      'due_by', c.due_by,
      'lost_at', c.lost_at,
      'lost_notified_at', c.lost_notified_at,
      'amount', c.amount,
      'invoice_id', c.invoice_id,
      'invoice_sequence_order', i.sequence_order,
      'invoice_status', i.status,
      'job_id', c.job_id,
      'job_number', coalesce(nullif(j.hcp_number, ''), nullif(j.click_number, ''), ''),
      'job_name', j.job_name,
      'job_revenue', j.revenue,
      'job_payments_made', j.payments_made,
      'payment_live', p.id IS NOT NULL
    )
  FROM public.ar_stripe_cases c
  LEFT JOIN public.jobs_ledger_payments p ON p.id = c.payment_id
  LEFT JOIN public.jobs_ledger_invoices i ON i.id = c.invoice_id
  LEFT JOIN public.jobs_ledger j ON j.id = c.job_id
  LEFT JOIN public.customers cc ON cc.id = j.customer_id
  LEFT JOIN public.customers gcc ON gcc.id = j.gc_customer_id
  WHERE p_include_closed OR c.closed_at IS NULL
  ORDER BY c.opened_at DESC, c.id;
END;
$function$;

-- ---------- list_ar_return_case_fees(uuid[]): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.list_ar_return_case_fees(p_case_ids uuid[])
 RETURNS TABLE(case_id uuid, fee_amount numeric, fee_invoice_id uuid, fee_added_at timestamp with time zone, fee_added_by text, bills jsonb, fee_came_off_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'list_ar_return_case_fees: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  ) THEN
    RAISE EXCEPTION 'list_ar_return_case_fees: not authorized';
  END IF;
  IF p_case_ids IS NULL OR cardinality(p_case_ids) = 0 THEN
    RETURN;
  END IF;
  RETURN QUERY
  WITH paid AS (
    SELECT p.mercury_transaction_id AS case_id, p.invoice_id
    FROM public.jobs_ledger_payments p
    WHERE p.mercury_transaction_id = ANY (p_case_ids) AND p.invoice_id IS NOT NULL
    UNION
    SELECT (a.row_data->>'mercury_transaction_id')::uuid, (a.row_data->>'invoice_id')::uuid
    FROM public.deleted_records_archive a
    WHERE a.table_name = 'jobs_ledger_payments'
      AND a.restored_at IS NULL
      AND (a.row_data->>'mercury_transaction_id') = ANY (p_case_ids::text[])
      AND nullif(a.row_data->>'invoice_id', '') IS NOT NULL
  ), bills AS (
    SELECT pd.case_id,
           jsonb_agg(jsonb_build_object(
             'invoice_id', i.id,
             'job_id', i.job_id,
             'sequence_order', i.sequence_order,
             'status', i.status,
             'stripe', coalesce(btrim(i.stripe_invoice_id), '') <> '',
             'job_number', coalesce(nullif(btrim(j.hcp_number), ''), nullif(btrim(j.click_number), ''), ''),
             'job_name', j.job_name
           ) ORDER BY i.sequence_order, i.id) AS bills
    FROM paid pd
    JOIN public.jobs_ledger_invoices i ON i.id = pd.invoice_id
    JOIN public.jobs_ledger j ON j.id = i.job_id
    GROUP BY pd.case_id
  )
  SELECT r.mercury_transaction_id,
         r.fee_amount,
         r.fee_invoice_id,
         r.fee_added_at,
         (SELECT coalesce(nullif(u.name, ''), u.email) FROM public.users u WHERE u.id = r.fee_added_by),
         coalesce(b.bills, '[]'::jsonb),
         r.fee_came_off_at
  FROM public.mercury_transaction_ar_returned r
  LEFT JOIN bills b ON b.case_id = r.mercury_transaction_id
  WHERE r.mercury_transaction_id = ANY (p_case_ids);
END;
$function$;

-- ---------- add_ar_return_case_fee(uuid,uuid): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.add_ar_return_case_fee(p_case_id uuid, p_invoice_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_fee constant numeric := 30;
  v_case public.mercury_transaction_ar_returned%ROWTYPE;
  v_inv public.jobs_ledger_invoices%ROWTYPE;
  v_bill text;
  v_who text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  -- The tables' read-only blocks and the twin fence refuse the writes too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot add a fee.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot add a fee.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_uid AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  ) THEN
    RAISE EXCEPTION 'Only the office adds a returned check fee.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_case FROM public.mercury_transaction_ar_returned WHERE mercury_transaction_id = p_case_id FOR UPDATE;
  -- (a) An open case for a check that came back.
  IF NOT FOUND OR NOT coalesce(v_case.returned, false) OR v_case.closed_at IS NOT NULL OR coalesce(v_case.source, '') NOT IN ('bank', 'hand') THEN
    RAISE EXCEPTION 'Only an open case for a check that came back takes the fee.' USING ERRCODE = 'P0001';
  END IF;
  -- (b) Once per case.
  IF v_case.fee_added_at IS NOT NULL THEN
    RAISE EXCEPTION 'This case already has its fee.' USING ERRCODE = 'P0001';
  END IF;
  -- (b2) v2.5144: nor while a live bill still carries the case's entry (one written without the press, or a bill that
  -- came back before its case was attached again), so the $30 is never on two bills.
  IF EXISTS (
    SELECT 1
    FROM public.jobs_ledger_invoices i
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(i.fee_lines) = 'array' THEN i.fee_lines ELSE '[]'::jsonb END) AS l
    WHERE jsonb_typeof(l->'case_id') = 'string' AND btrim(l->>'case_id') = p_case_id::text
  ) THEN
    RAISE EXCEPTION 'A bill already carries this case''s fee.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_inv FROM public.jobs_ledger_invoices WHERE id = p_invoice_id FOR UPDATE;
  -- (c) The bill the check paid: a live payment of this check on it, or one taken off it.
  IF NOT FOUND OR NOT (
    EXISTS (SELECT 1 FROM public.jobs_ledger_payments p WHERE p.mercury_transaction_id = p_case_id AND p.invoice_id = p_invoice_id)
    OR EXISTS (
      SELECT 1 FROM public.deleted_records_archive a
      WHERE a.table_name = 'jobs_ledger_payments' AND a.restored_at IS NULL
        AND (a.row_data->>'mercury_transaction_id') = p_case_id::text
        AND (a.row_data->>'invoice_id') = p_invoice_id::text
    )
  ) THEN
    RAISE EXCEPTION 'That bill is not one this check paid.' USING ERRCODE = 'P0001';
  END IF;
  v_bill := 'bill ' || (coalesce(v_inv.sequence_order, 0) + 1)::text;
  -- (d) A sent Stripe invoice cannot take a line.
  IF coalesce(btrim(v_inv.stripe_invoice_id), '') <> '' THEN
    RAISE EXCEPTION 'Stripe holds %: a sent Stripe invoice cannot take a line.', initcap(v_bill) USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.jobs_ledger_invoices
  SET amount = coalesce(amount, 0) + v_fee,
      fee_lines = coalesce(fee_lines, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'description', 'Returned check fee (Tex. Bus. & Com. Code § 3.506)',
        'amount', v_fee,
        'case_id', p_case_id,
        'added_at', now()
      ))
  WHERE id = p_invoice_id;

  -- The job's total grows with the bill, as create_hazmat_fee_incident's does.
  UPDATE public.jobs_ledger
  SET revenue = coalesce(revenue, 0) + v_fee,
      updated_at = now()
  WHERE id = v_inv.job_id;

  UPDATE public.mercury_transaction_ar_returned
  SET fee_amount = v_fee,
      fee_invoice_id = p_invoice_id,
      fee_added_at = now(),
      fee_added_by = v_uid,
      fee_came_off_at = NULL,
      updated_at = now(),
      updated_by = v_uid
  WHERE mercury_transaction_id = p_case_id;

  SELECT coalesce(nullif(u.name, ''), u.email) INTO v_who FROM public.users u WHERE u.id = v_uid;
  INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  VALUES (
    v_inv.job_id, 'returned_check_fee', now(), v_uid,
    'Returned check fee: $30 added to ' || v_bill || ' (Tex. Bus. & Com. Code § 3.506)',
    jsonb_build_object('source_id', p_case_id::text, 'case_id', p_case_id::text, 'invoice_id', p_invoice_id::text, 'amount', v_fee, 'by', v_who),
    true
  );

  RETURN jsonb_build_object('ok', true, 'case_id', p_case_id, 'invoice_id', p_invoice_id, 'job_id', v_inv.job_id, 'amount', v_fee, 'bill', v_bill);
END;
$function$;

-- ---------- put_back_lost_dispute_bill(uuid): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.put_back_lost_dispute_bill(p_case_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_case public.ar_stripe_cases%ROWTYPE;
  v_pay public.jobs_ledger_payments%ROWTYPE;
  v_actor_name text;
  v_sum numeric;
  v_rev numeric;
  v_job_status text;
  v_bill_status text := NULL;
  v_status_rpc jsonb;
  v_warning text := NULL;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT * INTO v_case FROM public.ar_stripe_cases WHERE id = p_case_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'This case is not there any more.');
  END IF;
  IF v_case.kind <> 'dispute' OR v_case.closed_at IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Only an open dispute puts its bill back.');
  END IF;
  IF v_case.lost_at IS NULL THEN
    RETURN jsonb_build_object('error', 'Stripe has not decided the dispute yet. Put the bill back once the customer wins it.');
  END IF;

  SELECT * INTO v_pay FROM public.jobs_ledger_payments WHERE id = v_case.payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'The payment is already off the job.');
  END IF;

  -- Closed first, so the payment's delete trigger leaves the case as put_back.
  UPDATE public.ar_stripe_cases
  SET closed_at = now(), closed_by = auth.uid(), closed_reason = 'put_back'
  WHERE id = v_case.id;

  SELECT coalesce(nullif(trim(u.name), ''), nullif(trim(u.email), '')) INTO v_actor_name
  FROM public.users u WHERE u.id = auth.uid();

  DELETE FROM public.jobs_ledger_payments WHERE id = v_pay.id;

  INSERT INTO public.jobs_ledger_payment_events (
    kind, payment_id, from_job_id, to_job_id, invoice_id, amount, paid_on, sent_on,
    payment_type, reference_number, note, mercury_transaction_id, sequence_order,
    reason, actor_user_id, actor_name
  ) VALUES (
    'removed', v_pay.id, v_pay.job_id, NULL, v_pay.invoice_id, v_pay.amount, v_pay.paid_on, v_pay.sent_on,
    v_pay.payment_type, v_pay.reference_number, v_pay.note, v_pay.mercury_transaction_id, v_pay.sequence_order,
    'stripe_dispute_lost: ' || v_case.stripe_object_id || coalesce(' · ' || v_case.reason, ''),
    auth.uid(), v_actor_name
  );

  SELECT coalesce(sum(amount), 0) INTO v_sum FROM public.jobs_ledger_payments WHERE job_id = v_pay.job_id;
  UPDATE public.jobs_ledger SET payments_made = v_sum, updated_at = now() WHERE id = v_pay.job_id;

  -- Stripe keeps its invoice paid and cannot collect it again: the bill drops the link and is
  -- billed again with a fresh Stripe invoice. A bill that still holds another payment stays Billed.
  IF v_pay.invoice_id IS NOT NULL THEN
    v_bill_status := CASE WHEN EXISTS (SELECT 1 FROM public.jobs_ledger_payments p WHERE p.invoice_id = v_pay.invoice_id) THEN 'billed' ELSE 'ready_to_bill' END;
    UPDATE public.jobs_ledger_invoices
    SET status = v_bill_status,
        stripe_invoice_id = NULL,
        hosted_invoice_url = NULL,
        stripe_invoice_status = NULL,
        stripe_invoice_memo = NULL,
        external_send_channel = NULL,
        external_send_note = NULL,
        sent_to_customer_at = NULL
    WHERE id = v_pay.invoice_id;
  END IF;

  SELECT jl.revenue, jl.status INTO v_rev, v_job_status FROM public.jobs_ledger jl WHERE jl.id = v_pay.job_id;
  IF coalesce(v_job_status, '') = 'paid' AND coalesce(v_rev, 0) > v_sum + 0.01 THEN
    v_status_rpc := public.update_job_status(v_pay.job_id, 'billed');
    IF v_status_rpc ? 'error' THEN
      v_warning := coalesce(v_status_rpc ->> 'error', 'Could not move the job back to Billed');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'job_id', v_pay.job_id,
    'invoice_id', v_pay.invoice_id,
    'bill_status', v_bill_status,
    'amount', v_pay.amount,
    'payments_made', v_sum,
    'warning', v_warning
  );
END;
$function$;

-- ---------- close_ar_return_case(uuid,text,text,uuid): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.close_ar_return_case(p_mercury_transaction_id uuid, p_reason text, p_note text DEFAULT NULL::text, p_replaced_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'close_ar_return_case: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  ) THEN
    RAISE EXCEPTION 'close_ar_return_case: not authorized';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('replaced', 'settled_other_way', 'not_coming') THEN
    RAISE EXCEPTION 'close_ar_return_case: reason must be replaced, settled_other_way or not_coming';
  END IF;
  IF p_reason = 'replaced' AND p_replaced_by IS NULL THEN
    RAISE EXCEPTION 'close_ar_return_case: a replaced case names the new deposit';
  END IF;
  IF p_replaced_by IS NOT NULL AND p_replaced_by = p_mercury_transaction_id THEN
    RAISE EXCEPTION 'close_ar_return_case: a check cannot replace itself';
  END IF;
  IF v_note IS NOT NULL AND length(v_note) > 500 THEN
    RAISE EXCEPTION 'close_ar_return_case: the note is at most 500 characters';
  END IF;

  UPDATE public.mercury_transaction_ar_returned
  SET closed_at = now(),
      closed_by = auth.uid(),
      closed_reason = p_reason,
      closed_note = v_note,
      replaced_by_mercury_transaction_id = CASE WHEN p_reason = 'replaced' THEN p_replaced_by END
  WHERE mercury_transaction_id = p_mercury_transaction_id
    AND returned
    AND closed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This check has no open case to close.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ---------- reopen_ar_return_case(uuid): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.reopen_ar_return_case(p_mercury_transaction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'reopen_ar_return_case: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  ) THEN
    RAISE EXCEPTION 'reopen_ar_return_case: not authorized';
  END IF;
  UPDATE public.mercury_transaction_ar_returned
  SET closed_at = NULL, closed_by = NULL, closed_reason = NULL, closed_note = NULL, replaced_by_mercury_transaction_id = NULL,
      updated_at = now(), updated_by = auth.uid()
  WHERE mercury_transaction_id = p_mercury_transaction_id
    AND closed_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This check has no closed case to reopen.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ---------- close_ar_stripe_case(uuid,text,text): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.close_ar_stripe_case(p_case_id uuid, p_reason text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'close_ar_stripe_case: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  ) THEN
    RAISE EXCEPTION 'close_ar_stripe_case: not authorized';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('settled_other_way', 'not_coming') THEN
    RAISE EXCEPTION 'close_ar_stripe_case: reason must be settled_other_way or not_coming';
  END IF;
  IF v_note IS NOT NULL AND length(v_note) > 500 THEN
    RAISE EXCEPTION 'close_ar_stripe_case: the note is at most 500 characters';
  END IF;
  UPDATE public.ar_stripe_cases
  SET closed_at = now(), closed_by = auth.uid(), closed_reason = p_reason, closed_note = v_note
  WHERE id = p_case_id AND closed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This payment has no open case to close.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ---------- reopen_ar_stripe_case(uuid): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.reopen_ar_stripe_case(p_case_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'reopen_ar_stripe_case: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  ) THEN
    RAISE EXCEPTION 'reopen_ar_stripe_case: not authorized';
  END IF;
  -- Only a case the office closed reopens: Stripe's own answers and a bill put back stand.
  UPDATE public.ar_stripe_cases
  SET closed_at = NULL, closed_by = NULL, closed_reason = NULL, closed_note = NULL
  WHERE id = p_case_id AND closed_reason IN ('settled_other_way', 'not_coming');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This case cannot be opened again.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ---------- close_ar_unbanked_check_case(uuid,text,text): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.close_ar_unbanked_check_case(p_case_id uuid, p_reason text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'close_ar_unbanked_check_case: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  ) THEN
    RAISE EXCEPTION 'close_ar_unbanked_check_case: not authorized';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('settled_other_way', 'not_coming') THEN
    RAISE EXCEPTION 'close_ar_unbanked_check_case: reason must be settled_other_way or not_coming';
  END IF;
  IF v_note IS NOT NULL AND length(v_note) > 500 THEN
    RAISE EXCEPTION 'close_ar_unbanked_check_case: the note is at most 500 characters';
  END IF;
  UPDATE public.ar_unbanked_check_cases
  SET closed_at = now(), closed_by = auth.uid(), closed_reason = p_reason, closed_note = v_note
  WHERE id = p_case_id AND closed_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This check has no open case to close.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ---------- reopen_ar_unbanked_check_case(uuid): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.reopen_ar_unbanked_check_case(p_case_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'reopen_ar_unbanked_check_case: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  ) THEN
    RAISE EXCEPTION 'reopen_ar_unbanked_check_case: not authorized';
  END IF;
  -- Only a case the office closed reopens: a deposited or taken-off case has nothing left to chase.
  UPDATE public.ar_unbanked_check_cases
  SET closed_at = NULL, closed_by = NULL, closed_reason = NULL, closed_note = NULL
  WHERE id = p_case_id AND closed_reason IN ('settled_other_way', 'not_coming');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This case cannot be opened again.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ---------- get_pay_speed_transactions(): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.get_pay_speed_transactions()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH gate AS (
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (
           SELECT 1 FROM public.users u
           WHERE u.id = (SELECT auth.uid())
             AND u.role = 'master_technician'
         )
      AS ok
),
pmts AS (
  SELECT
    p.id,
    p.paid_on,
    p.sent_on,
    p.amount,
    p.payment_type,
    p.invoice_id,
    j.id AS job_id,
    j.job_name,
    j.job_address,
    -- v6: the name of whoever the bill went to (the GC on a GC-billed bill), else the job's customer.
    COALESCE(NULLIF(trim(pc.name), ''), j.customer_name) AS customer_name,
    COALESCE(
      (i.billed_at AT TIME ZONE 'America/Chicago')::date,
      i.estimated_bill_date
    ) AS billed_on,
    (x.payment_id IS NOT NULL) AS is_excluded,
    (
      p.invoice_id IS NOT NULL
      AND p.paid_on <= COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date)
      AND p.payment_type ILIKE 'hcp%'
      AND COALESCE(p.note, '') NOT LIKE '%hcp-paydate-corrected%'
      AND COALESCE(p.note, '') NOT LIKE '%hcp-payments-split%'
    ) AS is_quarantined,
    (
      p.invoice_id IS NOT NULL
      AND COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date) IS NOT NULL
      -- v5 guard: a payment before its bill's date is never measurable.
      AND p.paid_on >= COALESCE((i.billed_at AT TIME ZONE 'America/Chicago')::date, i.estimated_bill_date)
      -- v6: a GC job with no customer is measurable too (pay_speed_samples' rule).
      AND (j.customer_id IS NOT NULL OR j.gc_customer_id IS NOT NULL)
    ) AS is_linked_dated
  FROM public.jobs_ledger_payments p
  JOIN public.jobs_ledger j ON j.id = p.job_id
  LEFT JOIN public.jobs_ledger_invoices i ON i.id = p.invoice_id
  LEFT JOIN public.pay_speed_exclusions x ON x.payment_id = p.id
  LEFT JOIN public.customers pc ON pc.id = CASE
    WHEN i.id IS NOT NULL THEN public.invoice_bill_payer_customer_id(i.bill_to_party, i.bill_to_email, j.bill_to_party, j.customer_id, j.gc_customer_id)
    ELSE public.job_bill_payer_customer_id(j.bill_to_party, j.customer_id, j.gc_customer_id)
  END
  WHERE p.paid_on IS NOT NULL
    AND p.paid_on >= (public.app_today() - INTERVAL '12 months')::date
    AND p.paid_on >= (SELECT COALESCE((SELECT NULLIF(value_text, '')::date FROM public.app_settings WHERE key = 'pay_speed_no_count_date_v1'), DATE '0001-01-01'))
)
SELECT CASE WHEN NOT (SELECT ok FROM gate) THEN NULL ELSE
  jsonb_build_object(
    'payments',
    COALESCE(
      (SELECT jsonb_agg(
                jsonb_build_object(
                  'paymentId', id,
                  'paidYmd', to_char(paid_on, 'YYYY-MM-DD'),
                  'sentYmd', CASE WHEN sent_on IS NULL THEN NULL ELSE to_char(sent_on, 'YYYY-MM-DD') END,
                  'amount', amount,
                  'paymentType', payment_type,
                  'customerName', customer_name,
                  'jobId', job_id,
                  'jobName', job_name,
                  'address', job_address,
                  'invoiceId', invoice_id,
                  'billedYmd', CASE WHEN billed_on IS NULL THEN NULL ELSE to_char(billed_on, 'YYYY-MM-DD') END,
                  'gapDays', CASE WHEN billed_on IS NULL OR paid_on < billed_on THEN NULL ELSE GREATEST(0, paid_on - billed_on) END,
                  'status', CASE
                    WHEN is_excluded THEN 'excluded'
                    WHEN invoice_id IS NULL THEN 'unlinked'
                    WHEN is_quarantined THEN 'quarantined'
                    WHEN is_linked_dated THEN 'measurable'
                    ELSE 'unlinked'
                  END
                )
                ORDER BY paid_on DESC, id
              )
         FROM pmts),
      '[]'::jsonb
    ),
    'noCountDate',
    (SELECT CASE WHEN v = DATE '0001-01-01' THEN NULL ELSE to_char(v, 'YYYY-MM-DD') END
       FROM (SELECT (SELECT COALESCE((SELECT NULLIF(value_text, '')::date FROM public.app_settings WHERE key = 'pay_speed_no_count_date_v1'), DATE '0001-01-01')) AS v) s),
    'undatedInvoices',
    COALESCE(
      (SELECT jsonb_agg(
                jsonb_build_object(
                  'invoiceId', i.id,
                  'amount', i.amount,
                  'status', i.status,
                  'customerName', j.customer_name,
                  'jobId', j.id,
                  'jobName', j.job_name,
                  'address', j.job_address
                )
                ORDER BY i.created_at DESC NULLS LAST, i.id
              )
         FROM public.jobs_ledger_invoices i
         JOIN public.jobs_ledger j ON j.id = i.job_id
        WHERE i.status IN ('billed', 'paid')
          AND i.billed_at IS NULL
          AND i.estimated_bill_date IS NULL),
      '[]'::jsonb
    )
  )
END
$function$;

-- ---------- gc_review_week_status(date): the office list, without the role ----------

CREATE OR REPLACE FUNCTION public.gc_review_week_status(p_week_start date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when not exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.role = any (array['dev','master_technician','assistant','controller']::public.user_role[])
    ) then jsonb_build_object('error', 'not allowed')
    else (
      with inv_open as (
        select i.id, i.job_id, i.bill_to_party, i.bill_to_email,
          greatest(0, coalesce(i.amount, 0) - coalesce((
            select sum(p.amount) from public.jobs_ledger_payments p where p.invoice_id = i.id
          ), 0)) as remaining
        from public.jobs_ledger_invoices i
        where i.status = 'billed'
      ),
      -- v2.3811: a row counts for its GC only when the GC is the one who pays it —
      -- the modal's gcThatPaysRow / effectiveInvoiceParty rule: the job's
      -- bill_to_party (or the invoice's own pick), the GC when the job has no
      -- customer link or the customer IS the GC, never a bill addressed to a
      -- third-party email. job_bill_payer_customer_id is the job-level rule
      -- (v2.3404); the invoice pick is coalesced in front of it.
      job_rows as (
        select j.gc_customer_id, coalesce(j.revenue, 0) - coalesce(j.payments_made, 0) as remaining
        from public.jobs_ledger j
        where j.status = 'billed'
          and j.collections_at is null
          and j.gc_customer_id is not null
          and public.job_bill_payer_customer_id(j.bill_to_party, j.customer_id, j.gc_customer_id) = j.gc_customer_id
          and not exists (select 1 from inv_open o where o.job_id = j.id)
        union all
        select j.gc_customer_id, o.remaining
        from inv_open o
        join public.jobs_ledger j on j.id = o.job_id
        where j.collections_at is null
          and j.gc_customer_id is not null
          and (j.status is null or j.status in ('waiting','working','ready_to_bill','billed'))
          and nullif(btrim(coalesce(o.bill_to_email, '')), '') is null
          and public.job_bill_payer_customer_id(coalesce(o.bill_to_party, j.bill_to_party), j.customer_id, j.gc_customer_id) = j.gc_customer_id
      ),
      gc_live as (
        select gc_customer_id, sum(remaining) as live_total
        from job_rows
        group by gc_customer_id
        having sum(remaining) > 0
      ),
      latest_cert as (
        select distinct on (gc_customer_id) gc_customer_id, total
        from public.gc_review_certifications
        where week_start = p_week_start
        order by gc_customer_id, certified_at desc
      ),
      flags as (
        select g.gc_customer_id,
          (lc.total is not null and round(lc.total::numeric, 2) = round(g.live_total::numeric, 2)) as certified,
          (
            -- An app send (Draft Message, a per-GC scheduled send) this week…
            exists (
              select 1 from public.gc_statement_emails e
              where e.gc_customer_id = g.gc_customer_id
                and (e.sent_at at time zone 'America/Chicago')::date >= p_week_start
            )
            -- …or a "Sent it" round mark for this week. Only action = 'sent':
            -- 'contacted' is a conversation, not a statement; 'skipped' defers.
            or exists (
              select 1 from public.gc_statement_round_marks m
              where m.gc_customer_id = g.gc_customer_id
                and m.week_start = p_week_start
                and m.action = 'sent'
            )
          ) as sent
        from gc_live g
        left join latest_cert lc on lc.gc_customer_id = g.gc_customer_id
      )
      select jsonb_build_object(
        'gcs_outstanding', count(*),
        'gcs_certified', count(*) filter (where certified),
        'gcs_sent', count(*) filter (where sent),
        'gcs_done', count(*) filter (where certified and sent)
      )
      from flags
    )
  end;
$function$;

-- ---------- ar_stripe_cases and ar_unbanked_check_cases: the read policies, the office list without the role ----------

DROP POLICY IF EXISTS ar_stripe_cases_select_office ON public.ar_stripe_cases;
CREATE POLICY ar_stripe_cases_select_office ON public.ar_stripe_cases FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  ));

DROP POLICY IF EXISTS ar_unbanked_check_cases_select_office ON public.ar_unbanked_check_cases;
CREATE POLICY ar_unbanked_check_cases_select_office ON public.ar_unbanked_check_cases FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  ));
