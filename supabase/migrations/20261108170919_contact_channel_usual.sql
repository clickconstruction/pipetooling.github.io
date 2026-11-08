SET lock_timeout = '3s';

-- The usual number or address (punch list #118, PR 1, v2.6699). Every send picked by a rule and offered no
-- switch: the first number that could still take a text, which on a customer who texted from a second phone kept
-- answering the first. The office picks the number or the address a send goes to, and the pick is remembered on
-- the channel row itself (the card's call 1: a contact may have a usual number and a usual address at once, and
-- the row already carries opted_out_at, so a STOP on the usual drops it from the rule with no second table).
--
--   1. contact_channels.usual_at — when the office made this row their usual. One per kind per contact is the
--      function's rule, held by an ordinary index, not a unique one: name_contact folds a named number into the
--      record's own contact (UPDATE contact_channels SET contact_id), and a unique index would refuse the fold
--      when both sides carry a usual; the readers take the newest usual_at when two meet.
--   2. contact_channel_make_usual(p_channel) — the office team's one door (follow_up_press), a definer: stars the
--      row, clears the contact's other usual of the same kind, writes the gray line
--      "Rosa made (830) 555-0121 Dana's usual number." on the thread. Refuses a number that sent STOP. Starring
--      the usual again changes nothing and writes no line.
--
-- Additive and idempotent; no CREATE TABLE, so no new fences.

ALTER TABLE public.contact_channels ADD COLUMN IF NOT EXISTS usual_at timestamptz;
COMMENT ON COLUMN public.contact_channels.usual_at IS
  'When the office made this number or address the contact''s usual (punch list #118, v2.6699). The recipient rule reads it first: the usual, else the one the thread last carried a line on, else the first that can still take a text, else the first. One per kind per contact by contact_channel_make_usual; the readers take the newest when a fold (name_contact) brings two together.';

CREATE INDEX IF NOT EXISTS contact_channels_usual ON public.contact_channels (contact_id, kind) WHERE usual_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.contact_channel_make_usual(p_channel uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_row public.contact_channels%ROWTYPE;
  v_kind_words text;
BEGIN
  v_me := public.follow_up_press('pick their usual number');
  SELECT * INTO v_row FROM public.contact_channels WHERE id = p_channel FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That number is not on their record any more.' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.kind = 'phone' AND v_row.opted_out_at IS NOT NULL THEN
    RAISE EXCEPTION 'That number sent STOP. The app will not text it, so it cannot be their usual.' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.usual_at IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.contact_channels o
       WHERE o.contact_id = v_row.contact_id AND o.kind = v_row.kind AND o.id <> v_row.id AND o.usual_at IS NOT NULL
     ) THEN
    RETURN;
  END IF;
  UPDATE public.contact_channels SET usual_at = NULL
    WHERE contact_id = v_row.contact_id AND kind = v_row.kind AND id <> v_row.id AND usual_at IS NOT NULL;
  UPDATE public.contact_channels SET usual_at = clock_timestamp() WHERE id = v_row.id;
  v_kind_words := CASE WHEN v_row.kind = 'phone' THEN 'number' ELSE 'address' END;
  PERFORM public.follow_up_event(
    v_row.contact_id,
    format('%s made %s %s''s usual %s.', public.follow_up_user_name(v_me), v_row.value, public.contact_display_name(v_row.contact_id), v_kind_words)
  );
END;
$$;

COMMENT ON FUNCTION public.contact_channel_make_usual(uuid) IS
  'Punch list #118 (v2.6699): the office makes a number or an address the contact''s usual. Gated by follow_up_press (signed in, not a training account, not a twin, the office team). Clears the contact''s other usual of the same kind, refuses a number that sent STOP, writes the gray line on the thread. Already the usual: nothing changes and no line is written.';

REVOKE EXECUTE ON FUNCTION public.contact_channel_make_usual(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_channel_make_usual(uuid) TO authenticated, service_role;
