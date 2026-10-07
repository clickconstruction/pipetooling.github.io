SET lock_timeout = '3s';

-- GC mode, the Board's B1 (v2.4833): the company record, the gate every other GC lane reads
-- (to-dos/gc-mode/BOARD_REAL_BUILD.md on branch spike/gc-mode, "The tables", B1). A trade partner is
-- a company, not a person (decision 1): its main contact on the row and the others it names, the
-- emails each gets, where it drives from and how far, its language, its vetting and its form, its
-- call log and the asks' stories in one contacts table, the dates it gave us for things other than a
-- quote, and the asks and quotes themselves, so the trade portal (the Portal lane's P1) reads real
-- asks before the Board's Ask window lands. Also the dates the Board keeps on a GC project, and the
-- foreign keys main's seven company_id columns were waiting for (each was empty or null on prod
-- when this was written). Who sees them: dev only while it is built; the board's door swaps each
-- policy to the GC office audience. The trade's own writes are the Portal lane's SECURITY DEFINER
-- functions, so no column here needs auth.uid(). Doc: docs/migrations/.

-- A trade partner company (the prototype's Partner).
CREATE TABLE IF NOT EXISTS public.gc_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
    CONSTRAINT gc_companies_named CHECK (btrim(name) <> ''),
  -- The trades it does, in the GC trade words (gc_trade_packages.trade).
  trades text[] NOT NULL DEFAULT '{}'
    CONSTRAINT gc_companies_has_a_trade CHECK (cardinality(trades) >= 1),
  -- The main contact (decision 2): everyone else is in gc_company_people.
  contact_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  -- The kinds of email the main contact gets. Null: every kind.
  contact_gets text[]
    CONSTRAINT gc_companies_contact_gets_known CHECK (contact_gets IS NULL OR contact_gets <@ ARRAY['quotes', 'job', 'contracts', 'pay']::text[]),
  -- Where their crews drive from, and the address on their pay application (decision 3). Its point
  -- comes from public.address_geocodes, the way the Bid Board's map reads one. Empty: not set yet.
  address text NOT NULL DEFAULT '',
  -- How far they are willing to drive, in miles. Null: not set yet.
  max_miles integer
    CONSTRAINT gc_companies_max_miles_positive CHECK (max_miles IS NULL OR max_miles > 0),
  license text NOT NULL DEFAULT '',
  -- The language the company chose; its portal and its emails are in it.
  lang text NOT NULL DEFAULT 'en'
    CONSTRAINT gc_companies_lang_known CHECK (lang IN ('en', 'es')),
  -- The day the trade pressed Got it on its portal's welcome (written by the Portal lane).
  portal_opened_on date,
  -- Whether we have checked them (question 3). Null: a company we know, approved.
  vetting_status text
    CONSTRAINT gc_companies_vetting_known CHECK (vetting_status IS NULL OR vetting_status IN ('new', 'approved', 'declined')),
  -- Approved up to this many dollars on one award. Null: no limit.
  vetting_limit numeric
    CONSTRAINT gc_companies_vetting_limit_on_approval CHECK (vetting_limit IS NULL OR (vetting_limit > 0 AND vetting_status = 'approved')),
  vetting_decided_on date,
  vetting_decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  vetting_note text NOT NULL DEFAULT '',
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_companies IS
  'GC mode (v2.4833): a trade partner company, the record every GC lane reads (the prototype''s Partner). The main contact on the row, its trades, where it drives from and how far, its language, its vetting. Its papers (master agreement, W-9, insurance) are person_contract_documents rows once the Board''s B6 adds company_id there. Dev only while it is built.';

CREATE INDEX IF NOT EXISTS gc_companies_trades_idx ON public.gc_companies USING gin (trades);

-- Others at the company and the emails each gets (PartnerPerson). Someone taken off is kept, so the
-- company's Activity still says who got what.
CREATE TABLE IF NOT EXISTS public.gc_company_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE CASCADE,
  name text NOT NULL
    CONSTRAINT gc_company_people_named CHECK (btrim(name) <> ''),
  email text NOT NULL DEFAULT '',
  -- What they do there, in the company's words ("Bookkeeper").
  role text NOT NULL DEFAULT '',
  gets text[] NOT NULL DEFAULT '{}'
    CONSTRAINT gc_company_people_gets_known CHECK (gets <@ ARRAY['quotes', 'job', 'contracts', 'pay']::text[]),
  added_by text NOT NULL DEFAULT 'office'
    CONSTRAINT gc_company_people_added_by_known CHECK (added_by IN ('office', 'trade')),
  created_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz
);

