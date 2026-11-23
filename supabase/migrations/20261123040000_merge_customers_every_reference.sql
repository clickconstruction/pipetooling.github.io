-- v2.8324 — Merging two customer rows carries every reference to the row that goes (the last thing punch list #307
-- left: *merging customer rows that are one GC*; the owner's word, 2026-11-23: *every reference*).
--
-- merge_customers() moved ten references and then deleted the other row. Read on prod 2026-11-22 and 23, read only:
-- 46 columns point at a customer by a foreign key. The merge moved 10. 18 tables lost their rows by cascade (a
-- customer's properties, portal links, the names on permits tied to it, the GC's statement marks, its pay calendar,
-- its difficulty ratings), and 18 columns on 16 tables went null (a job's GC link, on 349 jobs, the file index on
-- 3,267 rows, sent documents, payment promises, legal matters). Five more name a customer with no foreign key: a page
-- view (public_page_views.entity_id), a legal matter's payer key ("c:" and the id, which the app finds matters by), a
-- word ask's list of GCs (gc_word_asks.gc_ids), and an open dispatch or estimator request's payload. A sweep of every
-- text key and JSON column found no other: the rest that carry a customer's id are records of what already happened
-- (the dev seat's call log, an RFI's sent-to list, a closed request), and they stay as written.
--
-- This file makes the merge move all of them. The foreign keys are read off the catalog, not listed, so a table
-- added later is carried from its first day. Where two rows may not both stand (one portal address a customer, one
-- active link an audience, one mark a week), a rule says which stands, every row a rule drops is kept in the
-- deleted-records archive, and the preview and the merge both answer with what the rules did. One case is refused:
-- both rows holding a legal matter, since a payer holds one. A last check before the delete refuses the merge if
-- anything still names the row that is going, so nothing can be lost in silence again.
--
-- 1. customer_merge_moves_only: lets three guards tell a merge's own move from an edit.
-- 2. bid_versions_lock_guard, document_builder_sends_guard, gc_difficulty_ratings_guard: each refused the move.
-- 3. customer_reference_columns: every column with a foreign key to customers, off the catalog.
-- 4. merge_customers_keyless: the five references with no foreign key, counted or moved.
-- 5. merge_customers_exceptions: the rows two customers may not both hold, one definition for preview and merge.
-- 6. merge_customers_drop: drops rows and keeps each one in the deleted-records archive.
-- 7. merge_customers_plan: what the other row holds, what the rules will do, and whether the merge may run.
-- 8. preview_merge_customers: answers with the plan beside what it answered before.
-- 9. merge_customers: moves everything, checks nothing is left, deletes, answers with the plan and what moved.
--
-- No table changes. Every function is CREATE OR REPLACE.
SET lock_timeout = '3s';

-- 1. A guard asks this to tell the merge's own move from a person's edit: the flag merge_customers sets for its
-- transaction is up, and the row differs from itself in the one named column alone. A stamp column a trigger keeps
-- (updated_at) is set aside.
CREATE OR REPLACE FUNCTION public.customer_merge_moves_only(p_old jsonb, p_new jsonb, p_column text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO ''
AS $$
  SELECT COALESCE(current_setting('app.merging_customers', true), '') = '1'
     AND (p_old -> p_column) IS DISTINCT FROM (p_new -> p_column)
     AND (p_old - p_column - 'updated_at') = (p_new - p_column - 'updated_at');
$$;
COMMENT ON FUNCTION public.customer_merge_moves_only(jsonb, jsonb, text) IS
  'True while merge_customers is moving a row to the kept customer: its transaction flag (app.merging_customers) is up and OLD and NEW differ in the named column alone. Three guards ask it so a merge can carry a locked bid version, a document send and a difficulty rating without loosening them for anyone else.';
REVOKE ALL ON FUNCTION public.customer_merge_moves_only(jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_merge_moves_only(jsonb, jsonb, text) TO service_role;

-- 2a. A bid version locked by someone else refused every change to its row, the merge's move of its customer too.
-- 20261031140000_bid_version_lock.sql word for word, with one line ahead of the lock's own rules.
CREATE OR REPLACE FUNCTION public.bid_versions_lock_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_may boolean;
  v_who text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  -- A customer merge moves the version to the kept row and changes nothing else: the lock is not touched.
  IF public.customer_merge_moves_only(to_jsonb(OLD), to_jsonb(NEW), 'customer_id') THEN RETURN NEW; END IF;
  v_may := public.bid_version_lock_may_override() OR auth.uid() = OLD.owner_user_id OR auth.uid() = OLD.locked_by;
  IF NEW.locked_by IS DISTINCT FROM OLD.locked_by THEN
    IF NOT v_may THEN
      RAISE EXCEPTION 'Only the version''s owner, a dev or a master may lock or unlock it.';
    END IF;
    IF NEW.locked_by IS NOT NULL AND NEW.locked_by <> auth.uid() AND NOT public.bid_version_lock_may_override() THEN
      RAISE EXCEPTION 'A lock is your own: it may only name you.';
    END IF;
    NEW.locked_at := CASE WHEN NEW.locked_by IS NULL THEN NULL ELSE COALESCE(NEW.locked_at, now()) END;
    SELECT u.name INTO v_who FROM public.users u WHERE u.id = auth.uid();
    INSERT INTO public.bids_submission_entries (bid_id, notes, created_by)
    VALUES (NEW.bid_id,
            format('%s %s the version "%s"%s', COALESCE(NULLIF(v_who, ''), 'Someone'), CASE WHEN NEW.locked_by IS NULL THEN 'unlocked' ELSE 'locked' END, NEW.name,
                   CASE WHEN NEW.locked_by IS NULL AND OLD.locked_by <> auth.uid() THEN ' that someone else held' ELSE '' END),
            auth.uid());
    RETURN NEW;
  END IF;
  -- A version locked by someone else: its own row (name, letter, star, owner) is theirs too.
  IF OLD.locked_by IS NOT NULL AND OLD.locked_by <> auth.uid() AND NOT public.bid_version_lock_may_override() THEN
    RAISE EXCEPTION '%', public.bid_version_lock_refusal(OLD.id);
  END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id AND NOT v_may THEN
    RAISE EXCEPTION 'Only the version''s owner, a dev or a master may hand it to someone else.';
  END IF;
  RETURN NEW;
END;
$$;

-- 2b. A document send is changed only by taking it off. The merge's move of its customer is neither.
-- 20261120034225_document_builder_sheets.sql word for word, with the same one line.
CREATE OR REPLACE FUNCTION public.document_builder_sends_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- A customer merge moves the send to the kept row and changes nothing else.
  IF public.customer_merge_moves_only(to_jsonb(OLD), to_jsonb(NEW), 'customer_id') THEN
    RETURN NEW;
  END IF;
  IF OLD.taken_off_at IS NOT NULL THEN
    RAISE EXCEPTION 'This send was taken off the page already.' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.taken_off_at IS NULL THEN
    RAISE EXCEPTION 'A send is changed only by sending again.' USING ERRCODE = 'P0001';
  END IF;
  -- Only the taking off lands. Every other column stays as it was.
  NEW := OLD;
  NEW.taken_off_at := now();
  NEW.taken_off_by := auth.uid();
  RETURN NEW;
END;
$$;

-- 2c. A rating is never changed. The merge changes none: it moves every rating of the row that goes to the kept
-- row, where the newest still stands and every one is still kept.
-- 20261115010000_gc_difficulty_pick_reasons.sql word for word, with the same one line.
CREATE OR REPLACE FUNCTION public.gc_difficulty_ratings_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_body jsonb;
  v_status text;
  v_version integer;
  v_key text;
  v_points jsonb;
  v_scale jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- A customer merge moves the rating to the kept row and changes nothing else.
    IF public.customer_merge_moves_only(to_jsonb(OLD), to_jsonb(NEW), 'customer_id') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'A rating is never changed. Save a new rating; the newest stands and every one is kept.' USING ERRCODE = 'check_violation';
  END IF;

  NEW.note := btrim(COALESCE(NEW.note, ''));
  NEW.rated_at := now();
  NEW.created_at := now();
  NEW.pick_reasons := COALESCE(NEW.pick_reasons, '{}'::jsonb);
  IF v_uid IS NOT NULL THEN
    NEW.rated_by := v_uid;
    NEW.rated_by_name := COALESCE((SELECT u.name FROM public.users u WHERE u.id = v_uid), '');
  END IF;

  SELECT v.body, v.status, v.version INTO v_body, v_status, v_version
  FROM public.difficulty_criteria_versions v WHERE v.id = NEW.criteria_version_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'The criteria version is not there. Reload and rate again.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_status <> 'published' THEN
    RAISE EXCEPTION 'A rating is made under a published version, not a draft.' USING ERRCODE = 'check_violation';
  END IF;

  FOR v_key, v_points IN SELECT key, value FROM jsonb_each(NEW.picks) LOOP
    IF jsonb_typeof(v_points) <> 'number' THEN
      RAISE EXCEPTION 'The pick for % is not a number of points.', v_key USING ERRCODE = 'check_violation';
    END IF;
    SELECT s INTO v_scale FROM jsonb_array_elements(v_body->'scales') s WHERE s->>'key' = v_key;
    IF v_scale IS NULL THEN
      RAISE EXCEPTION 'Version % has no scale %.', v_version, v_key USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(v_scale->'rungs', '[]'::jsonb)) r WHERE (r->'points') = v_points)
       AND NOT (v_scale->>'source' = 'bills' AND jsonb_array_length(COALESCE(v_scale->'rungs', '[]'::jsonb)) = 0 AND (v_points)::text::numeric BETWEEN 0 AND COALESCE((v_scale->>'max')::numeric, 0)) THEN
      RAISE EXCEPTION 'Version % has no % point rung on %.', v_version, v_points::text, v_key USING ERRCODE = 'check_violation';
    END IF;
    -- A bills scale's point says what it rests on.
    IF v_scale->>'source' = 'bills' AND btrim(COALESCE(NEW.pick_reasons->>v_key, '')) = '' THEN
      RAISE EXCEPTION 'The % point needs its words: read from the bills, or by hand with a reason.', v_key USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  FOR v_key IN SELECT key FROM jsonb_each(NEW.pick_reasons) LOOP
    IF NEW.picks->v_key IS NULL THEN
      RAISE EXCEPTION 'Words for % name a pick that is not there.', v_key USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- 3. Every column with a foreign key to customers, read off the catalog, so a table added tomorrow is on the list.
CREATE OR REPLACE FUNCTION public.customer_reference_columns()
RETURNS TABLE (tbl regclass, col name, key text)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT c.conrelid::regclass, a.attname, c.conrelid::regclass::text || '.' || a.attname::text
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
  WHERE c.contype = 'f'
    AND c.confrelid = 'public.customers'::regclass
    AND array_length(c.conkey, 1) = 1
  ORDER BY 3;
$$;
COMMENT ON FUNCTION public.customer_reference_columns() IS
  'Every column with a foreign key to customers, off the catalog, with its key as table.column. merge_customers moves each one and checks each one before it deletes, so a table added later is carried by the merge without being named.';
REVOKE ALL ON FUNCTION public.customer_reference_columns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_reference_columns() TO service_role;

-- 4. The references with no foreign key, counted (p_apply false) or moved (true), so the preview and the merge read
-- one list. An id is no other row's, so a value that holds the row's id names that row and no other.
CREATE OR REPLACE FUNCTION public.merge_customers_keyless(p_survivor uuid, p_victim uuid, p_apply boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_out jsonb := '{}'::jsonb;
  v_n bigint;
  v_from text := p_victim::text;
  v_to text := p_survivor::text;
BEGIN
  -- A page view names the customer whose page it was, on every surface that shows one.
  IF p_apply THEN
    UPDATE public.public_page_views SET entity_id = p_survivor WHERE entity_id = p_victim;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSE
    SELECT count(*) INTO v_n FROM public.public_page_views WHERE entity_id = p_victim;
  END IF;
  IF v_n > 0 THEN v_out := v_out || jsonb_build_object('public_page_views.entity_id', v_n); END IF;

  -- A legal matter is keyed by its payer, "c:" and the customer's id, and the app finds a customer's matter by that
  -- key. A payer holds one matter: when both rows hold one the merge is refused before this runs (legal_blocked).
  IF p_apply THEN
    UPDATE public.legal_matters SET payer_key = 'c:' || v_to WHERE payer_key = 'c:' || v_from;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSE
    SELECT count(*) INTO v_n FROM public.legal_matters WHERE payer_key = 'c:' || v_from;
  END IF;
  IF v_n > 0 THEN v_out := v_out || jsonb_build_object('legal_matters.payer_key', v_n); END IF;

  -- A word ask lists the GCs it asks about. The kept customer is listed once.
  IF p_apply THEN
    UPDATE public.gc_word_asks
       SET gc_ids = CASE WHEN p_survivor = ANY (gc_ids) THEN array_remove(gc_ids, p_victim) ELSE array_replace(gc_ids, p_victim, p_survivor) END
     WHERE p_victim = ANY (gc_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSE
    SELECT count(*) INTO v_n FROM public.gc_word_asks WHERE p_victim = ANY (gc_ids);
  END IF;
  IF v_n > 0 THEN v_out := v_out || jsonb_build_object('gc_word_asks.gc_ids', v_n); END IF;

  -- An open request carries what it will make once it is approved. A closed one is a record of what was asked, and it
  -- stays as it was written.
  IF p_apply THEN
    UPDATE public.dispatch_requests SET pending_payload = replace(pending_payload::text, v_from, v_to)::jsonb
     WHERE status = 'open' AND strpos(pending_payload::text, v_from) > 0;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSE
    SELECT count(*) INTO v_n FROM public.dispatch_requests WHERE status = 'open' AND strpos(pending_payload::text, v_from) > 0;
  END IF;
  IF v_n > 0 THEN v_out := v_out || jsonb_build_object('dispatch_requests.pending_payload', v_n); END IF;

  IF p_apply THEN
    UPDATE public.estimator_requests SET pending_payload = replace(pending_payload::text, v_from, v_to)::jsonb
     WHERE status = 'open' AND strpos(pending_payload::text, v_from) > 0;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSE
    SELECT count(*) INTO v_n FROM public.estimator_requests WHERE status = 'open' AND strpos(pending_payload::text, v_from) > 0;
  END IF;
  IF v_n > 0 THEN v_out := v_out || jsonb_build_object('estimator_requests.pending_payload', v_n); END IF;

  RETURN v_out;
END;
$$;
COMMENT ON FUNCTION public.merge_customers_keyless(uuid, uuid, boolean) IS
  'The references to a customer with no foreign key: a page view, a legal matter''s payer key (c:<id>), a word ask''s gc_ids, and an open dispatch or estimator request''s pending_payload. Counts them, or with p_apply moves them to the kept customer, by table.column. A closed request is a record and stays as written.';
REVOKE ALL ON FUNCTION public.merge_customers_keyless(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_customers_keyless(uuid, uuid, boolean) TO service_role;

-- 5. The rows a merge cannot simply move, because two may not both stand. One definition, read by the preview and
-- acted on by the merge. row_id is the row the rule acts on, which for a week's mark and an ask's answer is the
-- older of the two and may be the kept customer's own. detail is the portal address that stops answering, the
-- audience of a link, the week of a mark, or the property a folded property goes into.
CREATE OR REPLACE FUNCTION public.merge_customers_exceptions(p_survivor uuid, p_victim uuid)
RETURNS TABLE (what text, row_id uuid, detail text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- One row a customer: the kept customer's own stands and the other's is dropped.
  SELECT 'followup_prefs'::text, v.customer_id, NULL::text
    FROM public.customer_followup_prefs v
   WHERE v.customer_id = p_victim
     AND EXISTS (SELECT 1 FROM public.customer_followup_prefs s WHERE s.customer_id = p_survivor)
  UNION ALL
  SELECT 'portal_address', v.customer_id, v.slug
    FROM public.customer_portal_slugs v
   WHERE v.customer_id = p_victim
     AND EXISTS (SELECT 1 FROM public.customer_portal_slugs s WHERE s.customer_id = p_survivor)
  UNION ALL
  SELECT 'pay_calendar', v.id, NULL
    FROM public.payer_pay_calendars v
   WHERE v.payer_customer_id = p_victim
     AND EXISTS (SELECT 1 FROM public.payer_pay_calendars s WHERE s.payer_customer_id = p_survivor AND s.job_id IS NOT DISTINCT FROM v.job_id)
  UNION ALL
  -- One active portal link an audience: the kept customer's stands. The other's is turned off and kept as history.
  SELECT 'portal_link', v.id, v.audience
    FROM public.customer_portal_links v
   WHERE v.customer_id = p_victim AND v.revoked_at IS NULL
     AND EXISTS (SELECT 1 FROM public.customer_portal_links s WHERE s.customer_id = p_survivor AND s.audience = v.audience AND s.revoked_at IS NULL)
  UNION ALL
  -- One mark a week and one answer an ask: the newer word stands, whichever row it was on.
  SELECT 'week_mark', CASE WHEN v.acted_at > s.acted_at THEN s.id ELSE v.id END, v.week_start::text
    FROM public.gc_statement_round_marks v
    JOIN public.gc_statement_round_marks s ON s.week_start = v.week_start AND s.gc_customer_id = p_survivor
   WHERE v.gc_customer_id = p_victim
  UNION ALL
  SELECT 'ask_answer', CASE WHEN v.answered_at > s.answered_at THEN s.id ELSE v.id END, NULL
    FROM public.gc_word_ask_answers v
    JOIN public.gc_word_ask_answers s ON s.ask_id = v.ask_id AND s.gc_customer_id = p_survivor
   WHERE v.gc_customer_id = p_victim
  UNION ALL
  -- One line a customer on a bid: where the kept customer is on the bid already, the other's line is the duplicate.
  SELECT 'bid_recipient', v.id, NULL
    FROM public.bid_gc_recipients v
   WHERE v.customer_id = p_victim
     AND EXISTS (SELECT 1 FROM public.bid_gc_recipients s WHERE s.bid_id = v.bid_id AND s.customer_id = p_survivor)
  UNION ALL
  SELECT 'bid_gc_line', v.id, NULL
    FROM public.bid_gcs v
   WHERE v.customer_id = p_victim
     AND EXISTS (SELECT 1 FROM public.bid_gcs s WHERE s.bid_id = v.bid_id AND s.customer_id = p_survivor)
  UNION ALL
  -- One open proposal room a customer on a bid: the other's is closed and kept.
  SELECT 'proposal_room', v.id, NULL
    FROM public.bid_proposal_rooms v
   WHERE v.customer_id = p_victim AND v.closed_at IS NULL
     AND EXISTS (SELECT 1 FROM public.bid_proposal_rooms s WHERE s.bid_id = v.bid_id AND s.customer_id = p_survivor AND s.closed_at IS NULL)
  UNION ALL
  -- One live send of a document to a customer: the other's is taken off and kept. A send to a company is keyed by
  -- the company and is not in the way.
  SELECT 'document_send', v.id, NULL
    FROM public.document_builder_sends v
   WHERE v.customer_id = p_victim AND v.company_id IS NULL AND v.taken_off_at IS NULL
     AND EXISTS (
       SELECT 1 FROM public.document_builder_sends s
        WHERE s.customer_id = p_survivor AND s.company_id IS NULL AND s.taken_off_at IS NULL
          AND s.builder_key = v.builder_key AND s.sheet_id IS NOT DISTINCT FROM v.sheet_id)
  UNION ALL
  -- A property both rows spell the same way, where the other row's copy adds nothing the kept one lacks: the copy is
  -- folded into the kept one. Any other property moves as it is, so no legal record is ever dropped.
  SELECT 'property', v.id, s.id::text
    FROM public.customer_addresses v
    JOIN LATERAL (
      SELECT k.* FROM public.customer_addresses k
       WHERE k.customer_id = p_survivor
         AND lower(regexp_replace(btrim(k.address), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(v.address), '\s+', ' ', 'g'))
       ORDER BY k.is_primary DESC, k.sequence_order, k.created_at
       LIMIT 1
    ) s ON true
   WHERE v.customer_id = p_victim
     AND NOT EXISTS (
       SELECT 1
         FROM jsonb_each(to_jsonb(v) - ARRAY['id', 'customer_id', 'address', 'is_primary', 'sequence_order', 'created_at', 'updated_at']) e
        WHERE e.value NOT IN ('null'::jsonb, '""'::jsonb, 'false'::jsonb)
          AND e.value IS DISTINCT FROM (to_jsonb(s) -> e.key)
     );
$$;
COMMENT ON FUNCTION public.merge_customers_exceptions(uuid, uuid) IS
  'The rows a customer merge cannot simply move because two may not both stand: a second follow-up setting, portal address or pay calendar (dropped), a second active portal link, open proposal room or live document send (turned off, closed or taken off, and kept), the older of two marks for a week or answers to an ask (dropped), a duplicate line on a bid (dropped), and a property the kept customer already holds whole (folded into it). One definition for preview_merge_customers and merge_customers.';
REVOKE ALL ON FUNCTION public.merge_customers_exceptions(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_customers_exceptions(uuid, uuid) TO service_role;

-- 6. Drops rows a rule says go, and keeps each one in the deleted-records archive first, in the bundle of the customer
-- row that goes (its group_key, the same one archive_deleted_record gives that row). A dev reads or restores them there.
CREATE OR REPLACE FUNCTION public.merge_customers_drop(p_table regclass, p_key name, p_ids uuid[], p_group uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_n bigint;
BEGIN
  IF p_ids IS NULL OR cardinality(p_ids) = 0 THEN
    RETURN 0;
  END IF;
  EXECUTE format(
    'INSERT INTO public.deleted_records_archive (table_name, record_id, group_key, row_data, deleted_by) '
    || 'SELECT %L, t.%I::text, $2, to_jsonb(t), auth.uid() FROM %s t WHERE t.%I = ANY ($1)',
    (SELECT c.relname FROM pg_catalog.pg_class c WHERE c.oid = p_table), p_key, p_table, p_key)
  USING p_ids, p_group::text;
  EXECUTE format('DELETE FROM %s WHERE %I = ANY ($1)', p_table, p_key) USING p_ids;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
COMMENT ON FUNCTION public.merge_customers_drop(regclass, name, uuid[], uuid) IS
  'Deletes the rows of p_table whose p_key is in p_ids, keeping each first in deleted_records_archive under the group key of the customer a merge removes. Only merge_customers calls it.';
REVOKE ALL ON FUNCTION public.merge_customers_drop(regclass, name, uuid[], uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_customers_drop(regclass, name, uuid[], uuid) TO service_role;

-- 7. What the other row holds, what the rules will do, and the one thing that stops a merge.
CREATE OR REPLACE FUNCTION public.merge_customers_plan(p_survivor uuid, p_victim uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ref record;
  v_n bigint;
  v_holds jsonb := '{}'::jsonb;
  v_left jsonb;
  v_same_job bigint;
  v_address text;
  v_legal boolean;
BEGIN
  FOR v_ref IN SELECT * FROM public.customer_reference_columns() LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', v_ref.tbl, v_ref.col) INTO v_n USING p_victim;
    IF v_n > 0 THEN
      v_holds := v_holds || jsonb_build_object(v_ref.key, v_n);
    END IF;
  END LOOP;
  v_holds := v_holds || public.merge_customers_keyless(p_survivor, p_victim, false);

  SELECT COALESCE(jsonb_object_agg(x.what, x.n), '{}'::jsonb) INTO v_left
    FROM (SELECT e.what, count(*) AS n FROM public.merge_customers_exceptions(p_survivor, p_victim) e GROUP BY e.what) x;
  SELECT e.detail INTO v_address FROM public.merge_customers_exceptions(p_survivor, p_victim) e WHERE e.what = 'portal_address' LIMIT 1;

  -- A job that names one of the two as its customer and the other as its GC. A job never names one row as both, so
  -- after the merge it names the GC alone and bills the GC (jobs_ledger_customer_gc_distinct).
  SELECT count(*) INTO v_same_job FROM public.jobs_ledger j
   WHERE (j.customer_id = p_victim AND j.gc_customer_id = p_survivor)
      OR (j.customer_id = p_survivor AND j.gc_customer_id = p_victim);

  -- A payer holds one legal matter (legal_matters_payer_key_key). Two rows that each hold one cannot be merged.
  v_legal := EXISTS (SELECT 1 FROM public.legal_matters WHERE payer_key = 'c:' || p_victim::text)
         AND EXISTS (SELECT 1 FROM public.legal_matters WHERE payer_key = 'c:' || p_survivor::text);

  RETURN jsonb_build_object('holds', v_holds, 'left_behind', v_left, 'portal_address_lost', v_address,
                            'same_job', v_same_job, 'legal_blocked', v_legal);
END;
$$;
COMMENT ON FUNCTION public.merge_customers_plan(uuid, uuid) IS
  'What a customer merge would do, counted and not done: holds (rows on the row that goes, by table.column, every foreign key to customers and the five references with none), left_behind (rows by rule, from merge_customers_exceptions), portal_address_lost (the address that stops answering), same_job (jobs naming the two as customer and GC) and legal_blocked (both rows hold a legal matter, so the merge is refused). The preview answers with it and the merge answers with the one it read before moving anything.';
REVOKE ALL ON FUNCTION public.merge_customers_plan(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_customers_plan(uuid, uuid) TO service_role;

-- 8. The preview: what it answered before, and the plan beside it.
CREATE OR REPLACE FUNCTION public.preview_merge_customers(p_survivor uuid, p_victim uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_survivor public.customers%ROWTYPE;
  v_victim public.customers%ROWTYPE;
  v_bites int;
  v_jobs int;
  v_est int;
  v_proj int;
  v_cont int;
  v_persons int;
  v_victim_stripe boolean;
  v_survivor_stripe boolean;
  v_stripe_blocked boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_survivor IS NULL OR p_victim IS NULL OR p_survivor = p_victim THEN
    RAISE EXCEPTION 'Invalid customer pair';
  END IF;

  SELECT * INTO v_survivor FROM public.customers WHERE id = p_survivor FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Survivor customer not found';
  END IF;
  SELECT * INTO v_victim FROM public.customers WHERE id = p_victim FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Victim customer not found';
  END IF;

  PERFORM public.assert_caller_can_merge_customer_pair(v_survivor.master_user_id, v_victim.master_user_id);

  v_survivor_stripe := v_survivor.stripe_customer_id IS NOT NULL AND trim(v_survivor.stripe_customer_id) <> '';
  v_victim_stripe := v_victim.stripe_customer_id IS NOT NULL AND trim(v_victim.stripe_customer_id) <> '';
  v_stripe_blocked := v_survivor_stripe AND v_victim_stripe
    AND trim(v_survivor.stripe_customer_id) IS DISTINCT FROM trim(v_victim.stripe_customer_id);

  SELECT count(*)::int INTO v_bites FROM public.bids WHERE customer_id = p_victim;
  SELECT count(*)::int INTO v_jobs FROM public.jobs_ledger WHERE customer_id = p_victim;
  SELECT count(*)::int INTO v_est FROM public.estimates WHERE customer_id = p_victim;
  SELECT count(*)::int INTO v_proj FROM public.projects WHERE customer_id = p_victim;
  SELECT count(*)::int INTO v_cont FROM public.customer_contacts WHERE customer_id = p_victim;
  SELECT count(*)::int INTO v_persons FROM public.customer_contact_persons WHERE customer_id = p_victim;

  RETURN jsonb_build_object(
    'victim_counts', jsonb_build_object(
      'bids', v_bites,
      'jobs_ledger', v_jobs,
      'estimates', v_est,
      'projects', v_proj,
      'customer_contacts', v_cont,
      'customer_contact_persons', v_persons
    ),
    'victim_has_stripe', v_victim_stripe,
    'survivor_has_stripe', v_survivor_stripe,
    'stripe_blocked', v_stripe_blocked
  ) || public.merge_customers_plan(p_survivor, p_victim);
END;
$$;

-- 9. The merge. Its checks, its field choices, its Stripe rule and its contacts fold are 20261013010000's word for
-- word. The nine statements that moved the references it knew are now one loop over all of them.
CREATE OR REPLACE FUNCTION public.merge_customers(p_survivor uuid, p_victim uuid, p_field_choices jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_survivor public.customers%ROWTYPE;
  v_victim public.customers%ROWTYPE;
  v_src_name text;
  v_src_address text;
  v_src_contact jsonb;
  v_src_type text;
  v_src_date_met date;
  v_src_master uuid;
  v_src_google_drive_link text;
  v_src_job_pictures_link text;
  v_survivor_stripe boolean;
  v_victim_stripe boolean;
  v_choice text;
  v_victim_thread uuid;
  v_survivor_thread uuid;
  v_plan jsonb;
  v_rules jsonb;
  v_ref record;
  v_rows bigint;
  v_moved jsonb := '{}'::jsonb;
  v_left jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_survivor IS NULL OR p_victim IS NULL OR p_survivor = p_victim THEN
    RAISE EXCEPTION 'Invalid customer pair';
  END IF;

  SELECT * INTO v_survivor FROM public.customers WHERE id = p_survivor FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Survivor customer not found';
  END IF;
  SELECT * INTO v_victim FROM public.customers WHERE id = p_victim FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Victim customer not found';
  END IF;

  PERFORM public.assert_caller_can_merge_customer_pair(v_survivor.master_user_id, v_victim.master_user_id);

  v_survivor_stripe := v_survivor.stripe_customer_id IS NOT NULL AND trim(v_survivor.stripe_customer_id) <> '';
  v_victim_stripe := v_victim.stripe_customer_id IS NOT NULL AND trim(v_victim.stripe_customer_id) <> '';
  IF v_survivor_stripe AND v_victim_stripe
     AND trim(v_survivor.stripe_customer_id) IS DISTINCT FROM trim(v_victim.stripe_customer_id) THEN
    RAISE EXCEPTION 'Both customers have different Stripe customer ids; resolve in Stripe before merging';
  END IF;

  v_choice := lower(coalesce(p_field_choices->>'name', 'survivor'));
  IF v_choice = 'victim' THEN v_src_name := v_victim.name; ELSE v_src_name := v_survivor.name; END IF;

  v_choice := lower(coalesce(p_field_choices->>'address', 'survivor'));
  IF v_choice = 'victim' THEN v_src_address := v_victim.address; ELSE v_src_address := v_survivor.address; END IF;

  v_choice := lower(coalesce(p_field_choices->>'contact_info', 'survivor'));
  IF v_choice = 'victim' THEN
    v_src_contact := to_jsonb(v_victim.contact_info);
  ELSE
    v_src_contact := to_jsonb(v_survivor.contact_info);
  END IF;

  v_choice := lower(coalesce(p_field_choices->>'customer_type', 'survivor'));
  IF v_choice = 'victim' THEN v_src_type := v_victim.customer_type; ELSE v_src_type := v_survivor.customer_type; END IF;

  v_choice := lower(coalesce(p_field_choices->>'date_met', 'survivor'));
  IF v_choice = 'victim' THEN v_src_date_met := v_victim.date_met; ELSE v_src_date_met := v_survivor.date_met; END IF;

  v_choice := lower(coalesce(p_field_choices->>'master_user_id', 'survivor'));
  IF v_choice = 'victim' THEN v_src_master := v_victim.master_user_id; ELSE v_src_master := v_survivor.master_user_id; END IF;

  v_choice := lower(coalesce(p_field_choices->>'google_drive_link', 'survivor'));
  IF v_choice = 'victim' THEN v_src_google_drive_link := v_victim.google_drive_link; ELSE v_src_google_drive_link := v_survivor.google_drive_link; END IF;

  v_choice := lower(coalesce(p_field_choices->>'job_pictures_link', 'survivor'));
  IF v_choice = 'victim' THEN v_src_job_pictures_link := v_victim.job_pictures_link; ELSE v_src_job_pictures_link := v_survivor.job_pictures_link; END IF;

  -- What the row that goes holds and what the rules will do, read before anything moves: the same answer the
  -- preview gave, and the one this function hands back.
  v_plan := public.merge_customers_plan(p_survivor, p_victim);
  IF (v_plan->>'legal_blocked')::boolean THEN
    RAISE EXCEPTION 'Both customers have a legal matter, and one payer can hold only one. Ask a dev to join the two matters, then merge.';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('what', e.what, 'id', e.row_id, 'detail', e.detail)), '[]'::jsonb) INTO v_rules
    FROM public.merge_customers_exceptions(p_survivor, p_victim) e;

  -- Transaction-local flag: lets estimates_protect_after_accept allow the customer_id re-link for accepted
  -- estimates, and three more guards allow the move alone (customer_merge_moves_only). Lowered before the return.
  PERFORM set_config('app.merging_customers', '1', true);

  -- Where two rows may not both stand: one definition (merge_customers_exceptions), acted on here. Every row dropped
  -- is kept in the deleted-records archive with the customer row that goes.
  PERFORM public.merge_customers_drop('public.customer_followup_prefs', 'customer_id',
    ARRAY(SELECT (x->>'id')::uuid FROM jsonb_array_elements(v_rules) x WHERE x->>'what' = 'followup_prefs'), p_victim);
  PERFORM public.merge_customers_drop('public.customer_portal_slugs', 'customer_id',
    ARRAY(SELECT (x->>'id')::uuid FROM jsonb_array_elements(v_rules) x WHERE x->>'what' = 'portal_address'), p_victim);
  PERFORM public.merge_customers_drop('public.payer_pay_calendars', 'id',
    ARRAY(SELECT (x->>'id')::uuid FROM jsonb_array_elements(v_rules) x WHERE x->>'what' = 'pay_calendar'), p_victim);
  PERFORM public.merge_customers_drop('public.gc_statement_round_marks', 'id',
    ARRAY(SELECT (x->>'id')::uuid FROM jsonb_array_elements(v_rules) x WHERE x->>'what' = 'week_mark'), p_victim);
  PERFORM public.merge_customers_drop('public.gc_word_ask_answers', 'id',
    ARRAY(SELECT (x->>'id')::uuid FROM jsonb_array_elements(v_rules) x WHERE x->>'what' = 'ask_answer'), p_victim);
  PERFORM public.merge_customers_drop('public.bid_gc_recipients', 'id',
    ARRAY(SELECT (x->>'id')::uuid FROM jsonb_array_elements(v_rules) x WHERE x->>'what' = 'bid_recipient'), p_victim);
  PERFORM public.merge_customers_drop('public.bid_gcs', 'id',
    ARRAY(SELECT (x->>'id')::uuid FROM jsonb_array_elements(v_rules) x WHERE x->>'what' = 'bid_gc_line'), p_victim);
  UPDATE public.customer_portal_links SET revoked_at = now()
   WHERE id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(v_rules) x WHERE x->>'what' = 'portal_link');
  UPDATE public.bid_proposal_rooms SET closed_at = now()
   WHERE id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(v_rules) x WHERE x->>'what' = 'proposal_room');
  UPDATE public.document_builder_sends SET taken_off_at = now()
   WHERE id IN (SELECT (x->>'id')::uuid FROM jsonb_array_elements(v_rules) x WHERE x->>'what' = 'document_send');

  -- Properties. The kept customer keeps its own primary, so the other's is un-starred before it moves. A property the
  -- kept customer already holds whole is folded into it: whatever named the copy (a job, an owner record request,
  -- read off the catalog) names the kept one, and then the copy goes to the archive. Every other property moves in
  -- the loop below with its legal record.
  UPDATE public.customer_addresses SET is_primary = false, updated_at = now() WHERE customer_id = p_victim AND is_primary;
  FOR v_ref IN
    SELECT c.conrelid::regclass AS tbl, a.attname AS col
      FROM pg_catalog.pg_constraint c
      JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND c.confrelid = 'public.customer_addresses'::regclass AND array_length(c.conkey, 1) = 1
  LOOP
    EXECUTE format('UPDATE %s t SET %I = (x->>''detail'')::uuid FROM jsonb_array_elements($1) x WHERE x->>''what'' = ''property'' AND t.%I = (x->>''id'')::uuid',
                   v_ref.tbl, v_ref.col, v_ref.col) USING v_rules;
  END LOOP;
  PERFORM public.merge_customers_drop('public.customer_addresses', 'id',
    ARRAY(SELECT (x->>'id')::uuid FROM jsonb_array_elements(v_rules) x WHERE x->>'what' = 'property'), p_victim);

  -- Messages (20261012010000): the contacts on the victim's row, and their threads, go to the survivor. A contact of
  -- the same name on both rows is folded, which the loop below could not do.
  FOR v_victim_thread IN SELECT id FROM public.contacts WHERE customer_id = p_victim LOOP
    SELECT s.id INTO v_survivor_thread
    FROM public.contacts s JOIN public.contacts v ON v.id = v_victim_thread
    WHERE s.customer_id = p_survivor AND lower(btrim(coalesce(s.name, ''))) = lower(btrim(coalesce(v.name, '')));
    IF v_survivor_thread IS NULL THEN
      UPDATE public.contacts SET customer_id = p_survivor WHERE id = v_victim_thread;
    ELSE
      PERFORM public.contacts_fold(v_victim_thread, v_survivor_thread);
    END IF;
  END LOOP;

  -- Every reference, by the catalog. A table this function has never heard of is moved like the rest. One that lets a
  -- customer hold a single row, and has no rule above, stops the merge here with its name, and nothing is changed.
  FOR v_ref IN SELECT * FROM public.customer_reference_columns() LOOP
    BEGIN
      EXECUTE format('UPDATE %s SET %I = $1 WHERE %I = $2', v_ref.tbl, v_ref.col, v_ref.col) USING p_survivor, p_victim;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'The merge cannot carry % for both customers: only one of them may hold it. Nothing was changed.', v_ref.key;
    END;
    IF v_rows > 0 THEN
      v_moved := v_moved || jsonb_build_object(v_ref.key, v_rows);
    END IF;
  END LOOP;

  -- The references with no foreign key.
  v_moved := v_moved || public.merge_customers_keyless(p_survivor, p_victim, true);

  -- After the properties moved, so a chosen address finds its own row and stars it (customer_address_sync_from_customer).
  UPDATE public.customers
  SET
    name = v_src_name,
    address = v_src_address,
    contact_info = v_src_contact,
    customer_type = v_src_type,
    date_met = v_src_date_met,
    master_user_id = v_src_master,
    google_drive_link = v_src_google_drive_link,
    job_pictures_link = v_src_job_pictures_link,
    stripe_customer_id = CASE
      WHEN v_survivor_stripe THEN v_survivor.stripe_customer_id
      WHEN v_victim_stripe AND NOT v_survivor_stripe THEN v_victim.stripe_customer_id
      ELSE v_survivor.stripe_customer_id
    END,
    updated_at = now()
  WHERE id = p_survivor;

  -- Nothing may still name the row that goes: its delete would drop or blank whatever did.
  FOR v_ref IN SELECT * FROM public.customer_reference_columns() LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', v_ref.tbl, v_ref.col) INTO v_rows USING p_victim;
    IF v_rows > 0 THEN
      RAISE EXCEPTION 'The merge left % row(s) on % naming the customer that goes. Nothing was changed.', v_rows, v_ref.key;
    END IF;
  END LOOP;
  v_left := public.merge_customers_keyless(p_survivor, p_victim, false);
  IF v_left <> '{}'::jsonb THEN
    RAISE EXCEPTION 'The merge left % naming the customer that goes. Nothing was changed.', v_left::text;
  END IF;

  DELETE FROM public.customers WHERE id = p_victim;

  PERFORM set_config('app.merging_customers', '', true);

  RETURN jsonb_build_object(
    'survivor_id', p_survivor,
    'removed_id', p_victim,
    'moved', v_moved
  ) || v_plan;
END;
$$;
COMMENT ON FUNCTION public.merge_customers(uuid, uuid, jsonb) IS
  'Folds one customer row into another and deletes it. Every foreign key to customers is moved to the kept row, read off the catalog (customer_reference_columns), with the references that have none (merge_customers_keyless); where two rows may not both stand a rule says which does (merge_customers_exceptions) and every row dropped is kept in deleted_records_archive; a merge of two rows that each hold a legal matter is refused; and the delete is refused if anything still names the row that goes. Answers survivor_id, removed_id, moved (rows by table.column) and the plan it read first (holds, left_behind, portal_address_lost, same_job, legal_blocked).';
