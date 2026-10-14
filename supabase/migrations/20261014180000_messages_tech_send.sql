SET lock_timeout = '3s';

-- Messages, residential R5 (to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md → R5, on branch spike/gc-mode): the doors
-- quo-send's tech path needs, so a tech on a job texts its customer from Job Mode. No table, so no fences.
--
--   * messages_tech_on_job(p_job_id): the signed-in tech (messages_tech_team(), 20261013190000) is dispatched to the
--     job (job_schedule_blocks.assignee_user_id) or clocked on it (clock_sessions.user_id, not revoked), Monday of last
--     week through Sunday of this week in Chicago. It is the span rule messages_tech_can_read held, now in one place.
--   * messages_tech_can_read(p_contact_id) is recreated from its newest definition (20261013190000) to ask
--     messages_tech_on_job of each of the contact's jobs: the same contacts, the same jobs, the same answer. Its two
--     policies (contacts_tech_read, messages_tech_read) call it by name and are left as they are.
--   * contact_find_or_make(p_customer_id): the find-or-make body contact_for_customer held (20261014020000), as a
--     function of its own both doors call. No grant to anyone signed in: only a definer below reaches it.
--   * contact_for_customer(p_customer_id) is recreated from its newest definition with its refusals as they were, the
--     office team's door, and calls contact_find_or_make for the rest.
--   * contact_for_job(p_job_id): the tech's door. A tech on the job (messages_tech_on_job) gets the job's customer's own
--     contact, made when there is none, with the same refusals for a training account and a digital twin before a
--     write. A job with no customer is said in words.

-- ---------- a tech on a job ----------

