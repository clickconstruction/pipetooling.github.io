---
name: "Building U5: RFIs and the change order they start"
rows: BUILDING_REAL_BUILD.md, The PRs in order, 5; decisions 2, 3, 5, 7 and 10; Writing it (gc_add_rfi, gc_send_rfi_to_architect, gc_answer_rfi, gc_rfi_change_order, gc_trade_rfi_ask); Docs each PR touches
branch: the plan on spike/building-u5-plan (from origin/spike/gc-mode at f285a180d); U5a from origin/main after #5123 (U4b) merges, pushed on its merge; U5b from origin/main on U5a's types
status: plan 2026-10-09 by Helper 18 at the lead's ask. The read-back was approved the same day at all five picks. The SQL below ran green on main's real GC migration chain in PGlite (50 assertions; two planted bugs each failed it). Nothing is cut or claimed.
---

# Building U5: RFIs and the change order they start

## What it is

Questions during construction on real data: what a trade or our superintendent asks the architect while we
build, the work each holds until answered, the answer and what it changes, and the change order a cost answer
starts.

- **U5a, the presses** (one migration, no client code):
  - one column, `gc_rfis.change_order_id`, the link U1's table comment promised;
  - five functions on U1's `gc_rfis` and `gc_rfi_holds`;
  - its SQL bed scenario, `supabase/tests/gc_building/50_rfis.sql`, and its migration doc;
  - the types PR follows the lead's push.
- **U5b, the window and the email** (no migration):
  - **RFIs**, a window opened from a building job's card, ported from the prototype's `GcBuildingRfis.tsx`;
  - the kind `rfi` on `gc-architect-email`;
  - the guide *ask the architect a question while we build*, with `roles: dev` until Building's door.

## The five calls, as the lead picked them (2026-10-09)

1. **Two PRs**: U5a the SQL, and U5b the window with the email kind.
2. **The change order's words and price come from the client's kernels**: `rfiChangeOrderDescription`, and
   `changeOrderPrice` with the job's fee. The SQL owns the RFI's state and the link. The price rule keeps one home.
3. **An answer that adds days only does not start a change order.** It points at the schedule's Ask for the days
   (G-141), since Owner Billing's draft needs a cost and a time extension comes from moves.
4. **The money team starts the change order**, even after Building's door opens RFIs to the job's team, as the
   Owner Billing door set: a superintendent hands the draft to the money team.
5. **A trade's RFI taken by phone names the company awarded that trade**, or none.

## The column and the functions

`SECURITY INVOKER`, every one, so RLS decides who may: dev only until Building's door, and `gc_change_orders`'
money-team policy for the change order. The trade's press is the service role's only, as the Portal's P2a verbs
are.

| Press | The prototype's action | What it writes | What it refuses |
|---|---|---|---|
| `gc_rfis.change_order_id` | `Rfi.changeOrderId` | The link, set null when its draft is deleted; one RFI per change order; only on a cost answer | |
| `gc_add_rfi(r jsonb)` | `addRfi` | The RFI, numbered one up from the job's last, with its sheets, trade, the company that asked, holds and needed days | A training account, a digital twin, a job bidding, lost or closed, a blank question, a trade not on the job, a company not the trade's, another job's line |
| `gc_send_rfi_to_architect(id, email)` | `sendRfiToArchitect` | The day it went, and the email or none | A training account, a digital twin, a send once sent or answered |
| `gc_answer_rfi(id, a jsonb)` | `answerRfi` | The answer: its words, by whom, what it changes, the cost and days | A training account, a digital twin, a second answer, a blank answer, an unknown answerer or impact, the architect's answer before it went to them, a cost answer with neither |
| `gc_rfi_change_order(id, words, price)` | `draftChangeOrderFromRfi` | A draft change order through Owner Billing's `gc_draft_change_order`, and the link, in one transaction | A training account, a digital twin, anyone outside the money team, an answer with no cost, a second change order, an answer that adds days only, and what the draft refuses |
| `gc_trade_rfi_ask(company, trade, question, sheets)` | `tradeAskRfi` | The RFI from the portal, holding the trade's next unfinished work, needed 3 days before | `notFound`, `notOnTrade`, `jobNotBuilding`, `questionNeeded`, `tooLong` |

**The default hold** (`rfiDefaultHolds`) in SQL: the trade's next unfinished bar starting after today, or its
earliest unfinished bar when all of its work has started. Unfinished is no `actual_finish` until U6 brings the
trades' reports, which the kernel's `actual < 100` also counts. A trade with nothing left holds nothing.

