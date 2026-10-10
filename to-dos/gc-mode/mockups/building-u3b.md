---
name: "Building U3b: the daily log's tighter rules and the punch list"
rows: BUILDING_REAL_BUILD.md, The PRs in order, 3 (U3b); decisions 4, 5, 7, 8 and 9; Writing it (gc_save_daily_log, gc_add_punch_item, gc_check_punch_item, gc_trade_punch_fixed); mockups/building-u6.md (U6c's gc_accept_work, U6d's Closeout window)
branch: the plan on claude/gc-building-u3b-plan (from origin/spike/gc-mode at d9f0907a6), merged to the spike by the lead; U3b-i from origin/main once this plan merges, pushed on its merge; U3b-ii on U3b-i's types
status: plan 2026-10-10 by gc 4 (the Building lane) at the lead's ask, with the lead's three calls of the same night written in. U3b-i's SQL ran green on the real gc-building bed (the Supabase Postgres 17.6.1.071 image in Docker, every migration on main at f2f106dd6 applied, then the presses a second time): 20_daily_log.sql's 26 assertions and 80_punch.sql's 44, beside 40_submittals' 50, 50_rfis' 50, 60_draws' 99 and 70_closeout's 53, on two full runs; twelve planted bugs each failed it, and the restored SQL passed again. Nothing is cut or claimed.
---

# Building U3b: the daily log's tighter rules and the punch list

## What it is

The last of U3: the daily log's press holds the prototype's own rules, and the punch list goes onto real data.

- **U3b-i, the presses** (one migration, no client code):
  - `gc_save_daily_log` made again: only our own crew or a trade with a signed statement of work goes on the log
    (`logTrades`), a hired trade's crew on site keeps its start promise, a missing high or low is refused instead of
    saved as 0, and the first day reads *Oct 5*, not *Oct 05*;
  - the punch list's presses on U1's `gc_punch_items`: add an item, take one off (kept, never deleted), the trade's
    *It is fixed* from its portal and the office's twin when the trade says so by phone, then checked fixed or sent
    back;
  - two columns on `gc_punch_items` (`removed_at`, `removed_by`), a check that only an untouched item comes off, and
    no `DELETE` for a signed-in caller;
  - U6c's `gc_accept_work` made again so an item taken off holds nothing up;
  - its SQL bed scenario `supabase/tests/gc_building/80_punch.sql`, `20_daily_log.sql` brought to the new rules, and
    its migration doc; the types PR follows the lead's push.
- **U3b-ii, the window** (no migration): the punch list ported from the prototype's `GcBuildingPunchList`, in its own
  window on a building job's card and under each trade on Closeout; the daily log window's blank temperature; the
  guide *keep a trade's punch list*.

## The calls, as the lead picked them (2026-10-10)

1. **Two PRs**, U3b-i the SQL and U3b-ii the window.
2. **The office's twin, *They say it is fixed*** (`gc_punch_fixed_in`), as U4's and U6's came-in presses are, so the
   whole walk works before the Portal's P5. It runs the trade's own rules (`gc_punch_fixed_ask`) for the company on
   the item's statement of work, in the office's words, and keeps the punch promise the same way.
3. **An item added by mistake can be taken off**, as a kept record (`removed_at`, `removed_by`), never a `DELETE`,
   and only while nothing has been pressed on it: not fixed, not checked, never sent back.
4. **The trade hears with P5.** U3b records the item and the send-back and emails nothing. The Portal's P5 brings the
   trade's half (`GcBuildingPunchForTrade`), its kind on `submit-gc-trade-portal` and any email.

One placement is gc 4's pick, for the lead to change: the punch list has its own window on the card (Building's gate
alone, no money gate, since at the door it is the schedule team's) **and** sits under each trade on Closeout, as the
prototype has it.

## The daily log's tighter rules (U3b-i)

| Rule | U3a-i (today) | U3b-i |
|---|---|---|
| Who goes on the log | Any trade on the job | Our own crew (`gc_trade_packages.ours`), or a trade with a signed statement of work (`gc_sows.status = 'signed'`): `logTrades`. A crew or a delay naming any other is refused |
| The start promise | Not kept | Each hired trade with workers on site keeps its open `start` promise on the log's day (`gc_keep_promises(company, 'start', job, trade, log day)`), the company from its statement of work |
| A missing high or low | Saved as 0 | Refused: *Say the day's high and low.* A number only, never words |
| The first day's words | *Work started Oct 05.* | *Work started Oct 5.* (`'Mon FMDD'`, as U6c's words are) |

Nothing else moves: the day's checks, one log a day, saving again replaces its crews and delays.

## The functions (U3b-i)

`SECURITY INVOKER`, every one, so RLS decides who may: dev only until Building's door, then the schedule's team
(decision 4). The trade's is the service role's only, as the Portal's P2a verbs are.

| Function | The prototype's action | What it writes | What it refuses |
|---|---|---|---|
| `gc_save_daily_log(log)` | `saveDailyLog` | As U3a-i, plus the start promises its crews keep | As U3a-i, plus a trade with no signed statement of work and a missing high or low |
| `gc_add_punch_item(p jsonb)` | `addPunchItem` | The item, after the trade's last, its words tidied, its place and photo link if given; `added_on` is `app_today()` | A training account, a digital twin, a trade not found, a job not being built, our own crew, a statement of work not signed, work accepted, blank words |
| `gc_remove_punch_item(item)` | new (call 3) | `removed_at` now and `removed_by` the caller. The row stays | A training account, a digital twin, an item not found or taken off already, one fixed, checked or sent back |
| `gc_check_punch_item(item, fixed, note)` | `checkPunchItem` | Fixed: `checked_on` today and `checked_by`. Not fixed: `fixed_on` cleared, `sent_back_times` + 1, the note and today | A training account, a digital twin, an item not found, one checked already, one not marked fixed, no answer, not fixed with no words |
| `gc_punch_fixed_ask(item, company)` | `tradeFixPunchItem`'s rules | `fixed_on` today. The last item open on the trade keeps its `punch` promise | Keys: `notFound`, `notOnTrade`, `jobNotBuilding`, `punchNotOpen` |
| `gc_trade_punch_fixed(company, item)` | `tradeFixPunchItem` | Through the shared rules | The shared rules' keys |
| `gc_punch_fixed_in(item)` | new (call 2) | Through the shared rules, for the company on the item's statement of work | A training account, a digital twin, and the shared rules' keys in the office's words |
| `gc_accept_work(trade)` | `acceptWork` (U6c) | As U6c | As U6c, counting no item taken off |

**The promises** (decision 9). A log keeps a hired trade's `start` when its crew is on site, on the log's day, as
`buildingPromisesKeptBy` reads `saveDailyLog`. An item marked fixed keeps the trade's `punch` when no other item on that
trade is still open, as it reads `tradeFixPunchItem`. The office's twin keeps it the same way, since the trade kept its
word either way.

**The record.** `gc_punch_items` takes no `DELETE` or `TRUNCATE` from a signed-in caller, as `gc_weekly_reports` takes
no change. A row leaves only with its job or its trade, by their keys' cascade.

## What the window sends

- **Add to the punch list**: `gc_add_punch_item({ packageId, text, where?, photoUrl? })`.
- **Take it off**: `gc_remove_punch_item(itemId)`.
- **They say it is fixed**: `gc_punch_fixed_in(itemId)`.
- **Checked, it is fixed**: `gc_check_punch_item(itemId, true)`. **Send it back**: `gc_check_punch_item(itemId,
  false, note)`.
