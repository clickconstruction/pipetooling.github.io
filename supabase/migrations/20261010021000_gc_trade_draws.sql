SET lock_timeout = '3s';

-- GC mode, the real build, the Building lane's U6a (v2.5084): the trades' money on real data. A trade reports each
-- line of its signed statement of work and sends a pay application with its G702 and G703; the office approves it,
-- approves it for less, or sends it back, marks it paid, takes a back-charge off it, and sends a signed change order
-- to the trade, who signs it into its statement of work. A pay application that came by email or on paper is recorded
-- by the office, and so is an unconditional waiver that came in. Each refuses in words what the prototype's reducer
-- refuses (tradeReport, tradeSendPayApp, approveDraw, approveDrawLess, sendDrawBack, payDraw, takeBackCharge,
-- tradeSignUnconditional, sendTradeChange, tradeSignChange). A draw's money is worked out here from what it claims,
-- by the kernels' rules (payApplication and drawMoney in src/lib/gc/building.ts), never taken from the caller: the
-- parity scenario in supabase/tests/gc_building/60_draws.sql holds the two equal. The office's presses are SECURITY
-- INVOKER, so RLS decides who may: dev only until Building's door, then the money roles (decision 4). The trade's
-- presses are the service role's only, and refuse with keys as the Portal's P2a verbs do. Closeout (the final pay
-- application, the retainage release, accepting the work, closing the job) is U6c's. Plan:
-- to-dos/gc-mode/mockups/building-u6.md on spike/gc-mode. The statement of work: 20261009140000. Back-charges:
-- 20261010006000. Change orders: 20261008010000. Promises: 20261008020000.

-- A draw: one pay application from a trade on its statement of work (Draw), with the pay application's own words
-- (DrawPayApp). A resend after we sent one back takes the same number, and the one sent back stays as it went
-- (status sent_back: DrawSentBack), so no pay application is ever stored twice. Its money is gc_draw_money's.
CREATE TABLE IF NOT EXISTS public.gc_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_id uuid NOT NULL REFERENCES public.gc_sows(id) ON DELETE CASCADE,
  number integer NOT NULL
    CONSTRAINT gc_draws_number_positive CHECK (number > 0),
  requested_on date NOT NULL,
  status text NOT NULL DEFAULT 'requested'
    CONSTRAINT gc_draws_status_known CHECK (status IN ('requested', 'approved', 'paid', 'sent_back')),
  -- The work this period plus the change in what is stored on site, less retainage, as approved (as asked until
  -- then). A back-charge taken off it is the charge's row (gc_back_charges.taken_draw_id), never subtracted here.
  gross numeric(14,2) NOT NULL,
  retainage numeric(14,2) NOT NULL,
  net numeric(14,2) NOT NULL,
  -- The retainage release (U6c): the last draw, once the work is accepted. It pays back what was held.
  final boolean NOT NULL DEFAULT false,
  -- The trade's lien waiver for it: conditional with the ask, unconditional once it is paid.
  waiver text NOT NULL DEFAULT 'conditional'
    CONSTRAINT gc_draws_waiver_known CHECK (waiver IN ('conditional', 'unconditional')),
  waiver_on date,
  approved_on date,
  paid_on date,
  -- Approved for less (the owner, 2026-10-02): what they asked, as it went, why we approved less, and the day.
  asked jsonb
    CONSTRAINT gc_draws_asked_object CHECK (asked IS NULL OR jsonb_typeof(asked) = 'object'),
  -- Sent back: the day and what to fix. The percent we see on a line we doubt is on its line (we_see).
  sent_back_on date,
  sent_back_note text,
  -- The pay application's own words.
  period_to date NOT NULL,
  address text NOT NULL DEFAULT '',
  license text NOT NULL DEFAULT '',
  signed_by text NOT NULL
    CONSTRAINT gc_draws_signed CHECK (btrim(signed_by) <> ''),
  signed_title text NOT NULL DEFAULT '',
  signed_on date NOT NULL,
  -- A pay application that came by email or on paper: its file, and who of ours recorded it. Null: from the portal.
  file_name text,
  drive_url text,
  recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The order rows were made: a resend sorts after the one sent back, whatever the clock says.
  seq bigint GENERATED ALWAYS AS IDENTITY,
  CONSTRAINT gc_draws_net_adds CHECK (net = gross - retainage),
  CONSTRAINT gc_draws_approved_dated CHECK ((status IN ('approved', 'paid')) = (approved_on IS NOT NULL)),
  CONSTRAINT gc_draws_paid_dated CHECK ((status = 'paid') = (paid_on IS NOT NULL)),
  CONSTRAINT gc_draws_sent_back_dated CHECK ((status = 'sent_back') = (sent_back_on IS NOT NULL)),
  CONSTRAINT gc_draws_waiver_after_paid CHECK (waiver = 'conditional' OR status = 'paid'),
  CONSTRAINT gc_draws_waiver_dated CHECK ((waiver = 'unconditional') = (waiver_on IS NOT NULL)),
  CONSTRAINT gc_draws_asked_when_approved CHECK (asked IS NULL OR status IN ('approved', 'paid')),
  CONSTRAINT gc_draws_final_pays_back CHECK (NOT final OR (gross = 0 AND retainage <= 0))
);

COMMENT ON TABLE public.gc_draws IS
  'GC mode (v2.5084, Building U6a): a trade''s pay application on its statement of work (Draw, DrawPayApp): asked, approved (perhaps for less, asked keeps what they asked), paid, or sent back (DrawSentBack, its resend takes the same number), with its lien waiver. Its money is gc_draw_money''s from what it claims. Written by gc_draw_came_in, gc_approve_draw, gc_approve_draw_less, gc_send_draw_back, gc_pay_draw, gc_draw_waiver_in and the service role''s gc_trade_pay_app and gc_trade_unconditional_waiver. Dev only while it is built.';

-- One number per statement of work among the draws that stand, and one waiting on us at a time.
CREATE UNIQUE INDEX IF NOT EXISTS gc_draws_number_once ON public.gc_draws (sow_id, number) WHERE status <> 'sent_back';
CREATE UNIQUE INDEX IF NOT EXISTS gc_draws_one_waiting ON public.gc_draws (sow_id) WHERE status = 'requested';

