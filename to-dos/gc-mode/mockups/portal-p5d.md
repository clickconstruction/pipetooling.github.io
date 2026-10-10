---
name: "P5d: the trade's side of the schedule in its portal (Portal lane)"
rows: PORTAL_REAL_BUILD.md, The PRs in order, item 11 (P5d) and the verbs table (answer_dates, say_late, keep_day, crew_count, mark_lookahead); SCHEDULE_REAL_BUILD.md decision 10; mockups/schedule-pr13.md (13a's answer), schedule-pr14.md (14a's four verbs, its calls 8 and 9) and schedule-pr14b.md (the chart, its ownRow slot); GANTT_FEATURES.md G-113, G-117, G-142 and the look-ahead
branch: this plan on claude/gc-portal-p5d-plan (from origin/spike/gc-mode at 76dbcb034); the PRs from origin/main once 14b (#5362) is in
status: plan 2026-10-10 by gc 3 (the Portal lane) at the lead's ask, for gc 4's co-sign (the schedule's side) and the lead's read-back. Facts read from origin/main f034feaaf. Nothing cut, nothing claimed.
---

# P5d: the trade's side of the schedule in its portal

A trade partner company working on a job we build does four things with the schedule from its portal:

- **It answers new dates.** The office told it of a move (13b's email). It says *These dates work*, or asks for another day
  with a word on why (G-113).
- **It says a bar will be late** (G-117). It gives the new day, why, and a sentence, and it sees what that day does to the
  work waiting on it. Later it reads the office's answer. After a push back it can say *We will make* the day.
- **It gives its crew count** for this week and the next two (G-142).
- **It marks its look-ahead** done or not done, with why, for last week and this week, until our superintendent checks it.

This plan is P5d-ii, with 13a's `answer_dates` folded in (the plan's P5d-i): the five kinds and their blocks in one train.
P5d-iii (`report_part` with the schedule's PR 16) stays its own.

## What is on main already

- **The five verbs**, each `SECURITY INVOKER`, the service role's alone, with the link's company first:
  - `gc_trade_answer_dates(p_company_id, p_move_id, p_ok, p_day, p_note)` → void (13a, `20261010110000`);
  - `gc_trade_say_late(p_company_id, p_activity_id, p_day, p_reason, p_note)` → the notice's id;
  - `gc_trade_keep_day(p_company_id, p_notice_id)` → void;
  - `gc_trade_set_crew_count(p_company_id, p_package_id, p_week_of, p_count)` → void;
  - `gc_trade_mark_lookahead(p_company_id, p_activity_id, p_week_of, p_done, p_reason)` → void (all 14a,
    `20261010160000`).
- **The ten keys** parked in `gcTradeSubmit.test.ts`'s `WAITING` as `'P5d'`: `datesTakenBack`, `dayNeeded` (13a);
  `workDone`, `lateLaterDay`, `pickWhy`, `notPushedBack`, `noticeClosed`, `weekClosed`, `crewWhole`, `alreadyChecked`
  (14a). The others they raise are mapped: `notFound`, `notYours`, `notOnTrade`, `jobNotBuilding`, `badRequest`,
  `dayPassed`, `alreadyAnswered`, `noteNeeded`, `tooLong`.
- **The kernels, lifted:** `datesNotices` and `datesMessage` (`schedule/tellTrades.ts`); `lateDoor`, `lateTarget`,
  `lateNoticeProblem`, `lateWaiting`, `portalLateNotice` and `lateNoticesToAnswer` (`schedule/lateNotices.ts`);
  `crewWeeks`, `crewCountAllowed`, `crewCountsNow`, `crewCountProblem` and `portalCrewAsks` (`schedule/crewCounts.ts`);
  `portalLookAhead` and `lookAheadOwed` (`portal.ts`). `portalTodos` already writes the four to-dos (`todoDates`,
  `todoLatePushed`, `todoLookLate`, `todoLookWeek`). They never show today, because the page's state has no schedule.
- **The words**, both languages: `dates*`, `late*`, `crew*`, `look*`, `week*`, `mark*`, `checked*`, `reason*`.
- **The office's side**: 13b sends the dates and records the tells; 14c's card takes or pushes back a notice and checks a
  mark.
- **14b (#5362, open)**: the generated copy of the kernels (`_shared/gcKernels/`), `readScheduleRows` and the chart in
  `gc-trade-portal`'s answer (`schedules`), and the `ownRow` slot under each of the company's own bars.
- **On the spike, not main:** `GcPortalDatesMoved.tsx`, `GcPortalLate.tsx`, `GcPortalLookAhead.tsx`,
  `GcPortalCrewCount.tsx` (about 550 lines).

## What a trade sees (on a job being built)

The job's block, top to bottom: the chart (14b), with **We will be late** under each of the company's own bars (the
`ownRow` slot); **Your dates moved** while a told move waits for its answer; **Your next three weeks** (the look-ahead),
with the crew count beside each coming week; then the blocks P5c put there. Needs you lists the four schedule to-dos,
each opening the job at its block (`dates`, `late`, `lookahead`).

The screens are the spike's four components, lifted, not redrawn. Their `dispatch` is swapped for the press hook
(`usePress`), and they read the answer below in place of a state, as P1b and P5c lifted theirs.

## The calls (each with the other way)

1. **Worked out on the server, as the chart is** (decision 10). Every kernel here reads the whole job: `lateWaiting`
   runs `planMove` over every bar and link, `lateNoticeState` reads the moves, and `datesNotices` rebuilds the message
   from the move. So `gc-trade-portal` runs them on the state 14b's read builds, and returns only their answers, in a new
   key on its answer: `scheduleWork`, a map from a project's id to `{ dates, late, lookAhead, crew }`. A job appears only
   when it has something to show. The page reads a missing `scheduleWork` as none, so the function and the client
   deploy in either order. *Other way:* the schedule's rows in the slice and the kernels in the browser. Not taken: the
   page would hold every bar, link and move on the job, other companies' and the office's notes included.

2. **It needs 14b first.** It reads with 14b's `readScheduleRows` and runs on its kernel copy, so P5d-ii is cut from main
   once #5362 is in. The read gains what 14b leaves empty, held to the company's jobs being built:
   - the moves: id, line, dates, `undone_on`, and the late notice a move carries;
   - this company's own `gc_schedule_move_tells` and `gc_schedule_move_answers`;
   - every `gc_schedule_late_notices` row on its jobs, because a notice's state reads the bar's other notices; only its
     own leave;
   - its own trades' `gc_schedule_crew_counts`, and its own bars' `gc_schedule_lookahead_marks`.

   The copy gains four entries: `schedule/tellTrades.ts`, `schedule/lateNotices.ts`, `schedule/crewCounts.ts` and
   `portal.ts`. The closure is measured at the cut, against 14b's 30 files. If `portal.ts` pulls in too much, the cut
   says how much, and the lead decides before it opens. *Other way:* a second function for the schedule work, which is
   one more fetch for every portal page (14b's call 10 measures the boot with both).

3. **What leaves, exactly.** Each kernel's answer is mapped to plain fields. No `ScheduleRow`, `GcProject` or `Partner`
   leaves:
   - `dates`: each told move not answered, with its id, the day told, and the message as it went (`datesMessage`, in the
     company's language);
   - `late`: each of its own bars with a door (`lineId`, the work's name, `start`, `finish`, `started`, `day`), with its
     own newest notice where `portalLateNotice` shows one: state, the dates asked, reason and sentence, our push back's
     day and sentence, and its own word that it will make the day;
   - `lookAhead`: `portalLookAhead`'s weeks, each item as `lineId`, work, `start`, `finish`, its mark (done or not done,
     with reason), our check (`verified`, `checkedReason`) and `canMark`;
   - `crew`: `crewWeeks(today)` and, for each of its trades on the job, the trade's name, the count that stands each
     week, and whether it may give one.

   **The never-sees test** (`tradePortalScheduleWork.test.ts`) plants, on the same job: another company's notice, mark
   and crew count; a move's note that was never told to this company; an office note on a check of another trade; and a
   dollar on every line. It asserts none of them reaches the answer, and that the company's own items do, so both sides
   are pinned. *Other way:* pass the kernels' objects whole, which carry the trade package and its invites.

4. **What waits on it, live** (G-117's second look). The door shows what the picked day does to the work waiting on the
   bar, as the trade picks it. That is `lateWaiting`, which needs the whole schedule. So `gc-trade-portal` answers a
   read-only preview: `GET ?t=<link>&late=<lineId>&day=<YYYY-MM-DD>` returns `lateWaiting`'s answer, each item as work,
   company name, new start and days. That is the same names the chart's *after* group already shows, and never a price.
   It answers only for a bar of the company's own with a door, and a day after the door's day; anything else is `{ }`.
   The page asks 400 ms after the day settles, and a failed preview shows no lines. *Other way:* compute it for a range
   of days on every read, which runs the scheduler dozens of times per page load. Or leave the second look out.

5. **The to-dos come from the server.** `gc-trade-portal` runs `portalTodos` on its state and returns only the schedule's
   to-dos (`dates:`, `late:` and `:lookahead` keys) as `scheduleTodos`. The page adds them to the ones it works out from
   the slice. `portalTodos` is a lifted kernel and stays word for word. *Other way:* split `portalTodos`, which breaks
   `lift-same`.

6. **The late door sits in 14b's `ownRow` slot**, under the company's own bar, as the prototype draws it
   (`GcPortalLate`). Since P5d-ii is cut after 14b (call 2), there is no first home on a block of its own.

7. **The kinds** on `submit-gc-trade-portal`:

   | Kind | Fields | Verb | Answer | Hourly cap |
   |---|---|---|---|---|
   | `answer_dates` | `moveId`, `ok`, `day` (when not ok), `note` | `gc_trade_answer_dates` | `{ ok }` | no: one answer a tell |
   | `say_late` | `activityId`, `day`, `reason`, `note` | `gc_trade_say_late` | `{ ok, value: noticeId }` | **yes**, with the free-text kinds |
   | `keep_day` | `noticeId` | `gc_trade_keep_day` | `{ ok }` | no: once a notice |
   | `crew_count` | `packageId`, `weekOf`, `count` | `gc_trade_set_crew_count` | `{ ok }` | no |
   | `mark_lookahead` | `activityId`, `weekOf`, `done`, `reason` | `gc_trade_mark_lookahead` | `{ ok }` | no: changed in place |

   `parseTradeSubmit` checks the shape: uuids, `YYYY-MM-DD` days, a Monday for `weekOf`, `reason` from the five
   (`LATE_REASONS`), `count` a whole number, text under its cap. The verbs check the rest. `say_late` joins
   `FREE_TEXT_KINDS`, and `freeTextCounts` counts `gc_schedule_late_notices` by `company_id` in the last hour (14's
   call 8). *Other way:* cap `crew_count` too. Not taken: each press adds one small row, and a trade with several
   trades gives several counts a week.

8. **The keys' statuses and words** (409 for a state, 400 for a field, as P5c's decision 2):

   | Key | Status | Words (EN; Spanish written beside them) |
   |---|---|---|
   | `datesTakenBack` | 409 | {gc} took those dates back. Reload the page. |
   | `dayNeeded` | 400 | Pick the day that works. |
   | `workDone` | 409 | That work is done. |
   | `lateLaterDay` | 400 | Pick a later day. |
   | `pickWhy` | 400 | Pick why. |
   | `notPushedBack` | 409 | {gc} has not answered yet. |
   | `noticeClosed` | 409 | That is closed. The schedule moved since. Reload the page. |
   | `weekClosed` | 409 | That week is closed. Reload the page. |
   | `crewWhole` | 400 | A whole number, 0 to 50. |
   | `alreadyChecked` | 409 | {gc} checked it already. Reload the page. |

   Each goes into `TRADE_SQL_ERRORS`, `TRADE_ERROR_WORDS` and `portalI18n.ts`, and comes off `WAITING`. The form checks
   first with the lifted checks (`lateNoticeProblem`, `crewCountProblem`), so a refusal is the fallback. `tradeErrorWords`
   fills only `{gc}`, so `lateLaterDay` says no date (14's co-sign).

9. **The sample.** `gcTradePortalSample` gains the made-up job's schedule work: a told move to answer, an own bar with a
   door and a pushed-back notice, a look-ahead with this week to mark, and the crew weeks. So What customers see shows
   every block, and a press on the sample answers ok and writes nothing (decision 12).

## The PRs, in order

Each is cut from `origin/main`, claimed at the cut, with its release note, fragment and docs, opened unarmed for the lead.

1. **P5d-ii-1, the read and the kinds** (after 14b is in; no migration, no screen):
   - `scheduleWork` and `scheduleTodos` (calls 1 to 5);
   - the preview (call 4);
   - the copy's four entries (call 2);
   - the five kinds and the ten keys, with their words (calls 7 and 8);
   - the sample's schedule work (call 9).

   *Check:* `supabase functions serve gc-trade-portal` answers the sample token with its schedule work, and the
   cold boot is measured against 14b's.
2. **P5d-ii-2, the blocks**:
   - the four components lifted onto the answer, with the late door in `ownRow` (call 6);
   - Needs you adds `scheduleTodos`, each opening its block;
   - the blocks drawn only for a job being built that has the work, and hidden in the preview where a kind is not live.

   *Check:* the live walk below.

## Tests

- **P5d-ii-1:**
  - `parseTradeSubmit` for each kind (the shapes, a Monday, the five reasons, the count);
  - the guard test with `WAITING` empty of `'P5d'`;
  - `freeTextCounts` with the notices;
  - `tradePortalScheduleWork.test.ts`: each answer on main's test state laid out as rows, equal to the kernels on the
    same state, plus the never-sees test (call 3);
  - the preview: a bar not its own, no door, or a day not after the door's is `{ }`; a good one equals `lateWaiting`;
  - the answer reader: a missing `scheduleWork` is none.
- **P5d-ii-2:** a render test per block, using the spike's tests where they exist (`GcPortalDatesMoved.render.test.tsx`).
  Each press posts its kind and body. A refusal is said in the company's words. The preview posts nothing. Each new
  sentence passes `plainWordsFailures`.

## Docs

- `EDGE_FUNCTIONS.md`: `gc-trade-portal`'s `scheduleWork`, `scheduleTodos` and the preview; `submit-gc-trade-portal`'s
  five kinds and ten keys.
- `ACCESS_CONTROL.md`: the Portal's bullet (the link holder's five schedule writes, service role only).
- `PROJECT_DOCUMENTATION.md`'s trade portal paragraph.
- The guides:
  - `share-a-trade-partner-its-portal`: what the company does with its schedule;
  - 14c's late notice guide: the notice comes from the portal;
  - the dates guide (13b): the answer comes from the portal.
- A release note and fragment for each PR.

## Deploys (the lead's, each worked out by an import walk at the cut)

- P5d-ii-1: `gc-trade-portal`, `submit-gc-trade-portal`, and every function that bundles `_shared/gcTradeSubmit.ts`
  (today `gc-trade-email`, `send-contract-for-signature` and `submit-portal-request`).
- P5d-ii-2: none, unless the answer's shape moved.

## The live check (on "GC test project, delete me", from the test company's link)

Each press writes prod, so each waits for the owner's yes, typed in the pressing helper's own chat. A relayed yes is no
yes. The office tells the test company of a move (13b), and the company answers it. It says one of its bars will be late
by two days, with the preview showing the work waiting, and the office's card reads it. The office pushes it back, and
the company says it will make the day. It gives a crew count for next week, and marks this week not done for weather.
Our check of that mark locks it in the portal.

## Seams

| Piece | Owner |
|---|---|
| The five verbs, their tables, beds and keys' `DETAIL` | the Schedule lane (13a, 14a), on main and prod |
| The chart, the copy of the kernels and `ownRow` | the Schedule lane (14b, #5362) |
| The office's card and check (14c), and the tells (13b) | the Schedule lane, on main |
| `scheduleWork`, `scheduleTodos`, the preview, the kinds, the keys' words, the blocks | Portal (this plan) |
| A change to a kernel in the copy | the lane that owns the kernel, regenerated in its own PR (14b's test) |
| The deploys and the push | the lead |

## Decisions (defaults; say if any is wrong)

A. P5d-i (`answer_dates`) rides in P5d-ii, since all five share the read.
B. Two PRs: the read and kinds first with no screen, then the blocks.
C. The live preview is a read-only GET on `gc-trade-portal` (call 4).
D. `crew_count` is not capped (call 7).

## Is this the best we can do?

1. **One read for the chart and the work.** A trade's whole schedule picture is worked out where every bar is, and only
   the answers leave. That is the same rule as the chart, and the same kernels as the office.
2. **The second look stays live** without the scheduler in the browser, at one small read per day the trade picks.
3. **What it does not do:** `report_part` (P5d-iii with PR 16), the start reminders (the Board's promise), and our crew's
   percent (14b's call 7).

## Status

Planned 2026-10-10 by gc 3, read from origin/main f034feaaf over 14b's plan (`schedule-pr14b.md`, amendment 1). For
gc 4's co-sign and the lead's read-back. Nothing cut or claimed.
