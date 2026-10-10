---
name: "The schedule's PR 13: Tell the trades and their answers"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 13, decision 9's trade writes and Writing it's two senders; PORTAL_REAL_BUILD.md, P5d and the trade emails (dates); mockups/schedule-pr11.md, call 8 (the kept line); GANTT_FEATURES.md G-81, G-113, G-132
branch: the plan on claude/gc-schedule-pr13-plan (from origin/spike/gc-mode at d0047495e); the code from origin/main in two cuts, one with a migration
status: plan 2026-10-10 by gc 4 at the lead's ask. Amendment 1 (2026-10-10): gc 10, holding Schedule, co-signed all ten calls at their picks; their two checks are named in calls 2 and 3, the walk's sentence is a seam, and call 11 (a told move undone) is added. For gc 3's co-sign on the answer's half, then the lead's read-back. 13a's SQL ran on the real bed on main at e5e11fef4. Nothing cut or claimed.
---

# The schedule's PR 13: Tell the trades and their answers

## What it is

A move changes a trade's days. Tell the trades sends each company whose days changed one email with its new dates and
why, in its language, with its portal link. In the portal, the company says the dates work or asks for another day.
The office sees who was told and each answer.

Most of it is on main already:

| Piece | On main | From |
|---|---|---|
| `gc_schedule_move_tells` (one row per move and company: `told_on`, `shown`, `email_send_log_id`) and `gc_schedule_move_answers` (`ok`, `day`, `note`, keyed to its tell) | applied, dev-only policies, append only | PR 3 (`20261007220000`) |
| Their read into `ScheduleMove.toldOn`, `toldTo` and `answers` | built | PR 6 (`rows.ts`, `scheduleIo.ts`) |
| The kernels: `movedLines`, `companiesToTell`, `untoldMoves`, `datesMessage`, `moveAnswerWords`, `datesAsksOpen`, `datesNotices`, `whatIfKeptWords` | lifted word for word | PR 1b |
| The words in both languages (`mDates*`, `dates*`) | built | the Portal's P0 |
| The one sender, `gc-trade-email`, with the kind `dates` (group `job`) | deployed | the Portal's P3-a |
| The call list's *not sent yet* reason and the open asks (`callList.ts`) | built, empty | PR 7c |

Nothing writes a tell or an answer, and nothing draws Tell the trades. PR 13 adds both writes and the office's screen.
The portal's half (the kind `answer_dates`, the moves in its slice, *These dates work*) is the Portal's P5d (gc 3),
on the verb this PR adds.

Two cuts:

- **13a, the writes** (one migration): `gc_schedule_record_tells`, the office's record of who it told, and
  `gc_trade_answer_dates`, a company's answer for the portal to call. Their bed scenario. The verb's two new keys
  listed in `gcTradeSubmit.test.ts`'s `WAITING` for P5d. No screen.
- **13b, Tell the trades** (no migration, after 13a's push and the regen): the window, the record of moves' line and
  answers, and the kept line over the chart (PR 11's call 8).

## The calls

**Co-signed by gc 10 (Schedule) at their picks (amendment 1); for gc 3 (Portal, calls 1, 2 and 5); each with the other way:**

1. **No new sender: Tell the trades sends through `gc-trade-email`, kind `dates`.** It is the one sender for every
   trade email (P3-a; PORTAL_REAL_BUILD l.62). It reads the company's people by the kind's group, adds the portal link
   and the frame, sends through Resend with the project manager as Reply-To, keeps the sent copy, writes the
   `gc_trade_messages` row, and sends a key once. Each company's message is `datesMessage`'s, so the words have one
   copy. SCHEDULE_REAL_BUILD's `gc-tell-trades` is dropped, and its passage is amended after the merge. *Other way:*
   `gc-tell-trades` as a batch that imports `_shared/gcTradeEmail.ts`: one more function to deploy, and every function
   that bundles that file redeploys when it changes.
2. **The tell is recorded after the send, by the office, from the send's answer.** For each company, the screen sends,
   then records the tells through `gc_schedule_record_tells` with the send's `emailSendLogId`. The email's key is sent
   once, so a press again after a send that went but was not recorded sends nothing and records it: the RPC keeps a
   row already there. It relies on `gc-trade-email` answering a key sent before with `already: true` and the first
   send's `emailSendLogId` (`gc-trade-email/index.ts`, the key's check), so the late record carries the right log row.
   That is P3-b's shape (`emailTheAnswer`, then `addAnswerSentTo`). *Other way:* `gc-trade-email`
   writes the tells for kind `dates`, which teaches the Portal's one sender the schedule's tables.
3. **Told per company, not per move.** A company refused at the send (no email on file, not on the job) stays untold
   for that move, and the next press reaches it alone. The lifted `untoldMoves` reads `!toldOn`, so one company told
   would hide the rest. The window reads a new kernel, `companiesNotTold`. A pull tells only the companies whose dates
   came in: the lifted `movedLines` leaves out a pull's finished lines (`tellTrades.ts`, `!move.pull?.finished`), and
   the kernel's test names it. *Other way:* `untoldMoves` as it is, and a refused company is never told.
4. **The email's key is `dates:` and a SHA-256 of the company's moves' ids, sorted.** The same moves give the same key,
   so a second press sends nothing; a move added since gives a new one. The key holds 200 characters, and five ids
   would not fit. *Other way:* the newest move's id, which a move undone between two presses can make send twice.
5. **The answer's verb is this lane's, its kind the Portal's** (gc 3's seam, as in U3b to U6 and P5c). `gc_trade_answer_dates`
   (13a) is service role only and raises the portal's keys with their words as DETAIL: `notFound`, `notYours` (a
   company not told of that move), `datesTakenBack` (new: the move was undone since), `alreadyAnswered` (a race too),
   `badRequest` (no yes or no, or a day with a yes), `dayNeeded` (new: another day asked with none) and `tooLong`. The
   two new keys go in `WAITING` as `'P5d'`, and P5d maps them and takes them off. *Other way:* none; the table is ours.
