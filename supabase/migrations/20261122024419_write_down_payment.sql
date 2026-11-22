SET lock_timeout = '3s';

-- v2.8268 — A payment word marks its line (punch list #129, the leftovers).
--
-- Write down their word under a customer's line in Messages saves the day they said they will pay as the Pipeline's
-- payment promise (`add_job_payment_promise`). The line itself kept no mark of it, so the job's thread summary went on
-- reading *Nothing promised yet* and the thread's chip never read *Their move · until Fri · payment*. Both read
-- `message_promises`, and nothing a signed-in client can call writes a row there for a line with no offered day:
-- `write_down` takes an offered row, and no reader makes one.
--
-- `write_down_payment(p_message_id, p_day)` writes the line's promise as a payment with its day, in one press: it makes
-- the row when the line has none, and writes over an offered day, a day called just talk, or an earlier payment day
-- (the customer named a new one). A day already written as another kind is somebody's answer, and is refused in
-- words. With no day (`p_day` NULL) it takes a payment mark back off, as *just talk*, for a word the office voided
-- (*Never said that*); a line with no payment mark is left as it is. Only a customer's own call, voicemail, missed
-- call, text or email takes a mark, the lines the press draws under. SECURITY DEFINER with Follow up's own guard
-- (`follow_up_press`: a sign-in, no training account, no digital twin, the office team), since `message_promises`
-- grants a client no insert. No table is created or altered. Idempotent: the function is replaced.

CREATE OR REPLACE FUNCTION public.write_down_payment(p_message_id uuid, p_day date DEFAULT NULL)
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

  SELECT * INTO v_row FROM public.message_promises
  WHERE message_id = p_message_id AND coalesce(kind, '') <> 'question'
  FOR UPDATE;
  v_has := FOUND;

  -- No day: the word was voided. A payment mark comes off as just talk; anything else on the line is not ours to touch.
  IF p_day IS NULL THEN
    IF v_has AND v_row.state = 'written' AND v_row.kind = 'payment' THEN
      UPDATE public.message_promises
      SET kind = NULL, state = 'no', decided_by = v_me, decided_at = clock_timestamp()
      WHERE id = v_row.id;
    END IF;
    RETURN;
  END IF;

  IF NOT v_has THEN
    INSERT INTO public.message_promises (message_id, kind, state, day, decided_by, decided_at)
    VALUES (p_message_id, 'payment', 'written', p_day, v_me, clock_timestamp());
    RETURN;
  END IF;
  IF v_row.state = 'written' AND v_row.kind <> 'payment' THEN
    RAISE EXCEPTION 'Someone has said what that day is already.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.message_promises
  SET kind = 'payment', state = 'written', day = p_day, day_words = NULL, writes = NULL,
      decided_by = v_me, decided_at = clock_timestamp()
  WHERE id = v_row.id;
END;
$$;

COMMENT ON FUNCTION public.write_down_payment(uuid, date) IS
  'Punch list #129 (v2.8268): the mark a payment word leaves on its line. Writes the line''s message_promises row as a payment with its day (made when the line has none; over an offered day, just talk or an earlier payment day; refused over a day written as another kind), or with no day takes a payment mark back off as just talk. A customer''s own call, voicemail, missed call, text or email only. Follow up''s guard: the office team, no training account, no digital twin.';

REVOKE EXECUTE ON FUNCTION public.write_down_payment(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_down_payment(uuid, date) TO authenticated, service_role;
