---
name: "Put a trip on a bill: an Extra trip becomes a line on its job"
number: 391
group: ready
status: asked and decided 2026-11-17 · the owner saw both ways drawn side by side and picked the line over a bill of its own · building since 2026-11-18 · PR 1 of 4 is built (v2.7746, the Job window's billing save refuses to write over a line added elsewhere) · PRs 2 to 4 are not built yet
summary: >
  A trip marked Extra is work past the job's price, and today nothing takes it to a bill. This card adds
  one press on an open trip, Put on a bill. The office checks the job, the amount and the words in a small
  window. The trip then becomes one line among the job's lines, and the Job window opens on Bill with that
  line picked, so the tab's own Bill the 1 picked sends it alone or the next bill carries it. The trip reads
  where its money stands from then on. A first step makes the Job window's billing save safe against a line
  added on another screen, which Apply to job and Add discount need today as well.
next: PR 2, the ground. The `trip_id` column on a job's line with its unique index, the function shaped like `apply_job_discount`, a scenario in the trips bed, then the push and the types.
size: M as a train of four (M · S · M · S)
blocker: None. The trip's number is on main and pushed (checked 2026-11-18), and the trip record's What it cost and its trip link are on main. PR 3 merges only after PR 2's migration is pushed.
opinion: build — the owner's pick. Every dollar asked of a customer stays a line, and the Bill tab already has the press that bills one line by itself
---

# Put a trip on a bill: a line on the job (#391)

The mock-up is [mockup.html](mockup.html). It draws the way picked, **B**, beside the way not taken,
**A**, through four steps, then what each changes in the app, then B's other states. It was rendered with
Playwright at desk and phone width, in light and dark, before it was shown. Every site, customer, person,
job, date and figure on it is made up.

This is the last step of the trip record, [#379](../trip-record/README.md). It left that train for a card
of its own once the owner chose between two builds.

## The ask, in the owner's words

> Can you show me mock-ups of how A or B could look and affect the app? I'm really leaning towards B
> right now But A makes more sense for some reasons.

After he saw them:

> We're going to build B for sure, add a punchlist card with all the details so another session can
> build B

## The decision

**B. The trip becomes one line on a job.** The line waits among the job's lines until a bill takes it.

- **The press.** **Put on a bill** sits on an open trip, beside **Change**. It shows on a trip whose
  billing is Extra and that has gone out (Out now or Back), to the office roles that may change a job's
  lines. A crew member never sees it.
- **The window.** *Put Trip 14 on J2101's lines.* Four things to check: the job, the amount, the line's
  name, the words under it. It shows the job total before and after. Its button names the act with its
  figure: **Add the line · $6,800**.
- **The amount is typed.** A trip holds no price. A dev or a controller sees *What it cost* under the
  field as a hint (the trip record's own figure). Nobody else sees a cost.
- **The words are made, then the office's to change.** The name is the trip's number, its crew and its
  days: *Trip 14, crew of 4, Nov 2 to Nov 8*. The words under it are what the trip was for and who asked:
  *Reset the riser the framers moved. Asked by Walt, by phone.* Both reach the customer's bill.
- **After the press** the Job window opens on Bill, with the new line picked. **Bill the 1 picked** is
  the Bill tab's own press. One more press bills the trip by itself. Left alone, the job's next bill
  carries it.
- **One trip, one line.** A second press is refused, and the trip shows a door to its line in place of
  the press.
- **The trip reads where its money stands**, from the line and the bill that took it:
  *Extra · not billed yet* → *Extra · on J2101's lines, on no bill yet* → *Extra · on a bill, not sent* →
  *Extra · billed* → *Extra · paid*.
- **The mark lives on the line, never on the trip.** Delete the line in the Job window and the trip reads
  not billed again by itself. Delete the trip and the line stays with its words.
- **What a trip still never does.** Changing or deleting a trip changes no clock row, bill or cost. Put on
  a bill is its own press, and it writes one line.

**Rejected: A, a bill of its own.** The press would make a separate bill in Ready to Bill at once, shaped
like the turnaway trip charge (`create_turnaway_trip_charge`: a non-primary bill with a rider, the job
total raised by the same amount). It was the smaller build and touched no part of the Job window. It lost
because:

- its one gain, a trip billed by itself now, is one press away in B;
- it puts money on bills with no line under them, where B keeps every dollar a line;
- a trip could never ride a progress bill;
- the app would hold two things a person calls a trip charge.

**Words.** This is *a trip's line* or *Put on a bill*. It is never a *trip charge*. That name belongs to
the turnaway's fee.

## What was found first

Read at main on 2026-11-17. Line numbers drift, names hold.

**A job's line.** A line is a `jobs_ledger_fixtures` row.

- It carries `name`, `count`, `line_unit_price`, `line_description`, `sequence_order`, `line_kind` and
  `invoice_id`.
- `line_kind` is `work` or `discount` by a CHECK (`20260910223000_discount_line_items.sql`). A trip's
  line is `work`.
- `invoice_id` is the bill that took the line, null until one does
  (`20260729002615_fixture_invoice_link.sql`, `ON DELETE SET NULL`). There is no join table.
- No column says where a line came from.
- `sequence_order` is the line's position. Discounts and the bill link both key on it.

**What the customer reads.** The name and the words under it both reach the paper.

- Stripe: `fixtureStripeDescription` in `supabase/functions/_shared/stripeInvoiceItemsFromFixtures.ts`
  writes `name — line_description`.
- The printed bill: `buildBillableServiceLinesFromFixtures` in `src/lib/physicalInvoiceLineItems.ts`
  writes the name, then the words on the next line.

**The job total is the lines plus the riders.**

- Client: `jobFormRevenueDollars` and `jobFormRiderFeesDollars` in `src/lib/jobs/jobFormMoneyTotals.ts`.
- SQL: the same sum is inlined in `apply_job_discount`, `add_collect_payment_fixture_from_job_book` and
  `record_job_tip_from_deposit`, each adding `job_rider_fees(job)`. No shared helper returns the lines'
  sum.
- Percent done is read over the total (`src/lib/stagesMoneyBar.ts`), so a trip's line joins it.

**The closest function to copy is `apply_job_discount`** (newest body in
`20261010023000_revenue_keeps_check_fee.sql`). It is SECURITY DEFINER, gates on the office roles and
`can_read_job_activity`, takes the next `sequence_order`, inserts one line, writes the total again from
the lines plus the riders, logs a `job_activity_events` row and returns the line's id and the new total.

**Apply to job is the other outside writer, and the weaker model.** `apply_estimate_to_job`
(`20260906190000_one_company_owners_inert.sql`) adds a change order's lines. It raises the total by a
delta instead of writing it again, and it drops a bad line without a word. Its window
(`src/components/estimates/CreateJobFromEstimateModal.tsx`) is the model for the before and after strip.

**Bill the N picked exists.**

- The ticks are `selectedSegmentIds` in `src/components/jobs/JobFormModal.tsx`, a set of line ids.
- The press runs `createInvoiceFromSegmentIds` in `src/hooks/useJobFormInvoiceActions.ts`, then
  `writeDraftInvoice` in `src/lib/jobs/draftInvoiceWrite.ts`.
- That makes a non-primary Ready to Bill bill and sets `invoice_id` on the picked lines by their
  positions.
- A line that amount-only bills already cover cannot be ticked (`src/lib/jobs/jobSegmentsCoverage.ts`).
- Nothing opens the window with a line already ticked. `applyEditJob` clears the set on load.

**Opening the Job window on Bill.** `useJobFormModal().openEditJob(jobId, { initialTab: 'bill' })` in
`src/contexts/JobFormModalContext.tsx`. Its options (`OpenEditJobOptions`) mirror the bridge's
(`JobWindowEditOpenOptions` in `src/contexts/JobDetailOpenerBridgeContext.tsx`). Every open remounts the
window (`instanceKey` in `src/contexts/JobDetailModalContext.tsx`), which reads the job again and drops a
pending save.

**The sharp edge: a Job window open on another screen.** The billing save
(`writeBillingSlice` in `src/lib/jobs/jobFormSliceWrites.ts`, called by `persistBillingSlice` in
`src/hooks/useJobFormAutosaveEngine.ts`) keeps only the lines the form holds.

- It deletes every line of the job whose id is not in the form's list.
- It writes the job total from the form's lines.
- Nothing compares against the database first. There is no stamp check and no reload on a change made
  elsewhere.
- So a window that was open before the trip's line was added deletes that line at its next billing
  save, and writes the total without it.
- The same window on the same screen is safe, because opening it again remounts it.
- Apply to job and Add discount have this edge today. Add discount covers only its own window, through
  `rehydrateFixturesFromDb`.

**The trip side** (card #379).

- Tables `trips`, `trip_people`, `trip_jobs` (`20261117234500_trips.sql`). `trips.billing` is `inside`,
  `extra` or `ours`.
- `trips_office()` names the roles that write a trip. The one write door is `trip_save`.
- The kernel is `src/lib/trips/`. The open trip is drawn by
  `src/components/developments/DevelopmentTripsLook.tsx`, and a site's trips are read by
  `readSiteTrips` in `src/lib/trips/tripsIo.ts` with the select in `tripRecord.ts`.
- The trip's number is `trips.trip_number`, from that card's number migration. The link that opens one
  trip and *What it cost* (`src/lib/trips/tripCost.ts`, `tripCostLines`) come with that card's later
  PRs.

## Where it plugs in

Exists today: everything under *What was found first*.

New:

- **A guard in the Job window's billing save.** Before it writes lines, the save reads the job's line
  ids. If the database holds a line the form never held, the save writes nothing, reads the lines again
  (`rehydrateFixturesFromDb` is the seam) and says so in words: the lines changed on another screen, they
  were read again, make the change once more. It refuses and re-reads. It does not try to merge.
- **`jobs_ledger_fixtures.trip_id`**, nullable, `REFERENCES public.trips(id) ON DELETE SET NULL`, with a
  unique index where it is not null. One trip, one line. No table is created, so the four fence calls
  are not owed.
- **One function**, shaped like `apply_job_discount`. A working name is
  `trip_put_on_job_line(p_trip_id, p_job_id, p_amount, p_name, p_words, p_dry_run)`. It:
  - refuses a training account, a digital twin and an archived caller itself, as `trip_phone` does,
    because a definer stands behind the tables' fences;
  - gates on the roles `apply_job_discount` allows and on the caller reading the trip;
  - locks the trip row, then the job row;
  - refuses a trip that is not Extra, in words;
  - answers a trip that already holds a line with that line and `duplicate: true`, and writes nothing;
  - takes a job that is one of the trip's jobs, or a job of the trip's site, and links it in
    `trip_jobs` when it was not;
  - holds the amount to a sane range and the words to the line's own limits;
  - inserts one `work` line at the next position with `count` 1 and `trip_id` set;
  - writes the job total again from the lines plus `job_rider_fees`, never by a delta;
  - logs a `job_activity_events` row;
  - returns the line's id, the job, and the total before and after;
  - writes nothing on a dry run and returns the same before and after, which the window shows.
- **A pure kernel, `src/lib/trips/tripBillLine.ts`:** the line's name and words from a trip, whether the
  press shows, the job choices, and the trip's billing standing from its line and that line's bill.
- **The window** (`src/components/trips/`), the press on the open trip, and the chip that reads the
  standing. The trip read gains the line and its bill for the office.
- **One more open option on the Job window**, for example `pickLineIds`. It rides `OpenEditJobOptions`
  and `JobWindowEditOpenOptions`, and the form seeds `selectedSegmentIds` with it after the job loads. A
  line that cannot be ticked is skipped without an error.
- **The door back.** Under a trip's line in the Job window's Line Items, *Open Trip 14*.

## The plan

Four small pull requests, each with its release note, fragment and docs. PR 1 stands alone.

| PR | What it brings | Touches | Owed after |
|---|---|---|---|
| 1 | The Job window's billing save refuses to write over lines that changed on another screen, reads them again and says so | `jobFormSliceWrites.ts`, `useJobFormAutosaveEngine.ts`, their tests, `docs/JOB_FORM_MODAL_ARCHITECTURE.md` (the save engine section) | Nothing |
| 2 | The ground: the `trip_id` column, its unique index, the function, a scenario in the trips bed, the migration's doc | One migration, `supabase/tests/trips/`, `scripts/pgtest-trips.sh`, `docs/migrations/`, `docs/ACCESS_CONTROL.md` | db push, then the types |
| 3 | The kernel, the press, the window, the chip's standing, the Job window opening on Bill with the line picked | `src/lib/trips/`, `src/components/trips/`, the Trips look, the Job window's open options, the guide, `docs/BILLING_FLOWS.md`, `docs/GLOSSARY.md` | Nothing |
| 4 | The door back from the line, the words on a trip's delete, the note in the sheet | The Job window's line items, `fetchJobWithDetailsById`, the trip's delete confirm, the sheet | Nothing |

- **PR 2 carries no client code**, so the push can follow its merge at any hour. PR 3 calls the function
  and names the column, so it merges only after the push.
- **The guide** is `src/content/help/keep-a-trip-to-a-far-site.md`. It gains a section on putting a trip
  on a bill, in plain words.
- **`docs/BILLING_FLOWS.md`** says, where it describes a bill's lines and beside its trip charge bullet,
  that a trip's line is an ordinary line and not a trip charge.
- **The dev seat** gets no verb here. A plan and apply pair for this press is a later card if it is
  wanted.

## Defaults a builder may take, and the calls behind them

| # | The call | The default |
|---|---|---|
| 1 | Which trips show the press? | Extra, and Out now or Back. A planned trip shows none. |
| 2 | Who may press? | The roles that may add a discount to a job. A crew member never. |
| 3 | A trip on two jobs? | The office picks one job. One trip makes one line. |
| 4 | A trip with no job named? | The window lists the site's jobs, and the picked job joins the trip's jobs. |
| 5 | The trip's billing is changed off Extra while a line exists? | Allowed. The sheet says the line stays. The chip still reads the line. |
| 6 | A stale Job window meets a changed job? | It refuses, re-reads and says so. No merge. |
| 7 | A job whose total is not its lines (a GC billing job)? | Check what `apply_job_discount` does there and do the same. Refuse in words if it has no answer. |

## Things to check while building

- **Positions.** The new line takes the highest position plus one. No discount's basis names it, and no
  line moves. Two lines must never share a position, since Bill the N picked links by position.
- **The form's save keeps the mark.** The Job window upserts a line by its own id with the columns it
  knows. Check that it leaves `trip_id` as it is when the office renames or reprices the line.
- **Who reads a line.** The trip's chip reads `jobs_ledger_fixtures` and the bill's status. Check the
  line's row security for every role that sees the Trips look. A role that cannot read lines sees the
  trip's own billing word and no more.
- **A covered line.** A line that amount-only bills already cover cannot be ticked. The trip then reads
  on the lines until a bill holds its `invoice_id`. Say so in the fragment if it stays that way.
- **A combine.** `migrate_job_ledger_costs_and_delete` moves a job's lines to the job that is kept.
  Check that a moved line keeps its `trip_id`. The same function is already owed a change for the trip
  record's job links.
- **The migration's locks.** The column and the index land on a hot table. Start with
  `SET lock_timeout = '3s';`, add the foreign key so it does not hold the table for a long scan, and
  number the file from `origin/main`.

## How to verify

- **PR 1:** unit tests on the save. A database that holds a line the form never held means no delete, no
  total written and a re-read. A form whose lines match saves as before. Then two browser windows on one
  ZZ job: add a discount in one, change a line in the other, and see the refusal and the re-read.
- **PR 2:** a scenario in the trips SQL bed. It covers the gate by role, a trip that is not Extra, the
  line and the total written, a second press answered as a duplicate, a dry run that writes nothing, a
  deleted line that frees the trip, and a deleted trip that leaves the line.
- **PR 3:** kernel tests and render smokes. Then a live walk on the ZZ Test development and its ZZ job,
  at desk and phone width, light and dark. Make a ZZ Test trip, mark it Extra, put it on a bill, and
  press Bill the 1 picked. Send nothing. Then delete the draft bill, the line and the trip.
- No real site's names or figures go in a test, a comment, a doc or a PR. Walk screenshots stay local.

## Where it stands

Decided and drawn on 2026-11-17. Building since 2026-11-18.

- **PR 1, built (v2.7746):** the Job window's billing save reads the job's line ids before it writes.
  When the job holds a line the window's form never held, it writes nothing, reads the lines again and
  says so. It does not merge. A payment typed with the refused change is saved by the save that follows
  the re-read. The words say *somewhere else*, because a writer on the same screen is refused the same
  way. Left as they were: a line added between the save's read and its delete (one save long), and a
  line deleted elsewhere, which a stale window still writes back.
- **PR 2, next:** the ground.
- **PRs 3 and 4:** not built.
