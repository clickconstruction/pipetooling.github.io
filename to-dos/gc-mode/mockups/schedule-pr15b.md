---
name: "The schedule's PR 15b: the customer's picture in their portal"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 15, and decision 10; mockups/schedule-pr15.md, calls 5 and 9; mockups/schedule-pr14b.md, calls 1, 2, 6 and 10; GANTT_FEATURES.md G-90 to G-93
branch: the plan on claude/gc-schedule-pr15b-plan (from origin/spike/gc-mode at c51a62527); the code from origin/main in one cut, with no migration, after #5362 (14b) merges
status: plan 2026-10-10 by helper 1 at the lead's ask. Amendment 1 (2026-10-10): gc 3, holding the Portal, co-signed every call, call 4 as amended (each audience's reads behind its own option, over P5d-ii-1's widened read) and call 5 with three more plants. Amendment 2 (2026-10-10): gc 5, holding Owner Billing, co-signed calls 4, 7 and 8, with two conditions written in (the never-sees test on the schedule's answer with the late finish's dollars planted, and the portal line on a link where their GC jobs show, `gcJobsPortalUrl`). Read back and approved by the lead (spike 5d5a0cf68). Amendment 3 (2026-10-10): gc 4 gave the Building lane's nod for the weekly report's portal line, never with the architect copied and only on a job with a schedule drawn. Measured on 14b's head fd0f5dd5b; measured again once 14b is on main. Nothing cut or claimed.
---

# The schedule's PR 15b: the customer's picture in their portal

## What it is

A customer opens their portal and sees where their GC job stands: the finish against their contract, each stage of the
job as a bar, the dates to meet, what changed this week and what we need from them. A GC or an owner's rep may also see
every bar. It never shows a company, a dollar or a spare day (G-90 to G-93). 15a sent the same schedule as a letter.

Most of it is on main, or will be once 14b lands:

| Piece | On main | From |
|---|---|---|
| The picture: `customerSchedulePicture` (stages, standing, milestones, changes, asks, contract days, every bar) | lifted word for word | PR 1b |
| The late finish in the customer's words (`lateFinish(...).customerWords`: never a company, never the fee) | built | O2 |
| A generated copy of the kernels for an edge function (`scripts/edge-kernels.mjs` into `_shared/gcKernels/`), kept equal by a test that also lists its importers | 14b (#5362) | the Portal's and the schedule's |
| The read of a job's schedule rows with the service role (`readScheduleRows` in `gc-trade-portal`) | 14b | |
| The customer's GC jobs in their portal (`loadGcPortalJobs` in `_shared/gcPortal.ts`, `PortalGcJobs.tsx`) | built | O7c |
| `gc-customer-email`'s portal line, off for `schedule` and `weekly` until this PR | built | 15a, U7b |

Nothing works out the picture on the server, and the portal draws no schedule. One cut, no migration. It redeploys
`customer-portal` and `gc-customer-email`, and `gc-trade-portal` if the read moves (call 4).

## The calls

**Co-signed by gc 3 (Portal), every call, 4 and 5 as amended (amendment 1), and gc 5 (Owner Billing), calls 4, 7 and 8, 5 and 8 as amended (amendment 2). Each with the other way:**

1. **The picture rides 14b's copy.** `ENTRIES` gains `schedule/customerSchedule.ts` (`customerSchedulePicture`) and
   `lateFinish.ts` (`lateFinish`), since the prototype's portal shows the late finish's customer words under the
   finish. `IMPORTERS` gains `customer-portal`, as 14b's call 2 already provides. Measured on 14b's head: 37 files and
   10,641 lines, against 14b's 30 and 9,282, with no file refused. The 7 it adds are `customerSchedule`, `gantt`,
   `changeOrderDays`, `lateFinish`, `ownerBillingFinish`, `timeExtension` and `daysLost`. P5d-ii-1's four entries and
   the Board's vi-b grow the copy too, and whoever lands second regenerates; the counts come from the generator, never
   a sum, since shared files would count twice. With `customer-portal` an importer, a change to any copied file
   redeploys both portals, and `check:edge-drift` names both (gc 3). *Other way:* the picture
   without the late finish: 33 files and 10,032 lines, and the portal says less than the letter and the Friday report.
2. **The answer is a shape of its own: words and dates only** (`customerPortalSchedule`, pure, in
   `_shared/gcCustomerSchedule.ts`, tested from `src`). The picture as the office prints it carries whole bars, and
   a `GanttBar` holds `item.company`, `item.worth` in dollars, the trade package with its budget, and `spare` days. So
   the function returns only:
   - the finish, the contract's day, the days late, the finish's words, the work done and planned;
   - the next date to meet: its name, day and state;
   - the contract days and the late finish's customer words, as sentences;
   - each stage: name, start, finish, percent and state;
   - each date to meet: name, day, state and days late;
   - every bar, only when they may see every bar: by stage, each with its name, start, finish and
     `customerBarWords`' words and tone;
   - what changed this week and what we need from them, as sentences.

   *Other way:* the picture whole, which sends a company and a dollar to their browser.
3. **Which jobs:** the customer's own GC jobs (`projects.customer_id`, the link's customer) that are being built and
   have a schedule drawn. A job in buyout, closed or lost shows none, and a job with nothing drawn shows none. The
   link's audience is as O7c's: a `gc` view gets no GC jobs at all. *Other way:* buyout too, which shows a first draft
   nobody has walked.
