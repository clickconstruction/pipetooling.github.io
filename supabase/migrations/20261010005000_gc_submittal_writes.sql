SET lock_timeout = '3s';

-- GC mode, the real build, the Building lane's U4a (v2.5037): the submittal register on real data, its
-- presses. The office adds a submittal with its number and the work it holds, records a round that came
-- by email, marks it sent to the architect and records the architect's answer; the trade sends a round
-- from its portal. Each refuses in words what the prototype's reducer refuses (addSubmittal,
-- tradeSendSubmittal, sendSubmittalToArchitect, answerSubmittal). The office's presses are SECURITY
-- INVOKER, so RLS decides who may: dev only until Building's door. The trade's is the service role's
-- only. The portal's submit function calls it once it has turned a link into its company, and a refusal
-- raises a key the page says in the company's language, as the Portal's P2a verbs do. The last round a
-- trade owed keeps its promise to send them (gc_keep_promises, decision 9). Plan:
-- to-dos/gc-mode/mockups/building-u4.md on spike/gc-mode. Tables: 20261008030000_gc_building_records.
-- The award it reads: 20261009140000_gc_award_and_sow (B6-a).

-- Whose move a submittal is, from its newest round (the prototype's submittalState): the trade's while
-- nothing came in or the architect sent it back to revise, ours once it came in, the architect's while
-- it is with them, and approved once they approved it, as noted or not.
CREATE OR REPLACE FUNCTION public.gc_submittal_move(p_submittal_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce((
    SELECT CASE
      WHEN x.answer = 'revise' THEN 'trade'
      WHEN x.answer IS NOT NULL THEN 'approved'
      WHEN x.to_architect_on IS NOT NULL THEN 'architect'
      ELSE 'us'
    END
    FROM public.gc_submittal_rounds x
    WHERE x.submittal_id = p_submittal_id
    ORDER BY x.round DESC
    LIMIT 1
  ), 'trade')
$$;

-- Add a submittal to a trade's register (addSubmittal): its number from the spec section, the work it
-- holds until approved, and the days from approval to on site. Refuses a training account, a digital
-- twin, our own crew's trade, a trade not awarded, a blank title, a kind the register does not know and a
-- hold on another trade's work.
CREATE OR REPLACE FUNCTION public.gc_add_submittal(s jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pkg uuid;
  v_project uuid;
  v_ours boolean;
  v_awarded uuid;
  v_title text := btrim(coalesce(s->>'title', ''));
  v_kind text := btrim(coalesce(s->>'kind', ''));
  v_section text := nullif(btrim(coalesce(s->>'specSection', '')), '');
  v_holds uuid[];
  v_n integer;
  v_number text;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  -- The tables' read-only blocks and the twin fence refuse the writes too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot add a submittal.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot add a submittal.' USING ERRCODE = '42501';
  END IF;
  v_pkg := nullif(btrim(coalesce(s->>'packageId', '')), '')::uuid;
  IF v_pkg IS NULL THEN
    RAISE EXCEPTION 'Which trade the submittal is for is missing.' USING ERRCODE = 'P0001';
  END IF;
  SELECT k.project_id, k.ours, k.awarded_invite_id INTO v_project, v_ours, v_awarded
  FROM public.gc_trade_packages k WHERE k.id = v_pkg;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No trade with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_ours THEN
    RAISE EXCEPTION 'Our own crew sends no submittals.' USING ERRCODE = 'P0001';
  END IF;
  IF v_awarded IS NULL THEN
    RAISE EXCEPTION 'This trade is not awarded yet. Its submittals start once it is.' USING ERRCODE = 'P0001';
  END IF;
  IF v_title = '' THEN
    RAISE EXCEPTION 'Say what the submittal covers.' USING ERRCODE = 'P0001';
  END IF;
  IF v_kind NOT IN ('product data', 'shop drawings', 'samples') THEN
    RAISE EXCEPTION 'Pick product data, shop drawings or samples.' USING ERRCODE = 'P0001';
  END IF;

  -- The work it holds: this trade's scope lines, each once (decision 2).
  v_holds := ARRAY(
    SELECT DISTINCT btrim(h)::uuid
    FROM jsonb_array_elements_text(coalesce(s->'lineIds', '[]'::jsonb)) h
    WHERE btrim(h) <> ''
  );
  IF EXISTS (
    SELECT 1 FROM unnest(v_holds) h(id)
    WHERE NOT EXISTS (SELECT 1 FROM public.gc_scope_items i WHERE i.id = h.id AND i.package_id = v_pkg)
  ) THEN
    RAISE EXCEPTION 'A submittal holds only its own trade’s work.' USING ERRCODE = 'P0001';
  END IF;

  -- Its number (nextSubmittalNumber): the spec section and a count, "26 24 16-02", or a plain count when
  -- it names no section. One press at a time on a job, so two at once never take the same number, and a
  -- number left by a removed submittal is skipped rather than taken twice.
  PERFORM pg_advisory_xact_lock(hashtextextended('gc_submittal_number:' || v_project::text, 0));
  IF v_section IS NULL THEN
    SELECT count(*) INTO v_n FROM public.gc_submittals WHERE project_id = v_project;
  ELSE
    SELECT count(*) INTO v_n FROM public.gc_submittals WHERE project_id = v_project AND spec_section = v_section;
  END IF;
  LOOP
    v_n := v_n + 1;
    v_number := CASE
      WHEN v_section IS NULL THEN lpad(v_n::text, greatest(3, length(v_n::text)), '0')
      ELSE v_section || '-' || lpad(v_n::text, greatest(2, length(v_n::text)), '0')
    END;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.gc_submittals WHERE project_id = v_project AND number = v_number);
  END LOOP;

  INSERT INTO public.gc_submittals (project_id, package_id, number, title, kind, spec_section, lead_days, needed_by, asked_on)
  VALUES (
    v_project,
    v_pkg,
    v_number,
    v_title,
    v_kind,
    v_section,
    greatest(0, round(coalesce((s->>'leadDays')::numeric, 0)))::integer,
    nullif(btrim(coalesce(s->>'neededBy', '')), '')::date,
    public.app_today()
  )
  RETURNING id INTO v_id;
  INSERT INTO public.gc_submittal_holds (submittal_id, scope_item_id)
  SELECT v_id, h FROM unnest(v_holds) h;
  RETURN v_id;
END;
$$;

-- A round that came by email (decision 6): the office records the file by name with its Drive link and
-- the trade's note, while it is the trade's move. When it was the last one the trade owed, the trade's
-- promise to send them is kept.
CREATE OR REPLACE FUNCTION public.gc_submittal_came_in(r jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sub uuid;
  v_project uuid;
  v_pkg uuid;
  v_file text := btrim(coalesce(r->>'file', ''));
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record a submittal.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record a submittal.' USING ERRCODE = '42501';
  END IF;
  v_sub := nullif(btrim(coalesce(r->>'submittalId', '')), '')::uuid;
  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Which submittal this is for is missing.' USING ERRCODE = 'P0001';
  END IF;
  -- Every round write takes the submittal first, so two presses at once never number the same round.
  SELECT s.project_id, s.package_id INTO v_project, v_pkg FROM public.gc_submittals s WHERE s.id = v_sub FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No submittal with that id.' USING ERRCODE = 'P0001';
  END IF;
  CASE public.gc_submittal_move(v_sub)
    WHEN 'us' THEN
      RAISE EXCEPTION 'It came in already. Send it to the architect next.' USING ERRCODE = 'P0001';
    WHEN 'architect' THEN
      RAISE EXCEPTION 'It is with the architect. Record their answer next.' USING ERRCODE = 'P0001';
    WHEN 'approved' THEN
      RAISE EXCEPTION 'It is approved already.' USING ERRCODE = 'P0001';
    ELSE
      NULL;
  END CASE;
  IF v_file = '' THEN
    RAISE EXCEPTION 'Name the file that came in.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.gc_submittal_rounds (submittal_id, round, sent_on, sent_by, file_name, drive_url, note)
  VALUES (
    v_sub,
    (SELECT coalesce(max(x.round), 0) + 1 FROM public.gc_submittal_rounds x WHERE x.submittal_id = v_sub),
    public.app_today(),
    'office',
    v_file,
    nullif(btrim(coalesce(r->>'driveUrl', '')), ''),
    btrim(coalesce(r->>'note', ''))
  )
  RETURNING id INTO v_id;

  -- The last one the trade owed keeps its promise to send them (decision 9).
  IF NOT EXISTS (SELECT 1 FROM public.gc_submittals s WHERE s.package_id = v_pkg AND public.gc_submittal_move(s.id) = 'trade') THEN
    PERFORM public.gc_keep_promises(i.company_id, 'submittals', v_project, v_pkg, public.app_today())
    FROM public.gc_trade_packages k JOIN public.gc_invites i ON i.id = k.awarded_invite_id
    WHERE k.id = v_pkg;
  END IF;
  RETURN v_id;
END;
$$;

-- Sent to the architect (sendSubmittalToArchitect): the newest round's day it went, and the email that took
-- it there when gc-architect-email sent it. No email: we sent it another way. Only while it is ours.
CREATE OR REPLACE FUNCTION public.gc_send_submittal_to_architect(p_submittal_id uuid, p_email_send_log_id uuid DEFAULT NULL)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := public.app_today();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record a submittal.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record a submittal.' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.gc_submittals s WHERE s.id = p_submittal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No submittal with that id.' USING ERRCODE = 'P0001';
  END IF;
  CASE public.gc_submittal_move(p_submittal_id)
    WHEN 'trade' THEN
      RAISE EXCEPTION 'Nothing has come in from the trade to send.' USING ERRCODE = 'P0001';
    WHEN 'architect' THEN
      RAISE EXCEPTION 'It went to the architect already.' USING ERRCODE = 'P0001';
    WHEN 'approved' THEN
      RAISE EXCEPTION 'It is approved already.' USING ERRCODE = 'P0001';
    ELSE
      NULL;
  END CASE;

  UPDATE public.gc_submittal_rounds x
  SET to_architect_on = v_today, email_send_log_id = p_email_send_log_id
  WHERE x.submittal_id = p_submittal_id
    AND x.round = (SELECT max(y.round) FROM public.gc_submittal_rounds y WHERE y.submittal_id = p_submittal_id);
  RETURN v_today;
END;
$$;

-- The architect's answer on the newest round (answerSubmittal): approved, approved as noted, or revise with
-- what to change, which makes it the trade's move again. Only while it is with the architect.
CREATE OR REPLACE FUNCTION public.gc_answer_submittal(p_submittal_id uuid, p_answer text, p_note text DEFAULT '')
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := public.app_today();
  v_answer text := btrim(coalesce(p_answer, ''));
  v_note text := btrim(coalesce(p_note, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record a submittal.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record a submittal.' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.gc_submittals s WHERE s.id = p_submittal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No submittal with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_answer NOT IN ('approved', 'approved as noted', 'revise') THEN
    RAISE EXCEPTION 'Pick approved, approved as noted or revise.' USING ERRCODE = 'P0001';
  END IF;
  CASE public.gc_submittal_move(p_submittal_id)
    WHEN 'trade' THEN
      RAISE EXCEPTION 'Nothing is with the architect. It is the trade’s move.' USING ERRCODE = 'P0001';
    WHEN 'us' THEN
      RAISE EXCEPTION 'It has not gone to the architect yet.' USING ERRCODE = 'P0001';
    WHEN 'approved' THEN
      RAISE EXCEPTION 'It is approved already.' USING ERRCODE = 'P0001';
    ELSE
      NULL;
  END CASE;
  IF v_answer = 'revise' AND v_note = '' THEN
    RAISE EXCEPTION 'Say what to change before you send it back.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.gc_submittal_rounds x
  SET answered_on = v_today, answer = v_answer, answer_note = v_note
  WHERE x.submittal_id = p_submittal_id
    AND x.round = (SELECT max(y.round) FROM public.gc_submittal_rounds y WHERE y.submittal_id = p_submittal_id);
  RETURN v_today;
END;
$$;

-- A round from the trade's portal (tradeSendSubmittal), the first time or after a revise: the file by name,
-- its Drive link once the portal uploads it (P5), and a note. Only the company the trade is awarded to, and
-- only while it is the trade's move. The last one it owed keeps its promise to send them.
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
    nullif(btrim(coalesce(p_drive_url, '')), ''),
    btrim(coalesce(p_note, ''))
  )
  RETURNING id INTO v_id;

  IF NOT EXISTS (SELECT 1 FROM public.gc_submittals s WHERE s.package_id = v_pkg AND public.gc_submittal_move(s.id) = 'trade') THEN
    PERFORM public.gc_keep_promises(p_company_id, 'submittals', v_project, v_pkg, public.app_today());
  END IF;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_submittal_move(uuid) IS
  'GC mode (v2.5037): whose move a submittal is, from its newest round (submittalState): trade, us, architect or approved. A submittal with no round is the trade''s.';
COMMENT ON FUNCTION public.gc_add_submittal(jsonb) IS
  'GC mode (v2.5037): add a submittal to an awarded trade''s register (addSubmittal), numbered by its spec section (nextSubmittalNumber), with the scope lines it holds. Refuses a training account, a digital twin, our own crew''s trade, a trade not awarded, a blank title, an unknown kind and another trade''s line. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_submittal_came_in(jsonb) IS
  'GC mode (v2.5037): the office records a round that came by email, with the file''s name and Drive link, while it is the trade''s move; the last one owed keeps the trade''s promise. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_send_submittal_to_architect(uuid, uuid) IS
  'GC mode (v2.5037): the newest round went to the architect today, with the email that took it (gc-architect-email) or none when sent another way. Only while it is ours. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_answer_submittal(uuid, text, text) IS
  'GC mode (v2.5037): the architect''s answer on the newest round (answerSubmittal): approved, approved as noted, or revise with a note, which makes it the trade''s move again. Only while it is with the architect. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_trade_submittal_send(uuid, uuid, text, text, text) IS
  'GC mode (v2.5037): a round from the trade''s portal (tradeSendSubmittal) by the company the trade is awarded to, while it is the trade''s move: notFound, notYours, notYourMove, fileNeeded. The last one owed keeps its promise. Service role only.';

REVOKE ALL ON FUNCTION public.gc_submittal_move(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_submittal_move(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_submittal_move(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gc_add_submittal(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_add_submittal(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_add_submittal(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.gc_submittal_came_in(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_submittal_came_in(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_submittal_came_in(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.gc_send_submittal_to_architect(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_send_submittal_to_architect(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_send_submittal_to_architect(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.gc_answer_submittal(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_answer_submittal(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_answer_submittal(uuid, text, text) TO authenticated;

-- Only the service role: the portal's submit function, after it has turned a link into its company.
REVOKE ALL ON FUNCTION public.gc_trade_submittal_send(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_trade_submittal_send(uuid, uuid, text, text, text) TO service_role;
