SET lock_timeout = '3s';

-- Messages, residential R0 · 2 of 3, the SQL (to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md on branch
-- spike/gc-mode; the kernels are src/lib/contacts/kernel.ts and src/lib/followUp/queue.ts, v2.5390): seven kinds of
-- contact, the owner's call of 2026-10-13. A customer, a trade partner and an architect, as the spine has them, and four
-- more: a lead, a supply house, a candidate and a sub. The eighth value the check holds is the spine's own `unknown`, a
-- number nobody has named. No table is made.
--
--   * contacts gains four record columns beside the spine's five: prospect_id (a lead on Prospects), supply_house_id (a
--     supply house's counter, a company row that holds others by name, as a trade partner's does),
--     supply_house_contact_id (a rep, as the RFQ desk keeps them since supply_houses.email was retired) and
--     team_prospect_id (a candidate on the Team hiring board). A sub is a people row whose kind is sub, through the
--     spine's person_id.
--   * A lead points at its Prospects row or at nothing: a homeowner who texted is a lead with no record until someone
--     presses Add to Prospects (the lead's call, 2026-10-13). Each new record is its own kind and nothing else.
--   * name_contact names the new kinds, names a number a lead with no record, points a lead at its Prospects row, and
--     re-points a lead who books to the customer they became, keeping the thread (nameContact in kernel.ts).
--   * The record keys are ON DELETE RESTRICT, as the spine's are. Prospects, the hiring board and the supply houses are
--     deleted by the app's own screens, so the spine's trigger first moves a contact off the row.
--   * contacts_subs_from_roster() keeps a roster person's contact a sub while the roster says sub, and gives every sub
--     on the roster a contact with their number and address. contacts_from_supply_houses() gives each supply house's
--     counter and each rep at one a contact. Both run once below and again without adding anything.
--   * follow_up_count leaves out supply houses and candidates (OFF_FOLLOW_UP in queue.ts), and contact_display_name
--     reads the new records.
--   * A candidate's contact, numbers and lines read only to a dev and the hiring board (helper 9's review, the lead's
--     yes, 2026-10-13): three RESTRICTIVE read policies beside the spine's.

