SET lock_timeout = '3s';

-- Bid history PR 4 (punch list #73, to-dos/bid-history): Put back for a value. The ledger row names
-- the table, the row and the columns, and holds their old values, so one function writes an old
-- value back for every table the ledger covers. No per-tab client code.
--
-- SECURITY INVOKER, on purpose: the write runs under the caller's own policies, so a person who
-- cannot edit the bid cannot put anything back (the owner, 2026-10-08: anyone who can edit the bid
-- may Put back), and a read-only user or a digital twin is held by the same fences as any edit. The
-- trigger then records the put back as a change by the person who pressed it, tagged 'put-back'
-- (set here on the request's headers, which record_bid_change() reads through bid_change_action()).
--
-- A changed value only (op 'update'). A removed row comes back through restore_deleted_record, a
-- later PR. p_column puts back one column of the change; null puts back every column it changed.

CREATE OR REPLACE FUNCTION public.put_back_bid_change(p_change_id bigint, p_column text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c public.bid_changes%ROWTYPE;
  v_cols text[];
  v_set text;
  v_before jsonb;
  v_after jsonb;
  v_n integer;
  v_headers text;
BEGIN
  -- The ledger under the caller's policies: whoever can read the bid can read its changes.
  SELECT * INTO c FROM public.bid_changes WHERE id = p_change_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That change is not in this bid''s history.' USING ERRCODE = 'P0002';
  END IF;
  IF c.op <> 'update' THEN
    RAISE EXCEPTION 'Only a changed value can be put back. A removed row comes back another way.' USING ERRCODE = '22023';
  END IF;
  IF NOT (c.table_name = ANY (public.bid_changes_tables())) OR c.record_id IS NULL THEN
    RAISE EXCEPTION 'That change cannot be put back.' USING ERRCODE = '22023';
  END IF;
  IF p_column IS NOT NULL AND NOT (p_column = ANY (c.changed)) THEN
    RAISE EXCEPTION 'That change did not touch %.', p_column USING ERRCODE = '22023';
  END IF;

  -- The columns to write: the change's (or the one asked for), still on the table, never a key
  -- or a stamp, never a generated column.
  SELECT array_agg(a.attname::text ORDER BY a.attname) INTO v_cols
  FROM pg_attribute a
  WHERE a.attrelid = format('public.%I', c.table_name)::regclass
    AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
    AND a.attname::text = ANY (CASE WHEN p_column IS NULL THEN c.changed ELSE ARRAY[p_column] END)
    AND a.attname NOT IN ('id', 'bid_id', 'bid_version_id', 'count_row_id', 'cost_estimate_id', 'created_at', 'updated_at', 'updated_by', 'created_by');
  IF v_cols IS NULL THEN
    RAISE EXCEPTION 'That change has nothing to put back.' USING ERRCODE = '22023';
  END IF;

  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id = $1', c.table_name) INTO v_before USING c.record_id;
  IF v_before IS NULL THEN
    RAISE EXCEPTION 'That row was removed since. Put the row back first.' USING ERRCODE = 'P0002';
  END IF;

  -- The tag the trigger records: this write is a person's press, a put back.
  v_headers := COALESCE(current_setting('request.headers', true), '');
  PERFORM set_config('request.headers', (COALESCE(NULLIF(v_headers, '')::jsonb, '{}'::jsonb) || jsonb_build_object('x-bid-action', 'put-back'))::text, true);

  SELECT string_agg(format('%I = r.%I', col, col), ', ') INTO v_set FROM unnest(v_cols) AS col;
  BEGIN
    EXECUTE format('UPDATE public.%I t SET %s FROM jsonb_populate_record(NULL::public.%I, $1) r WHERE t.id = $2', c.table_name, v_set, c.table_name)
      USING c.old_values, c.record_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Another row already has that value, so it cannot be put back.' USING ERRCODE = '23505';
    WHEN foreign_key_violation THEN
      RAISE EXCEPTION 'What that value pointed to was removed, so it cannot be put back.' USING ERRCODE = '23503';
  END;
  -- The trigger has run (an AFTER ROW trigger fires within the statement): the headers go back as they were.
  PERFORM set_config('request.headers', v_headers, true);
  IF v_n = 0 THEN
    RAISE EXCEPTION 'You cannot change this bid, so nothing was put back.' USING ERRCODE = '42501';
  END IF;

  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id = $1', c.table_name) INTO v_after USING c.record_id;
  RETURN jsonb_build_object(
    'table', c.table_name,
    'record_id', c.record_id,
    'label', c.label,
    'columns', to_jsonb(v_cols),
    'before', (SELECT jsonb_object_agg(k, v_before -> k) FROM unnest(v_cols) AS k),
    'after', (SELECT jsonb_object_agg(k, v_after -> k) FROM unnest(v_cols) AS k)
  );
END;
$$;

COMMENT ON FUNCTION public.put_back_bid_change(bigint, text) IS
  'Bid history PR 4 (punch list #73): writes a ledger change''s old value back (one column, or every column it changed) under the caller''s own policies, so only someone who can edit the bid can; the trigger records it as their change, tagged put-back. Changed values only; returns the columns'' values before and after. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.put_back_bid_change(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.put_back_bid_change(bigint, text) TO authenticated;
