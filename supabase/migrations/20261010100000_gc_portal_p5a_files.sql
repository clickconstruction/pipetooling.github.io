SET lock_timeout = '3s';

-- GC mode, the trade partner portal's P5a-m (to-dos/gc-mode/mockups/portal-p5a.md on branch spike/gc-mode): files
-- from the portal. A trade's file goes into the job's Drive folder and the app keeps the link, never a copy (the
-- owner's call, PORTAL_REAL_BUILD.md decision 9). This migration is the ledger and the three verbs that store a link:
--   - gc_trade_files: one row for each file a trade put in Drive from its portal (P5a-1's kind `file`), and each
--     signed paper the portal made for it (P5a-2's waiver PDF). The office team reads it; only the service role writes.
--   - gc_trade_ask_change gains p_file_url (a change request's photo or ticket) into file_url, already a column.
--   - gc_trade_submit_quote reads q->>'file' (its quote's PDF) into gc_quotes.quote_file, already a column.
--   - gc_trade_submittal_send, unchanged in what it takes, now ties the uploaded file to its round.
-- Each verb takes an https link or none. When the link is one of the company's own gc_trade_files rows, the verb
-- sets that row's record_id to the record it made. A refusal raises a key the page says in the company's language,
-- as every trade verb does. Doc: docs/migrations/20261010100000_gc_portal_p5a_files.md.

CREATE TABLE IF NOT EXISTS public.gc_trade_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  -- The trade it is on. Null on a quote's file while we bid.
  package_id uuid REFERENCES public.gc_trade_packages(id) ON DELETE SET NULL,
  purpose text NOT NULL
    CONSTRAINT gc_trade_files_purpose_known CHECK (purpose IN ('submittal', 'change', 'quote', 'waiver')),
  -- The record it went with, once the next kind stored its link: the submittal round, the change request, the
  -- quote, or the draw a waiver is on. Null until then.
  record_id uuid,
  name text NOT NULL
    CONSTRAINT gc_trade_files_named CHECK (btrim(name) <> '' AND char_length(name) <= 300),
  mime text NOT NULL
    CONSTRAINT gc_trade_files_mime_known CHECK (mime IN ('application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif')),
  bytes integer NOT NULL
    CONSTRAINT gc_trade_files_bytes_capped CHECK (bytes > 0 AND bytes <= 10485760),
  drive_file_id text NOT NULL
    CONSTRAINT gc_trade_files_drive_id_said CHECK (btrim(drive_file_id) <> ''),
  drive_url text NOT NULL
    CONSTRAINT gc_trade_files_drive_url_https CHECK (drive_url ~ '^https://\S+$'),
  -- trade: the company uploaded it. portal: the function made it, a signed waiver's paper.
  made_by text NOT NULL DEFAULT 'trade'
    CONSTRAINT gc_trade_files_made_by_known CHECK (made_by IN ('trade', 'portal')),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_trade_files IS
  'GC mode (P5a): each file a trade put in the job''s Drive folder from its portal, and each signed paper the portal made for it. The app keeps the link, never a copy. record_id is the round, change request, quote or draw it went with, once stored. The office team reads it; only the service role writes it (submit-gc-trade-portal).';

-- The hourly cap counts a company's files in the last hour; a verb finds a link among the company's rows.
CREATE INDEX IF NOT EXISTS gc_trade_files_company_idx ON public.gc_trade_files (company_id, uploaded_at);
CREATE INDEX IF NOT EXISTS gc_trade_files_project_idx ON public.gc_trade_files (project_id);
CREATE INDEX IF NOT EXISTS gc_trade_files_record_idx ON public.gc_trade_files (record_id);

ALTER TABLE public.gc_trade_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_trade_files_office_read ON public.gc_trade_files;
CREATE POLICY gc_trade_files_office_read ON public.gc_trade_files FOR SELECT TO authenticated
  USING (public.gc_office_team());

REVOKE ALL ON TABLE public.gc_trade_files FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.gc_trade_files FROM authenticated;
GRANT SELECT ON TABLE public.gc_trade_files TO authenticated;

-- A file's link from the portal: an https link of 2,000 characters at most, or none. Anything else is badRequest.
CREATE OR REPLACE FUNCTION public.gc_trade_file_link(p_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := btrim(coalesce(p_url, ''));
BEGIN
  IF v = '' THEN
    RETURN NULL;
  END IF;
  IF v !~ '^https://\S+$' OR char_length(v) > 2000 THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'A file''s link is an https link.';
  END IF;
  RETURN v;
END;
$$;

-- Ties the company's uploaded file to the record its next kind made: the newest of its rows with that link, for
-- that purpose, not yet tied. Another company's link, or a typed one, ties nothing.
CREATE OR REPLACE FUNCTION public.gc_trade_file_tie(p_company_id uuid, p_purpose text, p_url text, p_record_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.gc_trade_files f SET record_id = p_record_id
  WHERE f.id = (
    SELECT x.id FROM public.gc_trade_files x
    WHERE x.company_id = p_company_id AND x.purpose = p_purpose AND x.drive_url = p_url AND x.record_id IS NULL
    ORDER BY x.uploaded_at DESC
    LIMIT 1
  );
$$;

-- A change asked from the portal, now with its photo or ticket (P5a). The new argument has a default, so a call
-- without it, as the function sends today, reads the same. A function's arguments cannot change in place: the old
-- one is dropped first, inside this migration's transaction.
DROP FUNCTION IF EXISTS public.gc_trade_ask_change(uuid, uuid, text, text, numeric, integer);
CREATE OR REPLACE FUNCTION public.gc_trade_ask_change(p_company_id uuid, p_package_id uuid, p_description text, p_reason text, p_amount numeric, p_days integer, p_file_url text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pkg record;
  v_sow public.gc_sows%ROWTYPE;
  v_text text := btrim(coalesce(p_description, ''));
  v_file text;
  v_id uuid;
BEGIN
  SELECT k.id, k.project_id, k.ours, k.awarded_invite_id, g.stage INTO v_pkg
  FROM public.gc_trade_packages k JOIN public.gc_projects g ON g.project_id = k.project_id
  WHERE k.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No trade with that id.';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id;
  -- Signed is the status, never a row that merely exists; the award and the statement of work name the
  -- same ask, which gc_award writes together.
  IF v_pkg.stage = 'bidding' OR v_pkg.ours OR v_sow.id IS NULL OR v_sow.status <> 'signed'
    OR v_sow.company_id IS DISTINCT FROM p_company_id OR v_sow.invite_id IS DISTINCT FROM v_pkg.awarded_invite_id
  THEN
    RAISE EXCEPTION 'notAwarded' USING ERRCODE = 'P0001', DETAIL = 'A change is asked on work the company signed for, on a job that is ours.';
  END IF;
  IF v_text = '' THEN
    RAISE EXCEPTION 'descriptionNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say what changed.';
  END IF;
  IF char_length(v_text) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep it under 2,000 characters.';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('owner', 'field', 'plans') THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'The reason is the customer, the field or the plans.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amountNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type what the company asks for the work.';
  END IF;
  IF p_days IS NULL OR p_days < 0 THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'The working days it adds are 0 or more.';
  END IF;
  v_file := public.gc_trade_file_link(p_file_url);
  INSERT INTO public.gc_trade_change_requests (project_id, package_id, company_id, sow_id, asked_on, description, reason, amount, days, file_url)
  VALUES (v_pkg.project_id, v_pkg.id, p_company_id, v_sow.id, public.app_today(), v_text, p_reason, p_amount, p_days, v_file)
  RETURNING id INTO v_id;
  IF v_file IS NOT NULL THEN
    PERFORM public.gc_trade_file_tie(p_company_id, 'change', v_file, v_id);
  END IF;
  RETURN v_id;
END;
$$;

-- A quote from the portal, now with its PDF's link in quote_file (P5a). The rest is P2a's, as it was.
CREATE OR REPLACE FUNCTION public.gc_trade_submit_quote(p_company_id uuid, p_invite_id uuid, q jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_invite public.gc_invites%ROWTYPE;
  v_amount numeric;
  v_includes jsonb := coalesce(q->'includes', '{}'::jsonb);
  v_good integer;
  v_sov jsonb := q->'sov';
  v_exclusions jsonb := q->'exclusions';
  v_answered text[];
  v_file text;
  v_id uuid;
BEGIN
  v_invite := public.gc_trade_ask(p_company_id, p_invite_id);
  IF v_invite.seen_rev IS NULL THEN
    RAISE EXCEPTION 'openFirst' USING ERRCODE = 'P0001', DETAIL = 'Open the plans before sending a quote.';
  END IF;
  v_amount := CASE WHEN jsonb_typeof(q->'amount') = 'number' THEN (q->>'amount')::numeric END;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'amountNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type the quote''s amount.';
  END IF;
  IF jsonb_typeof(v_includes) <> 'object'
    OR EXISTS (SELECT 1 FROM public.gc_scope_items s WHERE s.package_id = v_invite.package_id AND coalesce(v_includes->>s.id::text, '') NOT IN ('yes', 'no'))
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(v_includes) k WHERE NOT EXISTS (SELECT 1 FROM public.gc_scope_items s WHERE s.package_id = v_invite.package_id AND s.id::text = k))
  THEN
    RAISE EXCEPTION 'answerEach' USING ERRCODE = 'P0001', DETAIL = 'Say for each line whether it is in the number or left out.';
  END IF;
  IF jsonb_typeof(q->'goodForDays') = 'number' THEN
    IF (q->>'goodForDays')::numeric <> trunc((q->>'goodForDays')::numeric) OR (q->>'goodForDays')::numeric NOT BETWEEN 1 AND 3650 THEN
      RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'The days a quote holds are a whole number more than zero.';
    END IF;
    v_good := (q->>'goodForDays')::integer;
  END IF;
  IF jsonb_typeof(coalesce(q->'alternates', '[]'::jsonb)) <> 'array'
    OR (v_sov IS NOT NULL AND jsonb_typeof(v_sov) NOT IN ('array', 'null'))
    OR (v_exclusions IS NOT NULL AND jsonb_typeof(v_exclusions) NOT IN ('array', 'null'))
  THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'The quote''s parts are not in the shape the portal sends.';
  END IF;
  IF jsonb_typeof(v_sov) = 'array' AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_sov) l WHERE jsonb_typeof(l->'amount') IS DISTINCT FROM 'number') THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'Each line of the schedule of values has an amount.';
  END IF;
  IF jsonb_typeof(v_sov) = 'array' AND jsonb_array_length(v_sov) > 0
    AND (SELECT coalesce(sum((l->>'amount')::numeric), 0) FROM jsonb_array_elements(v_sov) l) <> v_amount
  THEN
    RAISE EXCEPTION 'sovMustAdd' USING ERRCODE = 'P0001', DETAIL = 'The schedule of values must add up to the quote.';
  END IF;
  IF jsonb_typeof(q->'exclusionsAnswered') = 'array' THEN
    v_answered := ARRAY(SELECT btrim(value #>> '{}') FROM jsonb_array_elements(q->'exclusionsAnswered') WHERE btrim(value #>> '{}') <> '');
  END IF;
  v_file := public.gc_trade_file_link(q->>'file');
  INSERT INTO public.gc_quotes (invite_id, amount, based_on_rev, submitted_on, includes, note, good_for_days, alternates, quote_file, sov, exclusions, exclusions_answered, source)
  VALUES (
    v_invite.id, v_amount, v_invite.seen_rev, public.app_today(), v_includes, btrim(coalesce(q->>'note', '')), v_good,
    coalesce(q->'alternates', '[]'::jsonb), coalesce(v_file, ''),
    CASE WHEN jsonb_typeof(v_sov) = 'array' AND jsonb_array_length(v_sov) > 0 THEN v_sov END,
    CASE WHEN jsonb_typeof(v_exclusions) = 'array' AND jsonb_array_length(v_exclusions) > 0 THEN v_exclusions END,
    v_answered, 'trade'
  )
  RETURNING id INTO v_id;
  UPDATE public.gc_invites SET status = 'bid' WHERE id = v_invite.id;
  IF v_file IS NOT NULL THEN
    PERFORM public.gc_trade_file_tie(p_company_id, 'quote', v_file, v_id);
  END IF;
  RETURN v_id;
END;
$$;

-- A submittal round from the portal (U4a's), now tying an uploaded file to its round (P5a). What it takes and
-- refuses is as it was.
CREATE OR REPLACE FUNCTION public.gc_trade_submittal_send(p_company_id uuid, p_submittal_id uuid, p_file_name text, p_drive_url text DEFAULT NULL, p_note text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_project uuid;
  v_pkg uuid;
  v_company uuid;
  v_file text := btrim(coalesce(p_file_name, ''));
  v_url text := nullif(btrim(coalesce(p_drive_url, '')), '');
  v_id uuid;
BEGIN
  SELECT s.project_id, s.package_id INTO v_project, v_pkg FROM public.gc_submittals s WHERE s.id = p_submittal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No submittal with that id.';
  END IF;
  SELECT i.company_id INTO v_company
  FROM public.gc_trade_packages k JOIN public.gc_invites i ON i.id = k.awarded_invite_id
  WHERE k.id = v_pkg;
  IF v_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notYours' USING ERRCODE = 'P0001', DETAIL = 'That submittal is on another company’s work.';
  END IF;
  CASE public.gc_submittal_move(p_submittal_id)
    WHEN 'trade' THEN
      NULL;
    WHEN 'approved' THEN
      RAISE EXCEPTION 'notYourMove' USING ERRCODE = 'P0001', DETAIL = 'It is approved already.';
    ELSE
      RAISE EXCEPTION 'notYourMove' USING ERRCODE = 'P0001', DETAIL = 'It came in already. It is with us or the architect now.';
  END CASE;
  IF v_file = '' THEN
    RAISE EXCEPTION 'fileNeeded' USING ERRCODE = 'P0001', DETAIL = 'Name the file you are sending.';
  END IF;

  INSERT INTO public.gc_submittal_rounds (submittal_id, round, sent_on, sent_by, file_name, drive_url, note)
  VALUES (
    p_submittal_id,
    (SELECT coalesce(max(x.round), 0) + 1 FROM public.gc_submittal_rounds x WHERE x.submittal_id = p_submittal_id),
    public.app_today(),
    'trade',
    v_file,
    v_url,
    btrim(coalesce(p_note, ''))
  )
  RETURNING id INTO v_id;
  IF v_url IS NOT NULL THEN
    PERFORM public.gc_trade_file_tie(p_company_id, 'submittal', v_url, v_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.gc_submittals s WHERE s.package_id = v_pkg AND public.gc_submittal_move(s.id) = 'trade') THEN
    PERFORM public.gc_keep_promises(p_company_id, 'submittals', v_project, v_pkg, public.app_today());
  END IF;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_trade_file_link(text) IS 'GC mode (P5a): a file''s link from the portal, an https link or none; anything else raises badRequest.';
COMMENT ON FUNCTION public.gc_trade_file_tie(uuid, text, text, uuid) IS 'GC mode (P5a): ties the company''s newest untied uploaded file with that link and purpose to the record its next kind made. Another company''s link, or a typed one, ties nothing. Service role only.';
COMMENT ON FUNCTION public.gc_trade_ask_change(uuid, uuid, text, text, numeric, integer, text) IS 'GC mode (P4a, P5a): a change asked from the portal (tradeAskChange), only by the company on a signed statement of work on a job that is ours (portalCanAskChange), else notAwarded; since P5a with its photo or ticket''s link (file_url). Returns the id. Service role only.';
COMMENT ON FUNCTION public.gc_trade_submit_quote(uuid, uuid, jsonb) IS 'GC mode (P2a, P5a): a quote from the portal (tradeSubmitBid), append only, priced on the set it last opened; every scope line yes or no; the schedule of values adds up; since P5a its PDF''s link (quote_file). Service role only.';

-- The trade's verbs and their helpers are the service role's alone, as every gc_trade_* is.
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.gc_trade_file_link(text)',
    'public.gc_trade_file_tie(uuid, text, text, uuid)',
    'public.gc_trade_ask_change(uuid, uuid, text, text, numeric, integer, text)',
    'public.gc_trade_submit_quote(uuid, uuid, jsonb)',
    'public.gc_trade_submittal_send(uuid, uuid, text, text, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