**The numbers.** One up from the job's last RFI, as the reducer counts, one press at a time on a job
(`pg_advisory_xact_lock`, as U4a's numbers are).

## What the window sends

- **Ask a question**: `gc_add_rfi({ projectId, question, sheets, packageId?, askedByCompanyId?, holds, neededDays? })`.
  `holds` are this job's scope line ids, which the schedule's bars carry too.
- **Send to {architect}**: `gc-architect-email` with `{ kind: 'rfi', rfi_id }`. After the email goes, the function
  calls `gc_send_rfi_to_architect(id, <its email_send_log id>)` as the caller, U4's pattern.
- **We sent it another way**: `gc_send_rfi_to_architect(id)`.
- **Record their answer**: `gc_answer_rfi(id, { text, by, impact, cost, days })`.
- **Start a change order** (the money team): `gc_rfi_change_order(id, rfiChangeOrderDescription(rfi),
  changeOrderPrice(project, cost))`, then the Change orders window opens on the new draft to price and send.
- **The trade, from its portal** (the Portal's P5): `submit-gc-trade-portal` kind `ask_rfi` calls
  `gc_trade_rfi_ask(company, trade, question, sheets)`.

## The refusals, in plain words

Every sentence the SQL says to a person, read out of the SQL below by the same check as U4's, through
`plainWordsFailures`: **30 sentences, 0 failing**. The change order's own refusals (*Say what is changing.*,
*Type what it adds to their price.*) are Owner Billing's, from `gc_draft_change_order`.

| Press | Sentence |
|---|---|
| every office press | *Sign in first.* |
| add, send, answer | *A training account cannot record an RFI.* · *A digital twin cannot record an RFI.* |
| add | *Which job the RFI is for is missing.* · *No GC project with that id.* |
| add | *An RFI is for a job that is ours. While we bid, ask about the plans instead.* · *This job is closed. It takes no new RFI.* |
| add | *Type the question first.* · *That trade is not on this job.* · *The company that asked must be the one we awarded this trade.* · *An RFI holds only this job’s work.* |
| send, answer | *No RFI with that id.* · *It is answered already.* |
| send | *It went to the architect already.* |
| answer | *Type the answer first.* · *Say who answered, the architect or us.* · *Pick what it changes: nothing, the plans, or cost and days.* |
| answer | *The architect answers only what went to them. Send it first, or answer it as us.* · *The cost and the days must be numbers.* · *A cost answer needs a cost or days.* |
| change order | *A training account cannot start a change order.* · *A digital twin cannot start a change order.* · *Only the money team starts a change order.* |
| change order | *Only an answer that adds cost starts a change order.* · *It started a change order already.* · *This answer adds days only. Ask for the days on the schedule instead.* |
| the trade's press, as DETAIL | *No trade with that id.* (`notFound`) · *Only the company we awarded this trade can ask about its work.* (`notOnTrade`) · *Questions open once we are building the job.* (`jobNotBuilding`) · *Type the question first.* (`questionNeeded`) · *Keep the question under 2,000 characters.* (`tooLong`) |

`notFound`, `notOnTrade`, `questionNeeded` and `tooLong` are keys the portal already says. `jobNotBuilding` is new:
the Portal's P5 maps it in `TRADE_SQL_ERRORS` (409) and the page's words. Until then U5a lists it in P4a's WAITING map (`src/lib/gc/gcTradeSubmit.test.ts`) as `jobNotBuilding: 'P5'`.

## The SQL as it will be

`supabase/migrations/<stamp>_gc_rfi_writes.sql`. The stamp is numbered from `origin/main`'s newest at the cut and
claimed then, and `v2.NNNN` becomes the version claimed then: those two are the only changes from this text.

```sql
SET lock_timeout = '3s';

-- GC mode, the real build, the Building lane's U5a (v2.NNNN): questions during construction (RFIs) on real data,
-- their presses, and the change order a cost answer starts. The office records an RFI with its number and the
-- work it holds, marks it sent to the architect, records the answer, and starts a change order from a cost answer;
-- a trade asks from its portal. Each refuses in words what the prototype's reducer refuses (addRfi, tradeAskRfi,
-- sendRfiToArchitect, answerRfi, draftChangeOrderFromRfi). The office's presses are SECURITY INVOKER, so RLS decides
-- who may: dev only until Building's door, and the money team for the change order, through Owner Billing's own
-- table policy and gc_draft_change_order. The change order's words and price come from the client's kernels
-- (rfiChangeOrderDescription, changeOrderPrice); this owns the RFI's state and the link. The trade's press is the
-- service role's only, and refuses with keys as the Portal's P2a verbs do. Plan: to-dos/gc-mode/mockups/building-u5.md
-- on spike/gc-mode. Tables: 20261008030000_gc_building_records. The change orders: 20261008010000 and 20261008110000.
-- The award: 20261009140000.

-- The change order a cost answer started (decision 3): the RFI keeps the link, and Owner Billing's table carries no
-- Building column. A change order is one RFI's. A deleted draft clears the link, so the answer can start another.
ALTER TABLE public.gc_rfis
  ADD COLUMN IF NOT EXISTS change_order_id uuid REFERENCES public.gc_change_orders(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS gc_rfis_change_order_once ON public.gc_rfis (change_order_id) WHERE change_order_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_rfis_change_order_from_cost' AND conrelid = 'public.gc_rfis'::regclass) THEN
    ALTER TABLE public.gc_rfis ADD CONSTRAINT gc_rfis_change_order_from_cost CHECK (change_order_id IS NULL OR impact = 'cost');
  END IF;
END $$;

COMMENT ON COLUMN public.gc_rfis.change_order_id IS
  'GC mode (v2.NNNN, Building U5a): the change order this RFI''s cost answer started (Rfi.changeOrderId), written by gc_rfi_change_order. Null: none yet, or its draft was deleted.';

-- Record an RFI (addRfi): its number on the job, one up from the job's last; the question and the sheets; the trade
-- it is about (null: our own work); the company that asked by phone, the one awarded that trade (null: our own
-- people); the work it holds until answered; and the days before that work the answer is needed (3 unless said).
-- Refuses a training account, a digital twin, a job we are not building, a blank question, a trade not on the job,
-- a company that is not the trade's, and a hold on work that is not this job's.
CREATE OR REPLACE FUNCTION public.gc_add_rfi(r jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project uuid;
  v_stage text;
  v_lost date;
  v_question text := btrim(coalesce(r->>'question', ''));
  v_pkg uuid;
  v_company uuid;
  v_awarded uuid;
  v_holds uuid[];
  v_needed integer := 3;
  v_number integer;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  -- The tables' read-only blocks and the twin fence refuse the writes too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record an RFI.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record an RFI.' USING ERRCODE = '42501';
  END IF;
  v_project := nullif(btrim(coalesce(r->>'projectId', '')), '')::uuid;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Which job the RFI is for is missing.' USING ERRCODE = 'P0001';
  END IF;
  SELECT stage, lost_on INTO v_stage, v_lost FROM public.gc_projects WHERE project_id = v_project;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No GC project with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_stage = 'bidding' OR v_lost IS NOT NULL THEN
    RAISE EXCEPTION 'An RFI is for a job that is ours. While we bid, ask about the plans instead.' USING ERRCODE = 'P0001';
  END IF;
  IF v_stage = 'closed' THEN
    RAISE EXCEPTION 'This job is closed. It takes no new RFI.' USING ERRCODE = 'P0001';
  END IF;
  IF v_question = '' THEN
    RAISE EXCEPTION 'Type the question first.' USING ERRCODE = 'P0001';
  END IF;
  v_pkg := nullif(btrim(coalesce(r->>'packageId', '')), '')::uuid;
  IF v_pkg IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = v_pkg AND project_id = v_project) THEN
    RAISE EXCEPTION 'That trade is not on this job.' USING ERRCODE = 'P0001';
  END IF;
  -- A trade's question by phone names the company we awarded that trade (the lead's call 5).
  v_company := nullif(btrim(coalesce(r->>'askedByCompanyId', '')), '')::uuid;
  IF v_company IS NOT NULL THEN
    SELECT i.company_id INTO v_awarded
    FROM public.gc_trade_packages k JOIN public.gc_invites i ON i.id = k.awarded_invite_id
    WHERE k.id = v_pkg;
    IF v_awarded IS DISTINCT FROM v_company THEN
      RAISE EXCEPTION 'The company that asked must be the one we awarded this trade.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- The work it holds: this job's scope lines, each once (decision 2).
  v_holds := ARRAY(
    SELECT DISTINCT btrim(h)::uuid
    FROM jsonb_array_elements_text(coalesce(r->'holds', '[]'::jsonb)) h
    WHERE btrim(h) <> ''
  );
  IF EXISTS (
    SELECT 1 FROM unnest(v_holds) h(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.gc_scope_items i JOIN public.gc_trade_packages k ON k.id = i.package_id
      WHERE i.id = h.id AND k.project_id = v_project
    )
  ) THEN
    RAISE EXCEPTION 'An RFI holds only this job’s work.' USING ERRCODE = 'P0001';
  END IF;
  -- The days before the held work the answer is needed: RFI_NEEDED_DAYS unless a number of none or more is given.
  IF jsonb_typeof(r->'neededDays') = 'number' AND (r->>'neededDays')::numeric >= 0 THEN
    v_needed := round((r->>'neededDays')::numeric)::integer;
  END IF;

  -- Its number: one up from the job's last (the reducer's rule), one press at a time on a job.
  PERFORM pg_advisory_xact_lock(hashtextextended('gc_rfi_number:' || v_project::text, 0));
  SELECT coalesce(max(number), 0) + 1 INTO v_number FROM public.gc_rfis WHERE project_id = v_project;

  INSERT INTO public.gc_rfis (project_id, number, question, sheets, package_id, asked_by_company_id, asked_on, needed_days)
  VALUES (
    v_project,
    v_number,
    v_question,
    ARRAY(SELECT btrim(s) FROM jsonb_array_elements_text(coalesce(r->'sheets', '[]'::jsonb)) WITH ORDINALITY AS t(s, n) WHERE btrim(s) <> '' ORDER BY n),
    v_pkg,
    v_company,
    public.app_today(),
    v_needed
  )
  RETURNING id INTO v_id;
  INSERT INTO public.gc_rfi_holds (rfi_id, scope_item_id)
  SELECT v_id, h FROM unnest(v_holds) h;
  RETURN v_id;
END;
$$;

-- Sent to the architect (sendRfiToArchitect): the day it went, and the email that took it there when
-- gc-architect-email sent it. No email: we sent it another way. Not once it is sent or answered.
CREATE OR REPLACE FUNCTION public.gc_send_rfi_to_architect(p_rfi_id uuid, p_email_send_log_id uuid DEFAULT NULL)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := public.app_today();
  v_sent date;
  v_answered date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record an RFI.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record an RFI.' USING ERRCODE = '42501';
  END IF;
  SELECT sent_to_architect_on, answered_on INTO v_sent, v_answered FROM public.gc_rfis WHERE id = p_rfi_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No RFI with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_answered IS NOT NULL THEN
    RAISE EXCEPTION 'It is answered already.' USING ERRCODE = 'P0001';
  END IF;
  IF v_sent IS NOT NULL THEN
    RAISE EXCEPTION 'It went to the architect already.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.gc_rfis SET sent_to_architect_on = v_today, email_send_log_id = p_email_send_log_id WHERE id = p_rfi_id;
  RETURN v_today;
END;
$$;

-- The answer (answerRfi): its words, by the architect or by us, and what it changes: nothing, the plans, or cost and
-- days. The architect answers only what was sent to them; we can answer our own any time. A cost answer has a cost
-- or days, each whole and never below none; any other answer has neither.
CREATE OR REPLACE FUNCTION public.gc_answer_rfi(p_rfi_id uuid, a jsonb)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := public.app_today();
  v_sent date;
  v_answered date;
  v_text text := btrim(coalesce(a->>'text', ''));
  v_by text := btrim(coalesce(a->>'by', ''));
  v_impact text := btrim(coalesce(a->>'impact', ''));
  v_cost numeric := 0;
  v_days integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record an RFI.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record an RFI.' USING ERRCODE = '42501';
  END IF;
  SELECT sent_to_architect_on, answered_on INTO v_sent, v_answered FROM public.gc_rfis WHERE id = p_rfi_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No RFI with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_answered IS NOT NULL THEN
    RAISE EXCEPTION 'It is answered already.' USING ERRCODE = 'P0001';
  END IF;
  IF v_text = '' THEN
    RAISE EXCEPTION 'Type the answer first.' USING ERRCODE = 'P0001';
  END IF;
  IF v_by NOT IN ('architect', 'us') THEN
    RAISE EXCEPTION 'Say who answered, the architect or us.' USING ERRCODE = 'P0001';
  END IF;
  IF v_impact NOT IN ('none', 'plans', 'cost') THEN
    RAISE EXCEPTION 'Pick what it changes: nothing, the plans, or cost and days.' USING ERRCODE = 'P0001';
  END IF;
  IF v_by = 'architect' AND v_sent IS NULL THEN
    RAISE EXCEPTION 'The architect answers only what went to them. Send it first, or answer it as us.' USING ERRCODE = 'P0001';
  END IF;
  IF v_impact = 'cost' THEN
    BEGIN
      v_cost := greatest(0, round(coalesce((a->>'cost')::numeric, 0)));
      v_days := greatest(0, round(coalesce((a->>'days')::numeric, 0)))::integer;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'The cost and the days must be numbers.' USING ERRCODE = 'P0001';
    END;
    IF v_cost = 0 AND v_days = 0 THEN
      RAISE EXCEPTION 'A cost answer needs a cost or days.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.gc_rfis
  SET answered_on = v_today, answer_text = v_text, answered_by = v_by, impact = v_impact, cost = v_cost, days = v_days
  WHERE id = p_rfi_id;
  RETURN v_today;
END;
$$;

-- A change order from a cost answer (draftChangeOrderFromRfi): drafted through Owner Billing's own
-- gc_draft_change_order, a plan revision on the RFI's trade at the answer's cost and days, with the RFI's link to it,
-- in one transaction. The words and the price are the client's kernels'. Only the money team starts one, even after
-- Building's door (the lead's call 4). An answer that adds days only goes through the schedule's Ask for the days
-- (G-141), since a change order drafted here has a cost (call 3).
CREATE OR REPLACE FUNCTION public.gc_rfi_change_order(p_rfi_id uuid, p_description text, p_price numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project uuid;
  v_pkg uuid;
  v_impact text;
  v_cost numeric;
  v_days integer;
  v_linked uuid;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot start a change order.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot start a change order.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_money_team() THEN
    RAISE EXCEPTION 'Only the money team starts a change order.' USING ERRCODE = '42501';
  END IF;
  SELECT project_id, package_id, impact, cost, days, change_order_id
  INTO v_project, v_pkg, v_impact, v_cost, v_days, v_linked
  FROM public.gc_rfis WHERE id = p_rfi_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No RFI with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_impact IS DISTINCT FROM 'cost' THEN
    RAISE EXCEPTION 'Only an answer that adds cost starts a change order.' USING ERRCODE = 'P0001';
  END IF;
  IF v_linked IS NOT NULL THEN
    RAISE EXCEPTION 'It started a change order already.' USING ERRCODE = 'P0001';
  END IF;
  IF v_cost = 0 THEN
    RAISE EXCEPTION 'This answer adds days only. Ask for the days on the schedule instead.' USING ERRCODE = 'P0001';
  END IF;

  v_id := public.gc_draft_change_order(v_project, jsonb_build_object(
    'description', p_description,
    'reason', 'plans',
    'packageId', v_pkg,
    'cost', v_cost,
    'price', p_price,
    'days', v_days
  ));
  UPDATE public.gc_rfis SET change_order_id = v_id WHERE id = p_rfi_id;
  RETURN v_id;
END;
$$;

-- A trade asks from its portal (tradeAskRfi), on a job being built, about a trade we awarded it (portalCanAskRfi).
-- The RFI holds the trade's next work not started, or the work under way when all of it has started
-- (rfiDefaultHolds: its next unfinished bar after today, else its earliest unfinished one; unfinished is no actual
-- finish until U6 brings the trades' reports). The answer is needed 3 days before that work.
CREATE OR REPLACE FUNCTION public.gc_trade_rfi_ask(p_company_id uuid, p_package_id uuid, p_question text, p_sheets text[] DEFAULT '{}')
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_project uuid;
  v_stage text;
  v_company uuid;
  v_question text := btrim(coalesce(p_question, ''));
  v_hold uuid;
  v_number integer;
  v_id uuid;
BEGIN
  SELECT k.project_id, g.stage, i.company_id INTO v_project, v_stage, v_company
  FROM public.gc_trade_packages k
  JOIN public.gc_projects g ON g.project_id = k.project_id
  LEFT JOIN public.gc_invites i ON i.id = k.awarded_invite_id
  WHERE k.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No trade with that id.';
  END IF;
  IF v_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company we awarded this trade can ask about its work.';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'jobNotBuilding' USING ERRCODE = 'P0001', DETAIL = 'Questions open once we are building the job.';
  END IF;
  IF v_question = '' THEN
    RAISE EXCEPTION 'questionNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type the question first.';
  END IF;
  IF length(v_question) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the question under 2,000 characters.';
  END IF;

  SELECT a.scope_item_id INTO v_hold
  FROM public.gc_schedule_activities a
  WHERE a.project_id = v_project AND a.kind = 'line' AND a.package_id = p_package_id AND a.actual_finish IS NULL
  ORDER BY (a.start > public.app_today()) DESC, a.start, a.position
  LIMIT 1;

  PERFORM pg_advisory_xact_lock(hashtextextended('gc_rfi_number:' || v_project::text, 0));
  SELECT coalesce(max(number), 0) + 1 INTO v_number FROM public.gc_rfis WHERE project_id = v_project;
  -- Nobody of ours typed it in: the trade's portal did (recorded_by null).
  INSERT INTO public.gc_rfis (project_id, number, question, sheets, package_id, asked_by_company_id, recorded_by, asked_on, needed_days)
  VALUES (
    v_project,
    v_number,
    v_question,
    ARRAY(SELECT btrim(s) FROM unnest(coalesce(p_sheets, '{}'::text[])) WITH ORDINALITY AS t(s, n) WHERE btrim(s) <> '' ORDER BY n),
    p_package_id,
    p_company_id,
    NULL,
    public.app_today(),
    3
  )
  RETURNING id INTO v_id;
  IF v_hold IS NOT NULL THEN
    INSERT INTO public.gc_rfi_holds (rfi_id, scope_item_id) VALUES (v_id, v_hold);
  END IF;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_add_rfi(jsonb) IS
  'GC mode (v2.NNNN): record an RFI on a GC job that is ours (addRfi), numbered one up from the job''s last, with the scope lines it holds. Refuses a training account, a digital twin, a job bidding, lost or closed, a blank question, a trade not on the job, a company that is not the trade''s and another job''s line. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_send_rfi_to_architect(uuid, uuid) IS
  'GC mode (v2.NNNN): the RFI went to the architect today, with the email that took it (gc-architect-email) or none when sent another way. Not once sent or answered. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_answer_rfi(uuid, jsonb) IS
  'GC mode (v2.NNNN): the RFI''s answer (answerRfi): its words, by the architect (only once sent) or us, and what it changes; a cost answer has a cost or days. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_rfi_change_order(uuid, text, numeric) IS
  'GC mode (v2.NNNN): a draft change order from a cost answer through gc_draft_change_order, a plan revision at the answer''s cost and days with the client''s words and price, and the RFI''s link to it. The money team only; days only goes through Ask for the days. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_trade_rfi_ask(uuid, uuid, text, text[]) IS
  'GC mode (v2.NNNN): an RFI from the trade''s portal (tradeAskRfi) by the company awarded the trade, on a job being built, holding its next unfinished work: notFound, notOnTrade, jobNotBuilding, questionNeeded, tooLong. Service role only.';

REVOKE ALL ON FUNCTION public.gc_add_rfi(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_add_rfi(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_add_rfi(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.gc_send_rfi_to_architect(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_send_rfi_to_architect(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_send_rfi_to_architect(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.gc_answer_rfi(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_answer_rfi(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_answer_rfi(uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.gc_rfi_change_order(uuid, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_rfi_change_order(uuid, text, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_rfi_change_order(uuid, text, numeric) TO authenticated;

-- Only the service role: the portal's submit function, after it has turned a link into its company.
REVOKE ALL ON FUNCTION public.gc_trade_rfi_ask(uuid, uuid, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_trade_rfi_ask(uuid, uuid, text, text[]) TO service_role;
```

## The SQL tests

**The bed.** `scripts/pgtest-gc-building.sh` loops over every scenario since U4a. U5a adds one line to its
`PRESSES` list, `supabase/migrations/*_gc_rfi_writes.sql`, and one path to `.github/workflows/sql-beds.yml`,
`- 'supabase/migrations/*gc_rfi_writes*'`. It also adds `jobNotBuilding: 'P5'` to WAITING in
`src/lib/gc/gcTradeSubmit.test.ts`.

**The scenario**, `supabase/tests/gc_building/50_rfis.sql`. Its fixture draws the schedule's two bars under the
plan-write flag (`gc.schedule_plan_write`), since the schedule's guard lets a plan change in no other way:

```sql
-- The RFIs' presses (v2.NNNN, the Building lane's U5a): gc_add_rfi numbers an RFI one up from the job's last and
-- keeps the work it holds; gc_send_rfi_to_architect and gc_answer_rfi walk it; gc_rfi_change_order drafts a change
-- order from a cost answer through Owner Billing's gc_draft_change_order and links it; gc_trade_rfi_ask is the trade's
-- question from its portal, holding its next unfinished work. Each refuses in words what the prototype's reducer
-- refuses. A training account, a digital twin, a role outside Building's dev door and anyone outside the money team
-- for the change order are refused; the trade's press is the service role's only. Presses run through RLS, the
-- fixture made as postgres; everything runs inside one transaction that rolls back. Raises on the first failed
-- assertion; ends with "gc_building PASSED". See scripts/pgtest-gc-building.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Who: a dev, a dev in training mode, a dev who is a digital twin, and an estimator (no policy on Building's
-- tables while they are built, and not the money team).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000008d1', 'dev@rfis.test'),
  ('00000000-0000-0000-0000-0000000008d2', 'trainee@rfis.test'),
  ('00000000-0000-0000-0000-0000000008d3', 'twin@rfis.test'),
  ('00000000-0000-0000-0000-0000000008d4', 'estimator@rfis.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000008d1', 'dev@rfis.test', 'RFIs Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000008d2', 'trainee@rfis.test', 'RFIs Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000008d3', 'twin@rfis.test', 'RFIs Twin', 'dev'),
  ('00000000-0000-0000-0000-0000000008d4', 'estimator@rfis.test', 'RFIs Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000008d2';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-0000000008d3';

-- Three GC jobs: A being built, with Concrete awarded to Ridgeway Concrete, Steel asked of Halverson Steel and not
-- awarded, and our own Plumbing; B still bidding, its Electrical awarded to Ridgeway; C closed, its Roofing awarded
-- to Halverson. A's schedule has Concrete's footings finished and its slab starting in three days.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000008c1', 'RFIs Test Owner', '00000000-0000-0000-0000-0000000008d1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000008a1', 'RFIs test A', '00000000-0000-0000-0000-0000000008c1'),
  ('00000000-0000-0000-0000-0000000008a2', 'RFIs test B', '00000000-0000-0000-0000-0000000008c1'),
  ('00000000-0000-0000-0000-0000000008a3', 'RFIs test C', '00000000-0000-0000-0000-0000000008c1');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES
  ('00000000-0000-0000-0000-0000000008a1', 'building', public.app_today() - 20),
  ('00000000-0000-0000-0000-0000000008a2', 'bidding', NULL),
  ('00000000-0000-0000-0000-0000000008a3', 'closed', public.app_today() - 200);
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-0000000008e1', 'Ridgeway Concrete', ARRAY['Concrete']),
  ('00000000-0000-0000-0000-0000000008e2', 'Halverson Steel', ARRAY['Steel']);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-0000000008b1', '00000000-0000-0000-0000-0000000008a1', 'Concrete', 0, false),
  ('00000000-0000-0000-0000-0000000008b2', '00000000-0000-0000-0000-0000000008a1', 'Steel', 1, false),
  ('00000000-0000-0000-0000-0000000008b3', '00000000-0000-0000-0000-0000000008a1', 'Plumbing', 2, true),
  ('00000000-0000-0000-0000-0000000008b4', '00000000-0000-0000-0000-0000000008a2', 'Electrical', 0, false),
  ('00000000-0000-0000-0000-0000000008b5', '00000000-0000-0000-0000-0000000008a3', 'Roofing', 0, false);
INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
  ('00000000-0000-0000-0000-0000000008f1', '00000000-0000-0000-0000-0000000008b1', '00000000-0000-0000-0000-0000000008e1'),
  ('00000000-0000-0000-0000-0000000008f2', '00000000-0000-0000-0000-0000000008b2', '00000000-0000-0000-0000-0000000008e2'),
  ('00000000-0000-0000-0000-0000000008f3', '00000000-0000-0000-0000-0000000008b4', '00000000-0000-0000-0000-0000000008e1'),
  ('00000000-0000-0000-0000-0000000008f4', '00000000-0000-0000-0000-0000000008b5', '00000000-0000-0000-0000-0000000008e2');
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000008f1', awarded_on = public.app_today() - 30 WHERE id = '00000000-0000-0000-0000-0000000008b1';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000008f3', awarded_on = public.app_today() - 2 WHERE id = '00000000-0000-0000-0000-0000000008b4';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000008f4', awarded_on = public.app_today() - 250 WHERE id = '00000000-0000-0000-0000-0000000008b5';
INSERT INTO public.gc_scope_items (id, package_id, label, position) VALUES
  ('00000000-0000-0000-0000-000000080001', '00000000-0000-0000-0000-0000000008b1', 'Footings', 0),
  ('00000000-0000-0000-0000-000000080002', '00000000-0000-0000-0000-0000000008b1', 'Slab', 1),
  ('00000000-0000-0000-0000-000000080003', '00000000-0000-0000-0000-0000000008b2', 'Frame', 0),
  ('00000000-0000-0000-0000-000000080004', '00000000-0000-0000-0000-0000000008b4', 'Rough-in', 0);
-- The fixture draws the schedule as a plan write does (gc_schedule_bump's flag): the guard lets a plan change in no other way.
SELECT set_config('gc.schedule_plan_write', 'on', true);
INSERT INTO public.gc_schedules (project_id, drafted_on) VALUES ('00000000-0000-0000-0000-0000000008a1', public.app_today() - 25);
INSERT INTO public.gc_schedule_activities (project_id, kind, position, scope_item_id, package_id, start, finish, actual_start, actual_finish) VALUES
  ('00000000-0000-0000-0000-0000000008a1', 'line', 0, '00000000-0000-0000-0000-000000080001', '00000000-0000-0000-0000-0000000008b1', public.app_today() - 10, public.app_today() - 5, public.app_today() - 10, public.app_today() - 5),
  ('00000000-0000-0000-0000-0000000008a1', 'line', 1, '00000000-0000-0000-0000-000000080002', '00000000-0000-0000-0000-0000000008b1', public.app_today() + 3, public.app_today() + 6, NULL, NULL);
SELECT set_config('gc.schedule_plan_write', '', true);

CREATE SCHEMA gbt;
CREATE FUNCTION gbt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION gbt.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- A trade's refusal: its key, and the reason in plain words the key carries.
CREATE FUNCTION gbt.trade_refused(label text, stmt text, want_key text, want_detail text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_detail text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    IF SQLERRM IS DISTINCT FROM want_key OR v_detail IS DISTINCT FROM want_detail THEN
      RAISE EXCEPTION '% was refused as % (%), not % (%)', label, SQLERRM, v_detail, want_key, want_detail;
    END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- Sign in as someone (the claims auth.uid() reads).
CREATE FUNCTION gbt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
END $$;
-- An RFI on job A by its number.
CREATE FUNCTION gbt.rfi(p_number integer) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.gc_rfis WHERE project_id = '00000000-0000-0000-0000-0000000008a1' AND number = p_number $$;
-- An RFI as the window sends it, on job A unless `extra` says otherwise.
CREATE FUNCTION gbt.ask(question text, extra jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('projectId', '00000000-0000-0000-0000-0000000008a1', 'question', question) || extra $$;
-- An answer as the window sends it.
CREATE FUNCTION gbt.answer(by_whom text, impact text, extra jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('text', 'Use the detail on S-102.', 'by', by_whom, 'impact', impact) || extra $$;
-- What job A's RFIs read: each one's number, trade, who asked, sheets, the work it holds, the needed days, sent,
-- the answer and the change order it started.
CREATE FUNCTION gbt.rfis() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(
    'RFI-' || r.number
      || ' ' || coalesce((SELECT k.trade FROM public.gc_trade_packages k WHERE k.id = r.package_id), 'ours')
      || ' by ' || coalesce((SELECT c.name FROM public.gc_companies c WHERE c.id = r.asked_by_company_id), 'us')
      || ' sheets ' || coalesce(nullif(array_to_string(r.sheets, ','), ''), '-')
      || ' holds ' || coalesce((SELECT string_agg(i.label, ',' ORDER BY i.position) FROM public.gc_rfi_holds h JOIN public.gc_scope_items i ON i.id = h.scope_item_id WHERE h.rfi_id = r.id), '-')
      || ' needed ' || r.needed_days
      || CASE WHEN r.sent_to_architect_on IS NOT NULL THEN ' sent' ELSE '' END
      || CASE WHEN r.answered_on IS NOT NULL THEN ' answered ' || r.answered_by || ':' || r.impact || ':' || r.cost || ':' || r.days ELSE '' END
      || coalesce(' co ' || (SELECT co.number FROM public.gc_change_orders co WHERE co.id = r.change_order_id), ''),
    E'\n' ORDER BY r.number)
  FROM public.gc_rfis r WHERE r.project_id = '00000000-0000-0000-0000-0000000008a1' $$;
GRANT USAGE ON SCHEMA gbt TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbt TO authenticated, service_role;

-- The functions themselves: invoker's rights; the office's presses for signed-in callers, the trade's for the
-- service role only.
SELECT gbt.same('every press runs with the caller''s rights',
  (SELECT string_agg(proname || ':' || prosecdef, ',' ORDER BY proname) FROM pg_proc WHERE proname IN ('gc_add_rfi', 'gc_send_rfi_to_architect', 'gc_answer_rfi', 'gc_rfi_change_order', 'gc_trade_rfi_ask')),
  'gc_add_rfi:false,gc_answer_rfi:false,gc_rfi_change_order:false,gc_send_rfi_to_architect:false,gc_trade_rfi_ask:false');
SELECT gbt.same('who runs each: signed out, signed in, the service role',
  (SELECT string_agg(f || ':' || has_function_privilege('anon', f, 'EXECUTE') || '/' || has_function_privilege('authenticated', f, 'EXECUTE') || '/' || has_function_privilege('service_role', f, 'EXECUTE'), ',')
   FROM unnest(ARRAY['public.gc_add_rfi(jsonb)', 'public.gc_send_rfi_to_architect(uuid, uuid)', 'public.gc_answer_rfi(uuid, jsonb)', 'public.gc_rfi_change_order(uuid, text, numeric)', 'public.gc_trade_rfi_ask(uuid, uuid, text, text[])']) f),
  'public.gc_add_rfi(jsonb):false/true/true,public.gc_send_rfi_to_architect(uuid, uuid):false/true/true,public.gc_answer_rfi(uuid, jsonb):false/true/true,public.gc_rfi_change_order(uuid, text, numeric):false/true/true,public.gc_trade_rfi_ask(uuid, uuid, text, text[]):false/false/true');
SELECT gbt.same('the link to the change order is new, one per change order, and only on a cost answer',
  (SELECT string_agg(conname, ',' ORDER BY conname) FROM pg_constraint WHERE conrelid = 'public.gc_rfis'::regclass AND conname IN ('gc_rfis_change_order_from_cost', 'gc_rfis_change_order_id_fkey'))
    || ' ' || (SELECT count(*) FROM pg_indexes WHERE indexname = 'gc_rfis_change_order_once'),
  'gc_rfis_change_order_from_cost,gc_rfis_change_order_id_fkey 1');

SELECT gbt.as_user('00000000-0000-0000-0000-0000000008d1');
SET LOCAL ROLE authenticated;

-- Two RFIs: Ridgeway's by phone on Concrete, with its sheets and the work it holds, and our own with nothing held.
SELECT public.gc_add_rfi(gbt.ask(' Which slab thickness at grid C? ', jsonb_build_object(
  'packageId', '00000000-0000-0000-0000-0000000008b1', 'askedByCompanyId', '00000000-0000-0000-0000-0000000008e1',
  'sheets', jsonb_build_array(' S-101 ', '', 'S-102'),
  'holds', jsonb_build_array('00000000-0000-0000-0000-000000080002', '00000000-0000-0000-0000-000000080001', '00000000-0000-0000-0000-000000080002'),
  'neededDays', 5)));
SELECT public.gc_add_rfi(gbt.ask('Where does the mop sink drain?', jsonb_build_object('neededDays', -1)));
SELECT gbt.same('numbered one up, with their trade, who asked, sheets, holds and days', gbt.rfis(),
  E'RFI-1 Concrete by Ridgeway Concrete sheets S-101,S-102 holds Footings,Slab needed 5\nRFI-2 ours by us sheets - holds - needed 3');
SELECT gbt.same('what a new RFI keeps', (SELECT question || ' | ' || (asked_on - public.app_today()) || ' | ' || (recorded_by = '00000000-0000-0000-0000-0000000008d1') FROM public.gc_rfis WHERE id = gbt.rfi(1)),
  'Which slab thickness at grid C? | 0 | true');

-- The refusals of a new RFI, in words.
SELECT gbt.refused('a job still bidding', $s$SELECT public.gc_add_rfi(gbt.ask('Footing depth?', jsonb_build_object('projectId', '00000000-0000-0000-0000-0000000008a2')))$s$, 'An RFI is for a job that is ours');
SELECT gbt.refused('a closed job', $s$SELECT public.gc_add_rfi(gbt.ask('Footing depth?', jsonb_build_object('projectId', '00000000-0000-0000-0000-0000000008a3')))$s$, 'This job is closed');
SELECT gbt.refused('a blank question', $s$SELECT public.gc_add_rfi(gbt.ask('   '))$s$, 'Type the question first');
SELECT gbt.refused('another job''s trade', $s$SELECT public.gc_add_rfi(gbt.ask('Panel location?', jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000008b4')))$s$, 'That trade is not on this job');
SELECT gbt.refused('a company not awarded the trade', $s$SELECT public.gc_add_rfi(gbt.ask('Pour sequence?', jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000008b1', 'askedByCompanyId', '00000000-0000-0000-0000-0000000008e2')))$s$, 'must be the one we awarded this trade');
SELECT gbt.refused('a company with no trade named', $s$SELECT public.gc_add_rfi(gbt.ask('Pour sequence?', jsonb_build_object('askedByCompanyId', '00000000-0000-0000-0000-0000000008e1')))$s$, 'must be the one we awarded this trade');
SELECT gbt.refused('a hold on another job''s work', $s$SELECT public.gc_add_rfi(gbt.ask('Panel height?', jsonb_build_object('holds', jsonb_build_array('00000000-0000-0000-0000-000000080004'))))$s$, 'holds only this job');
SELECT gbt.refused('no job named', $s$SELECT public.gc_add_rfi(jsonb_build_object('question', 'Panel height?'))$s$, 'Which job the RFI is for is missing');
SELECT gbt.refused('a job that does not exist', $s$SELECT public.gc_add_rfi(gbt.ask('Panel height?', jsonb_build_object('projectId', '00000000-0000-0000-0000-0000000008ff')))$s$, 'No GC project with that id');

-- Sent and answered: the architect answers only what went to them; we can answer our own any time.
SELECT gbt.refused('the architect''s answer before it went to them', $s$SELECT public.gc_answer_rfi(gbt.rfi(2), gbt.answer('architect', 'plans'))$s$, 'The architect answers only what went to them');
SELECT public.gc_answer_rfi(gbt.rfi(2), gbt.answer('us', 'plans', jsonb_build_object('cost', 50, 'days', 1)));
SELECT gbt.refused('an answer twice', $s$SELECT public.gc_answer_rfi(gbt.rfi(2), gbt.answer('us', 'none'))$s$, 'It is answered already');
SELECT gbt.refused('a send once answered', $s$SELECT public.gc_send_rfi_to_architect(gbt.rfi(2))$s$, 'It is answered already');
SELECT gbt.same('sent another way, today', (public.gc_send_rfi_to_architect(gbt.rfi(1)) - public.app_today())::text, '0');
SELECT gbt.refused('sent twice', $s$SELECT public.gc_send_rfi_to_architect(gbt.rfi(1))$s$, 'It went to the architect already');
SELECT gbt.refused('a blank answer', $s$SELECT public.gc_answer_rfi(gbt.rfi(1), gbt.answer('architect', 'none', jsonb_build_object('text', ' ')))$s$, 'Type the answer first');
SELECT gbt.refused('an answer by someone unknown', $s$SELECT public.gc_answer_rfi(gbt.rfi(1), gbt.answer('owner', 'none'))$s$, 'Say who answered, the architect or us');
SELECT gbt.refused('an impact the register does not know', $s$SELECT public.gc_answer_rfi(gbt.rfi(1), gbt.answer('architect', 'maybe'))$s$, 'Pick what it changes');
SELECT gbt.refused('a cost that is not a number', $s$SELECT public.gc_answer_rfi(gbt.rfi(1), gbt.answer('architect', 'cost', jsonb_build_object('cost', 'lots')))$s$, 'The cost and the days must be numbers');
SELECT gbt.refused('a cost answer with neither', $s$SELECT public.gc_answer_rfi(gbt.rfi(1), gbt.answer('architect', 'cost', jsonb_build_object('cost', 0, 'days', 0)))$s$, 'A cost answer needs a cost or days');
SELECT public.gc_answer_rfi(gbt.rfi(1), gbt.answer('architect', 'cost', jsonb_build_object('cost', 3800.4, 'days', 2)));
SELECT gbt.same('the answers as kept: a plans answer keeps no cost', gbt.rfis(),
  E'RFI-1 Concrete by Ridgeway Concrete sheets S-101,S-102 holds Footings,Slab needed 5 sent answered architect:cost:3800:2\nRFI-2 ours by us sheets - holds - needed 3 answered us:plans:0:0');

-- The change order a cost answer starts, through Owner Billing's own draft.
SELECT gbt.refused('a plans answer', $s$SELECT public.gc_rfi_change_order(gbt.rfi(2), 'RFI-002: drain', 100)$s$, 'Only an answer that adds cost starts a change order');
SELECT gbt.refused('no price', $s$SELECT public.gc_rfi_change_order(gbt.rfi(1), 'RFI-001: slab', NULL)$s$, 'Type what it adds to their price');
SELECT gbt.refused('no words', $s$SELECT public.gc_rfi_change_order(gbt.rfi(1), '  ', 4180)$s$, 'Say what is changing');
SELECT public.gc_rfi_change_order(gbt.rfi(1), 'RFI-001: Pour the slab 6 in. thick (S-101, S-102)', 4180);
SELECT gbt.same('the draft it made, and the link', (SELECT co.number || ' ' || co.status || ' ' || co.reason || ' ' || co.cost || ' ' || co.price || ' ' || co.days || ' ' || (co.package_id = '00000000-0000-0000-0000-0000000008b1') || ' ' || co.description FROM public.gc_change_orders co JOIN public.gc_rfis r ON r.change_order_id = co.id WHERE r.id = gbt.rfi(1)),
  '1 draft plans 3800 4180 2 true RFI-001: Pour the slab 6 in. thick (S-101, S-102)');
SELECT gbt.refused('a second change order', $s$SELECT public.gc_rfi_change_order(gbt.rfi(1), 'RFI-001: again', 4180)$s$, 'It started a change order already');
SELECT public.gc_add_rfi(gbt.ask('Can we skip the vapor barrier?', jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000008b1')));
SELECT public.gc_answer_rfi(gbt.rfi(3), gbt.answer('us', 'cost', jsonb_build_object('days', 4)));
SELECT gbt.refused('an answer that adds days only', $s$SELECT public.gc_rfi_change_order(gbt.rfi(3), 'RFI-003: barrier', 0)$s$, 'This answer adds days only. Ask for the days on the schedule instead');
-- A deleted draft clears the link, so the answer can start another.
RESET ROLE;
DELETE FROM public.gc_change_orders WHERE id = (SELECT change_order_id FROM public.gc_rfis WHERE id = gbt.rfi(1));
SET LOCAL ROLE authenticated;
SELECT public.gc_rfi_change_order(gbt.rfi(1), 'RFI-001: Pour the slab 6 in. thick (S-101, S-102)', 4180);
SELECT gbt.same('a new draft after the old one went', (SELECT co.number FROM public.gc_change_orders co JOIN public.gc_rfis r ON r.change_order_id = co.id WHERE r.id = gbt.rfi(1))::text, '1');

-- The trade's question from its portal, as the service role. A refusal is a key and its reason.
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('a trade that does not exist', $s$SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008ff', 'Pour sequence?')$s$, 'notFound', 'No trade with that id.');
SELECT gbt.trade_refused('another company''s trade', $s$SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008b1', 'Pour sequence?')$s$, 'notOnTrade', 'Only the company we awarded this trade can ask about its work.');
SELECT gbt.trade_refused('a trade not awarded', $s$SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008b2', 'Frame size?')$s$, 'notOnTrade', 'Only the company we awarded this trade can ask about its work.');
SELECT gbt.trade_refused('a job still bidding', $s$SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008b4', 'Panel location?')$s$, 'jobNotBuilding', 'Questions open once we are building the job.');
SELECT gbt.trade_refused('a closed job', $s$SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008b5', 'Flashing?')$s$, 'jobNotBuilding', 'Questions open once we are building the job.');
SELECT gbt.trade_refused('no question', $s$SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008b1', '  ')$s$, 'questionNeeded', 'Type the question first.');
SELECT gbt.trade_refused('a question too long', $s$SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008b1', repeat('x', 2001))$s$, 'tooLong', 'Keep the question under 2,000 characters.');
SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008b1', 'Control joints at 12 ft?', ARRAY['S-201', ' ']);
RESET ROLE;
-- Once the slab is under way too, the trade's question holds the work under way.
SELECT set_config('gc.schedule_plan_write', 'on', true);
UPDATE public.gc_schedule_activities SET start = public.app_today() - 1 WHERE scope_item_id = '00000000-0000-0000-0000-000000080002';
SELECT set_config('gc.schedule_plan_write', '', true);
SET LOCAL ROLE service_role;
SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008b1', 'Finish on the slab?');
RESET ROLE;
-- With all its work finished, it holds nothing.
UPDATE public.gc_schedule_activities SET actual_start = public.app_today() - 1, actual_finish = public.app_today() WHERE scope_item_id = '00000000-0000-0000-0000-000000080002';
SET LOCAL ROLE service_role;
SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008b1', 'Cure time?');
RESET ROLE;
SELECT gbt.same('the trade''s questions hold its next unfinished work, the work under way, then nothing', gbt.rfis(),
  E'RFI-1 Concrete by Ridgeway Concrete sheets S-101,S-102 holds Footings,Slab needed 5 sent answered architect:cost:3800:2 co 1\nRFI-2 ours by us sheets - holds - needed 3 answered us:plans:0:0\nRFI-3 Concrete by us sheets - holds - needed 3 answered us:cost:0:4\nRFI-4 Concrete by Ridgeway Concrete sheets S-201 holds Slab needed 3\nRFI-5 Concrete by Ridgeway Concrete sheets - holds Slab needed 3\nRFI-6 Concrete by Ridgeway Concrete sheets - holds - needed 3');
SELECT gbt.same('a trade''s question names no one of ours', (SELECT count(*) FROM public.gc_rfis WHERE number >= 4 AND recorded_by IS NOT NULL)::text, '0');

-- Who may not.
SELECT gbt.as_user(NULL);
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a caller signed out', $s$SELECT public.gc_add_rfi(gbt.ask('Footing depth?'))$s$, 'Sign in first');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000008d2');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a training account records', $s$SELECT public.gc_add_rfi(gbt.ask('Footing depth?'))$s$, 'A training account cannot record an RFI');
SELECT gbt.refused('a training account starts a change order', $s$SELECT public.gc_rfi_change_order(gbt.rfi(1), 'x', 1)$s$, 'A training account cannot start a change order');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000008d3');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a digital twin records', $s$SELECT public.gc_answer_rfi(gbt.rfi(4), gbt.answer('us', 'none'))$s$, 'A digital twin cannot record an RFI');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000008d4');
SET LOCAL ROLE authenticated;
-- An estimator reads the job but neither adds nor sees an RFI, and is not the money team.
SELECT gbt.refused('an estimator records, outside Building''s dev door', $s$SELECT public.gc_add_rfi(gbt.ask('Footing depth?'))$s$, 'row-level security');
SELECT gbt.refused('an estimator sends, outside the door', $s$SELECT public.gc_send_rfi_to_architect(gbt.rfi(4))$s$, 'No RFI with that id');
SELECT gbt.refused('an estimator starts a change order', $s$SELECT public.gc_rfi_change_order(gbt.rfi(1), 'x', 1)$s$, 'Only the money team starts a change order');
SELECT gbt.refused('a signed-in caller cannot be the trade', $s$SELECT public.gc_trade_rfi_ask('00000000-0000-0000-0000-0000000008e1', '00000000-0000-0000-0000-0000000008b1', 'Q?')$s$, 'permission denied');
RESET ROLE;
SELECT gbt.same('nobody but the dev and the trade wrote an RFI', (SELECT count(*) FROM public.gc_rfis WHERE project_id = '00000000-0000-0000-0000-0000000008a1')::text, '6');

DO $$ BEGIN RAISE NOTICE 'gc_building PASSED'; END $$;
ROLLBACK;
```

**Run here first, on main's real GC chain.** Docker is off on this Mac, and the other users' Postgres servers fill
its shared memory. So the bed ran in PGlite, real Postgres in-process, as the Board lane's `b5matrix.mjs` does:
- stand-ins only for what the chain reads outside GC mode (`users`, `customers`, `projects`, `bids`,
  `email_send_log`, the billing tables, the two CHECKs it widens, and five small functions);
- the real `is_read_only`, `is_digital_twin`, `block_if_read_only` and the three `apply_*` helpers, from their
  migrations;
- then main's 28 `*_gc_*` migrations in stamp order, with every real table, CHECK, policy and function.

U5a applied twice, and `50_rfis.sql` passed its 50 assertions. U4a's `40_submittals.sql` still passed its 50 beside
it. Two planted bugs each failed it: the money-team check dropped, and the default hold counting finished work. The
real bed runs on the PR.

## The migration doc as it will be

````markdown
# <stamp>_gc_rfi_writes.sql (2026-10-09, v2.NNNN)

GC mode, the real build, the Building lane's U5a: the RFIs' presses and the change order a cost answer starts (`to-dos/gc-mode/mockups/building-u5.md` on branch `spike/gc-mode`). One column and five functions. The tables are `20261008030000_gc_building_records`. The change orders are Owner Billing's: `20261008010000` and `20261008110000`. The award is `20261009140000` (the Board's B6-a).

