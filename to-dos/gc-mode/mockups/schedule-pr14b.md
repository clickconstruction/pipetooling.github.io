---
name: "The schedule's PR 14b: the trade's chart in its portal"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 14, decision 10 and The reads from outside; GANTT_FEATURES.md G-110; mockups/schedule-pr14.md, call 9 and amendment 1 (gc 3's two conditions); mockups/schedule-pr15.md, call 9 (customer-portal a second importer)
branch: the plan on claude/gc-schedule-pr14b-plan (from origin/spike/gc-mode at bfb15c091); the code from origin/main in one cut, no migration
status: plan 2026-10-10 by gc 4 at the lead's ask. Amendment 1 (2026-10-10) - gc 3 co-signed every call from 96e0d4f31, with two additions written into call 6 (a neighbour's percent is its own report, never our send-back's; three more plants) and its picks for calls 8 and 9. For the lead's read-back. Measured on main at 684ed093d. Nothing cut or claimed.
---

# The schedule's PR 14b: the trade's chart in its portal

## What it is

A trade partner sees its own bars on a job being built in its portal. It also sees the work right before its bars
and the work waiting on them, each by its company's name, never by price (G-110, the mock-up's picture 5). To know
which bars are before and after, the chart needs every bar on the job. So it cannot be worked out in the company's
browser from its slice. The portal's read works it out on the server and returns only the answer (decision 10).

What is on main already:

| Piece | On main | From |
|---|---|---|
| `portalSchedule`, `portalScheduleX` | lifted word for word | PR 1b |
| The chart's words, in English and Spanish (`schedTitle`, `schedIntro`, `schedBefore`, `schedYours`, `schedAfter`, `schedToday`, `schedDone`, `schedMoved`) | lifted | P0, `portalI18n.ts` |
| `gc-trade-portal`, the company's slice behind its link, read with the service role | deployed | P1b-ii |
| The builders the office reads with: `gcProjectFromRows`, `boardStateFromRows`, `withDraws`, `scheduleFieldsFromRows` | built, pure | Board, Building, PR 6 |
| The proof that a function cannot import `src/lib`, and that a copy with `.ts` on its imports loads | run on the edge runtime v1.70.0 | 14's call 9 |
| The prototype's `GcPortalSchedule.tsx` | on the spike | G-110 |

Nothing draws the chart on main. One cut, with no migration. `gc-trade-portal` is redeployed after it merges.

## The calls

**For gc 3 (Portal), every call. Each comes with the other way:**

