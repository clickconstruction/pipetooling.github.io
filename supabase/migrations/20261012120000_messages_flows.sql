SET lock_timeout = '3s';

-- Messages, cut 4, the flow suite (to-dos/gc-mode/messages/BUILD_PLAN.md §3 and §4 on branch spike/gc-mode; the
-- kernels are src/lib/flows/facts.ts, state.ts and seed.ts, v2.5254 and v2.5260): the flows the office edits and what
-- the office does to one person's place on them. State is never stored: where a person stands is a read over the
-- stamps the app keeps (readFlow), so nothing here says which step anyone is on.
--
--   * flows: one per kind of person (customer, trade, arch, unknown). flow_steps: its steps in lanes (once, per_job,
--     any_time), each finished by facts from the code list (flow_fact_ids(), facts.ts's FLOW_FACTS) and turning on
--     papers (flow_paper_ids(), FLOW_PAPERS). A loop names when it lets the chain move on (loop_ends). The phase tiles
--     the boards; skip_one_job is the customer's master agreement; owed_words is Follow up's We owe them.
--   * flow_step_history and flow_removed_steps: every edit with its person and day, and the removed steps with Put it
--     back. flow_fact_wishes: Ask for a fact that is missing.
--   * contact_step_skips: a step skipped for one person with a reason. nudge_holds, nudge_sent: Hold until a day, and
--     what was sent for a step, so a reminder never doubles. Each names its job the spine's way (bid_id, project_id or
--     jobs_ledger_id, at most one; none on the Once lane). A step's team note is a line of the thread: messages gains
--     step_id, and a signed-in user may write a team line (a note or an event) as themselves and nothing else.
--   * The presses, SECURITY INVOKER so training mode and a twin change nothing: flow_add_note, flow_skip_step,
--     flow_unskip_step, nudge_hold_until, nudge_let_go, nudge_record_sent, contact_set_off, contact_put_back_on.
--   * flow_rows(contact): the rows the flow reads (src/lib/flows/load.ts's FlowRows), for the office. SECURITY DEFINER,
--     since the facts sit behind other doors (the Portal's, the money's): it returns days and marks, never an amount or
--     a token, and a trade partner's page as its preview path.
--   * Four facts main did not keep: gc_trade_portal_links.first_opened_at, gc_invites.lost_on, gc_projects.won_on and
--     gc_owner_pay_apps.paid_on. Nothing writes them yet; their writers come with cut 4's screens.
--   * contacts.off_*: the spine's columns (20261012010000); the office may now update them (Off the flow).
--   * contacts_fold_flows(): the spine's contacts_fold runs it, so a person's skips, holds and sends follow them
--     when two contacts become one. contacts_fold itself is never redefined.
--   * flows_seed() seeds the four flows from SEED_FLOWS, only for a kind that has no flow yet, so a second run changes
--     nothing and never brings back a step the office removed.
--   * The office team's (gc_office_team()), one policy a table. A row's who and when are the table's to set.

-- ---------- the code lists a step picks from ----------

-- The facts and the papers in src/lib/flows/facts.ts. A fact or a paper that is not here cannot be picked. Adding one
-- replaces these functions; src/lib/flows/flowsSql.test.ts holds them to the code list.
CREATE OR REPLACE FUNCTION public.flow_fact_ids()
RETURNS text[]
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
  SELECT ARRAY['invite_sent', 'portal_opened', 'w9_signed', 'coi_current', 'msa_signed', 'quote_in', 'quote_declined', 'tab_seen', 'carried', 'not_carried', 'sow_signed', 'draw_approved', 'draw_paid', 'final_waiver', 'asked_us', 'bid_sent', 'said_yes', 'declined', 'contract_signed', 'start_sent', 'started', 'payapp_paid', 'closed', 'warranty_over', 'co_answered', 'plans_in', 'question_answered', 'addendum_filed', 'submittal_reviewed', 'certified', 'named']::text[]
$$;

CREATE OR REPLACE FUNCTION public.flow_paper_ids()
RETURNS text[]
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
  SELECT ARRAY['invitation', 'w9', 'coi', 'msa', 'quote', 'sow', 'waiver', 'final_waiver', 'bid', 'contract', 'schedule', 'payapp', 'co', 'plans', 'addendum', 'submittal', 'certificate']::text[]
$$;

-- ---------- the flows ----------

CREATE TABLE IF NOT EXISTS public.flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL UNIQUE
    CONSTRAINT flows_kind_known CHECK (kind IN ('customer', 'trade', 'arch', 'unknown')),
  name text NOT NULL
    CONSTRAINT flows_name_said CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.flows IS
  'Messages (cut 4): one flow per kind of person, the steps in flow_steps. Where a person stands on it is a read over the stamps (src/lib/flows/state.ts readFlow), never stored. The office team''s.';

CREATE TABLE IF NOT EXISTS public.flow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  -- Stable across edits: a quick reply, a note, a skip or a hold ties to it (FlowStep.id).
  step_key text NOT NULL
    CONSTRAINT flow_steps_key_shape CHECK (step_key ~ '^[a-z][a-z0-9_]{0,39}$'),
  lane text NOT NULL
    CONSTRAINT flow_steps_lane_known CHECK (lane IN ('once', 'per_job', 'any_time')),
  position integer NOT NULL
    CONSTRAINT flow_steps_position_counts CHECK (position >= 0),
  name text NOT NULL
    CONSTRAINT flow_steps_name_said CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  name_es text NOT NULL DEFAULT '',
  phase text NOT NULL
    CONSTRAINT flow_steps_phase_known CHECK (phase IN ('setup', 'pricing', 'building')),
  who text NOT NULL
    CONSTRAINT flow_steps_who_known CHECK (who IN ('us', 'them', 'both')),
  -- Whose seat an our-move step sits with.
  seat_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  facts text[] NOT NULL DEFAULT '{}'
    CONSTRAINT flow_steps_facts_known CHECK (facts <@ public.flow_fact_ids()),
  join_word text NOT NULL DEFAULT 'and'
    CONSTRAINT flow_steps_join_known CHECK (join_word IN ('and', 'or')),
  papers text[] NOT NULL DEFAULT '{}'
    CONSTRAINT flow_steps_papers_known CHECK (papers <@ public.flow_paper_ids()),
  -- It repeats, per what ("each ask"); null when it runs once. loop_ends: rounds or next (FlowStep.loopEnds).
  loop_words text,
  loop_ends text
    CONSTRAINT flow_steps_loop_ends_known CHECK (loop_ends IN ('rounds', 'next')),
  fork boolean NOT NULL DEFAULT false,
  aside boolean NOT NULL DEFAULT false,
  skip_one_job boolean NOT NULL DEFAULT false,
  later_en text,
  later_es text,
  nudge_days integer
    CONSTRAINT flow_steps_nudge_days_counts CHECK (nudge_days >= 0),
  nudge_how text
    CONSTRAINT flow_steps_nudge_how_known CHECK (nudge_how IN ('text', 'call', 'email')),
  nudge_send text
    CONSTRAINT flow_steps_nudge_send_known CHECK (nudge_send IN ('ask', 'app')),
  nudge_day_fact text
    CONSTRAINT flow_steps_nudge_day_known CHECK (nudge_day_fact IN ('promised', 'pay_by', 'questions_close')),
  usual integer NOT NULL DEFAULT 0
    CONSTRAINT flow_steps_usual_counts CHECK (usual >= 0),
  owed_words text,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT flow_steps_key_once UNIQUE (flow_id, step_key),
  -- A loop says when it ends, and a step that runs once does not.
  CONSTRAINT flow_steps_loop_ends_with_loop CHECK ((loop_words IS NULL) = (loop_ends IS NULL)),
  -- A nudge is its days, how and who sends it, together; its day comes with a nudge.
  CONSTRAINT flow_steps_nudge_whole CHECK (
    (nudge_days IS NULL) = (nudge_how IS NULL) AND (nudge_how IS NULL) = (nudge_send IS NULL)
    AND (nudge_day_fact IS NULL OR nudge_days IS NOT NULL))
);

