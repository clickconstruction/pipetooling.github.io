SET lock_timeout = '3s';

-- GC mode, the Board (v2.8440): taking an ask back. gc_invite_companies (20261008020000) asks a company to quote a
-- trade, and until now an ask only ever closed with the company's own answer: Will not do it or Cannot do it, the
-- trade's pass in its portal, or a quote. An ask made on the wrong company, or on a test trade (punch list #416's
-- walk 1c), stayed for good, and gc_remove_bench_company (20261109004500) keeps any company that was asked. The
-- owner's word of 2026-11-24: add the way to take it back.
--
--   * gc_take_ask_back(p_invite_id) takes back an ask the company never heard about, and only that one. The row is
--     deleted, with the office's own notes on it (how 'note', by cascade): the company was never told, so it reads as
--     never asked, which is true. An ask is NOT marked withdrawn. A withdrawn state would be a new answer on
--     gc_invites that the board, the trade's portal and every function that reads an ask would each have to learn,
--     and an ask the company did hear about already has its honest close: Will not do it or Cannot do it, in the
--     company's words. So the function refuses those in words instead of deleting them.
--   * What it refuses, the first found naming the refusal: the trade is awarded to this ask; a statement of work
--     names it; a quote is in; the company already passed; the company opened it in its portal (status past
--     'invited', or seen_rev set); we emailed them about it (gc_trade_messages, the invitation or a nudge keyed by
--     the ask); a contact with them is logged on it (a call, a text, an email, a nudge, their portal: any line that
--     is not the office's note).
--   * After it, gc_remove_bench_company lets go of a company whose only history was that ask, by its own rule,
--     unchanged: nothing of the ask is left on the company. A company we emailed, or whose portal was opened, stays,
--     as that rule says.
--   * The trace. The ask is gone and its company may follow, so the undo cannot live on either. gc_asks_taken_back
--     keeps one row a take-back: the trade, the company by id (let go if the company is removed) and by its name
--     that day, who asked and when, who took it back and when. The office team reads it; only this function writes.
--   * SECURITY DEFINER, since gc_trade_messages and gc_sows read under narrower policies than the office's. The door
--     is who may ask, gc_office_team() (gc_invites' own policy since door 2), said in words; a training account, a
--     digital twin and an archived caller are refused first, since a definer passes their fences.
--   * One table is made, so the four fence calls close the file. Everything is CREATE … IF NOT EXISTS or OR REPLACE.

CREATE TABLE IF NOT EXISTS public.gc_asks_taken_back (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  -- The company asked. Null: it left the bench since (gc_remove_bench_company). Its name that day stays.
  company_id uuid REFERENCES public.gc_companies(id) ON DELETE SET NULL,
  company_name text NOT NULL
    CONSTRAINT gc_asks_taken_back_named CHECK (btrim(company_name) <> ''),
  -- The ask as it was: the day it was made and who made it.
  asked_on date NOT NULL,
  asked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- The take-back: the company's day, who pressed, and their name as it read.
  taken_back_on date NOT NULL DEFAULT public.app_today(),
  taken_back_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_asks_taken_back IS
  'GC mode (v2.8440): one row per ask taken back by gc_take_ask_back, which deletes the ask itself: the trade, the company (by id until it leaves the bench, and by its name that day), who asked and when, who took it back and when. Append only; written by gc_take_ask_back alone. The office team reads it.';

CREATE INDEX IF NOT EXISTS gc_asks_taken_back_package_idx ON public.gc_asks_taken_back (package_id);
CREATE INDEX IF NOT EXISTS gc_asks_taken_back_company_idx ON public.gc_asks_taken_back (company_id);
CREATE INDEX IF NOT EXISTS gc_asks_taken_back_asked_by_idx ON public.gc_asks_taken_back (asked_by);
CREATE INDEX IF NOT EXISTS gc_asks_taken_back_taken_back_by_idx ON public.gc_asks_taken_back (taken_back_by);

ALTER TABLE public.gc_asks_taken_back ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gc_asks_taken_back_office_read ON public.gc_asks_taken_back;
CREATE POLICY gc_asks_taken_back_office_read ON public.gc_asks_taken_back FOR SELECT TO authenticated
  USING ((SELECT public.gc_office_team()));
REVOKE ALL ON public.gc_asks_taken_back FROM anon;
-- No write policy: the definer below is the only writer.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.gc_asks_taken_back FROM authenticated;

CREATE OR REPLACE FUNCTION public.gc_take_ask_back(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v record;
  v_hold text;
  v_by text;
  -- Where an ask the company heard about closes: its own two presses, in the company's words.
  c_close CONSTANT text := 'Close an ask they heard about with Will not do it or Cannot do it.';
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

  SELECT i.id, i.status, i.seen_rev, i.invited_on, i.invited_by, i.company_id, c.name AS company,
         k.id AS package_id, k.trade, k.awarded_invite_id
  INTO v
  FROM public.gc_invites i
  JOIN public.gc_trade_packages k ON k.id = i.package_id
  JOIN public.gc_companies c ON c.id = i.company_id
  WHERE i.id = p_invite_id
  FOR UPDATE OF i;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That ask is not on a GC trade.' USING ERRCODE = 'P0001';
  END IF;

  -- The first thing found names the refusal: what stands on the ask, then the company's own answer, then whether
  -- they heard about it at all.
  v_hold := CASE
    WHEN v.awarded_invite_id = v.id THEN 'the trade is awarded to them. Take the award back first, in Compare quotes.'
    WHEN EXISTS (SELECT 1 FROM public.gc_sows s WHERE s.invite_id = v.id) THEN 'a statement of work names this ask.'
    WHEN v.status = 'bid' OR EXISTS (SELECT 1 FROM public.gc_quotes q WHERE q.invite_id = v.id)
      THEN 'they sent a quote. A quote stays on their record.'
    WHEN v.status = 'declined' THEN 'they already passed on it. Their answer stays on their record.'
    WHEN v.status <> 'invited' OR v.seen_rev IS NOT NULL THEN 'they opened it in their portal. ' || c_close
    WHEN EXISTS (SELECT 1 FROM public.gc_trade_messages m WHERE m.company_id = v.company_id AND m.msg_key LIKE v.id::text || ':%')
      THEN 'we emailed them about it. ' || c_close
    WHEN EXISTS (SELECT 1 FROM public.gc_company_contacts x WHERE x.invite_id = v.id AND x.how <> 'note')
      THEN 'a contact with them is logged on it. ' || c_close
    ELSE NULL
  END;
  IF v_hold IS NOT NULL THEN
    RAISE EXCEPTION '% stays asked on %, since %', v.company, v.trade, v_hold USING ERRCODE = 'P0001';
  END IF;

  SELECT u.name INTO v_by FROM public.users u WHERE u.id = auth.uid();
  INSERT INTO public.gc_asks_taken_back (package_id, company_id, company_name, asked_on, asked_by, taken_back_by, by_name)
  VALUES (v.package_id, v.company_id, v.company, v.invited_on, v.invited_by, auth.uid(), coalesce(v_by, ''));

  -- The ask goes, with the office's own notes on it by cascade. The checks above found nothing else on it.
  DELETE FROM public.gc_invites WHERE id = v.id;
END;
$$;

COMMENT ON FUNCTION public.gc_take_ask_back(uuid) IS
  'GC mode (v2.8440): take back an ask the company never heard about. Refuses in words an ask the trade is awarded to, one a statement of work names, one with a quote, one the company passed on, one it opened in its portal, one we emailed them about and one with a contact logged; else writes the take-back to gc_asks_taken_back (who asked and when, who took it back and when) and deletes the ask with the office''s notes on it. SECURITY DEFINER: the office team (gc_office_team()); a training account, a digital twin and an archived caller are refused first.';
REVOKE ALL ON FUNCTION public.gc_take_ask_back(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_take_ask_back(uuid) TO authenticated, service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
