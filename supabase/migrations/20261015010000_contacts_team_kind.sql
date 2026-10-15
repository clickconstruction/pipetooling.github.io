SET lock_timeout = '3s';

-- Messages: an eighth kind of contact, a teammate (v2.5546; the owner, 2026-10-14: "Sometimes a number is an internal
-- team member. I think it's important to be able to list them because there are some benefits that we can get from
-- automated messaging from the app to internal team members"). A teammate is someone on the roster (`people`) whose
-- kind is not sub, through the spine's person_id, as a sub is. Until now a roster person who was not a sub was named a
-- trade partner (contacts_subs_from_roster, kindOf in kernel.ts); from here they are a teammate, the rows already on
-- the spine included. The seed gives every roster person, not archived, a contact with the number and address the
-- roster holds, so a text from a number on file lands on them with no Who is this?. name_contact takes 'team' on a
-- roster row that is not a sub and fills the roster's blank phone with the number named (contact_phone_to_roster, a
-- definer the office alone may call), so the app knows the number next time and can text it. No new table.

-- ---------- the eighth kind ----------

ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_kind_known;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_kind_known
  CHECK (kind IN ('customer', 'trade', 'arch', 'lead', 'supply_house', 'candidate', 'sub', 'team', 'unknown'));

-- A roster row's contact is a sub when the roster says sub, else a teammate: the rows named a trade partner (or
-- anything else) on a roster row before today move over.
UPDATE public.contacts c SET kind = CASE WHEN p.kind = 'sub' THEN 'sub' ELSE 'team' END
FROM public.people p
WHERE p.id = c.person_id AND c.kind IS DISTINCT FROM (CASE WHEN p.kind = 'sub' THEN 'sub' ELSE 'team' END);

-- As before, and a roster row is a sub or a teammate, nothing else.
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_kind_record;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_kind_record CHECK (
  (prospect_id IS NULL OR kind = 'lead')
  AND ((supply_house_id IS NULL AND supply_house_contact_id IS NULL) = (kind <> 'supply_house'))
  AND ((team_prospect_id IS NULL) = (kind <> 'candidate'))
  AND ((person_id IS NULL) = (kind NOT IN ('sub', 'team')))
);

COMMENT ON TABLE public.contacts IS
  'Messages (cut 1, the spine; eight kinds since v2.5546): a person the app already has, as the thread hangs off them. Points at exactly one record (customer_id, customer_contact_person_id, gc_company_id, gc_company_person_id, person_id, prospect_id, supply_house_id, supply_house_contact_id or team_prospect_id), or at none for a number nobody has named or a lead not yet on Prospects. A roster row (person_id) is a sub when the roster says sub, else a teammate (team).';

-- ---------- the roster learns a number the office named ----------