COMMENT ON TABLE public.flow_steps IS
  'Messages (cut 4): a flow''s steps (src/lib/flows/state.ts FlowStep), in lanes once, per_job and any_time, in position order. Each is finished by facts from flow_fact_ids() joined with join_word, never by a typed word. The office edits them in Settings → Flows, every change in flow_step_history.';

CREATE INDEX IF NOT EXISTS flow_steps_flow_idx ON public.flow_steps (flow_id, lane, position);

-- The clock's, on every edit.
DROP TRIGGER IF EXISTS flow_steps_updated_at ON public.flow_steps;
CREATE TRIGGER flow_steps_updated_at BEFORE UPDATE ON public.flow_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- what the office did to a flow ----------

CREATE TABLE IF NOT EXISTS public.flow_step_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  -- The step it changed; null for a change to the whole flow.
  step_key text,
  what text NOT NULL
    CONSTRAINT flow_step_history_what_said CHECK (length(btrim(what)) BETWEEN 1 AND 500),
  before jsonb,
  after jsonb,
  by_user_id uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.flow_step_history IS
  'Messages (cut 4): every edit to a flow with its person and day (Settings → Flows → History), append only. before and after hold the step as it was and as it became.';

CREATE INDEX IF NOT EXISTS flow_step_history_flow_idx ON public.flow_step_history (flow_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.flow_removed_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  lane text NOT NULL
    CONSTRAINT flow_removed_steps_lane_known CHECK (lane IN ('once', 'per_job', 'any_time')),
  -- The step as it was, so Put it back restores it whole.
  step jsonb NOT NULL,
  removed_by_user_id uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  removed_by_name text NOT NULL DEFAULT '',
  removed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  put_back_at timestamptz,
  put_back_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.flow_removed_steps IS
  'Messages (cut 4): a step the office removed, as it was (Settings → Flows → History → Removed). Put it back stamps put_back_at; the row stays.';

CREATE INDEX IF NOT EXISTS flow_removed_steps_flow_idx ON public.flow_removed_steps (flow_id, removed_at DESC);

CREATE TABLE IF NOT EXISTS public.flow_fact_wishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid REFERENCES public.flows(id) ON DELETE CASCADE,
  step_key text,
  text text NOT NULL
    CONSTRAINT flow_fact_wishes_text_said CHECK (length(btrim(text)) BETWEEN 1 AND 500),
  by_user_id uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.flow_fact_wishes IS
  'Messages (cut 4): Ask for a fact that is missing, from the editor''s fact picker; a developer reads them. Append only.';

-- ---------- what the office did to one person's place ----------

-- A step's team note is a line of the thread (messages, channel note, direction team), with the step it is on. No
-- foreign key: a removed step keeps its notes, and a step's id outlives an edit.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS step_id text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_step_on_team_lines' AND conrelid = 'public.messages'::regclass) THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_step_on_team_lines
      CHECK (step_id IS NULL OR (direction = 'team' AND step_id ~ '^[a-z][a-z0-9_]{0,39}$'));
  END IF;
END
$$;
COMMENT ON COLUMN public.messages.step_id IS
  'Messages (cut 4): the flow step a team note or an event is on (flow_steps.step_key); the step card shows the notes. No foreign key: a removed step keeps its notes.';
CREATE INDEX IF NOT EXISTS messages_step_idx ON public.messages (contact_id, step_id) WHERE step_id IS NOT NULL;

-- A signed-in user writes a team line (a note or an event) as themselves and no other line: calls, texts and emails
-- arrive as the service role. The office's policy stays the spine's; this one narrows what a client may insert. The same
-- name and definition as cut 2's (20261012160000, helper 2's), so whichever runs last leaves the same policy.
DROP POLICY IF EXISTS messages_client_writes_own_team_notes ON public.messages;
DROP POLICY IF EXISTS messages_team_lines_by_hand ON public.messages;
DROP POLICY IF EXISTS messages_client_writes_own_team_lines ON public.messages;
CREATE POLICY messages_client_writes_own_team_lines ON public.messages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (channel IN ('note', 'event') AND direction = 'team' AND who_user_id = (SELECT auth.uid()));
GRANT INSERT (contact_id, bid_id, project_id, jobs_ledger_id, channel, direction, who_user_id, body, step_id)
  ON TABLE public.messages TO authenticated;

CREATE TABLE IF NOT EXISTS public.contact_step_skips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  bid_id uuid REFERENCES public.bids(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  jobs_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  why text NOT NULL
    CONSTRAINT contact_step_skips_why_said CHECK (length(btrim(why)) BETWEEN 1 AND 500),
  by_user_id uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  undone_at timestamptz,
  undone_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT contact_step_skips_one_job CHECK (num_nonnulls(bid_id, project_id, jobs_ledger_id) <= 1)
);

COMMENT ON TABLE public.contact_step_skips IS
  'Messages (cut 4): a step skipped for one person with the reason (StepSkip); the read passes it. Undo stamps undone_at; one standing skip per person, step and job.';

CREATE UNIQUE INDEX IF NOT EXISTS contact_step_skips_standing ON public.contact_step_skips
  (contact_id, step_key, bid_id, project_id, jobs_ledger_id) NULLS NOT DISTINCT WHERE undone_at IS NULL;

CREATE TABLE IF NOT EXISTS public.nudge_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  bid_id uuid REFERENCES public.bids(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  jobs_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  -- Hold until this day: the nudge stays quiet through the day before it.
  until_on date NOT NULL,
  by_user_id uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  released_at timestamptz,
  released_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT nudge_holds_one_job CHECK (num_nonnulls(bid_id, project_id, jobs_ledger_id) <= 1)
);

COMMENT ON TABLE public.nudge_holds IS
  'Messages (cut 4): Hold until a day on one person''s step nudge. Let it go stamps released_at; one standing hold per person, step and job.';

