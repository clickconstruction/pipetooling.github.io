---
name: "The schedule's PR 15: the customer's side"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 15, decision 10 and The schedule's sends; GANTT_FEATURES.md G-90 to G-94; mockups/building-u7.md (U7b, the `weekly` kind); mockups/schedule-pr13.md, call 1 (no new sender); mockups/schedule-pr14.md, call 9 (the copy of the kernels)
branch: the plan on claude/gc-schedule-pr15-plan (from origin/spike/gc-mode at 0b45adbae); the code from origin/main in two cuts, neither with a migration
status: plan 2026-10-10 by helper 1 at the lead's ask, for gc 4's co-sign (Schedule) and the lead's read-back. Calls 1, 2, 5 and 6 touch Owner Billing's sender, and call 9 touches the Portal's copy of the kernels. Nothing cut or claimed.
---

# The schedule's PR 15: the customer's side

## What it is

The customer sees their job's schedule two ways. **The letter** (G-94) is the schedule sent on its own: a dated
letter the office sends when a customer asks where things stand. **Their picture** (G-90 to G-93) is the same
schedule in their portal: the finish against the contract, the stages, the milestones, what changed and what we need
from them. Neither ever shows a company, a dollar or a spare day.

Most of it is on main already:

| Piece | On main | From |
|---|---|---|
| `gc_schedule_sends` (`sent_on`, `sent_by`, `sent_to`, `subject`, `lines`, `email_send_log_id`), dev-only, append only | applied | PR 3 (`20261007220000`) |
| Its read into `GcProject.scheduleSends` | built | PR 6 (`rows.ts`, `scheduleIo.ts`) |
| The picture's kernels: `customerSchedulePicture`, `customerStanding`, `customerStages`, `customerChanges`, `customerAsks`, `customerMilestones`, the shared words | lifted word for word | PR 1b |
| `customerScheduleHtml`, `scheduleSendRecord`, `scheduleSends` | lifted | PR 1b |
| `customerScheduleLetter` | **not lifted**: it waited on O2's late finish (`schedule-pr1b.md`, *Waits*) | |
| `lateFinish` (its `customerWords`: never a company, never the fee) and `customerContractDays` | built | O2, PR 1b |
| The chart's print with the customer's picture as their portal reads it (G-21) | built | PR 7 |
| `gc-customer-email`, the one sender for every email to a GC customer: the row's own words unframed, to the contact, a `[TEST]` copy, `alreadySent`, the log written back, the sent copy | deployed | O4b, U7b |
| The customer's portal block for their GC jobs (`loadGcPortalJobs`, `PortalGcJobs.tsx`) | built | O7c |

Nothing writes a send, and nothing draws the letter or the portal's picture. Two cuts:

- **15a, the letter** (no migration; `gc-customer-email` redeployed): the kind `schedule`, the letter lifted, and the
  card on the Schedule window that reads it, prints it, tests it and sends it.
- **15b, their picture in their portal** (no migration; `customer-portal` redeployed), after the Portal's 14b: the
  portal's read works out `customerSchedulePicture` from the rows with 14b's copy of the kernels, and returns only its
  answer. It gets its own plan with gc 3 and the Owner Billing lane, as 14b did.

## The calls

**For gc 4 (Schedule), every call; for the Owner Billing lane, calls 1, 2, 5 and 6; for gc 3 (Portal), call 9. Each with the other way:**

1. **No new sender: the letter goes through `gc-customer-email`, kind `schedule`.** It is the one sender for every email
   to a GC customer (O4b). It already sends a row's own words unframed (the `weekly` kind), to the contact's address,
   with the project manager as Reply-To. It sends a `[TEST]` copy to the caller, answers `alreadySent`, writes the
   log back and files the sent copy. SCHEDULE_REAL_BUILD's `gc-schedule-send` is dropped, and its passage is amended
   after the merge, as PR 13 did for `gc-tell-trades`. *Other way:* a `gc-schedule-send` of its own: one more function
   to deploy, and a second copy of the frame, the test copy and the sent copy.