COMMENT ON TABLE public.gc_company_people IS
  'GC mode (v2.4833): someone at a trade partner besides its main contact, and the kinds of email they get (PartnerPerson). removed_at keeps a person taken off. That every kind still goes to someone is the kernel''s rule, held by both writers.';

CREATE INDEX IF NOT EXISTS gc_company_people_company_idx ON public.gc_company_people (company_id) WHERE removed_at IS NULL;

-- What a company new to us tells us about itself in its portal (PartnerVettingForm). One per company.
CREATE TABLE IF NOT EXISTS public.gc_company_vetting_forms (
  company_id uuid PRIMARY KEY REFERENCES public.gc_companies(id) ON DELETE CASCADE,
  license text NOT NULL DEFAULT '',
  -- Their insurance company and the policy's limits, as they wrote it.
  insurance text NOT NULL DEFAULT '',
  years_in_business integer
    CONSTRAINT gc_company_vetting_forms_years CHECK (years_in_business IS NULL OR years_in_business >= 0),
  -- Two or three people we can call, as they wrote them (the prototype's references).
  reference_list text NOT NULL DEFAULT '',
  -- Jobs like ours they did, as they wrote them.
  past_jobs text NOT NULL DEFAULT '',
  sent_on date NOT NULL DEFAULT current_date
);

COMMENT ON TABLE public.gc_company_vetting_forms IS
  'GC mode (v2.4833): the form a company new to us sends from its portal (PartnerVettingForm), for the office to approve or decline it. Written by the Portal lane.';

-- The Board's dates on a GC project: our bid sent, the permit, the start date, our contract sent to
-- the customer, and the day we pressed Start (with Start anyway's who, why and what was missing).
-- The customer's signed date and price are Owner Billing's.
ALTER TABLE public.gc_projects ADD COLUMN IF NOT EXISTS our_bid_sent_on date;
ALTER TABLE public.gc_projects ADD COLUMN IF NOT EXISTS permit_on date;
ALTER TABLE public.gc_projects ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.gc_projects ADD COLUMN IF NOT EXISTS owner_contract_sent_on date;
ALTER TABLE public.gc_projects ADD COLUMN IF NOT EXISTS started_on date;
ALTER TABLE public.gc_projects ADD COLUMN IF NOT EXISTS started_anyway_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.gc_projects ADD COLUMN IF NOT EXISTS started_anyway_reason text;
ALTER TABLE public.gc_projects ADD COLUMN IF NOT EXISTS started_anyway_missing text[];

COMMENT ON COLUMN public.gc_projects.our_bid_sent_on IS 'The day our bid went to the customer. Bid tabs stay shut until then (GcProject.ourBidSentOn).';
COMMENT ON COLUMN public.gc_projects.started_on IS 'The day we pressed Start on Get started (GcProject.startedOn). Building''s daily log reads it.';
COMMENT ON COLUMN public.gc_projects.started_anyway_missing IS 'Start anyway (question 7): what was still missing that day, listed as owed.';

-- One row per ask: a company asked to quote one trade on one project (Invite).
CREATE TABLE IF NOT EXISTS public.gc_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'invited'
    CONSTRAINT gc_invites_status_known CHECK (status IN ('invited', 'opened', 'bid', 'declined')),
  invited_on date NOT NULL DEFAULT current_date,
  invited_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  -- The newest plan set the company has opened in its portal. Null: none yet.
  seen_rev integer,
  -- Why they are out, when the office took the answer by phone, and the reason it wrote down.
  declined_why text
    CONSTRAINT gc_invites_declined_why_known CHECK (declined_why IS NULL OR declined_why IN ('wont', 'cant')),
  decline_reason text
    CONSTRAINT gc_invites_decline_reason_known CHECK (decline_reason IS NULL OR decline_reason IN ('busy', 'far', 'size', 'scope', 'terms', 'other')),
  decline_note text NOT NULL DEFAULT '',
  declined_on date,
  -- The office's own numbers on this ask, which a resent quote keeps and the portal never reads
  -- (decision 7): a cost for a scope line the quote leaves out, by scope item id; a cost to cover
  -- each exclusion, by its name; the alternates taken, by label.
  plugs jsonb NOT NULL DEFAULT '{}'::jsonb
    CONSTRAINT gc_invites_plugs_object CHECK (jsonb_typeof(plugs) = 'object'),
  exclusion_covers jsonb NOT NULL DEFAULT '{}'::jsonb
    CONSTRAINT gc_invites_exclusion_covers_object CHECK (jsonb_typeof(exclusion_covers) = 'object'),
  taken_alternates text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_invites_once UNIQUE (package_id, company_id),
  -- For the contacts' key, so an ask's line is always the ask's own company.
  CONSTRAINT gc_invites_id_company UNIQUE (id, company_id)
);

COMMENT ON TABLE public.gc_invites IS
  'GC mode (v2.4833): an ask, one company asked to quote one trade on one project (Invite). Its story is gc_company_contacts with invite_id; its quotes are gc_quotes, the newest counting. plugs, exclusion_covers and taken_alternates are the office''s numbers and never reach the trade.';

CREATE INDEX IF NOT EXISTS gc_invites_company_idx ON public.gc_invites (company_id);

-- A company's quote on an ask (SubBid), append only: the newest counts, and the ones before it say
-- what changed under it.
CREATE TABLE IF NOT EXISTS public.gc_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id uuid NOT NULL REFERENCES public.gc_invites(id) ON DELETE CASCADE,
  amount numeric NOT NULL
    CONSTRAINT gc_quotes_amount_not_negative CHECK (amount >= 0),
  -- The plan set it priced (gc_plan_sets.rev).
  based_on_rev integer NOT NULL DEFAULT 0,
  submitted_on date NOT NULL DEFAULT current_date,
  -- Each scope line in their price or not: scope item id to yes, no or unclear.
  includes jsonb NOT NULL DEFAULT '{}'::jsonb
    CONSTRAINT gc_quotes_includes_object CHECK (jsonb_typeof(includes) = 'object'),
  note text NOT NULL DEFAULT '',
  -- How many days the number holds. Null: they did not say.
  good_for_days integer
    CONSTRAINT gc_quotes_good_for_days_positive CHECK (good_for_days IS NULL OR good_for_days > 0),
  -- [{label, amount}]: added when plus, taken off when minus.
  alternates jsonb NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT gc_quotes_alternates_array CHECK (jsonb_typeof(alternates) = 'array'),
  -- Their own quote file, by name.
  quote_file text NOT NULL DEFAULT '',
  -- Their own schedule of values, [{label, amount}]. Null: not sent.
  sov jsonb
    CONSTRAINT gc_quotes_sov_array CHECK (sov IS NULL OR jsonb_typeof(sov) = 'array'),
  -- What it leaves out, [{name, said?, unitPrice?}], and the exclusion names they answered about.
  exclusions jsonb
    CONSTRAINT gc_quotes_exclusions_array CHECK (exclusions IS NULL OR jsonb_typeof(exclusions) = 'array'),
  exclusions_answered text[],
  -- Typed by the office from an emailed quote, or sent from the trade's portal.
  source text NOT NULL
    CONSTRAINT gc_quotes_source_known CHECK (source IN ('office', 'trade')),
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_quotes IS
  'GC mode (v2.4833): a company''s quote on an ask (SubBid), append only; the newest by created_at counts. The nested parts keep the prototype''s shapes as jsonb.';

CREATE INDEX IF NOT EXISTS gc_quotes_invite_idx ON public.gc_quotes (invite_id, created_at DESC);

-- One call log for a company: a note or call about the company itself (invite_id null), or a line of
-- one ask's story (AskContact), where a quote day they gave is promised_by. Append only.
CREATE TABLE IF NOT EXISTS public.gc_company_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE CASCADE,
  invite_id uuid,
  contacted_on date NOT NULL DEFAULT current_date,
  by_user_id uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  -- Who, as the line shows it: one of us, or the company's contact in its portal.
  by_name text NOT NULL DEFAULT '',
  how text NOT NULL
    CONSTRAINT gc_company_contacts_how_known CHECK (how IN ('call', 'text', 'email', 'nudge', 'portal', 'note')),
  note text NOT NULL DEFAULT '',
  -- Their word: the quote by this day. The newest on the ask counts.
  promised_by date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_company_contacts_invite_fkey FOREIGN KEY (invite_id, company_id)
    REFERENCES public.gc_invites(id, company_id) ON DELETE CASCADE,
  CONSTRAINT gc_company_contacts_promise_on_an_ask CHECK (promised_by IS NULL OR invite_id IS NOT NULL)
);