1. **A generated copy of the kernels** (14's call 9). `scripts/edge-kernels.mjs` copies what the read needs into
   `supabase/functions/_shared/gcKernels/`:
   - It starts from five entries: `schedule/portalSchedule.ts`, `projectRows.ts` (`gcProjectFromRows`), `boardRows.ts`
     (`boardStateFromRows`), `drawRows.ts` (`withDraws`) and `schedule/rows.ts` (`scheduleFieldsFromRows`).
   - It follows their value imports. Measured on main: 30 files and 9,170 lines, with no package import. That is
     14's 28 files and 8,301 lines, plus `projectRows.ts` and the two files it brings.
   - It keeps `src`'s layout under the copy (`gcKernels/lib/gc/schedule/portalSchedule.ts`), so every relative
     import stays the same with `.ts` added.
   - An import of types alone becomes `import type`, which Deno erases. A type-only import of a file outside the
     copy is fine for the same reason.
   - It refuses a package import, a browser global used at load (`window`, `document`, `import.meta.env`), and an
     import it cannot resolve. Each one names the file.
   - Each file starts with a header: where it came from, *do not edit*, the command to regenerate, and the functions
     that import the copy.

   *Other way:* `.ts` extensions through `src/lib`, which touches every importer of 30 files and still leaves
   deploying files outside `supabase/` unproved.
2. **Kept equal by a test, with its importers listed.** `src/lib/gc/edgeKernels.test.ts` regenerates the copy in
   memory and fails on any difference, naming the file and `npm run gen:edge-kernels`. A change to any of the 30
   files is then a regenerate in its own PR. The same test checks the header's list of importers against the
   functions whose bundles reach the copy. So when 15b makes `customer-portal` a second importer (15's call 9), the
   list changes in that PR. `check:edge-drift` already walks each function's bundle through `_shared/` (v2.4738's
   `walkBundle`), so a regenerate names every importer to redeploy. This is gc 3's second condition, as 15 bends it:
   the list holds the importers, and it is checked. *Other way:* a second copy for `customer-portal`, which would be
   two generated copies of the same files.
3. **Which jobs** (`portalScheduleJobs`, pure, in `_shared/gcTradePortalSchedule.ts`): each job with a trade awarded
   to the company, where the trade's awarded invite is the company's, and where the job is being built. It is
   P5c-1's `awarded` rule with the stage added. A job still bidding, in buyout or lost gets no chart. *Other way:*
   every job it was invited to, which reads bars it has no part in.
4. **The reads, held to those jobs** (`readScheduleRows` in `gc-trade-portal`), with the service role:
   - for the project: `projects` and `gc_projects`, its `gc_trade_packages`, and its `gc_scope_items`, which name
     a line before its statement of work;
   - for the trades: only each trade's awarded invite (`awarded_invite_id`), so the companies that bid and lost are
     never read, and those companies' `id` and `name`;
   - for the percent, as the office reads it: the awarded trades' `gc_sows`, `gc_sow_lines`, `gc_sow_line_reports`,
     `gc_draws` and `gc_draw_lines` (`lineOf`: the open send-back's `we_see`, else the newest report);
   - for the bars: `gc_schedules`, `gc_schedule_activities`, `gc_schedule_links` (before and after), and
     `gc_schedule_baselines` with their dates (days slipped).

   Every other schedule table goes to the builders empty: moves, walks, notices, waits, counts, sends, what-ifs,
   rough, templates, marks, parts and failures. The answer reads none of them. A read that can pass PostgREST's
   1,000 rows is paged (the reports and the draw lines). *Other way:* the office's whole board for the job, which
   reads bids, money and people that nothing in the answer uses.
5. **The answer** is `{ today, slice, schedules }`. `schedules` maps a project's id to `portalSchedule`'s answer,
   and a job only appears when it has one. The page reads a missing `schedules` as no chart. So the function and
   the client can deploy in either order. The sample token's answer (`gcTradePortalSample`) gains a schedule for
   its made-up job, so the chart shows on What customers see. *Other way:* the chart inside `slice`, which would mix
   a worked-out answer into the rows the page maps.
6. **What reaches the answer, exactly** (gc 3's first condition, made exact):
   - the company's own bars;
   - the bars right before and right after them, by link, each with its company's name, its dates, its percent and
     its days slipped;
   - nothing else.

   By design, a neighbour's name and percent do reach the answer. G-110 draws them, and the portal's own words
   (`schedIntro`) promise them: *Other companies' work shows by name, never by price.* **The never-sees test**
   (`gcTradePortalSchedule.test.ts`) plants, on the same job:
   - a third company whose bars are neither before nor after the trade's;
   - a distinct dollar figure on every line, statement of work, budget and our price;
   - notes in a move and in another company's late notice;
   - a second job with no trade of theirs;
   - a job in buyout.

   It asserts the answer's JSON holds none of the planted words or figures. It also asserts the answer holds the
   neighbours' names and percents, so the test pins both sides. *Other way:* neighbours drawn without a name. The
   trade would then not know whom to call.

   **A neighbour's percent is its own** (gc 3, amendment 1). `lineOf` reads the open send-back's `we_see` first, and a
   send-back is between us and that trade. On a neighbour it would show another company that we doubted its draw,
   and by how much. So before `portalSchedule` runs, the read drops the open send-back from every trade that is not
   the company's (`withoutOthersSendBacks`). A neighbour's bar then reads its newest report, or what its pay
   application claimed. The company's own bars keep `lineOf` as the office reads it, since its portal already shows
   it our send-back. No lifted kernel changes. The never-sees test plants three more (gc 3), and none may reach the
   answer:
   - a neighbour's contacts, an email and a phone in `gc_company_people`;
   - an open send-back on a neighbour, with a `we_see` that differs from its report and a `sent_back_note`;
   - a neighbour's draw amounts.

   It asserts the neighbour's percent is its report, and the company's own percent is the office's. The chart names
   the company, and the trade calls our office, not the neighbour.
7. **Our own crew as a neighbour** shows its name and dates, with no percent. The board alone reads none for our
   crew. Building's U8 reads it from the crew's Pipeline job (`crewJobRows.ts`, `list_job_stage_progress`), which
   a no-sign-in function should not read for a percent. At 0 the chart draws no fill and no percent, so the bar
   reads as dates only. *Other way:* U8's read here, which adds three files and a read of the Pipeline's jobs.
8. **The page:** `GcTradePortalSchedule.tsx` (new) is the prototype's `GcPortalSchedule` drawn from the answer, not
   from a state:
   - it has three groups (before you, yours, after you), with Today down the chart;
   - it is light, on the portal's paper, in the company's language;
   - it sits first in the job's block on a job being built, right under the job's name and above the report (gc 3's
     pick, amendment 1). Its dates frame everything below it. The rows under *Needs you* still open the job at their
     own blocks;
   - it has no press in 14b.

   `readTradePortalAnswer` passes `schedules` through, and the view hands each job its own.
9. **The late door's seam with P5d-ii.** The prototype puts *We will be late* under each of the trade's own bars on
   the chart (`GcPortalLate`). P5d-ii ships its door first, on its own block. 14b gives each own row a slot
   (`ownRow`, a render prop). So P5d-ii's door can move under the bar without the chart knowing what the door does.
   gc 3's pick (amendment 1): whichever of 14b and P5d-ii lands second decides. If 14b is on main when P5d-ii cuts,
   the door goes straight into `ownRow`, under the trade's own bar as the prototype has it. If P5d-ii lands first, its
   door ships on its own block, and moving it under the bar is a small follow-up of gc 3's. *Other way:* the door
   built into the chart, which ties 14b to P5d-ii's presses.
10. **Boot time.** `gc-trade-portal` grows by about 9,200 lines of plain TypeScript. Its cold boot is measured on
    the local edge runtime before and after, and with `check_edge_boot` after the deploy. If it boots slowly, the
    chart moves to a function of its own, `gc-trade-schedule`, read beside the slice. *Other way:* a function of its
    own from the start, which is one more deploy and one more fetch for every portal page.

## The cut

- **`scripts/edge-kernels.mjs`** (new) and `npm run gen:edge-kernels`. Then the copy itself,
  **`supabase/functions/_shared/gcKernels/`**, as it generates (calls 1 and 2).
- **`supabase/functions/_shared/gcTradePortalSchedule.ts`** (new, pure): `portalScheduleJobs` (call 3),
  `withoutOthersSendBacks` (call 6) and `portalSchedulesFromRows(rows, companyId, today)`. These build each job's
  state with the copy and return `portalSchedule`'s answers.
- **`supabase/functions/gc-trade-portal/index.ts`**: `readScheduleRows` (call 4) after `readRows`, and `schedules`
  on the answer (call 5). Its header names the chart.
- **`supabase/functions/_shared/gcTradePortalSample.ts`**: the made-up job's schedule.
- **`src/lib/gc/tradePortalPage.ts`**: `readTradePortalAnswer` keeps `schedules`, and reads a missing one as `{}`.
- **`src/components/gc/GcTradePortalSchedule.tsx`** (new), wired into `GcTradePortalView` and the job's block
  (call 8), with the `ownRow` slot (call 9).
- **Tests:**
  - `src/lib/gc/edgeKernels.test.ts`: the copy equals a regenerate; the importers' list matches the bundles; a
    planted package import, browser global or unresolved import is refused by name;
  - `src/lib/gc/tradePortalSchedule.test.ts` (over `_shared/gcTradePortalSchedule.ts`): the jobs (call 3), the answer
    on main's test state laid out as rows, which matches `portalSchedule` on the same state, and the never-sees test
    (call 6);
  - `src/pages/GcTradePortal.schedule.render.test.tsx`: the chart from an answer, three groups and Today; nothing when
    the job has none; Spanish words when the company's language is Spanish; a neighbour's name and never a dollar
    sign;
  - the answer reader's test: a missing `schedules` is no chart.
- **The proof at the cut:** `supabase functions serve gc-trade-portal` on the local edge runtime answers the sample
  token with its schedule. Then the cold boot before and after (call 10).
- **Docs:**
  - `docs/EDGE_FUNCTIONS.md`: `gc-trade-portal`'s section gains the chart, and `_shared/gcKernels` gets a line on
    how it is kept;
  - `PROJECT_DOCUMENTATION.md`'s portal paragraph;
  - `GLOSSARY.md`'s *Trade partner company* gains its chart;
  - the guide *share a trade partner its portal*: its *What the company sees* gains the chart;
  - the release note and fragment.

## Seams

- **gc 3 (Portal):** the function, the slice, the page and the place of the chart (call 8), and the late door
  (call 9). P5d-ii and 14b touch `gc-trade-portal` and the job's block, so whichever lands second rebases.
- **15b (gc 1):** `customer-portal` becomes the copy's second importer. It adds its entry (`customerSchedulePicture`)
  and its name to the list in its own PR (15's call 9).
- **Building's U8:** our crew's percent on the chart waits on a reason to read the Pipeline from the portal (call 7).
- **Every lane with a file in the copy:** a change to one of the 30 files is a regenerate in the same PR, and the
  test says so. The list of files is in the copy's index, and in the test's failure.

## Drift from `SCHEDULE_REAL_BUILD.md`

- Decision 10 says *the function imports them*. It cannot, as `src/lib` stands (14's call 9). The fallback, *a copy
  in `_shared/`, kept equal by a test*, is this plan, generated rather than hand-kept.
- PR 14's check is split. *A late notice reaches the office's card* is 14c's and P5d-ii's. The chart is this
  plan's.

## The check (14b on, on "GC test project, delete me")

The test company's link shows *Your schedule on this job*, with its bars, the work before and the work after, each
neighbour by name. A third company on the job never shows. With `PORTAL_SPANISH_ON`, the words are in Spanish. A
move on the office's chart shows on the trade's chart on its next read.

## Is this the best we can do?

- One copy of the rules, generated, with a test, so the office's chart and the trade's chart read the same bars.
- The answer is worked out where every bar is, and only the answer leaves.
- The read is held to the jobs the company works on, and to the tables the answer reads.
- What it does not do: the chart across every job at once (G-110 says one job at a time), our crew's percent
  (call 7), or the late door under the bar (call 9, gc 3's).

## Status

Plan 2026-10-10, gc 4, at the lead's ask. Amendment 1 the same day: gc 3 co-signed every call, with a neighbour's
percent read from its own report and three more plants in the never-sees test (call 6), the chart first in the job's
block (call 8), and the late door decided by whichever of 14b and P5d-ii lands second (call 9). For the lead's
read-back. Nothing cut or claimed.
