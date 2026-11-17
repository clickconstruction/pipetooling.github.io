SET lock_timeout = '3s';

-- v2.7609 (punch list #371, step 3): the office marks a sub's note answered.
--
-- A sub can say from their page that something is wrong on a statement or a payment (sub_paper_acks, kind
-- something_wrong). That note is the one answer that asks the office to act, so the Pay view flags the sheet. A
-- flag nobody can put down is a flag nobody trusts: this lets the office say the note was answered, once, with who
-- and when. The note itself is never changed or removed.
--
--   1. sub_paper_acks gains answered_at, answered_by and answered_by_name.
--   2. answer_sub_paper_ack(p_ack_id) stamps them, for the office roles who see sub pay. The table stays read only
--      by grant: this definer function is the one way a signed-in person writes it, and these three columns are all
--      it writes.
--
-- Additive, and idempotent: safe to apply twice. No table is created, so no fence is called.

ALTER TABLE public.sub_paper_acks ADD COLUMN IF NOT EXISTS answered_at timestamptz;
ALTER TABLE public.sub_paper_acks ADD COLUMN IF NOT EXISTS answered_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.sub_paper_acks ADD COLUMN IF NOT EXISTS answered_by_name text;

COMMENT ON COLUMN public.sub_paper_acks.answered_at IS
  'When the office marked a something_wrong note answered (punch list #371). NULL while it waits. Written only by answer_sub_paper_ack.';
COMMENT ON COLUMN public.sub_paper_acks.answered_by IS
  'Who marked the note answered.';
COMMENT ON COLUMN public.sub_paper_acks.answered_by_name IS
  'Their name as it read that day, kept if the account goes.';

-- The Pay view reads the notes that still wait.
CREATE INDEX IF NOT EXISTS sub_paper_acks_waiting_idx
  ON public.sub_paper_acks (person_id) WHERE kind = 'something_wrong' AND answered_at IS NULL;

-- Mark one note answered and hand back when. A note is answered once: a second press hands back the first time and
-- changes nothing.
CREATE OR REPLACE FUNCTION public.answer_sub_paper_ack(p_ack_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kind text;
  v_at timestamptz;
  v_name text;
BEGIN
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office roles who see sub pay can mark a sub''s note answered.' USING ERRCODE = '42501';
  END IF;
  -- A definer function runs past the row fences, so it holds them itself.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot mark a sub''s note answered.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot mark a sub''s note answered.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'An archived account cannot mark a sub''s note answered.' USING ERRCODE = '42501';
  END IF;
  SELECT a.kind, a.answered_at INTO v_kind, v_at FROM public.sub_paper_acks a WHERE a.id = p_ack_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That note is gone.' USING ERRCODE = 'P0002';
  END IF;
  IF v_kind <> 'something_wrong' THEN
    RAISE EXCEPTION 'Only a note that something is wrong can be marked answered.' USING ERRCODE = '22023';
  END IF;
  IF v_at IS NOT NULL THEN
    RETURN v_at;
  END IF;
  SELECT u.name INTO v_name FROM public.users u WHERE u.id = auth.uid();
  UPDATE public.sub_paper_acks SET answered_at = now(), answered_by = auth.uid(), answered_by_name = v_name
    WHERE id = p_ack_id RETURNING answered_at INTO v_at;
  RETURN v_at;
END;
$$;

COMMENT ON FUNCTION public.answer_sub_paper_ack(uuid) IS
  'Punch list #371: the office marks a sub''s something_wrong note answered, once, with who and when. Office staff only; a training account, a digital twin and an archived account are refused.';

REVOKE ALL ON FUNCTION public.answer_sub_paper_ack(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.answer_sub_paper_ack(uuid) TO authenticated;