CREATE UNIQUE INDEX IF NOT EXISTS nudge_holds_standing ON public.nudge_holds
  (contact_id, step_key, bid_id, project_id, jobs_ledger_id) NULLS NOT DISTINCT WHERE released_at IS NULL;

CREATE TABLE IF NOT EXISTS public.nudge_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  bid_id uuid REFERENCES public.bids(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  jobs_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  -- The round it was for, on a loop (the invite, the draw, the pay application).
  round_key text,
  how text NOT NULL
    CONSTRAINT nudge_sent_how_known CHECK (how IN ('text', 'call', 'email')),
  -- A person sent it (by_user_id) or the app did (none).
  sent_by text NOT NULL
    CONSTRAINT nudge_sent_by_known CHECK (sent_by IN ('person', 'app')),
  by_user_id uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT nudge_sent_one_job CHECK (num_nonnulls(bid_id, project_id, jobs_ledger_id) <= 1),
  CONSTRAINT nudge_sent_app_has_no_person CHECK (sent_by = 'person' OR by_user_id IS NULL)
);

COMMENT ON TABLE public.nudge_sent IS
  'Messages (cut 4): what a person or the app sent for one person''s step, and when, so a reminder never doubles (flows/nudges.ts). Append only.';

CREATE INDEX IF NOT EXISTS nudge_sent_contact_idx ON public.nudge_sent (contact_id, step_key, sent_at DESC);

-- ---------- who lifted a skip, a hold or a removal ----------

-- An undo is stamped with the signed-in user, never a column the client sets. The column is the trigger's argument.
CREATE OR REPLACE FUNCTION public.flows_stamp_lifted_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[0], auth.uid()));
END
$$;

DROP TRIGGER IF EXISTS contact_step_skips_undone_by ON public.contact_step_skips;
CREATE TRIGGER contact_step_skips_undone_by BEFORE UPDATE OF undone_at ON public.contact_step_skips
  FOR EACH ROW WHEN (OLD.undone_at IS NULL AND NEW.undone_at IS NOT NULL)
  EXECUTE FUNCTION public.flows_stamp_lifted_by('undone_by_user_id');

DROP TRIGGER IF EXISTS nudge_holds_released_by ON public.nudge_holds;
CREATE TRIGGER nudge_holds_released_by BEFORE UPDATE OF released_at ON public.nudge_holds
  FOR EACH ROW WHEN (OLD.released_at IS NULL AND NEW.released_at IS NOT NULL)
  EXECUTE FUNCTION public.flows_stamp_lifted_by('released_by_user_id');

DROP TRIGGER IF EXISTS flow_removed_steps_put_back_by ON public.flow_removed_steps;
CREATE TRIGGER flow_removed_steps_put_back_by BEFORE UPDATE OF put_back_at ON public.flow_removed_steps
  FOR EACH ROW WHEN (OLD.put_back_at IS NULL AND NEW.put_back_at IS NOT NULL)
  EXECUTE FUNCTION public.flows_stamp_lifted_by('put_back_by_user_id');

-- ---------- a fold keeps a person's place ----------

-- When two contacts become one (Who is this?, a customer merge), the spine's contacts_fold runs every
-- contacts_fold_<something>(uuid, uuid) before the folded contact goes, which would cascade these rows away. This one moves
-- the skips, holds and sends onto the contact that stays (the spine moves the notes, which are messages). A step skipped or held on both keeps the survivor's;
-- the other's is lifted as the fold's, so one stands. Runs as the caller, so training mode and a twin change nothing.
CREATE OR REPLACE FUNCTION public.contacts_fold_flows(p_from uuid, p_into uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_from IS NULL OR p_into IS NULL OR p_from = p_into THEN
    RETURN;
  END IF;
  UPDATE public.contact_step_skips f SET undone_at = clock_timestamp()
  WHERE f.contact_id = p_from AND f.undone_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.contact_step_skips t
      WHERE t.contact_id = p_into AND t.undone_at IS NULL AND t.step_key = f.step_key
        AND t.bid_id IS NOT DISTINCT FROM f.bid_id AND t.project_id IS NOT DISTINCT FROM f.project_id
        AND t.jobs_ledger_id IS NOT DISTINCT FROM f.jobs_ledger_id);
  UPDATE public.nudge_holds f SET released_at = clock_timestamp()
  WHERE f.contact_id = p_from AND f.released_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.nudge_holds t
      WHERE t.contact_id = p_into AND t.released_at IS NULL AND t.step_key = f.step_key
        AND t.bid_id IS NOT DISTINCT FROM f.bid_id AND t.project_id IS NOT DISTINCT FROM f.project_id
        AND t.jobs_ledger_id IS NOT DISTINCT FROM f.jobs_ledger_id);
  UPDATE public.contact_step_skips SET contact_id = p_into WHERE contact_id = p_from;
  UPDATE public.nudge_holds SET contact_id = p_into WHERE contact_id = p_from;
  UPDATE public.nudge_sent SET contact_id = p_into WHERE contact_id = p_from;
END;
$$;

COMMENT ON FUNCTION public.contacts_fold_flows(uuid, uuid) IS
  'Messages (cut 4): run by the spine''s contacts_fold before the folded contact goes; moves its step skips, holds and sent nudges onto the contact that stays (its notes are messages, which the spine moves), lifting a skip or a hold both had. SECURITY INVOKER.';