-- Fills a roster person's blank phone with the first number on a contact, once Who is this? named the number as them.
-- A definer, since the office may not write the roster itself; the office alone may call it (gc_office_team).
CREATE OR REPLACE FUNCTION public.contact_phone_to_roster(p_contact_id uuid, p_person_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
BEGIN
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'officeOnly' USING ERRCODE = 'P0001', DETAIL = 'Only the office names a teammate''s number.';
  END IF;
  SELECT ch.value INTO v_phone FROM public.contact_channels ch
  WHERE ch.contact_id = p_contact_id AND ch.kind = 'phone'
  ORDER BY ch.created_at, ch.id
  LIMIT 1;
  IF v_phone IS NULL THEN
    RETURN false;
  END IF;
  UPDATE public.people SET phone = v_phone
  WHERE id = p_person_id AND coalesce(btrim(phone), '') = '';
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.contact_phone_to_roster(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_phone_to_roster(uuid, uuid) TO authenticated;

-- ---------- name_contact takes a teammate ----------

-- As 20261013180000_contacts_seven_kinds.sql, with 'team': a roster row that is not a sub, and never one of the
-- spine's three kinds; the roster learns the number.
CREATE OR REPLACE FUNCTION public.name_contact(
  p_contact_id uuid,
  p_record_table text,
  p_record_id uuid,
  p_kind text,
  p_name text DEFAULT NULL,
  p_job_kind text DEFAULT NULL,
  p_job_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_contact public.contacts%ROWTYPE;
  v_into uuid;
  v_name text;
  v_untied uuid[];
  v_exists boolean;
  v_fits boolean;
BEGIN
  SELECT * INTO v_contact FROM public.contacts WHERE id = p_contact_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No contact with that id.';
  END IF;
  IF v_contact.kind NOT IN ('unknown', 'lead') THEN
    RAISE EXCEPTION 'namedAlready' USING ERRCODE = 'P0001', DETAIL = 'This contact is named already.';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('customer', 'trade', 'arch', 'lead', 'supply_house', 'candidate', 'sub', 'team') THEN
    RAISE EXCEPTION 'kindNeeded' USING ERRCODE = 'P0001',
      DETAIL = 'Say what they are to us: a customer, trade partner, architect, lead, supply house, candidate, sub or teammate.';
  END IF;
  -- A null table reads as no, never as unknown, so a lead named with no record is refused too.
  IF v_contact.kind = 'lead' AND NOT coalesce(
    (p_kind = 'lead' AND p_record_table = 'prospects' AND v_contact.prospect_id IS NULL)
    OR (p_kind = 'customer' AND p_record_table IN ('customers', 'customer_contact_persons')), false)
  THEN
    RAISE EXCEPTION 'namedAlready' USING ERRCODE = 'P0001',
      DETAIL = 'A lead is named again only when added to Prospects or when they book as a customer.';
  END IF;

  IF p_record_table IS NULL AND p_record_id IS NULL THEN
    -- A lead with no record: the one kind that needs none.
    IF p_kind <> 'lead' THEN
      RAISE EXCEPTION 'recordNeeded' USING ERRCODE = 'P0001', DETAIL = 'Pick who they are.';
    END IF;
  ELSE
    IF p_record_id IS NULL OR p_record_table IS NULL
       OR p_record_table NOT IN ('customers', 'customer_contact_persons', 'gc_companies', 'gc_company_people', 'people',
                                 'prospects', 'supply_houses', 'supply_house_contacts', 'team_prospects') THEN
      RAISE EXCEPTION 'recordNeeded' USING ERRCODE = 'P0001', DETAIL = 'Pick who they are.';
    END IF;
    v_exists := CASE p_record_table
      WHEN 'customers' THEN EXISTS (SELECT 1 FROM public.customers WHERE id = p_record_id)
      WHEN 'customer_contact_persons' THEN EXISTS (SELECT 1 FROM public.customer_contact_persons WHERE id = p_record_id)
      WHEN 'gc_companies' THEN EXISTS (SELECT 1 FROM public.gc_companies WHERE id = p_record_id)
      WHEN 'gc_company_people' THEN EXISTS (SELECT 1 FROM public.gc_company_people WHERE id = p_record_id)
      WHEN 'people' THEN EXISTS (SELECT 1 FROM public.people WHERE id = p_record_id)
      WHEN 'prospects' THEN EXISTS (SELECT 1 FROM public.prospects WHERE id = p_record_id)
      WHEN 'supply_houses' THEN EXISTS (SELECT 1 FROM public.supply_houses WHERE id = p_record_id)
      WHEN 'supply_house_contacts' THEN EXISTS (SELECT 1 FROM public.supply_house_contacts WHERE id = p_record_id)
      ELSE EXISTS (SELECT 1 FROM public.team_prospects WHERE id = p_record_id)
    END;
    IF NOT v_exists THEN
      RAISE EXCEPTION 'recordNotFound' USING ERRCODE = 'P0001', DETAIL = 'Nobody with that id.';
    END IF;
    -- What the record makes them (kindOf in kernel.ts): the new records their own kind, a sub only from the roster's
    -- subs, and the spine's three kinds on the spine's five records as the office picks.
    v_fits := CASE
      WHEN p_record_table = 'prospects' THEN p_kind = 'lead'
      WHEN p_record_table IN ('supply_houses', 'supply_house_contacts') THEN p_kind = 'supply_house'
      WHEN p_record_table = 'team_prospects' THEN p_kind = 'candidate'
      WHEN p_kind = 'sub' THEN p_record_table = 'people' AND EXISTS (SELECT 1 FROM public.people WHERE id = p_record_id AND kind = 'sub')
      -- A teammate is anyone else on the roster (v2.5546); a roster row is never one of the spine's three kinds.
      WHEN p_kind = 'team' THEN p_record_table = 'people' AND EXISTS (SELECT 1 FROM public.people WHERE id = p_record_id AND kind <> 'sub')
      ELSE p_kind IN ('customer', 'trade', 'arch') AND p_record_table <> 'people'
    END;
    IF NOT v_fits THEN
      RAISE EXCEPTION 'kindDoesNotFit' USING ERRCODE = 'P0001', DETAIL = 'That record is not that kind of person.';
    END IF;
  END IF;
  PERFORM public.contact_job_check(p_job_kind, p_job_id);

  -- This number's lines with no job, to tie when a job was picked.
  v_untied := ARRAY(
    SELECT id FROM public.messages
    WHERE contact_id = p_contact_id AND bid_id IS NULL AND project_id IS NULL AND jobs_ledger_id IS NULL AND direction <> 'team');

  IF p_record_table IS NULL THEN
    UPDATE public.contacts SET kind = 'lead', name = coalesce(nullif(btrim(coalesce(p_name, '')), ''), name)
    WHERE id = p_contact_id;
    v_into := p_contact_id;
  ELSE
    v_name := public.contact_name_on(p_record_table, p_record_id, p_name);
    SELECT id INTO v_into FROM public.contacts
    WHERE id <> p_contact_id
      AND CASE p_record_table
        WHEN 'customers' THEN customer_id = p_record_id AND lower(btrim(coalesce(name, ''))) = lower(coalesce(v_name, ''))
        WHEN 'customer_contact_persons' THEN customer_contact_person_id = p_record_id
        WHEN 'gc_companies' THEN gc_company_id = p_record_id AND lower(btrim(coalesce(name, ''))) = lower(coalesce(v_name, ''))
        WHEN 'gc_company_people' THEN gc_company_person_id = p_record_id
        WHEN 'people' THEN person_id = p_record_id
        WHEN 'prospects' THEN prospect_id = p_record_id
        WHEN 'supply_houses' THEN supply_house_id = p_record_id AND lower(btrim(coalesce(name, ''))) = lower(coalesce(v_name, ''))
        WHEN 'supply_house_contacts' THEN supply_house_contact_id = p_record_id
        ELSE team_prospect_id = p_record_id
      END
    FOR UPDATE;

    IF v_into IS NULL THEN
      UPDATE public.contacts SET
        kind = p_kind,
        customer_id = CASE WHEN p_record_table = 'customers' THEN p_record_id END,
        customer_contact_person_id = CASE WHEN p_record_table = 'customer_contact_persons' THEN p_record_id END,
        gc_company_id = CASE WHEN p_record_table = 'gc_companies' THEN p_record_id END,
        gc_company_person_id = CASE WHEN p_record_table = 'gc_company_people' THEN p_record_id END,
        person_id = CASE WHEN p_record_table = 'people' THEN p_record_id END,
        prospect_id = CASE WHEN p_record_table = 'prospects' THEN p_record_id END,
        supply_house_id = CASE WHEN p_record_table = 'supply_houses' THEN p_record_id END,
        supply_house_contact_id = CASE WHEN p_record_table = 'supply_house_contacts' THEN p_record_id END,
        team_prospect_id = CASE WHEN p_record_table = 'team_prospects' THEN p_record_id END,
        name = v_name
      WHERE id = p_contact_id;
      v_into := p_contact_id;
    ELSE
      PERFORM public.contacts_fold(p_contact_id, v_into);
    END IF;
  END IF;

  -- A teammate's number goes on the roster when the roster has none, so the app knows it next time (v2.5546).
  IF p_kind = 'team' THEN
    PERFORM public.contact_phone_to_roster(v_into, p_record_id);
  END IF;

  IF p_job_kind IS NOT NULL THEN
    INSERT INTO public.contact_jobs (contact_id, bid_id, project_id, jobs_ledger_id, is_default)
    SELECT v_into,
      CASE WHEN p_job_kind = 'bid' THEN p_job_id END,
      CASE WHEN p_job_kind = 'project' THEN p_job_id END,
      CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END,
      NOT EXISTS (SELECT 1 FROM public.contact_jobs WHERE contact_id = v_into AND is_default)
    ON CONFLICT DO NOTHING;
    UPDATE public.messages SET
      bid_id = CASE WHEN p_job_kind = 'bid' THEN p_job_id END,
      project_id = CASE WHEN p_job_kind = 'project' THEN p_job_id END,
      jobs_ledger_id = CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END
    WHERE id = ANY (v_untied);
  END IF;
  RETURN v_into;
END;
$$;

-- ---------- the roster's subs and teammates ----------

-- A roster person's contact is a sub while the roster's kind is sub, and a teammate otherwise (kindOf in kernel.ts;
-- a trade partner before v2.5546). Everyone on the roster, not archived, has a contact with the number and address
-- the roster holds for them. Returns how many contacts it made or changed; runs again without adding anything.
CREATE OR REPLACE FUNCTION public.contacts_subs_from_roster()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_changed integer;
  v_made integer;
BEGIN
  UPDATE public.contacts c SET kind = CASE WHEN p.kind = 'sub' THEN 'sub' ELSE 'team' END
  FROM public.people p
  WHERE p.id = c.person_id AND c.kind IS DISTINCT FROM (CASE WHEN p.kind = 'sub' THEN 'sub' ELSE 'team' END);
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  INSERT INTO public.contacts (kind, person_id)
  SELECT CASE WHEN p.kind = 'sub' THEN 'sub' ELSE 'team' END, p.id FROM public.people p
  WHERE p.archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.contacts x WHERE x.person_id = p.id);
  GET DIAGNOSTICS v_made = ROW_COUNT;

  INSERT INTO public.contact_channels (contact_id, kind, value)
  SELECT x.id, v.kind, btrim(v.value)
  FROM public.contacts x
  JOIN public.people p ON p.id = x.person_id
  CROSS JOIN LATERAL (VALUES ('phone', p.phone), ('email', p.email)) AS v(kind, value)
  WHERE x.kind IN ('sub', 'team') AND public.contact_channel_key(v.kind, v.value) <> ''
  ON CONFLICT DO NOTHING;

  RETURN v_changed + v_made;
END;
$$;

SELECT public.contacts_subs_from_roster();
