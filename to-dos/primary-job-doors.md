---
name: "A primary's job doors: the ones the scope never reached"
number: 400
mockup: not required — it narrows database doors and changes no screen
group: gated
status: audited 2026-11-19 on a whole-schema bed · nothing built · waiting on five calls from the owner
summary: >
  A primary has been held to their own jobs since v2.2177, but only where the tables' restrictive
  policies can see. Functions that run as the owner, and the policies that call them, still ask
  only "is this person a primary?". The audit found about fifty such doors, not the four first
  named. Through them a primary on no job reads another job's money lines, photos and test
  papers, and can write down or delete its bill. No screen of theirs asks, so this is a hole at
  the API. The card lists every door, what it gives, and the predicate proposed for it.
next: The owner answers the five calls below. Then PR 1, the money verbs, on the rule v2.5655 already set.
size: L as a train of five (M · M · S · M · S)
blocker: The owner's five calls. PR #8877 (v2.7906) on main first, since two PRs reuse its predicate.
opinion: build — PR 1 needs no call, it is the rule the paid verbs already follow; the rest wait on the calls
---

# A primary's job doors: the ones the scope never reached

## The ask

From the session that built PR #8877 (v2.7906, a primary reads the reports of their own jobs), 2026-11-19:
audit, then narrow, the job-level database doors that still let a `primary` through on the role alone for a
job that is not theirs. It named four and said not to trust the list. It asked for the list and a predicate
per door to come to the owner before anything is built.

## What was done

A copy of the whole schema was stood up in docker: every migration on `main` at `ab1421dc9`, then
`20261119040000_primary_scope_reports.sql` from PR #8877 on top. Three sweeps ran on it.

1. Every `SECURITY DEFINER` function in `public` that `authenticated` may call, whose body names the role
   `primary` (the quoted word, or `is_primary()`), or calls a yes/no helper that does. 137 functions. 76 of
   them reach a job, counting two that come in two shapes.
2. Every policy on a table that carries a job id, and every `storage.objects` policy, that names the role or
   calls one of those helpers. 128 tables carry a job id. 22 have a restrictive `primary_scope_*` fence.
3. Every view that does not run as the caller. Four, none over jobs.

Then a probe, in one transaction that rolled back. Mo, a master, owns the job *Water heater removal*. Pat is
a primary on no job. Pat asked each door about Mo's job. The table reads that the v2.2177 fences cover
answered nothing, as they should: `jobs_ledger`, `job_activity_events`, `job_schedule_blocks`. The doors
below answered.

## What a primary on no job gets today

Proven on the bed, as Pat, on a job that is not theirs:

| Asked | Answer |
|---|---|
| `list_job_activity_events(job)` | every line, the money lines too: *Invoice created $900.00*, *Marked billed*, *Payment $100.00* |
| `job_account_job_identity(job)`, `list_job_payment_promises_for(job)` | the job's name and number, and the customer's promise to pay |
| `list_unlinked_payments_for_bank_payments()` | the job's payment |
| `job_photo_notes`, and the `job-photo-notes` and `stage-checklist-photos` buckets | the crew's notes and photos |
| `job_test_reports`, and the `job-test-reports` bucket | the test paper and its file |
| `list_job_crew_position([job], today)` | the job's row: last work day, crew names, sheet stage |
| `apply_agreed_write_down_to_billed_invoice(bill, 850, …)` | `ok`: the bill was written down |
| `move_jobs_ledger_payment(payment, other job, …)` | `ok`: the payment moved to another job |
| `delete_billed_invoice_on_send_back(bill)` | `ok`: the bill was deleted |
| `set_job_pct_from_field(job, 55, …)` | `ok`: the job's percent was set |

Sam, a helper on that job's crew, asked the same. He got the plain activity lines, the photos and the percent,
as a crew member should. He was refused the money lines, the promise, the payment, the test paper, the crew's
position and all three bill and payment writes.

## Every door, by family

"Read" below means the function's body was read on the bed and its primary leg has the same shape as one the
probe proved. "Proven" means Pat got an answer.

### 1 · Money verbs that write (PR 1)

Each checks the role, then "may this person reach the job", and the second check says yes to any primary.

