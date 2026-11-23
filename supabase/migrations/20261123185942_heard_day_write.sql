SET lock_timeout = '3s';

-- v2.8383 — A day was heard, say what it is (punch list #421, PR 2 of 5).
--
-- When a person names a day still ahead in their own text or voicemail, Messages draws one press under the line: the day
-- is a promise of their quote, a start or delivery, insurance or a W-9 (a trade partner); their answer on our bid or a
-- day we can be on site (a customer); their answer or the certificate (an architect); or just talk. The owner's call of
-- 2026-11-23 is straight to the choice: no offered row waits for someone to name it later. `write_down` takes only an
-- offered row, and nothing a signed-in client can call makes one, so the press needs its own write.
--
-- 1. `write_down_heard(p_message_id, p_kind, p_day, p_writes)` writes the line's day and its kind in one press, as
--    `write_down_payment` does for a payment: it makes the row when the line has none, and writes over an offered day or
--    a day called just talk. The same kind again takes a new day. A day written as another kind is somebody's answer,
--    and is refused in words. A null kind is just talk, kept with its day. Only a customer's, a trade partner's or an
--    architect's own text or voicemail takes one, the lines the press draws under, and each person only the kinds the
--    screen offers them (`promiseChoices` in src/lib/messages/promises.ts). A payment is refused here: it is written on
--    the job through Write down their word (#129's sheet), so a payment has one road. A start or delivery writes a
--    start, and insurance or a W-9 writes insurance, unless `p_writes` says the other, as `write_down` does.
-- 2. A payment mark carries its job (the card's small extra): `message_promises.job_id`, the Pipeline job (`jobs_ledger`)
--    a payment mark is for, and `p_job_id` on `write_down_payment`. A customer has one thread, so before this a customer
--    with two jobs promised saw each job's They promised row name the other's day. No foreign key: adding one would lock
--    `jobs_ledger`, the busiest table, while crews use the app. The function checks the job is there instead, and a job
--    deleted later leaves a mark that names no job on the screen. `write_down_payment` is dropped and made again with the
--    new argument last and defaulted, so a client calling it the old way keeps working.
--
-- Both are SECURITY DEFINER with Follow up's own guard (`follow_up_press`: a sign-in, no training account, no digital
-- twin, the office team), since `message_promises` grants a client no insert. No table is created. Idempotent.

ALTER TABLE public.message_promises ADD COLUMN IF NOT EXISTS job_id uuid;

COMMENT ON COLUMN public.message_promises.job_id IS
  'Punch list #421 (v2.8383): the Pipeline job (jobs_ledger.id) a payment mark is for, written by write_down_payment''s p_job_id; null for a mark from before, or any other kind. No foreign key, so jobs_ledger is never locked to add one; the writer checks the job is there.';

CREATE OR REPLACE FUNCTION public.write_down_heard(p_message_id uuid, p_kind text, p_day date, p_writes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('write down a promise');
  v_who text;
  v_direction text;
  v_channel text;
  v_writes text;
  v_row public.message_promises%ROWTYPE;
BEGIN
  IF p_day IS NULL THEN
    RAISE EXCEPTION 'Say which day first.' USING ERRCODE = 'P0001';
  END IF;
  SELECT c.kind, m.direction, m.channel INTO v_who, v_direction, v_channel
  FROM public.messages m JOIN public.contacts c ON c.id = m.contact_id
  WHERE m.id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That line is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_direction <> 'in' OR v_channel NOT IN ('text', 'voicemail') THEN
    RAISE EXCEPTION 'A day is written on their own text or voicemail.' USING ERRCODE = 'P0001';
  END IF;
  IF v_who NOT IN ('customer', 'trade', 'arch') THEN
    RAISE EXCEPTION 'Only a customer, a trade partner or an architect makes a promise here.' USING ERRCODE = 'P0001';
  END IF;
  IF p_kind = 'payment' THEN
    RAISE EXCEPTION 'A payment is written on the job. Press A payment to open its sheet.' USING ERRCODE = 'P0001';
  END IF;
  IF p_kind IS NOT NULL AND NOT (
    (v_who = 'customer' AND p_kind IN ('decision', 'access'))
    OR (v_who = 'arch' AND p_kind IN ('answer', 'cert'))
    OR (v_who = 'trade' AND p_kind IN ('quote', 'start', 'papers')))
  THEN
    RAISE EXCEPTION 'That is not a promise % makes.',
      CASE v_who WHEN 'customer' THEN 'a customer' WHEN 'arch' THEN 'an architect' ELSE 'a trade partner' END
      USING ERRCODE = 'P0001';
  END IF;
  v_writes := CASE p_kind WHEN 'start' THEN coalesce(p_writes, 'start') WHEN 'papers' THEN coalesce(p_writes, 'insurance') ELSE p_writes END;
  IF v_writes IS NOT NULL AND NOT (
    (p_kind = 'start' AND v_writes IN ('start', 'delivery')) OR (p_kind = 'papers' AND v_writes IN ('insurance', 'w9')))
  THEN
    RAISE EXCEPTION 'A start or delivery writes a start or a delivery, and insurance or a W-9 writes one of those.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row FROM public.message_promises
  WHERE message_id = p_message_id AND coalesce(kind, '') <> 'question'
  FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.message_promises (message_id, kind, state, day, writes, decided_by, decided_at)
    VALUES (p_message_id, p_kind, CASE WHEN p_kind IS NULL THEN 'no' ELSE 'written' END, p_day, v_writes, v_me, clock_timestamp());
    RETURN;
  END IF;
  -- A written day is somebody's answer: only the same kind may take a new day.
  IF v_row.state = 'written' AND v_row.kind IS DISTINCT FROM p_kind THEN
    RAISE EXCEPTION 'Someone has said what that day is already.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.message_promises
  SET kind = p_kind, state = CASE WHEN p_kind IS NULL THEN 'no' ELSE 'written' END, day = p_day, day_words = NULL,
      writes = v_writes, job_id = NULL, decided_by = v_me, decided_at = clock_timestamp()
  WHERE id = v_row.id;
END;
$$;

COMMENT ON FUNCTION public.write_down_heard(uuid, text, date, text) IS
  'Punch list #421 (v2.8383): a heard day said in one press. Writes the line''s message_promises row with its day and kind (made when the line has none; over an offered day or just talk; the same kind takes a new day; refused over a day written as another kind), or with no kind as just talk. A customer''s, a trade partner''s or an architect''s own text or voicemail, and only the kinds promiseChoices offers them; a payment is refused, since it is written through write_down_payment from the job''s sheet. Follow up''s guard: the office team, no training account, no digital twin.';

REVOKE EXECUTE ON FUNCTION public.write_down_heard(uuid, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_down_heard(uuid, text, date, text) TO authenticated, service_role;

-- As 20261122024419_write_down_payment.sql, with the mark's job. Dropped first: a third argument is a new signature.
DROP FUNCTION IF EXISTS public.write_down_payment(uuid, date);

CREATE OR REPLACE FUNCTION public.write_down_payment(p_message_id uuid, p_day date DEFAULT NULL, p_job_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('write down a promise');
  v_who text;
  v_direction text;
  v_channel text;
  v_row public.message_promises%ROWTYPE;
  v_has boolean;
BEGIN
  SELECT c.kind, m.direction, m.channel INTO v_who, v_direction, v_channel
  FROM public.messages m JOIN public.contacts c ON c.id = m.contact_id
  WHERE m.id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That line is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_who <> 'customer' OR v_direction <> 'in' OR v_channel NOT IN ('call', 'voicemail', 'missed', 'text', 'email') THEN
    RAISE EXCEPTION 'A payment promise is written on a customer''s own line.' USING ERRCODE = 'P0001';
  END IF;
  IF p_job_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = p_job_id) THEN
    RAISE EXCEPTION 'That job is not there.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row FROM public.message_promises
  WHERE message_id = p_message_id AND coalesce(kind, '') <> 'question'
  FOR UPDATE;
  v_has := FOUND;

  -- No day: the word was voided. A payment mark comes off as just talk, and its job with it; anything else on the line
  -- is not ours to touch.
  IF p_day IS NULL THEN
    IF v_has AND v_row.state = 'written' AND v_row.kind = 'payment' THEN
      UPDATE public.message_promises
      SET kind = NULL, state = 'no', job_id = NULL, decided_by = v_me, decided_at = clock_timestamp()
      WHERE id = v_row.id;
    END IF;
    RETURN;
  END IF;

  IF NOT v_has THEN
    INSERT INTO public.message_promises (message_id, kind, state, day, job_id, decided_by, decided_at)
    VALUES (p_message_id, 'payment', 'written', p_day, p_job_id, v_me, clock_timestamp());
    RETURN;
  END IF;
  IF v_row.state = 'written' AND v_row.kind <> 'payment' THEN
    RAISE EXCEPTION 'Someone has said what that day is already.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.message_promises
  SET kind = 'payment', state = 'written', day = p_day, day_words = NULL, writes = NULL, job_id = p_job_id,
      decided_by = v_me, decided_at = clock_timestamp()
  WHERE id = v_row.id;
END;
$$;

COMMENT ON FUNCTION public.write_down_payment(uuid, date, uuid) IS
  'Punch list #129 (v2.8268), with its job since #421 (v2.8383): the mark a payment word leaves on its line. Writes the line''s message_promises row as a payment with its day and the job it is for (made when the line has none; over an offered day, just talk or an earlier payment day; refused over a day written as another kind), or with no day takes a payment mark back off as just talk. A customer''s own call, voicemail, missed call, text or email only. Follow up''s guard: the office team, no training account, no digital twin.';

REVOKE EXECUTE ON FUNCTION public.write_down_payment(uuid, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_down_payment(uuid, date, uuid) TO authenticated, service_role;