- **`gc_rfis.change_order_id`**: the change order a cost answer started (`Rfi.changeOrderId`, decision 3). It references `gc_change_orders(id) ON DELETE SET NULL`, so a deleted draft clears it. A unique partial index keeps a change order one RFI's, and the CHECK `gc_rfis_change_order_from_cost` allows it only on a cost answer.
- **`gc_add_rfi(r jsonb)`** returns the RFI's id. It takes the prototype's `addRfi` shape: `projectId`, `question`, `sheets`, `packageId`, `askedByCompanyId`, `holds` and `neededDays`.
  - It numbers the RFI one up from the job's last, one press at a time on a job.
  - The company that asked by phone must be the one awarded that trade, or none.
  - A hold must be one of this job's scope lines.
  - The needed days are 3 unless a number of none or more is given.
- **`gc_send_rfi_to_architect(p_rfi_id uuid, p_email_send_log_id uuid DEFAULT NULL)`** returns the day: the RFI went to the architect today, with the email `gc-architect-email` sent (U5b) or none when it went another way. Not once it is sent or answered.
- **`gc_answer_rfi(p_rfi_id uuid, a jsonb)`** returns the day. It takes `text`, `by` (`architect` or `us`), `impact` (`none`, `plans` or `cost`), `cost` and `days`.
  - The architect answers only what was sent to them.
  - A cost answer has a cost or days, each whole and never below none.
  - Any other answer keeps neither.