-- What a draw claims on each line (Draw.lines): the percent done it takes the line to, and the materials stored on
-- site in dollars (question 12), a balance, so only the newest draw's counts. On a draw sent back, we_see is the
-- percent we see on a line we doubt. The line's check waits for the end of the transaction, so a whole project still
-- goes by cascade.
CREATE TABLE IF NOT EXISTS public.gc_draw_lines (
  draw_id uuid NOT NULL REFERENCES public.gc_draws(id) ON DELETE CASCADE,
  sow_line_id uuid NOT NULL REFERENCES public.gc_sow_lines(id) DEFERRABLE INITIALLY DEFERRED,
  to_pct numeric NOT NULL
    CONSTRAINT gc_draw_lines_pct_range CHECK (to_pct >= 0 AND to_pct <= 100),
  stored numeric(14,2) NOT NULL DEFAULT 0
    CONSTRAINT gc_draw_lines_stored_not_negative CHECK (stored >= 0),
  we_see numeric
    CONSTRAINT gc_draw_lines_we_see_range CHECK (we_see IS NULL OR (we_see >= 0 AND we_see <= 100)),
  PRIMARY KEY (draw_id, sow_line_id)
);

COMMENT ON TABLE public.gc_draw_lines IS
  'GC mode (v2.5084, Building U6a): what a draw claims on each line of the statement of work (Draw.lines): the percent done (to_pct), the materials stored on site in dollars, and on one sent back the percent we see on a line we doubt (we_see). A line''s billed percent is the most an approved or paid draw took it to. Dev only while it is built.';

CREATE INDEX IF NOT EXISTS gc_draw_lines_line_idx ON public.gc_draw_lines (sow_line_id);

-- A trade's report on a line of its statement of work (SovLine.pctReported is the newest), from its portal or, for
-- a pay application that came by email, typed by one of ours. Never below what is billed. Append only.
CREATE TABLE IF NOT EXISTS public.gc_sow_line_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_line_id uuid NOT NULL REFERENCES public.gc_sow_lines(id) ON DELETE CASCADE,
  pct numeric NOT NULL
    CONSTRAINT gc_sow_line_reports_pct_range CHECK (pct >= 0 AND pct <= 100),
  reported_on date NOT NULL,
  -- Whose report it is: the company on the statement of work. Who of ours typed it in: null from the portal.
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE RESTRICT,
  recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The order rows were made: the newest report is the last one, whatever the clock says.
  seq bigint GENERATED ALWAYS AS IDENTITY
);

COMMENT ON TABLE public.gc_sow_line_reports IS
  'GC mode (v2.5084, Building U6a): a trade''s percent done on a line of its statement of work (SovLine.pctReported is the newest), from gc_trade_sow_report, a pay application''s claim, or a credit signed in. Append only. Dev only while it is built.';

CREATE INDEX IF NOT EXISTS gc_sow_line_reports_newest_idx ON public.gc_sow_line_reports (sow_line_id, seq DESC);

-- A signed change order sent to the trade it belongs to, as a change to its statement of work
-- (ChangeOrder.tradeChange). Once the trade signs it, it is a line of their statement of work, for what the change
-- costs us. Owner Billing's table carries no Building column (decision 3).
CREATE TABLE IF NOT EXISTS public.gc_change_order_trade_sends (
  change_order_id uuid PRIMARY KEY REFERENCES public.gc_change_orders(id) ON DELETE CASCADE,
  sow_id uuid NOT NULL REFERENCES public.gc_sows(id) ON DELETE CASCADE,
  sent_on date NOT NULL,
  sent_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  signed_on date,
  -- The line of their statement of work it became.
  sow_line_id uuid REFERENCES public.gc_sow_lines(id) ON DELETE SET NULL,
  CONSTRAINT gc_change_order_trade_sends_line_when_signed CHECK (sow_line_id IS NULL OR signed_on IS NOT NULL)
);

COMMENT ON TABLE public.gc_change_order_trade_sends IS
  'GC mode (v2.5084, Building U6a): a signed change order sent to its trade as a change to the statement of work (ChangeOrder.tradeChange), and the day the trade signed it into a line of its own (sow_line_id). Written by gc_send_trade_change and the service role''s gc_trade_sign_change. Dev only while it is built.';

-- A change order's line may take money off: a credit, work coming out. Only a change order's line.
ALTER TABLE public.gc_sow_lines DROP CONSTRAINT IF EXISTS gc_sow_lines_amount_not_negative;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_sow_lines_credit_by_change_order' AND conrelid = 'public.gc_sow_lines'::regclass) THEN
    ALTER TABLE public.gc_sow_lines ADD CONSTRAINT gc_sow_lines_credit_by_change_order CHECK (amount >= 0 OR change_order_id IS NOT NULL);
  END IF;
END $$;

-- The kernels' SovLine.id, said where the next reader looks (B6-a's own note named the change order): the scope item's
-- id when the line has one, else the line's own id (gc_sow_line_of), never the change order's.
COMMENT ON COLUMN public.gc_sow_lines.change_order_id IS
  'GC mode (v2.5084, Building U6a): the signed change order this line came from (gc_trade_sign_change), for its cost to the trade, a credit when below none. The kernels'' SovLine.id is the scope item''s id when the line has one, else this line''s own id (gc_sow_line_of), never the change order''s.';

-- The draw a back-charge came off (P4a's column, which waited for this table). Its check waits for the end of the
-- transaction, as the draw's lines do.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_back_charges_taken_draw_fkey' AND conrelid = 'public.gc_back_charges'::regclass) THEN
    ALTER TABLE public.gc_back_charges
      ADD CONSTRAINT gc_back_charges_taken_draw_fkey FOREIGN KEY (taken_draw_id) REFERENCES public.gc_draws(id) DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;
GRANT UPDATE (taken_draw_id, taken_on) ON TABLE public.gc_back_charges TO authenticated;

ALTER TABLE public.gc_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_draw_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_sow_line_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_change_order_trade_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_draws_dev ON public.gc_draws;
CREATE POLICY gc_draws_dev ON public.gc_draws FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_draw_lines_dev ON public.gc_draw_lines;
CREATE POLICY gc_draw_lines_dev ON public.gc_draw_lines FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_sow_line_reports_dev ON public.gc_sow_line_reports;
CREATE POLICY gc_sow_line_reports_dev ON public.gc_sow_line_reports FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_change_order_trade_sends_dev ON public.gc_change_order_trade_sends;
CREATE POLICY gc_change_order_trade_sends_dev ON public.gc_change_order_trade_sends FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));

-- Nobody signed out reaches them, and a report stays as it went.
REVOKE ALL ON TABLE public.gc_draws, public.gc_draw_lines, public.gc_sow_line_reports, public.gc_change_order_trade_sends FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.gc_sow_line_reports FROM authenticated;

