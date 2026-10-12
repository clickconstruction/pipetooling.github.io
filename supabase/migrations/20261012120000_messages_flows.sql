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
--   * contact_step_notes, contact_step_skips: a team note on a step, and a step skipped for one person with a reason.
--     nudge_holds, nudge_sent: Hold until a day, and what was sent for a step, so a reminder never doubles. Each names
--     its job the spine's way (bid_id, project_id or jobs_ledger_id, at most one; none on the Once lane).
--   * Four facts main did not keep: gc_trade_portal_links.first_opened_at, gc_invites.lost_on, gc_projects.won_on and
--     gc_owner_pay_apps.paid_on. Nothing writes them yet; their writers come with cut 4's screens.
--   * contacts.off_*: the spine's columns (20261012010000); the office may now update them (Off the flow).
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
  SELECT ARRAY['invite_sent', 'portal_opened', 'w9_signed', 'coi_current', 'msa_signed', 'quote_in', 'tab_seen', 'carried', 'not_carried', 'sow_signed', 'draw_approved', 'draw_paid', 'final_waiver', 'asked_us', 'bid_sent', 'said_yes', 'declined', 'contract_signed', 'start_sent', 'started', 'payapp_paid', 'closed', 'warranty_over', 'co_answered', 'plans_in', 'question_answered', 'addendum_filed', 'submittal_reviewed', 'certified', 'named']::text[]
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

CREATE TABLE IF NOT EXISTS public.contact_step_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  bid_id uuid REFERENCES public.bids(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  jobs_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  note text NOT NULL
    CONSTRAINT contact_step_notes_note_said CHECK (length(btrim(note)) BETWEEN 1 AND 2000),
  by_user_id uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT contact_step_notes_one_job CHECK (num_nonnulls(bid_id, project_id, jobs_ledger_id) <= 1)
);

COMMENT ON TABLE public.contact_step_notes IS
  'Messages (cut 4): a team note on one person''s step (the step card''s notes), on a job or, with none, on the Once lane. Append only.';

CREATE INDEX IF NOT EXISTS contact_step_notes_contact_idx ON public.contact_step_notes (contact_id, step_key, created_at);

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
      ('trade', 'ask', 'per_job', 0, 'Asked to quote', 'Cotización pedida', 'pricing', 'them', ARRAY['quote_in'], 'and', ARRAY['quote'], 'each ask', 'rounds', false, false, false, 'When a job of yours comes up.', 'Cuando surja un trabajo para usted.', 7, 'text', 'ask', 'promised', 6, NULL),
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
ALTER TABLE public.contact_step_notes ENABLE ROW LEVEL SECURITY;
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
    'contact_step_notes', 'contact_step_skips', 'nudge_holds', 'nudge_sent'
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
GRANT INSERT (contact_id, step_key, bid_id, project_id, jobs_ledger_id, note, by_name) ON TABLE public.contact_step_notes TO authenticated;
GRANT INSERT (contact_id, step_key, bid_id, project_id, jobs_ledger_id, why, by_name) ON TABLE public.contact_step_skips TO authenticated;
GRANT UPDATE (undone_at) ON TABLE public.contact_step_skips TO authenticated;
GRANT INSERT (contact_id, step_key, bid_id, project_id, jobs_ledger_id, until_on, by_name) ON TABLE public.nudge_holds TO authenticated;
GRANT UPDATE (released_at) ON TABLE public.nudge_holds TO authenticated;
-- A person's send; the app's own sends go in as the service role.
GRANT INSERT (contact_id, step_key, bid_id, project_id, jobs_ledger_id, round_key, how, sent_by, message_id) ON TABLE public.nudge_sent TO authenticated;

-- Off the flow (the spine's columns): the office's word on a person, kept beside the contact.
GRANT UPDATE (off_since, off_why, off_by) ON TABLE public.contacts TO authenticated;

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