2. **The row first, then the send** (the weekly report's shape, U7b). The window keeps the letter as a
   `gc_schedule_sends` row, then calls the kind with the row's id. The function sends the row's own subject and lines,
   never the window's. It writes `email_send_log_id` back with the service role, since a signed-in caller has no UPDATE
   (PR 3's grant). A row counts as sent only once that is set, and a sent row answers `alreadySent`. A press again
   after a send that failed goes on the same row when the letter reads the same (`scheduleSendRetryRow`, as
   `weeklyReportRetryRow`), else on a new one. The row is a plain insert under RLS (decision 9), dated `state.today`,
   the app's day, as the walk's and the weekly report's rows are. *Other way:* send, then record (PR 13's shape). The
   function would have no row for its sent copy's source or its write-back, and the words would be the window's.
3. **Who sends:** those who may move a bar (`moves`), never in the what-if copy, since a copy is never sent. The kind's
   gate is the row (`'row'`): read with the caller's own JWT, so RLS decides. That is a dev today, and the job's team
   with PR 10. The letter carries no money, so it is not the money team's. Any send to a real customer waits on the
   owner's yes, and the card offers a test to yourself first. *Other way:* the money team's gate, as every bill has.
   Then a project manager on the job could not send their own customer the schedule.
4. **The letter is the prototype's, lifted word for word**: `customerScheduleLetter` into main's
   `customerScheduleSend.ts`, now that O2's `lateFinish` is on main, and the lift's `stays` entry comes off. Its lines:
   - the greeting and the day;
   - the finish against the contract, with the change orders' days;
   - the late finish in the customer's words;
   - the work done against plan;
   - each stage and each milestone;
   - what changed this week, and what we need from them;
   - *Call me with any question.*, signed by the sender and the company.

   One fix, made in both copies: a customer with no contact's name today reads *Hello Cibolo,* and *To Cibolo Creek
   Partners, Cibolo Creek Partners*. With no contact, it reads *Hello,* and the company alone. *Other way:* word for
   word with the bug, though a real customer row can have no contact's name (`boardRows.ts` reads it as empty).
5. **To the contact, with no portal line in 15a.** `GC_CUSTOMER_EMAIL_ADDRESS.schedule` is `'contact'`, the person who
   runs the job for them. `GC_CUSTOMER_EMAIL_PORTAL_LINE.schedule` is `false` until their portal shows the schedule.
   15b turns the line on for `schedule` and for `weekly`, which waits on this PR (v2.5139: *No portal line until the
   schedule's PR 15*). The line gets its own words, *You can see your schedule in your portal:*, never the bill's.
   *Other way:* the portal line now, to a portal with no schedule in it.
6. **Filed as `field_report_gc_schedule`, under Statements**, beside the weekly report's `field_report_gc_weekly`. It is
   filed with the billing job and the row as its source (docs/SENT_COPIES.md), so the card's *Emailed to* line reads
   the copies (`gcCustomerEmailCopyKinds('gc_schedule_sends')`). Not framed (`GC_CUSTOMER_EMAIL_FRAMED.schedule` is
   `false`): the letter carries its own greeting and sign-off. *Other way:* framed, which signs the letter twice.
7. **Print or PDF keeps no row.** It opens the letter as a light page (`customerScheduleHtml`) to print or save. A
   print is not a send, so the record of sends holds only letters that went or were meant to. The chart's print
   already carries the customer's picture, and PR 10 files that print's copy. *Other way:* a print keeps a row, and
   the record fills with letters nobody got.
8. **Where the office sees it:** the card *Send {customer} their schedule* on the Schedule window of a job being built,
   with the cards for `moves`, under **Milestones**, never in the copy. It has:
   - **Read the letter**, which shows it as it would go today, with who it goes to;
   - **Print or PDF**;
   - **Send a test to me**, the kind's `[TEST]` copy;
   - **Send to {first name}**, the real send.

   Under it, each send, newest first: *Fri Oct 9 · Robert sent Elena Marchetti, Cibolo Creek Partners "Your schedule
   on …", 14 lines.* A row whose email never went reads *kept, not emailed yet*. A refusal is said in
   `gcCustomerEmailRefusal`'s words.
9. **15b, their picture in their portal**, after the Portal's 14b. `loadGcPortalJobs` (O7c's `gcPortal.ts`) reads each
   won job's schedule rows with the service role. It builds the job's state with 14b's copy of the kernels and returns
   `customerSchedulePicture`'s answer on `PortalGcJob.schedule`, and only that. `PortalGcJobs.tsx` draws *Your
   schedule*, the prototype's `GcCustomerSchedule` ported onto the picture rather than the state. The never-sees test
   plants another company's name, a dollar fee and spare days in the rows, and none reaches the payload, as 14b's
   condition asks. **gc 3's second condition on 14b** says `gc-trade-portal` is the copy's only importer. 15b makes
   `customer-portal` a second one. The ask: the copy keeps one list of its importers, and `check:edge-drift` names
   each of them to redeploy after a regenerate. *Other way:* a second copy for `customer-portal` alone, which is two
   generated copies of the same files.

## 15a: the letter

- **`supabase/functions/_shared/gcCustomerEmails.ts`**: the kind `schedule` in `GC_CUSTOMER_EMAIL_KINDS` and each
  table: `TO` `'customer'`, `SOURCE` `'gc_schedule_sends'`, `GATE` `'row'`, `ADDRESS` `'contact'`, `FRAMED` `false`,
  `FILED_AS` `'field_report_gc_schedule'`, `PORTAL_LINE` `false`.
- **`supabase/functions/gc-customer-email/index.ts`**: the `gc_schedule_sends` branch beside the weekly report's. It
  reads the row as the caller, refuses `otherProject`, and refuses `alreadySent` once its log is set, unless it is a
  test. The words are the row's `subject` and `lines`. The write-back of `email_send_log_id` takes `gc_schedule_sends`
  too. Its header names the kind. Then the function is redeployed (the lead's).
- **`src/lib/gc/schedule/customerScheduleSend.ts`**: `customerScheduleLetter` lifted (call 4).
  `scheduleSendRetryRow(sends, letter)`: the newest row not emailed with the same subject and lines.
- **`src/lib/gc/schedule/types.ts`** and **`rows.ts`**: `ScheduleSend.emailed?: true`, read from `email_send_log_id`.
  The kernels never read it.
- **`src/lib/gc/scheduleIo.ts`**: `recordScheduleSend(projectId, letter, today)`, which inserts the row and returns its
  id. **`src/lib/gc/scheduleLetterIo.ts`** (new): `sendScheduleLetter(projectId, rowId, letter, test)` through
  `sendGcCustomerEmail`. It never throws for a refusal.
- **`src/components/gc/GcScheduleLetter.tsx`** (new): the prototype's `ScheduleSendCard` on real presses (call 8). Each
  press is a callback: `onSend(letter, test)`. The window keeps the row, or finds the row to send again, sends, and
  reads the schedule again.
- **`GcSchedule.tsx`**: `MovePresses.sendLetter`, and the card for `moves` on a job being built. **`GcProjects.tsx`**:
  the press wired through the window's io, as `weeklyWrites` is.
- **What customers see**: the journey step `gc-schedule-email`, *GC mode: their schedule on its own*, with its sample
  (`buildSampleGcScheduleEmail`, from the letter's own kernel on a made-up job). It is listed among `gc-customer-email`'s
  steps in `customerSurfaceRegistry.ts`, and marked not-a-step in `personJourney.ts`.
- **Tests:**
  - `customerScheduleSend.test.ts`: the prototype's two letter tests on main's test state: the letter, the late
    finish's lines in order and never the fee or a company. Plus the greeting with no contact (call 4), and the retry
    row (the same letter goes on the unsent row, a changed one or a sent one does not);
  - `customerEmail.test.ts`: the kinds table with `schedule` under Statements, the row gate, the contact, no frame and
    no portal line;
  - `GcScheduleLetter.render.test.tsx`: the letter read and printed, the test press and the send, the record with *kept,
    not emailed yet*, a refusal in its words, plain words;
  - `GcSchedule.letter.render.test.tsx`: the card for `moves` on a job being built, none in the copy, none read only;
  - the sample email's test, as `gc-weekly`'s.
- **Docs:** the guide *send the customer their schedule* (`roles: dev` until PR 10), with sections for a test to
  yourself and for print. `docs/EDGE_FUNCTIONS.md`'s `gc-customer-email` section gains the kind (a sentence, as PR 13
  did for `gc-trade-email`). `PROJECT_DOCUMENTATION.md`'s Schedule paragraph. The release note and fragment.

## 15b: their picture in their portal (its own plan with gc 3, after 14b)

- The copy's entry list gains `customerSchedulePicture`, and the change orders' row reader it needs.
- `gcPortal.ts`: `loadGcPortalJobs` reads the schedule rows of each won job being built, and `PortalGcJob.schedule` is
  the picture or absent.
- `PortalGcJobs.tsx`: *Your schedule* (G-90 to G-93), light, on the portal's paper. A GC or an owner's rep sees every
  bar (`everyBar`, the prototype's call 3).
- `gcCustomerEmails.ts`: the portal line on for `schedule` and `weekly`, in its own words (call 5).
- The never-sees test (call 9). `customer-portal` redeployed. `docs/EDGE_FUNCTIONS.md`'s `customer-portal` section.

## Seams

- **The Owner Billing lane:** `gc-customer-email` and `gcCustomerEmails.ts` are theirs (O4b). The kind is added as
  U7b added `weekly`, with their co-sign on calls 1, 2, 5 and 6.
- **gc 3 (Portal):** 14b's copy of the kernels, and `customer-portal`'s GC block (call 9). 15b waits on 14b.
- **Building (U7b, U7c):** the weekly report's portal line turns on with the letter's in 15b.
- **PR 10 (#5231):** opens `gc_schedule_sends` to the team. The card follows `moves`, so it opens with the door.

## Drift from `SCHEDULE_REAL_BUILD.md`

- *`gc-schedule-send`* is dropped for `gc-customer-email`'s kind `schedule` (call 1). `docs/EDGE_FUNCTIONS.md` gains
  a sentence in `gc-customer-email`'s section instead of a section of its own.
- PR 15's check is split. The letter is 15a's. *The customer's portal shows the finish and what changed* is 15b's.

## The check (15a on, on "GC test project, delete me", as a dev)

The test customer's contact email is our own inbox. Open the job's Schedule and read the letter. **Send a test to me**:
the inbox gets `[TEST]` and the letter. **Send to {first name}**: the contact's inbox gets it, the record reads the
send, and Documents → Statements holds its copy. A customer with no contact email answers in the refusal's words. No
real customer gets a letter without the owner's yes.

## Is this the best we can do?

- One sender for the customer, one copy of the letter's words in one kernel, one row per letter kept as it went, and
  the send's words read from that row.
- A failed send never makes a second row for the same letter, and a sent row is never sent twice.
- What it does not do: their picture in their portal before 14b (15b), a letter in Spanish, or a letter sent on a
  schedule by itself. Their Friday report already carries the schedule's section every week (G-93, U7c).
- *Call me* is signed by the sender, while a reply goes to the project manager, as on every customer email. On a job
  with no project manager it goes to the sender.

## Status

Plan 2026-10-10, helper 1, at the lead's ask. For gc 4's co-sign, then the Owner Billing lane's on its four calls and
gc 3's on call 9, then the lead's read-back. Nothing cut or claimed.
