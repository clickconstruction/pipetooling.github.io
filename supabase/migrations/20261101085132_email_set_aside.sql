SET lock_timeout = '3s';

-- Punch list #223 PR 4 (v2.6231): the robot's first pass, written down. The bids@ reader already leaves out a sender
-- the office marked a notice (v2.6202) and a mail whose foot says unsubscribe (v2.6200); until now it left them in
-- Gmail and said nothing. Now each is a row here, New shows them folded with a count, and **Put back** on one marks it
-- for the next read, which takes it after all. Never a delete: nothing in Gmail changes either way.

CREATE TABLE IF NOT EXISTS public.email_set_aside (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox text NOT NULL CONSTRAINT email_set_aside_mailbox_known CHECK (mailbox IN ('bids', 'team')),
  gmail_id text NOT NULL,
  rfc_message_id text,
  from_address text NOT NULL,
  from_name text,
  subject text,
  -- When the mail came, as Gmail gives it.
  at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reason text NOT NULL CONSTRAINT email_set_aside_reason_known CHECK (reason IN ('marked_address', 'marked_domain', 'body_cue')),
  set_aside_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  -- Put back (email_put_back): the next read takes it, and stamps taken_at.
  put_back_at timestamptz,
  put_back_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  taken_at timestamptz,
  CONSTRAINT email_set_aside_one_per_mail UNIQUE (mailbox, gmail_id)
);

CREATE INDEX IF NOT EXISTS email_set_aside_waiting_idx ON public.email_set_aside (at DESC) WHERE put_back_at IS NULL;
CREATE INDEX IF NOT EXISTS email_set_aside_put_back_idx ON public.email_set_aside (mailbox) WHERE put_back_at IS NOT NULL AND taken_at IS NULL;

COMMENT ON TABLE public.email_set_aside IS
  'Punch list #223 PR 4 (v2.6231): each mail the bids@ reader set aside as a notice (a sender marked on email_left_out_senders, or an unsubscribe line at the foot), so New can count them and offer Put back. The reader writes as the service role; the office reads; email_put_back is the one write a person makes. Nothing in Gmail changes.';

ALTER TABLE public.email_set_aside ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_set_aside_office_reads ON public.email_set_aside;
CREATE POLICY email_set_aside_office_reads ON public.email_set_aside
  FOR SELECT TO authenticated
  USING (public.gc_office_team());
REVOKE ALL ON public.email_set_aside FROM anon;
GRANT SELECT ON public.email_set_aside TO authenticated;

-- Put back: the row is marked for the next read. follow_up_press, like every press on Follow up.
CREATE OR REPLACE FUNCTION public.email_put_back(p_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('put a notice back');
BEGIN
  UPDATE public.email_set_aside
    SET put_back_at = clock_timestamp(), put_back_by = v_me
    WHERE id = p_id AND put_back_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That one is put back already, or gone.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.email_put_back(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_put_back(uuid) TO authenticated;
COMMENT ON FUNCTION public.email_put_back(uuid) IS
  'Punch list #223 PR 4 (v2.6231): Put back on a notice the reader set aside. follow_up_press; marks the row, and the next gmail-sync run takes the mail after all.';

-- A new table: the read-only fences and the twins' fence, as CLAUDE.md asks.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