-- ---------- the four new records ----------

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS prospect_id uuid REFERENCES public.prospects(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS supply_house_id uuid REFERENCES public.supply_houses(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS supply_house_contact_id uuid REFERENCES public.supply_house_contacts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS team_prospect_id uuid REFERENCES public.team_prospects(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.contacts.prospect_id IS
  'Messages (R0): a lead on Prospects. A lead points here or at nothing, until they book and re-point to the customer.';
COMMENT ON COLUMN public.contacts.supply_house_id IS
  'Messages (R0): a supply house''s counter (name null), or someone else named on its row.';
COMMENT ON COLUMN public.contacts.supply_house_contact_id IS
  'Messages (R0): a rep at a supply house, as the RFQ desk keeps them.';
COMMENT ON COLUMN public.contacts.team_prospect_id IS
  'Messages (R0): a candidate on the Team hiring board.';

-- One contact per person, as the spine's five: a record of one person once, a supply house's row once per name (its
-- counter has none).
CREATE UNIQUE INDEX IF NOT EXISTS contacts_prospect_once ON public.contacts (prospect_id) WHERE prospect_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_supply_house_once ON public.contacts (supply_house_id, lower(btrim(coalesce(name, '')))) WHERE supply_house_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_supply_house_contact_once ON public.contacts (supply_house_contact_id) WHERE supply_house_contact_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_team_prospect_once ON public.contacts (team_prospect_id) WHERE team_prospect_id IS NOT NULL;

-- ---------- the seven kinds ----------

ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_kind_known;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_kind_known
  CHECK (kind IN ('customer', 'trade', 'arch', 'lead', 'supply_house', 'candidate', 'sub', 'unknown'));

-- Exactly one record, as before, but for a number nobody has named (none) and a lead (its Prospects row, or none).
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_one_record;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_one_record CHECK (
  num_nonnulls(customer_id, customer_contact_person_id, gc_company_id, gc_company_person_id, person_id,
               prospect_id, supply_house_id, supply_house_contact_id, team_prospect_id)
    = CASE kind WHEN 'unknown' THEN 0 WHEN 'lead' THEN num_nonnulls(prospect_id) ELSE 1 END
);

-- Each new record is its own kind: a Prospects row a lead, a supply house or its rep a supply house, a hiring board row
-- a candidate. A sub is someone on the roster. The spine's three kinds keep the spine's five records.
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_kind_record;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_kind_record CHECK (
  (prospect_id IS NULL OR kind = 'lead')
  AND ((supply_house_id IS NULL AND supply_house_contact_id IS NULL) = (kind <> 'supply_house'))
  AND ((team_prospect_id IS NULL) = (kind <> 'candidate'))
  AND (kind <> 'sub' OR person_id IS NOT NULL)
);

COMMENT ON TABLE public.contacts IS
  'Messages (cut 1, the spine; seven kinds since R0): a person the app already has, as the thread hangs off them. Points at exactly one record (customer_id, customer_contact_person_id, gc_company_id, gc_company_person_id, person_id, prospect_id, supply_house_id, supply_house_contact_id, team_prospect_id), or none for a number nobody has named (kind unknown) and for a lead nobody has added to Prospects. A person''s row is one contact; a company''s row (customer_id, gc_company_id, supply_house_id) is its own person (name null) and anyone else it holds by name. The office team''s.';

-- name_contact re-points a contact as the caller, so the caller may write the four columns as it may the spine's five.
GRANT UPDATE (prospect_id, supply_house_id, supply_house_contact_id, team_prospect_id) ON TABLE public.contacts TO authenticated;

-- ---------- a person on a company's row ----------

-- As 20261012010000_messages_spine.sql, with a supply house as a company row: its counter is the house's own person,
-- named by the house's name, and anyone else on it keeps their own name.
CREATE OR REPLACE FUNCTION public.contact_name_on(p_record_table text, p_record_id uuid, p_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_record_table NOT IN ('customers', 'gc_companies', 'supply_houses') THEN NULL
    WHEN nullif(btrim(coalesce(p_name, '')), '') IS NULL THEN NULL
    WHEN lower(btrim(p_name)) = lower(btrim(coalesce(
      CASE p_record_table
        WHEN 'customers' THEN (SELECT name FROM public.customers WHERE id = p_record_id)
        WHEN 'supply_houses' THEN (SELECT name FROM public.supply_houses WHERE id = p_record_id)
        ELSE (SELECT contact_name FROM public.gc_companies WHERE id = p_record_id)
      END, ''))) THEN NULL
    ELSE btrim(p_name)
  END
$$;

-- ---------- Who is this? ----------

-- As 20261012010000_messages_spine.sql, for seven kinds. Names a number nobody knew: the contact points at
-- p_record_table's p_record_id ('customers', 'customer_contact_persons', 'gc_companies', 'gc_company_people', 'people',
-- 'prospects', 'supply_houses', 'supply_house_contacts' or 'team_prospects') and keeps its thread; when another contact
-- already is that person, this one folds into it. A lead is named once more in two ways only: a lead with no record
-- points at the Prospects row Add to Prospects wrote, and a lead who booked re-points to the customer they became. With
-- no record at all, a number becomes a lead with no record, under p_name or the name it had. Each new record is its
-- own kind, and only a sub on the roster is a sub. On a company's row, p_name names a person the row has no room for
-- (contact_name_on). A job picked while naming goes on the person, takes the star when they have none, and ties this
-- number's untied lines. Returns the contact that holds the thread now.
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
  IF p_kind IS NULL OR p_kind NOT IN ('customer', 'trade', 'arch', 'lead', 'supply_house', 'candidate', 'sub') THEN
    RAISE EXCEPTION 'kindNeeded' USING ERRCODE = 'P0001',
      DETAIL = 'Say what they are to us: a customer, trade partner, architect, lead, supply house, candidate or sub.';
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
      ELSE p_kind IN ('customer', 'trade', 'arch')
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

-- ---------- a record deleted by the app's own screens ----------

-- As 20261012010000_messages_spine.sql, with the four new records. Each is deleted outright by a screen: a Prospects
-- row (Prospects, Can't reach), a hiring board row (Prospects → Team), a supply house (Materials) and, with its house, a
-- rep. Their contact moves off the row first, so the delete goes through and the thread stays:
--   * a lead stays a lead with no record, keeping the name Prospects gave them;
--   * a candidate becomes a number nobody has named, keeping the name, as a roster person does;
--   * a supply house's counter and anyone named on it become numbers nobody has named, keeping the name;
--   * a rep moves onto their house under their name (into the contact already there under that name, if any), or,
--     when the house is going too, becomes a number nobody has named.
CREATE OR REPLACE FUNCTION public.contacts_keep_thread_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact public.contacts%ROWTYPE;
  v_name text;
  v_customer_contact uuid;
  v_house_contact uuid;
BEGIN
  IF TG_TABLE_NAME = 'customer_contact_persons' THEN
    SELECT * INTO v_contact FROM public.contacts WHERE customer_contact_person_id = OLD.id;
    IF FOUND THEN
      v_name := public.contact_name_on('customers', OLD.customer_id, coalesce(v_contact.name, OLD.name));
      SELECT id INTO v_customer_contact FROM public.contacts
      WHERE customer_id = OLD.customer_id AND lower(btrim(coalesce(name, ''))) = lower(coalesce(v_name, ''));
      IF v_customer_contact IS NULL THEN
        UPDATE public.contacts SET customer_contact_person_id = NULL, customer_id = OLD.customer_id, name = v_name WHERE id = v_contact.id;
      ELSE
        PERFORM public.contacts_fold(v_contact.id, v_customer_contact);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'people' THEN
    UPDATE public.contacts SET person_id = NULL, kind = 'unknown', name = coalesce(name, nullif(btrim(OLD.name), ''))
    WHERE person_id = OLD.id;
  ELSIF TG_TABLE_NAME = 'prospects' THEN
    UPDATE public.contacts SET prospect_id = NULL,
      name = coalesce(name, nullif(btrim(OLD.contact_name), ''), nullif(btrim(OLD.company_name), ''))
    WHERE prospect_id = OLD.id;
  ELSIF TG_TABLE_NAME = 'team_prospects' THEN
    UPDATE public.contacts SET team_prospect_id = NULL, kind = 'unknown', name = coalesce(name, nullif(btrim(OLD.name), ''))
    WHERE team_prospect_id = OLD.id;
  ELSIF TG_TABLE_NAME = 'supply_houses' THEN
    UPDATE public.contacts SET supply_house_id = NULL, kind = 'unknown', name = coalesce(name, nullif(btrim(OLD.name), ''))
    WHERE supply_house_id = OLD.id;
  ELSIF TG_TABLE_NAME = 'supply_house_contacts' THEN
    SELECT * INTO v_contact FROM public.contacts WHERE supply_house_contact_id = OLD.id;
    IF FOUND THEN
      -- A house that is going too (a rep goes with their house) is no place to move to.
      IF OLD.supply_house_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.supply_houses WHERE id = OLD.supply_house_id) THEN
        v_name := public.contact_name_on('supply_houses', OLD.supply_house_id, coalesce(v_contact.name, OLD.name));
        SELECT id INTO v_house_contact FROM public.contacts
        WHERE supply_house_id = OLD.supply_house_id AND lower(btrim(coalesce(name, ''))) = lower(coalesce(v_name, ''));
        IF v_house_contact IS NULL THEN
          UPDATE public.contacts SET supply_house_contact_id = NULL, supply_house_id = OLD.supply_house_id, name = v_name WHERE id = v_contact.id;
        ELSE
          PERFORM public.contacts_fold(v_contact.id, v_house_contact);
        END IF;
      ELSE
        UPDATE public.contacts SET supply_house_contact_id = NULL, kind = 'unknown',
          name = coalesce(v_contact.name, nullif(btrim(OLD.name), ''))
        WHERE id = v_contact.id;
      END IF;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS contacts_keep_thread ON public.prospects;
CREATE TRIGGER contacts_keep_thread BEFORE DELETE ON public.prospects
  FOR EACH ROW EXECUTE FUNCTION public.contacts_keep_thread_on_delete();
DROP TRIGGER IF EXISTS contacts_keep_thread ON public.team_prospects;
CREATE TRIGGER contacts_keep_thread BEFORE DELETE ON public.team_prospects
  FOR EACH ROW EXECUTE FUNCTION public.contacts_keep_thread_on_delete();
DROP TRIGGER IF EXISTS contacts_keep_thread ON public.supply_houses;
CREATE TRIGGER contacts_keep_thread BEFORE DELETE ON public.supply_houses
  FOR EACH ROW EXECUTE FUNCTION public.contacts_keep_thread_on_delete();
DROP TRIGGER IF EXISTS contacts_keep_thread ON public.supply_house_contacts;
CREATE TRIGGER contacts_keep_thread BEFORE DELETE ON public.supply_house_contacts
  FOR EACH ROW EXECUTE FUNCTION public.contacts_keep_thread_on_delete();

-- ---------- the roster's subs ----------

-- A roster person's contact is a sub while the roster's kind is sub, and a trade partner once it no longer is (kindOf
-- in kernel.ts). Every sub on the roster, not archived, has a contact with the number and address the roster holds for
-- them. Returns how many contacts it made or changed; runs again without adding anything.
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
  UPDATE public.contacts c SET kind = CASE WHEN p.kind = 'sub' THEN 'sub' ELSE 'trade' END
  FROM public.people p
  WHERE p.id = c.person_id AND (c.kind = 'sub') IS DISTINCT FROM (p.kind = 'sub');
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  INSERT INTO public.contacts (kind, person_id)
  SELECT 'sub', p.id FROM public.people p
  WHERE p.kind = 'sub' AND p.archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.contacts x WHERE x.person_id = p.id);
  GET DIAGNOSTICS v_made = ROW_COUNT;

  INSERT INTO public.contact_channels (contact_id, kind, value)
  SELECT x.id, v.kind, btrim(v.value)
  FROM public.contacts x
  JOIN public.people p ON p.id = x.person_id
  CROSS JOIN LATERAL (VALUES ('phone', p.phone), ('email', p.email)) AS v(kind, value)
  WHERE x.kind = 'sub' AND public.contact_channel_key(v.kind, v.value) <> ''
  ON CONFLICT DO NOTHING;

  RETURN v_changed + v_made;
END;
$$;

-- ---------- the supply houses and their reps ----------

-- A contact for each supply house's counter (vendor kind supply_house; an insurer or a rental yard is not one) with the
-- house's number, and one for each rep the RFQ desk keeps at a house (not archived) with the rep's address and number.
-- The jobs side's shortlist, the rows with no house, names no house and stays out. Returns how many contacts it made;
-- runs again without adding anything.
CREATE OR REPLACE FUNCTION public.contacts_from_supply_houses()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_counters integer;
  v_reps integer;
BEGIN
  INSERT INTO public.contacts (kind, supply_house_id)
  SELECT 'supply_house', h.id FROM public.supply_houses h
  WHERE h.vendor_kind = 'supply_house'
    AND NOT EXISTS (SELECT 1 FROM public.contacts x WHERE x.supply_house_id = h.id AND x.name IS NULL);
  GET DIAGNOSTICS v_counters = ROW_COUNT;

  INSERT INTO public.contacts (kind, supply_house_contact_id)
  SELECT 'supply_house', r.id FROM public.supply_house_contacts r
  WHERE r.supply_house_id IS NOT NULL AND r.archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.contacts x WHERE x.supply_house_contact_id = r.id);
  GET DIAGNOSTICS v_reps = ROW_COUNT;

  -- A house's own number is its counter's, never that of someone named on its row.
  INSERT INTO public.contact_channels (contact_id, kind, value)
  SELECT x.id, 'phone', btrim(h.phone)
  FROM public.contacts x JOIN public.supply_houses h ON h.id = x.supply_house_id
  WHERE x.name IS NULL AND public.contact_channel_key('phone', h.phone) <> ''
  ON CONFLICT DO NOTHING;

  INSERT INTO public.contact_channels (contact_id, kind, value)
  SELECT x.id, v.kind, btrim(v.value)
  FROM public.contacts x
  JOIN public.supply_house_contacts r ON r.id = x.supply_house_contact_id
  CROSS JOIN LATERAL (VALUES ('email', r.email), ('phone', r.phone)) AS v(kind, value)
  WHERE public.contact_channel_key(v.kind, v.value) <> ''
  ON CONFLICT DO NOTHING;

  RETURN v_counters + v_reps;
END;
$$;

-- ---------- Follow up never counts a supply house or a candidate ----------

-- As 20261012160000_messages_follow_up.sql, but for the kinds Follow up never shows (OFF_FOLLOW_UP in
-- src/lib/followUp/queue.ts, the owner's call of 2026-10-13): their threads live on the RFQ desk and the hiring board.
-- Follow up's badge: each person once across Needs you (a standing note whose day has come), Needs a reply (open, or a
-- snooze whose day has come) and We owe them (followUpQueue's count). A person's standing note is their newest note
-- with a day; a newer one replaces an older. The portal's paper rows and the clause rows join with their own reads. The
-- office team's: anyone else reads 0.
CREATE OR REPLACE FUNCTION public.follow_up_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH standing AS (
    SELECT DISTINCT ON (m.contact_id) m.contact_id, m.back_on, m.back_done_at
    FROM public.messages m
    WHERE m.channel = 'note' AND (m.back_on IS NOT NULL OR m.back_words IS NOT NULL)
    ORDER BY m.contact_id, m.at DESC, m.id DESC
  )
  SELECT count(*)::integer FROM (
    SELECT s.contact_id FROM standing s WHERE s.back_on <= public.app_today() AND s.back_done_at IS NULL
    UNION
    SELECT c.id FROM public.contacts c
    WHERE c.state = 'waiting' OR (c.state = 'snoozed' AND c.snoozed_until <= public.app_today())
    UNION
    SELECT o.contact_id FROM public.contact_owed o WHERE o.done_at IS NULL
  ) people
  WHERE NOT EXISTS (
    SELECT 1 FROM public.contacts off WHERE off.id = people.contact_id AND off.kind IN ('supply_house', 'candidate'))
$$;

-- ---------- a contact's name ----------

-- As 20261012160000_messages_follow_up.sql, with the new records (src/lib/contacts/load.ts): their own name, else the
-- record's (a trade partner's contact name, else the company's; a lead's person on Prospects, else its company; a rep,
-- else the supply house; a candidate), else their first number or address.
CREATE OR REPLACE FUNCTION public.contact_display_name(p_contact_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(btrim(c.name), ''),
    nullif(btrim(cu.name), ''),
    nullif(btrim(cp.name), ''),
    nullif(btrim(g.contact_name), ''),
    nullif(btrim(g.name), ''),
    nullif(btrim(gp.name), ''),
    nullif(btrim(pe.name), ''),
    nullif(btrim(pr.contact_name), ''),
    nullif(btrim(pr.company_name), ''),
    nullif(btrim(r.name), ''),
    nullif(btrim(sh.name), ''),
    nullif(btrim(tp.name), ''),
    (SELECT ch.value FROM public.contact_channels ch WHERE ch.contact_id = c.id ORDER BY ch.created_at, ch.id LIMIT 1),
    'them')
  FROM public.contacts c
  LEFT JOIN public.customers cu ON cu.id = c.customer_id
  LEFT JOIN public.customer_contact_persons cp ON cp.id = c.customer_contact_person_id
  LEFT JOIN public.gc_companies g ON g.id = c.gc_company_id
  LEFT JOIN public.gc_company_people gp ON gp.id = c.gc_company_person_id
  LEFT JOIN public.people pe ON pe.id = c.person_id
  LEFT JOIN public.prospects pr ON pr.id = c.prospect_id
  LEFT JOIN public.supply_house_contacts r ON r.id = c.supply_house_contact_id
  LEFT JOIN public.supply_houses sh ON sh.id = c.supply_house_id
  LEFT JOIN public.team_prospects tp ON tp.id = c.team_prospect_id
  WHERE c.id = p_contact_id
$$;

-- ---------- the candidate door ----------

-- The office team reads every contact (the spine's policy), but the Team hiring board is gated per person
-- (user_has_team_prospects_access(), the users.team_prospects_access flag). So a candidate's contact, their numbers and
-- addresses and their lines read only to a dev and to someone on the hiring board: one RESTRICTIVE read policy on each
-- of the three tables, beside the spine's. An estimator off the board reads no candidate, and so names, ties and
-- writes none, since a row it cannot read it cannot change.
CREATE OR REPLACE FUNCTION public.contacts_candidates_readable()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.is_dev(), false) OR coalesce(public.user_has_team_prospects_access(), false)
$$;

-- The candidates' contact ids, read once per statement by the two line-level policies below (an initplan), past the
-- contacts policy that would hide them from the reader they are kept from.
CREATE OR REPLACE FUNCTION public.contacts_candidate_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(id), '{}'::uuid[]) FROM public.contacts WHERE kind = 'candidate'
$$;