COMMENT ON TABLE public.gc_company_contacts IS
  'GC mode (v2.4833): the call log for a trade partner, append only. invite_id null: about the company (Partner.contacts). Set: a line of that ask''s story (AskContact), with promised_by when they gave a quote day; the newest office line is the ask''s nudgedOn.';

CREATE INDEX IF NOT EXISTS gc_company_contacts_company_idx ON public.gc_company_contacts (company_id, contacted_on DESC);
CREATE INDEX IF NOT EXISTS gc_company_contacts_invite_idx ON public.gc_company_contacts (invite_id, created_at DESC) WHERE invite_id IS NOT NULL;

-- A date a company gave us for something other than a quote (TradePromise, question 8): insurance,
-- a W-9, papers, their crew on site and the rest. Kept when the thing comes; a new day moves it and
-- the old day is kept in gc_trade_promise_moves.
CREATE TABLE IF NOT EXISTS public.gc_trade_promises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE CASCADE,
  -- The prototype's PromiseKind, word for word.
  kind text NOT NULL
    CONSTRAINT gc_trade_promises_kind_known CHECK (kind IN ('insurance', 'w9', 'sow', 'start', 'submittals', 'delivery', 'payApp', 'punch', 'closeout', 'msa')),
  -- The job and trade it is for. Null: about the company itself.
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.gc_trade_packages(id) ON DELETE CASCADE,
  -- What they promised, in a few words: "the renewed insurance certificate".
  what text NOT NULL
    CONSTRAINT gc_trade_promises_what_said CHECK (btrim(what) <> ''),
  -- The day they said it will come.
  due_on date NOT NULL,
  made_on date NOT NULL DEFAULT current_date,
  -- Who wrote it down: the office (they said it on the phone) or the trade (in its portal).
  source text NOT NULL
    CONSTRAINT gc_trade_promises_source_known CHECK (source IN ('office', 'trade')),
  kept_on date,
  created_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_trade_promises_trade_on_a_job CHECK (package_id IS NULL OR project_id IS NOT NULL)
);