6. **Every day is the company's** (`app_today()`), as on every record, so `told_on` and `answered_on` never come from a
   browser's clock. That is why the tell is an RPC and not a plain insert: the table's column has no default, and
   adding one would lock it (`lock_timeout`). Neither touches the plan or its version.
7. **The tell checks the move, not the company.** A move on another job, or undone, is refused whole. Which company may
   be told is `gc-trade-email`'s check (an invite on the job), made a moment before. So the RPC reads none of
   `gc_projects`, `gc_trade_packages`, `gc_scope_items` or `gc_invites`, and Building's door owes it nothing (its call
   9). *Other way:* the RPC checks the invite too, a second copy of one rule, through the door's team functions once
   D1 is on main.
8. **Who tells:** those who may move a bar and send a trade email (`moves` and `canSendGcTradeEmail`, a dev today). The
   tells' policy opens to the team with PR 10. Tell the trades is not in the what-if copy (a copy is never told). The
   press is the send, with no tick, since sending is the window's whole job, and the window shows each company's email
   before it goes. Any send to a real trade waits on the owner's yes, as every trade email does.
9. **Spanish waits on its switch.** The language is `tradeMailLang(company.lang)`: English until `PORTAL_SPANISH_ON`
   (decision 8, a native speaker's read). So SCHEDULE_REAL_BUILD's check *in Spanish for a company that reads Spanish*
   waits on that switch, not on this PR. The window says the language each email goes in.
10. **Where the office sees it:**
    - **Tell the trades · N** in the head of the record of moves, N being the companies not told;
    - *The trades have not been told.* under a move, and each company's answer (`moveAnswerWords`);
    - the kept line over the chart after a Keep, naming the companies the kept moves have not told, with **Tell the
      trades** (PR 11's call 8, `GcWhatIfKept`);
    - the call list's *not sent yet* reason and the open asks, already built, which read the rows.

    An answer taken on the phone (the prototype's call actions) waits for the Board's Follow up sheet.
11. **A told move undone** (gc 10's seam). Undo puts a bar back after its company was told the moved dates, so the
    company holds dates that no longer stand. Its answer is refused as `datesTakenBack`, and its portal stops showing the
    move (`datesNotices` skips an undone move). PR 13 says so to the office: under the undone move, the record of moves
    reads *Told, then undone: {company} still has the moved dates.*, from a new kernel `toldThenUndone`, pinned in
    `tellWindow.test.ts` and the record's render test. Telling the company its dates are back is **13c**, planned
    with gc 3 after P5d: a tell is one row per move and company and append only, so the dates back need a record of
    their own, their own words in both languages (the portal's words, and the Spanish read) and their own key.
    *Other way* (gc 10's pick): `companiesNotTold` counts an undone told move as one more to tell, so one press covers
    it. That is the better end, and it is 13c; folding it in here grows 13a's SQL and the Portal's words in a PR shared
    with P5d.

## 13a: the writes

The migration, byte for byte but for the `v2.NNNN` swap and its stamp, claimed past every open claim at the cut:

```sql
SET lock_timeout = '3s';

-- GC mode, the schedule's PR 13a (v2.NNNN): Tell the trades and their answers (to-dos/gc-mode/mockups/schedule-pr13.md
-- on branch spike/gc-mode). The tables are PR 3's (gc_schedule_move_tells, gc_schedule_move_answers); this adds their
-- two writes. The office records the companies it told, after gc-trade-email sent each one its dates; a company answers
-- from its portal through the submit function. Both are records: neither touches the plan or its version, and each
-- day is the company's (app_today()). No table is created.

-- The companies told of moves (Tell the trades, G-132): once gc-trade-email has sent a company its new dates, one row
-- per move and company, with that company's lines the move changed and the dates the message gave (shown), and the
-- send's log row. A row already there stays as it is, so a press again after a send that went but was not recorded
-- records it once. A move undone, or on another job, is refused whole. Under the tells' own policy (a dev's until the
-- schedule's PR 10). Returns how many rows it added.
CREATE OR REPLACE FUNCTION public.gc_schedule_record_tells(p_project_id uuid, p_company_id uuid, p_email_send_log_id uuid, p_tells jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tell jsonb;
  v_move public.gc_schedule_moves%ROWTYPE;
  v_added integer := 0;
BEGIN
  IF jsonb_typeof(p_tells) IS DISTINCT FROM 'array' OR jsonb_array_length(p_tells) = 0 THEN
    RAISE EXCEPTION 'Nothing was told.' USING ERRCODE = 'P0001';
  END IF;
  FOR v_tell IN SELECT value FROM jsonb_array_elements(p_tells) LOOP
    SELECT * INTO v_move FROM public.gc_schedule_moves
     WHERE id = nullif(v_tell ->> 'moveId', '')::uuid AND project_id = p_project_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A move in this tell is not on this schedule. Reload the schedule and try again.' USING ERRCODE = 'P0001';
    END IF;
    IF v_move.undone_on IS NOT NULL THEN
      RAISE EXCEPTION 'A move in this tell was undone. Reload the schedule and try again.' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.gc_schedule_move_tells (move_id, company_id, told_on, shown, email_send_log_id)
    VALUES (v_move.id, p_company_id, public.app_today(), coalesce(v_tell -> 'shown', '[]'::jsonb), p_email_send_log_id)
    ON CONFLICT (move_id, company_id) DO NOTHING;
    IF FOUND THEN
      v_added := v_added + 1;
    END IF;
  END LOOP;
  RETURN v_added;
END;
$$;

-- A company's answer to its new dates from its portal (tradeAnswerDates, G-113): the dates work, or another day asked
-- for, with a note if it likes. Only for a move it was told of, while the move stands, and once. Its refusals are the
-- portal's keys, each with its words as DETAIL. Service role only: the submit function calls it once it has turned a
-- link into its company.
CREATE OR REPLACE FUNCTION public.gc_trade_answer_dates(p_company_id uuid, p_move_id uuid, p_ok boolean, p_day date, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_move public.gc_schedule_moves%ROWTYPE;
  v_note text := btrim(coalesce(p_note, ''));
BEGIN
  SELECT * INTO v_move FROM public.gc_schedule_moves WHERE id = p_move_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No move with that id.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_schedule_move_tells WHERE move_id = p_move_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'notYours' USING ERRCODE = 'P0001', DETAIL = 'That company was not told of that move.';
  END IF;
  IF v_move.undone_on IS NOT NULL THEN
    RAISE EXCEPTION 'datesTakenBack' USING ERRCODE = 'P0001', DETAIL = 'The office took those dates back.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gc_schedule_move_answers WHERE move_id = p_move_id AND company_id = p_company_id) THEN
    RAISE EXCEPTION 'alreadyAnswered' USING ERRCODE = 'P0001', DETAIL = 'Those dates have their answer already.';
  END IF;
  IF p_ok IS NULL OR (p_ok AND p_day IS NOT NULL) THEN
    RAISE EXCEPTION 'badRequest' USING ERRCODE = 'P0001', DETAIL = 'Say the dates work, or ask for another day.';
  END IF;
  IF NOT p_ok AND p_day IS NULL THEN
    RAISE EXCEPTION 'dayNeeded' USING ERRCODE = 'P0001', DETAIL = 'Say which day works.';
  END IF;
  IF char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'tooLong' USING ERRCODE = 'P0001', DETAIL = 'Keep the note under 2,000 characters.';
  END IF;
  INSERT INTO public.gc_schedule_move_answers (move_id, company_id, answered_on, ok, day, note)
  VALUES (p_move_id, p_company_id, public.app_today(), p_ok, p_day, nullif(v_note, ''));
EXCEPTION
  -- Two answers at once: the first stands.
  WHEN unique_violation THEN
    RAISE EXCEPTION 'alreadyAnswered' USING ERRCODE = 'P0001', DETAIL = 'Those dates have their answer already.';
END;
$$;

COMMENT ON FUNCTION public.gc_schedule_record_tells(uuid, uuid, uuid, jsonb) IS
  'GC mode (v2.NNNN): the companies told of moves (Tell the trades, G-132), after gc-trade-email sent each its dates. One row per move and company with the dates shown and the send''s log row; one already there stays. A move undone or on another job is refused. A record: no version. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_trade_answer_dates(uuid, uuid, boolean, date, text) IS
  'GC mode (v2.NNNN): a company''s answer to its new dates from its portal (tradeAnswerDates, G-113): they work, or another day asked for. Only a move it was told of, while it stands, and once. Service role only.';

-- The office's record: signed-in users, the tells' own policy deciding who.
REVOKE ALL ON FUNCTION public.gc_schedule_record_tells(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_schedule_record_tells(uuid, uuid, uuid, jsonb) TO authenticated;
-- The trade's answer: only the service role, the submit function after it has turned a link into its company.
REVOKE ALL ON FUNCTION public.gc_trade_answer_dates(uuid, uuid, boolean, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gc_trade_answer_dates(uuid, uuid, boolean, date, text) TO service_role;
```

### The SQL test

`supabase/tests/gc_schedule/30_tells.sql`, a job of its own in a transaction of its own, run by
`scripts/pgtest-gc-schedule.sh` after `20_scenario.sql`; the script applies the migration a second time too. On main
at e5e11fef4 its 22 assertions passed:
- a tell of nothing, of another job's move, and of an undone move refused whole;
- a tell's row with today and the dates shown;
- the same tell again adds nothing and the first stays;
- the version stays;
- the answer refused to a signed-in user, for a move not there, from a company not told, on a move undone since,
  with a day on a yes, with neither, with no day on a no, and with a long note;
- another day asked with its note trimmed, and a second answer refused;
- the grants.

Ten bugs were planted one at a time, and eight failed it:
- a tell of an undone move;
- a tell of another job's move;
- a tell that overwrites the first;
- an answer from any company (the answers' foreign key to its tell refuses it too);
- an answer on a move undone since;
- a yes with a day (the table's check refuses it too);
- a no with no day;
- the answer granted to signed-in users.

Two did not, and neither is a hole:
- *A second answer with the check before the insert taken out*: the race's handler gives the same `alreadyAnswered`, so
  that mutant answers the same.
- *The tell left to anon*: the bed's Postgres grants no function to anon by default, so it cannot tell a revoke from no
  grant. The migration revokes it anyway, as every GC function does, and the grants check pins the result.

### Also in 13a

- `src/lib/gc/gcTradeSubmit.test.ts`: `WAITING` gets `datesTakenBack: 'P5d'` and `dayNeeded: 'P5d'`.
- `docs/migrations/<stamp>_gc_schedule_tells.md`, with the verify steps below.
- `docs/ACCESS_CONTROL.md`: the schedule's bullet says who records a tell and that the answer is the service role's.
- The release note and fragment.

**Verify after the push (the lead):** both functions with their grants (`gc_schedule_record_tells` to `authenticated`,
`gc_trade_answer_dates` to `service_role` alone); `npm run check:migration-drift` clean. **Rollback:** drop the two
functions; nothing calls them until 13b and P5d.

## 13b: Tell the trades

- **`src/lib/gc/schedule/tellWindow.ts`** (new, the window's own; `tellTrades.ts` stays word for word):
  - `companiesNotTold(state, project)`: for each standing move, the companies whose lines it changed and who are not
    in its `toldTo` (call 3), grouped by company as `companiesToTell` does;
  - `tellShown(state, project, move, companyId)`: that company's lines the move changed, with the dates the message
    gives, for the row's `shown`;
  - `datesEmailKey(moveIds)` (call 4);
  - `keptNotToldWords(state, project)`: the kept line's words, `whatIfKeptWords`'s, per company.
- **`src/lib/gc/tellTradesIo.ts`** (new): `tellTheTrades(...)`. For each company: its language, `datesMessage`,
  `sendGcTradeEmail` with kind `dates` and the key, then on an answer that went (or went before),
  `recordScheduleTells` with the send's log id. A refusal is named with its key, in `GC_TRADE_EMAIL_REFUSALS`' words.
  `scheduleIo.ts` gains `recordScheduleTells`.
- **`GcTellTrades.tsx`** (new, the prototype's `GcTellTrades` on real presses): the moves not told, one chip per
  company with its lines and language, the picked company's email as it will go, and **Tell {company}** or **Tell N
  companies**. After it: who was told, and who was not with why. The schedule reads again.
- **`GcScheduleMoves.tsx`**: `GcMoveHistory` takes `tell` (the count and the press) and, per move, the untold line,
  the answers' words, and the told-then-undone line (call 11).
- **`GcScheduleWalk.tsx`**: the walk's last screen (`data-walk-told`) says *The trades and the customer's Friday
  report are told from this list. Telling them comes later. …*. It is amended where it stands: *Tell the trades from
  Changes to the schedule, under the chart.* Its render test's plain-words list moves with it.
- **`GcWhatIf.tsx`**: `GcWhatIfKept`, over the chart when the copy is not shown.
- **`GcSchedule.tsx`**, **`GcScheduleWindow.tsx`**, **`GcProjects.tsx`**: `canTell` from `canSendGcTradeEmail(role)`, used
  with `moves`, never in the copy.
- **Tests:**
  - `tellWindow.test.ts`: a company refused stays untold, a pull tells only the companies whose dates came in, the key
    is stable and order-blind, the shown lines, the kept words, and the told-then-undone line;
  - `tellTradesIo.test.ts`: one send per company with kind `dates` and its key; the record with the log id after a send
    and after `already`; nothing recorded after a refusal;
  - `GcTellTrades.render.test.tsx`: the chips, the email shown, the press, the result, plain words;
  - `GcSchedule.tell.render.test.tsx`: the count in the record's head, the kept line, none in the copy, none without
    `canTell`.
- **Docs:** the guide *tell the trades their new dates*; `PROJECT_DOCUMENTATION.md`'s Schedule paragraph; `GLOSSARY.md`'s
  *Move · push* gains *told*; `EDGE_FUNCTIONS.md`'s `gc-trade-email` names Tell the trades as the `dates` kind's caller.

## Seams

- **gc 3 (Portal), P5d:** the kind `answer_dates` in `submit-gc-trade-portal`, the two keys' statuses and words, the
  moves in `gc-trade-portal`'s slice behind `TRADE_PORTAL_FIELDS` and its never-sees test, and *These dates work*.
  The rows map into `ScheduleMove { toldOn, toldTo, answers }`, which `datesNotices` and `portalTodos` already read.
  `tradePortalSlice.ts` and `gc-trade-portal` stay the Portal's.
- **PR 10 (#5231):** opens the tells' and answers' policies to the team. It meets 13b in the window's props.
- **The Board's Follow up sheet:** an answer taken on the phone.
- **PR 14:** the trade's chart. Nothing here reads the portal.
- **13c (with gc 3, after P5d):** telling a company its dates are back after an undo (call 11).
- **The walk (9d):** its last screen's sentence about telling, amended in 13b.

## Drift from `SCHEDULE_REAL_BUILD.md`

- *Two edge functions send*: `gc-tell-trades` is dropped for `gc-trade-email`'s kind `dates` (call 1). `gc-schedule-send`
  is PR 15's to settle the same way.
- PR 13's check: *in Spanish* waits on `PORTAL_SPANISH_ON` (call 9).

## The check (13b and P5d on, on "GC test project, delete me", as a dev)

A test company whose email is our own inbox, on the test project's plumbing. Move its bar with a reason. The record of
moves says **Tell the trades · 1**. Press it: the window shows the email; **Tell Test Plumbing**; the inbox gets its
new dates with the portal link; the move reads *Test Plumbing: told today, no answer yet.* From the test link, *These
dates work*; the move reads *Test Plumbing: the dates work.* No real trade is told without the owner's yes.

## Is this the best we can do?

- One sender, one copy of the words, one record per move and company, and the answer on the verb its table's lane
  owns. Everything else was already lifted and tested.
- A send that went is never sent twice, and a tell is never lost: the key and the RPC are both idempotent.
- What it does not do: tell a trade its dates are back after an undo (13c; the office is told, call 11), record a
  phone answer (the Follow up sheet), or send in Spanish before the switch.

## Status

Plan 2026-10-10, gc 4. Amendment 1 the same day: gc 10 co-signed the ten calls at their picks; their checks, the walk's
sentence and call 11 are written in. For gc 3's co-sign and the lead's read-back. 13a's SQL bed-tested on main at
e5e11fef4. Nothing cut or claimed.
