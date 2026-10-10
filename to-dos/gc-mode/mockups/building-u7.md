---
name: "Building U7: the Friday report"
rows: BUILDING_REAL_BUILD.md, The PRs in order, 7; decisions 4 and 10; Kernels that move (U2's `weeklyReport` row); owner-billing plans (gc-customer-email, O4b); SCHEDULE_REAL_BUILD.md (PR 15, the customer's letter)
branch: the plan on claude/gc-building-u7-plan (from origin/spike/gc-mode at 6ac8813b0), merged to the spike by the lead; U7a from origin/main once this plan merges; U7b after U7a; U7c on U7b's deploy
status: plan 2026-10-10 by gc 4 (the Building lane) at the lead's ask, with the lead's call written in (a `weekly` kind on Owner Billing's gc-customer-email, not a new function). U7a's lift ran dry on the spike at 6ac8813b0 and its moved tests passed on main at 3c836ad80. Amendment 1 (2026-10-10): gc 5 co-signed calls 4 to 11 with notes, written into U7b below; U7a cut as #5263 (v2.5134); the follow-up's branch is claude/*; the journey step's guide until U7c.
---

# Building U7: the Friday report

## What it is

The weekly report to the customer on real data: a draft each Friday from the week's records (the daily logs, the schedule
and its finish, inspections, submittals, what held work up, next week's look-ahead and change orders), read and sent by
the office, from me (my own mail) or from the company, and kept as sent.

- **U7a, the lift** (no database, no screen): `weeklyReport` moves from the spike's `gcBuildingWeekly.ts` into main's
  `src/lib/gc/buildingWeekly.ts`, with its tests. It waited in U2 for Owner Billing's `lateFinish`, on main since O2b
  (#4956). The spike's follow-up deletes it there and re-exports it from main, pinned.
- **U7b, the `weekly` kind on `gc-customer-email`** (no migration; one function deploy): the report sent from the
  company, its sent copy filed, and its row marked sent. Owner Billing's function, so its shape is co-signed by gc 5.
- **U7c, the report window** (no migration): ported from the prototype's `GcBuildingWeekly.tsx`, on the Daily log
  window, with the mapper and the io, and the guide *send the customer the Friday report*.
- **The portal half waits on the schedule's PR 15** (the customer's letter): the newest report for each week in the
  customer's portal (`latestWeeklyReports`, on main since U2) shows with that PR, since the portal's GC page is its.
  Until then a report is kept on the job and in the customer's email.

## The calls

**The lead's (2026-10-10):**

1. **A `weekly` kind on Owner Billing's `gc-customer-email`, not a new function.** One customer email function keeps
   the sends-on-by-default flip and the test-send door in one place. gc 5 co-signs the kind's shape: its words, who
   gets it, the `[TEST]` copy and the sent-copies ratchet.
2. **The portal half waits on the schedule's PR 15.**
3. **The lift follows the schedule's shape**: `lift-extract` and `lift-same`, the config pinned after the spike's
   follow-up, which gc 7 checks before the lead merges it.

**For gc 5 to co-sign** (the kind's shape, gc 4's picks; each says what changes in the function):

4. **Who may send a weekly report: the row decides, not the money team's list.** The function reads the report's row
   with the caller's own JWT, so RLS decides (dev today, the schedule's team at Building's door), as `gc-architect-email`
   does. The other kinds keep `GC_CUSTOMER_EMAIL_ROLES`. A training account and a twin are refused as today.
5. **The row first, then the send** (the reminder's pattern). The window inserts the `gc_weekly_reports` row
   (`sent_from = 'company'`), then calls the function with its id. The function sends the row's own subject and body,
   files the copy, and writes the row's `email_send_log_id`. A row whose email has not gone is not a sent report: every
   reader counts a company row only once `email_send_log_id` is set. A refused or failed send is pressed again on the
   same row, and a row already sent answers `alreadySent`.
6. **Its address: the customer's contact first.** A weekly report goes to the person who runs the job for them
   (`contact_info`'s email), then to the billing email. The bills keep billing first.
7. **The architect copied** when the row says so (`copied_architect`): `cc` to the architect's address
   (`gc_projects.architect_customer_id`), which `sendEmailViaResend` and the sent copy already carry. No address: no copy,
   and the answer says so (`copied: false`). The window offers the tick only when the architect has one.
8. **No frame around it.** The report's body carries its own greeting and sign-off (`weeklyReportText`), so the function
   adds no closing lines for this kind. The From name stays Click Construction and the Reply-To the project manager.
9. **Filed as `field_report_gc_weekly`**, so the sent copy lands with the Statements (`field_report`'s prefix). No
   migration: `sent_documents.kind` takes any word of its shape.
10. **No portal line yet** (`GC_CUSTOMER_EMAIL_PORTAL_LINE.weekly = false`) until PR 15 shows the reports there.
11. **The `[TEST]` copy, for every kind.** A request with `test: true` sends to the caller's own email only, with
    `[TEST]` before the subject, no copy to anyone, nothing filed and no row written. The report window's **Email me a
    test** uses it, so Grace sees one before any customer does. The Monday money email's `test_send` is the pattern.

## U7a: the lift

The config, `to-dos/gc-mode/scripts/building-u7.lift.json` (the pin added by the spike's follow-up):

```json
{
 "about": "The Building lane's U7a (to-dos/gc-mode/mockups/building-u7.md): weeklyReport, which waited in U2 for Owner Billing's lateFinish (on main since O2b, #4956). Run: node to-dos/gc-mode/scripts/lift-extract.cjs to-dos/gc-mode/scripts/building-u7.lift.json <outDir>",
 "spikeDir": "src/lib/gcMode",
 "mainBase": "src/lib/gc",
 "existing": {
  "src/lib/gcMode/gcTypes.ts#GcState": "types.ts",
  "src/lib/gcMode/gcTypes.ts#GcProject": "types.ts"
 },
 "standIns": {
  "src/lib/gcMode/gcFixture.ts#initialGcState": "schedule/testState.ts"
 },
 "files": [
  {
   "from": "gcBuildingWeekly",
   "to": "buildingWeekly.ts",
   "moves": [
    "weeklyReport"
   ],
   "append": true
  }
 ],
 "tests": [
  {
   "from": "gcBuildingWeekly.test.ts",
   "to": "buildingWeekly.report.test.ts",
   "header": "// GC mode, the real build, the Building lane's U7a: weeklyReport's tests, moved from the prototype (branch spike/gc-mode, gcBuildingWeekly.test.ts)."
  }
 ]
}
```

**The dry run** (the spike at 6ac8813b0, main at 3c836ad80): `lift-extract` places every name. It writes 7 declarations
into `buildingWeekly.ts`'s append, `weeklyReport` and its six private helpers (`KIND_WORDS`, `days`, `weekdayShort`,
`WEEKDAY_NAMES`, `weekdayName`, `lowerFirst`), and finds `sentence` already on main as U2's kept copy. Every import
`weeklyReport` reads is on main: `lateFinish`, `customerStages`, `customerChanges`, `customerAsks`, the schedule kernels,
`dailyLogOn`, `isWorkday`, `submittalRowsOn`, `partnerById`, `shortDate` and `weekdayDate`. `lift-append --write` merged the
imports into main's file. The four tests it moves passed on main against `schedule/testState.ts` unchanged: 8 of 8 with
main's own `buildingWeekly.test.ts` and `.direct.test.ts`. One of the four, *only for a job being built, and only from
Friday*, is already main's (moved by U2 and never dropped on the spike); U7a leaves it out of the moved file. The test
that plays the reducer (`sendWeeklyReport`) stays on the spike.

**U7a on main**: `buildingWeekly.ts` gains `weeklyReport` and its helpers, its header's "waits for U7" line goes,
`buildingWeekly.report.test.ts` holds the three moved cases, and the release note and fragment. No schedule test state
changes: Fair Oaks D already carries the week's logs, its schedule, submittals and change orders.

**The spike's follow-up** (`claude/gc-building-u7-follow` from the spike, the lane's, after U7a merges; never a `spike/*` branch): merge main; `lift-extract` with
`LIFT_PLACEMENTS`, then `lift-reexport --write`, so `gcBuildingWeekly.ts` keeps only its header and the re-exports from
main; drop the three moved tests by title from `gcBuildingWeekly.test.ts`, and the duplicate; pin the config to U7a's
merge on main and the spike just before; `lift-same --all` exit 0, `schedule-test-state.ts` byte-equal, `tsc -b` at a 12
GB heap, the GC suites. gc 7 checks, the lead fast-forwards the spike.

## U7b: the `weekly` kind on `gc-customer-email`

`supabase/functions/_shared/gcCustomerEmails.ts` (pure, with its tests) and `supabase/functions/gc-customer-email/index.ts`:

- `GC_CUSTOMER_EMAIL_KINDS` gains `'weekly'`, and each per-kind record its entry: `TO` `'customer'`, `SOURCE`
  `'gc_weekly_reports'` (the source type widens), `FILED_AS` `'field_report_gc_weekly'`, `PORTAL_LINE` false.
- Two new per-kind records, so the rule has one home: `GC_CUSTOMER_EMAIL_ADDRESS` (`'billing'` for every kind but
  `weekly`'s `'contact'`) and `GC_CUSTOMER_EMAIL_FRAMED` (true for every kind but `weekly`).
- `index.ts` gains a `gc_weekly_reports` branch ahead of the reminder's bare `else`, so a new source never falls into
  it. The branch reads the row with the caller's JWT (call 4): not found or not readable is `notFound`, another job's is
  `otherProject`, a row from me is `badRequest`, and a row already sent is `alreadySent`. Its subject and lines are the
  row's own (its body split on blank lines), as the reminder's are.
- The send carries `cc` with the architect's address when the row says to copy them (call 7). The sent copy records
  `cc` too.
- After filing, it writes `gc_weekly_reports.email_send_log_id` by `resend_email_id`, as the reminder's branch does, with
  the service role, since `authenticated` has no UPDATE on the table.
- `test: true` on any kind (call 11): `[TEST]` before the subject, to the caller's own email, no `cc`, nothing filed,
  no row written, `alreadySent` not checked. No email on the account: `noEmail`.
- The answer gains `copied` (the architect copied or not) and `test` (a test copy).

The client: `GcCustomerEmailRequest` gains `test?`; `customerEmail.ts` needs no builder for this kind, since the row is
the words. The registries a kind on an existing function touches: a `G('gc-weekly-report-email')` step on
`gc-customer-email`'s sender (`customerSurfaceRegistry.ts`), its journey step (`customerJourneys.ts`, the guide *send the
customer the Friday report*), its sample (`customerSampleEmails.ts`, From Click Construction, built from Fair Oaks D's
week), its line in `personJourney.ts` (`na('GC mode: read on the GC project')`), and `customerEmail.test.ts`'s table of
kinds. No new function, so `config.toml`, the email catalog's 49 rows and the sent-copies coverage stay as they are.

**Its tests**: `_shared/gcCustomerEmails.test.ts` (the records, the address rule, no frame for `weekly`, the `[TEST]`
subject), and `customerEmail.test.ts`'s kinds table.

**gc 5's co-sign (amendment 1, 2026-10-10)**: yes to calls 4 to 11, with these, which U7b builds:

- **4, the order of the gate**: a real account (`REAL_ACCOUNT`), a training account and a twin refused, then the row read
  with the caller's JWT. Reading the row is enough to send it while the row is dev only. **Building's door decides** whether
  that still holds once the schedule's team can SELECT, or the gate moves to the insert (the row's `sent_by` is the caller)
  or to an RPC that locks the row. It goes on the door PR's checklist.
- **5, the gap the reminder has too**: a send Resend took whose write-back fails would send twice on a retry. Accepted, as
  for the reminder. The log id is written straight after the send, **before** the copy is filed, so the gap is as short as
  it can be.
- **6, one home for the address**: the contact-first rule is one helper in `_shared`, beside `customerBillingEmail`, with
  its test.
- **7, no architect address**: no `cc`, `copied: false`, and the customer's email still goes.
- **8, the unframed body is escaped**: the row's text is HTML-escaped and split into paragraphs on blank lines. A test holds
  a line with a `<` in it escaped.
- **11, the `[TEST]` copy, for every kind, kept in U7b**:
  - the caller's gate runs exactly as for a real send (the money team, or the row by RLS for `weekly`), so a test is never
    a way around who may send;
  - the test copy is built as the real one would be: the same attachments (`pay_app` and `certify_ask` carry the form), the
    same portal line and the same card-fee line, so Grace sees what the customer would get;
  - it goes to the caller's own address, read from `users` with `REAL_ACCOUNT`, and is logged with its own email type,
    `gc_customer_email_test`, so no reader of `email_send_log` counts it as a send;
  - nothing is written back on any kind: no reminder's `email_send_log_id`, no weekly row, no sent copy;
  - `gcCustomerEmails.test.ts` holds the `[TEST]` subject prefix and the test leaving out `cc`.

**The journey step's guide** (amendment 1): `customerJourneys.test.ts` needs a step's guide to exist, and the guide *send
the customer the Friday report* ships with U7c's window. U7b's step names *write the daily log for a job we are building*
until then, and U7c moves it to the new guide. **Its deploy**: `gc-customer-email`, by the lead. No live send without
Grace's yes typed in gc 4's chat; the `[TEST]` copy to her own email is the first check.

## U7c: the report window, the mapper and the io

**Where**: the Daily log window (U3a-ii) gains this week's report card on top, as the prototype's Daily log tab has it.
Its button opens the report window. Building's gate (`canUseGcBuilding`), the schedule's team at the door.

```
┌ Weekly report · week of Oct 5   [ready to send]   This week's update to Dana Ruiz is drafted from the logs. ┐
│                                                                      (Weekly report)                       │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌ Weekly report · Fair Oaks Shops, Building D ─────────────────────────────────────────────── (Close) ┐
│ The week of Oct 5 · to Dana Ruiz at Cibolo Creek Partners                                          │
├──────────────────────────────┬─────────────────────────────────────────────────────────────────────┤
│ No daily log for Oct 7.      │                                     (Edit the text)                 │
│ The report skips that day.   │  FAIR OAKS SHOPS, BUILDING D · WEEK OF OCT 5                        │
│ Add the log first and it     │  Hi Dana,                                                           │
│ fills in.                    │  Here's where Fair Oaks Shops, Building D stands this week.         │
│ WHAT GOES IN                 │  AT A GLANCE                                                        │
│ [x] At a glance              │   - Finish: about Fri Dec 18. That is 4 days past the Dec 14 ...    │
│ [x] The schedule             │  THE SCHEDULE …                                                     │
│ [x] This week  From 4 daily  │  THIS WEEK …                                                        │
│     logs                     │  …                                                                  │
│ [ ] Name the companies       │  Thanks,                                                            │
│ FROM  (Me · Rosa) (Click)    │  Rosa                                                               │
│ LENGTH (Short) (Full)        │  Click Construction                                                 │
│ A LINE OF YOUR OWN [      ]  │                                                                     │
│ GOES TO Dana Ruiz · dana@…   │                                                                     │
│ [ ] Copy Mesquite Design     │                                                                     │
├──────────────────────────────┴─────────────────────────────────────────────────────────────────────┤
│ Opens your email with this filled in, under your name. Replies come to you.  (Email me a test) (Send to Dana) │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Ported from the prototype's `GcWeeklyReportCard` and `GcWeeklyReportWindow`, the kernels unchanged: `weeklyReport`,
  `weeklyReportText`, `weeklyReportReady`, `weeklyReportSent`.
- **From me**: the link opens the user's own mail with the draft filled in (`mailto:`), and the press inserts the row
  (`sent_from = 'me'`). Nothing leaves the app.
- **From the company**: **Send to {first}** inserts the row, then calls `gc-customer-email` kind `weekly` with its id
  (call 5). A refusal is said in the window and the press can go again on the same row.
- **Email me a test**: the same report through the function with `test: true`, to the signed-in user only.
- **The words a first-timer reads** (plain words, held by the window's render test):
  - *No daily log for Oct 7. The report skips that day. Add the log first and it fills in.*
  - from me: *Opens your email with this filled in, under your name. Replies come to you. It is kept on the job.*
  - from the company: *Goes from Click Construction to Dana. Replies go to the project manager. It is kept on the job.*
  - sent: *Sent Oct 9. Sending again sends a new email. The newest one is the one kept for the week.*
  - a test: *A test went to your email. It says TEST, and nobody else got it.*
  - The prototype's *It goes in their portal too* waits for PR 15, which says it then.

**The reads**: the window reads what `weeklyReport` reads, laid over the board as the Submittals window does: the job's
daily logs (`withDailyLogs`, already on the page), its submittals (`loadGcSubmittals`), its change orders for the money
team (`withChangeOrders`; anyone else's report has no Changes section), its schedule (`loadSchedule`), its customer's
billing for the money team (`billingStateFor`, so the late finish reads as on Bill the customer), and its sent reports.

**The mapper**, `src/lib/gc/weeklyReportRows.ts`: `withWeeklyReports(state, rows)` lays `project.weeklyReports`
(`WeeklyReportSent`) from `gc_weekly_reports`, oldest first, a company row only once its email went (call 5).
**The io**, `src/lib/gc/weeklyReportsIo.ts`: `loadGcWeeklyReports(projectIds)`, `recordWeeklyReport(row)` (the insert,
returning its id), `sendWeeklyReport(projectId, rowId, subject, body, { test })` through `sendGcCustomerEmail`.

**The guide** *send the customer the Friday report* (`roles: dev` until Building's door): read the draft, choose what
goes in, from me or the company, a line of your own, copy the architect, edit the text, email yourself a test, send.

**U7c's tests**: `weeklyReportRows.test.ts` (rows through and back, a company row unsent left out, the newest per week),
`GcWeeklyReport.render.test.tsx` (the card's three states, the sections' ticks, from me and the company, the short one,
the text edited, the test press, the words in plain words), and the Daily log window's case for the card.

## The portal half (waits on the schedule's PR 15)

The customer's portal shows the newest report for each week (`latestWeeklyReports`) beside the schedule's letter, read
from the rows by the portal's own function. That page and that function are PR 15's, so the reports join it there; U7
adds no portal read. The prototype's `GcWeeklyReportsForCustomer` moves with it.

## Drift from `BUILDING_REAL_BUILD.md`

- **No `gc-weekly-report-email`**: a kind on `gc-customer-email` (the lead's call 1).
- **The row before the send**, a company row counting only once its email went (call 5), where the plan had the row
  written as sent.
- **The report sits on the Daily log window**, as the prototype's tab has it, not a window of its own on the card.
- **The customer's record gets no note.** The prototype's reducer added a line to the customer's call log. The real
  build has no such log for GC customers yet, and the kept row and the filed copy carry the send.

## The check (U7c, on "GC test project, delete me", as a dev)

1. Write two daily logs this week, then open the card: the draft reads them.
2. Untick a section, add a line, switch to Short, and see the text follow.
3. **Email me a test**, and see one `[TEST]` email reach your own inbox and nothing filed.
4. **From me**: the link opens your mail filled in, and the row is kept.
5. **From the company** to the test customer's address: only on Grace's own yes in gc 4's chat.

## When it is cut

- **U7a**: from `origin/main` once this plan merges; claim the version; run the lift; drop the duplicate test; arm. The
  follow-up is the lane's, checked by gc 7.
- **U7b**: after U7a, on gc 5's co-sign; claim; the deploy is the lead's on merge.
- **U7c**: on U7b's deploy.

## Docs each PR touches

- **U7a**: the release note and fragment.
- **U7b**: `docs/EDGE_FUNCTIONS.md`'s `gc-customer-email` section (the kind, the address and frame rules, the `[TEST]`
  copy, the `cc`), the release note and fragment.
- **U7c**: `PROJECT_DOCUMENTATION.md` (the report on the Daily log window), `GLOSSARY.md` (*Friday report*),
  `ACCESS_CONTROL.md` (the window's gate and the row-decides send), the guide, the note and fragment.

## Seams

- **Owner Billing** (gc 5): the kind's shape (calls 4 to 11), the `[TEST]` door for every kind, and the sends-on flip,
  which this kind joins with the others.
- **The schedule** (PR 15): the portal half. PR 10's door opens the report with the daily log to the schedule's team.
- **The Board**: none. The report names a company only when the office ticks *Name the companies*.

## Is this the best we can do?

1. **The report goes out on its own each Friday.** *Not now:* the owner's word is that it never goes out on its own, and
   the office reads it first. The card turns blue on Friday instead.
2. **The architect gets the report as a reader of their own.** *Later:* a copy is enough until the architect has a page,
   G-95's seed, as U4 said.
3. **The customer answers in the portal.** *Later, with PR 15:* a reply comes to the project manager by email today, and
   the portal's messages can carry it once the reports show there.

## Status

Plan 2026-10-10 by gc 4 at the lead's ask, from `origin/spike/gc-mode` at 6ac8813b0 and `origin/main` at 3c836ad80. The
lead's call is written in; gc 5's co-sign of calls 4 to 11 is asked. U7a's lift ran dry and its moved tests passed on main.
Nothing is cut or claimed.
