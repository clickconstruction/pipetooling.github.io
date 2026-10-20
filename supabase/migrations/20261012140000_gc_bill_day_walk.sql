SET lock_timeout = '3s';

-- GC mode, Messages cut 9 (v2.5265, wave 2's SQL for cluster 7): Bill day's walk and its two records. The superintendent
-- walks the claims of the draws waiting on us and taps what she sees on each line (gc_superintendent_checks); the
-- newest tap on a line under its claim is the line's we_see, the way the Draws window reads a doubted line. A trade
-- that sends nothing this period is recorded with who said it (gc_bill_day_nothing), never typed over a draw. The
-- cut-off, the days before bill day the trades' pay applications are due, is one setting for every job
-- (app_settings 'gc_bill_day_cutoff_days', 6). Where a line is on site orders the walk (gc_sow_lines.where_on_site).
-- The kernels that read them are src/lib/gc/billDay/ (v2.5248): LineCheck is a check's row, NothingThisPeriod a
-- nothing's, BILL_DAY_CUTOFF_DAYS the setting's default. Plan: to-dos/gc-mode/messages/BUILD_PLAN.md, cut 9, on
-- spike/gc-mode. Dev only while it is built, as every Building table is; the money team reads both tables (O9's
-- rule) and sets the cut-off. The walk informs and the office approves: a check never approves a line (decision 8).
-- Additive and idempotent. Draws: 20261010021000. Statements of work: 20261009140000.

-- Where a line of a statement of work is on site, as the walk names it: Site, Yard, Level 1. Null: the site.
ALTER TABLE public.gc_sow_lines ADD COLUMN IF NOT EXISTS where_on_site text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_sow_lines_where_said') THEN
    ALTER TABLE public.gc_sow_lines ADD CONSTRAINT gc_sow_lines_where_said CHECK (where_on_site IS NULL OR btrim(where_on_site) <> '');
  END IF;
END $$;
COMMENT ON COLUMN public.gc_sow_lines.where_on_site IS
  'GC mode (v2.5265, Messages cut 9): where the line is on site, for the order the superintendent walks the claims in (WALK_PLACES in src/lib/gc/billDay/walk.ts, then any other place). Null: the site.';

-- One tap on one line of a draw waiting on us: the percent in place she sees, or whether the stored material is on
-- site, with a photo's Drive link (decision 6: a link, never a copy) and a note. Each tap is kept as it went, with who
-- and when; a later tap on the same line is the one that counts.
CREATE TABLE IF NOT EXISTS public.gc_superintendent_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id uuid NOT NULL,
  sow_line_id uuid NOT NULL,
  we_see_pct numeric
    CONSTRAINT gc_superintendent_checks_pct_range CHECK (we_see_pct IS NULL OR (we_see_pct >= 0 AND we_see_pct <= 100)),
  stored_on_site boolean,
  photo_url text
    CONSTRAINT gc_superintendent_checks_photo_linked CHECK (photo_url IS NULL OR btrim(photo_url) <> ''),
  note text NOT NULL DEFAULT '',
  checked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  -- The order taps were made: the newest on a line wins, whatever the clock says.
  seq bigint GENERATED ALWAYS AS IDENTITY,
  CONSTRAINT gc_superintendent_checks_one_reading CHECK ((we_see_pct IS NULL) <> (stored_on_site IS NULL)),
  -- Only a line the draw claims is checked, and the checks go with the draw.
  CONSTRAINT gc_superintendent_checks_on_a_claim FOREIGN KEY (draw_id, sow_line_id)
    REFERENCES public.gc_draw_lines (draw_id, sow_line_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.gc_superintendent_checks IS
  'GC mode (v2.5265, Messages cut 9): the superintendent''s walk of the draws waiting on us (LineCheck in src/lib/gc/billDay/walk.ts): per draw line per tap, the percent in place she sees (we_see_pct) or whether the stored material is on site (stored_on_site), a photo''s Drive link and a note, with who and when. The newest tap under a line''s claim is the line''s we_see (gc_record_line_check). Written by gc_record_line_check only; kept as it went. Dev only while it is built; the money team reads it.';

CREATE INDEX IF NOT EXISTS gc_superintendent_checks_line_idx ON public.gc_superintendent_checks (draw_id, sow_line_id, seq DESC);
CREATE INDEX IF NOT EXISTS gc_superintendent_checks_by_idx ON public.gc_superintendent_checks (checked_by);

-- A trade said it sends nothing for a bill day (Nothing this period): who said it, in words, and who of ours wrote it
-- down. The trade can still send a draw before bill day; the row matters only while it is not in.
CREATE TABLE IF NOT EXISTS public.gc_bill_day_nothing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sow_id uuid NOT NULL REFERENCES public.gc_sows(id) ON DELETE CASCADE,
  -- The bill day it is for.
  period_to date NOT NULL,
  said_by text NOT NULL
    CONSTRAINT gc_bill_day_nothing_said CHECK (btrim(said_by) <> ''),
  recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  said_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gc_bill_day_nothing_once UNIQUE (sow_id, period_to)
);

COMMENT ON TABLE public.gc_bill_day_nothing IS
  'GC mode (v2.5265, Messages cut 9): a trade that sends nothing for a bill day (NothingThisPeriod in src/lib/gc/billDay/trades.ts), with who said it and who of ours recorded it. Bill day counts the trade as in while it is not in. Written by gc_say_nothing_this_period; Put it back deletes the row. Dev only while it is built; the money team reads it.';

CREATE INDEX IF NOT EXISTS gc_bill_day_nothing_by_idx ON public.gc_bill_day_nothing (recorded_by);

ALTER TABLE public.gc_superintendent_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_bill_day_nothing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gc_superintendent_checks_dev ON public.gc_superintendent_checks;
CREATE POLICY gc_superintendent_checks_dev ON public.gc_superintendent_checks FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_superintendent_checks_money_read ON public.gc_superintendent_checks;
CREATE POLICY gc_superintendent_checks_money_read ON public.gc_superintendent_checks FOR SELECT TO authenticated USING ((SELECT public.gc_money_team()));
DROP POLICY IF EXISTS gc_bill_day_nothing_dev ON public.gc_bill_day_nothing;
CREATE POLICY gc_bill_day_nothing_dev ON public.gc_bill_day_nothing FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()));
DROP POLICY IF EXISTS gc_bill_day_nothing_money_read ON public.gc_bill_day_nothing;
CREATE POLICY gc_bill_day_nothing_money_read ON public.gc_bill_day_nothing FOR SELECT TO authenticated USING ((SELECT public.gc_money_team()));