CREATE OR REPLACE FUNCTION public.messages_tech_on_job(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH span AS (
    SELECT date_trunc('week', now() AT TIME ZONE 'America/Chicago')::date - 7 AS first_day,
           date_trunc('week', now() AT TIME ZONE 'America/Chicago')::date + 6 AS last_day
  )
  SELECT public.messages_tech_team() AND EXISTS (
    SELECT 1 FROM span s
    WHERE EXISTS (
        SELECT 1 FROM public.job_schedule_blocks b
        WHERE b.job_id = p_job_id AND b.assignee_user_id = auth.uid() AND b.work_date BETWEEN s.first_day AND s.last_day
      )
      OR EXISTS (
        SELECT 1 FROM public.clock_sessions k
        WHERE k.job_ledger_id = p_job_id AND k.user_id = auth.uid() AND k.revoked_at IS NULL
          AND k.work_date BETWEEN s.first_day AND s.last_day
      )
  );
$$;

COMMENT ON FUNCTION public.messages_tech_on_job(uuid) IS
  'Messages, R5 (v2.5499): whether the signed-in tech (messages_tech_team) is dispatched to or clocked on this Pipeline job this week or last, Monday to Sunday in Chicago. The span rule messages_tech_can_read and contact_for_job ask.';

REVOKE EXECUTE ON FUNCTION public.messages_tech_on_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.messages_tech_on_job(uuid) TO authenticated, service_role;

-- Recreated from 20261013190000: the same contacts and jobs, the span asked of messages_tech_on_job.
CREATE OR REPLACE FUNCTION public.messages_tech_can_read(p_contact_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH c AS (
    SELECT ct.id, coalesce(ct.customer_id, ccp.customer_id) AS customer_id
    FROM public.contacts ct
    LEFT JOIN public.customer_contact_persons ccp ON ccp.id = ct.customer_contact_person_id
    WHERE ct.id = p_contact_id AND ct.kind IN ('customer', 'lead', 'sub')
  ),
  jobs AS (
    SELECT cj.jobs_ledger_id AS job_id FROM public.contact_jobs cj JOIN c ON cj.contact_id = c.id WHERE cj.jobs_ledger_id IS NOT NULL
    UNION
    SELECT jl.id FROM public.jobs_ledger jl JOIN c ON jl.customer_id = c.customer_id
  )
  SELECT public.messages_tech_team() AND EXISTS (SELECT 1 FROM jobs j WHERE public.messages_tech_on_job(j.job_id));
$$;

COMMENT ON FUNCTION public.messages_tech_can_read(uuid) IS
  'Messages, R5 (v2.5419, its span in messages_tech_on_job since v2.5499): whether the signed-in tech (messages_tech_team) reads this contact''s thread: a customer, lead or sub whose Pipeline job (tied in contact_jobs, or its customer''s) the tech is dispatched to or clocked on this week or last, Monday to Sunday in Chicago.';

REVOKE EXECUTE ON FUNCTION public.messages_tech_can_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.messages_tech_can_read(uuid) TO authenticated, service_role;

-- ---------- a customer's own contact, found or made ----------

-- The body contact_for_customer held (20261014020000), for the two doors below. It checks nobody: each door says its
-- refusals first, so no grant goes to anyone signed in.
CREATE OR REPLACE FUNCTION public.contact_find_or_make(p_customer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact uuid;
  v_info jsonb;
BEGIN
  SELECT c.contact_info INTO v_info FROM public.customers c WHERE c.id = p_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That customer is not there.' USING ERRCODE = 'P0001';
  END IF;

  -- Their own contact: on their row, with no name (a name says which other person on the row it is).
  SELECT x.id INTO v_contact FROM public.contacts x WHERE x.customer_id = p_customer_id AND x.name IS NULL;
  IF v_contact IS NOT NULL THEN
    RETURN v_contact;
  END IF;

  -- A definer passes the read-only blocks and the twin fence, so each is said here before the first write.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot start a customer''s thread.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot start a customer''s thread.' USING ERRCODE = '42501';
  END IF;

  -- Two presses at once make one contact: the second meets the spine's one-contact index and reads the first's.
  INSERT INTO public.contacts (kind, customer_id)
  VALUES ('customer', p_customer_id)
  ON CONFLICT (customer_id, lower(btrim(coalesce(name, '')))) WHERE customer_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_contact;
  IF v_contact IS NULL THEN
    SELECT x.id INTO v_contact FROM public.contacts x WHERE x.customer_id = p_customer_id AND x.name IS NULL;
    RETURN v_contact;
  END IF;

  INSERT INTO public.contact_channels (contact_id, kind, value)
  SELECT v_contact, v.kind, btrim(v.value)
  FROM (VALUES ('phone', v_info ->> 'phone'), ('email', v_info ->> 'email')) AS v(kind, value)
  WHERE public.contact_channel_key(v.kind, v.value) <> ''
  ON CONFLICT DO NOTHING;
  RETURN v_contact;
END;
$$;

COMMENT ON FUNCTION public.contact_find_or_make(uuid) IS
  'Messages, R5 (v2.5499): a customer''s own contact (on their customers row, no name), made when there is none, kind customer, with contact_info''s phone and email as its channels. Called only by the doors contact_for_customer (the office) and contact_for_job (a tech on the job), which say their refusals first; no grant to anyone signed in.';

REVOKE ALL ON FUNCTION public.contact_find_or_make(uuid) FROM PUBLIC, anon, authenticated;

-- Recreated from 20261014020000: the office team's door, its refusals as they were.
CREATE OR REPLACE FUNCTION public.contact_for_customer(p_customer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to open a customer''s messages.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office opens a customer''s messages.' USING ERRCODE = '42501';
  END IF;
  RETURN public.contact_find_or_make(p_customer_id);
END;
$$;

COMMENT ON FUNCTION public.contact_for_customer(uuid) IS
  'Messages, residential R2 (v2.5437): the customer''s own contact (on their customers row, no name), made when there is none, through contact_find_or_make (v2.5499). SECURITY DEFINER: the office team (gc_office_team()) only, said in words; a training account and a digital twin may find one and never make one.';

REVOKE ALL ON FUNCTION public.contact_for_customer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_for_customer(uuid) TO authenticated, service_role;

-- ---------- the tech's door ----------

CREATE OR REPLACE FUNCTION public.contact_for_job(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to message a customer.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.messages_tech_on_job(p_job_id) THEN
    RAISE EXCEPTION 'Only a tech on this job sends from Job Mode.' USING ERRCODE = '42501';
  END IF;
  SELECT jl.customer_id INTO v_customer FROM public.jobs_ledger jl WHERE jl.id = p_job_id;
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'This job has no customer yet.' USING ERRCODE = 'P0001';
  END IF;
  RETURN public.contact_find_or_make(v_customer);
END;
$$;

COMMENT ON FUNCTION public.contact_for_job(uuid) IS
  'Messages, R5 (v2.5499): the tech''s door. For a tech dispatched to or clocked on this Pipeline job (messages_tech_on_job), the job''s customer''s own contact, made when there is none (contact_find_or_make). SECURITY DEFINER: refusals said in words; a training account and a digital twin may find one and never make one.';

REVOKE ALL ON FUNCTION public.contact_for_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_for_job(uuid) TO authenticated, service_role;