- **`gc_rfi_change_order(p_rfi_id uuid, p_description text, p_price numeric)`** returns the change order's id.
  - It drafts through Owner Billing's own `gc_draft_change_order`: a plan revision on the RFI's trade at the answer's cost and days, with the client's words (`rfiChangeOrderDescription`) and price (`changeOrderPrice`).
  - It links the RFI in the same transaction.
  - Only the money team may start one (`gc_money_team()`), even after Building's door.
  - An answer that adds days only is refused and pointed at the schedule's Ask for the days.
- **`gc_trade_rfi_ask(p_company_id uuid, p_package_id uuid, p_question text, p_sheets text[] DEFAULT '{}')`** returns the RFI's id: the trade's question from its portal, by the company awarded that trade, on a job being built.
  - It holds the trade's next unfinished bar after today, else its earliest unfinished one (`rfiDefaultHolds`). Its answer is needed 3 days before. Nobody of ours is its recorder.
  - It refuses with keys, as the Portal's P2a verbs do: `notFound`, `notOnTrade`, `jobNotBuilding`, `questionNeeded` and `tooLong`, each with its reason as the DETAIL. The Portal's P5 adds the kind to `submit-gc-trade-portal` and maps `jobNotBuilding`. Until then it is listed in WAITING (`src/lib/gc/gcTradeSubmit.test.ts`) with `'P5'`.