- **The trade, from its portal** (the Portal's P5): `submit-gc-trade-portal` kind `punch_fixed` calls
  `gc_trade_punch_fixed(company, itemId)` once it has turned the link into its company.

## The refusals, in plain words

Every sentence the SQL says to a person, read out of the SQL below (each `RAISE EXCEPTION`, each `DETAIL` and each
office mapping) through the repo's own `plainWordsFailures`: **43 sentences, 0 failing**. U3a-i's unchanged ones are
counted again.

| Press | Sentence |
|---|---|
| every office press | *Sign in first.* |
| the log | *A training account cannot write a daily log.* · *A digital twin cannot write a daily log.* · *Which job the log is for is missing.* · *No GC project with that id.* · *The daily log starts once work starts.* · *The log’s day is missing.* · *This page’s day is out of date. Reload it and write the log again.* · *A log is written on its day or after, never before.* · *Work started Oct 5. A log before that day has nothing to say.* · *A trade on this log is not on this job.* |
| the log, new | *Say the day’s high and low.* · *A trade on this log has no signed statement of work. Only those trades and our own crew go on the log.* |
| add | *A training account cannot add to a punch list.* · *A digital twin cannot add to a punch list.* · *No trade with that id.* · *The punch list is for a job we are building.* · *Our own crew has no punch list here. Its work runs on the Pipeline.* · *Their statement of work is not signed yet.* · *We accepted their work already. Anything wrong now is under their warranty.* · *Say what is left to fix.* |
| take off | *A training account cannot take an item off a punch list.* · *A digital twin cannot take an item off a punch list.* · *No punch item with that id.* · *They have worked on this item already. Only an item nothing was done on comes off.* |
| check | *A training account cannot check a punch item.* · *A digital twin cannot check a punch item.* · *It is checked already.* · *Only an item they say is fixed gets checked.* · *Say whether it is fixed.* · *Say what is still wrong.* |
| they say it is fixed | *A training account cannot record a punch item fixed.* · *A digital twin cannot record a punch item fixed.* · *No company is awarded this trade with a signed statement of work.* · *It is marked fixed already. Check it.* |
| accept (U6c's, unchanged) | *A training account cannot accept a trade's work.* · *A digital twin cannot accept a trade's work.* · *We accepted their work already.* · *Accept the work once every line is billed.* · *Their punch list has 2 items to fix or check first.* |
| the trade's press, as DETAIL | *No punch item with that id.* (`notFound`) · *Only the company we awarded this trade can fix its punch items.* (`notOnTrade`) · *Punch items are fixed while we build the job.* (`jobNotBuilding`) · *That item is marked fixed already.* (`punchNotOpen`) |

`notFound` and `notOnTrade` are keys the portal already says, and `jobNotBuilding` waits in WAITING since U5a.
`punchNotOpen` is new: U3b-i lists it in WAITING (`src/lib/gc/gcTradeSubmit.test.ts`) as `'P5'`, and the Portal's P5
maps it in `TRADE_SQL_ERRORS` (409) and the page's words in both languages, with the kind.

## The SQL as it will be

`supabase/migrations/<stamp>_gc_punch_writes.sql`. The stamp and `v2.NNNN` are the only things that change at the cut.

```sql
SET lock_timeout = '3s';

-- GC mode, the real build, the Building lane's U3b-i (v2.NNNN): the daily log's tighter rules and the punch list's
-- presses. Plan: to-dos/gc-mode/mockups/building-u3b.md on spike/gc-mode. Tables: 20261008030000_gc_building_records.
--
-- 1. gc_save_daily_log, made again: only our own crew or a trade with a signed statement of work goes on the log
--    (logTrades), a crew on site keeps its trade's start promise on the log's day, a missing high or low is refused
--    instead of saved as 0, and the first day reads "Oct 5".
-- 2. A punch item taken off is kept, with who took it off and when (removed_at, removed_by), and never deleted.
-- 3. The punch list's presses: add an item, take one off while nothing was pressed on it, check one fixed or send it
--    back, the office's word that the trade fixed it, and the trade's own from its portal (the Portal's P5).
-- 4. gc_accept_work (U6c) counts no item taken off.

-- 1. The daily log.
CREATE OR REPLACE FUNCTION public.gc_save_daily_log(log jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_project uuid;
  v_date date;
  v_today date;
  v_stage text;
  v_started date;
  v_high integer;
  v_low integer;
  v_id uuid;
  v_pkg uuid;
  v_company uuid;
  v_workers integer;
  v_reason text;
  i integer := 0;
  x jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  -- The tables' read-only blocks and the twin fence refuse the writes too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot write a daily log.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot write a daily log.' USING ERRCODE = '42501';
  END IF;
  v_project := nullif(btrim(coalesce(log->>'projectId', '')), '')::uuid;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Which job the log is for is missing.' USING ERRCODE = 'P0001';
  END IF;
  SELECT stage, started_on INTO v_stage, v_started FROM public.gc_projects WHERE project_id = v_project;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No GC project with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_stage <> 'building' OR v_started IS NULL THEN
    RAISE EXCEPTION 'The daily log starts once work starts.' USING ERRCODE = 'P0001';
  END IF;

  -- The day it is for, and the writer's own day (the company's, never the server's UTC one), held
  -- within a day of the server's so a stale page cannot write tomorrow's log.
  v_date := nullif(btrim(coalesce(log->>'date', '')), '')::date;
  v_today := nullif(btrim(coalesce(log->>'today', '')), '')::date;
  IF v_date IS NULL OR v_today IS NULL THEN
    RAISE EXCEPTION 'The log’s day is missing.' USING ERRCODE = 'P0001';
  END IF;
  IF v_today NOT BETWEEN current_date - 1 AND current_date + 1 THEN
    RAISE EXCEPTION 'This page’s day is out of date. Reload it and write the log again.' USING ERRCODE = 'P0001';
  END IF;
  IF v_date > v_today THEN
    RAISE EXCEPTION 'A log is written on its day or after, never before.' USING ERRCODE = 'P0001';
  END IF;
  IF v_date < v_started THEN
    RAISE EXCEPTION 'Work started %. A log before that day has nothing to say.', to_char(v_started, 'Mon FMDD') USING ERRCODE = 'P0001';
  END IF;

  -- The day's high and low, each a number. A blank one is refused, never saved as 0.
  v_high := CASE WHEN jsonb_typeof(log->'high') = 'number' THEN round((log->>'high')::numeric)::integer END;
  v_low := CASE WHEN jsonb_typeof(log->'low') = 'number' THEN round((log->>'low')::numeric)::integer END;
  IF v_high IS NULL OR v_low IS NULL THEN
    RAISE EXCEPTION 'Say the day’s high and low.' USING ERRCODE = 'P0001';
  END IF;

  -- Every trade the log names is one of this job's.
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT nullif(btrim(coalesce(c->>'packageId', '')), '')::uuid AS pkg FROM jsonb_array_elements(coalesce(log->'crews', '[]'::jsonb)) c
      UNION ALL
      SELECT nullif(btrim(coalesce(d->>'packageId', '')), '')::uuid FROM jsonb_array_elements(coalesce(log->'delays', '[]'::jsonb)) d
    ) named
    WHERE named.pkg IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.gc_trade_packages k WHERE k.id = named.pkg AND k.project_id = v_project)
  ) THEN
    RAISE EXCEPTION 'A trade on this log is not on this job.' USING ERRCODE = 'P0001';
  END IF;

  -- And it is our own crew or a trade with a signed statement of work (logTrades).
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT nullif(btrim(coalesce(c->>'packageId', '')), '')::uuid AS pkg FROM jsonb_array_elements(coalesce(log->'crews', '[]'::jsonb)) c
      UNION ALL
      SELECT nullif(btrim(coalesce(d->>'packageId', '')), '')::uuid FROM jsonb_array_elements(coalesce(log->'delays', '[]'::jsonb)) d
    ) named
    JOIN public.gc_trade_packages k ON k.id = named.pkg
    WHERE NOT k.ours
      AND NOT EXISTS (SELECT 1 FROM public.gc_sows s WHERE s.package_id = k.id AND s.status = 'signed')
  ) THEN
    RAISE EXCEPTION 'A trade on this log has no signed statement of work. Only those trades and our own crew go on the log.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.gc_daily_logs AS l (project_id, log_date, sky, high, low, weather_stop, done, visitors, photos_url, written_on, written_by)
  VALUES (
    v_project,
    v_date,
    coalesce(nullif(btrim(coalesce(log->>'sky', '')), ''), 'clear'),
    v_high,
    v_low,
    coalesce((log->>'weatherStop')::boolean, false),
    btrim(coalesce(log->>'done', '')),
    btrim(coalesce(log->>'visitors', '')),
    nullif(btrim(coalesce(log->>'photosUrl', '')), ''),
    v_today,
    v_uid
  )
  ON CONFLICT (project_id, log_date) DO UPDATE SET
    sky = EXCLUDED.sky,
    high = EXCLUDED.high,
    low = EXCLUDED.low,
    weather_stop = EXCLUDED.weather_stop,
    done = EXCLUDED.done,
    visitors = EXCLUDED.visitors,
    photos_url = EXCLUDED.photos_url,
    written_on = EXCLUDED.written_on,
    written_by = EXCLUDED.written_by,
    updated_at = now()
  RETURNING l.id INTO v_id;

  -- A day has one log: saving again replaces its crews and delays.
  DELETE FROM public.gc_daily_log_crews WHERE log_id = v_id;
  DELETE FROM public.gc_daily_log_delays WHERE log_id = v_id;

  -- Each trade on site and how many. A trade with nobody is left off, as the prototype does; a trade
  -- named twice keeps its last count.
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(log->'crews', '[]'::jsonb)) LOOP
    v_pkg := nullif(btrim(coalesce(x->>'packageId', '')), '')::uuid;
    v_workers := round(coalesce((x->>'workers')::numeric, 0))::integer;
    CONTINUE WHEN v_pkg IS NULL OR v_workers <= 0;
    INSERT INTO public.gc_daily_log_crews (log_id, package_id, workers) VALUES (v_id, v_pkg, v_workers)
    ON CONFLICT (log_id, package_id) DO UPDATE SET workers = EXCLUDED.workers;
  END LOOP;

  -- What held work up, in the order written. Null: the job's own.
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(log->'delays', '[]'::jsonb)) LOOP
    v_reason := btrim(coalesce(x->>'reason', ''));
    INSERT INTO public.gc_daily_log_delays (log_id, position, package_id, reason, note)
    VALUES (v_id, i, nullif(btrim(coalesce(x->>'packageId', '')), '')::uuid, v_reason, btrim(coalesce(x->>'note', '')));
    i := i + 1;
  END LOOP;

  -- A hired trade's crew on site keeps its start promise, on the log's day (buildingPromisesKeptBy).
  FOR v_company, v_pkg IN
    SELECT s.company_id, c.package_id
    FROM public.gc_daily_log_crews c
    JOIN public.gc_sows s ON s.package_id = c.package_id AND s.status = 'signed'
    WHERE c.log_id = v_id
  LOOP
    PERFORM public.gc_keep_promises(v_company, 'start', v_project, v_pkg, v_date);
  END LOOP;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_save_daily_log(jsonb) IS
  'GC mode (v2.4957, v2.NNNN): the superintendent''s daily log for one day on a GC project being built, with its crews and what held work up; saving a day again replaces its log. Refuses a training account, a digital twin, a job not being built, a day before work started or after the writer''s day, a missing high or low, a trade not on the job, and a trade with no signed statement of work (logTrades: those and our own crew). A hired trade''s crew on site keeps its start promise. SECURITY INVOKER: RLS decides who may.';

-- 2. A punch item taken off is kept, never deleted, and only one nothing was pressed on.
ALTER TABLE public.gc_punch_items
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gc_punch_items_removed_untouched') THEN
    ALTER TABLE public.gc_punch_items ADD CONSTRAINT gc_punch_items_removed_untouched
      CHECK (removed_at IS NULL OR (fixed_on IS NULL AND checked_on IS NULL AND sent_back_times = 0));
  END IF;
END $$;
COMMENT ON COLUMN public.gc_punch_items.removed_at IS
  'GC mode (v2.NNNN): taken off the punch list (added by mistake), kept as a record. Only an item nothing was pressed on. Every reader skips it.';
REVOKE DELETE, TRUNCATE ON TABLE public.gc_punch_items FROM authenticated;

-- 3. The punch list's presses.

-- Add an item to a trade's punch list (addPunchItem): a trade we hired on a job we are building, its statement of
-- work signed and its work not accepted yet. Returns the item.
CREATE OR REPLACE FUNCTION public.gc_add_punch_item(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  k public.gc_trade_packages%ROWTYPE;
  v_stage text;
  v_sow public.gc_sows%ROWTYPE;
  v_text text := regexp_replace(btrim(coalesce(p->>'text', '')), '\s+', ' ', 'g');
  v_where text := nullif(regexp_replace(btrim(coalesce(p->>'where', '')), '\s+', ' ', 'g'), '');
  v_photo text := nullif(btrim(coalesce(p->>'photoUrl', '')), '');
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot add to a punch list.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot add to a punch list.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO k FROM public.gc_trade_packages WHERE id = nullif(btrim(coalesce(p->>'packageId', '')), '')::uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No trade with that id.' USING ERRCODE = 'P0001';
  END IF;
  SELECT stage INTO v_stage FROM public.gc_projects WHERE project_id = k.project_id;
  IF v_stage IS DISTINCT FROM 'building' THEN
    RAISE EXCEPTION 'The punch list is for a job we are building.' USING ERRCODE = 'P0001';
  END IF;
  IF k.ours THEN
    RAISE EXCEPTION 'Our own crew has no punch list here. Its work runs on the Pipeline.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = k.id;
  IF NOT FOUND OR v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'Their statement of work is not signed yet.' USING ERRCODE = 'P0001';
  END IF;
  IF v_sow.accepted_on IS NOT NULL THEN
    RAISE EXCEPTION 'We accepted their work already. Anything wrong now is under their warranty.' USING ERRCODE = 'P0001';
  END IF;
  IF v_text = '' THEN
    RAISE EXCEPTION 'Say what is left to fix.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.gc_punch_items (project_id, package_id, position, text, where_on, photo_url, added_on, added_by)
  VALUES (
    k.project_id, k.id,
    (SELECT coalesce(max(position), -1) + 1 FROM public.gc_punch_items WHERE package_id = k.id),
    v_text, v_where, v_photo, public.app_today(), v_uid
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Take an item off, added by mistake: kept as a record with who and when, only while nothing was pressed on it.
CREATE OR REPLACE FUNCTION public.gc_remove_punch_item(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v public.gc_punch_items%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot take an item off a punch list.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot take an item off a punch list.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_punch_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND OR v.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'No punch item with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.fixed_on IS NOT NULL OR v.checked_on IS NOT NULL OR v.sent_back_times > 0 THEN
    RAISE EXCEPTION 'They have worked on this item already. Only an item nothing was done on comes off.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_punch_items SET removed_at = now(), removed_by = v_uid WHERE id = p_item_id;
END;
$$;

-- Check an item the trade says is fixed (checkPunchItem): fixed, or back to the trade with what is still wrong,
-- counting the times. Returns the day.
CREATE OR REPLACE FUNCTION public.gc_check_punch_item(p_item_id uuid, p_fixed boolean, p_note text DEFAULT NULL)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v public.gc_punch_items%ROWTYPE;
  v_note text := btrim(coalesce(p_note, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot check a punch item.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot check a punch item.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_punch_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND OR v.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'No punch item with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.checked_on IS NOT NULL THEN
    RAISE EXCEPTION 'It is checked already.' USING ERRCODE = 'P0001';
  END IF;
  IF v.fixed_on IS NULL THEN
    RAISE EXCEPTION 'Only an item they say is fixed gets checked.' USING ERRCODE = 'P0001';
  END IF;
  IF p_fixed IS NULL THEN
    RAISE EXCEPTION 'Say whether it is fixed.' USING ERRCODE = 'P0001';
  END IF;
  IF p_fixed THEN
    UPDATE public.gc_punch_items SET checked_on = public.app_today(), checked_by = v_uid WHERE id = p_item_id;
  ELSE
    IF v_note = '' THEN
      RAISE EXCEPTION 'Say what is still wrong.' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.gc_punch_items
    SET fixed_on = NULL, sent_back_times = sent_back_times + 1, sent_back_note = v_note, sent_back_on = public.app_today()
    WHERE id = p_item_id;
  END IF;
  RETURN public.app_today();
END;
$$;

-- An item marked fixed, both ways in (tradeFixPunchItem): the trade's from its portal, and the office's when the
-- trade says so by phone. On a job we are building, an item still open, by the company on its statement of work.
-- The last item fixed on the trade keeps its punch promise. Returns the day, or raises its key and words.
CREATE OR REPLACE FUNCTION public.gc_punch_fixed_ask(p_item_id uuid, p_company_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_punch_items%ROWTYPE;
  v_stage text;
  v_sow public.gc_sows%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.gc_punch_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND OR v.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No punch item with that id.';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = v.package_id;
  IF v_sow.id IS NULL OR v_sow.company_id IS DISTINCT FROM p_company_id
     OR NOT EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = v.package_id AND awarded_invite_id = v_sow.invite_id) THEN
    RAISE EXCEPTION 'notOnTrade' USING ERRCODE = 'P0001', DETAIL = 'Only the company we awarded this trade can fix its punch items.';
  END IF;
  SELECT stage INTO v_stage FROM public.gc_projects WHERE project_id = v.project_id;
  IF v_stage IS DISTINCT FROM 'building' THEN
    RAISE EXCEPTION 'jobNotBuilding' USING ERRCODE = 'P0001', DETAIL = 'Punch items are fixed while we build the job.';
  END IF;
  IF v.fixed_on IS NOT NULL OR v.checked_on IS NOT NULL THEN
    RAISE EXCEPTION 'punchNotOpen' USING ERRCODE = 'P0001', DETAIL = 'That item is marked fixed already.';
  END IF;
  UPDATE public.gc_punch_items SET fixed_on = public.app_today() WHERE id = p_item_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.gc_punch_items
    WHERE package_id = v.package_id AND removed_at IS NULL AND fixed_on IS NULL AND checked_on IS NULL
  ) THEN
    PERFORM public.gc_keep_promises(p_company_id, 'punch', v.project_id, v.package_id, public.app_today());
  END IF;
  RETURN public.app_today();
END;
$$;

-- The trade's "It is fixed" from its portal: the service role's only, called by the Portal's submit function (P5).
CREATE OR REPLACE FUNCTION public.gc_trade_punch_fixed(p_company_id uuid, p_item_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN public.gc_punch_fixed_ask(p_item_id, p_company_id);
END;
$$;

-- The office's "They say it is fixed": the trade told us by phone or text (new beside the prototype, as U4's and
-- U6's came-in presses are), in the office's words, for the company on the item's statement of work.
CREATE OR REPLACE FUNCTION public.gc_punch_fixed_in(p_item_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_detail text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot record a punch item fixed.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot record a punch item fixed.' USING ERRCODE = '42501';
  END IF;
  SELECT s.company_id INTO v_company
  FROM public.gc_punch_items i JOIN public.gc_sows s ON s.package_id = i.package_id
  WHERE i.id = p_item_id;
  BEGIN
    RETURN public.gc_punch_fixed_ask(p_item_id, v_company);
  EXCEPTION WHEN raise_exception THEN
    -- The shared rules' keys, in the office's words.
    GET STACKED DIAGNOSTICS v_detail = PG_EXCEPTION_DETAIL;
    RAISE EXCEPTION '%', CASE SQLERRM
      WHEN 'notFound' THEN 'No punch item with that id.'
      WHEN 'notOnTrade' THEN 'No company is awarded this trade with a signed statement of work.'
      WHEN 'jobNotBuilding' THEN 'Punch items are fixed while we build the job.'
      WHEN 'punchNotOpen' THEN 'It is marked fixed already. Check it.'
      ELSE coalesce(nullif(v_detail, ''), SQLERRM) END USING ERRCODE = 'P0001';
  END;
END;
$$;

-- 4. Accept a trade's work (U6c's acceptWork), made again so an item taken off holds nothing up.
CREATE OR REPLACE FUNCTION public.gc_accept_work(p_package_id uuid)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_sow public.gc_sows%ROWTYPE;
  v_left integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot accept a trade''s work.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot accept a trade''s work.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_sow FROM public.gc_sows WHERE package_id = p_package_id FOR UPDATE;
  IF NOT FOUND OR v_sow.status <> 'signed' THEN
    RAISE EXCEPTION 'Their statement of work is not signed yet.' USING ERRCODE = 'P0001';
  END IF;
  IF v_sow.accepted_on IS NOT NULL THEN
    RAISE EXCEPTION 'We accepted their work already.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.gc_sow_all_billed(v_sow.id) THEN
    RAISE EXCEPTION 'Accept the work once every line is billed.' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_left FROM public.gc_punch_items WHERE package_id = p_package_id AND checked_on IS NULL AND removed_at IS NULL;
  IF v_left > 0 THEN
    RAISE EXCEPTION 'Their punch list has % % to fix or check first.', v_left, CASE WHEN v_left = 1 THEN 'item' ELSE 'items' END USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_sows SET accepted_on = public.app_today() WHERE id = v_sow.id;
  RETURN public.app_today();
END;
$$;

COMMENT ON FUNCTION public.gc_add_punch_item(jsonb) IS
  'GC mode (v2.NNNN): add an item to a trade''s punch list (addPunchItem) on a job being built: a trade we hired, its statement of work signed and its work not accepted. Refuses a training account, a digital twin, our own crew and blank words. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_remove_punch_item(uuid) IS
  'GC mode (v2.NNNN): take a punch item added by mistake off the list, kept with who and when (removed_at, removed_by), only while nothing was pressed on it. Never a delete. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_check_punch_item(uuid, boolean, text) IS
  'GC mode (v2.NNNN): check an item the trade says is fixed (checkPunchItem): fixed, or back to the trade with what is still wrong, counting the times. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_punch_fixed_ask(uuid, uuid) IS
  'GC mode (v2.NNNN): a punch item marked fixed, the rules both ways in share: the company on its statement of work, a job being built, an item still open; the last one fixed keeps the trade''s punch promise. Raises keys: notFound, notOnTrade, jobNotBuilding, punchNotOpen. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_trade_punch_fixed(uuid, uuid) IS
  'GC mode (v2.NNNN): the trade''s It is fixed from its portal (tradeFixPunchItem), through gc_punch_fixed_ask. Service role only.';
COMMENT ON FUNCTION public.gc_punch_fixed_in(uuid) IS
  'GC mode (v2.NNNN): the office records that the trade says a punch item is fixed, by the trade''s own rules, in the office''s words. SECURITY INVOKER: RLS decides who may.';
COMMENT ON FUNCTION public.gc_accept_work(uuid) IS
  'GC mode (v2.5115, v2.NNNN): accept a trade''s work (acceptWork) once every line is billed and its punch list is done (no item without its check; an item taken off counts for nothing). Not twice. SECURITY INVOKER: RLS decides who may.';

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.gc_add_punch_item(jsonb)', 'public.gc_remove_punch_item(uuid)', 'public.gc_check_punch_item(uuid, boolean, text)',
    'public.gc_punch_fixed_in(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
  -- The shared rules: the office's twin calls them as the signed-in user, the portal's as the service role.
  EXECUTE 'REVOKE ALL ON FUNCTION public.gc_punch_fixed_ask(uuid, uuid) FROM PUBLIC, anon';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.gc_punch_fixed_ask(uuid, uuid) TO authenticated, service_role';
  -- Only the service role: the portal's submit function, after it has turned a link into its company.
  EXECUTE 'REVOKE ALL ON FUNCTION public.gc_trade_punch_fixed(uuid, uuid) FROM PUBLIC, anon, authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.gc_trade_punch_fixed(uuid, uuid) TO service_role';
END $$;
```

## The SQL tests

`supabase/tests/gc_building/80_punch.sql`, new, and `scripts/pgtest-gc-building.sh`'s PRESSES line with `20_daily_log.sql`'s new fixture and refusals (the diff after it). The bed's other scenarios are unchanged and pass beside them.

```sql
-- The punch list's presses (v2.NNNN, the Building lane's U3b-i): an item added on a trade we hired, taken off while
-- nothing was pressed on it (kept, never deleted), marked fixed by the trade from its portal or by the office on the
-- trade's word, then checked fixed or sent back with what is still wrong. The last item fixed keeps the trade's punch
-- promise, and Accept the work counts no item taken off. Each office press refuses in words, the trade's in keys, what
-- the prototype's reducer refuses. A training account, a digital twin and a role outside Building's dev door are
-- refused; the trade's press is the service role's only. Presses run through RLS, the fixture made as postgres;
-- everything runs inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "gc_building PASSED". See scripts/pgtest-gc-building.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000b0d01', 'dev@punch.test'),
  ('00000000-0000-0000-0000-0000000b0d02', 'trainee@punch.test'),
  ('00000000-0000-0000-0000-0000000b0d03', 'twin@punch.test'),
  ('00000000-0000-0000-0000-0000000b0d04', 'estimator@punch.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000b0d01', 'dev@punch.test', 'Punch Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000b0d02', 'trainee@punch.test', 'Punch Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000b0d03', 'twin@punch.test', 'Punch Twin', 'dev'),
  ('00000000-0000-0000-0000-0000000b0d04', 'estimator@punch.test', 'Punch Estimator', 'estimator')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000b0d02';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-0000000b0d03';

-- Two GC jobs. A is being built: Concrete awarded to Ridgeway Concrete with a signed statement of work, every line
-- billed on a paid draw; Framing awarded to Ridgeway too, its work accepted; Electrical with a statement of work sent,
-- not signed; and our own Plumbing. B is still bidding, with Masonry awarded and signed.
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000b0c01', 'Punch Test Owner', '00000000-0000-0000-0000-0000000b0d01');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000b0a01', 'Punch test A', '00000000-0000-0000-0000-0000000b0c01'),
  ('00000000-0000-0000-0000-0000000b0a02', 'Punch test B', '00000000-0000-0000-0000-0000000b0c01');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES
  ('00000000-0000-0000-0000-0000000b0a01', 'building', public.app_today() - 60),
  ('00000000-0000-0000-0000-0000000b0a02', 'bidding', NULL);
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-0000000b0e01', 'Ridgeway Concrete', ARRAY['Concrete', 'Framing', 'Masonry']),
  ('00000000-0000-0000-0000-0000000b0e02', 'Volt Brothers', ARRAY['Electrical']);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-0000000b0b01', '00000000-0000-0000-0000-0000000b0a01', 'Concrete', 0, false),
  ('00000000-0000-0000-0000-0000000b0b02', '00000000-0000-0000-0000-0000000b0a01', 'Framing', 1, false),
  ('00000000-0000-0000-0000-0000000b0b03', '00000000-0000-0000-0000-0000000b0a01', 'Electrical', 2, false),
  ('00000000-0000-0000-0000-0000000b0b04', '00000000-0000-0000-0000-0000000b0a01', 'Plumbing', 3, true),
  ('00000000-0000-0000-0000-0000000b0b05', '00000000-0000-0000-0000-0000000b0a02', 'Masonry', 0, false);
INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
  ('00000000-0000-0000-0000-0000000b0f01', '00000000-0000-0000-0000-0000000b0b01', '00000000-0000-0000-0000-0000000b0e01'),
  ('00000000-0000-0000-0000-0000000b0f02', '00000000-0000-0000-0000-0000000b0b02', '00000000-0000-0000-0000-0000000b0e01'),
  ('00000000-0000-0000-0000-0000000b0f03', '00000000-0000-0000-0000-0000000b0b03', '00000000-0000-0000-0000-0000000b0e02'),
  ('00000000-0000-0000-0000-0000000b0f05', '00000000-0000-0000-0000-0000000b0b05', '00000000-0000-0000-0000-0000000b0e01');
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000b0f01', awarded_on = public.app_today() - 55 WHERE id = '00000000-0000-0000-0000-0000000b0b01';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000b0f02', awarded_on = public.app_today() - 55 WHERE id = '00000000-0000-0000-0000-0000000b0b02';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000b0f03', awarded_on = public.app_today() - 55 WHERE id = '00000000-0000-0000-0000-0000000b0b03';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000b0f05', awarded_on = public.app_today() - 5 WHERE id = '00000000-0000-0000-0000-0000000b0b05';
INSERT INTO public.gc_scope_items (id, package_id, label, position) VALUES
  ('00000000-0000-0000-0000-0000000b0101', '00000000-0000-0000-0000-0000000b0b01', 'Footings', 0);
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, retainage_pct, sent_on, signed_on, accepted_on) VALUES
  ('00000000-0000-0000-0000-0000000b0201', '00000000-0000-0000-0000-0000000b0b01', '00000000-0000-0000-0000-0000000b0f01', '00000000-0000-0000-0000-0000000b0e01', 'signed', 10000, 10, public.app_today() - 52, public.app_today() - 50, NULL),
  ('00000000-0000-0000-0000-0000000b0202', '00000000-0000-0000-0000-0000000b0b02', '00000000-0000-0000-0000-0000000b0f02', '00000000-0000-0000-0000-0000000b0e01', 'signed', 8000, 10, public.app_today() - 52, public.app_today() - 50, public.app_today() - 2),
  ('00000000-0000-0000-0000-0000000b0203', '00000000-0000-0000-0000-0000000b0b03', '00000000-0000-0000-0000-0000000b0f03', '00000000-0000-0000-0000-0000000b0e02', 'sent', 9000, 10, public.app_today() - 52, NULL, NULL),
  ('00000000-0000-0000-0000-0000000b0205', '00000000-0000-0000-0000-0000000b0b05', '00000000-0000-0000-0000-0000000b0f05', '00000000-0000-0000-0000-0000000b0e01', 'signed', 7000, 10, public.app_today() - 4, public.app_today() - 3, NULL);
INSERT INTO public.gc_sow_lines (id, sow_id, position, label, amount, scope_item_id) VALUES
  ('00000000-0000-0000-0000-0000000b0301', '00000000-0000-0000-0000-0000000b0201', 0, 'Footings', 10000, '00000000-0000-0000-0000-0000000b0101');
INSERT INTO public.gc_draws (id, sow_id, number, requested_on, status, gross, retainage, net, waiver, waiver_on, approved_on, paid_on, period_to, signed_by, signed_on) VALUES
  ('00000000-0000-0000-0000-0000000b0401', '00000000-0000-0000-0000-0000000b0201', 1, public.app_today() - 20, 'paid', 10000, 1000, 9000, 'unconditional', public.app_today() - 15, public.app_today() - 19, public.app_today() - 16, public.app_today() - 20, 'Pat Ridgeway', public.app_today() - 20);
INSERT INTO public.gc_draw_lines (draw_id, sow_line_id, to_pct) VALUES
  ('00000000-0000-0000-0000-0000000b0401', '00000000-0000-0000-0000-0000000b0301', 100);
-- Ridgeway's promise to fix its punch items on Concrete, and its start on Masonry, which a punch press never keeps.
INSERT INTO public.gc_trade_promises (id, company_id, kind, project_id, package_id, what, due_on, source) VALUES
  ('00000000-0000-0000-0000-0000000b0701', '00000000-0000-0000-0000-0000000b0e01', 'punch', '00000000-0000-0000-0000-0000000b0a01', '00000000-0000-0000-0000-0000000b0b01', 'the punch items fixed', public.app_today() + 5, 'office'),
  ('00000000-0000-0000-0000-0000000b0702', '00000000-0000-0000-0000-0000000b0e01', 'start', '00000000-0000-0000-0000-0000000b0a02', '00000000-0000-0000-0000-0000000b0b05', 'the start', public.app_today() + 30, 'office');

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
CREATE FUNCTION gbt.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
END $$;
-- A trade's punch list, one line an item in its order: its words, where, and its state with days from today.
CREATE FUNCTION gbt.punch(p_package uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(
    i.position || ' ' || i.text || coalesce(' @ ' || i.where_on, '')
      || CASE WHEN i.removed_at IS NOT NULL THEN ' removed' || CASE WHEN i.removed_by IS NOT NULL THEN ' by ' || u.name ELSE '' END
              WHEN i.checked_on IS NOT NULL THEN ' checked ' || (i.checked_on - public.app_today()) || CASE WHEN i.checked_by IS NOT NULL THEN ' by ' || c.name ELSE '' END
              WHEN i.fixed_on IS NOT NULL THEN ' fixed ' || (i.fixed_on - public.app_today())
              ELSE ' open' END
      || CASE WHEN i.sent_back_times > 0 THEN ' back ' || i.sent_back_times || ' "' || i.sent_back_note || '"' ELSE '' END,
    E'\n' ORDER BY i.position), '-')
  FROM public.gc_punch_items i
  LEFT JOIN public.users u ON u.id = i.removed_by
  LEFT JOIN public.users c ON c.id = i.checked_by
  WHERE i.package_id = p_package $$;
-- Ridgeway's promises: each kind with its day kept, from today.
CREATE FUNCTION gbt.promises() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(kind || ' ' || coalesce((kept_on - public.app_today())::text, 'open'), ', ' ORDER BY kind)
  FROM public.gc_trade_promises WHERE company_id = '00000000-0000-0000-0000-0000000b0e01' $$;
CREATE FUNCTION gbt.item(p_text text) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.gc_punch_items WHERE text = p_text $$;
GRANT USAGE ON SCHEMA gbt TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbt TO authenticated, service_role;

-- The functions: invoker's rights; signed-out callers run none; the trade's press is the service role's alone.
SELECT gbt.same('every press runs with the caller''s rights',
  (SELECT string_agg(proname || ':' || prosecdef, ',' ORDER BY proname) FROM pg_proc WHERE proname IN ('gc_add_punch_item', 'gc_remove_punch_item', 'gc_check_punch_item', 'gc_punch_fixed_ask', 'gc_trade_punch_fixed', 'gc_punch_fixed_in', 'gc_accept_work', 'gc_save_daily_log')),
  'gc_accept_work:false,gc_add_punch_item:false,gc_check_punch_item:false,gc_punch_fixed_ask:false,gc_punch_fixed_in:false,gc_remove_punch_item:false,gc_save_daily_log:false,gc_trade_punch_fixed:false');
SELECT gbt.same('who may run each: signed out / signed in / the service role',
  (SELECT string_agg(f || ':' || has_function_privilege('anon', f, 'EXECUTE') || '/' || has_function_privilege('authenticated', f, 'EXECUTE') || '/' || has_function_privilege('service_role', f, 'EXECUTE'), ',')
   FROM unnest(ARRAY['public.gc_add_punch_item(jsonb)', 'public.gc_remove_punch_item(uuid)', 'public.gc_check_punch_item(uuid, boolean, text)', 'public.gc_punch_fixed_in(uuid)', 'public.gc_punch_fixed_ask(uuid, uuid)', 'public.gc_trade_punch_fixed(uuid, uuid)']) f),
  'public.gc_add_punch_item(jsonb):false/true/true,public.gc_remove_punch_item(uuid):false/true/true,public.gc_check_punch_item(uuid, boolean, text):false/true/true,public.gc_punch_fixed_in(uuid):false/true/true,public.gc_punch_fixed_ask(uuid, uuid):false/true/true,public.gc_trade_punch_fixed(uuid, uuid):false/false/true');
SELECT gbt.same('a signed-in caller may not delete a punch item, only take it off',
  has_table_privilege('authenticated', 'public.gc_punch_items', 'DELETE') || '/' || has_table_privilege('authenticated', 'public.gc_punch_items', 'UPDATE'), 'false/true');

SELECT gbt.as_user('00000000-0000-0000-0000-0000000b0d01');
SET LOCAL ROLE authenticated;

-- 1. Adding: three items on Concrete, the words tidied, each after the last.
SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b01', 'text', '  Patch   the slab edge ', 'where', ' Grid  C-4 '));
SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b01', 'text', 'Grind the high spot by the door'));
SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b01', 'text', 'Seal the expansion joint', 'photoUrl', 'https://drive.google.com/file/d/joint'));
SELECT gbt.same('three items on Concrete, in order', gbt.punch('00000000-0000-0000-0000-0000000b0b01'),
  E'0 Patch the slab edge @ Grid C-4 open\n1 Grind the high spot by the door open\n2 Seal the expansion joint open');
SELECT gbt.same('who added it, when, and its photo', (SELECT (added_by = '00000000-0000-0000-0000-0000000b0d01') || ' ' || (added_on - public.app_today()) || ' ' || coalesce(photo_url, '-') FROM public.gc_punch_items WHERE id = gbt.item('Seal the expansion joint')),
  'true 0 https://drive.google.com/file/d/joint');
SELECT gbt.refused('our own crew', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b04', 'text', 'Cap the cleanout'))$s$, 'Our own crew has no punch list here');
SELECT gbt.refused('a statement of work not signed', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b03', 'text', 'Label the panel'))$s$, 'Their statement of work is not signed yet');
SELECT gbt.refused('work accepted already', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b02', 'text', 'Shim the header'))$s$, 'under their warranty');
SELECT gbt.refused('a job still bidding', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b05', 'text', 'Point the joints'))$s$, 'for a job we are building');
SELECT gbt.refused('blank words', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b01', 'text', '   '))$s$, 'Say what is left to fix');
SELECT gbt.refused('no such trade', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0bff', 'text', 'Anything'))$s$, 'No trade with that id');

-- 2. Taking one off, added by mistake: kept with who and when, never deleted, and only while untouched.
SELECT public.gc_remove_punch_item(gbt.item('Grind the high spot by the door'));
SELECT gbt.same('the item is kept, taken off by the dev', gbt.punch('00000000-0000-0000-0000-0000000b0b01'),
  E'0 Patch the slab edge @ Grid C-4 open\n1 Grind the high spot by the door removed by Punch Dev\n2 Seal the expansion joint open');
SELECT gbt.refused('taken off twice', format('SELECT public.gc_remove_punch_item(%L)', gbt.item('Grind the high spot by the door')), 'No punch item with that id');
SELECT gbt.refused('a delete, which is not ours to make', format('DELETE FROM public.gc_punch_items WHERE id = %L', gbt.item('Patch the slab edge')), 'permission denied');
SELECT gbt.refused('checking one nobody said is fixed', format('SELECT public.gc_check_punch_item(%L, true)', gbt.item('Patch the slab edge')), 'Only an item they say is fixed gets checked');

-- 3. The trade marks one fixed from its portal, as the service role.
RESET ROLE;
SELECT gbt.as_user(NULL);
SET LOCAL ROLE service_role;
SELECT public.gc_trade_punch_fixed('00000000-0000-0000-0000-0000000b0e01', gbt.item('Patch the slab edge'));
SELECT gbt.same('fixed today, one still open, so the promise waits', gbt.punch('00000000-0000-0000-0000-0000000b0b01') || E'\n' || gbt.promises(),
  E'0 Patch the slab edge @ Grid C-4 fixed 0\n1 Grind the high spot by the door removed by Punch Dev\n2 Seal the expansion joint open\npunch open, start open');
SELECT gbt.trade_refused('fixed twice', format('SELECT public.gc_trade_punch_fixed(%L, %L)', '00000000-0000-0000-0000-0000000b0e01', gbt.item('Patch the slab edge')), 'punchNotOpen', 'That item is marked fixed already.');
SELECT gbt.trade_refused('another company', format('SELECT public.gc_trade_punch_fixed(%L, %L)', '00000000-0000-0000-0000-0000000b0e02', gbt.item('Seal the expansion joint')), 'notOnTrade', 'Only the company we awarded this trade can fix its punch items.');
SELECT gbt.trade_refused('an item taken off', format('SELECT public.gc_trade_punch_fixed(%L, %L)', '00000000-0000-0000-0000-0000000b0e01', gbt.item('Grind the high spot by the door')), 'notFound', 'No punch item with that id.');
SELECT gbt.trade_refused('no such item', $s$SELECT public.gc_trade_punch_fixed('00000000-0000-0000-0000-0000000b0e01', '00000000-0000-0000-0000-0000000b06ff')$s$, 'notFound', 'No punch item with that id.');
RESET ROLE;
-- An item on a job no longer being built: the trade fixes nothing there.
INSERT INTO public.gc_punch_items (id, project_id, package_id, text, added_on) VALUES
  ('00000000-0000-0000-0000-0000000b0601', '00000000-0000-0000-0000-0000000b0a02', '00000000-0000-0000-0000-0000000b0b05', 'Point the joints', public.app_today());
SET LOCAL ROLE service_role;
SELECT gbt.trade_refused('a job not being built', $s$SELECT public.gc_trade_punch_fixed('00000000-0000-0000-0000-0000000b0e01', '00000000-0000-0000-0000-0000000b0601')$s$, 'jobNotBuilding', 'Punch items are fixed while we build the job.');
RESET ROLE;
DELETE FROM public.gc_punch_items WHERE id = '00000000-0000-0000-0000-0000000b0601';

-- 4. The office checks it: not fixed, back to the trade with what is still wrong, counted.
SELECT gbt.as_user('00000000-0000-0000-0000-0000000b0d01');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('sent back with no words', format('SELECT public.gc_check_punch_item(%L, false, %L)', gbt.item('Patch the slab edge'), '  '), 'Say what is still wrong');
SELECT gbt.refused('neither fixed nor not', format('SELECT public.gc_check_punch_item(%L, NULL)', gbt.item('Patch the slab edge')), 'Say whether it is fixed');
SELECT public.gc_check_punch_item(gbt.item('Patch the slab edge'), false, 'The edge still crumbles.');
SELECT gbt.same('back to the trade, once, with the note', gbt.punch('00000000-0000-0000-0000-0000000b0b01'),
  E'0 Patch the slab edge @ Grid C-4 open back 1 "The edge still crumbles."\n1 Grind the high spot by the door removed by Punch Dev\n2 Seal the expansion joint open');
SELECT gbt.refused('an item sent back is not taken off', format('SELECT public.gc_remove_punch_item(%L)', gbt.item('Patch the slab edge')), 'They have worked on this item already');

-- 5. The trade says by phone that both are fixed; the office records it, and the last one keeps the punch promise.
SELECT public.gc_punch_fixed_in(gbt.item('Patch the slab edge'));
SELECT gbt.refused('recorded fixed twice', format('SELECT public.gc_punch_fixed_in(%L)', gbt.item('Patch the slab edge')), 'It is marked fixed already. Check it.');
SELECT gbt.same('one still open: the promise waits', gbt.promises(), 'punch open, start open');
SELECT public.gc_punch_fixed_in(gbt.item('Seal the expansion joint'));
SELECT gbt.same('the last one fixed keeps the punch promise, today; the start on Masonry stays open', gbt.promises(), 'punch 0, start open');
SELECT gbt.refused('an item taken off, on the office''s word', format('SELECT public.gc_punch_fixed_in(%L)', gbt.item('Grind the high spot by the door')), 'No punch item with that id');

-- 6. Accept the work waits on every item but the one taken off, then goes.
SELECT gbt.refused('accepted with two fixed, not checked', $s$SELECT public.gc_accept_work('00000000-0000-0000-0000-0000000b0b01')$s$, 'Their punch list has 2 items to fix or check first');
SELECT public.gc_check_punch_item(gbt.item('Patch the slab edge'), true);
SELECT public.gc_check_punch_item(gbt.item('Seal the expansion joint'), true, 'Looks right.');
SELECT gbt.refused('checked twice', format('SELECT public.gc_check_punch_item(%L, true)', gbt.item('Seal the expansion joint')), 'It is checked already');
SELECT gbt.same('both checked by the dev; the one taken off stays as it was', gbt.punch('00000000-0000-0000-0000-0000000b0b01'),
  E'0 Patch the slab edge @ Grid C-4 checked 0 by Punch Dev back 1 "The edge still crumbles."\n1 Grind the high spot by the door removed by Punch Dev\n2 Seal the expansion joint checked 0 by Punch Dev');
SELECT gbt.same('the work is accepted: the item taken off held nothing up', public.gc_accept_work('00000000-0000-0000-0000-0000000b0b01')::text, public.app_today()::text);
SELECT gbt.refused('added after the work was accepted', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b01', 'text', 'One more'))$s$, 'under their warranty');

-- 7. Who may not.
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000b0d02');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a training account adds', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b02', 'text', 'x'))$s$, 'A training account cannot add to a punch list');
SELECT gbt.refused('a training account takes off', format('SELECT public.gc_remove_punch_item(%L)', gbt.item('Seal the expansion joint')), 'A training account cannot take an item off a punch list');
SELECT gbt.refused('a training account checks', format('SELECT public.gc_check_punch_item(%L, true)', gbt.item('Seal the expansion joint')), 'A training account cannot check a punch item');
SELECT gbt.refused('a training account records one fixed', format('SELECT public.gc_punch_fixed_in(%L)', gbt.item('Seal the expansion joint')), 'A training account cannot record a punch item fixed');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000b0d03');
SET LOCAL ROLE authenticated;
SELECT gbt.refused('a digital twin adds', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b02', 'text', 'x'))$s$, 'A digital twin cannot add to a punch list');
SELECT gbt.refused('a digital twin records one fixed', format('SELECT public.gc_punch_fixed_in(%L)', gbt.item('Seal the expansion joint')), 'A digital twin cannot record a punch item fixed');
RESET ROLE;
SELECT gbt.as_user('00000000-0000-0000-0000-0000000b0d04');
SET LOCAL ROLE authenticated;
-- An estimator reads the job's trades (door 1) but no statement of work and no punch item: Building's and the
-- Board's tables let only a dev in while they are built.
SELECT gbt.refused('an estimator adds, reading no statement of work', $s$SELECT public.gc_add_punch_item(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000b0b01', 'text', 'x'))$s$, 'Their statement of work is not signed yet');
SELECT gbt.refused('an estimator checks, reading no punch item', format('SELECT public.gc_check_punch_item(%L, true)', gbt.item('Seal the expansion joint')), 'No punch item with that id');
SELECT gbt.refused('an estimator records one fixed, reading no punch item', format('SELECT public.gc_punch_fixed_in(%L)', gbt.item('Seal the expansion joint')), 'No punch item with that id');
SELECT gbt.refused('a signed-in caller of the trade''s press', $s$SELECT public.gc_trade_punch_fixed('00000000-0000-0000-0000-0000000b0e01', '00000000-0000-0000-0000-0000000b06ff')$s$, 'permission denied');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'gc_building PASSED'; END $$;
ROLLBACK;
```

```diff
diff --git a/scripts/pgtest-gc-building.sh b/scripts/pgtest-gc-building.sh
index 23d6f22e0..163f8ccc7 100755
--- a/scripts/pgtest-gc-building.sh
+++ b/scripts/pgtest-gc-building.sh
@@ -25,6 +25,7 @@ PRESSES=(
   supabase/migrations/*_gc_rfi_writes.sql
   supabase/migrations/*_gc_trade_draws.sql
   supabase/migrations/*_gc_trade_closeout.sql
+  supabase/migrations/*_gc_punch_writes.sql
 )
 
 command -v docker >/dev/null || { echo "docker not on PATH"; exit 2; }
diff --git a/supabase/tests/gc_building/20_daily_log.sql b/supabase/tests/gc_building/20_daily_log.sql
index f51a86707..a16d84104 100644
--- a/supabase/tests/gc_building/20_daily_log.sql
+++ b/supabase/tests/gc_building/20_daily_log.sql
@@ -1,8 +1,9 @@
--- The daily log's press (v2.4957, the Building lane's U3a-i): gc_save_daily_log writes a day's log
--- with its crews and delays, replaces that day's when saved again, and refuses in words a training
--- account, a digital twin, a job not being built, a day after the writer's or before work started, a
--- writer's day off the server's, and a trade not on the job; the tables' own checks refuse a sky or a
--- reason they do not know, and RLS a role outside Building's dev door. Presses run through RLS, the
+-- The daily log's press (v2.4957, the Building lane's U3a-i; its tighter rules v2.NNNN, U3b-i): gc_save_daily_log
+-- writes a day's log with its crews and delays, replaces that day's when saved again, keeps a hired trade's start
+-- promise when its crew is on site, and refuses in words a training account, a digital twin, a job not being built, a
+-- day after the writer's or before work started, a writer's day off the server's, a missing high or low, a trade not
+-- on the job, and a trade with no signed statement of work; the tables' own checks refuse a sky or a reason they do
+-- not know, and RLS a role outside Building's dev door. Presses run through RLS, the
 -- fixture made as postgres; everything runs inside one transaction that rolls back. Raises on the
 -- first failed assertion; ends with "gc_building PASSED". See scripts/pgtest-gc-building.sh. Never
 -- against prod.
@@ -25,8 +26,8 @@ INSERT INTO public.users (id, email, name, role) VALUES
 UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000006d2';
 UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-0000000006d3';
 
--- Two GC jobs: A being built since three days ago, with Concrete and our own Plumbing; B still bidding,
--- with Electrical.
+-- Two GC jobs: A being built since three days ago, with Concrete awarded to Ridgeway with a signed statement
+-- of work, our own Plumbing, and Framing not signed yet; B still bidding, with Electrical.
 INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000000006c1', 'Building Test Owner', '00000000-0000-0000-0000-0000000006d1');
 INSERT INTO public.projects (id, name, customer_id) VALUES
   ('00000000-0000-0000-0000-0000000006a1', 'Building test A', '00000000-0000-0000-0000-0000000006c1'),
@@ -37,7 +38,18 @@ INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES
 INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
   ('00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-0000000006a1', 'Concrete', 0, false),
   ('00000000-0000-0000-0000-0000000006b2', '00000000-0000-0000-0000-0000000006a1', 'Plumbing', 1, true),
-  ('00000000-0000-0000-0000-0000000006b3', '00000000-0000-0000-0000-0000000006a2', 'Electrical', 0, false);
+  ('00000000-0000-0000-0000-0000000006b3', '00000000-0000-0000-0000-0000000006a2', 'Electrical', 0, false),
+  ('00000000-0000-0000-0000-0000000006b4', '00000000-0000-0000-0000-0000000006a1', 'Framing', 2, false);
+INSERT INTO public.gc_companies (id, name, trades) VALUES ('00000000-0000-0000-0000-0000000006e1', 'Ridgeway Concrete', ARRAY['Concrete']);
+INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
+  ('00000000-0000-0000-0000-0000000006f1', '00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-0000000006e1');
+UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000006f1', awarded_on = current_date - 10 WHERE id = '00000000-0000-0000-0000-0000000006b1';
+INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, retainage_pct, sent_on, signed_on) VALUES
+  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-0000000006b1', '00000000-0000-0000-0000-0000000006f1', '00000000-0000-0000-0000-0000000006e1', 'signed', 30000, 10, current_date - 8, current_date - 6);
+-- Ridgeway's promises on Concrete: its start, which its crew on site keeps, and its submittals, which a log never does.
+INSERT INTO public.gc_trade_promises (id, company_id, kind, project_id, package_id, what, due_on, source) VALUES
+  ('00000000-0000-0000-0000-000000000611', '00000000-0000-0000-0000-0000000006e1', 'start', '00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-0000000006b1', 'the start', current_date + 2, 'office'),
+  ('00000000-0000-0000-0000-000000000612', '00000000-0000-0000-0000-0000000006e1', 'submittals', '00000000-0000-0000-0000-0000000006a1', '00000000-0000-0000-0000-0000000006b1', 'the submittals', current_date + 2, 'office');
 
 CREATE SCHEMA gbt;
 CREATE FUNCTION gbt.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
@@ -80,6 +92,10 @@ CREATE FUNCTION gbt.logs(p_project uuid) RETURNS text LANGUAGE sql STABLE SECURI
       || ' delays ' || coalesce((SELECT string_agg(coalesce(k.trade, 'job') || ':' || d.reason, ',' ORDER BY d.position) FROM public.gc_daily_log_delays d LEFT JOIN public.gc_trade_packages k ON k.id = d.package_id WHERE d.log_id = l.id), '-'),
     E'\n' ORDER BY l.log_date)
   FROM public.gc_daily_logs l WHERE l.project_id = p_project $$;
+-- Ridgeway's promises: each kind with its day kept, from today.
+CREATE FUNCTION gbt.promises() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
+  SELECT string_agg(kind || ' ' || coalesce((kept_on - current_date)::text, 'open'), ', ' ORDER BY kind)
+  FROM public.gc_trade_promises WHERE company_id = '00000000-0000-0000-0000-0000000006e1' $$;
 GRANT USAGE ON SCHEMA gbt TO authenticated;
 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gbt TO authenticated;
 
@@ -110,6 +126,9 @@ SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object(
 SELECT gbt.same('saving a day again replaces its log', gbt.logs('00000000-0000-0000-0000-0000000006a1'),
   '0 clear written 0 crews Concrete:5 delays -');
 
+-- Concrete's crew on site kept Ridgeway's start, on the log's day; its submittals stay open.
+SELECT gbt.same('a hired trade''s crew on site keeps its start promise', gbt.promises(), 'start 0, submittals open');
+
 -- A day missed, caught up today: written after its day.
 SELECT public.gc_save_daily_log(gbt.log(-1, jsonb_build_object('sky', 'cloudy')));
 SELECT gbt.same('a caught-up day says it was written later', gbt.logs('00000000-0000-0000-0000-0000000006a1'),
@@ -117,7 +136,12 @@ SELECT gbt.same('a caught-up day says it was written later', gbt.logs('00000000-
 
 -- The refusals, in words.
 SELECT gbt.refused('a day after the writer''s', $s$SELECT public.gc_save_daily_log(gbt.log(1))$s$, 'never before');
-SELECT gbt.refused('a day before work started', $s$SELECT public.gc_save_daily_log(gbt.log(-4))$s$, 'Work started');
+SELECT gbt.refused('a day before work started, said as "Oct 5"', $s$SELECT public.gc_save_daily_log(gbt.log(-4))$s$, 'Work started ' || to_char(current_date - 3, 'Mon FMDD') || '. A log before');
+SELECT gbt.refused('no high', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('high', NULL)))$s$, 'Say the day’s high and low');
+SELECT gbt.refused('no low at all', $s$SELECT public.gc_save_daily_log(gbt.log(0) - 'low')$s$, 'Say the day’s high and low');
+SELECT gbt.refused('a high in words', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('high', 'hot')))$s$, 'Say the day’s high and low');
+SELECT gbt.refused('a trade with no signed statement of work on the crews', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('crews', jsonb_build_array(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000006b4', 'workers', 3)))))$s$, 'no signed statement of work');
+SELECT gbt.refused('a trade with no signed statement of work on the delays', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('delays', jsonb_build_array(jsonb_build_object('packageId', '00000000-0000-0000-0000-0000000006b4', 'reason', 'crew', 'note', '')))))$s$, 'no signed statement of work');
 SELECT gbt.refused('a page whose day is off the server''s', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('today', to_char(current_date + 3, 'YYYY-MM-DD'))))$s$, 'out of date');
 SELECT gbt.refused('a job still bidding', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('projectId', '00000000-0000-0000-0000-0000000006a2')))$s$, 'starts once work starts');
 SELECT gbt.refused('a job that does not exist', $s$SELECT public.gc_save_daily_log(gbt.log(0, jsonb_build_object('projectId', '00000000-0000-0000-0000-0000000006ff')))$s$, 'No GC project with that id');
```

## The migration doc as it will be

````markdown
# <stamp>_gc_punch_writes.sql (2026-10-10, v2.NNNN)

GC mode, the real build, the Building lane's U3b-i: the daily log's tighter rules and the punch list's presses (`to-dos/gc-mode/mockups/building-u3b.md` on branch `spike/gc-mode`). One column pair, a check, a revoke and eight functions on U1's tables (`20261008030000`). The statement of work is the Board's B6-a (`20261009140000`). Promises are the Board's B1 (`20261008020000`). `gc_accept_work` is the Building lane's U6c (`20261010041000`).

- **`gc_save_daily_log`**, made again (U3a-i's, `20261009120000`):
  - only our own crew (`gc_trade_packages.ours`) or a trade with a signed statement of work goes on the log, on its crews or its delays (`logTrades`);
  - a hired trade's crew on site keeps its open `start` promise on the log's day (`gc_keep_promises`, the company from its statement of work);
  - a missing high or low, or one in words, is refused (*Say the day's high and low.*) instead of saved as 0;
  - the first day reads `Oct 5` (`'Mon FMDD'`).
- **`gc_punch_items`** gains `removed_at` and `removed_by`: an item added by mistake is taken off and kept. `gc_punch_items_removed_untouched` holds that only an item never fixed, checked or sent back comes off. `authenticated` loses `DELETE` and `TRUNCATE` on the table.
- **The office's presses**, `SECURITY INVOKER`, revoked from `PUBLIC` and `anon` and granted to `authenticated`:
  - `gc_add_punch_item(p jsonb)` adds an item after the trade's last: a trade we hired on a job being built, its statement of work signed and its work not accepted;
  - `gc_remove_punch_item(p_item_id uuid)` takes an untouched one off;
  - `gc_check_punch_item(p_item_id uuid, p_fixed boolean, p_note text)` checks one the trade marked fixed, or sends it back with what is still wrong;
  - `gc_punch_fixed_in(p_item_id uuid)` records that the trade says it is fixed, by the trade's own rules, in the office's words.
- **The trade's press**, the service role's only: `gc_trade_punch_fixed(p_company_id uuid, p_item_id uuid)`, through the shared rules `gc_punch_fixed_ask(p_item_id uuid, p_company_id uuid)` (granted to `authenticated` and the service role). Their keys: `notFound`, `notOnTrade`, `jobNotBuilding`, `punchNotOpen`; the new one waits in WAITING as `'P5'`. The last item open on the trade keeps its `punch` promise.
- **`gc_accept_work`**, made again (U6c's): an item taken off holds nothing up.

The table stays dev only (`gc_punch_items_dev`, `is_dev()`), with the read-only blocks and the twin fence. Building's door opens it to the schedule's team (decision 4).

Apply order: after the four above. One `ALTER TABLE` adds two nullable columns and a check to a dev-only table that is empty on prod, behind `lock_timeout 3s`. The rest is `CREATE OR REPLACE` and grants. It is idempotent.

**Before the push**, the SQL bed (`scripts/pgtest-gc-building.sh`; GitHub's runners run it from `.github/workflows/sql-beds.yml` on this PR) applies every migration to the Supabase Postgres image, applies Building's presses a second time, and plays every scenario in `supabase/tests/gc_building`: `20_daily_log.sql` with the new rules (a crew keeping its start, a trade not signed refused, a missing or worded high refused, `Oct 5`), and `80_punch.sql` (items added, one taken off and kept, fixed by the trade and by the office, sent back, checked, the punch promise kept by the last one fixed, Accept the work counting none taken off, a delete refused, each refusal in its words or its key, and a trainee, a twin, an estimator and a signed-in caller of the trade's press). It ends `gc_building PASSED`.

## Verify after the push

1. **The columns, the check, the revoke, and the functions with invoker's rights and the right callers.**

   ```sql
   SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gc_punch_items' AND column_name IN ('removed_at', 'removed_by') ORDER BY 1;
   SELECT conname FROM pg_constraint WHERE conname = 'gc_punch_items_removed_untouched';
   SELECT has_table_privilege('authenticated', 'public.gc_punch_items', 'DELETE') AS signed_in_can_delete;
   SELECT p.proname, p.prosecdef AS definer,
     has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can,
     has_function_privilege('authenticated', p.oid, 'EXECUTE') AS signed_in_can,
     has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_can
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
   WHERE p.proname IN ('gc_save_daily_log', 'gc_add_punch_item', 'gc_remove_punch_item', 'gc_check_punch_item', 'gc_punch_fixed_ask',
     'gc_trade_punch_fixed', 'gc_punch_fixed_in', 'gc_accept_work')
   ORDER BY p.proname;
   ```

   Expect `removed_at` and `removed_by`; the check; `signed_in_can_delete` false; eight functions, every `definer` and `anon_can` false, `signed_in_can` true on all but `gc_trade_punch_fixed`, which only `service_can`.

2. **The words, as a dev, rolled back.** On "GC test project, delete me" (building since its Start), `gc_save_daily_log` with `high` null gives *Say the day's high and low.*; with a crew on a trade with no signed statement of work it gives *A trade on this log has no signed statement of work.* Nothing is written.

3. **One punch item on the test project** once a statement of work there is signed (P2c), inside one transaction that rolls back unless Grace says keep it: add one, record it fixed on their word, send it back, record it again, check it fixed; add a second and take it off.

4. **A training account's call is refused in words.** As the training-mode user, `gc_add_punch_item` gives *A training account cannot add to a punch list.* (`42501`).

5. **The trade's press is the service role's only.** As a dev, `gc_trade_punch_fixed` gives *permission denied for function gc_trade_punch_fixed*.

## Rollback

```sql
DROP FUNCTION IF EXISTS public.gc_punch_fixed_in(uuid);
DROP FUNCTION IF EXISTS public.gc_trade_punch_fixed(uuid, uuid);
DROP FUNCTION IF EXISTS public.gc_punch_fixed_ask(uuid, uuid);
DROP FUNCTION IF EXISTS public.gc_check_punch_item(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.gc_remove_punch_item(uuid);
DROP FUNCTION IF EXISTS public.gc_add_punch_item(jsonb);
GRANT DELETE, TRUNCATE ON TABLE public.gc_punch_items TO authenticated;
ALTER TABLE public.gc_punch_items DROP CONSTRAINT IF EXISTS gc_punch_items_removed_untouched;
-- Only once no item was taken off:
ALTER TABLE public.gc_punch_items DROP COLUMN IF EXISTS removed_by, DROP COLUMN IF EXISTS removed_at;
-- Then re-run the CREATE OR REPLACE of gc_save_daily_log from 20261009120000 and of gc_accept_work from 20261010041000.
```

No screen calls the punch presses until U3b-ii, so nothing else changes. The daily log window offers only `logTrades` already, so its saves go through as before. A cleared temperature still reaches the press as 0 until U3b-ii's window sends it blank.

## Status

Written for the Building lane's U3b-i; not applied. The lead pushes it after the merge and records here what steps 1 to 5 said.
````

## U3b-ii: the punch list's window, the io and the daily log's blank temperature

No migration. Cut on U3b-i's types.

**The list**, `src/components/gc/GcPunchList.tsx`, ported from the prototype's `GcBuildingPunchList` and `PunchRow`
(`GcBuildingPunch.tsx`, branch spike/gc-mode), one trade's list with its presses. It shows in two places:

- **Punch list**, a window on the card of a job being built, after Daily log, at `?punch=<projectId>`
  (`GcPunchWindow.tsx`): one card per trade we hired with a signed statement of work, open items first. Its gate is
  `canUseGcBuilding` alone, no money gate, since at Building's door the punch list goes to the schedule's team
  (decision 4) while Closeout stays the money team's.
- **Closeout**, under each trade's six steps, as the prototype has it (U6d's `GcCloseoutWindow.tsx` gains the list
  between its steps and the card's foot). Accept the work's hold reads the same items.

```
┌ Punch list ─────────────────────────────────────────────────────────────────────┐
│ Concrete  Ridgeway Concrete                          2 of 3 still open           │
│ [to fix]  Patch the slab edge · Grid C-4                    listed Oct 6         │
│           Sent back once, last Oct 8. The edge still crumbles.                   │
│           (They say it is fixed)  (Take it off)                                  │
│ [fixed, check it]  Seal the expansion joint        Ridgeway fixed it Oct 9       │
│           [Checked, it is fixed]  (Not fixed)                                    │
│ [checked]  Grind the high spot by the door                  checked Oct 9        │
│ (Add an item)                                                                     │
│ Ridgeway Concrete marks each item fixed in their portal, or tells us by phone.   │
│ Our superintendent checks it on the job. We accept the work once every item is   │
│ checked.                                                                         │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Add an item**: what is left to fix, where (*like Grid C-4*), and a photo's Drive link, then **Add to the punch
  list** (`gc_add_punch_item`). **Done adding** closes the line. Not on our own crew, a trade not signed, or work
  accepted: the window offers no line there, and the SQL refuses it in words.
- **They say it is fixed** on an open item (`gc_punch_fixed_in`): the trade told us by phone or text.
- **Take it off** on an open item nothing was done on (`gc_remove_punch_item`), behind a confirm in the window's own
  words: *Take "Patch the slab edge" off the punch list? It stays in the record.*
- **Checked, it is fixed** and **Not fixed** on a fixed item (`gc_check_punch_item`). Not fixed opens *What is still
  wrong* and **Send it back**, held until it has words.
- Props in main's pattern: `writes={{ onAdd, onRemove, onFixedIn, onCheck }}`, with `busy` and `problem`.

**The mapper**, `src/lib/gc/punchRows.ts` (U6d's, read only until now): the read skips an item taken off
(`loadGcPunch` adds `.is('removed_at', null)`, and `withPunch` drops a row that carries one). Until U3b-ii lands,
Closeout counts an item taken off as open; U3b-i's own `gc_accept_work` already skips it.

**The io**, `src/lib/gc/punchIo.ts` gains one function per press: `addPunchItem`, `removePunchItem`,
`punchFixedIn`, `checkPunchItem`. Each press reads the punch list again; Closeout's also reads its draws.

**The daily log's window** (`GcDailyLog.tsx`):

- a cleared High or Low reads as blank (`NaN`), not 0, so **Save** waits and the press is never sent without one;
- the comment that says the press takes any trade until U3b now says the press holds `logTrades` too.

**The guide** *keep a trade's punch list* (`roles: dev` until Building's door): add an item, take one off, record
that they say it is fixed, check it or send it back, and how the list holds Accept the work.

**U3b-ii's tests**:

- `GcPunchList.render.test.tsx`: Fair Oaks D's three items on Concrete in their three states, each press with its
  arguments, Send it back held without words, Take it off only on an untouched open item, no Add line on our own
  crew or accepted work, plain words.
- `GcPunchWindow.render.test.tsx`: one card per signed trade we hired, none for our crew.
- `GcCloseoutWindow.render.test.tsx`: the list under a trade's steps, its presses passed through.
- `GcDailyLog.render.test.tsx`: a cleared High holds Save.
- `punchRows.test.ts`: a row taken off is dropped.
- `GcProjects.render.test.tsx`: Punch list for a dev on a building job, the reads, a press reading again.

## Drift from `BUILDING_REAL_BUILD.md`

- **The trade's verb is `SECURITY INVOKER`**, the service role's only, refusing with keys, as U4's settled. Its rules
  live once in `gc_punch_fixed_ask`, which the office's twin shares (U6c's `gc_final_pay_app_ask` is the pattern).
- **Two presses beside the prototype**: *They say it is fixed* (call 2) and *Take it off* (call 3).
- **An item is never deleted.** The plan's table had no removal; one taken off is a kept row, and the table takes no
  `DELETE` from a signed-in caller.
- **The check holds no job stage.** A trade's item is checked or sent back whatever the job's stage, as the reducer
  does; adding one and the trade's fix need a job being built.
- **The punch list has its own window and sits on Closeout** (gc 4's pick above), not only on the project's row.

## The check (U3b-ii, on "GC test project, delete me", as a dev)

It waits for a signed statement of work there (P2c), as U6's does.

1. Write today's log with the trade's crew on site, and see its start promise kept on the Board.
2. Clear the High and see **Save** wait.
3. Add two punch items, take the second off, and see it gone from the list and from Closeout's count.
4. Press **They say it is fixed**, then **Not fixed** with a note, then **They say it is fixed** again and **Checked,
   it is fixed**.
5. See Closeout's **Accept the work** open. Nothing here emails anyone.

## When it is cut

- **U3b-i**: from `origin/main` once this plan merges. Claim the version and the stamp past `20261010044000` and every
  open claim; swap them in; add the PRESSES line, `80_punch.sql`, `20_daily_log.sql`'s new fixture and refusals,
  WAITING's `punchNotOpen: 'P5'` in `src/lib/gc/gcTradeSubmit.test.ts`, the release note, the fragment and the
  migration doc; run the bed; arm. The lead pushes it on merge.
- **U3b-ii**: on U3b-i's types.

## Docs each PR touches

- **U3b-i**: `docs/migrations/<stamp>_gc_punch_writes.md`, the release note and fragment.
- **U3b-ii**: `PROJECT_DOCUMENTATION.md` (the Punch list window, the list on Closeout), `GLOSSARY.md` (*punch list*,
  *punch item*), `ACCESS_CONTROL.md` (the window's one gate, the table's revoked delete), the guide *keep a trade's
  punch list*, and *close out a trade and close a GC job* naming the list on Closeout.

## Seams

- **The Board** (B1, B6-a): `gc_keep_promises` for `start` and `punch`, and the statement of work's company, which
  both presses read for the promise. The Board's promise lines (`GcBuildingPromise`) stay unported: one
  Building-promises PR after B6.
- **The Portal** (P5): the trade's half (`GcBuildingPunchForTrade`, `bw`'s punch words, already on main), the kind
  `punch_fixed` on `submit-gc-trade-portal`, `punchNotOpen` in `TRADE_SQL_ERRORS` and the page's words, and the emails
  for an item added or sent back.
- **The schedule** (PR 10): the door that opens the punch list to the schedule's team, with the daily log.
- **Owner Billing**: none. Closeout's Accept the work is the only money reader, and it is Building's.

## Is this the best we can do?

1. **The superintendent adds an item from the daily log.** The walk that finds a punch item is often the day's walk.
   A line on the log, *Add a punch item*, could open the same form. *Later:* the log and the list are each new to the
   office, and one entry point is easier to learn first.
2. **A photo taken on the phone, not a link.** The superintendent is standing at the item. *Later:* decision 6 keeps a
   Drive link, and the Quo file agent files photos into the job's folder. The link field takes it then.
3. **The trade's own list by email before P5.** A trade with no portal yet could get the list as an email. *Not now*
   (call 4): the trade hears with P5, and an email per item before the portal would teach them a channel that goes away.
   *Picked now, the small half:* the office's twin, so a phone call moves the list today.

## Status

Plan 2026-10-10 by gc 4 at the lead's ask, from `origin/spike/gc-mode` at d9f0907a6 and `origin/main` at f2f106dd6. The
three calls were answered the same night and are written in. U3b-i's SQL ran green on the real gc-building bed:
20_daily_log.sql's 26 assertions and 80_punch.sql's 44, beside 40_submittals' 50, 50_rfis' 50, 60_draws' 99 and 70_closeout's 53, on two full runs; twelve planted bugs each failed it, and the restored SQL passed again. Nothing is cut or claimed: U3b-i is written on a local branch from main and held until this plan merges.