-- A line of a statement of work by the kernels' id (SovLine.id): its scope item, or its own id on a change order's
-- line. Null: not a line of it.
CREATE OR REPLACE FUNCTION public.gc_sow_line_of(p_sow_id uuid, p_key uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT l.id FROM public.gc_sow_lines l
  WHERE l.sow_id = p_sow_id AND (l.scope_item_id = p_key OR (l.scope_item_id IS NULL AND l.id = p_key))
$$;

-- What a pay application claims, read the way the window sends it, by the kernels' line ids: each line once, its
-- percent a number and its stored dollars a number or none. Null: a line not on the statement of work, or a percent
-- that is not a number. Otherwise [{line: <gc_sow_lines id>, toPct, stored}].
CREATE OR REPLACE FUNCTION public.gc_draw_claim(p_sow_id uuid, p_lines jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_out jsonb := '[]'::jsonb;
  v_seen uuid[] := '{}';
  v_item jsonb;
  v_line uuid;
BEGIN
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN
    RETURN NULL;
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
    IF jsonb_typeof(v_item->'toPct') IS DISTINCT FROM 'number'
       OR (v_item ? 'stored' AND jsonb_typeof(v_item->'stored') NOT IN ('number', 'null')) THEN
      RETURN NULL;
    END IF;
    BEGIN
      v_line := public.gc_sow_line_of(p_sow_id, (v_item->>'line')::uuid);
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN NULL;
    END;
    IF v_line IS NULL THEN
      RETURN NULL;
    END IF;
    IF v_line = ANY (v_seen) THEN
      CONTINUE;
    END IF;
    v_seen := v_seen || v_line;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'line', v_line,
      'toPct', (v_item->>'toPct')::numeric,
      'stored', coalesce((v_item->>'stored')::numeric, 0)
    ));
  END LOOP;
  RETURN v_out;
END;
$$;