4. **One read, shared, each audience's extra rows behind its own option** (amended by gc 3). `readScheduleRows` moves
   from `gc-trade-portal/index.ts` into `_shared/gcScheduleRead.ts`, and both functions call it:
   `readScheduleRows(admin, jobIds, { trade: { companyId } })` and `readScheduleRows(admin, jobIds, { customer: {
   customerId } })`. The trade's read is P5d-ii-1's (v2.5206, opening right after 14b), carried over as it lands: every
   move on the job with its pushes, the company's own bars' marks and parts, and, of the company's own only, its move
   tells, answers, late notices and crew counts. The moves and pushes are read when either option is set. Whichever of
   P5d-ii-1 and 15b lands second moves or merges the code; if P5d-ii-1 is first, as planned, 15b moves its version.
   The customer's option reads what the picture reads beyond the chart:
   - the dates to meet (`gc_schedule_milestones`);
   - the moves (`gc_schedule_moves`), for what changed;
   - what the work waits on and its holds (`gc_schedule_waits`, `gc_schedule_wait_holds`), for the decisions they owe;
   - the job's change orders (`gc_change_orders`), for the signatures they owe and the contract's days. The price is
     read for the kernel and never reaches the answer (call 2);
   - the customer's own row (name and role).

   So the customer's read never fetches a company's tells, answers, notices, counts or marks, and the trade's never
   fetches the dates to meet, waits, change orders or the customer's row. Each portal's never-sees test guards its own
   side. *Other way:* a second reader in `customer-portal`, two copies of the same read that drift apart.
5. **The never-sees test** (`gcCustomerPortalSchedule.test.ts`) runs on `customerPortalSchedule`'s answer, the
   schedule's part, not the whole portal response: O7c's change orders to sign rightly carry the price they sign
   (gc 5). It plants on the same job:
   - each trade's company name;
   - a distinct dollar figure on every budget, line, statement of work, change order and our price;
   - the late finish's dollars (gc 5): `owner_late_finish_per_day`, and our number's fee and contingency. The late
     finish's customer words are never the fee, as 15a's letter has it;
   - a bar with spare days;
   - a move's note and a late notice's note;
   - the trade side's rows from P5d (gc 3): a trade's answer note on told dates, a crew count, and a look-ahead mark
     with our `verified_reason`;
   - a second customer's job, and a job of theirs in buyout.

   It asserts the answer's JSON holds none of them. It also asserts the answer holds the finish, the stages, what
   changed and what we need, so the test pins both sides.