- **They refuse**, in words:
  - a training account and a digital twin;
  - a job bidding, lost or closed;
  - a blank question, a trade not on the job, a company not the trade's, and another job's line;
  - a send or an answer twice, an architect's answer before it went to them, and a cost answer with neither;
  - a change order from an answer with no cost, a second one, one from outside the money team, and one from an answer that adds days only.

`SECURITY INVOKER`, every one: the tables' dev policies decide who may, and `gc_change_orders`' money-team policy for the change order. The office's four are revoked from `PUBLIC` and `anon` and granted to `authenticated`. The trade's is the service role's only.

Apply order: after `20261009140000` and `20261008110000`. The column, its index and its CHECK lock `gc_rfis` briefly. It is a dev-only table with no rows on prod, behind `lock_timeout 3s`. The rest is `CREATE OR REPLACE`. It is idempotent.

**Before the push**, the SQL bed (`scripts/pgtest-gc-building.sh`, `npm run test:pg:gc-building`; GitHub's runners run it from `.github/workflows/sql-beds.yml` on this PR) applies every migration to the Supabase Postgres image, applies Building's presses a second time, and plays every scenario in `supabase/tests/gc_building`, `50_rfis.sql` among them:
- It adds RFIs by phone and our own, and walks them to the architect and back.
- It starts a change order through the real `gc_draft_change_order`, and starts another once the draft is deleted.
- It refuses each case above in its words.
- It asks as the trade from the portal and checks the holds: next unfinished, under way, then none.
- It refuses a trainee, a twin, an estimator, who is outside both Building's door and the money team, and a signed-in caller of the trade's press.
It ends `gc_building PASSED`.

## Verify after the push

1. **The column and the five functions are there, with invoker's rights, and only the right callers run them.**

   ```sql
   SELECT p.proname, p.prosecdef AS definer,
     has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can,
     has_function_privilege('authenticated', p.oid, 'EXECUTE') AS signed_in_can,
     has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_can
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname IN ('gc_add_rfi', 'gc_send_rfi_to_architect', 'gc_answer_rfi', 'gc_rfi_change_order', 'gc_trade_rfi_ask')
   ORDER BY p.proname;
   SELECT conname FROM pg_constraint WHERE conrelid = 'public.gc_rfis'::regclass AND conname LIKE 'gc_rfis_change_order%';
   ```

   Expect five functions:
   - every `definer` false and every `anon_can` false;
   - `signed_in_can` true on all but `gc_trade_rfi_ask`, which only `service_can`;
   - the constraints `gc_rfis_change_order_from_cost` and `gc_rfis_change_order_id_fkey`.

2. **Its refusals before any row, as a dev**, through the page's `supabase` client:
   - on "GC test bidding project, delete me" (`c4117b0d-0c64-4935-933f-01bd96bfef60`): *An RFI is for a job that is ours. While we bid, ask about the plans instead.*
   - on "GC test project, delete me" (`ef8905d1-039a-4cbc-9d69-9468cfea50e0`) with a blank question: *Type the question first.*

3. **One RFI on "GC test project, delete me"**, inside one transaction that rolls back unless Grace says keep it:
   - Add it on the trade B6-a's verify awarded, holding one of its lines. It reads back RFI-00N, waiting on us.
   - Send it another way: `gc_send_rfi_to_architect(<id>)`.
   - Answer it as the architect with a cost of 100 and 1 day.
   - Start a change order with the client's words and a price of 110. It makes a draft change order, reason plans, on that trade, linked from the RFI.
   - Delete that draft. The link clears.

4. **A training account's call is refused in words.** As the training-mode user, `gc_add_rfi` gives *A training account cannot record an RFI.* (`42501`).

5. **The trade's press is the service role's only.** As a dev, `gc_trade_rfi_ask` gives *permission denied for function gc_trade_rfi_ask*.

## Rollback

```sql
DROP FUNCTION IF EXISTS public.gc_trade_rfi_ask(uuid, uuid, text, text[]);
DROP FUNCTION IF EXISTS public.gc_rfi_change_order(uuid, text, numeric);
DROP FUNCTION IF EXISTS public.gc_answer_rfi(uuid, jsonb);
DROP FUNCTION IF EXISTS public.gc_send_rfi_to_architect(uuid, uuid);
DROP FUNCTION IF EXISTS public.gc_add_rfi(jsonb);
ALTER TABLE public.gc_rfis DROP CONSTRAINT IF EXISTS gc_rfis_change_order_from_cost;
DROP INDEX IF EXISTS public.gc_rfis_change_order_once;
ALTER TABLE public.gc_rfis DROP COLUMN IF EXISTS change_order_id;
```

No screen calls them until U5b, so nothing else changes.

## Status

Written for the Building lane's U5a; not applied. The lead pushes it after the merge and records here what steps 1 to 5 said.
````

## U5b: the window, the mapper, the io and the email

**The window**, `src/components/gc/GcRfisWindow.tsx`, ported from the prototype's `GcBuildingRfisTab`, `AskForm`,
`RfiCard` and `AnswerForm`:
- It opens from **RFIs** on a building job's card, at `?rfis=<projectId>`, after Submittals' pieces, behind
  `canUseGcBuilding`.
- The counts strip: waiting on us, with the architect, answered, and due now.
- **Ask a question**:
  - the question, the sheets, the trade or our own work, and who asked (our superintendent, or the company
    awarded the trade);
  - the work it holds, with the lines whose sheets match the question's ticked first;
  - the days before that work it is needed.
- Each RFI, open first and most urgent first, answered newest first:
  - **Send to {architect}** or **We sent it another way**, while it is ours;
  - **Record their answer**: by the architect or us, and what it changes, nothing, the plans, or cost and days;
  - **Start a change order** on a cost answer, for the money team only (`canSeeGcMoney`). An answer that adds days
    only says so and points at Ask for the days. The press drafts the change order and opens the Change orders
    window on it. A started one reads *Change order 3*.
- Props in main's pattern: `writes={{ onAsk, onSendToArchitect, onMarkSent, onAnswer, onStartChangeOrder }}`, with
  `busy` and `problem`. The overlay is copied, as U4b's was.
- Left on the spike: the trade's half, `GcPortalRfis.tsx` (the Portal's P5).

