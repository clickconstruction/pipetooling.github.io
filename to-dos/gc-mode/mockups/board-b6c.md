---
name: "B6-c: Get started on real rows, Start and Start anyway, and the Contracts tab on the trade card"
rows: board-b6.md (The PRs, in order, B6-c); BOARD_REAL_BUILD.md (B6's functions, gc_start_project; The PRs, in order, row 8; the guide in Docs each PR touches); board-b6b.md (the papers B6-c reads)
branch: this plan on spike/board-b6c-plan (from origin/spike/gc-mode at 96122ea8c); the PRs from origin/main
status: plan 2026-10-09 by Helper 12 (the Board lane). The lead approved the read-back the same day as two PRs, with calls A to D as picked (below). Nothing cut or claimed.
---

# B6-c: Get started, Start and Start anyway

## What it is

- **B6-c-i, Start in the database** (one migration, one function, no table, no screen): `gc_start_project`, Start and Start anyway, with its SQL bed.
- **B6-c-ii, the screen** (no migration):
  - the mapper reads what the checklist needs on real rows;
  - the **Get started** window, with **Start** and **Start anyway**;
  - Start's email to the companies on the job;
  - the trade card's statement of work gains the three pieces of the spike's Contracts tab it lacks;
  - the guide "get a GC job ready to start".

## What main has (origin/main db7a2853a)

1. **`startChecklist` is lifted** (`src/lib/gc/start.ts`), and its only reader is the schedule's `notReady.ts`. No screen draws Get started.
2. **The mapper fills most of what it reads** (`boardRows.ts:449-453`): our contract's sent and signed days, `permit_on`, `start_date` and `started_on`. Three gaps:
   - `started_anyway_*` is not mapped, and `GcProject` has no `startedAnyway` (the spike's `gcTypes.ts:405`).
   - Our own crew's trade is always `priced: false` (`boardRows.ts:419-420`), so a job with our own crew could never read ready.
   - A company's papers are B6-b-ii's.
3. **Nothing writes `started_on` or the three `started_anyway_*` columns** (B1, `20261008020000:108-111`). **Nothing moves a project to building** either: `gc_mark_won` is the only stage write, and it goes to buyout (`20261008130000:151`).
   - The daily log's button opens only on building.
   - So do three schedule writes: `gc_schedule_fail_inspection`, `gc_schedule_pass_inspection` and `gc_schedule_their_dates`.
   - Start is the first write that opens Building on a real job.
4. **The schedule keeps its own baseline.** `gc_schedule_keep_start` (`20261008040000:132-158`) takes it at the first plan change after Start, dated `started_on`. Start owes the schedule nothing.
5. **`gc_sign_owner_contract`** (Owner Billing's, `20261008010000:356`) has no caller yet, and its comment says "The Board's Get started calls it". `ownerContractWorthNow` is on main (`ownerBilling.ts:124`).
6. **The start email's words are on main** in English and Spanish (`portalI18n.ts:577-582`): `mStartSubject`, `mStartSubjectNoDate`, `mStartBegins`, `mStartNoDate`, `mStartPart` and `mStartReport`.
   - `gc-trade-email` takes kind `start`, and its group is `job` (`portal.ts:324`).
   - Nothing composes those words yet.
   - The spike's composer is `portalMessages`' start block (`gcPortal.ts:690-706`), for the companies awarded on the job (`won`, `:496`).
7. **`gc_start_project` does not exist.** board-b6.md's row says no migration, while BOARD_REAL_BUILD lists the function among B6's.
8. **Main has no project tabs.**
   - The board card opens windows (`?schedule=`, `?bill=`).
   - Each trade's block carries its statement of work (`GcTradeSow`, B6-a-ii). Its header says the papers that must be in before it goes come with B6-b.
   - `partnerBlockers` is on main (`bench.ts:326`).

## Calls, answered (the lead, 2026-10-09)

- **A. Start's gate: the database trusts the office's list.** It keeps who pressed Start (`auth.uid()`), why, and what was missing. Start signs nothing and moves no money, so there is no SQL twin of `startChecklist`. Award's gate is in SQL because a statement of work is a contract.
- **B. Who may Start: a dev, until award's door.** That door is estimators, the leaders and dev (the owner's call W, at its default).
- **C. Our own crew is priced from its Trades mode bid.**
  - The board reads `bids.bid_value` through `own_bid_id`. The trade is priced when that is above 0, and that number is what we carry.
  - Our number moves from our budget to our bid on such a job, and the fragment says so.
- **D. Our contract to the customer is B6-d**, after B6-c: the send from the customer's window, and the signing in their portal. Until then, **Mark it signed** covers a contract signed on paper.

## B6-c-i's SQL

```sql
SET lock_timeout = '3s';

-- GC mode, the Board's B6-c-i (to-dos/gc-mode/mockups/board-b6c.md on spike/gc-mode): Start and Start anyway
-- (startProject). A won project goes to building on the company's day. Start anyway keeps who pressed it, why, and
-- what was still missing as the office's screen listed it: the database trusts that list (call A), since Start
-- signs nothing and moves no money. It sends nothing; the client tells the trades after it (gc-trade-email, kind
-- start), as gc_invite_companies leaves its sends to B4's window. The schedule keeps its own baseline at its first
-- change after Start (gc_schedule_keep_start, dated started_on), so Start owes it nothing. One function, no table.
CREATE OR REPLACE FUNCTION public.gc_start_project(p_project_id uuid, p_anyway jsonb DEFAULT NULL)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_job record;
  v_reason text := btrim(coalesce(p_anyway ->> 'reason', ''));
  v_missing text[] := '{}';
  v_today date := public.app_today();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  -- gc_projects' read-only blocks and the twin fence refuse the write too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot start a job.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot start a job.' USING ERRCODE = '42501';
  END IF;
  -- Who may Start (call B): a dev until award's door, the owner's call W. gc_projects is the office's (New
  -- project's door), so the refusal is said here, before any write, rather than left to its policy.
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev starts a job while GC mode is built.' USING ERRCODE = 'P0001';
  END IF;

  SELECT g.stage, g.lost_on, g.started_on, p.name INTO v_job
  FROM public.gc_projects g
  JOIN public.projects p ON p.id = g.project_id
  WHERE g.project_id = p_project_id
  FOR UPDATE OF g;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That GC project is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_job.lost_on IS NOT NULL THEN
    RAISE EXCEPTION '% is lost. Bring it back before you start it.', v_job.name USING ERRCODE = 'P0001';
  END IF;
  IF v_job.started_on IS NOT NULL OR v_job.stage IN ('building', 'closed') THEN
    RAISE EXCEPTION '% is already started.', v_job.name USING ERRCODE = 'P0001';
  END IF;
  IF v_job.stage <> 'buyout' THEN
    RAISE EXCEPTION '% is still bidding. Press We won this first.', v_job.name USING ERRCODE = 'P0001';
  END IF;

  -- Start anyway (the owner, 2026-10-04, question 7): what was missing, each line as the office's screen said it,
  -- in its order, blanks dropped. Anyway with nothing missing is a plain Start, as the prototype's reducer has it.
  IF p_anyway IS NOT NULL AND jsonb_typeof(p_anyway) <> 'null' THEN
    IF jsonb_typeof(p_anyway) <> 'object' OR coalesce(jsonb_typeof(p_anyway -> 'missing'), 'array') <> 'array' THEN
      RAISE EXCEPTION 'Start anyway needs why and what is missing.' USING ERRCODE = 'P0001';
    END IF;
    v_missing := ARRAY(
      SELECT btrim(e.line)
      FROM jsonb_array_elements_text(coalesce(p_anyway -> 'missing', '[]'::jsonb)) WITH ORDINALITY AS e(line, n)
      WHERE btrim(e.line) <> ''
      ORDER BY e.n);
    IF cardinality(v_missing) > 0 THEN
      IF v_reason = '' THEN
        RAISE EXCEPTION 'Say why it starts before everything is in.' USING ERRCODE = 'P0001';
      END IF;
      IF length(v_reason) > 500 THEN
        RAISE EXCEPTION 'Say why in 500 characters or fewer.' USING ERRCODE = 'P0001';
      END IF;
      IF cardinality(v_missing) > 60 OR EXISTS (SELECT 1 FROM unnest(v_missing) AS m(line) WHERE length(m.line) > 300) THEN
        RAISE EXCEPTION 'That list of what is missing is too long.' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  UPDATE public.gc_projects
  SET stage = 'building',
      started_on = v_today,
      started_anyway_by = CASE WHEN cardinality(v_missing) > 0 THEN v_uid END,
      started_anyway_reason = CASE WHEN cardinality(v_missing) > 0 THEN v_reason END,
      started_anyway_missing = CASE WHEN cardinality(v_missing) > 0 THEN v_missing END
  WHERE project_id = p_project_id;
  RETURN v_today;
END;
$$;

COMMENT ON FUNCTION public.gc_start_project(uuid, jsonb) IS
  'GC mode (B6-c-i): Start on Get started (startProject). A won project in buyout goes to building on app_today(); Start anyway, {reason, missing[]}, keeps who, why and what was missing, the office''s list as its screen said it. Sends nothing. A dev only until award''s door. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_start_project(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_start_project(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_start_project(uuid, jsonb) TO authenticated;
```

Notes on the shape:
- **It is `SECURITY INVOKER`.** So `gc_projects`' policies, its read-only blocks and the twin fence decide as well. The function says each refusal in words first, as Building's submittal writes do.
- **The row is locked before the checks** (`FOR UPDATE OF g`). So two presses start a job once, and the second reads "already started".
- **The checks run in order:** a lost project, then a started one, then one still bidding.
  - Each refusal names the project.
  - Where a button moves the project on, the refusal names it in the outcome strip's own words: **Bring it back** or **We won this**.
- **`started_anyway_by` is whoever pressed it**, never a name typed in. The spike's "Who is starting it" picker stays on the spike.
- **The limits are refused in words, never cut.** The missing list holds at most 60 lines of 300 characters, and the reason at most 500.
- **It alters no table and creates one function**, so its push needs no quiet window. It is applied on merge.
- **The stamp and the version are claimed at the cut** (`npm run claim`), from origin/main's newest.

## The SQL bed (`supabase/tests/gc_start`, a job in `sql-beds.yml`)

The bed applies every migration, then this one a second time. Then, inside one transaction that rolls back, it checks that:
- **Before any write**, it refuses no sign-in, a training-mode dev, a digital twin and an estimator, each in words.
- **As a dev**, it refuses a project that is not there, a lost one, one still bidding, and one already started, each in words.
- **Start on a won project**:
  - returns `app_today()`;
  - leaves the project building;
  - keeps no Start anyway.
- **A second Start** reads "already started".
- **Start anyway**:
  - refuses no reason, a reason over 500 characters, a list over 60 lines, and a malformed anyway, each in words;
  - keeps who pressed it, the reason trimmed, and the lines in order with blanks dropped.
- **Start anyway with nothing missing** is a plain Start.
- **The seam with the schedule:** `gc_schedule_keep_start` after Start keeps a baseline dated `started_on`.
- **The grants:** anon may not run the function, and authenticated may.

`src/lib/gc/startSql.test.ts` holds every refusal the bed asserts to the plain-words rules, as `awardSql.test.ts` does.

## Verify after the push (the migration doc)

```sql
-- 1. The function and its grants.
SELECT has_function_privilege('anon', 'public.gc_start_project(uuid, jsonb)', 'EXECUTE') AS anon_runs,
       has_function_privilege('authenticated', 'public.gc_start_project(uuid, jsonb)', 'EXECUTE') AS signed_in_runs;
-- Expected: false, true.

-- 2. As a dev, rolled back: Start the test project (in buyout; one still bidding reads its refusal instead).
BEGIN;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT id FROM public.users WHERE role = 'dev' AND NOT read_only LIMIT 1), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
SELECT public.gc_start_project('<the test project id>') AS started;
SELECT stage, started_on, started_anyway_by FROM public.gc_projects WHERE project_id = '<the test project id>';
-- Expected: building, today, null.
ROLLBACK;
```

## B6-c-ii, after B6-b-ii and B6-c-i's types

- **The mapper** (`boardRows.ts`):
  - `startedAnyway` is `{ by: the user's name, reason, missing }`. `GcProject` gains it, word for word from the spike.
  - Our own crew (call C): the board reads each `own_bid_id`'s `bid_value`.
    - `selfPerform` is `{ value: bid_value, priced: true }` once that is above 0.
    - Until then it is our budget with `priced: false`.
    - A reader who cannot see the bid sees the budget.
  - The papers are B6-b-ii's.
- **The Get started window** (`GcStartWindow.tsx`, `?start=<project id>`).
  - It opens from a **Get started** button on the card of a won job (buyout or building). The button is a dev's until award's door.
  - It is the spike's `GcStart.tsx` on real rows. It loads its project's schedule with `loadSchedule`, as the Bill window does.
  - **The strip:**
    - "Ready to start. Nothing is missing." or "Not ready yet. N things are missing.";
    - the steps-done bar;
    - **Start the project and tell the N on the job**. The button stays shut until the job is ready, and its title lists what's missing.
  - **Start anyway:** "Why start before everything is in?" and **Start anyway**. There is no Who picker.
  - **After Start:**
    - "Started <day>. Work begins <weekday>.";
    - who was told, with anyone it could not reach named, and **Send again** for them.
    - After Start anyway, also "<name> started it before everything was in: <why>. Still owed:" with the list. Once everything owed is in, it reads "Started anyway, and everything owed is in now."
  - **With <customer>:**
    - **Our contract.** **Mark it signed** and **Undo** go through `gc_sign_owner_contract`, with today and `ownerContractWorthNow`. They're for the money team only (`canSeeGcMoney`), since the worth is Our number's. Undo is refused in the function's own words once a pay application went out. "Sent, waiting on their signature" shows when `owner_contract_sent_on` is set.
    - **The permit.** **Mark it done** and **Undo**, on `permit_on`.
    - **The start date**, on `start_date`.
    - The permit and start-date writes are plain writes under `gc_projects`' office door.
  - **The schedule:** its step, with **Open the schedule** or **Draw it on Schedule**, opening the Schedule window.
  - **The trades:** columns Trade, Company, Awarded, Master agreement, Insurance, W-9, Statement of work and Next. Each Next opens the place on main where that work is done, so no press is built twice:
    - **Award** opens Compare quotes on that trade, with its gate.
    - **Send the master agreement**, **Remind them**, or the W-9 or insurance asked for: the company window's Send a paper (B6-b-ii). It goes through the company opener, which gains an optional place, as the spike's `openCustomer` has.
    - **Send the statement of work** goes to the trade card's Send.
    - **Our own crew** links to its Trades mode bid.
    - The spike's **Sign it as them** stays on the spike.
    - After a plain Start the table locks. After Start anyway it stays open until what is owed is in.
- **Start's email** (`src/lib/gc/startEmail.ts`, pure):
  - It is `portalMessages`' start block lifted word for word, as `sowEmail.ts` was, with an equality test against the spike.
  - It sends one `gc-trade-email` per company awarded on the job: kind `start`, group `job`, key `<project id>:start`. A second press sends nothing.
  - A carried company not yet awarded is not told.
  - Only a dev can send it (`canSendGcTradeEmail`). It goes after `gc_start_project` returns.
- **The Contracts tab, on the trade card** (`GcTradeSow`):
  - **Send to their portal to sign** waits on `partnerBlockers`, showing "Cannot send yet." and the blockers.
  - **Send the master agreement** sits beside it while none has gone.
  - B6-b-ii's paperwork chips sit beside the company.
- **The guide** "get a GC job ready to start" (`src/content/help/`), with the tokens for Start and Start anyway.
- **Docs:**
  - GLOSSARY: Get started, Start anyway;
  - PROJECT_DOCUMENTATION §20;
  - ACCESS_CONTROL: Start is a dev's, and so is the start email;
  - the release note and fragment. The fragment says Our number moves to our own bid on a job with our own crew.
- **Tests:**
  - `startChecklist` on mapped fixture rows: ready, our own crew priced and not, and Start anyway's owed list;
  - `startEmail` in English and Spanish;
  - render tests for the window (not ready, ready, started, started anyway with owed) and the card's blockers.
- **The live walk**, only with Grace's or the user's own yes: on the test project, Get started reads every step, and Start tells the test company only.

## Out

- **B6-d**: our contract to the customer, sent from the customer's window and signed in their portal (call D).
- The start reminders at 14 and 3 days (`startReminders.ts`): the schedule lane's.
- Needs you and Who to call: B2b.

## Status

Plan written 2026-10-09 by Helper 12 on `spike/board-b6c-plan`. The lead approved the read-back the same day.

- The SQL runs for the first time in B6-c-i's bed. Any change it needs comes back here first.
- B6-c-i cuts after B6-b-i is on main, and is pushed on merge.
- B6-c-ii follows B6-b-ii and B6-c-i's types.