6. **Every portal's boot.** `customer-portal` serves every customer, homeowners too, and the copy is about 10,600
   lines. So the copy loads with a dynamic import (`await import('../_shared/gcKernels/index.ts')`) only when the
   customer has a GC job being built. `walkBundle` already follows a string-literal `import()`, so `check:edge-drift`
   and the importers test still name `customer-portal`. Its cold boot is measured on the local runtime before and
   after, and with `check_edge_boot` after the deploy. If the bundler will not take the dynamic import, the import is
   static and the boot is measured the same way. *Other way:* a function of its own, `gc-customer-schedule`, read
   beside the portal: one more deploy and one more fetch for each GC customer.
7. **The page** (`PortalGcJobs.tsx`, O7c's): *Your schedule* opens each job being built, above our contract and the
   change orders, as the prototype's portal has it, since its dates frame what follows. It is the prototype's
   `GcCustomerSchedule` drawn from the answer, not from a state. It is light, on the portal's paper, and has one
   press, **See every bar**, for a GC or an owner's rep. A job with no `schedule` draws as today, so the page and the
   function can deploy in either order. *Other way:* *Your schedule* last, under the bills.
8. **The portal line comes on, on a link that shows their GC jobs** (15's call 5, amended by gc 5):
   `GC_CUSTOMER_EMAIL_PORTAL_LINE` turns on for `schedule` and `weekly`, with their own words through the frame's
   `portalWords`: *You can see your schedule in your portal:*. The link is not `loadPortalReturnUrl`'s, which falls
   back to a `gc` view where `customer-portal` shows no GC job of ours. It is `gcContractPortalUrl`'s rule, renamed
   once to `gcJobsPortalUrl`: the merged `all` link at its short address, else a `customer` view, never `gc`. Our
   contract and the two kinds call it. With no such link there is no line and the send still goes; only `contract`
   refuses `noPortal`. The frame offers a card only under a bill's words. The weekly report is Building's, and gc 4
   gave Building's nod (amendment 3) on two conditions:
   - **never when the architect is copied:** on `weekly` the architect is a `cc` on the same email
     (`gcCustomerEmailCc`), so the line would hand them the customer's own link, whose `all` view shows the
     customer's bills and our contract. With the row's `copied_architect` on, no line, and the report still goes. The
     kind's test pins it with `copyArchitect` on;
   - **only on a job with a schedule drawn** (its `gc_schedules` row): a report goes on any job being built with a
     log that week (`weeklyReportDue`), and a job with nothing drawn would link to a portal that shows none.

   On the unframed email the line lands after the sign-off, as a footer, for both kinds. The row's words are
   untouched. *Other way:* the schedule's line only, and the Friday report waits.
9. **What customers see:** the owner's sample portal shows a made-up schedule on its sample job, built by
   `customerPortalSchedule` from the sample's rows. The journey step *GC mode: their schedule in their portal* points
   at it, with its guide.

## The cut

- **`scripts/edge-kernels.mjs`**: the two entries and `customer-portal` in `IMPORTERS`. Then the regenerated copy.
- **`supabase/functions/_shared/gcScheduleRead.ts`** (new): 14b's `readScheduleRows`, moved, with the customer's
  widening (call 4). **`gc-trade-portal/index.ts`** imports it.
- **`supabase/functions/_shared/gcCustomerSchedule.ts`** (new): `customerPortalJobs` (call 3),
  `customerSchedulesFromRows` (the rows to the picture, through the copy) and `customerPortalSchedule` (call 2).
- **`supabase/functions/_shared/gcPortal.ts`**: `PortalGcJob.schedule?`, and `loadGcPortalJobs` reads the schedules
  of the jobs it shows. A failed read leaves the block whole with no schedule.
- **`supabase/functions/customer-portal/index.ts`**: the dynamic import (call 6).
- **`supabase/functions/_shared/gcCustomerEmails.ts`**: the portal line and its words (call 8).
- **`src/lib/portal/portalPayload.ts`**: the answer's type. **`src/components/portal/PortalGcJobs.tsx`**: *Your
  schedule* (call 7).
- **Tests:**
  - the never-sees test (call 5);
  - `customerPortalSchedule` on main's test state: Fair Oaks D's stages, finish and milestones, the shape's keys, and
    every bar for an owner's rep only;
  - `edgeKernels.test.ts`: the new entries and importer, which 14b's test already checks;
  - `PortalGcJobs.render.test.tsx`: the block first on a job being built, none without a schedule, See every bar,
    plain words;
  - `customerEmail.test.ts`: the portal line and its words for both kinds;
  - the sample portal's schedule.
- **Docs:** `docs/EDGE_FUNCTIONS.md`'s `customer-portal` section (the schedule, the dynamic import) and its
  `gc-customer-email` and `gc-trade-portal` sentences; the guide *send the customer their schedule* says the portal
  shows it too; `PROJECT_DOCUMENTATION.md`; the release note and fragment.

## Seams

- **gc 3 (Portal):** 14b's copy and its read (calls 1 and 4). 15b cuts after 14b merges, and moves P5d-ii-1's widened
  read if that lands first, as planned.
- **gc 5 (Owner Billing):** `gcPortal.ts` and `PortalGcJobs.tsx` are O7c's, and the portal line is the frame's
  (calls 7 and 8). gc 5's guard against a send twice comes before or after; it touches neither. The same `gc`
  fallback sits under the bill kinds' line (*You can see this bill in your portal:*); gc 5 fixes it in a follow-up
  of their own on `gcJobsPortalUrl`, adding the rename there if it lands before 15b.
- **Building:** the weekly report's portal line (call 8).
- **PR 10 (#5231):** nothing. The portal reads with the service role and checks the link, never the team's RLS.

## Drift from `SCHEDULE_REAL_BUILD.md`

- *`customer-portal` adds the customer's picture* stands, as a dynamic import of 14b's copy (call 6).
- Item 15's check is 15b's: *the customer's portal shows the finish and what changed, and never a company, a dollar
  or a spare day*.

## The check (15b on, on "GC test project, delete me", as a dev)

The test customer's portal link is on. With the job being built, the portal shows *Your schedule* first: the finish
against the contract, the stages, the dates to meet and what changed this week. The page's text and the function's
answer hold no company, no dollar and no spare day. A test copy of the letter carries *You can see your schedule in your
portal:* with the link. No real customer is shown or sent anything without the owner's yes.

## Is this the best we can do?

- One picture, worked out once by the lifted kernel, sent as words and dates only, and pinned by a test that plants
  what must never reach the customer.
- One copy of the kernels and one read of the schedule's rows, for both portals.
- A homeowner's portal boots as before, since the copy loads only for a GC customer with a job being built.
- What it does not do: a schedule on a job before it is built, a picture in Spanish, or a PDF of the portal's picture.
  The letter's **Print the letter** is that PDF (15a).

## Status

Plan 2026-10-10, helper 1, at the lead's ask. Amendment 1 the same day: gc 3 co-signed every call, with call 4's read
split by audience over P5d-ii-1's and three more plants in call 5. Amendment 2: gc 5 co-signed calls 4, 7 and 8, with
the never-sees test held to the schedule's answer, the late finish's dollars planted, and the portal line on
`gcJobsPortalUrl`. Read back and approved by the lead, to cut after #5362 (14b), P5d-ii-1 and gc 5's `gcJobsPortalUrl`.
Amendment 3: gc 4's nod for the weekly report's line, on its two conditions (call 8). Measured on 14b's head
fd0f5dd5b. Nothing cut or claimed.