**The mapper**, `src/lib/gc/rfiRows.ts`: `withRfis(state, tables)` lays `project.rfis` over
`boardProjectFromView`'s project.

| Kernel field | From |
|---|---|
| `id`, `number`, `question`, `sheets` | `gc_rfis` |
| `packageId`, `partnerId` | `package_id`, `asked_by_company_id` |
| `askedOn`, `neededDays`, `sentToArchitectOn` | `asked_on`, `needed_days`, `sent_to_architect_on` |
| `holds` | `gc_rfi_holds.scope_item_id` (decision 2) |
| `answer` | `answered_on`, `answer_text`, `answered_by`, `impact`, `cost`, `days`, or null |
| `changeOrderId` | `change_order_id` |

`types.ts` stays the prototype's. `email_send_log_id` and `recorded_by` ride beside it, as U4b's round extras do.
The window reads the job's schedule through 6a's `loadSchedule`, so `rfiNeededBy` and `rfiHolds` read the bars. A
started change order's number needs `project.changeOrders`, which only the money team reads. Anyone else reads
*a change order was started*.

**The io**, `src/lib/gc/rfisIo.ts`: `loadGcRfis(projectIds)` reads both tables in one round, and one function per
press. Start a change order computes its words and price with the kernels before the call.

**`gc-architect-email` gains the kind `rfi`.** It sends the question, the sheets, the work it holds and the day we
need the answer, from `COMPANY_EMAIL_FROM` with the project manager as Reply-To. It records through
`gc_send_rfi_to_architect` as the caller. Its words are `buildGcRfiEmail` beside `buildGcSubmittalEmail` in
`_shared/gcArchitectEmail.ts`, and its journey step and sample are *RFI for an answer* (`gc-rfi`).