-- A pay application's money, by the kernels' rules (payApplication and drawMoney; 60_draws.sql holds them equal).
-- Each line is taken to its claim, never below what an earlier draw that stands took it to and never above 100.
-- Materials stored on site count up to what the line has left once the work in place is counted, in whole dollars.
-- The draw asks for the work this period plus the change in what is stored (only the newest draw's stored counts),
-- less the statement of work's retainage. It keeps each line that moved or holds stored materials: a credit's line
-- moves too, so a credit comes off once and its line reads billed. Returns {gross, retainage, net, lines,
-- reported}: `lines` what the draw keeps, `reported` every claimed line's percent.
CREATE OR REPLACE FUNCTION public.gc_draw_money(p_sow_id uuid, p_number integer, p_claim jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH claim AS (
    SELECT (c->>'line')::uuid AS line, (c->>'toPct')::numeric AS to_pct, coalesce((c->>'stored')::numeric, 0) AS stored
    FROM jsonb_array_elements(coalesce(p_claim, '[]'::jsonb)) c
  ),
  earlier AS (
    SELECT d.id, d.number FROM public.gc_draws d
    WHERE d.sow_id = p_sow_id AND d.number < p_number AND d.status <> 'sent_back'
  ),
  worked AS (
    SELECT l.id, l.position, l.amount, b.before, c.line IS NOT NULL AS claimed,
      greatest(b.before, least(100, coalesce(c.to_pct, b.before))) AS now,
      coalesce(c.stored, 0) AS stored
    FROM public.gc_sow_lines l
    CROSS JOIN LATERAL (
      SELECT coalesce(max(dl.to_pct), 0) AS before
      FROM public.gc_draw_lines dl JOIN earlier e ON e.id = dl.draw_id
      WHERE dl.sow_line_id = l.id
    ) b
    LEFT JOIN claim c ON c.line = l.id
    WHERE l.sow_id = p_sow_id
  ),
  money AS (
    SELECT id, position, claimed, now,
      amount * now / 100 - amount * before / 100 AS this_period,
      greatest(0, least(amount - amount * now / 100, round(stored))) AS on_site
    FROM worked
  ),
  gross AS (
    SELECT round(
      coalesce((SELECT sum(this_period + on_site) FROM money), 0)
      - coalesce((SELECT sum(dl.stored) FROM public.gc_draw_lines dl
                  WHERE dl.draw_id = (SELECT e.id FROM earlier e ORDER BY e.number DESC LIMIT 1)), 0),
      2) AS v
  ),
  held AS (
    SELECT round(g.v * s.retainage_pct / 100, 2) AS v
    FROM gross g CROSS JOIN public.gc_sows s WHERE s.id = p_sow_id
  )
  SELECT jsonb_build_object(
    'gross', g.v,
    'retainage', h.v,
    'net', g.v - h.v,
    'lines', coalesce((SELECT jsonb_agg(jsonb_build_object('line', m.id, 'toPct', m.now, 'stored', m.on_site) ORDER BY m.position)
                       FROM money m WHERE m.this_period <> 0 OR m.on_site > 0), '[]'::jsonb),
    'reported', coalesce((SELECT jsonb_agg(jsonb_build_object('line', m.id, 'pct', m.now) ORDER BY m.position)
                          FROM money m WHERE m.claimed), '[]'::jsonb)
  )
  FROM gross g CROSS JOIN held h
$$;

-- Record a pay application that came by email or on paper (new beside the prototype, as the submittal's came-in is):
-- the percent done and the stored dollars on each line, the day it runs to, who signed it, and its Drive link. It
-- follows the trade's own rules: a job being built, a signed statement of work, one waiting at a time, and money to
-- pay. What it claims is the trade's report on each line. It keeps their promise of a pay application.
CREATE OR REPLACE FUNCTION public.gc_draw_came_in(p_package_id uuid, p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project uuid;
  v_stage text;
  v_sow public.gc_sows%ROWTYPE;
  v_waiting integer;
  v_claim jsonb;
  v_period date;
  v_signed_by text := btrim(coalesce(p->>'signedBy', ''));
  v_number integer;
  v_money jsonb;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  -- The tables' read-only blocks and the twin fence refuse the writes too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record a pay application.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record a pay application.' USING ERRCODE = '42501';
  END IF;
  SELECT k.project_id, g.stage INTO v_project, v_stage
  FROM public.gc_trade_packages k JOIN public.gc_projects g ON g.project_id = k.project_id
  WHERE k.id = p_package_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No trade with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'Pay applications are for a job we are building.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id FOR UPDATE;
  IF NOT FOUND OR v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'Their statement of work is not signed yet.' USING ERRCODE = 'P0001';
  END IF;
  SELECT number INTO v_waiting FROM public.gc_draws WHERE sow_id = v_sow.id AND status = 'requested';
  IF FOUND THEN
    RAISE EXCEPTION 'Pay application % is waiting on us. Approve it or send it back first.', v_waiting USING ERRCODE = 'P0001';
  END IF;
  v_claim := public.gc_draw_claim(v_sow.id, p->'lines');
  IF v_claim IS NULL THEN
    RAISE EXCEPTION 'Each line must be on their statement of work, with its percent done.' USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    v_period := nullif(btrim(coalesce(p->>'periodTo', '')), '')::date;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    v_period := NULL;
  END;
  IF v_period IS NULL THEN
    RAISE EXCEPTION 'Say the day the pay application runs to.' USING ERRCODE = 'P0001';
  END IF;
  IF v_signed_by = '' THEN
    RAISE EXCEPTION 'Say who signed it.' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) + 1 INTO v_number FROM public.gc_draws WHERE sow_id = v_sow.id AND status <> 'sent_back';
  v_money := public.gc_draw_money(v_sow.id, v_number, v_claim);
  IF (v_money->>'gross')::numeric <= 0 THEN
    RAISE EXCEPTION 'There is nothing to pay. No work is new since their last pay application.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.gc_draws (sow_id, number, requested_on, gross, retainage, net, period_to, address, license, signed_by, signed_title, signed_on, file_name, drive_url, recorded_by)
  VALUES (
    v_sow.id, v_number, public.app_today(),
    (v_money->>'gross')::numeric, (v_money->>'retainage')::numeric, (v_money->>'net')::numeric,
    v_period, btrim(coalesce(p->>'address', '')), btrim(coalesce(p->>'license', '')), v_signed_by,
    btrim(coalesce(p->>'signedTitle', '')), public.app_today(),
    nullif(btrim(coalesce(p->>'fileName', '')), ''), nullif(btrim(coalesce(p->>'driveUrl', '')), ''), v_uid
  )
  RETURNING id INTO v_id;
  INSERT INTO public.gc_draw_lines (draw_id, sow_line_id, to_pct, stored)
  SELECT v_id, (l->>'line')::uuid, (l->>'toPct')::numeric, (l->>'stored')::numeric
  FROM jsonb_array_elements(v_money->'lines') l;
  -- What it claims is their report on each line it names, where that changes it.
  INSERT INTO public.gc_sow_line_reports (sow_line_id, pct, reported_on, company_id, recorded_by)
  SELECT (r->>'line')::uuid, (r->>'pct')::numeric, public.app_today(), v_sow.company_id, v_uid
  FROM jsonb_array_elements(v_money->'reported') r
  WHERE (r->>'pct')::numeric IS DISTINCT FROM (
    SELECT x.pct FROM public.gc_sow_line_reports x WHERE x.sow_line_id = (r->>'line')::uuid
    ORDER BY x.seq DESC LIMIT 1
  );
  PERFORM public.gc_keep_promises(v_sow.company_id, 'payApp', v_project, p_package_id, public.app_today());
  RETURN v_id;
END;
$$;

-- Approve a pay application as asked (approveDraw). The lines it claims are billed. The retainage release is
-- approved at closeout (U6c). The papers that hold an approval (partnerBlockers) are the window's, as the prototype's
-- reducer trusts its screen.
CREATE OR REPLACE FUNCTION public.gc_approve_draw(p_draw_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_draws%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot approve a pay application.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot approve a pay application.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pay application with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.status <> 'requested' THEN
    RAISE EXCEPTION 'Only a pay application waiting on us is approved.' USING ERRCODE = 'P0001';
  END IF;
  IF v.final THEN
    RAISE EXCEPTION 'The retainage release is approved at closeout.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_draws SET status = 'approved', approved_on = public.app_today() WHERE id = p_draw_id;
  RETURN public.app_today();
END;
$$;

-- Approve a pay application for less than it asks (approveDrawLess, the owner, 2026-10-02): the percent we approve on
-- each line we doubt (by the kernels' line ids), never above what they asked; the stored materials as asked. It pays
-- as approved, and the draw keeps what they asked. The rest of their reported work stays theirs to ask for.
CREATE OR REPLACE FUNCTION public.gc_approve_draw_less(p_draw_id uuid, p_we_approve jsonb, p_note text)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_draws%ROWTYPE;
  v_note text := btrim(coalesce(p_note, ''));
  v_approve jsonb := '{}'::jsonb;
  v_item record;
  v_line uuid;
  v_claim jsonb;
  v_money jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot approve a pay application.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot approve a pay application.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pay application with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.status <> 'requested' THEN
    RAISE EXCEPTION 'Only a pay application waiting on us is approved.' USING ERRCODE = 'P0001';
  END IF;
  IF v.final THEN
    RAISE EXCEPTION 'The retainage release is approved at closeout.' USING ERRCODE = 'P0001';
  END IF;
  IF v_note = '' THEN
    RAISE EXCEPTION 'Say why we approve less.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_we_approve) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Give the percent we approve on each line we doubt.' USING ERRCODE = 'P0001';
  END IF;
  FOR v_item IN SELECT key, value FROM jsonb_each(p_we_approve) LOOP
    IF jsonb_typeof(v_item.value) IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Give the percent we approve on each line we doubt.' USING ERRCODE = 'P0001';
    END IF;
    BEGIN
      v_line := public.gc_sow_line_of(v.sow_id, v_item.key::uuid);
    EXCEPTION WHEN invalid_text_representation THEN
      v_line := NULL;
    END;
    IF v_line IS NULL OR NOT EXISTS (SELECT 1 FROM public.gc_draw_lines WHERE draw_id = p_draw_id AND sow_line_id = v_line) THEN
      RAISE EXCEPTION 'Approve less only on a line this pay application claims.' USING ERRCODE = 'P0001';
    END IF;
    v_approve := v_approve || jsonb_build_object(v_line::text, v_item.value);
  END LOOP;
  -- The asked lines, each at the lesser of what they asked and what we approve, the stored materials as asked.
  v_claim := coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'line', dl.sow_line_id,
      'toPct', least(dl.to_pct, coalesce((v_approve->>dl.sow_line_id::text)::numeric, dl.to_pct)),
      'stored', dl.stored))
    FROM public.gc_draw_lines dl WHERE dl.draw_id = p_draw_id
  ), '[]'::jsonb);
  v_money := public.gc_draw_money(v.sow_id, v.number, v_claim);
  IF (v_money->>'net')::numeric >= v.net THEN
    RAISE EXCEPTION 'That is not less than they asked. Approve it as it is.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_draws SET
    status = 'approved',
    approved_on = public.app_today(),
    asked = jsonb_build_object(
      'gross', v.gross, 'retainage', v.retainage, 'net', v.net,
      'lines', coalesce((SELECT jsonb_agg(jsonb_build_object('line', dl.sow_line_id, 'toPct', dl.to_pct, 'stored', dl.stored) ORDER BY l.position)
                         FROM public.gc_draw_lines dl JOIN public.gc_sow_lines l ON l.id = dl.sow_line_id WHERE dl.draw_id = p_draw_id), '[]'::jsonb),
      'note', v_note, 'on', public.app_today()),
    gross = (v_money->>'gross')::numeric,
    retainage = (v_money->>'retainage')::numeric,
    net = (v_money->>'net')::numeric
  WHERE id = p_draw_id;
  DELETE FROM public.gc_draw_lines WHERE draw_id = p_draw_id;
  INSERT INTO public.gc_draw_lines (draw_id, sow_line_id, to_pct, stored)
  SELECT p_draw_id, (l->>'line')::uuid, (l->>'toPct')::numeric, (l->>'stored')::numeric
  FROM jsonb_array_elements(v_money->'lines') l;
  RETURN public.app_today();
END;
$$;

-- Send a pay application back to be fixed (sendDrawBack): what to fix, and the percent we see on each line we doubt
-- (by the kernels' line ids), kept where it is less than they asked. It stays as it went, and their resend takes the
-- same number. Their report and what is billed stay as they were.
CREATE OR REPLACE FUNCTION public.gc_send_draw_back(p_draw_id uuid, p_we_see jsonb, p_note text)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_draws%ROWTYPE;
  v_note text := btrim(coalesce(p_note, ''));
  v_item record;
  v_line uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot send a pay application back.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot send a pay application back.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pay application with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.status <> 'requested' THEN
    RAISE EXCEPTION 'Only a pay application waiting on us goes back.' USING ERRCODE = 'P0001';
  END IF;
  IF v_note = '' THEN
    RAISE EXCEPTION 'Say what to fix.' USING ERRCODE = 'P0001';
  END IF;
  IF p_we_see IS NOT NULL AND jsonb_typeof(p_we_see) <> 'object' THEN
    RAISE EXCEPTION 'Give the percent we see on each line we doubt.' USING ERRCODE = 'P0001';
  END IF;
  FOR v_item IN SELECT key, value FROM jsonb_each(coalesce(p_we_see, '{}'::jsonb)) LOOP
    IF jsonb_typeof(v_item.value) IS DISTINCT FROM 'number' OR (v_item.value)::text::numeric < 0 OR (v_item.value)::text::numeric > 100 THEN
      RAISE EXCEPTION 'Give the percent we see on each line we doubt.' USING ERRCODE = 'P0001';
    END IF;
    BEGIN
      v_line := public.gc_sow_line_of(v.sow_id, v_item.key::uuid);
    EXCEPTION WHEN invalid_text_representation THEN
      v_line := NULL;
    END;
    IF v_line IS NULL OR NOT EXISTS (SELECT 1 FROM public.gc_draw_lines WHERE draw_id = p_draw_id AND sow_line_id = v_line) THEN
      RAISE EXCEPTION 'Mark only the lines this pay application claims.' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.gc_draw_lines SET we_see = (v_item.value)::text::numeric
    WHERE draw_id = p_draw_id AND sow_line_id = v_line AND (v_item.value)::text::numeric < to_pct;
  END LOOP;
  UPDATE public.gc_draws SET status = 'sent_back', sent_back_on = public.app_today(), sent_back_note = v_note WHERE id = p_draw_id;
  RETURN public.app_today();
END;
$$;

-- Mark an approved draw paid (payDraw). The unconditional waiver is owed from then.
CREATE OR REPLACE FUNCTION public.gc_pay_draw(p_draw_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_draws%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot mark a draw paid.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot mark a draw paid.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pay application with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.status <> 'approved' THEN
    RAISE EXCEPTION 'Only an approved draw is marked paid.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_draws SET status = 'paid', paid_on = public.app_today() WHERE id = p_draw_id;
  RETURN public.app_today();
END;
$$;

-- The trade's unconditional waiver is in for a paid draw. When it was the last paper owed, the promise of their
-- closeout papers is kept (buildingPromisesKeptBy, tradeSignUnconditional): no waiver owed any more, and no final pay
-- application owed either, unless the open promise asked for the waivers alone. Shared by the office's press and
-- the trade's, after each has checked who may. Null: no paid draw owed that waiver.
CREATE OR REPLACE FUNCTION public.gc_draw_waiver_signed(p_draw_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sow public.gc_sows%ROWTYPE;
  v_project uuid;
  v_billed boolean;
  v_held numeric;
  v_final_owed boolean;
  v_open text;
BEGIN
  UPDATE public.gc_draws SET waiver = 'unconditional', waiver_on = public.app_today()
  WHERE id = p_draw_id AND status = 'paid' AND waiver = 'conditional';
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  SELECT s.* INTO v_sow FROM public.gc_sows s JOIN public.gc_draws d ON d.sow_id = s.id WHERE d.id = p_draw_id;
  SELECT project_id INTO v_project FROM public.gc_trade_packages WHERE id = v_sow.package_id;
  IF EXISTS (SELECT 1 FROM public.gc_draws WHERE sow_id = v_sow.id AND status = 'paid' AND waiver = 'conditional') THEN
    RETURN public.app_today();
  END IF;
  -- The final pay application is owed once every line is billed, the work is accepted, retainage is held, and no
  -- draw waits on us and no release went (tradeCloseout's canAskFinal).
  SELECT bool_and(coalesce(b.pct, 0) >= 100) AND count(*) > 0 INTO v_billed
  FROM public.gc_sow_lines l
  LEFT JOIN LATERAL (
    SELECT max(dl.to_pct) AS pct FROM public.gc_draw_lines dl JOIN public.gc_draws d ON d.id = dl.draw_id
    WHERE dl.sow_line_id = l.id AND d.status IN ('approved', 'paid') AND NOT d.final
  ) b ON true
  WHERE l.sow_id = v_sow.id;
  SELECT coalesce(sum(retainage) FILTER (WHERE NOT final AND status IN ('approved', 'paid')), 0)
       - coalesce(sum(net) FILTER (WHERE final AND status = 'paid'), 0)
  INTO v_held FROM public.gc_draws WHERE sow_id = v_sow.id;
  v_final_owed := coalesce(v_billed, false) AND v_sow.accepted_on IS NOT NULL AND v_held > 0
    AND NOT EXISTS (SELECT 1 FROM public.gc_draws WHERE sow_id = v_sow.id AND status <> 'sent_back' AND (final OR status = 'requested'));
  SELECT what INTO v_open FROM public.gc_trade_promises
  WHERE kept_on IS NULL AND kind = 'closeout' AND company_id = v_sow.company_id AND project_id = v_project AND package_id = v_sow.package_id;
  IF v_final_owed AND (v_open IS NULL OR v_open ~* 'final pay application') THEN
    RETURN public.app_today();
  END IF;
  PERFORM public.gc_keep_promises(v_sow.company_id, 'closeout', v_project, v_sow.package_id, public.app_today());
  RETURN public.app_today();
END;
$$;

-- An unconditional waiver that came in by email or on paper, for a paid draw (new beside the prototype, where only
-- the portal signed one).
CREATE OR REPLACE FUNCTION public.gc_draw_waiver_in(p_draw_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_draws%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record a waiver.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record a waiver.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pay application with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.status <> 'paid' THEN
    RAISE EXCEPTION 'The unconditional waiver comes after we pay the draw.' USING ERRCODE = 'P0001';
  END IF;
  IF v.waiver = 'unconditional' THEN
    RAISE EXCEPTION 'Their unconditional waiver is in already.' USING ERRCODE = 'P0001';
  END IF;
  RETURN public.gc_draw_waiver_signed(p_draw_id);
END;
$$;

-- Take a back-charge off a draw (takeBackCharge): one they agreed to, we kept after a dispute, or they never answered
-- by its day, off a draw we approved and have not paid, that pays at least the charge after the charges already on it.
CREATE OR REPLACE FUNCTION public.gc_take_back_charge(p_charge_id uuid, p_draw_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  c public.gc_back_charges%ROWTYPE;
  d public.gc_draws%ROWTYPE;
  v_taken integer;
  v_left numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot take a back-charge off a draw.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot take a back-charge off a draw.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO c FROM public.gc_back_charges WHERE id = p_charge_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No back-charge with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF c.taken_draw_id IS NOT NULL THEN
    SELECT number INTO v_taken FROM public.gc_draws WHERE id = c.taken_draw_id;
    RAISE EXCEPTION 'That charge came off draw % already.', v_taken USING ERRCODE = 'P0001';
  END IF;
  IF c.status = 'dropped' THEN
    RAISE EXCEPTION 'That charge was dropped.' USING ERRCODE = 'P0001';
  END IF;
  IF c.status = 'disputed' THEN
    RAISE EXCEPTION 'They disputed that charge. Keep it or drop it first.' USING ERRCODE = 'P0001';
  END IF;
  IF c.status = 'open' AND public.app_today() <= c.answer_by THEN
    RAISE EXCEPTION 'They have until % to answer that charge.', to_char(c.answer_by, 'Mon FMDD') USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO d FROM public.gc_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND OR d.sow_id <> c.sow_id THEN
    RAISE EXCEPTION 'Take a charge off a draw on the same statement of work.' USING ERRCODE = 'P0001';
  END IF;
  IF d.status <> 'approved' THEN
    RAISE EXCEPTION 'Take a charge off a draw we approved and have not paid.' USING ERRCODE = 'P0001';
  END IF;
  SELECT d.net - coalesce(sum(amount), 0) INTO v_left FROM public.gc_back_charges WHERE taken_draw_id = p_draw_id;
  IF v_left < c.amount THEN
    RAISE EXCEPTION 'That draw pays less than the charge.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_back_charges SET taken_draw_id = p_draw_id, taken_on = public.app_today() WHERE id = p_charge_id;
  RETURN public.app_today();
END;
$$;

-- Send a signed change order to the trade it belongs to, as a change to its statement of work (sendTradeChange), for
-- what the change costs us. Not our own work, and only once.
CREATE OR REPLACE FUNCTION public.gc_send_trade_change(p_change_order_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  co public.gc_change_orders%ROWTYPE;
  v_ours boolean;
  v_sow public.gc_sows%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot send a change to a trade.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot send a change to a trade.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO co FROM public.gc_change_orders WHERE id = p_change_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No change order with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF co.status <> 'signed' THEN
    RAISE EXCEPTION 'Only a change order the customer signed goes to the trade.' USING ERRCODE = 'P0001';
  END IF;
  SELECT ours INTO v_ours FROM public.gc_trade_packages WHERE id = co.package_id;
  IF co.package_id IS NULL OR v_ours THEN
    RAISE EXCEPTION 'This change is our own work. It goes to no trade.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = co.package_id;
  IF NOT FOUND OR v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'Their statement of work is not signed yet.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_change_order_trade_sends WHERE change_order_id = p_change_order_id) THEN
    RAISE EXCEPTION 'It went to them already.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.gc_change_order_trade_sends (change_order_id, sow_id, sent_on, sent_by)
  VALUES (p_change_order_id, v_sow.id, public.app_today(), v_uid);
  RETURN public.app_today();
END;
$$;

-- A trade reports a line of its statement of work from its portal (tradeReport): never below what is billed. A line
-- split into parts is reported a part at a time (G-39, the schedule's PR 16 with the Portal's P5d). On a job being
-- built, the report sets the line's real days on the schedule where none is recorded (withReportedActuals, G-55):
-- the first report over 0% its start, 100% its finish, today. Real days are records the schedule's guard lets pass.
CREATE OR REPLACE FUNCTION public.gc_trade_sow_report(p_company_id uuid, p_package_id uuid, p_line uuid, p_pct numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_project uuid;
  v_stage text;
  v_sow public.gc_sows%ROWTYPE;
  v_line public.gc_sow_lines%ROWTYPE;
  v_billed numeric;
  v_pct numeric;
BEGIN
  SELECT k.project_id, g.stage INTO v_project, v_stage
  FROM public.gc_trade_packages k JOIN public.gc_projects g ON g.project_id = k.project_id
  WHERE k.id = p_package_id;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id;
  IF v_project IS NULL OR v_sow.id IS NULL THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No statement of work for that trade.';
  END IF;
  IF v_sow.company_id IS DISTINCT FROM p_company_id
     OR NOT EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = p_package_id AND awarded_invite_id = v_sow.invite_id) THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company we awarded this trade can report its work.';
  END IF;
  IF v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'sowNotSigned' USING ERRCODE = 'P0001', DETAIL = 'Sign your statement of work first.';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'jobNotBuilding' USING ERRCODE = 'P0001', DETAIL = 'Reports open once we are building the job.';
  END IF;
  SELECT * INTO v_line FROM public.gc_sow_lines WHERE id = public.gc_sow_line_of(v_sow.id, p_line);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'That line is not on your statement of work.';
  END IF;
  IF p_pct IS NULL THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'Say the percent done.';
  END IF;
  IF v_line.scope_item_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.gc_schedule_activities a JOIN public.gc_schedule_activity_parts pt ON pt.activity_id = a.id
    WHERE a.project_id = v_project AND a.kind = 'line' AND a.scope_item_id = v_line.scope_item_id
  ) THEN
    RAISE EXCEPTION 'splitLine' USING ERRCODE = 'P0001', DETAIL = 'This line is split into parts. Report each part.';
  END IF;
  SELECT coalesce(max(dl.to_pct), 0) INTO v_billed
  FROM public.gc_draw_lines dl JOIN public.gc_draws d ON d.id = dl.draw_id
  WHERE dl.sow_line_id = v_line.id AND d.status IN ('approved', 'paid') AND NOT d.final;
  v_pct := greatest(v_billed, least(100, greatest(0, p_pct)));
  INSERT INTO public.gc_sow_line_reports (sow_line_id, pct, reported_on, company_id, recorded_by)
  VALUES (v_line.id, v_pct, public.app_today(), p_company_id, NULL);
  IF v_line.scope_item_id IS NOT NULL AND v_pct > 0 THEN
    UPDATE public.gc_schedule_activities SET
      actual_start = coalesce(actual_start, public.app_today()),
      actual_finish = CASE WHEN v_pct >= 100 THEN coalesce(actual_finish, public.app_today()) ELSE actual_finish END
    WHERE project_id = v_project AND kind = 'line' AND scope_item_id = v_line.scope_item_id
      AND (actual_start IS NULL OR (v_pct >= 100 AND actual_finish IS NULL));
  END IF;
  RETURN v_pct;
END;
$$;

-- A trade sends a pay application from its portal (tradeSendPayApp): what it claims on each line by the kernels' line
-- ids, the day it runs to, the address and license it prints, and who signs it, with the conditional waiver. Its
-- money is worked out here. What it claims is their report on each line it names, even lower than before (a resend
-- after we sent one back). It keeps their promise of a pay application.
CREATE OR REPLACE FUNCTION public.gc_trade_pay_app(p_company_id uuid, p_package_id uuid, p_app jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_project uuid;
  v_stage text;
  v_sow public.gc_sows%ROWTYPE;
  v_claim jsonb;
  v_period date;
  v_signed_by text := btrim(coalesce(p_app->>'signedBy', ''));
  v_number integer;
  v_money jsonb;
  v_id uuid;
BEGIN
  SELECT k.project_id, g.stage INTO v_project, v_stage
  FROM public.gc_trade_packages k JOIN public.gc_projects g ON g.project_id = k.project_id
  WHERE k.id = p_package_id;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id FOR UPDATE;
  IF v_project IS NULL OR v_sow.id IS NULL THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No statement of work for that trade.';
  END IF;
  IF v_sow.company_id IS DISTINCT FROM p_company_id
     OR NOT EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = p_package_id AND awarded_invite_id = v_sow.invite_id) THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company we awarded this trade can send its pay application.';
  END IF;
  IF v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'sowNotSigned' USING ERRCODE = 'P0001', DETAIL = 'Sign your statement of work first.';
  END IF;
  IF v_stage <> 'building' THEN
    RAISE EXCEPTION 'jobNotBuilding' USING ERRCODE = 'P0001', DETAIL = 'Pay applications open once we are building the job.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_draws WHERE sow_id = v_sow.id AND status = 'requested') THEN
    RAISE EXCEPTION 'drawWaiting' USING ERRCODE = 'P0001', DETAIL = 'Your last pay application is still with us.';
  END IF;
  v_claim := public.gc_draw_claim(v_sow.id, p_app->'lines');
  BEGIN
    v_period := nullif(btrim(coalesce(p_app->>'periodTo', '')), '')::date;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    v_period := NULL;
  END;
  IF v_claim IS NULL OR v_period IS NULL THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'Each line needs its percent done. The pay application needs its period.';
  END IF;
  IF v_signed_by = '' THEN
    RAISE EXCEPTION 'nameNeeded' USING ERRCODE = 'P0001', DETAIL = 'Type the name of who signs it.';
  END IF;

  SELECT count(*) + 1 INTO v_number FROM public.gc_draws WHERE sow_id = v_sow.id AND status <> 'sent_back';
  v_money := public.gc_draw_money(v_sow.id, v_number, v_claim);
  IF (v_money->>'gross')::numeric <= 0 THEN
    RAISE EXCEPTION 'nothingToBill' USING ERRCODE = 'P0001', DETAIL = 'No work is new since your last pay application.';
  END IF;

  -- Nobody of ours typed it in: the trade's portal did (recorded_by null).
  INSERT INTO public.gc_draws (sow_id, number, requested_on, gross, retainage, net, period_to, address, license, signed_by, signed_title, signed_on, recorded_by)
  VALUES (
    v_sow.id, v_number, public.app_today(),
    (v_money->>'gross')::numeric, (v_money->>'retainage')::numeric, (v_money->>'net')::numeric,
    v_period, btrim(coalesce(p_app->>'address', '')), btrim(coalesce(p_app->>'license', '')), v_signed_by,
    btrim(coalesce(p_app->>'signedTitle', '')), public.app_today(), NULL
  )
  RETURNING id INTO v_id;
  INSERT INTO public.gc_draw_lines (draw_id, sow_line_id, to_pct, stored)
  SELECT v_id, (l->>'line')::uuid, (l->>'toPct')::numeric, (l->>'stored')::numeric
  FROM jsonb_array_elements(v_money->'lines') l;
  INSERT INTO public.gc_sow_line_reports (sow_line_id, pct, reported_on, company_id, recorded_by)
  SELECT (r->>'line')::uuid, (r->>'pct')::numeric, public.app_today(), p_company_id, NULL
  FROM jsonb_array_elements(v_money->'reported') r
  WHERE (r->>'pct')::numeric IS DISTINCT FROM (
    SELECT x.pct FROM public.gc_sow_line_reports x WHERE x.sow_line_id = (r->>'line')::uuid
    ORDER BY x.seq DESC LIMIT 1
  );
  PERFORM public.gc_keep_promises(p_company_id, 'payApp', v_project, p_package_id, public.app_today());
  RETURN v_id;
END;
$$;

-- A trade signs the unconditional waiver for a draw we paid, from its portal (tradeSignUnconditional).
CREATE OR REPLACE FUNCTION public.gc_trade_unconditional_waiver(p_company_id uuid, p_draw_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_draws%ROWTYPE;
  v_company uuid;
BEGIN
  SELECT * INTO v FROM public.gc_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No pay application with that id.';
  END IF;
  SELECT company_id INTO v_company FROM public.gc_sows WHERE id = v.sow_id;
  IF v_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company on this statement of work signs its waivers.';
  END IF;
  IF v.status <> 'paid' THEN
    RAISE EXCEPTION 'notPaidYet' USING ERRCODE = 'P0001', DETAIL = 'The unconditional waiver comes after we pay the draw.';
  END IF;
  IF v.waiver = 'unconditional' THEN
    RAISE EXCEPTION 'alreadySigned' USING ERRCODE = 'P0001', DETAIL = 'You signed it already.';
  END IF;
  RETURN public.gc_draw_waiver_signed(p_draw_id);
END;
$$;

-- A trade signs a change we sent it, from its portal (tradeSignChange): the change becomes a line of its statement of
-- work, for what it costs us, reported and drawn on like any other. A credit counts as done at once, so it comes off
-- their next draw. Returns the new line.
CREATE OR REPLACE FUNCTION public.gc_trade_sign_change(p_company_id uuid, p_change_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_send public.gc_change_order_trade_sends%ROWTYPE;
  v_sow public.gc_sows%ROWTYPE;
  co public.gc_change_orders%ROWTYPE;
  v_line uuid;
BEGIN
  SELECT * INTO v_send FROM public.gc_change_order_trade_sends WHERE change_order_id = p_change_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No change was sent to you with that id.';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE id = v_send.sow_id;
  IF v_sow.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company on this statement of work signs its changes.';
  END IF;
  IF v_send.signed_on IS NOT NULL THEN
    RAISE EXCEPTION 'alreadySigned' USING ERRCODE = 'P0001', DETAIL = 'You signed it already.';
  END IF;
  SELECT * INTO co FROM public.gc_change_orders WHERE id = p_change_order_id;
  INSERT INTO public.gc_sow_lines (sow_id, position, label, amount, change_order_id)
  VALUES (
    v_sow.id,
    (SELECT coalesce(max(position), -1) + 1 FROM public.gc_sow_lines WHERE sow_id = v_sow.id),
    'Change order ' || co.number || ': ' || co.description,
    co.cost,
    co.id
  )
  RETURNING id INTO v_line;
  IF co.cost < 0 THEN
    INSERT INTO public.gc_sow_line_reports (sow_line_id, pct, reported_on, company_id, recorded_by)
    VALUES (v_line, 100, public.app_today(), p_company_id, NULL);
  END IF;
  UPDATE public.gc_change_order_trade_sends SET signed_on = public.app_today(), sow_line_id = v_line WHERE change_order_id = p_change_order_id;
  RETURN v_line;
END;
$$;

COMMENT ON FUNCTION public.gc_sow_line_of(uuid, uuid) IS
  'GC mode (v2.5084, Building U6a): a statement of work''s line by the kernels'' id (SovLine.id: its scope item, or its own id on a change order''s line). Null: not a line of it.';
COMMENT ON FUNCTION public.gc_draw_claim(uuid, jsonb) IS
  'GC mode (v2.5084, Building U6a): a pay application''s claim as the window or the portal sends it, by the kernels'' line ids, read into the statement of work''s lines, each once. Null: a line not on it, or a percent that is not a number.';
COMMENT ON FUNCTION public.gc_draw_money(uuid, integer, jsonb) IS
  'GC mode (v2.5084, Building U6a): a pay application''s money by the kernels'' rules (payApplication, drawMoney): each line clamped between what an earlier draw that stands billed and 100, stored materials up to what the line has left, the work this period plus the change in what is stored, less the retainage. Keeps each line that moved or holds stored materials. supabase/tests/gc_building/60_draws.sql holds it to the kernel.';
COMMENT ON FUNCTION public.gc_draw_came_in(uuid, jsonb) IS
  'GC mode (v2.5084): record a trade''s pay application that came by email or on paper, by the trade''s own rules, with its Drive link; its claim is their report, and it keeps their pay application promise. Refuses a training account, a digital twin, a job not being built, a statement of work not signed, one already waiting, a line not on it, no period, no signer, and nothing to pay. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_approve_draw(uuid) IS
  'GC mode (v2.5084): approve a pay application waiting on us as asked (approveDraw); the lines it claims are billed. Not the retainage release (U6c). SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_approve_draw_less(uuid, jsonb, text) IS
  'GC mode (v2.5084): approve a pay application for less (approveDrawLess): the percent we approve on each line we doubt, with why; the draw keeps what they asked. Refuses one not less than asked. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_send_draw_back(uuid, jsonb, text) IS
  'GC mode (v2.5084): send a pay application back (sendDrawBack) with what to fix and the percent we see on each line we doubt; it stays as it went, and the resend takes its number. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_pay_draw(uuid) IS
  'GC mode (v2.5084): mark an approved draw paid (payDraw). SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_draw_waiver_signed(uuid) IS
  'GC mode (v2.5084): the unconditional waiver is in for a paid draw, and the promise of the closeout papers is kept when it was the last paper owed (tradeSignUnconditional''s rule). Called by gc_draw_waiver_in and gc_trade_unconditional_waiver after their checks. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_draw_waiver_in(uuid) IS
  'GC mode (v2.5084): record a trade''s unconditional waiver that came by email or on paper, for a paid draw. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_take_back_charge(uuid, uuid) IS
  'GC mode (v2.5084): take a back-charge off an approved, unpaid draw on the same statement of work (takeBackCharge): agreed, kept, or never answered by its day, and no more than the draw pays after the charges on it. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_send_trade_change(uuid) IS
  'GC mode (v2.5084): send a signed change order to its trade as a change to the statement of work (sendTradeChange), once, for a trade we hire with a signed statement of work. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_trade_sow_report(uuid, uuid, uuid, numeric) IS
  'GC mode (v2.5084): a trade''s report on a line of its signed statement of work (tradeReport), never below billed, and the line''s real days on the schedule where none is recorded: notFound, notOnTrade, sowNotSigned, jobNotBuilding, badRequest, splitLine. Service role only.';
COMMENT ON FUNCTION public.gc_trade_pay_app(uuid, uuid, jsonb) IS
  'GC mode (v2.5084): a trade''s pay application from its portal (tradeSendPayApp), its money worked out here, its claim their report: notFound, notOnTrade, sowNotSigned, jobNotBuilding, drawWaiting, badRequest, nameNeeded, nothingToBill. Service role only.';
COMMENT ON FUNCTION public.gc_trade_unconditional_waiver(uuid, uuid) IS
  'GC mode (v2.5084): a trade signs the unconditional waiver for a paid draw (tradeSignUnconditional): notFound, notOnTrade, notPaidYet, alreadySigned. Service role only.';
COMMENT ON FUNCTION public.gc_trade_sign_change(uuid, uuid) IS
  'GC mode (v2.5084): a trade signs a change we sent it into a line of its statement of work (tradeSignChange); a credit counts as done: notFound, notOnTrade, alreadySigned. Service role only.';

REVOKE ALL ON FUNCTION public.gc_sow_line_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_sow_line_of(uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gc_draw_claim(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_draw_claim(uuid, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gc_draw_money(uuid, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_draw_money(uuid, integer, jsonb) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.gc_draw_waiver_signed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_draw_waiver_signed(uuid) TO authenticated, service_role;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.gc_draw_came_in(uuid, jsonb)', 'public.gc_approve_draw(uuid)', 'public.gc_approve_draw_less(uuid, jsonb, text)',
    'public.gc_send_draw_back(uuid, jsonb, text)', 'public.gc_pay_draw(uuid)', 'public.gc_draw_waiver_in(uuid)',
    'public.gc_take_back_charge(uuid, uuid)', 'public.gc_send_trade_change(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
  -- Only the service role: the portal's submit function, after it has turned a link into its company.
  FOREACH f IN ARRAY ARRAY['public.gc_trade_sow_report(uuid, uuid, uuid, numeric)', 'public.gc_trade_pay_app(uuid, uuid, jsonb)',
    'public.gc_trade_unconditional_waiver(uuid, uuid)', 'public.gc_trade_sign_change(uuid, uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
