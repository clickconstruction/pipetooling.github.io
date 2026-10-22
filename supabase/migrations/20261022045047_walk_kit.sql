SET lock_timeout = '3s';

-- The walk kit's rows (punch list #142 PR 4, v2.5725; to-dos/walk-kit/README.md decisions 1, 2 and 4, BUILD_PLAN § PR 4).
-- A Claude session runs the Messages loop on prod end to end against one customer of our own: ZZ Walk Messages Desk,
-- whose email is the bids box's address and whose phone is the bids box's number (both read from Settings' boxes row,
-- messages_boxes_v1, never from code), with one $1.00 draft estimate. Two functions, both SECURITY DEFINER and the
-- service role's alone (the walk edge function calls them; nobody signed in may):
--
--   * walk_setup(p_tester, p_app_from, p_phone, p_shared_phone_ok) makes the kit once and answers it: the customer,
--     its contact (kind customer, no name, as contact_for_customer makes one) with the two channels, the draft
--     estimate, and app_settings.walk_kit_v1 holding their ids. A second call while the kit's customer is there
--     answers the same kit. It refuses, in words, while any contact carries the kit's email, the kit's phone (unless
--     p_shared_phone_ok, the owner's-cell fallback), the team box's address, the team box's number or the app's
--     sender (p_app_from): only the kit may carry an address or number of our own, and nothing may carry the side
--     that sends to it (decision 4, README found item 1). It refuses when the bids box has no address or number,
--     when the two boxes share one number (found item 7: the kit would text itself), and when p_tester is not the
--     walk tester. The tester's flag, users.is_walk_tester, is PR 2's column and may land after this file: the check
--     reads it through dynamic SQL only when the column exists, and before then takes a training-mode assistant
--     (role assistant, read_only, not a sample, not a twin), which is what the tester is by PR 2's decision 5. A
--     dev account that is not in training mode passes too, for the walk with the owner's two presses (BUILD_PLAN
--     § 4), where the owner is the estimate's maker instead of the tester.
--   * walk_cleanup() deletes the kit's rows and nothing else, answering the counts per table, or refuses and deletes
--     nothing: when another contact carries the kit's email or phone (unless the kit recorded sharedPhone), when a
--     line on the kit's thread sits on a number or address that is not the kit's (a real person folded in through
--     Who is this?), when a file was kept on the thread (the kit sends no files), and when any foreign key from a
--     table not on its own list points at the kit's customer, contact, estimate, channels or lines with a row,
--     read from pg_constraint, so a table added later is refused, not cascaded. A job on the kit's customer is one
--     of those: delete it in the app (Delete job), then clean up again. The contact goes before the customer
--     (found item 5: the customer's delete trigger would keep it as an unknown carrying bids@ and the bids number).
--     Kept: the tester account, email_send_log, the mail in Gmail and the texts in Quo.
--
-- No table is created, so no apply_* call. Idempotent: CREATE OR REPLACE throughout.

-- ---------- a setting's JSON, or null ----------

-- app_settings.value_text as JSON, null for no row, an empty row or text that is not JSON (the client's parsers read it
-- the same way), so a bad row reads as no kit and no boxes instead of stopping the function with a cast error.
CREATE OR REPLACE FUNCTION public.walk_setting_json(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text text;
BEGIN
  SELECT nullif(btrim(value_text), '') INTO v_text FROM public.app_settings WHERE key = p_key;
  IF v_text IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN v_text::jsonb;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.walk_setting_json(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.walk_setting_json(text) TO service_role;

-- ---------- the record a contact is, in words ----------

-- "customers 1234-…", "people 5678-…", "no record" for a number nobody has named. For the refusals' words.
CREATE OR REPLACE FUNCTION public.walk_contact_record(p_contact public.contacts)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_contact.customer_id IS NOT NULL THEN 'customers ' || p_contact.customer_id
    WHEN p_contact.customer_contact_person_id IS NOT NULL THEN 'customer_contact_persons ' || p_contact.customer_contact_person_id
    WHEN p_contact.gc_company_id IS NOT NULL THEN 'gc_companies ' || p_contact.gc_company_id
    WHEN p_contact.gc_company_person_id IS NOT NULL THEN 'gc_company_people ' || p_contact.gc_company_person_id
    WHEN p_contact.person_id IS NOT NULL THEN 'people ' || p_contact.person_id
    WHEN p_contact.prospect_id IS NOT NULL THEN 'prospects ' || p_contact.prospect_id
    WHEN p_contact.supply_house_id IS NOT NULL THEN 'supply_houses ' || p_contact.supply_house_id
    WHEN p_contact.supply_house_contact_id IS NOT NULL THEN 'supply_house_contacts ' || p_contact.supply_house_contact_id
    WHEN p_contact.team_prospect_id IS NOT NULL THEN 'team_prospects ' || p_contact.team_prospect_id
    ELSE 'no record'
  END
$$;

REVOKE EXECUTE ON FUNCTION public.walk_contact_record(public.contacts) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.walk_contact_record(public.contacts) TO service_role;

-- ---------- setup ----------

CREATE OR REPLACE FUNCTION public.walk_setup(
  p_tester uuid,
  p_app_from text,
  p_phone text DEFAULT NULL,
  p_shared_phone_ok boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_boxes jsonb;
  v_kit jsonb;
  v_email text;
  v_phone text;
  v_bids_phone text;
  v_team_email text;
  v_team_phone text;
  v_has_flag boolean;
  v_tester_ok boolean;
  v_carriers text;
  v_owner uuid;
  v_customer uuid;
  v_contact uuid;
  v_email_ch uuid;
  v_phone_ch uuid;
  v_estimate uuid;
BEGIN
  -- 1. The boxes, from Settings. The kit's email is the bids box's address; its phone is p_phone, else the bids
  --    box's number.
  v_boxes := public.walk_setting_json('messages_boxes_v1');
  v_email := btrim(coalesce(v_boxes #>> '{bids,address}', ''));
  v_bids_phone := btrim(coalesce(v_boxes #>> '{bids,phone}', ''));
  v_team_email := btrim(coalesce(v_boxes #>> '{team,address}', ''));
  v_team_phone := btrim(coalesce(v_boxes #>> '{team,phone}', ''));
  v_phone := coalesce(nullif(btrim(p_phone), ''), v_bids_phone);

  IF public.contact_channel_key('email', v_email) = '' THEN
    RAISE EXCEPTION 'The walk kit cannot be set up: the bids box has no address in Settings (messages_boxes_v1), so the kit has no email.'
      USING ERRCODE = 'P0001';
  END IF;
  IF public.contact_channel_key('phone', v_phone) = '' THEN
    RAISE EXCEPTION 'The walk kit cannot be set up: % so the kit has no phone.',
      CASE WHEN nullif(btrim(p_phone), '') IS NULL THEN 'the bids box has no number in Settings (messages_boxes_v1),'
           ELSE 'the number given (' || btrim(p_phone) || ') is not one,' END
      USING ERRCODE = 'P0001';
  END IF;
  IF public.contact_channel_key('phone', v_team_phone) <> ''
     AND public.contact_channel_key('phone', v_team_phone) = public.contact_channel_key('phone', v_bids_phone) THEN
    RAISE EXCEPTION 'The walk kit cannot be set up: the two boxes share one number (%) in Settings, so the kit would text itself. Give the bids box its own number first.',
      v_team_phone USING ERRCODE = 'P0001';
  END IF;
  IF public.contact_channel_key('phone', v_team_phone) <> ''
     AND public.contact_channel_key('phone', v_team_phone) = public.contact_channel_key('phone', v_phone) THEN
    RAISE EXCEPTION 'The walk kit cannot be set up: the kit''s phone (%) is the team box''s own number, the one its texts go from.',
      v_phone USING ERRCODE = 'P0001';
  END IF;

  -- 2. The maker: the walk tester (users.is_walk_tester once PR 2's column is there; before it, a training-mode
  --    assistant), or a dev for the walk with the owner's presses.
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_walk_tester'
  ) INTO v_has_flag;
  IF v_has_flag THEN
    EXECUTE $q$
      SELECT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = $1 AND u.archived_at IS NULL AND NOT u.is_sample AND NOT u.is_digital_twin
          AND (u.is_walk_tester OR (u.role = 'dev' AND NOT u.read_only)))
    $q$ INTO v_tester_ok USING p_tester;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = p_tester AND u.archived_at IS NULL AND NOT u.is_sample AND NOT u.is_digital_twin
        AND ((u.role = 'assistant' AND u.read_only) OR (u.role = 'dev' AND NOT u.read_only))
    ) INTO v_tester_ok;
  END IF;
  IF NOT coalesce(v_tester_ok, false) THEN
    RAISE EXCEPTION 'The walk kit cannot be set up: % is not the walk tester (a hidden training-mode assistant flagged is_walk_tester) or a dev.',
      coalesce(p_tester::text, 'nobody') USING ERRCODE = 'P0001';
  END IF;

  -- 3. A kit already there answers itself.
  v_kit := public.walk_setting_json('walk_kit_v1');
  IF v_kit IS NOT NULL AND (v_kit ->> 'customerId') ~ '^[0-9a-fA-F-]{36}$'
     AND EXISTS (SELECT 1 FROM public.customers c WHERE c.id = (v_kit ->> 'customerId')::uuid) THEN
    RETURN v_kit || jsonb_build_object('made', false);
  END IF;

  -- 4. Nobody may carry what the kit carries, or the side that sends to it.
  SELECT string_agg(
           format('%s (%s) is carried by contact %s, kind %s, %s', o.what, o.value, c.id, c.kind, public.walk_contact_record(c)),
           '; ' ORDER BY o.what, c.id)
  INTO v_carriers
  FROM (VALUES
          ('email', v_email, 'the kit''s email'),
          ('phone', v_phone, 'the kit''s phone'),
          ('email', v_team_email, 'the team box''s address'),
          ('phone', v_team_phone, 'the team box''s number'),
          ('email', btrim(coalesce(p_app_from, '')), 'the app''s sender')
        ) AS o(kind, value, what)
  JOIN public.contact_channels ch ON ch.kind = o.kind AND ch.key = public.contact_channel_key(o.kind, o.value)
  JOIN public.contacts c ON c.id = ch.contact_id
  WHERE public.contact_channel_key(o.kind, o.value) <> ''
    AND NOT (o.what = 'the kit''s phone' AND p_shared_phone_ok);
  IF v_carriers IS NOT NULL THEN
    RAISE EXCEPTION 'The walk kit cannot be set up: %. Only the kit may carry an address or number of our own, and nothing may carry the side that sends to it (to-dos/walk-kit, decision 4). Retype the record''s email or phone in the app, then have a session remove the channel.',
      v_carriers USING ERRCODE = 'P0001';
  END IF;

  -- 5. The rows, in this one transaction. The owner stamps the customer and the estimate as every new record is
  --    (company_owner_user_id, the SQL mirror of the client's resolveCompanyOwnerUserId, whose last fallback is the
  --    signed-in account: here the maker).
  v_owner := coalesce(public.company_owner_user_id(), p_tester);
  INSERT INTO public.customers (name, customer_type, contact_info, master_user_id)
  VALUES ('ZZ Walk Messages Desk', 'residential', jsonb_build_object('email', v_email, 'phone', v_phone), v_owner)
  RETURNING id INTO v_customer;
  INSERT INTO public.contacts (kind, customer_id) VALUES ('customer', v_customer) RETURNING id INTO v_contact;
  INSERT INTO public.contact_channels (contact_id, kind, value) VALUES (v_contact, 'email', v_email) RETURNING id INTO v_email_ch;
  INSERT INTO public.contact_channels (contact_id, kind, value) VALUES (v_contact, 'phone', v_phone) RETURNING id INTO v_phone_ch;
  INSERT INTO public.estimates (master_user_id, created_by, customer_id, title, line_items_snapshot, total_cents, customer_email, valid_until, status)
  VALUES (
    v_owner, p_tester, v_customer, 'ZZ walk estimate (delete me)',
    jsonb_build_array(jsonb_build_object(
      'line_item', 'Walk', 'description', 'The walk kit''s one line (delete me)', 'quantity', 1, 'unit_price_cents', 100, 'amount_cents', 100)),
    100, v_email, current_date + 14, 'draft')
  RETURNING id INTO v_estimate;

  v_kit := jsonb_build_object(
    'customerId', v_customer,
    'contactId', v_contact,
    'emailChannelId', v_email_ch,
    'phoneChannelId', v_phone_ch,
    'estimateId', v_estimate,
    'email', v_email,
    'phone', v_phone,
    'testerId', p_tester,
    'sharedPhone', coalesce(p_shared_phone_ok, false),
    'madeAt', clock_timestamp());
  INSERT INTO public.app_settings (key, value_text) VALUES ('walk_kit_v1', v_kit::text)
  ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text;
  RETURN v_kit || jsonb_build_object('made', true);
END;
$$;

COMMENT ON FUNCTION public.walk_setup(uuid, text, text, boolean) IS
  'The walk kit (v2.5725, punch list #142): makes ZZ Walk Messages Desk (email the bids box''s address, phone p_phone else the bids box''s number), its contact and two channels, a $1.00 draft estimate, and app_settings.walk_kit_v1; answers the kit (made true/false). Refuses while any contact carries the kit''s email or phone (unless p_shared_phone_ok), the team box''s address or number, or the app''s sender; when the boxes share one number; when p_tester is not the walk tester (users.is_walk_tester once PR 2 lands, a training-mode assistant before) or a dev. SECURITY DEFINER, the service role''s alone.';

REVOKE EXECUTE ON FUNCTION public.walk_setup(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.walk_setup(uuid, text, text, boolean) TO service_role;

-- ---------- cleanup ----------

CREATE OR REPLACE FUNCTION public.walk_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kit jsonb;
  v_customer uuid;
  v_contact uuid;
  v_estimate uuid;
  v_email_ch uuid;
  v_phone_ch uuid;
  v_email text;
  v_phone text;
  v_shared boolean;
  v_lines uuid[];
  v_words text;
  v_found boolean;
  v_has_contact_id boolean;
  v_ids uuid[];
  v_n bigint;
  v_counts jsonb := '{}'::jsonb;
  r record;
BEGIN
  -- 1. The kit.
  v_kit := public.walk_setting_json('walk_kit_v1');
  IF v_kit IS NULL THEN
    RETURN jsonb_build_object('cleaned', false, 'nothing', true, 'words', 'nothing to clean');
  END IF;
  v_customer := CASE WHEN (v_kit ->> 'customerId') ~ '^[0-9a-fA-F-]{36}$' THEN (v_kit ->> 'customerId')::uuid END;
  v_contact := CASE WHEN (v_kit ->> 'contactId') ~ '^[0-9a-fA-F-]{36}$' THEN (v_kit ->> 'contactId')::uuid END;
  v_estimate := CASE WHEN (v_kit ->> 'estimateId') ~ '^[0-9a-fA-F-]{36}$' THEN (v_kit ->> 'estimateId')::uuid END;
  v_email_ch := CASE WHEN (v_kit ->> 'emailChannelId') ~ '^[0-9a-fA-F-]{36}$' THEN (v_kit ->> 'emailChannelId')::uuid END;
  v_phone_ch := CASE WHEN (v_kit ->> 'phoneChannelId') ~ '^[0-9a-fA-F-]{36}$' THEN (v_kit ->> 'phoneChannelId')::uuid END;
  v_email := coalesce(v_kit ->> 'email', '');
  v_phone := coalesce(v_kit ->> 'phone', '');
  v_shared := coalesce((v_kit ->> 'sharedPhone')::boolean, false);
  v_lines := CASE WHEN v_contact IS NULL THEN '{}'::uuid[]
                  ELSE ARRAY(SELECT m.id FROM public.messages m WHERE m.contact_id = v_contact) END;

  -- 2. Refusals, every one before the first delete.
  -- 2a. Another contact carries the kit's address or number: Who is this? may have folded a real person in.
  SELECT string_agg(format('contact %s, kind %s, %s carries %s %s', c.id, c.kind, public.walk_contact_record(c), ch.kind, ch.value), '; ' ORDER BY c.id)
  INTO v_words
  FROM public.contact_channels ch
  JOIN public.contacts c ON c.id = ch.contact_id
  WHERE ch.contact_id IS DISTINCT FROM v_contact
    AND ((ch.kind = 'email' AND public.contact_channel_key('email', v_email) <> '' AND ch.key = public.contact_channel_key('email', v_email))
      OR (NOT v_shared AND ch.kind = 'phone' AND public.contact_channel_key('phone', v_phone) <> '' AND ch.key = public.contact_channel_key('phone', v_phone)));
  IF v_words IS NOT NULL THEN
    RAISE EXCEPTION 'The walk kit cannot be cleaned up: another contact carries the kit''s address or number (%). Look at it first; nothing was deleted.',
      v_words USING ERRCODE = 'P0001';
  END IF;
  -- 2b. A line on the kit's thread on a number or address that is not the kit's: a real person's, folded in.
  IF v_contact IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.contact_id = v_contact AND m.channel_id IS NOT NULL
      AND m.channel_id IS DISTINCT FROM v_email_ch AND m.channel_id IS DISTINCT FROM v_phone_ch
  ) THEN
    RAISE EXCEPTION 'The walk kit cannot be cleaned up: a line on the kit''s thread came in on a number or address that is not the kit''s, so a real person may have been folded in through Who is this?. Look at the thread first; nothing was deleted.'
      USING ERRCODE = 'P0001';
  END IF;
  -- 2c. A file kept on the thread: the kit sends none, so it is somebody's.
  IF EXISTS (SELECT 1 FROM public.message_attachments a WHERE a.message_id = ANY (v_lines) AND a.bucket_path IS NOT NULL) THEN
    RAISE EXCEPTION 'The walk kit cannot be cleaned up: a file was kept on the kit''s thread, and the kit sends no files. Look at it first; nothing was deleted.'
      USING ERRCODE = 'P0001';
  END IF;
  -- 2d. Another contact or estimate on the kit's customer, or another contact's line on the kit's estimate.
  IF v_customer IS NOT NULL AND EXISTS (SELECT 1 FROM public.contacts c WHERE c.customer_id = v_customer AND c.id IS DISTINCT FROM v_contact) THEN
    RAISE EXCEPTION 'The walk kit cannot be cleaned up: another contact points at the kit''s customer. Nothing was deleted.' USING ERRCODE = 'P0001';
  END IF;
  IF v_customer IS NOT NULL AND EXISTS (SELECT 1 FROM public.estimates e WHERE e.customer_id = v_customer AND e.id IS DISTINCT FROM v_estimate) THEN
    RAISE EXCEPTION 'The walk kit cannot be cleaned up: another estimate is on the kit''s customer. Nothing was deleted.' USING ERRCODE = 'P0001';
  END IF;
  IF v_estimate IS NOT NULL AND EXISTS (SELECT 1 FROM public.messages m WHERE m.estimate_id = v_estimate AND m.contact_id IS DISTINCT FROM v_contact) THEN
    RAISE EXCEPTION 'The walk kit cannot be cleaned up: a line on another thread points at the kit''s estimate. Nothing was deleted.' USING ERRCODE = 'P0001';
  END IF;
  -- 2e. Every other foreign key at the kit's customer, contact, estimate, channels or lines, read from the catalog:
  --     a row in a table this function does not delete from is refused, so a table added later is never cascaded.
  FOR r IN
    SELECT n.nspname AS nsp, cl.relname AS rel, a.attname AS col, tgt.relname AS target
    FROM pg_constraint k
    JOIN pg_class cl ON cl.oid = k.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_class tgt ON tgt.oid = k.confrelid
    JOIN pg_namespace tn ON tn.oid = tgt.relnamespace
    JOIN LATERAL unnest(k.conkey, k.confkey) AS u(att, fatt) ON true
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = u.att
    JOIN pg_attribute fa ON fa.attrelid = k.confrelid AND fa.attnum = u.fatt AND fa.attname = 'id'
    WHERE k.contype = 'f' AND tn.nspname = 'public'
      AND tgt.relname IN ('customers', 'contacts', 'estimates', 'contact_channels', 'messages')
      AND NOT (tgt.relname = 'customers' AND cl.relname IN ('contacts', 'estimates', 'sent_documents'))
      AND NOT (tgt.relname = 'contacts' AND cl.relname IN ('messages', 'contact_owed', 'call_tasks', 'nudge_offers', 'nudge_holds', 'nudge_sent', 'quick_reply_uses', 'contact_step_skips', 'contact_jobs', 'contact_channels'))
      AND NOT (tgt.relname = 'estimates' AND cl.relname IN ('estimate_customer_events', 'messages'))
      AND NOT (tgt.relname = 'contact_channels' AND cl.relname IN ('messages', 'nudge_offers'))
      AND NOT (tgt.relname = 'messages' AND cl.relname IN ('message_attachments', 'message_promises', 'message_highlights'))
    ORDER BY tgt.relname, cl.relname, a.attname
  LOOP
    v_ids := array_remove(CASE r.target
      WHEN 'customers' THEN ARRAY[v_customer]
      WHEN 'contacts' THEN ARRAY[v_contact]
      WHEN 'estimates' THEN ARRAY[v_estimate]
      WHEN 'contact_channels' THEN ARRAY[v_email_ch, v_phone_ch]
      ELSE v_lines END, NULL);
    IF coalesce(array_length(v_ids, 1), 0) = 0 THEN
      CONTINUE;
    END IF;
    -- A row of the kit's own thread (contact_id the kit's) that points at a kit line is deleted with the thread below;
    -- any other row at a kit line, and every row at the kit's contact or channels, is somebody's.
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = r.nsp AND table_name = r.rel AND column_name = 'contact_id'
    ) INTO v_has_contact_id;
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I t WHERE t.%I = ANY ($1)%s)', r.nsp, r.rel, r.col,
      CASE WHEN r.target = 'messages' AND v_has_contact_id THEN ' AND t.contact_id IS DISTINCT FROM $2' ELSE '' END)
    INTO v_found USING v_ids, v_contact;
    IF v_found THEN
      RAISE EXCEPTION 'The walk kit cannot be cleaned up: a row in %.% (%) points at the kit''s %. % Nothing was deleted.',
        r.nsp, r.rel, r.col,
        CASE r.target WHEN 'customers' THEN 'customer' WHEN 'contacts' THEN 'contact' WHEN 'estimates' THEN 'estimate'
                      WHEN 'contact_channels' THEN 'number or address' ELSE 'thread' END,
        CASE WHEN r.rel = 'jobs_ledger' THEN 'The kit''s customer has a job: delete it in the app (Delete job), then clean up again.'
             ELSE 'Look at it first.' END
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- 3. The deletes, children first, the contact before the customer.
  DELETE FROM public.message_attachments WHERE message_id = ANY (v_lines);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('message_attachments', v_n);
  DELETE FROM public.message_promises WHERE message_id = ANY (v_lines);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('message_promises', v_n);
  DELETE FROM public.message_highlights WHERE message_id = ANY (v_lines);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('message_highlights', v_n);
  DELETE FROM public.contact_owed WHERE contact_id = v_contact;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('contact_owed', v_n);
  DELETE FROM public.call_tasks WHERE contact_id = v_contact;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('call_tasks', v_n);
  DELETE FROM public.nudge_offers WHERE contact_id = v_contact;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('nudge_offers', v_n);
  DELETE FROM public.nudge_sent WHERE contact_id = v_contact;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('nudge_sent', v_n);
  DELETE FROM public.nudge_holds WHERE contact_id = v_contact;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('nudge_holds', v_n);
  DELETE FROM public.quick_reply_uses WHERE contact_id = v_contact;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('quick_reply_uses', v_n);
  DELETE FROM public.contact_step_skips WHERE contact_id = v_contact;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('contact_step_skips', v_n);
  DELETE FROM public.contact_jobs WHERE contact_id = v_contact;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('contact_jobs', v_n);
  DELETE FROM public.messages WHERE id = ANY (v_lines);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('messages', v_n);
  DELETE FROM public.contact_channels WHERE contact_id = v_contact;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('contact_channels', v_n);
  DELETE FROM public.contacts WHERE id = v_contact;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('contacts', v_n);
  DELETE FROM public.estimate_customer_events WHERE estimate_id = v_estimate;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('estimate_customer_events', v_n);
  DELETE FROM public.sent_documents
  WHERE (v_customer IS NOT NULL AND customer_id = v_customer)
     OR (v_estimate IS NOT NULL AND source_table = 'estimates' AND source_id = v_estimate);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('sent_documents', v_n);
  DELETE FROM public.estimates WHERE id = v_estimate;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('estimates', v_n);
  DELETE FROM public.customers WHERE id = v_customer;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('customers', v_n);
  DELETE FROM public.app_settings WHERE key = 'walk_kit_v1';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('app_settings', v_n);
  RETURN jsonb_build_object('cleaned', true, 'counts', v_counts, 'kit', v_kit);
END;
$$;

COMMENT ON FUNCTION public.walk_cleanup() IS
  'The walk kit (v2.5725, punch list #142): deletes the kit''s rows and nothing else, children first and the contact before the customer (the customer''s delete trigger would keep it as an unknown carrying bids@); answers the counts per table, or {nothing: true} with no kit. Refuses and deletes nothing when another contact carries the kit''s email or phone (unless sharedPhone), when a line on the thread sits on a channel not the kit''s, when a file was kept, or when any foreign key from a table not on its list points at the kit''s rows (pg_constraint; a job: Delete job in the app first). Keeps the tester, email_send_log, Gmail and Quo. SECURITY DEFINER, the service role''s alone.';

REVOKE EXECUTE ON FUNCTION public.walk_cleanup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.walk_cleanup() TO service_role;
