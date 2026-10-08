-- GC mode, the trade partner portal's first writes (P2a of to-dos/gc-mode/PORTAL_REAL_BUILD.md, plan
-- to-dos/gc-mode/mockups/portal-p2a.md on branch spike/gc-mode): twelve gc_trade_<verb> functions on the
-- company record (B1's tables) and on gc_plan_questions. Only the service role calls them, from the
-- submit-gc-trade-portal function (P2b), which has already turned the link into its company: every verb
-- takes that company first and refuses a row of another company. A refusal raises a key the page says
-- in the company's language (decision 11), with the reason in plain words as its DETAIL.
SET lock_timeout = '3s';

-- The company's ask, held to the company: the verbs that act on an ask start here. Refuses another
-- company's ask, a bid we lost and an ask the company passed on.
CREATE OR REPLACE FUNCTION public.gc_trade_ask(p_company_id uuid, p_invite_id uuid)
RETURNS public.gc_invites
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_invite public.gc_invites%ROWTYPE;
  v_lost date;
BEGIN
  SELECT * INTO v_invite FROM public.gc_invites WHERE id = p_invite_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No ask with that id.';
  END IF;
  IF v_invite.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notYours' USING ERRCODE = 'P0001', DETAIL = 'That ask is another company''s.';
  END IF;
  SELECT g.lost_on INTO v_lost
  FROM public.gc_trade_packages k JOIN public.gc_projects g ON g.project_id = k.project_id
  WHERE k.id = v_invite.package_id;
  IF v_lost IS NOT NULL THEN
    RAISE EXCEPTION 'projectLost' USING ERRCODE = 'P0001', DETAIL = 'We lost this bid. Nothing more is asked on it.';
  END IF;
  IF v_invite.status = 'declined' THEN
    RAISE EXCEPTION 'youPassed' USING ERRCODE = 'P0001', DETAIL = 'The company passed on this ask.';
  END IF;
  RETURN v_invite;
END;
$$;

-- The newest plan set on the trade's project (currentRev): 0 before the first set.
CREATE OR REPLACE FUNCTION public.gc_trade_current_rev(p_package_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce(max(s.rev), 0)
  FROM public.gc_trade_packages k JOIN public.gc_plan_sets s ON s.project_id = k.project_id
  WHERE k.id = p_package_id
$$;

-- Got it, on the portal's welcome (tradeOpenPortal): the first day the company used its portal. Kept once.
CREATE OR REPLACE FUNCTION public.gc_trade_got_it(p_company_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_on date;
BEGIN
  UPDATE public.gc_companies SET portal_opened_on = coalesce(portal_opened_on, public.app_today())
  WHERE id = p_company_id
  RETURNING portal_opened_on INTO v_on;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No company with that id.';
  END IF;
  RETURN v_on;
END;
$$;

-- English or Spanish for its portal and its emails (tradeSetLanguage). While Spanish is held the
-- submit function refuses es before it gets here; the record keeps whatever was chosen.
CREATE OR REPLACE FUNCTION public.gc_trade_set_lang(p_company_id uuid, p_lang text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_lang IS NULL OR p_lang NOT IN ('en', 'es') THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'The language is English or Spanish.';
  END IF;
  UPDATE public.gc_companies SET lang = p_lang WHERE id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No company with that id.';
  END IF;
END;
$$;

-- The kinds of email, in the portal's order.
CREATE OR REPLACE FUNCTION public.gc_trade_mail_groups(p_groups text[])
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(array_agg(g ORDER BY o), '{}')
  FROM unnest(ARRAY['quotes', 'job', 'contracts', 'pay']) WITH ORDINALITY AS t(g, o)
  WHERE g = ANY (coalesce(p_groups, '{}'))
$$;

-- Add a person to its emails (tradeAddPerson): a name, an email and at least one kind.
CREATE OR REPLACE FUNCTION public.gc_trade_add_person(p_company_id uuid, p_name text, p_email text, p_role text, p_gets text[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_gets text[] := public.gc_trade_mail_groups(p_gets);
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gc_companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No company with that id.';
  END IF;
  IF btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'nameNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type their name.';
  END IF;
  IF btrim(coalesce(p_email, '')) !~ '^\S+@\S+\.\S+$' THEN
    RAISE EXCEPTION 'emailNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type an email address that works.';
  END IF;
  IF cardinality(v_gets) = 0 THEN
    RAISE EXCEPTION 'pickAKind' USING ERRCODE = 'P0001', DETAIL = 'Pick at least one kind of email for them.';
  END IF;
  INSERT INTO public.gc_company_people (company_id, name, email, role, gets, added_by)
  VALUES (p_company_id, btrim(p_name), btrim(p_email), btrim(coalesce(p_role, '')), v_gets, 'trade')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Take a person off its emails (tradeRemovePerson). What only they got goes back to the main
-- contact, so every kind still reaches someone. The row is kept, with the day it was taken off.
CREATE OR REPLACE FUNCTION public.gc_trade_remove_person(p_company_id uuid, p_person_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_person public.gc_company_people%ROWTYPE;
  v_main text[];
BEGIN
  -- The company first, then the person: the order gc_trade_set_gets takes, so the two never deadlock.
  SELECT contact_gets INTO v_main FROM public.gc_companies WHERE id = p_company_id FOR UPDATE;
  SELECT * INTO v_person FROM public.gc_company_people WHERE id = p_person_id AND removed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No person with that id on the emails.';
  END IF;
  IF v_person.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notYours' USING ERRCODE = 'P0001', DETAIL = 'That person is another company''s.';
  END IF;
  UPDATE public.gc_company_people SET removed_at = now() WHERE id = v_person.id;
  -- Null: the main contact already gets every kind.
  IF v_main IS NOT NULL THEN
    UPDATE public.gc_companies
    SET contact_gets = public.gc_trade_mail_groups(v_main || ARRAY(
      SELECT g FROM unnest(v_person.gets) g
      WHERE NOT EXISTS (SELECT 1 FROM public.gc_company_people p WHERE p.company_id = p_company_id AND p.removed_at IS NULL AND g = ANY (p.gets))
    ))
    WHERE id = p_company_id;
  END IF;
END;
$$;

-- Who gets which emails (tradeSetGets): the main contact's kinds (p_person_id null) or one person's.
-- A person keeps at least one kind, and every kind still goes to someone.
CREATE OR REPLACE FUNCTION public.gc_trade_set_gets(p_company_id uuid, p_person_id uuid, p_gets text[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_gets text[] := public.gc_trade_mail_groups(p_gets);
  v_main text[];
  v_missing integer;
BEGIN
  SELECT coalesce(contact_gets, ARRAY['quotes', 'job', 'contracts', 'pay']) INTO v_main FROM public.gc_companies WHERE id = p_company_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No company with that id.';
  END IF;
  IF p_person_id IS NULL THEN
    v_main := v_gets;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.gc_company_people WHERE id = p_person_id AND removed_at IS NULL) THEN
      RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No person with that id on the emails.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.gc_company_people WHERE id = p_person_id AND company_id = p_company_id) THEN
      RAISE EXCEPTION 'notYours' USING ERRCODE = 'P0001', DETAIL = 'That person is another company''s.';
    END IF;
    IF cardinality(v_gets) = 0 THEN
      RAISE EXCEPTION 'pickAKind' USING ERRCODE = 'P0001', DETAIL = 'Pick at least one kind of email for them, or take them off.';
    END IF;
  END IF;
  SELECT count(*) INTO v_missing FROM unnest(ARRAY['quotes', 'job', 'contracts', 'pay']) g
  WHERE NOT (g = ANY (v_main))
    AND NOT EXISTS (
      SELECT 1 FROM public.gc_company_people p
      WHERE p.company_id = p_company_id AND p.removed_at IS NULL
        AND g = ANY (CASE WHEN p.id = p_person_id THEN v_gets ELSE p.gets END)
    );
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'everyKindNeedsSomeone' USING ERRCODE = 'P0001', DETAIL = 'Every kind of email needs someone to get it.';
  END IF;
  IF p_person_id IS NULL THEN
    UPDATE public.gc_companies SET contact_gets = v_gets WHERE id = p_company_id;
  ELSE
    UPDATE public.gc_company_people SET gets = v_gets WHERE id = p_person_id;
  END IF;
END;
$$;

-- Opened the newest plans on an ask (tradeOpenPlans): the set it saw, and an ask not opened yet
-- reads opened. Returns the set's number.
CREATE OR REPLACE FUNCTION public.gc_trade_open_plans(p_company_id uuid, p_invite_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_invite public.gc_invites%ROWTYPE;
  v_rev integer;
BEGIN
  v_invite := public.gc_trade_ask(p_company_id, p_invite_id);
  v_rev := public.gc_trade_current_rev(v_invite.package_id);
  UPDATE public.gc_invites
  SET seen_rev = greatest(coalesce(seen_rev, v_rev), v_rev),
      status = CASE WHEN status = 'invited' THEN 'opened' ELSE status END
  WHERE id = v_invite.id;
  RETURN v_rev;
END;
$$;

-- The day its quote will come (tradePromise): a line on the ask's story, in its portal. The newest
-- day on the ask counts. Not a day already passed, and not once a quote is in.
CREATE OR REPLACE FUNCTION public.gc_trade_quote_day(p_company_id uuid, p_invite_id uuid, p_by date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_invite public.gc_invites%ROWTYPE;
  v_by text;
  v_id uuid;
BEGIN
  v_invite := public.gc_trade_ask(p_company_id, p_invite_id);
  IF p_by IS NULL OR p_by < public.app_today() THEN
    RAISE EXCEPTION 'dayPassed' USING ERRCODE = 'P0001', DETAIL = 'Pick today or a day after it.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_quotes WHERE invite_id = v_invite.id) THEN
    RAISE EXCEPTION 'alreadyQuoted' USING ERRCODE = 'P0001', DETAIL = 'A quote is already in on this ask.';
  END IF;
  SELECT coalesce(nullif(btrim(contact_name), ''), name) INTO v_by FROM public.gc_companies WHERE id = p_company_id;
  INSERT INTO public.gc_company_contacts (company_id, invite_id, contacted_on, by_name, how, note, promised_by)
  VALUES (p_company_id, v_invite.id, public.app_today(), v_by, 'portal', 'Said in their portal when the quote will come.', p_by)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- A quote from the portal (tradeSubmitBid), append only: a new row each time, the newest counting.
-- q: {amount, includes, note, goodForDays, alternates, sov, exclusions, exclusionsAnswered}. It prices
-- the set the company last opened, so it must open the plans first. Each scope line of the trade is in
-- the number or left out; only the office marks a line unclear. Their schedule of values adds up to the
-- number. The office's own numbers (plugs, covers, taken alternates) stay on the ask, untouched.
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
  INSERT INTO public.gc_quotes (invite_id, amount, based_on_rev, submitted_on, includes, note, good_for_days, alternates, quote_file, sov, exclusions, exclusions_answered, source)
  VALUES (
    v_invite.id, v_amount, v_invite.seen_rev, public.app_today(), v_includes, btrim(coalesce(q->>'note', '')), v_good,
    coalesce(q->'alternates', '[]'::jsonb), '',
    CASE WHEN jsonb_typeof(v_sov) = 'array' AND jsonb_array_length(v_sov) > 0 THEN v_sov END,
    CASE WHEN jsonb_typeof(v_exclusions) = 'array' AND jsonb_array_length(v_exclusions) > 0 THEN v_exclusions END,
    v_answered, 'trade'
  )
  RETURNING id INTO v_id;
  UPDATE public.gc_invites SET status = 'bid' WHERE id = v_invite.id;
  RETURN v_id;
END;
$$;

-- The newest quote, as it stands (the copy confirm and answer lines both start from).
CREATE OR REPLACE FUNCTION public.gc_trade_newest_quote(p_invite_id uuid)
RETURNS public.gc_quotes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_quote public.gc_quotes%ROWTYPE;
BEGIN
  SELECT * INTO v_quote FROM public.gc_quotes WHERE invite_id = p_invite_id ORDER BY created_at DESC, id DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'noQuote' USING ERRCODE = 'P0001', DETAIL = 'No quote is in on this ask yet.';
  END IF;
  RETURN v_quote;
END;
$$;

-- Our number stands on the newest set (tradeConfirmBid): the newest quote again, priced on the newest
-- set, the day it was sent kept so its good-until does not move. The company opens the newest set first.
CREATE OR REPLACE FUNCTION public.gc_trade_confirm_quote(p_company_id uuid, p_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_invite public.gc_invites%ROWTYPE;
  v_quote public.gc_quotes%ROWTYPE;
  v_rev integer;
  v_id uuid;
BEGIN
  v_invite := public.gc_trade_ask(p_company_id, p_invite_id);
  v_quote := public.gc_trade_newest_quote(v_invite.id);
  v_rev := public.gc_trade_current_rev(v_invite.package_id);
  IF coalesce(v_invite.seen_rev, -1) < v_rev THEN
    RAISE EXCEPTION 'openFirst' USING ERRCODE = 'P0001', DETAIL = 'Open the newest plans before confirming the quote.';
  END IF;
  IF v_quote.based_on_rev >= v_rev THEN
    RETURN v_quote.id;
  END IF;
  INSERT INTO public.gc_quotes (invite_id, amount, based_on_rev, submitted_on, includes, note, good_for_days, alternates, quote_file, sov, exclusions, exclusions_answered, source)
  VALUES (v_invite.id, v_quote.amount, v_rev, v_quote.submitted_on, v_quote.includes, v_quote.note, v_quote.good_for_days, v_quote.alternates, v_quote.quote_file, v_quote.sov, v_quote.exclusions, v_quote.exclusions_answered, 'trade')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Answer the lines the office could not read (tradeAnswerLines): p_answers {scope item id: yes | no},
-- only for lines the newest quote has unclear. The newest quote again with those lines answered.
CREATE OR REPLACE FUNCTION public.gc_trade_answer_lines(p_company_id uuid, p_invite_id uuid, p_answers jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_invite public.gc_invites%ROWTYPE;
  v_quote public.gc_quotes%ROWTYPE;
  v_answered jsonb;
  v_id uuid;
BEGIN
  v_invite := public.gc_trade_ask(p_company_id, p_invite_id);
  v_quote := public.gc_trade_newest_quote(v_invite.id);
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'The answers are not in the shape the portal sends.';
  END IF;
  SELECT coalesce(jsonb_object_agg(a.key, a.value #>> '{}'), '{}'::jsonb) INTO v_answered
  FROM jsonb_each(p_answers) a
  WHERE (a.value #>> '{}') IN ('yes', 'no') AND v_quote.includes->>a.key = 'unclear';
  IF v_answered = '{}'::jsonb THEN
    RAISE EXCEPTION 'nothingToAnswer' USING ERRCODE = 'P0001', DETAIL = 'No line of the quote is waiting on an answer.';
  END IF;
  INSERT INTO public.gc_quotes (invite_id, amount, based_on_rev, submitted_on, includes, note, good_for_days, alternates, quote_file, sov, exclusions, exclusions_answered, source)
  VALUES (v_invite.id, v_quote.amount, v_quote.based_on_rev, v_quote.submitted_on, v_quote.includes || v_answered, v_quote.note, v_quote.good_for_days, v_quote.alternates, v_quote.quote_file, v_quote.sov, v_quote.exclusions, v_quote.exclusions_answered, 'trade')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Pass on an ask (tradeDecline), before a quote is in. Why stays the office's to ask.
CREATE OR REPLACE FUNCTION public.gc_trade_decline(p_company_id uuid, p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_invite public.gc_invites%ROWTYPE;
BEGIN
  v_invite := public.gc_trade_ask(p_company_id, p_invite_id);
  IF EXISTS (SELECT 1 FROM public.gc_quotes WHERE invite_id = v_invite.id) THEN
    RAISE EXCEPTION 'alreadyQuoted' USING ERRCODE = 'P0001', DETAIL = 'A quote is in on this ask. Call us to take it back.';
  END IF;
  UPDATE public.gc_invites SET status = 'declined', declined_on = public.app_today() WHERE id = v_invite.id;
END;
$$;

-- A question about the plans of a trade it was asked to quote (tradeAskQuestion), under the closing
-- day gc_record_question keeps: three days before our bid is due, never on a bid we lost.
CREATE OR REPLACE FUNCTION public.gc_trade_ask_question(p_company_id uuid, p_package_id uuid, p_text text, p_sheets text[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_project uuid;
  v_lost date;
  v_close date;
  v_text text := btrim(coalesce(p_text, ''));
  v_name text;
  v_id uuid;
BEGIN
  SELECT k.project_id, g.lost_on INTO v_project, v_lost
  FROM public.gc_trade_packages k JOIN public.gc_projects g ON g.project_id = k.project_id
  WHERE k.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No trade with that id.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_invites WHERE package_id = p_package_id AND company_id = p_company_id AND status <> 'declined') THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only a company asked to quote this trade can ask about it.';
  END IF;
  IF v_lost IS NOT NULL THEN
    RAISE EXCEPTION 'projectLost' USING ERRCODE = 'P0001', DETAIL = 'We lost this bid. Nothing more is asked on it.';
  END IF;
  v_close := public.gc_questions_close_on(v_project);
  IF v_close IS NOT NULL AND public.app_today() >= v_close THEN
    RAISE EXCEPTION 'questionsClosed' USING ERRCODE = 'P0001', DETAIL = format('Questions closed %s, three days before our bid is due.', to_char(v_close, 'Mon DD'));
  END IF;
  IF v_text = '' THEN
    RAISE EXCEPTION 'questionNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type the question first.';
  END IF;
  IF length(v_text) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the question under 2,000 characters.';
  END IF;
  SELECT name INTO v_name FROM public.gc_companies WHERE id = p_company_id;
  INSERT INTO public.gc_plan_questions (project_id, package_id, company_id, asked_by_name, text, sheets, asked_on)
  VALUES (v_project, p_package_id, p_company_id, coalesce(v_name, ''), v_text,
          ARRAY(SELECT DISTINCT upper(btrim(s)) FROM unnest(coalesce(p_sheets, '{}')) s WHERE btrim(s) <> ''),
          public.app_today())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_trade_ask(uuid, uuid) IS 'GC mode (P2a): the company''s ask, locked: refuses another company''s ask (notYours), a bid we lost (projectLost) and an ask it passed on (youPassed). The ask verbs start here. Service role only.';
COMMENT ON FUNCTION public.gc_trade_current_rev(uuid) IS 'GC mode (P2a): the newest plan set''s number on the trade''s project (currentRev); 0 before the first set. Service role only.';
COMMENT ON FUNCTION public.gc_trade_got_it(uuid) IS 'GC mode (P2a): Got it on the portal''s welcome (tradeOpenPortal): portal_opened_on, kept once. Service role only.';
COMMENT ON FUNCTION public.gc_trade_set_lang(uuid, text) IS 'GC mode (P2a): the company''s language, en or es (tradeSetLanguage). Service role only.';
COMMENT ON FUNCTION public.gc_trade_mail_groups(text[]) IS 'GC mode (P2a): the kinds of email given, known ones only, in the portal''s order (quotes, job, contracts, pay).';
COMMENT ON FUNCTION public.gc_trade_add_person(uuid, text, text, text, text[]) IS 'GC mode (P2a): add a person to the company''s emails from its portal (tradeAddPerson), added_by trade. Service role only.';
COMMENT ON FUNCTION public.gc_trade_remove_person(uuid, uuid) IS 'GC mode (P2a): take a person off the emails (tradeRemovePerson); what only they got goes back to the main contact. Service role only.';
COMMENT ON FUNCTION public.gc_trade_set_gets(uuid, uuid, text[]) IS 'GC mode (P2a): who gets which emails (tradeSetGets): the main contact (person null) or one person; every kind still goes to someone. Service role only.';
COMMENT ON FUNCTION public.gc_trade_open_plans(uuid, uuid) IS 'GC mode (P2a): opened the newest plans on an ask (tradeOpenPlans): seen_rev, and invited reads opened. Returns the set''s number. Service role only.';
COMMENT ON FUNCTION public.gc_trade_quote_day(uuid, uuid, date) IS 'GC mode (P2a): the day the quote will come (tradePromise), a portal line on the ask''s story; not a past day, not once a quote is in. Service role only.';
COMMENT ON FUNCTION public.gc_trade_submit_quote(uuid, uuid, jsonb) IS 'GC mode (P2a): a quote from the portal (tradeSubmitBid), append only, priced on the set it last opened; every scope line yes or no; the schedule of values adds up. Service role only.';
COMMENT ON FUNCTION public.gc_trade_newest_quote(uuid) IS 'GC mode (P2a): the newest quote on an ask, or noQuote. Service role only.';
COMMENT ON FUNCTION public.gc_trade_confirm_quote(uuid, uuid) IS 'GC mode (P2a): our number stands on the newest set (tradeConfirmBid): the newest quote again on the newest set, its sent day kept. Service role only.';
COMMENT ON FUNCTION public.gc_trade_answer_lines(uuid, uuid, jsonb) IS 'GC mode (P2a): answer the lines the office could not read (tradeAnswerLines): the newest quote again with those lines yes or no. Service role only.';
COMMENT ON FUNCTION public.gc_trade_decline(uuid, uuid) IS 'GC mode (P2a): pass on an ask from the portal (tradeDecline), before a quote is in. Service role only.';
COMMENT ON FUNCTION public.gc_trade_ask_question(uuid, uuid, text, text[]) IS 'GC mode (P2a): a question about the plans of a trade the company was asked to quote (tradeAskQuestion), under gc_record_question''s closing day. Service role only.';

-- Only the service role: the submit function, after it has turned a link into its company.
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.gc_trade_ask(uuid, uuid)',
    'public.gc_trade_current_rev(uuid)',
    'public.gc_trade_got_it(uuid)',
    'public.gc_trade_set_lang(uuid, text)',
    'public.gc_trade_mail_groups(text[])',
    'public.gc_trade_add_person(uuid, text, text, text, text[])',
    'public.gc_trade_remove_person(uuid, uuid)',
    'public.gc_trade_set_gets(uuid, uuid, text[])',
    'public.gc_trade_open_plans(uuid, uuid)',
    'public.gc_trade_quote_day(uuid, uuid, date)',
    'public.gc_trade_submit_quote(uuid, uuid, jsonb)',
    'public.gc_trade_newest_quote(uuid)',
    'public.gc_trade_confirm_quote(uuid, uuid)',
    'public.gc_trade_answer_lines(uuid, uuid, jsonb)',
    'public.gc_trade_decline(uuid, uuid)',
    'public.gc_trade_ask_question(uuid, uuid, text, text[])'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END;
$$;