-- Nobody signed out reaches them, and a tap stays as it went.
REVOKE ALL ON TABLE public.gc_superintendent_checks, public.gc_bill_day_nothing FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.gc_superintendent_checks FROM authenticated;

-- The cut-off: the trades' pay applications are due this many days before bill day, one setting for every job.
INSERT INTO public.app_settings (key, value_num)
VALUES ('gc_bill_day_cutoff_days', 6)
ON CONFLICT (key) DO NOTHING;

-- Dev already manages every app_settings row; the money team may set this one (the gc_card_bill_on_v1 pattern).
DROP POLICY IF EXISTS "money_team_update_gc_bill_day_cutoff" ON public.app_settings;
CREATE POLICY "money_team_update_gc_bill_day_cutoff"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'gc_bill_day_cutoff_days' AND public.gc_money_team())
  WITH CHECK (key = 'gc_bill_day_cutoff_days' AND public.gc_money_team());

-- A tap on a line of a draw waiting on us: the percent she sees (p_we_see) or whether the stored material is on site
-- (p_on_site), never both. p_line is the kernels' line id (SovLine.id), as every draws press takes it. A percent under
-- the claim becomes the line's we_see; one at or over the claim clears it, so a line reads doubted only while the
-- newest tap doubts it. A stored-material tap leaves we_see as it was. Returns the check's id.
CREATE OR REPLACE FUNCTION public.gc_record_line_check(
  p_draw_id uuid,
  p_line uuid,
  p_we_see numeric,
  p_on_site boolean,
  p_photo_url text DEFAULT NULL,
  p_note text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_draws%ROWTYPE;
  v_line uuid;
  v_claim public.gc_draw_lines%ROWTYPE;
  v_photo text := nullif(btrim(coalesce(p_photo_url, '')), '');
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record a check.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record a check.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev records a check while Bill day is built.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_draws WHERE id = p_draw_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pay application with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.status <> 'requested' THEN
    RAISE EXCEPTION 'Only a pay application waiting on us is walked.' USING ERRCODE = 'P0001';
  END IF;
  v_line := public.gc_sow_line_of(v.sow_id, p_line);
  SELECT * INTO v_claim FROM public.gc_draw_lines WHERE draw_id = p_draw_id AND sow_line_id = v_line FOR UPDATE;
  IF v_line IS NULL OR NOT FOUND THEN
    RAISE EXCEPTION 'Check only the lines this pay application claims.' USING ERRCODE = 'P0001';
  END IF;
  IF (p_we_see IS NULL) = (p_on_site IS NULL) THEN
    RAISE EXCEPTION 'Give the percent you see, or whether the stored material is on site.' USING ERRCODE = 'P0001';
  END IF;
  IF p_we_see IS NOT NULL AND (p_we_see < 0 OR p_we_see > 100) THEN
    RAISE EXCEPTION 'The percent you see runs from 0 to 100.' USING ERRCODE = 'P0001';
  END IF;
  IF p_on_site IS NOT NULL AND v_claim.stored <= 0 THEN
    RAISE EXCEPTION 'This line claims no stored material.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.gc_superintendent_checks (draw_id, sow_line_id, we_see_pct, stored_on_site, photo_url, note, checked_by)
  VALUES (p_draw_id, v_line, p_we_see, p_on_site, v_photo, btrim(coalesce(p_note, '')), auth.uid())
  RETURNING id INTO v_id;
  IF p_we_see IS NOT NULL THEN
    UPDATE public.gc_draw_lines SET we_see = CASE WHEN p_we_see < to_pct THEN p_we_see END
    WHERE draw_id = p_draw_id AND sow_line_id = v_line;
  END IF;
  RETURN v_id;
END;
$$;

-- Nothing this period: a trade says it sends no draw for a bill day. Saying it again for the same bill day replaces
-- who said it. Put it back is a delete of the row. Returns the row's id.
CREATE OR REPLACE FUNCTION public.gc_say_nothing_this_period(p_sow_id uuid, p_period_to date, p_said_by text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_said text := btrim(coalesce(p_said_by, ''));
  v_status text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record nothing this period.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record nothing this period.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev records nothing this period while Bill day is built.' USING ERRCODE = '42501';
  END IF;
  SELECT status INTO v_status FROM public.gc_sows WHERE id = p_sow_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No statement of work with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_status <> 'signed' THEN
    RAISE EXCEPTION 'Only a signed statement of work draws.' USING ERRCODE = 'P0001';
  END IF;
  IF p_period_to IS NULL THEN
    RAISE EXCEPTION 'Say which bill day.' USING ERRCODE = 'P0001';
  END IF;
  IF v_said = '' THEN
    RAISE EXCEPTION 'Say who said it.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.gc_bill_day_nothing AS n (sow_id, period_to, said_by, recorded_by)
  VALUES (p_sow_id, p_period_to, v_said, auth.uid())
  ON CONFLICT (sow_id, period_to) DO UPDATE SET said_by = EXCLUDED.said_by, recorded_by = EXCLUDED.recorded_by, said_at = now()
  RETURNING n.id INTO v_id;
  RETURN v_id;
END;
$$;

-- The cut-off, in days before bill day: 2 at the least, so the walk keeps a checking day before its last day two days
-- before bill day, and 20 at the most. Returns the days set.
CREATE OR REPLACE FUNCTION public.gc_set_bill_day_cutoff(p_days integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot change the cut-off.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot change the cut-off.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_money_team() THEN
    RAISE EXCEPTION 'Only the money team sets the cut-off.' USING ERRCODE = '42501';
  END IF;
  IF p_days IS NULL OR p_days < 2 OR p_days > 20 THEN
    RAISE EXCEPTION 'The cut-off is 2 to 20 days before bill day.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.app_settings SET value_num = p_days WHERE key = 'gc_bill_day_cutoff_days';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The cut-off setting is missing.' USING ERRCODE = 'P0001';
  END IF;
  RETURN p_days;
END;
$$;

COMMENT ON FUNCTION public.gc_record_line_check(uuid, uuid, numeric, boolean, text, text) IS
  'GC mode (v2.5265, Messages cut 9): one tap of the superintendent''s walk on a line of a draw waiting on us, by the kernels'' line id: the percent she sees or whether the stored material is on site, with a photo link and a note. A percent under the claim becomes the line''s we_see; one at or over it clears we_see. Caller''s rights: dev only while it is built.';
COMMENT ON FUNCTION public.gc_say_nothing_this_period(uuid, date, text) IS
  'GC mode (v2.5265, Messages cut 9): a trade sends nothing for a bill day, with who said it; again for the same bill day replaces who. Caller''s rights: dev only while it is built.';
COMMENT ON FUNCTION public.gc_set_bill_day_cutoff(integer) IS
  'GC mode (v2.5265, Messages cut 9): the days before bill day the trades'' pay applications are due, 2 to 20, one setting for every job (app_settings gc_bill_day_cutoff_days). Caller''s rights: dev and the money team.';

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.gc_record_line_check(uuid, uuid, numeric, boolean, text, text)',
    'public.gc_say_nothing_this_period(uuid, date, text)', 'public.gc_set_bill_day_cutoff(integer)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