**U5b's tests:** `rfiRows.test.ts` (Fair Oaks D's four RFIs through rows and back, the kernels' words the same),
the `rfi` email's builder, `GcRfisWindow.render.test.tsx` (each state's press, the money team's button, the
days-only words, plain words), and the page's cases.

## Drift from `BUILDING_REAL_BUILD.md`

- **The change order's words and price come from the client** (call 2). The plan's table had the RPC build them.
- **A days-only answer starts no change order** (call 3). The prototype drafted one at no cost.
- **The money team is checked by name first** (call 4), so its words reach a Building member outside it before
  the RFI's own policy hides the row.
- **A phoned-in company must be the one awarded the trade** (call 5). The prototype took any company.
- **An office hold may be any of this job's scope lines**, drawn or not, since holds are keyed to scope lines
  (decision 2). The reducer kept only lines on the schedule. A line of another job is refused, not dropped.
- **The default hold's unfinished is no actual finish** until U6's reports.
- **The trade's RFI names no recorder of ours**, explicitly, whatever the caller's session holds.
- **The trade's question has P2a's 2,000-character limit** (`tooLong`). The prototype had none.
- **Closed is the stage `closed`**, so no U6 column is needed.

## The check (U5b, on "GC test project, delete me", as a dev)

1. Ask the prototype's four RFIs, one in each state, on the awarded trade's lines.
2. Send one another way and one by email to GC Test Architects. The email waits for Grace's own yes in Helper
   18's chat.
