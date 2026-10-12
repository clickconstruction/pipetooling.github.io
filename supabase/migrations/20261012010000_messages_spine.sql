SET lock_timeout = '3s';

-- Messages, cut 1, the spine (to-dos/gc-mode/messages/BUILD_PLAN.md and BUILD_HELPERS.md's cluster 1, on branch
-- spike/gc-mode; the kernels are src/lib/contacts/kernel.ts and src/lib/messages/thread.ts, v2.5249): one thread per
-- person. Four tables, the functions the first screens call, and a seed. Nothing writes a message yet: calls and texts
-- arrive with the Quo link (cut 5), email with the bids@ reader (cut 6).
--
--   * contacts: a view over a person the app already has, never a fifth list. A contact points at exactly one record
--     (customer_id, customer_contact_person_id, gc_company_id, gc_company_person_id or person_id), or at none for a
--     number nobody has named yet (kind 'unknown'). A person's row is one contact; a company's row (a customer, a trade
--     partner) is its own person plus anyone else it holds by name, one contact each. name names that person: Dee at
--     Alamo Concrete, known only by a cell. goes_by is what they asked to be called.
--   * contact_channels: a number or an address that is theirs, matched by its key (ten digits, or the address in lower
--     case, as customerSimilarity normalizes them). A STOP marks the number that sent it, never the person.
--   * contact_jobs: the jobs the office put a person on and the star (one per contact), each a bid, a GC project or a
--     Pipeline job.
--   * messages: a call, voicemail, missed call, text, email, team note, event or portal line, on its contact, with the
--     number or address it came from or went to and the job it is tied to (none: on the person).
--   * contact_for_channel finds whose number or address it is. name_contact is Who is this?: it re-points the contact,
--     or folds it into the contact that already points at that record, and the thread stays whole. tie_message and
--     set_default_job tie a line and move the star. contacts_fold is the fold, and merge_customers now folds the
--     victim's contact into the survivor's, so a merge never loses a thread.
--   * The record keys are ON DELETE RESTRICT. A customer contact person or a roster person is deleted by the app's own
--     screens, so a trigger first moves their contact off the row: onto the customer, or to an unknown number that
--     keeps the name.
--   * The office team's (gc_office_team()), one policy a table. The functions run as the caller under it, so training
--     mode and a digital twin change nothing.

-- ---------- the key a number or an address is matched by ----------

-- "+1 (210) 555-0113" is 2105550113; " Greg@Hillside.Example " is greg@hillside.example; '' when it is neither. The
-- same rule as normalizeCustomerPhone and normalizeCustomerEmail (src/lib/customerSimilarity.ts).
CREATE OR REPLACE FUNCTION public.contact_channel_key(p_kind text, p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE p_kind
    WHEN 'phone' THEN (
      SELECT CASE WHEN length(d) >= 7 THEN d ELSE '' END
      FROM (
        SELECT CASE WHEN length(x) = 11 AND left(x, 1) = '1' THEN substr(x, 2) ELSE x END AS d
        FROM (SELECT regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g') AS x) a
      ) b)
    WHEN 'email' THEN (
      SELECT CASE WHEN position('@' IN e) > 0 THEN e ELSE '' END
      FROM (SELECT lower(btrim(coalesce(p_value, ''))) AS e) c)
    ELSE ''
  END
$$;

-- ---------- contacts ----------

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL
    CONSTRAINT contacts_kind_known CHECK (kind IN ('customer', 'trade', 'arch', 'unknown')),
  -- The record a contact is: a customer who is one person, a person at a customer, a trade partner's main contact,
  -- anyone else a trade partner named, or someone on the roster.
  customer_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT,
  customer_contact_person_id uuid REFERENCES public.customer_contact_persons(id) ON DELETE RESTRICT,
  gc_company_id uuid REFERENCES public.gc_companies(id) ON DELETE RESTRICT,
  gc_company_person_id uuid REFERENCES public.gc_company_people(id) ON DELETE RESTRICT,
  person_id uuid REFERENCES public.people(id) ON DELETE RESTRICT,
  name text
    CONSTRAINT contacts_name_said CHECK (name IS NULL OR length(btrim(name)) BETWEEN 1 AND 200),
  goes_by text
    CONSTRAINT contacts_goes_by_said CHECK (goes_by IS NULL OR length(btrim(goes_by)) BETWEEN 1 AND 80),
  -- Off the flow (cut 4 writes it): since when, why, and who said so. Null: on it.
  off_since date,
  off_why text,
  off_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT contacts_off_said CHECK (off_since IS NOT NULL OR (off_why IS NULL AND off_by IS NULL)),
  CONSTRAINT contacts_one_record CHECK (
    num_nonnulls(customer_id, customer_contact_person_id, gc_company_id, gc_company_person_id, person_id)
      = CASE WHEN kind = 'unknown' THEN 0 ELSE 1 END
  )
);

COMMENT ON TABLE public.contacts IS
  'Messages (cut 1, the spine): a person the app already has, as the thread hangs off them. Points at exactly one record (customer_id, customer_contact_person_id, gc_company_id, gc_company_person_id, person_id), or none for a number nobody has named (kind unknown). A person''s row is one contact; a company''s row (customer_id, gc_company_id) is its own person (name null) and anyone else it holds by name. The office team''s.';

-- One contact per person: a person's row once, a company's row once per name (its own person has none).
CREATE UNIQUE INDEX IF NOT EXISTS contacts_customer_once ON public.contacts (customer_id, lower(btrim(coalesce(name, '')))) WHERE customer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_customer_person_once ON public.contacts (customer_contact_person_id) WHERE customer_contact_person_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_gc_company_once ON public.contacts (gc_company_id, lower(btrim(coalesce(name, '')))) WHERE gc_company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_gc_person_once ON public.contacts (gc_company_person_id) WHERE gc_company_person_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_person_once ON public.contacts (person_id) WHERE person_id IS NOT NULL;

-- ---------- contact_channels ----------

CREATE TABLE IF NOT EXISTS public.contact_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  kind text NOT NULL
    CONSTRAINT contact_channels_kind_known CHECK (kind IN ('phone', 'email')),
  -- As it was given: "(210) 555-0113".
  value text NOT NULL,
  -- What it is matched by.
  key text GENERATED ALWAYS AS (public.contact_channel_key(kind, value)) STORED,
  -- When this number texted STOP. An address is never stopped.
  opted_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT contact_channels_usable CHECK (key <> ''),
  CONSTRAINT contact_channels_stop_is_a_number CHECK (kind = 'phone' OR opted_out_at IS NULL)
);