COMMENT ON TABLE public.gc_trade_promises IS
  'GC mode (v2.4833): a day a trade partner gave us for something other than a quote (TradePromise). One open per company, kind, job and trade; gc_record_promise moves it, gc_keep_promise and gc_keep_promises keep it.';

-- One open promise for the same thing: same company, kind, job and trade.
CREATE UNIQUE INDEX IF NOT EXISTS gc_trade_promises_one_open
  ON public.gc_trade_promises (company_id, kind, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(package_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE kept_on IS NULL;

-- The earlier days a promise was moved from, newest first when read (TradePromise.moved).
CREATE TABLE IF NOT EXISTS public.gc_trade_promise_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_id uuid NOT NULL REFERENCES public.gc_trade_promises(id) ON DELETE CASCADE,
  -- The day it was due before the move.
  was_due_on date NOT NULL,
  -- The day it moved.
  moved_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.gc_trade_promise_moves IS
  'GC mode (v2.4833): each earlier day a trade promise was moved from (TradePromise.moved). A day that passed before it moved counts against the company.';

CREATE INDEX IF NOT EXISTS gc_trade_promise_moves_promise_idx ON public.gc_trade_promise_moves (promise_id);

-- The foreign keys main's GC tables were waiting for (each column was empty or null on prod when this
-- was written; NOT VALID, then validated, so an unexpected row fails the second statement only).
-- RESTRICT: a company with records on a job is not deleted out from under them.
ALTER TABLE public.gc_plan_questions DROP CONSTRAINT IF EXISTS gc_plan_questions_company_fkey;
ALTER TABLE public.gc_plan_questions ADD CONSTRAINT gc_plan_questions_company_fkey
  FOREIGN KEY (company_id) REFERENCES public.gc_companies(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.gc_plan_set_sends DROP CONSTRAINT IF EXISTS gc_plan_set_sends_company_fkey;
ALTER TABLE public.gc_plan_set_sends ADD CONSTRAINT gc_plan_set_sends_company_fkey
  FOREIGN KEY (company_id) REFERENCES public.gc_companies(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.gc_schedule_late_notices DROP CONSTRAINT IF EXISTS gc_schedule_late_notices_company_fkey;
ALTER TABLE public.gc_schedule_late_notices ADD CONSTRAINT gc_schedule_late_notices_company_fkey
  FOREIGN KEY (company_id) REFERENCES public.gc_companies(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.gc_schedule_move_tells DROP CONSTRAINT IF EXISTS gc_schedule_move_tells_company_fkey;
ALTER TABLE public.gc_schedule_move_tells ADD CONSTRAINT gc_schedule_move_tells_company_fkey
  FOREIGN KEY (company_id) REFERENCES public.gc_companies(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.gc_schedule_move_answers DROP CONSTRAINT IF EXISTS gc_schedule_move_answers_company_fkey;
ALTER TABLE public.gc_schedule_move_answers ADD CONSTRAINT gc_schedule_move_answers_company_fkey
  FOREIGN KEY (company_id) REFERENCES public.gc_companies(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.gc_schedule_lookahead_marks DROP CONSTRAINT IF EXISTS gc_schedule_lookahead_marks_company_fkey;
ALTER TABLE public.gc_schedule_lookahead_marks ADD CONSTRAINT gc_schedule_lookahead_marks_company_fkey
  FOREIGN KEY (marked_by_company_id) REFERENCES public.gc_companies(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.gc_schedule_crew_counts DROP CONSTRAINT IF EXISTS gc_schedule_crew_counts_company_fkey;
ALTER TABLE public.gc_schedule_crew_counts ADD CONSTRAINT gc_schedule_crew_counts_company_fkey
  FOREIGN KEY (company_id) REFERENCES public.gc_companies(id) ON DELETE RESTRICT NOT VALID;

ALTER TABLE public.gc_plan_questions VALIDATE CONSTRAINT gc_plan_questions_company_fkey;
ALTER TABLE public.gc_plan_set_sends VALIDATE CONSTRAINT gc_plan_set_sends_company_fkey;
ALTER TABLE public.gc_schedule_late_notices VALIDATE CONSTRAINT gc_schedule_late_notices_company_fkey;
ALTER TABLE public.gc_schedule_move_tells VALIDATE CONSTRAINT gc_schedule_move_tells_company_fkey;
ALTER TABLE public.gc_schedule_move_answers VALIDATE CONSTRAINT gc_schedule_move_answers_company_fkey;
ALTER TABLE public.gc_schedule_lookahead_marks VALIDATE CONSTRAINT gc_schedule_lookahead_marks_company_fkey;
ALTER TABLE public.gc_schedule_crew_counts VALIDATE CONSTRAINT gc_schedule_crew_counts_company_fkey;

-- Who sees them (decision 8): dev only while it is built.
ALTER TABLE public.gc_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_company_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_company_vetting_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_company_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_trade_promises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_trade_promise_moves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_companies_dev ON public.gc_companies;
CREATE POLICY gc_companies_dev ON public.gc_companies FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_company_people_dev ON public.gc_company_people;
CREATE POLICY gc_company_people_dev ON public.gc_company_people FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_company_vetting_forms_dev ON public.gc_company_vetting_forms;
CREATE POLICY gc_company_vetting_forms_dev ON public.gc_company_vetting_forms FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_invites_dev ON public.gc_invites;
CREATE POLICY gc_invites_dev ON public.gc_invites FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_quotes_dev ON public.gc_quotes;
CREATE POLICY gc_quotes_dev ON public.gc_quotes FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_company_contacts_dev ON public.gc_company_contacts;
CREATE POLICY gc_company_contacts_dev ON public.gc_company_contacts FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_trade_promises_dev ON public.gc_trade_promises;
CREATE POLICY gc_trade_promises_dev ON public.gc_trade_promises FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_trade_promise_moves_dev ON public.gc_trade_promise_moves;
CREATE POLICY gc_trade_promise_moves_dev ON public.gc_trade_promise_moves FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));

-- The office's writes that touch more than one row, all or nothing. SECURITY INVOKER: RLS decides
-- who may. Plain writes under RLS cover the rest: a company's coverage, reach, language and people,
-- a contact line, a Get started date.

-- Add a company (addPartner): the row, its main contact and anyone else, in one press. A company
-- comes in not vetted unless the office says we have worked with them (question 3).
CREATE OR REPLACE FUNCTION public.gc_add_company(company jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_name text;
  v_trades text[];
  v_lang text;
  v_miles integer;
  x jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  v_name := btrim(coalesce(company->>'name', ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'Give the company a name.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(company->'trades') = 'array' THEN
    v_trades := ARRAY(SELECT DISTINCT btrim(value #>> '{}') FROM jsonb_array_elements(company->'trades') WHERE btrim(value #>> '{}') <> '');
  ELSE
    v_trades := '{}';
  END IF;
  IF cardinality(v_trades) = 0 THEN
    RAISE EXCEPTION 'Pick the trade they do.' USING ERRCODE = 'P0001';
  END IF;
  v_lang := coalesce(nullif(btrim(coalesce(company->>'lang', '')), ''), 'en');
  IF v_lang NOT IN ('en', 'es') THEN
    RAISE EXCEPTION 'The language is English or Spanish.' USING ERRCODE = 'P0001';
  END IF;
  v_miles := nullif(btrim(coalesce(company->>'maxMiles', '')), '')::integer;
  IF v_miles IS NOT NULL AND v_miles <= 0 THEN
    RAISE EXCEPTION 'How far they drive is a number of miles over 0.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.gc_companies (name, trades, contact_name, phone, email, address, max_miles, license, lang, vetting_status, created_by)
  VALUES (
    v_name, v_trades,
    btrim(coalesce(company->>'contactName', '')), btrim(coalesce(company->>'phone', '')), btrim(coalesce(company->>'email', '')),
    btrim(coalesce(company->>'address', '')), v_miles, btrim(coalesce(company->>'license', '')), v_lang,
    CASE WHEN coalesce((company->>'known')::boolean, false) THEN NULL ELSE 'new' END,
    v_uid
  ) RETURNING id INTO v_id;

  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(company->'people', '[]'::jsonb)) LOOP
    IF btrim(coalesce(x->>'name', '')) <> '' THEN
      INSERT INTO public.gc_company_people (company_id, name, email, role, gets, added_by)
      VALUES (
        v_id, btrim(x->>'name'), btrim(coalesce(x->>'email', '')), btrim(coalesce(x->>'role', '')),
        CASE WHEN jsonb_typeof(x->'gets') = 'array' THEN ARRAY(SELECT DISTINCT value #>> '{}' FROM jsonb_array_elements(x->'gets')) ELSE '{}'::text[] END,
        'office'
      );
    END IF;
  END LOOP;
  RETURN v_id;
END;
$$;

-- Approve or decline a company new to us (vetPartner): who decided and when, a limit on one award
-- for an approval, a note. Their form stays.
CREATE OR REPLACE FUNCTION public.gc_vet_company(p_company_id uuid, p_status text, p_limit numeric DEFAULT NULL, p_note text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('approved', 'declined') THEN
    RAISE EXCEPTION 'Approve the company or decline it.' USING ERRCODE = 'P0001';
  END IF;
  IF p_limit IS NOT NULL AND p_status <> 'approved' THEN
    RAISE EXCEPTION 'A limit goes with an approval only.' USING ERRCODE = 'P0001';
  END IF;
  IF p_limit IS NOT NULL AND p_limit <= 0 THEN
    RAISE EXCEPTION 'The limit is a dollar amount over 0.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_companies
  SET vetting_status = p_status, vetting_limit = p_limit, vetting_decided_on = current_date,
      vetting_decided_by = v_uid, vetting_note = btrim(coalesce(p_note, ''))
  WHERE id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No company with that id.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- Write down a day a company gave us (recordPromise). An open promise for the same thing (company,
-- kind, job and trade) moves, and its old day is kept; the same day again changes nothing.
-- p: {companyId, kind, projectId?, packageId?, dueOn, source ('office' or 'trade'), what}.
CREATE OR REPLACE FUNCTION public.gc_record_promise(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_kind text;
  v_project uuid;
  v_pkg uuid;
  v_due date;
  v_source text;
  v_what text;
  v_open public.gc_trade_promises%ROWTYPE;
  v_id uuid;
BEGIN
  v_company := nullif(btrim(coalesce(p->>'companyId', '')), '')::uuid;
  IF v_company IS NULL OR NOT EXISTS (SELECT 1 FROM public.gc_companies WHERE id = v_company) THEN
    RAISE EXCEPTION 'No company with that id.' USING ERRCODE = 'P0001';
  END IF;
  v_kind := btrim(coalesce(p->>'kind', ''));
  IF v_kind NOT IN ('insurance', 'w9', 'sow', 'start', 'submittals', 'delivery', 'payApp', 'punch', 'closeout', 'msa') THEN
    RAISE EXCEPTION 'That is not a kind of promise we keep.' USING ERRCODE = 'P0001';
  END IF;
  v_due := nullif(btrim(coalesce(p->>'dueOn', '')), '')::date;
  IF v_due IS NULL THEN
    RAISE EXCEPTION 'Pick the day they said.' USING ERRCODE = 'P0001';
  END IF;
  v_source := coalesce(nullif(btrim(coalesce(p->>'source', '')), ''), 'office');
  IF v_source NOT IN ('office', 'trade') THEN
    RAISE EXCEPTION 'A promise is written down by the office or the trade.' USING ERRCODE = 'P0001';
  END IF;
  v_project := nullif(btrim(coalesce(p->>'projectId', '')), '')::uuid;
  v_pkg := nullif(btrim(coalesce(p->>'packageId', '')), '')::uuid;
  IF v_pkg IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = v_pkg AND project_id = v_project) THEN
    RAISE EXCEPTION 'That trade is not on this project.' USING ERRCODE = 'P0001';
  END IF;
  v_what := btrim(coalesce(p->>'what', ''));

  SELECT * INTO v_open FROM public.gc_trade_promises
  WHERE kept_on IS NULL AND company_id = v_company AND kind = v_kind
    AND project_id IS NOT DISTINCT FROM v_project AND package_id IS NOT DISTINCT FROM v_pkg
  FOR UPDATE;
  IF FOUND THEN
    IF v_open.due_on = v_due THEN
      RETURN v_open.id;
    END IF;
    INSERT INTO public.gc_trade_promise_moves (promise_id, was_due_on) VALUES (v_open.id, v_open.due_on);
    UPDATE public.gc_trade_promises SET due_on = v_due, what = CASE WHEN v_what = '' THEN what ELSE v_what END
    WHERE id = v_open.id;
    RETURN v_open.id;
  END IF;

  IF v_what = '' THEN
    RAISE EXCEPTION 'Say what they promised.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.gc_trade_promises (company_id, kind, project_id, package_id, what, due_on, source)
  VALUES (v_company, v_kind, v_project, v_pkg, v_what, v_due, v_source)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- It came (keepPromise): the office marks one promise kept.
CREATE OR REPLACE FUNCTION public.gc_keep_promise(p_promise_id uuid, p_on date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gc_trade_promises WHERE id = p_promise_id) THEN
    RAISE EXCEPTION 'No promise with that id.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_trade_promises SET kept_on = coalesce(p_on, current_date)
  WHERE id = p_promise_id AND kept_on IS NULL;
END;
$$;

-- The thing came, so the open promise for it is kept (the SQL form of the prototype's
-- promisesKeptBy). Building's writes and the trade portal's verbs call it inside their own
-- transactions: a log with the trade on site keeps 'start', a new certificate keeps 'insurance'.
-- Same company, kind, job and trade, as openPromiseFor matches. Returns the promise kept, or null
-- when none was open. The signature is a seam other lanes call: change it only with them.
CREATE OR REPLACE FUNCTION public.gc_keep_promises(p_company_id uuid, p_kind text, p_project_id uuid DEFAULT NULL, p_package_id uuid DEFAULT NULL, p_on date DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.gc_trade_promises SET kept_on = coalesce(p_on, current_date)
  WHERE kept_on IS NULL AND company_id = p_company_id AND kind = p_kind
    AND project_id IS NOT DISTINCT FROM p_project_id AND package_id IS NOT DISTINCT FROM p_package_id
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Ask companies to quote a trade (invite): one ask each, a company already asked is skipped. Sends
-- nothing; the Ask window sends through the Portal lane's email after it. Returns the new asks.
CREATE OR REPLACE FUNCTION public.gc_invite_companies(p_package_id uuid, p_company_ids uuid[])
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ours boolean;
  v_lost date;
  v_missing integer;
  v_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  SELECT k.ours, g.lost_on INTO v_ours, v_lost
  FROM public.gc_trade_packages k JOIN public.gc_projects g ON g.project_id = k.project_id
  WHERE k.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No trade with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_lost IS NOT NULL THEN
    RAISE EXCEPTION 'We lost this bid. Nobody is asked on it.' USING ERRCODE = 'P0001';
  END IF;
  IF v_ours THEN
    RAISE EXCEPTION 'Our own crew does this trade. Nobody is asked.' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(cardinality(p_company_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Pick at least one company.' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_missing FROM unnest(p_company_ids) c(id)
  WHERE NOT EXISTS (SELECT 1 FROM public.gc_companies WHERE id = c.id);
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'A company picked is not on Trade partners.' USING ERRCODE = 'P0001';
  END IF;
  WITH made AS (
    INSERT INTO public.gc_invites (package_id, company_id, invited_by)
    SELECT p_package_id, c.id, v_uid FROM (SELECT DISTINCT unnest(p_company_ids) AS id) c
    ON CONFLICT (package_id, company_id) DO NOTHING
    RETURNING id
  )
  SELECT coalesce(array_agg(id), '{}') INTO v_ids FROM made;
  RETURN v_ids;
END;
$$;

-- Will not do it, or cannot do it, taken by phone (officeDecline): why, with a quick reason and
-- their words. The words are needed when the reason is something else.
CREATE OR REPLACE FUNCTION public.gc_office_decline(p_invite_id uuid, p_why text, p_reason text DEFAULT NULL, p_note text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_why IS NULL OR p_why NOT IN ('wont', 'cant') THEN
    RAISE EXCEPTION 'Say whether they will not do it or cannot.' USING ERRCODE = 'P0001';
  END IF;
  IF p_reason IS NOT NULL AND p_reason NOT IN ('busy', 'far', 'size', 'scope', 'terms', 'other') THEN
    RAISE EXCEPTION 'That reason is not one of the picks.' USING ERRCODE = 'P0001';
  END IF;
  IF p_reason = 'other' AND btrim(coalesce(p_note, '')) = '' THEN
    RAISE EXCEPTION 'Write down why in their words.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_invites
  SET status = 'declined', declined_why = p_why, decline_reason = p_reason,
      decline_note = btrim(coalesce(p_note, '')), declined_on = current_date
  WHERE id = p_invite_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No ask with that id.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.gc_add_company(jsonb) IS 'GC mode (v2.4833): add a trade partner company (addPartner): {name, trades[], contactName, phone, email, address, maxMiles, license, lang, known, people[{name, email, role, gets[]}]}. Not vetted unless known. Returns the id. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_vet_company(uuid, text, numeric, text) IS 'GC mode (v2.4833): approve (with an optional limit on one award) or decline a company new to us (vetPartner). SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_record_promise(jsonb) IS 'GC mode (v2.4833): a day a company gave us (recordPromise): moves the open one for the same company, kind, job and trade, keeping its old day, or writes a new one. Returns the promise id. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_keep_promise(uuid, date) IS 'GC mode (v2.4833): It came; the office marks one promise kept (keepPromise). SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_keep_promises(uuid, text, uuid, uuid, date) IS 'GC mode (v2.4833): the thing came, so the open promise of that company, kind, job and trade is kept (promisesKeptBy in SQL). Called inside Building''s writes and the trade portal''s verbs. Returns the promise kept or null. A seam: its signature changes only with those lanes. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_invite_companies(uuid, uuid[]) IS 'GC mode (v2.4833): ask companies to quote a trade (invite); skips a company already asked; refuses a lost bid and our own trade. Sends nothing. Returns the new ask ids. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_office_decline(uuid, text, text, text) IS 'GC mode (v2.4833): the office takes a company''s no by phone (officeDecline): will not or cannot, a reason and their words. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_add_company(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_vet_company(uuid, text, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_record_promise(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_keep_promise(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_keep_promises(uuid, text, uuid, uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_invite_companies(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_office_decline(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_add_company(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.gc_vet_company(uuid, text, numeric, text) FROM anon;
REVOKE ALL ON FUNCTION public.gc_record_promise(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.gc_keep_promise(uuid, date) FROM anon;
REVOKE ALL ON FUNCTION public.gc_keep_promises(uuid, text, uuid, uuid, date) FROM anon;
REVOKE ALL ON FUNCTION public.gc_invite_companies(uuid, uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.gc_office_decline(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_add_company(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_vet_company(uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_record_promise(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_keep_promise(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_keep_promises(uuid, text, uuid, uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gc_record_promise(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.gc_invite_companies(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_office_decline(uuid, text, text, text) TO authenticated;

-- Nobody signed out reaches them.
REVOKE ALL ON TABLE public.gc_companies, public.gc_company_people, public.gc_company_vetting_forms,
  public.gc_invites, public.gc_quotes, public.gc_company_contacts, public.gc_trade_promises,
  public.gc_trade_promise_moves FROM anon;

-- What is never changed once written: the call log and the asks' stories, the quotes (a new one is a
-- new row), and a promise's earlier days. No update, delete or truncate. A row still goes with its
-- company or its ask, by cascade, which runs as the table's owner.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.gc_company_contacts, public.gc_quotes,
  public.gc_trade_promise_moves FROM authenticated;

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