REVOKE EXECUTE ON FUNCTION public.contacts_fold_flows(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contacts_fold_flows(uuid, uuid) TO authenticated, service_role;

-- ---------- the four facts main did not keep ----------

ALTER TABLE public.gc_trade_portal_links ADD COLUMN IF NOT EXISTS first_opened_at timestamptz;
COMMENT ON COLUMN public.gc_trade_portal_links.first_opened_at IS
  'Messages (cut 4): the first visit to the link, the fact portal_opened (facts.ts); gc_companies.portal_opened_on, their press on Got it, stood in for it.';

ALTER TABLE public.gc_invites ADD COLUMN IF NOT EXISTS lost_on date;
COMMENT ON COLUMN public.gc_invites.lost_on IS
  'Messages (cut 4): the day we did not carry this quote, the fact not_carried; inferred from gc_trade_packages.carried_invite_id before.';

ALTER TABLE public.gc_projects ADD COLUMN IF NOT EXISTS won_on date;
COMMENT ON COLUMN public.gc_projects.won_on IS
  'Messages (cut 4): the day the customer said yes, the fact said_yes; a move to buyout kept no day before.';

ALTER TABLE public.gc_owner_pay_apps ADD COLUMN IF NOT EXISTS paid_on date;
COMMENT ON COLUMN public.gc_owner_pay_apps.paid_on IS
  'Messages (cut 4): the day the pay application was paid, the fact payapp_paid; read through invoice_id before.';

-- ---------- the seed ----------

-- The four flows as src/lib/flows/seed.ts draws them (SEED_FLOWS, the prototype v1.178), for a kind with no flow yet:
-- a second run changes nothing, and a step the office removed stays removed. Seats are left for the office to set.
-- src/lib/flows/flowsSql.test.ts holds these rows to SEED_FLOWS.
CREATE OR REPLACE FUNCTION public.flows_seed()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  added integer;
BEGIN
  WITH new_flows AS (
    INSERT INTO public.flows (kind, name)
    VALUES ('customer', 'Customer flow'), ('trade', 'Trade partner flow'), ('arch', 'Architect flow'), ('unknown', 'The flow')
    ON CONFLICT (kind) DO NOTHING
    RETURNING id, kind
  ), seeded AS (
    INSERT INTO public.flow_steps (flow_id, step_key, lane, position, name, name_es, phase, who, facts, join_word, papers,
      loop_words, loop_ends, fork, aside, skip_one_job, later_en, later_es, nudge_days, nudge_how, nudge_send,
      nudge_day_fact, usual, owed_words)
    SELECT f.id, s.step_key, s.lane, s.position, s.name, s.name_es, s.phase, s.who, s.facts, s.join_word, s.papers,
      s.loop_words, s.loop_ends, s.fork, s.aside, s.skip_one_job, s.later_en, s.later_es, s.nudge_days, s.nudge_how,
      s.nudge_send, s.nudge_day_fact, s.usual, s.owed_words
    FROM new_flows f
    JOIN (VALUES
      ('customer', 'agreement', 'once', 0, 'Master agreement', 'Acuerdo marco', 'setup', 'them', ARRAY['msa_signed'], 'and', ARRAY['msa'], NULL, NULL, false, false, true, 'Repeat customers only.', 'Solo para clientes recurrentes.', 5, 'call', 'ask', NULL, 10, NULL),
      ('customer', 'asked', 'per_job', 0, 'Asked us', 'Nos consultó', 'pricing', 'them', ARRAY['asked_us'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'When you ask, or your plans come in.', 'Cuando nos consulte, o lleguen sus planos.', NULL, NULL, NULL, NULL, 1, NULL),
      ('customer', 'bid', 'per_job', 1, 'Our bid', 'Nuestra oferta', 'pricing', 'us', ARRAY['bid_sent'], 'and', ARRAY['bid'], NULL, NULL, false, false, false, 'Within two weeks of your plans.', 'Dentro de dos semanas de recibir sus planos.', NULL, NULL, NULL, NULL, 9, 'our bid'),
      ('customer', 'yes', 'per_job', 2, 'Said yes', 'Aceptó', 'pricing', 'them', ARRAY['said_yes', 'declined'], 'or', '{}'::text[], NULL, NULL, true, false, false, NULL, NULL, 5, 'call', 'ask', NULL, 6, NULL),
      ('customer', 'contract', 'per_job', 3, 'Contract signed', 'Contrato firmado', 'pricing', 'them', ARRAY['contract_signed'], 'and', ARRAY['contract'], NULL, NULL, false, false, false, 'Once you say yes.', 'Cuando acepte.', 3, 'text', 'ask', NULL, 4, NULL),
      ('customer', 'start', 'per_job', 4, 'Start date', 'Fecha de inicio', 'building', 'us', ARRAY['start_sent'], 'and', ARRAY['schedule'], NULL, NULL, false, false, false, 'Once the contract is signed.', 'Cuando el contrato esté firmado.', NULL, NULL, NULL, NULL, 3, 'the start date'),
      ('customer', 'onsite', 'per_job', 5, 'On site', 'En obra', 'building', 'us', ARRAY['started'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'After your start date.', 'Después de su fecha de inicio.', NULL, NULL, NULL, NULL, 10, 'the day we are on site'),
      ('customer', 'payapp', 'per_job', 6, 'Pay application', 'Solicitud de pago', 'building', 'both', ARRAY['payapp_paid'], 'and', ARRAY['payapp'], 'each month', 'next', false, false, false, 'Once a month, from the first month on site.', 'Una vez al mes, desde el primer mes en obra.', 5, 'text', 'ask', 'pay_by', 21, NULL),
      ('customer', 'close', 'per_job', 7, 'Closeout', 'Cierre', 'building', 'us', ARRAY['closed'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'When the work is done and you accept it.', 'Cuando la obra termine y usted la acepte.', NULL, NULL, NULL, NULL, 14, 'the closeout papers'),
      ('customer', 'warranty', 'per_job', 8, 'Warranty', 'Garantía', 'building', 'us', ARRAY['warranty_over'], 'and', '{}'::text[], NULL, NULL, false, false, false, 'A year from closeout.', 'Un año desde el cierre.', NULL, NULL, NULL, NULL, 365, 'the warranty papers'),
      ('customer', 'co', 'per_job', 9, 'Change orders', 'Órdenes de cambio', 'building', 'them', ARRAY['co_answered'], 'and', ARRAY['co'], 'each change', 'rounds', false, true, false, 'Only when something changes.', 'Solo cuando algo cambie.', 3, 'text', 'ask', NULL, 4, NULL),
      ('trade', 'invited', 'once', 0, 'Invited', 'Invitado', 'setup', 'us', ARRAY['invite_sent'], 'and', ARRAY['invitation'], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 2, 'the invitation'),
      ('trade', 'portal', 'once', 1, 'Portal opened', 'Portal abierto', 'setup', 'them', ARRAY['portal_opened'], 'and', '{}'::text[], NULL, NULL, false, false, false, NULL, NULL, 3, 'text', 'app', NULL, 1, NULL),
      ('trade', 'papers', 'once', 2, 'Papers in', 'Documentos recibidos', 'setup', 'them', ARRAY['w9_signed', 'coi_current'], 'and', ARRAY['w9', 'coi'], NULL, NULL, false, false, false, NULL, NULL, 5, 'call', 'ask', NULL, 3, NULL),
      ('trade', 'msa', 'once', 3, 'MSA signed', 'Acuerdo firmado', 'setup', 'them', ARRAY['msa_signed'], 'and', ARRAY['msa'], NULL, NULL, false, false, false, NULL, NULL, 3, 'text', 'ask', NULL, 4, NULL),
      ('trade', 'ask', 'per_job', 0, 'Asked to quote', 'Cotización pedida', 'pricing', 'them', ARRAY['quote_in', 'quote_declined'], 'or', ARRAY['quote'], 'each ask', 'rounds', false, false, false, 'When a job of yours comes up.', 'Cuando surja un trabajo para usted.', 7, 'text', 'ask', 'promised', 6, NULL),
      ('trade', 'compare', 'per_job', 1, 'Compared', 'Comparado', 'pricing', 'us', ARRAY['carried', 'not_carried'], 'or', '{}'::text[], NULL, NULL, true, false, false, 'After your quote is in.', 'Después de recibir su cotización.', NULL, NULL, NULL, NULL, 2, 'our decision on their quote'),
      ('trade', 'sow', 'per_job', 2, 'Statement of work', 'Alcance de trabajo', 'building', 'them', ARRAY['sow_signed'], 'and', ARRAY['sow'], NULL, NULL, false, false, false, 'If we carry your quote.', 'Si llevamos su cotización.', 3, 'text', 'ask', NULL, 5, NULL),
      ('trade', 'draws', 'per_job', 3, 'Draws', 'Pagos parciales', 'building', 'both', ARRAY['draw_paid'], 'and', ARRAY['waiver'], 'each draw', 'next', false, false, false, 'Monthly, once you are on site.', 'Cada mes, una vez en obra.', NULL, NULL, NULL, NULL, 12, NULL),
      ('trade', 'closeout', 'per_job', 4, 'Closeout', 'Cierre', 'building', 'them', ARRAY['final_waiver'], 'and', ARRAY['final_waiver'], NULL, NULL, false, false, false, 'At the end of your work.', 'Al terminar su trabajo.', 7, 'email', 'ask', NULL, 9, NULL),
      ('arch', 'plans', 'per_job', 0, 'Plans in', 'Planos recibidos', 'building', 'them', ARRAY['plans_in'], 'and', ARRAY['plans'], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 2, NULL),
      ('arch', 'questions', 'per_job', 1, 'Questions', 'Preguntas', 'building', 'them', ARRAY['question_answered'], 'and', '{}'::text[], 'each question', 'rounds', false, false, false, NULL, NULL, 0, 'email', 'ask', 'questions_close', 3, NULL),
      ('arch', 'addenda', 'per_job', 2, 'Addenda', 'Adendas', 'building', 'them', ARRAY['addendum_filed'], 'and', ARRAY['addendum'], 'each addendum', 'rounds', false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 1, NULL),
      ('arch', 'submittals', 'per_job', 3, 'Submittals', 'Sometimientos', 'building', 'them', ARRAY['submittal_reviewed'], 'and', ARRAY['submittal'], 'each submittal', 'next', false, false, false, NULL, NULL, 10, 'email', 'ask', NULL, 8, NULL),
      ('arch', 'certify', 'per_job', 4, 'Certify pay apps', 'Certificar pagos', 'building', 'them', ARRAY['certified'], 'and', ARRAY['certificate'], 'each pay app', 'next', false, false, false, NULL, NULL, 3, 'email', 'ask', NULL, 4, NULL),
      ('unknown', 'who', 'once', 0, 'Who is this?', '¿Quién es?', 'setup', 'us', ARRAY['named'], 'and', '{}'::text[], NULL, NULL, false, false, false, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL)
    ) AS s(kind, step_key, lane, position, name, name_es, phase, who, facts, join_word, papers, loop_words, loop_ends,
      fork, aside, skip_one_job, later_en, later_es, nudge_days, nudge_how, nudge_send, nudge_day_fact, usual, owed_words)
      ON s.kind = f.kind
    RETURNING 1
  )
  SELECT count(*) INTO added FROM seeded;
  RETURN added;
END
$$;

COMMENT ON FUNCTION public.flows_seed() IS
  'Messages (cut 4): seeds the four flows from SEED_FLOWS (src/lib/flows/seed.ts), only for a kind with no flow; returns the steps it added. Run by the migration; a second run adds nothing.';

REVOKE EXECUTE ON FUNCTION public.flows_seed() FROM PUBLIC, anon, authenticated;

SELECT public.flows_seed();

-- ---------- who reaches it ----------

ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_step_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_removed_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_fact_wishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_step_skips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudge_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudge_sent ENABLE ROW LEVEL SECURITY;

-- The office team reads and writes each, one policy a table.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'flows', 'flow_steps', 'flow_step_history', 'flow_removed_steps', 'flow_fact_wishes',
    'contact_step_skips', 'nudge_holds', 'nudge_sent'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_team', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((SELECT public.gc_office_team())) WITH CHECK ((SELECT public.gc_office_team()))', t || '_team', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
  END LOOP;
END
$$;

-- The flows themselves are the seed's; the office edits their steps (Settings → Flows), adds one and removes one.
GRANT INSERT (flow_id, step_key, lane, position, name, name_es, phase, who, seat_user_id, facts, join_word, papers,
  loop_words, loop_ends, fork, aside, skip_one_job, later_en, later_es, nudge_days, nudge_how, nudge_send,
  nudge_day_fact, usual, owed_words) ON TABLE public.flow_steps TO authenticated;
GRANT UPDATE (lane, position, name, name_es, phase, who, seat_user_id, facts, join_word, papers, loop_words, loop_ends,
  fork, aside, skip_one_job, later_en, later_es, nudge_days, nudge_how, nudge_send, nudge_day_fact, usual, owed_words)
  ON TABLE public.flow_steps TO authenticated;
GRANT DELETE ON TABLE public.flow_steps TO authenticated;
-- Append only: who and when are the table's.
GRANT INSERT (flow_id, step_key, what, before, after, by_name) ON TABLE public.flow_step_history TO authenticated;
GRANT INSERT (flow_id, step_key, lane, step, removed_by_name) ON TABLE public.flow_removed_steps TO authenticated;
GRANT UPDATE (put_back_at) ON TABLE public.flow_removed_steps TO authenticated;
GRANT INSERT (flow_id, step_key, text, by_name) ON TABLE public.flow_fact_wishes TO authenticated;
GRANT INSERT (contact_id, step_key, bid_id, project_id, jobs_ledger_id, why, by_name) ON TABLE public.contact_step_skips TO authenticated;
GRANT UPDATE (undone_at) ON TABLE public.contact_step_skips TO authenticated;
GRANT INSERT (contact_id, step_key, bid_id, project_id, jobs_ledger_id, until_on, by_name) ON TABLE public.nudge_holds TO authenticated;
GRANT UPDATE (released_at) ON TABLE public.nudge_holds TO authenticated;
-- A person's send; the app's own sends go in as the service role.
GRANT INSERT (contact_id, step_key, bid_id, project_id, jobs_ledger_id, round_key, how, sent_by, message_id) ON TABLE public.nudge_sent TO authenticated;

-- A fold re-points a person's rows (contacts_fold_flows runs as the caller).
GRANT UPDATE (contact_id) ON TABLE public.contact_step_skips, public.nudge_holds, public.nudge_sent TO authenticated;

-- Off the flow (the spine's columns): the office's word on a person, kept beside the contact.
GRANT UPDATE (off_since, off_why, off_by) ON TABLE public.contacts TO authenticated;

-- ---------- the presses on a person's place ----------

-- The step must be on the person's flow (their kind's), else 'stepUnknown'. Read as the caller: nobody outside the
-- office finds a step.
CREATE OR REPLACE FUNCTION public.flow_step_check(p_contact uuid, p_step text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.contacts c
    JOIN public.flows f ON f.kind = c.kind
    JOIN public.flow_steps s ON s.flow_id = f.id AND s.step_key = p_step
    WHERE c.id = p_contact
  ) THEN
    RAISE EXCEPTION 'stepUnknown' USING ERRCODE = 'P0001', DETAIL = 'That step is not on this person''s flow.';
  END IF;
END;
$$;

-- The signed-in user's name, as a row's by_name shows it.
CREATE OR REPLACE FUNCTION public.flows_my_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce((SELECT btrim(name) FROM public.users WHERE id = auth.uid()), '')
$$;

-- Add a note: a team line in their thread on the step, on a job or on the person.
CREATE OR REPLACE FUNCTION public.flow_add_note(p_contact uuid, p_step text, p_job_kind text, p_job_id uuid, p_note text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_bid uuid := CASE WHEN p_job_kind = 'bid' THEN p_job_id END;
  v_project uuid := CASE WHEN p_job_kind = 'project' THEN p_job_id END;
  v_pipeline uuid := CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END;
  v_id uuid;
  v_note text := btrim(coalesce(p_note, ''));
BEGIN
  IF v_note = '' OR length(v_note) > 2000 THEN
    RAISE EXCEPTION 'noteEmpty' USING ERRCODE = 'P0001', DETAIL = 'A note says something, in 2,000 letters or fewer.';
  END IF;
  PERFORM public.contact_job_check(p_job_kind, p_job_id);
  PERFORM public.flow_step_check(p_contact, p_step);
  INSERT INTO public.messages (contact_id, bid_id, project_id, jobs_ledger_id, channel, direction, who_user_id, body, step_id)
  VALUES (p_contact,
    v_bid, v_project, v_pipeline,
    'note', 'team', auth.uid(), v_note, p_step)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Skip a step for one person, with the reason; 'alreadySkipped' when one stands.
CREATE OR REPLACE FUNCTION public.flow_skip_step(p_contact uuid, p_step text, p_job_kind text, p_job_id uuid, p_why text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_bid uuid := CASE WHEN p_job_kind = 'bid' THEN p_job_id END;
  v_project uuid := CASE WHEN p_job_kind = 'project' THEN p_job_id END;
  v_pipeline uuid := CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END;
  v_id uuid;
  v_why text := btrim(coalesce(p_why, ''));
BEGIN
  IF v_why = '' OR length(v_why) > 500 THEN
    RAISE EXCEPTION 'whyEmpty' USING ERRCODE = 'P0001', DETAIL = 'Say why the step is skipped for them.';
  END IF;
  PERFORM public.contact_job_check(p_job_kind, p_job_id);
  PERFORM public.flow_step_check(p_contact, p_step);
  IF EXISTS (
    SELECT 1 FROM public.contact_step_skips
    WHERE contact_id = p_contact AND step_key = p_step AND undone_at IS NULL
      AND bid_id IS NOT DISTINCT FROM v_bid AND project_id IS NOT DISTINCT FROM v_project
      AND jobs_ledger_id IS NOT DISTINCT FROM v_pipeline
  ) THEN
    RAISE EXCEPTION 'alreadySkipped' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.contact_step_skips (contact_id, step_key, bid_id, project_id, jobs_ledger_id, why, by_name)
  VALUES (p_contact, p_step,
    v_bid, v_project, v_pipeline,
    v_why, public.flows_my_name())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Put a skipped step back on: the skip is undone, stamped with who.
CREATE OR REPLACE FUNCTION public.flow_unskip_step(p_skip uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contact_step_skips SET undone_at = clock_timestamp() WHERE id = p_skip AND undone_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- Hold a step's reminder until a day after today; a hold already standing is let go first.
CREATE OR REPLACE FUNCTION public.nudge_hold_until(p_contact uuid, p_step text, p_job_kind text, p_job_id uuid, p_until date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_bid uuid := CASE WHEN p_job_kind = 'bid' THEN p_job_id END;
  v_project uuid := CASE WHEN p_job_kind = 'project' THEN p_job_id END;
  v_pipeline uuid := CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END;
  v_id uuid;
BEGIN
  IF p_until IS NULL OR p_until <= public.app_today() THEN
    RAISE EXCEPTION 'dayPassed' USING ERRCODE = 'P0001', DETAIL = 'Hold until a day after today.';
  END IF;
  PERFORM public.contact_job_check(p_job_kind, p_job_id);
  PERFORM public.flow_step_check(p_contact, p_step);
  UPDATE public.nudge_holds SET released_at = clock_timestamp()
  WHERE contact_id = p_contact AND step_key = p_step AND released_at IS NULL
    AND bid_id IS NOT DISTINCT FROM v_bid AND project_id IS NOT DISTINCT FROM v_project
    AND jobs_ledger_id IS NOT DISTINCT FROM v_pipeline;
  INSERT INTO public.nudge_holds (contact_id, step_key, bid_id, project_id, jobs_ledger_id, until_on, by_name)
  VALUES (p_contact, p_step,
    v_bid, v_project, v_pipeline,
    p_until, public.flows_my_name())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Let a hold go before its day.
CREATE OR REPLACE FUNCTION public.nudge_let_go(p_hold uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.nudge_holds SET released_at = clock_timestamp() WHERE id = p_hold AND released_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- What a person sent for a step (Remind now), so the app never sends a second reminder on top of it.
CREATE OR REPLACE FUNCTION public.nudge_record_sent(p_contact uuid, p_step text, p_job_kind text, p_job_id uuid, p_round text, p_how text, p_message uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_bid uuid := CASE WHEN p_job_kind = 'bid' THEN p_job_id END;
  v_project uuid := CASE WHEN p_job_kind = 'project' THEN p_job_id END;
  v_pipeline uuid := CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END;
  v_id uuid;
BEGIN
  IF p_how IS NULL OR p_how NOT IN ('text', 'call', 'email') THEN
    RAISE EXCEPTION 'howUnknown' USING ERRCODE = 'P0001', DETAIL = 'A reminder goes as a text, a call or an email.';
  END IF;
  PERFORM public.contact_job_check(p_job_kind, p_job_id);
  PERFORM public.flow_step_check(p_contact, p_step);
  INSERT INTO public.nudge_sent (contact_id, step_key, bid_id, project_id, jobs_ledger_id, round_key, how, sent_by, message_id)
  VALUES (p_contact, p_step,
    v_bid, v_project, v_pipeline,
    nullif(btrim(coalesce(p_round, '')), ''), p_how, 'person', p_message)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Take a person off the flow, with why: the office's word, from today, with who.
CREATE OR REPLACE FUNCTION public.contact_set_off(p_contact uuid, p_why text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_why text := btrim(coalesce(p_why, ''));
BEGIN
  IF v_why = '' OR length(v_why) > 500 THEN
    RAISE EXCEPTION 'whyEmpty' USING ERRCODE = 'P0001', DETAIL = 'Say why they come off the flow.';
  END IF;
  UPDATE public.contacts SET off_since = public.app_today(), off_why = v_why, off_by = auth.uid() WHERE id = p_contact;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- Put them back on the flow.
CREATE OR REPLACE FUNCTION public.contact_put_back_on(p_contact uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contacts SET off_since = NULL, off_why = NULL, off_by = NULL WHERE id = p_contact AND off_since IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ---------- what the flow reads, for the office ----------

-- One person's rows as src/lib/flows/load.ts's FlowRows: their contact and jobs, and for their kind the asks, papers,
-- draws, pay applications, change orders, plans, questions and submittals the flow reads. Definer, since those rows sit
-- behind other doors (the Portal's, the money's), and gated on the office team. Days and marks only: no amount, no
-- price, no token. A trade partner's page comes as its preview path. 'notAllowed' outside the office; 'notFound' for no
-- such contact.
CREATE OR REPLACE FUNCTION public.flow_rows(p_contact uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.contacts;
  v_company uuid;
  v_customer uuid;
  v_projects uuid[];
  v_invites uuid[];
  v_sows uuid[];
BEGIN
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'notAllowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM public.contacts WHERE id = p_contact;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001';
  END IF;
  v_company := coalesce(c.gc_company_id, (SELECT company_id FROM public.gc_company_people WHERE id = c.gc_company_person_id));
  v_customer := coalesce(c.customer_id, (SELECT customer_id FROM public.customer_contact_persons WHERE id = c.customer_contact_person_id));
  v_invites := CASE WHEN c.kind = 'trade' THEN ARRAY(SELECT id FROM public.gc_invites WHERE company_id = v_company) ELSE '{}'::uuid[] END;
  v_sows := CASE WHEN c.kind = 'trade' THEN ARRAY(SELECT id FROM public.gc_sows WHERE company_id = v_company) ELSE '{}'::uuid[] END;
  -- Their GC jobs: the ones the office tied them to, and the ones their kind's facts put them on.
  v_projects := ARRAY(
    SELECT DISTINCT x.pid FROM (
      SELECT j.project_id AS pid FROM public.contact_jobs j WHERE j.contact_id = p_contact
      UNION ALL
      SELECT p.project_id FROM public.gc_trade_packages p JOIN public.gc_invites i ON i.package_id = p.id WHERE i.id = ANY (v_invites)
      UNION ALL
      SELECT g.project_id FROM public.gc_projects g JOIN public.projects pr ON pr.id = g.project_id
      WHERE c.kind = 'customer' AND pr.customer_id = v_customer
      UNION ALL
      SELECT g.project_id FROM public.gc_projects g WHERE c.kind = 'arch' AND g.architect_customer_id = v_customer
    ) x WHERE x.pid IS NOT NULL);
  RETURN jsonb_build_object(
    'contact', jsonb_build_object('id', c.id, 'kind', c.kind, 'off_since', c.off_since, 'off_why', c.off_why, 'off_by', c.off_by),
    'contactJobs', coalesce((SELECT jsonb_agg(jsonb_build_object('project_id', j.project_id, 'is_default', j.is_default))
      FROM public.contact_jobs j WHERE j.contact_id = p_contact AND j.project_id IS NOT NULL), '[]'::jsonb),
    'userNames', coalesce((SELECT jsonb_object_agg(u.id, split_part(btrim(u.name), ' ', 1)) FROM public.users u
      WHERE u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator') AND coalesce(btrim(u.name), '') <> ''), '{}'::jsonb),
    'company', (SELECT jsonb_build_object('id', g.id, 'portal_opened_on', g.portal_opened_on) FROM public.gc_companies g WHERE g.id = v_company AND c.kind = 'trade'),
    'portalLinks', coalesce((SELECT jsonb_agg(jsonb_build_object('company_id', l.company_id, 'revoked_at', l.revoked_at, 'first_opened_at', l.first_opened_at))
      FROM public.gc_trade_portal_links l WHERE l.company_id = v_company AND c.kind = 'trade'), '[]'::jsonb),
    'previewPath', (SELECT '/t/' || l.token FROM public.gc_trade_portal_links l
      WHERE l.company_id = v_company AND c.kind = 'trade' AND l.revoked_at IS NULL AND l.token IS NOT NULL ORDER BY l.created_at DESC LIMIT 1),
    'tradeMessages', coalesce((SELECT jsonb_agg(jsonb_build_object('company_id', m.company_id, 'kind', m.kind, 'sent_on', m.sent_on, 'sent_by', m.sent_by))
      FROM public.gc_trade_messages m WHERE m.company_id = v_company AND c.kind = 'trade' AND m.kind = 'invite'), '[]'::jsonb),
    'papers', coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'company_id', d.company_id, 'doc_type', d.doc_type, 'status', d.status,
        'sent_at', d.sent_at, 'signed_at', d.signed_at, 'expires_at', d.expires_at, 'created_at', d.created_at))
      FROM public.person_contract_documents d WHERE d.company_id = v_company AND c.kind = 'trade'), '[]'::jsonb),
    'paperSends', coalesce((SELECT jsonb_agg(jsonb_build_object('paper', s.paper, 'project_id', s.project_id, 'sent_on', s.sent_on, 'created_at', s.created_at))
      FROM public.gc_paper_sends s WHERE s.company_id = v_company AND c.kind = 'trade'), '[]'::jsonb),
    'invites', coalesce((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'company_id', i.company_id, 'package_id', i.package_id, 'invited_on', i.invited_on,
        'status', i.status, 'declined_on', i.declined_on, 'lost_on', i.lost_on))
      FROM public.gc_invites i WHERE i.id = ANY (v_invites)), '[]'::jsonb),
    'packages', coalesce((SELECT jsonb_agg(jsonb_build_object('id', p.id, 'project_id', p.project_id, 'trade', p.trade, 'carried_invite_id', p.carried_invite_id,
        'awarded_invite_id', p.awarded_invite_id, 'awarded_on', p.awarded_on, 'awarded_by', p.awarded_by))
      FROM public.gc_trade_packages p WHERE p.id IN (SELECT package_id FROM public.gc_invites WHERE id = ANY (v_invites))), '[]'::jsonb),
    'quotes', coalesce((SELECT jsonb_agg(jsonb_build_object('invite_id', q.invite_id, 'submitted_on', q.submitted_on, 'created_at', q.created_at))
      FROM public.gc_quotes q WHERE q.invite_id = ANY (v_invites)), '[]'::jsonb),
    'askLines', coalesce((SELECT jsonb_agg(jsonb_build_object('invite_id', l.invite_id, 'promised_by', l.promised_by, 'contacted_on', l.contacted_on, 'created_at', l.created_at))
      FROM public.gc_company_contacts l WHERE l.invite_id = ANY (v_invites) AND l.promised_by IS NOT NULL), '[]'::jsonb),
    'sows', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'invite_id', s.invite_id, 'package_id', s.package_id, 'sent_on', s.sent_on, 'signed_on', s.signed_on))
      FROM public.gc_sows s WHERE s.id = ANY (v_sows)), '[]'::jsonb),
    'draws', coalesce((SELECT jsonb_agg(jsonb_build_object('id', d.id, 'sow_id', d.sow_id, 'number', d.number, 'requested_on', d.requested_on,
        'approved_on', d.approved_on, 'paid_on', d.paid_on, 'final', d.final, 'waiver', d.waiver, 'waiver_on', d.waiver_on))
      FROM public.gc_draws d WHERE d.sow_id = ANY (v_sows)), '[]'::jsonb),
    'tradeFiles', coalesce((SELECT jsonb_agg(jsonb_build_object('company_id', f.company_id, 'project_id', f.project_id, 'paper', f.paper, 'uploaded_at', f.uploaded_at))
      FROM public.gc_trade_files f WHERE f.company_id = v_company AND c.kind = 'trade' AND f.paper IS NOT NULL), '[]'::jsonb),
    'projects', coalesce((SELECT jsonb_agg(jsonb_build_object('project_id', g.project_id, 'stage', g.stage, 'created_at', g.created_at, 'bid_due', g.bid_due,
        'our_bid_sent_on', g.our_bid_sent_on, 'won_on', g.won_on, 'lost_on', g.lost_on, 'owner_contract_sent_on', g.owner_contract_sent_on,
        'owner_contract_signed_on', g.owner_contract_signed_on, 'started_on', g.started_on, 'closed_on', g.closed_on, 'owner_pay_days', g.owner_pay_days))
      FROM public.gc_projects g WHERE g.project_id = ANY (v_projects)), '[]'::jsonb),
    'scheduleSends', coalesce((SELECT jsonb_agg(jsonb_build_object('project_id', s.project_id, 'sent_on', s.sent_on, 'sent_by', s.sent_by))
      FROM public.gc_schedule_sends s WHERE s.project_id = ANY (v_projects) AND c.kind = 'customer'), '[]'::jsonb),
    'payApps', coalesce((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'project_id', a.project_id, 'number', a.number, 'sent_on', a.sent_on,
        'certified_on', a.certified_on, 'paid_on', a.paid_on,
        'invoice_paid', coalesce(inv.status = 'paid' OR inv.stripe_invoice_status = 'paid', false)))
      FROM public.gc_owner_pay_apps a LEFT JOIN public.jobs_ledger_invoices inv ON inv.id = a.invoice_id
      WHERE a.project_id = ANY (v_projects) AND c.kind IN ('customer', 'arch')), '[]'::jsonb),
    'acceptances', coalesce((SELECT jsonb_agg(jsonb_build_object('project_id', a.project_id, 'accepted_on', a.accepted_on))
      FROM public.gc_owner_acceptances a WHERE a.project_id = ANY (v_projects) AND c.kind = 'customer'), '[]'::jsonb),
    'changeOrders', coalesce((SELECT jsonb_agg(jsonb_build_object('id', o.id, 'project_id', o.project_id, 'number', o.number, 'description', o.description,
        'status', o.status, 'sent_on', o.sent_on, 'answered_on', o.answered_on))
      FROM public.gc_change_orders o WHERE o.project_id = ANY (v_projects) AND c.kind = 'customer'), '[]'::jsonb),
    'planSets', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'project_id', s.project_id, 'kind', s.kind, 'label', s.label, 'issued_on', s.issued_on))
      FROM public.gc_plan_sets s WHERE s.project_id = ANY (v_projects) AND c.kind IN ('customer', 'arch')), '[]'::jsonb),
    'planSetSends', coalesce((SELECT jsonb_agg(jsonb_build_object('set_id', x.set_id, 'sent_at', x.sent_at))
      FROM public.gc_plan_set_sends x JOIN public.gc_plan_sets s ON s.id = x.set_id
      WHERE s.project_id = ANY (v_projects) AND s.kind = 'addendum' AND c.kind = 'arch'), '[]'::jsonb),
    'planQuestions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', q.id, 'project_id', q.project_id, 'text', q.text,
        'sent_to_architect_on', q.sent_to_architect_on, 'answered_on', q.answered_on))
      FROM public.gc_plan_questions q WHERE q.project_id = ANY (v_projects) AND c.kind = 'arch'), '[]'::jsonb),
    'rfis', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'project_id', r.project_id, 'number', r.number, 'question', r.question,
        'sent_to_architect_on', r.sent_to_architect_on, 'answered_on', r.answered_on, 'needed_days', r.needed_days))
      FROM public.gc_rfis r WHERE r.project_id = ANY (v_projects) AND c.kind = 'arch'), '[]'::jsonb),
    'submittalRounds', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'project_id', s.project_id, 'name', s.title, 'round', r.round,
        'to_architect_on', r.to_architect_on, 'sent_on', r.sent_on, 'answered_on', r.answered_on))
      FROM public.gc_submittal_rounds r JOIN public.gc_submittals s ON s.id = r.submittal_id
      WHERE s.project_id = ANY (v_projects) AND c.kind = 'arch'), '[]'::jsonb),
    'skips', coalesce((SELECT jsonb_agg(jsonb_build_object('id', k.id, 'step_key', k.step_key, 'project_id', k.project_id, 'why', k.why,
        'by_name', k.by_name, 'created_at', k.created_at, 'undone_at', k.undone_at))
      FROM public.contact_step_skips k WHERE k.contact_id = p_contact AND k.undone_at IS NULL), '[]'::jsonb),
    'architectByProject', coalesce((SELECT jsonb_object_agg(g.project_id, a.id) FROM public.gc_projects g
      JOIN LATERAL (
        SELECT ct.id FROM public.contacts ct
        LEFT JOIN public.customer_contact_persons cp ON cp.id = ct.customer_contact_person_id
        WHERE ct.kind = 'arch' AND (ct.customer_id = g.architect_customer_id OR cp.customer_id = g.architect_customer_id)
        ORDER BY ct.customer_id IS NULL, ct.created_at LIMIT 1
      ) a ON true
      WHERE g.project_id = ANY (v_projects) AND c.kind = 'customer' AND g.architect_customer_id IS NOT NULL), '{}'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.flow_rows(uuid) IS
  'Messages (cut 4): one person''s rows as src/lib/flows/load.ts FlowRows, for the office team (gc_office_team()). SECURITY DEFINER over the Portal''s and the money''s doors: days and marks only, never an amount, a price or a token; a trade partner''s page as its preview path.';

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.flow_step_check(uuid, text)', 'public.flows_my_name()',
    'public.flow_add_note(uuid, text, text, uuid, text)', 'public.flow_skip_step(uuid, text, text, uuid, text)',
    'public.flow_unskip_step(uuid)', 'public.nudge_hold_until(uuid, text, text, uuid, date)', 'public.nudge_let_go(uuid)',
    'public.nudge_record_sent(uuid, text, text, uuid, text, text, uuid)', 'public.contact_set_off(uuid, text)',
    'public.contact_put_back_on(uuid)', 'public.flow_rows(uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END
$$;

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