| Door | What it does to a job that is not theirs | How known |
|---|---|---|
| `apply_agreed_write_down_to_billed_invoice` | lowers a billed bill | proven |
| `delete_billed_invoice_on_send_back` | deletes a billed bill | proven |
| `delete_marked_paid_invoice_without_payment`, `delete_ready_to_bill_invoice` | delete a bill | read |
| `move_jobs_ledger_payment` | moves a payment to another job | proven |
| `revert_stripe_oob_invoice_payment` | takes a payment back off a bill | read |
| `update_job_status`, the paid to billed leg | sends a paid job back to billed | read |
| `apply_job_discount`, `log_job_discount_event`, `trip_put_on_job_line` | put a discount or a trip line on the job, through `can_read_job_activity` | read |
| `job_supply_house_accounts` insert | adds a supply house account to the job, through `can_read_job_activity` | read |
| `apply_estimate_to_job`, `create_job_from_estimate` | apply any signed estimate to any job, or make a job from it, through `user_can_access_estimate` | read |

**Predicate: `is_job_people(job)`.** It is the clause v2.5655 put into the five paid verbs on the owner's rule
for punch list #129: `role = 'primary' AND is_job_people(j.id)` in the job's own check. These verbs are the
same family and were missed by that pass. The two estimate verbs take `primary_can_access_estimate(estimate)`,
the scope a primary's estimates already have at the table.

### 2 · Money reads on one job (PR 2)

| Door | What it gives | How known |
|---|---|---|
| `can_read_job_activity(job, financial)` | the gate under the next four | proven, `true` |
| `list_job_activity_events(job)` | the job's whole activity feed with its money lines | proven |
| `job_account_job_identity(job)`, `list_job_account_strip(jobs)`, `job_supply_house_accounts` read | the job's name and number, and its supply house accounts | the first proven, the others read |
| `list_job_payment_promises_for(job)` | the customer's promises on the job | proven |
| `get_invoice_amounts_for_jobs`, `get_invoice_allocation_lines_for_jobs`, `list_tally_parts_with_po` | supply house bills and parts against the job. The leg asks `master_primaries`, which pairs every master with every primary since v2.921 | read |
| `get_payment_line_items`, `get_payment_line_items_bulk` | a payment's lines | proven, gate passes |
| `list_ar_allocations_for_mercury_transaction`, `list_ar_deposit_trails` | which jobs a deposit paid | read |

**Predicate: `is_job_people(job)`**, in place of the bare role in each job check. It is already the scope of a
primary's own money strips (`list_my_money_strip`, `list_customer_money_strip`, `list_bid_money_strip`), so
their screens keep every number they show today. `can_read_job_activity` keeps its crew leg for the lines
that are not money, so a primary on a job's crew still reads the plain feed, as a helper does.

### 3 · The money desks, which take no job (call 1)

The role is in the office list of each. None asks about a job, so none can be narrowed by a job predicate.

- The bank payments desk: `list_mercury_transactions_for_bank_payments`, `count_mercury_transactions_for_bank_payments`,
  `list_unlinked_payments_for_bank_payments`, `ar_book_applied_deposit_income`, `ar_deposit_booking`,
  `set_mercury_transaction_ar_closed`, `close_out_ar_deposit`, `set_mercury_transaction_ar_returned`,
  `take_returned_check_off_jobs`.
- Returned checks and disputes: `list_ar_return_cases`, `list_ar_return_case_fees`, `list_ar_returned_check_payers`,
  `add_ar_return_case_fee`, `put_back_lost_dispute_bill`, the close and reopen verbs of the three case kinds,
  and the read policies of `ar_stripe_cases` and `ar_unbanked_check_cases`.
- Who pays when: `get_billed_customer_pay_speeds`, `get_pay_speed_transactions` and `list_job_promised_pay_dates`
  by a list of their own, and `list_job_payment_promises`, `list_payment_promise_records` and
  `payer_pay_calendars` through `can_read_payment_promises()`.
- `gc_review_week_status(week)`.

The lists were proven to answer Pat for the bank payments read, the unlinked payments, the return cases, the
pay speeds, the promise records and the GC week. `ar_deposit_booking`, `set_mercury_transaction_ar_returned`
and the close and reopen verbs were found by the sweep and not each read.

A primary's Jobs page is the Reports tab alone, and the bank payments window opens from the Stages tab
(`JobsStagesTab`, `BankPaymentsModal`). `/accounts-receivable` is not on `PRIMARY_PATHS`. So no screen of a
primary reaches these.

**Proposed: take `primary` out of these lists.** No predicate is needed. `list_paid_claims` and
`list_job_payment_promises_for` already fall through to `is_job_people` when `can_read_payment_promises()`
says no, so a primary keeps the promises and claims on their own jobs. The build session must first search
the client for each name and confirm that no screen a primary can open calls it.

### 4 · Stage progress, photos and the stage checklist (PR 3, call 2)

`can_report_stage_progress(job)` says yes to a primary on any job. It gates:

