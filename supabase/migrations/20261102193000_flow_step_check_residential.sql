SET lock_timeout = '3s';

-- v2.6385 — Today's sends: Stop reminding on this job and Hold until… find a residential customer's step
-- (docs/migrations/20261102193000_flow_step_check_residential.md).
--
-- A residential customer's own contact is kind `customer`: contact_find_or_make writes that kind for every customer,
-- and contacts_kind_known has no `residential`. The steps the app prepares for them are the residential flow's all the
-- same: a moved first visit's Rescheduled text on `booked` (v2.5597), the Tell the customer sheet's and the Pipeline's
-- forward moves. flow_step_check joined the flow by the contact's kind alone, so every press on such a step was
-- refused `stepUnknown`: flow_skip_step behind Stop reminding on this job, nudge_hold_until behind Hold until…,
-- flow_add_note, and nudge_record_sent behind the Send press (Taunya's report, 2026-11-02, a homeowner's moved-visit
-- text). The check now reads the person's flow as the app does: their kind's, and the residential flow too for a
-- customer contact whose customers row says residential (through the contact's own customer_id, or the named person's
-- customer_contact_persons row, as flow_rows_for resolves them). SECURITY DEFINER now, where it was INVOKER: which
-- flow a person is on is a fact of the person, not of who asks, and the customers policy shows an assistant only the
-- customers of masters who adopted her and a controller none, so as the caller the check would still send such a
-- press to the GC flow. It reads five tables and writes nothing; the write that follows each press keeps its own
-- policies. The refusal keeps its code, for the clients that read it, and names the step in DETAIL. No table.

CREATE OR REPLACE FUNCTION public.flow_step_check(p_contact uuid, p_step text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.contacts c
    LEFT JOIN public.customer_contact_persons cp ON cp.id = c.customer_contact_person_id
    LEFT JOIN public.customers cu ON cu.id = coalesce(c.customer_id, cp.customer_id)
    JOIN public.flows f
      ON f.kind = c.kind
      OR (c.kind = 'customer' AND f.kind = 'residential' AND cu.customer_type = 'residential')
    JOIN public.flow_steps s ON s.flow_id = f.id AND s.step_key = p_step
    WHERE c.id = p_contact
  ) THEN
    RAISE EXCEPTION 'stepUnknown' USING ERRCODE = 'P0001',
      DETAIL = format('The step %s is not on this person''s flow.', p_step);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.flow_step_check(uuid, text) IS
  'Messages flows (cut 4): the step must be on the person''s flow, else stepUnknown with the step in DETAIL. Since v2.6385 a customer contact whose customers row says residential finds the residential flow''s steps too, since contacts have no residential kind; SECURITY DEFINER so the answer does not depend on which customers the caller may read.';

REVOKE ALL ON FUNCTION public.flow_step_check(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flow_step_check(uuid, text) TO authenticated, service_role;