3. Answer one as the architect with a cost, and start a change order from it. It reads RFI-00N in its words,
   and the Change orders window opens on it.
4. The rows stay with the test project's others for the owner's call 4, on Grace's yes, and their ids go to the
   lead.

## When it is cut

- **U5a**: from `origin/main` after #5123 (U4b) merges, on the lead's day for Building's next migration. It is
  pushed on its merge.
- **U5b**: from `origin/main` on U5a's types PR.

## Docs each PR touches

- **U5a**: its release note and fragment, `docs/migrations/<stamp>_gc_rfi_writes.md` (above), and the WAITING line.
- **U5b**:
  - its release note and fragment;
  - `docs/EDGE_FUNCTIONS.md`: the kind `rfi` on `gc-architect-email`;
  - `docs/PROJECT_DOCUMENTATION.md`: the RFIs window's paragraph after Submittals';
  - `docs/GLOSSARY.md`: **RFI**;
  - `docs/ACCESS_CONTROL.md`: Building's windows sentence names RFIs, and the change order stays the money
    team's;
  - the guide *ask the architect a question while we build* (`roles: dev` until Building's door).

## Seams

- **Owner Billing (Helper 15)**: `gc_draft_change_order` is called unchanged, with reason `plans`. Its own
  refusals stand. The link lives on `gc_rfis` (decision 3), and a deleted draft clears it.
- **The Portal (Helper 13)**: the kind `ask_rfi` in `submit-gc-trade-portal`, `jobNotBuilding` mapped (it waits
  in WAITING until then), and `GcPortalRfis`.
- **Helper 14**: separate files (`rfiRows.ts`, `rfisIo.ts`), `50_rfis.sql` beside `20` and `30`, and the RFIs
  button after Submittals.
- **The schedule**: `rfiHolds` and `submittalHolding` feed `chartHolds` in its PR 9. Both hold scope line ids, the
  same ids the bars carry.

## Is this the best we can do?

1. **The holds suggest themselves from the sheets.** A question about S-101 holds the lines whose sheets name
   S-101 (`gc_scope_items.sheets`). *Picked, in U5b:* those lines come ticked, and the office unticks what does
   not belong.
2. **The architect answers from a link of their own**, as U4's way 1 says. *Not now:* there is no architect
   page yet.
3. **A daily log's delay links its RFI.** A delay *waiting on an answer* could name the RFI and close itself when
   the answer comes. *Later:* the log's delays are U3b's, and the link is a column on them.

## Status

Plan 2026-10-09 by Helper 18 at the lead's ask, from `origin/spike/gc-mode` at f285a180d and `origin/main` at
e5cef92f0. The read-back was approved the same day at all five picks. The SQL passed its scenario on main's real GC
chain in PGlite. Nothing is cut or claimed.