| Door | Read or write |
|---|---|
| `job_photo_notes` | read, add, change |
| `stage_checklist_answers`, `stage_checklist_records`, `stage_checklist_skips`, `stage_checklist_templates` | read, and answers add and change |
| `first_looks`, and the `first-look-files` bucket | read |
| the `job-photo-notes`, `stage-checklist-photos` and `report-photos` buckets | read and add |
| `report_photos` | read (narrowed by #8877) and add |
| `machine_assignments` | change |
| `list_job_stage_progress(job)`, `record_stage_progress(job, …)` | the stage list with each stage's percent and whether its draw is paid, and the stamp |
| the `job-photos` edge function | the job's Drive photo list |

**The gate itself should not change.** It is the write gate of a field report. `NewReportModal` reads
`list_job_stage_progress` for the stage list, `useJobLineProgress` stamps through `record_stage_progress`, and
the photo checklist writes `stage_checklist_answers`. The owner's rule of 2026-11-19 narrowed reading, and a
primary still writes a report on any job. Taking the role out of the gate would break that form on a job that
is not theirs.

**Proposed: fence the reads, as #8877 did for `report_photos`.** A restrictive `primary_scope_*` policy on
`job_photo_notes`, `stage_checklist_answers`, `stage_checklist_records`, `stage_checklist_skips` and
`first_looks`, and the same clause on the read policies of the three buckets and in `job-photos`:

`NOT is_primary() OR <their own row> OR primary_can_read_job_reports(job) OR helper_on_job(job)`

`primary_can_read_job_reports` is #8877's rule: account manager, or listed superintendent on the job's project.
Photos and checklist answers are what a report is made of, so they follow the reports. `helper_on_job(job)`
exists already and is not tied to a role, despite its name: on the job's crew, or on its schedule this week
or last. It is the crew claim, so no fourth predicate is written. The stage list and the stamp stay open,
because the report form needs them on any job.

### 5 · The crew's position (PR 3)

`list_job_crew_position(jobs, today)` has `primary` in its office list and answers any job id: last work day,
the crew's names, the sub sheet's stage. #8877 narrowed its newest-report percent only.

**Predicate: `primary_can_read_job_reports(job)`** on the job rows, the predicate #8877 put on the percent in
the same function. One rule for the whole row.

### 6 · Test papers (PR 4)

`can_reach_job_for_test_report(job)` passes any primary. It is the job check of all four `job_test_reports`
policies and of the `job-test-reports` bucket. The table was made on 2026-09-11, after the v2.2177 fences,
and copied the `jobs_ledger_fixtures` job check without the restrictive policy that sits on top of it there.

**Predicate: `primary_can_access_job(job)`**, in the function's primary leg. It is what every other job child
table asks. A test paper is a job document, and Documents already shows a primary their own jobs only.

### 7 · Schedule shares and emails (PR 4)

`list_schedule_blocks_for_share(viewer, start, end)` and `list_job_schedule_blocks_for_schedule_email(recipient, day)`
answer every job's blocks, with the job's name and address, when the named person is a primary. The table
`job_schedule_blocks` is already held to a primary's own jobs and the blocks assigned to them.

**Predicate: the table's own rule, written inline.** These two ask about a named person, not the caller, and
`primary_can_access_job` reads `auth.uid()`. So the leg becomes `jl.account_manager_user_id = viewer`, the
same column `primary_scope_jobs_ledger` checks. The assigned-to-them leg is already there.

### 8 · Doors that should stay open (call 4)

| Door | Why it stays |
|---|---|
| `search_jobs_for_reports` | the New-report picker. The owner's rule keeps writing on any job. |
| `set_job_pct_from_field(job, pct, note)` | the percent a report carries onto its job (`propagateReportPctToJob`). A helper on the crew may set it too. |
| `list_job_stage_progress`, `record_stage_progress` | the report form's stage list and stamp, family 4. |
| `jobs_ledger_row_visible_for_tally_assign`, `search_jobs_for_tally_mercury_assign_as_user` | the Tally picker: a job's number, name and address, to put a card purchase on it. A primary buys for jobs that are not theirs. |
| `trips_office()`: the policies of `trips`, `trip_jobs` and `trip_dismissals`, `trip_deleted_list`, `trip_phone_state` | written on 2026-11-17 with the primary named as trips office on purpose. |
| `sent_documents` insert | the send log, add only. |

### 9 · The papers lock (call 5)

`job_shut_to_me` and `job_shut_to_user` never lock a primary out of a job for a paper they owe. They grant
nothing. They only decline to close a job. **Proposed: leave them.** Once the families above are narrowed, a
primary reaches a job as one of its people, where the owner's call 8 of the papers train holds: the prompt at
the job is the lock, and hiding the row would take the job out of their money totals. One case is new. A
primary on a crew who owes a paper is not locked out the way a helper on that crew is.

### 10 · Already held, checked and left alone

- `job_schedule_blocks` and `stripe_oob_payment_reverts` name the role inside a sub-select on `jobs_ledger`.
  A policy's sub-select runs under the caller's own policies, so the v2.2177 fence decides. Proven: Pat read
  no block.
- The on-site family (`job_containers`, `job_places`, `job_material_movements`, `job_box_photos`,
  `job_part_renames`, `plan_parts`, `plan_sets`, `painted_maps`, `sticker_runs`, `on_site_prices`,
  `on_site_part_ties`, `on_site_removed_answers`) goes through `on_site_can_touch_job`, which runs as the
  caller on purpose.
- `messages` for the tech's door asks `messages_tech_on_job`: on the job's crew or schedule.
- The paid verbs of v2.5655, the money strips and the report lists of #8877.

## The five calls for the owner

1. **The money desks.** A primary has no screen onto bank payments, returned checks or pay speeds. Take the
   role out of those lists? *Proposed: yes.* They keep the promises and claims on their own jobs.
2. **Photos and stage checklists on a job that is not theirs.** A primary reads them when they are the
   account manager, a listed superintendent, on the job's crew, or on its schedule this week or last. Is the
   crew enough of a claim? *Proposed: yes, as it is for a helper.* It matters today. On 2026-11-19 one real
   primary was the account manager of 21 jobs and on the crew of 37, the 21 among them. The other was the
   account manager of none and on the crew of 12. With the account manager rule alone the second reads
   nothing.
3. **A workflow stage assigned to them.** Does a stage on the job's project open the job's photos? *Proposed:
   not yet.* They see the stage on their Dashboard. No predicate here covers it, and none is written until a
   real case asks.
4. **The doors that stay open**, family 8: the two pickers, the percent, the trips office. *Proposed: leave
   all of them.*
5. **The papers lock.** A primary on a crew who owes a paper stays unlocked. *Proposed: leave it, the owner's
   call 8 named the role.*

## The plan

Each PR is one migration with its page under `docs/migrations/`, a bed in `scripts/sql-beds.txt`, and
`docs/ACCESS_CONTROL.md` amended in place. Every function is replaced from its live definition
(`pg_get_functiondef` on a whole-schema bed), never from the baseline. No name, argument or returned column
changes, so each is safe on either side of the client deploy. Auto-merge stays unarmed until someone is at
hand to push.

1. **The money verbs** (family 1). `is_job_people` in each job check. Needs no call.
2. **Money reads on one job** (family 2). `is_job_people` in `can_read_job_activity` and the per-job reads.
3. **Photos, checklists and the crew's position** (families 4 and 5). After #8877 is on `main`, and after
   calls 2 and 3. The `job-photos` edge function is deployed with it.
4. **Test papers and schedule shares** (families 6 and 7).
5. **The money desks** (family 3). After call 1. The client search comes first.

Each bed asks the same thing: a primary on one job reads through each door for that job and is refused for
another. A master, an assistant, a superintendent and a helper read as before.

## How to verify

The bed is `scripts/pgtest-primary-scope-reports.sh` from #8877, copied. The probe that produced the table
above seeds two primaries, a master, a helper and two jobs, then asks about forty doors as each person and
prints the answers. It is the start of every bed here. It and the three sweep queries are in the hand-over
note of the session that wrote this card, outside the repo. Ask the session for them.

After each push, as the dev, read-only: `View as` the sample primary, who is on no job, and open the
Dashboard. Nothing they see should change, because no screen of theirs asked these doors.

## What the audit did not cover

- A function that lets every signed-in person through, with no role list, names no role and was not swept.
- A policy that calls a helper more than four calls deep.
- The edge functions were searched for the role's name only. `stripe-invoice-agreed-write-down` reads the
  bill as the caller, so the table's fence holds it. The money emails that list `primary` among their
  recipients (`billed-report-email`, `money-waiting-email-dispatch`, `weekly-movement-email-dispatch`,
  `payment-forecast-email-dispatch`) send a company's money to a primary the office subscribes. They are
  not job doors and are not in the plan.
- Two things beside the job. `is_dev_or_master_or_assistant()` admits a primary despite its name, on the
  Quickfill tables, `office_inbox_papers` and the recurring report schedules. `can_access_bid_for_pricing`
  passes any primary on any bid, which `docs/ACCESS_CONTROL.md` already says.
- Prod was read for three facts only, as the dev: who is a primary, their crew rows and their jobs. Every
  answer in the tables above is from the bed.
