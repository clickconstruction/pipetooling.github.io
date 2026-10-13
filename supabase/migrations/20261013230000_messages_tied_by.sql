SET lock_timeout = '3s';

-- Messages, residential R7 (to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md → R7 on branch spike/gc-mode): who tied a
-- line to its job. A line from someone with a star lands on the starred job as it comes in (the Quo and email readers
-- write the contact's default job); a person can also tie it, or untie it, with tie_message. Until now the two looked
-- the same, so the New lane's Which job? could not tell a line the default took from one a person put there on purpose
-- (src/lib/followUp/newLane.ts, tiedByHand, v2.5394).
--
--   * messages.tied_by: the user whose tie_message last set the line's job, untying it included. Null when nobody has:
--     the line came in on the star, or on the person. The readers and set_default_job never write it; a star moved
--     later moves no line.
--   * tie_message stamps auth.uid(), and is otherwise as the spine wrote it (20261012010000_messages_spine.sql). It stays
--     SECURITY INVOKER, so the policies and the house fences still refuse training mode and a digital twin; the office
--     team gains UPDATE on the one column for it, as cut 2's back_by.
--   * No index: the New lane reads a contact's lines, which messages_thread (contact_id, at) already serves.
--   * No new table, so no fence calls.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS tied_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.messages.tied_by IS
  'Messages (R7): the user whose tie_message last set this line''s job, untying it included. Null when the line took the contact''s default job as it came in, or no job, and nobody has tied it since.';

GRANT UPDATE (tied_by) ON TABLE public.messages TO authenticated;

-- Ties a line to a job, or unties it (both null): the line then sits on the person. A job the person was not on yet goes
-- on their rail. Whoever presses is stamped as the one who tied it.
CREATE OR REPLACE FUNCTION public.tie_message(p_message_id uuid, p_job_kind text, p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_contact uuid;
BEGIN
  SELECT contact_id INTO v_contact FROM public.messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No message with that id.';
  END IF;
  PERFORM public.contact_job_check(p_job_kind, p_job_id);
  UPDATE public.messages SET
    bid_id = CASE WHEN p_job_kind = 'bid' THEN p_job_id END,
    project_id = CASE WHEN p_job_kind = 'project' THEN p_job_id END,
    jobs_ledger_id = CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END,
    tied_by = auth.uid()
  WHERE id = p_message_id;
  IF p_job_kind IS NOT NULL THEN
    INSERT INTO public.contact_jobs (contact_id, bid_id, project_id, jobs_ledger_id)
    VALUES (
      v_contact,
      CASE WHEN p_job_kind = 'bid' THEN p_job_id END,
      CASE WHEN p_job_kind = 'project' THEN p_job_id END,
      CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tie_message(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tie_message(uuid, text, uuid) TO authenticated, service_role;