COMMENT ON TABLE public.contact_channels IS
  'Messages (cut 1): a number or an address that is a contact''s, matched by key (ten digits, or the address in lower case). opted_out_at is a STOP from that number, never the person. A number two people share lands on the one it last carried a message for (contact_for_channel).';

CREATE UNIQUE INDEX IF NOT EXISTS contact_channels_once ON public.contact_channels (contact_id, kind, key);
CREATE INDEX IF NOT EXISTS contact_channels_lookup ON public.contact_channels (kind, key);

-- ---------- contact_jobs ----------

CREATE TABLE IF NOT EXISTS public.contact_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  -- The job: a bid, a GC project or a Pipeline job.
  bid_id uuid REFERENCES public.bids(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  jobs_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  -- The star: where a new message from them lands until someone moves it.
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT contact_jobs_one_job CHECK (num_nonnulls(bid_id, project_id, jobs_ledger_id) = 1)
);

COMMENT ON TABLE public.contact_jobs IS
  'Messages (cut 1): a job the office put a contact on (a bid, a GC project or a Pipeline job), and the star (is_default, one per contact), where a new message from them lands. The jobs a person is on by the facts are the read''s, not rows here.';

CREATE UNIQUE INDEX IF NOT EXISTS contact_jobs_bid_once ON public.contact_jobs (contact_id, bid_id) WHERE bid_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contact_jobs_project_once ON public.contact_jobs (contact_id, project_id) WHERE project_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contact_jobs_pipeline_once ON public.contact_jobs (contact_id, jobs_ledger_id) WHERE jobs_ledger_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contact_jobs_one_star ON public.contact_jobs (contact_id) WHERE is_default;

-- ---------- messages ----------

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A thread is never deleted from under its lines: a contact with lines folds, it does not go.
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  -- The number or address it came from or went to. Null on a note or an event.
  channel_id uuid REFERENCES public.contact_channels(id) ON DELETE SET NULL,
  -- The job it is tied to, at most one. None: on the person.
  bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.gc_projects(project_id) ON DELETE SET NULL,
  jobs_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  channel text NOT NULL
    CONSTRAINT messages_channel_known CHECK (channel IN ('call', 'voicemail', 'missed', 'text', 'email', 'note', 'event', 'portal')),
  -- in: from them. out: from us. team: a note or an event, which only the office sees.
  direction text NOT NULL
    CONSTRAINT messages_direction_known CHECK (direction IN ('in', 'out', 'team')),
  -- Who: the user, or the words the line shows ("rang everyone on the company number").
  who_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  who_text text NOT NULL DEFAULT '',
  at timestamptz NOT NULL DEFAULT clock_timestamp(),
  subject text,
  body text NOT NULL DEFAULT '',
  -- The opt-out line a text carried: the first text to a number, again after a silence, or held back.
  optout_line text
    CONSTRAINT messages_optout_line_known CHECK (optout_line IN ('first', 'silence', 'held')),
  -- A team note's day to come back to Follow up, and who set it.
  back_on date,
  back_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT messages_one_job CHECK (num_nonnulls(bid_id, project_id, jobs_ledger_id) <= 1),
  CONSTRAINT messages_team_is_note_or_event CHECK ((channel IN ('note', 'event')) = (direction = 'team')),
  CONSTRAINT messages_optout_on_texts CHECK (optout_line IS NULL OR (channel = 'text' AND direction = 'out')),
  CONSTRAINT messages_back_on_notes CHECK ((back_on IS NULL AND back_by IS NULL) OR channel = 'note')
);