DROP POLICY IF EXISTS contacts_candidate_door ON public.contacts;
CREATE POLICY contacts_candidate_door ON public.contacts AS RESTRICTIVE FOR SELECT TO authenticated
  USING (kind <> 'candidate' OR (SELECT public.contacts_candidates_readable()));
DROP POLICY IF EXISTS contact_channels_candidate_door ON public.contact_channels;
CREATE POLICY contact_channels_candidate_door ON public.contact_channels AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT public.contacts_candidates_readable()) OR contact_id <> ALL ((SELECT public.contacts_candidate_ids())));
DROP POLICY IF EXISTS messages_candidate_door ON public.messages;
CREATE POLICY messages_candidate_door ON public.messages AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT public.contacts_candidates_readable()) OR contact_id <> ALL ((SELECT public.contacts_candidate_ids())));

-- ---------- who may call what ----------

-- name_contact, contact_name_on, follow_up_count and contact_display_name keep the grants their CREATE OR REPLACE
-- leaves them; the trigger's stays the database's own. The two seeds are the database's own, as the spine's is. The
-- door's two functions are the policies', so the signed-in caller runs them.
REVOKE EXECUTE ON FUNCTION public.contacts_subs_from_roster() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contacts_from_supply_houses() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contacts_candidates_readable() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contacts_candidates_readable() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.contacts_candidate_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contacts_candidate_ids() TO authenticated, service_role;

-- Today's subs, supply houses and reps, once.
SELECT public.contacts_subs_from_roster();
SELECT public.contacts_from_supply_houses();
