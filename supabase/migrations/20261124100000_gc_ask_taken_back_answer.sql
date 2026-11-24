SET lock_timeout = '3s';

-- GC mode, the Board (v2.8490): the answer for an ask we took back after the company heard about it.
-- gc_take_ask_back (20261124050000, v2.8440) deletes an ask the company never heard about and refused every other one,
-- pointing at Will not do it and Cannot do it. Those two are the company's words. An ask made on the wrong company
-- that was already emailed, opened or called on had no honest close: the office had to write down that the company
-- would not do it, which is false, and their record then counted a pass they never made. The owner's word of
-- 2026-11-24: build the withdrawn answer for an ask they heard about.
--
--   * A third answer on the ask. gc_invites.declined_why takes 'withdrawn' beside 'wont' and 'cant'. The ask's status
--     is 'declined' as for the other two, so everything that reads an ask as out (the count of quotes wanted, who is
--     emailed a new plan set, the trade's lock on its own writes) reads it right with no change. The words are what
--     change, in the kernels: the chip reads "we took it back", never "passed".
--   * gc_take_ask_back(p_invite_id) now closes such an ask instead of refusing it. Same gate, same order. It still
--     refuses in words an ask the trade is awarded to, one a statement of work names, one with a quote, and one that is
--     closed already. Then: an ask the company never heard about is deleted, as before, with its row in
--     gc_asks_taken_back. An ask they opened in their portal, were emailed about or were called on is kept and closed:
--     status 'declined', declined_why 'withdrawn', declined_on the company's day. Nothing is deleted on that path, and
--     nothing is sent.
--   * The trace on the kept path. The ask itself says what and when (declined_why, declined_on). Who is one line on the
--     company's own call log (gc_company_contacts with no ask, how 'note'), which the company's Activity shows, as
--     gc_take_award_back writes its undo: the trade and the job, the day it was asked and by whom, what they had heard,
--     and who took it back. gc_asks_taken_back stays the ledger of the asks that were deleted, since those leave
--     nothing else behind.
--   * The trade's own writes. gc_trade_ask is the lock every portal verb on an ask starts with, and it refused a
--     closed ask with the key youPassed, which the portal says as "You passed on this one." On an ask we took back it
--     now raises tookBack, which the portal says in our words. The function is restated whole with that one branch
--     added. Nothing else in it changes.
--   * No table is made, so no fence call. The CHECK is dropped and added in one statement, and the functions are
--     CREATE OR REPLACE, so the push is idempotent. gc_invites is a small table: the new CHECK is validated at once.

ALTER TABLE public.gc_invites
  DROP CONSTRAINT IF EXISTS gc_invites_declined_why_known,
  ADD CONSTRAINT gc_invites_declined_why_known CHECK (declined_why IS NULL OR declined_why IN ('wont', 'cant', 'withdrawn'));

COMMENT ON COLUMN public.gc_invites.declined_why IS
  'GC mode: why a closed ask is out. wont or cant: the office took the company''s no by phone (gc_office_decline). withdrawn (v2.8490): we took the ask back after they heard about it (gc_take_ask_back). Null on a closed ask: the trade passed in its portal (gc_trade_decline).';

CREATE OR REPLACE FUNCTION public.gc_take_ask_back(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v record;
  v_hold text;
  v_heard text;
  v_by text;
  v_asked_by text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to take an ask back.' USING ERRCODE = 'P0001';
  END IF;
  -- Who may take an ask back: whoever may ask (gc_invites' policy since door 2).
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office takes an ask back.' USING ERRCODE = '42501';
  END IF;
  -- A definer passes the read-only blocks, the twin fence and the archived seal, so each is said here before the write.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot take an ask back.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot take an ask back.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'An archived account cannot take an ask back.' USING ERRCODE = '42501';
  END IF;

  SELECT i.id, i.status, i.seen_rev, i.invited_on, i.invited_by, i.declined_why, i.company_id, c.name AS company,
         k.id AS package_id, k.trade, k.awarded_invite_id, p.name AS project
  INTO v
  FROM public.gc_invites i
  JOIN public.gc_trade_packages k ON k.id = i.package_id
  JOIN public.projects p ON p.id = k.project_id
  JOIN public.gc_companies c ON c.id = i.company_id
  WHERE i.id = p_invite_id
  FOR UPDATE OF i;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That ask is not on a GC trade.' USING ERRCODE = 'P0001';
  END IF;

  -- An ask we took back already says so in its own words: nothing stays asked.
  IF v.status = 'declined' AND v.declined_why = 'withdrawn' THEN
    RAISE EXCEPTION 'The ask to % on % is already taken back.', v.company, v.trade USING ERRCODE = 'P0001';
  END IF;

  -- What no take-back passes, the first found naming the refusal: what stands on the ask, then the company's own answer.
  v_hold := CASE
    WHEN v.awarded_invite_id = v.id THEN 'the trade is awarded to them. Take the award back first, in Compare quotes.'
    WHEN EXISTS (SELECT 1 FROM public.gc_sows s WHERE s.invite_id = v.id) THEN 'a statement of work names this ask.'
    WHEN v.status = 'bid' OR EXISTS (SELECT 1 FROM public.gc_quotes q WHERE q.invite_id = v.id)
      THEN 'they sent a quote. A quote stays on their record.'
    WHEN v.status = 'declined' THEN 'they already passed on it. Their answer stays on their record.'
    ELSE NULL
  END;
  IF v_hold IS NOT NULL THEN
    RAISE EXCEPTION '% stays asked on %, since %', v.company, v.trade, v_hold USING ERRCODE = 'P0001';
  END IF;

  -- What the company heard, the first found. Null: nothing, and the ask is deleted.
  v_heard := CASE
    WHEN v.status <> 'invited' OR v.seen_rev IS NOT NULL THEN 'They had opened it in their portal.'
    WHEN EXISTS (SELECT 1 FROM public.gc_trade_messages m WHERE m.company_id = v.company_id AND m.msg_key LIKE v.id::text || ':%')
      THEN 'We had emailed them about it.'
    WHEN EXISTS (SELECT 1 FROM public.gc_company_contacts x WHERE x.invite_id = v.id AND x.how <> 'note')
      THEN 'A contact with them was logged on it.'
    ELSE NULL
  END;

  SELECT u.name INTO v_by FROM public.users u WHERE u.id = auth.uid();

  IF v_heard IS NULL THEN
    INSERT INTO public.gc_asks_taken_back (package_id, company_id, company_name, asked_on, asked_by, taken_back_by, by_name)
    VALUES (v.package_id, v.company_id, v.company, v.invited_on, v.invited_by, auth.uid(), coalesce(v_by, ''));
    -- The ask goes, with the office's own notes on it by cascade. The checks above found nothing else on it.
    DELETE FROM public.gc_invites WHERE id = v.id;
    RETURN;
  END IF;

  -- They heard about it, so the ask stays and closes with our answer. Nothing is deleted and nothing is sent.
  UPDATE public.gc_invites
  SET status = 'declined', declined_why = 'withdrawn', decline_reason = NULL, decline_note = '', declined_on = public.app_today()
  WHERE id = v.id;

  SELECT u.name INTO v_asked_by FROM public.users u WHERE u.id = v.invited_by;
  INSERT INTO public.gc_company_contacts (company_id, contacted_on, by_name, how, note)
  VALUES (
    v.company_id, public.app_today(), coalesce(v_by, ''), 'note',
    'Ask taken back on ' || v.trade || ', ' || v.project || '. Asked ' || to_char(v.invited_on, 'Mon FMDD')
      || CASE WHEN coalesce(v_asked_by, '') <> '' THEN ' by ' || v_asked_by ELSE '' END
      || '. ' || v_heard
  );
END;
$$;

COMMENT ON FUNCTION public.gc_take_ask_back(uuid) IS
  'GC mode (v2.8440, v2.8490): take an ask back. Refuses in words an ask the trade is awarded to, one a statement of work names, one with a quote, one the company passed on and one already taken back. An ask the company never heard about is deleted with the office''s notes on it, and gc_asks_taken_back keeps who asked and who took it back. An ask they opened in their portal, were emailed about or were called on is kept and closed as ours (status declined, declined_why withdrawn, declined_on), with one line on the company''s own call log saying who took it back and what they had heard. Sends nothing. SECURITY DEFINER: the office team (gc_office_team()); a training account, a digital twin and an archived caller are refused first.';
REVOKE ALL ON FUNCTION public.gc_take_ask_back(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_take_ask_back(uuid) TO authenticated, service_role;

-- The company's ask, held to the company: the verbs that act on an ask start here. Refuses another company's ask, a
-- bid we lost, an ask the company passed on, and (v2.8490) an ask we took back, in its own key.
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
  IF v_invite.status = 'declined' AND v_invite.declined_why = 'withdrawn' THEN
    RAISE EXCEPTION 'tookBack' USING ERRCODE = 'P0001', DETAIL = 'We took this ask back.';
  END IF;
  IF v_invite.status = 'declined' THEN
    RAISE EXCEPTION 'youPassed' USING ERRCODE = 'P0001', DETAIL = 'The company passed on this ask.';
  END IF;
  RETURN v_invite;
END;
$$;

COMMENT ON FUNCTION public.gc_trade_ask(uuid, uuid) IS
  'GC mode (P2a): the company''s ask, locked: refuses another company''s ask (notYours), a bid we lost (projectLost), an ask we took back (tookBack, v2.8490) and an ask it passed on (youPassed). Service role only.';