COMMENT ON TABLE public.messages IS
  'Messages (cut 1): a call, voicemail, missed call, text, email, team note, event or portal line, on its contact (contact_id), with the number or address it came from or went to (channel_id) and the job it is tied to (bid_id, project_id or jobs_ledger_id; none: on the person). The office team''s. Rows arrive with cuts 5 and 6.';

CREATE INDEX IF NOT EXISTS messages_thread ON public.messages (contact_id, at DESC);
CREATE INDEX IF NOT EXISTS messages_channel ON public.messages (channel_id) WHERE channel_id IS NOT NULL;

-- ---------- the office team's ----------

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contacts_team ON public.contacts;
CREATE POLICY contacts_team ON public.contacts FOR ALL TO authenticated
  USING ((SELECT public.gc_office_team())) WITH CHECK ((SELECT public.gc_office_team()));
DROP POLICY IF EXISTS contact_channels_team ON public.contact_channels;
CREATE POLICY contact_channels_team ON public.contact_channels FOR ALL TO authenticated
  USING ((SELECT public.gc_office_team())) WITH CHECK ((SELECT public.gc_office_team()));
DROP POLICY IF EXISTS contact_jobs_team ON public.contact_jobs;
CREATE POLICY contact_jobs_team ON public.contact_jobs FOR ALL TO authenticated
  USING ((SELECT public.gc_office_team())) WITH CHECK ((SELECT public.gc_office_team()));
DROP POLICY IF EXISTS messages_team ON public.messages;
CREATE POLICY messages_team ON public.messages FOR ALL TO authenticated
  USING ((SELECT public.gc_office_team())) WITH CHECK ((SELECT public.gc_office_team()));

-- Nobody signed out reaches them. Signed in: read, and only the columns the functions below change. A contact and a
-- message are made by the seed and, from cut 5, by the service role.
REVOKE ALL ON TABLE public.contacts, public.contact_channels, public.contact_jobs, public.messages FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.contacts, public.contact_channels, public.contact_jobs, public.messages FROM authenticated;
GRANT SELECT ON TABLE public.contacts, public.contact_channels, public.contact_jobs, public.messages TO authenticated;
GRANT UPDATE (kind, customer_id, customer_contact_person_id, gc_company_id, gc_company_person_id, person_id, name, goes_by) ON TABLE public.contacts TO authenticated;
GRANT DELETE ON TABLE public.contacts TO authenticated;
GRANT UPDATE (contact_id) ON TABLE public.contact_channels TO authenticated;
GRANT DELETE ON TABLE public.contact_channels TO authenticated;
GRANT INSERT (contact_id, bid_id, project_id, jobs_ledger_id, is_default) ON TABLE public.contact_jobs TO authenticated;
GRANT UPDATE (contact_id, is_default) ON TABLE public.contact_jobs TO authenticated;
GRANT DELETE ON TABLE public.contact_jobs TO authenticated;
GRANT UPDATE (contact_id, channel_id, bid_id, project_id, jobs_ledger_id) ON TABLE public.messages TO authenticated;

-- ---------- a job, as the functions take it ----------

-- p_job_kind 'bid', 'project' (a GC project) or 'pipeline' (a jobs_ledger row), with its id; both null for none.
CREATE OR REPLACE FUNCTION public.contact_job_check(p_job_kind text, p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_found boolean;
BEGIN
  IF p_job_kind IS NULL AND p_job_id IS NULL THEN
    RETURN;
  END IF;
  IF p_job_kind IS NULL OR p_job_id IS NULL OR p_job_kind NOT IN ('bid', 'project', 'pipeline') THEN
    RAISE EXCEPTION 'jobUnknown' USING ERRCODE = 'P0001', DETAIL = 'A job is a bid, a GC project or a Pipeline job, with its id.';
  END IF;
  -- Read into a variable: an IF's condition ends at its first THEN, a CASE's included.
  v_found := CASE p_job_kind
    WHEN 'bid' THEN EXISTS (SELECT 1 FROM public.bids WHERE id = p_job_id)
    WHEN 'project' THEN EXISTS (SELECT 1 FROM public.gc_projects WHERE project_id = p_job_id)
    ELSE EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = p_job_id)
  END;
  IF NOT v_found THEN
    RAISE EXCEPTION 'jobNotFound' USING ERRCODE = 'P0001', DETAIL = 'No job with that id.';
  END IF;
END;
$$;

-- ---------- a person on a company's row ----------

-- The name a contact on a company's row carries: null for the company's own person (no name given, or the name the row
-- already holds: a customer's name, a trade partner's contact_name), else the person's own, trimmed. A person's row holds
-- its own name, so a contact on one carries none.
CREATE OR REPLACE FUNCTION public.contact_name_on(p_record_table text, p_record_id uuid, p_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_record_table NOT IN ('customers', 'gc_companies') THEN NULL
    WHEN nullif(btrim(coalesce(p_name, '')), '') IS NULL THEN NULL
    WHEN lower(btrim(p_name)) = lower(btrim(coalesce(
      CASE p_record_table
        WHEN 'customers' THEN (SELECT name FROM public.customers WHERE id = p_record_id)
        ELSE (SELECT contact_name FROM public.gc_companies WHERE id = p_record_id)
      END, ''))) THEN NULL
    ELSE btrim(p_name)
  END
$$;

-- ---------- the fold ----------

-- p_from's thread, numbers, addresses and jobs move onto p_into, and p_from goes. A number both have keeps the copy that
-- says STOP, else p_into's. p_into keeps its star, else takes p_from's; its goes-by, else p_from's. Its name is never
-- changed: the name says which person on a company's row it is. Used by name_contact, merge_customers and the delete
-- trigger below.
--
-- A later cut's rows on a contact (cut 2's what we owe, cut 4's notes and nudges) move through a function of its own
-- named contacts_fold_<something>(p_from uuid, p_into uuid) RETURNS void, in the public schema and owned as this one is.
-- The fold runs each of them, in name order, after its own rows and while p_from is still there to read. No cut ever
-- redefines this function, so the result never depends on the order the cuts merge in.
CREATE OR REPLACE FUNCTION public.contacts_fold(p_from uuid, p_into uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r record;
  v_fn name;
BEGIN
  IF p_from IS NULL OR p_into IS NULL OR p_from = p_into THEN
    RETURN;
  END IF;
  FOR r IN
    SELECT f.id AS from_id, t.id AS into_id, (f.opted_out_at IS NOT NULL AND t.opted_out_at IS NULL) AS keep_from
    FROM public.contact_channels f
    JOIN public.contact_channels t ON t.contact_id = p_into AND t.kind = f.kind AND t.key = f.key
    WHERE f.contact_id = p_from
  LOOP
    IF r.keep_from THEN
      UPDATE public.messages SET channel_id = r.from_id WHERE channel_id = r.into_id;
      DELETE FROM public.contact_channels WHERE id = r.into_id;
    ELSE
      UPDATE public.messages SET channel_id = r.into_id WHERE channel_id = r.from_id;
      DELETE FROM public.contact_channels WHERE id = r.from_id;
    END IF;
  END LOOP;
  UPDATE public.contact_channels SET contact_id = p_into WHERE contact_id = p_from;
  UPDATE public.messages SET contact_id = p_into WHERE contact_id = p_from;

  IF NOT EXISTS (SELECT 1 FROM public.contact_jobs WHERE contact_id = p_into AND is_default) THEN
    -- p_from's star becomes theirs, on their own copy of that job when they have one.
    UPDATE public.contact_jobs t SET is_default = true
    FROM public.contact_jobs f
    WHERE f.contact_id = p_from AND f.is_default AND t.contact_id = p_into
      AND t.bid_id IS NOT DISTINCT FROM f.bid_id AND t.project_id IS NOT DISTINCT FROM f.project_id
      AND t.jobs_ledger_id IS NOT DISTINCT FROM f.jobs_ledger_id;
  END IF;
  DELETE FROM public.contact_jobs f
  WHERE f.contact_id = p_from
    AND EXISTS (
      SELECT 1 FROM public.contact_jobs t
      WHERE t.contact_id = p_into AND t.bid_id IS NOT DISTINCT FROM f.bid_id AND t.project_id IS NOT DISTINCT FROM f.project_id
        AND t.jobs_ledger_id IS NOT DISTINCT FROM f.jobs_ledger_id);
  IF EXISTS (SELECT 1 FROM public.contact_jobs WHERE contact_id = p_into AND is_default) THEN
    UPDATE public.contact_jobs SET is_default = false WHERE contact_id = p_from AND is_default;
  END IF;
  UPDATE public.contact_jobs SET contact_id = p_into WHERE contact_id = p_from;

  UPDATE public.contacts t SET goes_by = f.goes_by
  FROM public.contacts f
  WHERE t.id = p_into AND f.id = p_from AND t.goes_by IS NULL AND f.goes_by IS NOT NULL;
  -- Every later cut's rows on a contact, by its own contacts_fold_<something>, while p_from is still there to read. Only
  -- a function of the fold's own owner, with the fold's two uuids, returning nothing, is run.
  FOR v_fn IN
    SELECT p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND starts_with(p.proname, 'contacts_fold_')
      AND p.proargtypes::oid[] = ARRAY['uuid'::regtype::oid, 'uuid'::regtype::oid]
      AND p.prorettype = 'void'::regtype
      AND p.proowner = (SELECT f.proowner FROM pg_proc f WHERE f.oid = 'public.contacts_fold(uuid, uuid)'::regprocedure)
    ORDER BY p.proname
  LOOP
    EXECUTE format('SELECT public.%I($1, $2)', v_fn) USING p_from, p_into;
  END LOOP;
  DELETE FROM public.contacts WHERE id = p_from;
END;
$$;

-- ---------- whose number or address it is ----------

-- The contact a number or an address belongs to, matched by key. A number two people share: the one it last carried a
-- message for, else the one that had it first. Null: nobody has it.
CREATE OR REPLACE FUNCTION public.contact_for_channel(p_kind text, p_value text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT ch.contact_id
  FROM public.contact_channels ch
  WHERE ch.kind = p_kind
    AND ch.key = public.contact_channel_key(p_kind, p_value)
    AND public.contact_channel_key(p_kind, p_value) <> ''
  ORDER BY (SELECT max(m.at) FROM public.messages m WHERE m.channel_id = ch.id) DESC NULLS LAST, ch.created_at, ch.id
  LIMIT 1
$$;

-- ---------- Who is this? ----------

-- Names a number nobody knew: the contact points at p_record_table's p_record_id ('customers',
-- 'customer_contact_persons', 'gc_companies', 'gc_company_people' or 'people') and keeps its thread. When another
-- contact already is that person, this one folds into it. On a company's row, p_name names a person the row has no room
-- for (contact_name_on); the company's own person takes none. A job picked while naming goes on the person, takes the
-- star when they have none, and ties this number's untied lines. Returns the contact that holds the thread now.
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
BEGIN
  SELECT * INTO v_contact FROM public.contacts WHERE id = p_contact_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No contact with that id.';
  END IF;
  IF v_contact.kind <> 'unknown' THEN
    RAISE EXCEPTION 'namedAlready' USING ERRCODE = 'P0001', DETAIL = 'This contact is named already.';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('customer', 'trade', 'arch') THEN
    RAISE EXCEPTION 'kindNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say what they are to us: a customer, a trade partner or an architect.';
  END IF;
  IF p_record_id IS NULL OR p_record_table IS NULL
     OR p_record_table NOT IN ('customers', 'customer_contact_persons', 'gc_companies', 'gc_company_people', 'people') THEN
    RAISE EXCEPTION 'recordNeeded' USING ERRCODE = 'P0001', DETAIL = 'Pick who they are.';
  END IF;
  v_exists := CASE p_record_table
    WHEN 'customers' THEN EXISTS (SELECT 1 FROM public.customers WHERE id = p_record_id)
    WHEN 'customer_contact_persons' THEN EXISTS (SELECT 1 FROM public.customer_contact_persons WHERE id = p_record_id)
    WHEN 'gc_companies' THEN EXISTS (SELECT 1 FROM public.gc_companies WHERE id = p_record_id)
    WHEN 'gc_company_people' THEN EXISTS (SELECT 1 FROM public.gc_company_people WHERE id = p_record_id)
    ELSE EXISTS (SELECT 1 FROM public.people WHERE id = p_record_id)
  END;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'recordNotFound' USING ERRCODE = 'P0001', DETAIL = 'Nobody with that id.';
  END IF;
  PERFORM public.contact_job_check(p_job_kind, p_job_id);
  v_name := public.contact_name_on(p_record_table, p_record_id, p_name);

  -- This number's lines with no job, to tie when a job was picked.
  v_untied := ARRAY(
    SELECT id FROM public.messages
    WHERE contact_id = p_contact_id AND bid_id IS NULL AND project_id IS NULL AND jobs_ledger_id IS NULL AND direction <> 'team');

  SELECT id INTO v_into FROM public.contacts
  WHERE id <> p_contact_id
    AND CASE p_record_table
      WHEN 'customers' THEN customer_id = p_record_id AND lower(btrim(coalesce(name, ''))) = lower(coalesce(v_name, ''))
      WHEN 'customer_contact_persons' THEN customer_contact_person_id = p_record_id
      WHEN 'gc_companies' THEN gc_company_id = p_record_id AND lower(btrim(coalesce(name, ''))) = lower(coalesce(v_name, ''))
      WHEN 'gc_company_people' THEN gc_company_person_id = p_record_id
      ELSE person_id = p_record_id
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
      name = v_name
    WHERE id = p_contact_id;
    v_into := p_contact_id;
  ELSE
    PERFORM public.contacts_fold(p_contact_id, v_into);
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

-- ---------- a line's job, and the star ----------

-- Ties a line to a job, or unties it (both null): the line then sits on the person. A job the person was not on yet goes
-- on their rail.
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
    jobs_ledger_id = CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END
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

-- Moves the star to a job, putting the job on the person when it is not yet, or takes it away (both null): new
-- messages from them then land on the person.
CREATE OR REPLACE FUNCTION public.set_default_job(p_contact_id uuid, p_job_kind text, p_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM public.contacts WHERE id = p_contact_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No contact with that id.';
  END IF;
  PERFORM public.contact_job_check(p_job_kind, p_job_id);
  UPDATE public.contact_jobs SET is_default = false WHERE contact_id = p_contact_id AND is_default;
  IF p_job_kind IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.contact_jobs (contact_id, bid_id, project_id, jobs_ledger_id)
  VALUES (
    p_contact_id,
    CASE WHEN p_job_kind = 'bid' THEN p_job_id END,
    CASE WHEN p_job_kind = 'project' THEN p_job_id END,
    CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END)
  ON CONFLICT DO NOTHING;
  UPDATE public.contact_jobs SET is_default = true
  WHERE contact_id = p_contact_id
    AND bid_id IS NOT DISTINCT FROM CASE WHEN p_job_kind = 'bid' THEN p_job_id END
    AND project_id IS NOT DISTINCT FROM CASE WHEN p_job_kind = 'project' THEN p_job_id END
    AND jobs_ledger_id IS NOT DISTINCT FROM CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END;
END;
$$;

-- ---------- a record deleted by the app's own screens ----------

-- A customer contact person (Customers, Edit customer, the builder review) and a roster person (Settings, People) are
-- deleted outright. Their contact moves off the row first, so the delete goes through and the thread stays: a person
-- at a customer onto the customer under the person's name (into the contact already there under that name, if any);
-- a roster person to an unknown number that keeps the name.
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
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS contacts_keep_thread ON public.customer_contact_persons;
CREATE TRIGGER contacts_keep_thread BEFORE DELETE ON public.customer_contact_persons
  FOR EACH ROW EXECUTE FUNCTION public.contacts_keep_thread_on_delete();
DROP TRIGGER IF EXISTS contacts_keep_thread ON public.people;
CREATE TRIGGER contacts_keep_thread BEFORE DELETE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.contacts_keep_thread_on_delete();

-- ---------- merge_customers keeps the victim's thread ----------

-- As 20260817221950_merge_customers_accepted_estimates.sql, with one step before the victim goes: each contact on the
-- victim's row folds into the survivor's contact of the same name (the company's own person into the survivor's own),
-- or moves to the survivor when there is none. The people at the victim move to the survivor as before, and their
-- contacts with them.
CREATE OR REPLACE FUNCTION "public"."merge_customers"("p_survivor" "uuid", "p_victim" "uuid", "p_field_choices" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_survivor public.customers%ROWTYPE;
  v_victim public.customers%ROWTYPE;
  v_src_name text;
  v_src_address text;
  v_src_contact jsonb;
  v_src_type text;
  v_src_date_met date;
  v_src_master uuid;
  v_src_google_drive_link text;
  v_src_job_pictures_link text;
  v_survivor_stripe boolean;
  v_victim_stripe boolean;
  v_choice text;
  v_victim_thread uuid;
  v_survivor_thread uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_survivor IS NULL OR p_victim IS NULL OR p_survivor = p_victim THEN
    RAISE EXCEPTION 'Invalid customer pair';
  END IF;

  SELECT * INTO v_survivor FROM public.customers WHERE id = p_survivor FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Survivor customer not found';
  END IF;
  SELECT * INTO v_victim FROM public.customers WHERE id = p_victim FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Victim customer not found';
  END IF;

  PERFORM public.assert_caller_can_merge_customer_pair(v_survivor.master_user_id, v_victim.master_user_id);

  v_survivor_stripe := v_survivor.stripe_customer_id IS NOT NULL AND trim(v_survivor.stripe_customer_id) <> '';
  v_victim_stripe := v_victim.stripe_customer_id IS NOT NULL AND trim(v_victim.stripe_customer_id) <> '';
  IF v_survivor_stripe AND v_victim_stripe
     AND trim(v_survivor.stripe_customer_id) IS DISTINCT FROM trim(v_victim.stripe_customer_id) THEN
    RAISE EXCEPTION 'Both customers have different Stripe customer ids; resolve in Stripe before merging';
  END IF;

  v_choice := lower(coalesce(p_field_choices->>'name', 'survivor'));
  IF v_choice = 'victim' THEN v_src_name := v_victim.name; ELSE v_src_name := v_survivor.name; END IF;

  v_choice := lower(coalesce(p_field_choices->>'address', 'survivor'));
  IF v_choice = 'victim' THEN v_src_address := v_victim.address; ELSE v_src_address := v_survivor.address; END IF;

  v_choice := lower(coalesce(p_field_choices->>'contact_info', 'survivor'));
  IF v_choice = 'victim' THEN
    v_src_contact := to_jsonb(v_victim.contact_info);
  ELSE
    v_src_contact := to_jsonb(v_survivor.contact_info);
  END IF;

  v_choice := lower(coalesce(p_field_choices->>'customer_type', 'survivor'));
  IF v_choice = 'victim' THEN v_src_type := v_victim.customer_type; ELSE v_src_type := v_survivor.customer_type; END IF;

  v_choice := lower(coalesce(p_field_choices->>'date_met', 'survivor'));
  IF v_choice = 'victim' THEN v_src_date_met := v_victim.date_met; ELSE v_src_date_met := v_survivor.date_met; END IF;

  v_choice := lower(coalesce(p_field_choices->>'master_user_id', 'survivor'));
  IF v_choice = 'victim' THEN v_src_master := v_victim.master_user_id; ELSE v_src_master := v_survivor.master_user_id; END IF;

  v_choice := lower(coalesce(p_field_choices->>'google_drive_link', 'survivor'));
  IF v_choice = 'victim' THEN v_src_google_drive_link := v_victim.google_drive_link; ELSE v_src_google_drive_link := v_survivor.google_drive_link; END IF;

  v_choice := lower(coalesce(p_field_choices->>'job_pictures_link', 'survivor'));
  IF v_choice = 'victim' THEN v_src_job_pictures_link := v_victim.job_pictures_link; ELSE v_src_job_pictures_link := v_survivor.job_pictures_link; END IF;

  -- Transaction-local flag: lets estimates_protect_after_accept allow the
  -- customer_id re-link below for accepted estimates. Dies with the tx.
  PERFORM set_config('app.merging_customers', '1', true);

  UPDATE public.bids SET customer_id = p_survivor WHERE customer_id = p_victim;
  UPDATE public.jobs_ledger SET customer_id = p_survivor WHERE customer_id = p_victim;
  UPDATE public.estimates SET customer_id = p_survivor WHERE customer_id = p_victim;
  UPDATE public.projects SET customer_id = p_survivor WHERE customer_id = p_victim;
  UPDATE public.customer_contacts SET customer_id = p_survivor WHERE customer_id = p_victim;
  UPDATE public.customer_contact_persons SET customer_id = p_survivor WHERE customer_id = p_victim;

  -- Messages (20261012010000): the contacts on the victim's row, and their threads, go to the survivor.
  FOR v_victim_thread IN SELECT id FROM public.contacts WHERE customer_id = p_victim LOOP
    SELECT s.id INTO v_survivor_thread
    FROM public.contacts s JOIN public.contacts v ON v.id = v_victim_thread
    WHERE s.customer_id = p_survivor AND lower(btrim(coalesce(s.name, ''))) = lower(btrim(coalesce(v.name, '')));
    IF v_survivor_thread IS NULL THEN
      UPDATE public.contacts SET customer_id = p_survivor WHERE id = v_victim_thread;
    ELSE
      PERFORM public.contacts_fold(v_victim_thread, v_survivor_thread);
    END IF;
  END LOOP;

  UPDATE public.customers
  SET
    name = v_src_name,
    address = v_src_address,
    contact_info = v_src_contact,
    customer_type = v_src_type,
    date_met = v_src_date_met,
    master_user_id = v_src_master,
    google_drive_link = v_src_google_drive_link,
    job_pictures_link = v_src_job_pictures_link,
    stripe_customer_id = CASE
      WHEN v_survivor_stripe THEN v_survivor.stripe_customer_id
      WHEN v_victim_stripe AND NOT v_survivor_stripe THEN v_victim.stripe_customer_id
      ELSE v_survivor.stripe_customer_id
    END,
    updated_at = now()
  WHERE id = p_survivor;

  DELETE FROM public.customers WHERE id = p_victim;

  RETURN jsonb_build_object(
    'survivor_id', p_survivor,
    'removed_id', p_victim
  );
END;
$$;

-- ---------- the seed ----------

-- The customers on GC projects, as what they are to us: a customer that is only ever the architect reads as one; the
-- owner we build for and a property owner read as customers.
CREATE OR REPLACE FUNCTION public.messages_seed_customers()
RETURNS TABLE (customer_id uuid, kind text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT s.customer_id, CASE WHEN bool_and(s.arch) THEN 'arch' ELSE 'customer' END
  FROM (
    SELECT p.customer_id, false AS arch FROM public.gc_projects g JOIN public.projects p ON p.id = g.project_id
    UNION ALL SELECT g.property_owner_customer_id, false FROM public.gc_projects g
    UNION ALL SELECT g.architect_customer_id, true FROM public.gc_projects g
  ) s
  WHERE s.customer_id IS NOT NULL
  GROUP BY s.customer_id
$$;

-- A contact, with its numbers and addresses, for every trade partner's main contact, every person a trade partner named
-- (not removed), every person at a customer, an architect or a property owner on a GC project, and each of those
-- customers that has nobody named at it. Runs again without adding anything.
CREATE OR REPLACE FUNCTION public.messages_seed_contacts()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_before integer;
  v_after integer;
BEGIN
  SELECT count(*) INTO v_before FROM public.contacts;

  INSERT INTO public.contacts (kind, gc_company_id)
  SELECT 'trade', c.id FROM public.gc_companies c
  WHERE NOT EXISTS (SELECT 1 FROM public.contacts x WHERE x.gc_company_id = c.id);

  INSERT INTO public.contacts (kind, gc_company_person_id)
  SELECT 'trade', p.id FROM public.gc_company_people p
  WHERE p.removed_at IS NULL AND NOT EXISTS (SELECT 1 FROM public.contacts x WHERE x.gc_company_person_id = p.id);

  INSERT INTO public.contacts (kind, customer_contact_person_id)
  SELECT s.kind, cp.id
  FROM public.messages_seed_customers() s JOIN public.customer_contact_persons cp ON cp.customer_id = s.customer_id
  WHERE NOT EXISTS (SELECT 1 FROM public.contacts x WHERE x.customer_contact_person_id = cp.id);

  INSERT INTO public.contacts (kind, customer_id)
  SELECT s.kind, s.customer_id FROM public.messages_seed_customers() s
  WHERE NOT EXISTS (SELECT 1 FROM public.customer_contact_persons cp WHERE cp.customer_id = s.customer_id)
    AND NOT EXISTS (SELECT 1 FROM public.contacts x WHERE x.customer_id = s.customer_id);

  -- Their numbers and addresses, as each record holds them; one that is neither is left out. A company's row's own
  -- number and address are its own person's, never those of someone it holds by name.
  INSERT INTO public.contact_channels (contact_id, kind, value)
  SELECT x.id, v.kind, btrim(v.value)
  FROM public.contacts x
  JOIN public.gc_companies c ON c.id = x.gc_company_id
  CROSS JOIN LATERAL (VALUES ('phone', c.phone), ('email', c.email)) AS v(kind, value)
  WHERE x.name IS NULL AND public.contact_channel_key(v.kind, v.value) <> ''
  ON CONFLICT DO NOTHING;

  INSERT INTO public.contact_channels (contact_id, kind, value)
  SELECT x.id, 'email', btrim(p.email)
  FROM public.contacts x JOIN public.gc_company_people p ON p.id = x.gc_company_person_id
  WHERE public.contact_channel_key('email', p.email) <> ''
  ON CONFLICT DO NOTHING;

  INSERT INTO public.contact_channels (contact_id, kind, value)
  SELECT x.id, v.kind, btrim(v.value)
  FROM public.contacts x
  JOIN public.customer_contact_persons cp ON cp.id = x.customer_contact_person_id
  CROSS JOIN LATERAL (VALUES ('phone', cp.phone), ('email', cp.email)) AS v(kind, value)
  WHERE public.contact_channel_key(v.kind, v.value) <> ''
  ON CONFLICT DO NOTHING;

  INSERT INTO public.contact_channels (contact_id, kind, value)
  SELECT x.id, v.kind, btrim(v.value)
  FROM public.contacts x
  JOIN public.customers c ON c.id = x.customer_id
  CROSS JOIN LATERAL (VALUES ('phone', c.contact_info->>'phone'), ('email', c.contact_info->>'email')) AS v(kind, value)
  WHERE x.name IS NULL AND public.contact_channel_key(v.kind, v.value) <> ''
  ON CONFLICT DO NOTHING;

  SELECT count(*) INTO v_after FROM public.contacts;
  RETURN v_after - v_before;
END;
$$;

-- ---------- who may call what ----------

REVOKE EXECUTE ON FUNCTION public.contact_channel_key(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_channel_key(text, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.contact_job_check(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_job_check(text, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.contact_name_on(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_name_on(text, uuid, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.contacts_fold(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contacts_fold(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.contact_for_channel(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_for_channel(text, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.name_contact(uuid, text, uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.name_contact(uuid, text, uuid, text, text, text, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.tie_message(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tie_message(uuid, text, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_default_job(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_default_job(uuid, text, uuid) TO authenticated, service_role;
-- The trigger's and the seed's are the database's own.
REVOKE EXECUTE ON FUNCTION public.contacts_keep_thread_on_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.messages_seed_contacts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.messages_seed_customers() FROM PUBLIC, anon, authenticated;

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();

-- Today's people, once.
SELECT public.messages_seed_contacts();
