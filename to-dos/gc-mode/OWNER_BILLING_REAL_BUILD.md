---
name: "GC mode, Owner Billing: the real build plan"
parent: to-dos/gc-mode/README.md (punch list #81)
status: planned 2026-10-07 by Helper 5 (Owner Billing lane) under the lead session *GC spike* (`PLAN_2026-10-07.md`) · nothing built · seams agreed the same evening with Helpers 1 to 4 (*The other lanes*) · waits on the lead's review and the owner's word on *Decisions*
summary: >
  How Bill the customer, change orders, payments, promises, reminders, interest, the late finish,
  the customer's acceptance and the Money tab move from the prototype (made-up data on branch
  spike/gc-mode) into the real app. The heart of it: a GC job we win gets one Pipeline job, its
  billing job, and every bill we send becomes a bill on that job. The customer's statement, Stripe,
  bank transfer, the payment recording, the promises, the chase list and the lien waiver train then
  work unchanged. Our pay application's own record (lines, retainage, the certificate) is new
  tables; the money in it stays with the owner and the controller.
size: L (7 tables and 8 columns on gc_projects, about 10 RPCs, 2 edge functions, 10 PRs)
blocker: the lead's review and the owner's word on the decisions; O2b waits on Building's U2; O3's
  answers to a trade's ask wait on the Portal's P4; a bill with real trade work waits on Building's U6
---

# GC mode, Owner Billing: the real build plan

## What moves, and what stays

The prototype proved these, and they move (`README.md` → *What the prototype has*, the rows
*Bill the owner*, *Money*, *The owner's price once signed*, *Interest in the company window*):

- **The customer's price as signed**: kept by line the day our contract with the customer is
  marked signed, so buying a trade out never changes it; only a change order does.
- **Change orders to the customer**: drafted by hand, from a set of plans, from an RFI or from a
  trade's ask; sent; signed or declined; their percent done; the days they add; a time extension
  (G-141).
- **Our pay application each month**: one line per trade at its share done of the signed price, our
  costs and fee spread into the trades, change orders as lines of their own, stored materials,
  retainage with its step, done so far less held less asked before. Sent as it went and never
  changed after.
- **The AIA G702 and G703 as a file**, every line, "TO CUSTOMER", the property's owner when it is
  someone else, the architect's certificate, the notary block, Excel and PDF.
- **The architect's certificate**, for what we asked or less, with why.
- **Payments, promises and reminders**, late bills, part payments.
- **Our lien waivers to the customer**: conditional with each bill, unconditional with each payment,
  and the pair on final payment.
- **Interest on late bills**, its own bill. **The late finish** against the contract's day and its
  fee a day.
- **Closeout with the customer**: every line billed, the customer accepts the work, our final pay
  application for what they hold.
- **Money** (owner and controller only): money across the jobs, who owes us, the next six weeks,
  what each job makes us, bill day across every job, the billing forecast, the Monday email.

These stay with the lanes that own them, and this plan only points at them:

- **Board**: sending our contract to the customer and Get started (B6). B6 calls this plan's
  `gc_sign_owner_contract` for *Owner contract signed* and never writes its columns.
- **Building**: the trades' draws, their pay applications and their lien waivers to us (U6). Also
  the trade's side of a signed change, `gc_change_order_trade_sends` (U6). Our own crew's percent
  comes from its Pipeline job (U8). RFIs (U5) keep `gc_rfis.change_order_id`, pointing at this
  plan's table.
- **Portal**: a trade's ask for a change, `gc_trade_change_requests` (P4), with its
  `change_order_id`. The trade's emails go through P3.
- **Schedule**: the bars and their moves. `gc_schedule_moves.change_order_id` gains its foreign key
  here (O1). `whatIfDiff` is Helper 1's to lift in PR 11 once the billing forecast is on main.

**What stays on the spike**: the architect's portal and the customer's portal as the prototype
draws them (*See what the architect sees*, *See what the customer sees*). In the real build the
customer reads the app's customer portal. The architect certifies on paper or by email until
decision 4 says otherwise. `customerMessages` (*Their messages*) stays too: the real list is what
went, read from the sent copies.

## Decisions before the first migration

Each has a default the plan is written to. The lead takes them to the owner in one list with the
other lanes'. Decisions 1 to 4 shape the tables, so they come first.

1. **Where a bill lives: a Pipeline job for each GC job we win.** *Default:* the first time we send
   the customer a pay application, the project gets one row in `jobs_ledger`, its **billing job**.
   That row is named "<project> (GC)", for the project's customer. `jobs_ledger.project_id` stays
   null (decision 10's check: a project with a superintendent would put it on their list), and
   `gc_projects.billing_job_id` names it. Every bill we send becomes a `jobs_ledger_invoices`
   row on it. So the rest is the app's own:
   - the customer portal's statement and its **Pay** (`customer-portal`, `portalMergedBills.ts`);
   - the Stripe link (`create-stripe-invoice`, `pay-link`) and the bank transfer card;
   - the payment recording (`mark_invoice_paid`, the Stripe webhook, the Mercury allocations);
   - the promises (`job_payment_promises`) and the portal's *give us a day* (`PortalPromiseAsk`);
   - the chase list (`buildPaymentChaseQueue`), the pay speeds (`get_billed_customer_pay_speeds`);
   - the lien waiver train (`job_lien_releases`).

   The scouts found every one of those keyed to `jobs_ledger`, and nothing in billing reads
   `projects`. Teaching each to read a project would be a second system, which `BUILD_MAP.md`
   section 5 sends back.
   *What it costs:* the GC job's bills show on the Pipeline's Billed list, in AR and in the pay
   speeds, to whoever sees billing there today. That is the bill to the customer, which the
   customer sees too. Our lines, fee, costs and margin never go on it (decision 2).
   *Not taken:* storing our pay applications in `job_pay_applications`, the Jobs Stages tab's AIA
   history. Its `lines` hold what the workbook prints, and the Pipeline's window would reprint them.
   Our record keeps the fee and contingency as lines of their own before they are spread, which only
   the owner and the controller may read. *Is this the best…* way 1 comes back to it.
2. **Who sees it.** *Default:* dev only while it is built. Each new table's policy is
   `(SELECT public.is_dev())`, the page redirects anyone else, and the windows hang off `/gc`. When
   the trade side is real (`PLAN_2026-10-07.md`: Owner Billing stays dev-only until then), a door
   PR opens it to the owner (master) and the controller. Nothing here opens to estimators or
   assistants. An assistant follows up on a late GC bill from the Pipeline's chase list as they do
   any bill.
3. **When a bill is payable: at the architect's certificate.** *Default:* sending a pay application
   files our record, emails it and makes our conditional waiver. The bill on the billing job is made
   when the certificate is recorded, for the certified amount. Until then the customer has the pay
   application by email and nothing to pay (the owner's rule, 2026-10-03: the owner pays what is
   certified). What the architect cut comes back on the next bill (G702 line 7), as the
   kernel already counts.
4. **Who records the certificate: the office.** *Default:* the main app has no architect portal.
   The architect gets our G702 and G703 by email with *Please certify*. They sign the certificate
   and send it back, and the office types the amount, the day and why it is less. An architect's
   link is *Is this the best…* way 2.
5. **Who records the customer's yes.** *Default:* the office records a change order's signature or
   decline (from the signed PDF or the email) in O3. The office records the acceptance of the work
   in O7. The customer portal's own **Sign**, **Decline** and **Accept the work** come in O7b,
   through `submit-portal-request`'s kinds. They call the same RPCs, and the customer's Sign on our
   contract calls `gc_sign_owner_contract` (Helper 2's ask).
6. **Retainage is the job's, not the customer record's.** The prototype reads
   `GcCustomer.retainagePct`; `customers` has no such column and is not changed (New Project's
   decision 4). *Default:* `gc_projects.owner_retainage_pct`, 10 to start. The mapper hands it to
   the kernel as the customer's percent for that project, so no kernel changes.
7. **When a bill is due, and when interest starts.** The prototype's stand-in is the customer's
   first promise or the day we expected the money. *Default:* `gc_projects.owner_pay_days`, the
   contract's days to pay after the certificate (null until typed). A bill is due that many days
   after its certificate. Interest runs from the day after (O6 changes `ownerInterestFrom` to read
   it, the one kernel change in this plan, with the owner's OK). The customer's usual days to pay
   still drives *expected* (the forecast, Money), read from the app's pay speeds by customer.
8. **Promises are per job.** The Pipeline keys a promise to a job, not a bill. *Default:* a promise
   on the billing job covers every bill open when it was made. The mapper hands it to each of those
   bills, so `ownerPayDue` reads it unchanged.
9. **Card payments on a large bill.** A card fee on a $288,879 pay application is about $8,000.
   *Default:* the statement shows the bank transfer card. A Stripe link is made only when the office
   presses it on that bill, as in the Pipeline today.
10. **The billing job's service type.** `jobs_ledger.service_type_id` and `master_user_id` are
    required. *Default:* a *General contracting* service type, added in O4a's migration if it is
    missing, and the owner's user as master. O4a first reads which Pipeline screens list a job of
    that type (crew boards, dispatch, hours). It keeps the billing job off every crew screen, or it
    stops and asks the lead.

    **The check (2026-10-07, a read of main): it would show on crew screens, so O4a stops here.**
    Nothing on main can hide a job: `jobs_ledger` has no hidden or kind column, and
    `service_types` has no flag. No job list filters by service type. A billing job left
    `working`, with no team, no schedule and no `project_id`, stays off every list built from
    a team, a schedule or a clock session:
    - My jobs and the clock-in default list;
    - the crew-day cards and email;
    - the calendar, the team board and My schedule;
    - the Hours grid.

    It still shows in four places:
    - **The clock-in typed search** (`search_jobs_ledger`, `20260905220000`), with no status,
      team or owner filter. The same search feeds the hours and dispatch pickers.
    - **My Schedule's "+ Add job"** (`search_jobs_for_self_schedule`, `20260811140701`), open to
      any signed-in user. It lists the top 20 before anyone types.
    - **The dispatch board's job pickers** (`fetchJobsLedgerForScheduleDispatchHub`).
    - **The office's Tally and `/map`.**

    Nothing on the server stops a clock-in on it. Once someone clocks in, the read policy on
    their own sessions puts the job on every session-built screen.

    **The fix, if the owner keeps decision 1:** one Pipeline PR of its own, before O4a.
    - `jobs_ledger.billing_only boolean NOT NULL DEFAULT false`.
    - A guard on `clock_sessions`, `job_schedule_blocks` and `jobs_ledger_team_members` that
      refuses a billing-only job.
    - `search_jobs_for_self_schedule` leaves it out.
    - `search_jobs_ledger` leaves it out unless asked. The money pickers ask: Mercury
      allocations, the transaction detail, the payment move, the header search.
    - The dispatch hub, office Tally, `/map` and the job follow-up queue leave it out.

    It is an ALTER on `jobs_ledger`, a busy table, and touches the Pipeline's own screens.

    The read also found three things O4a has to get right:
    - **Revenue:** a job's `revenue` must be the contract and be kept current. With it null, the
      first payment marks the job paid, and every later bill drops off as "on a paid job"
      (`20260927230000`).
    - **Status:** the job stays `working`, with bills inserted as `billed`. A `billed` job with
      no billed bills shows its revenue less payments as owed.
    - **`project_id` stays null:** a project with a superintendent puts its jobs on the
      superintendent's list. `gc_projects.billing_job_id` is the only link.

    Three office places are the owner's to say: whether the money-waiting email counts it (it reads
    only `billed` jobs), whether its bills count as revenue in the overhead rate (pass-through
    money lowers it), and whether it belongs in Job Summary and the Stages header counts.

## The tables (O1, one migration)

Every migration follows `CLAUDE.md`: `SET lock_timeout = '3s';` first, numbered from `origin/main`,
claimed with `npm run claim -- --migration <file>`, idempotent, pushed by the lead with
`supabase db push` only after it is on `main`. Every new table has RLS with
`(SELECT public.is_dev())` (decision 2). The migration ends with the three block calls,
`apply_read_only_write_blocks()`, `apply_read_only_stmt_blocks()` and
`apply_digital_twin_write_blocks()`. Each column names the prototype field it carries
(`src/lib/gcMode/gcTypes.ts`).

**On `gc_projects`** (ADD COLUMN IF NOT EXISTS; the table is New Project's, the columns are
Owner Billing's):

- `owner_contract_signed_on` date (`GcProject.ownerContractSignedOn`). Written only by
  `gc_sign_owner_contract`.
- `owner_retainage_pct` numeric NOT NULL DEFAULT 10, 0 to 100 (decision 6).
- `owner_retainage_step_at_pct`, `owner_retainage_step_to_pct` numeric, and
  `owner_retainage_step_way` text (`after`, `all`) (`OwnerRetainageStep`). All three null (held
  to the end) or all set. `at` is 1 to 99, and `to` is below `owner_retainage_pct`.
- `owner_late_interest_pct_per_month` numeric, null for none, above 0 (`ownerLateInterest`).
- `owner_late_finish_per_day` numeric, null for none, 0 or more (`ownerLateFinish`).
- `owner_pay_days` integer, null until typed, 0 or more (decision 7).
- `billing_job_id` uuid UNIQUE, FK `jobs_ledger(id)` ON DELETE SET NULL (decision 1).

**`gc_owner_contract_lines`**: the customer's price as signed, by line
(`GcProject.ownerContractWorth`). Columns: `project_id` (FK `projects`, cascade), `line` (`trade`,
`gc`, `contingency`, `fee`), `package_id` (FK `gc_trade_packages`, restrict; set only on a trade
line), `worth` numeric. One row per trade and one per our three lines (two partial unique
indexes). Written only by `gc_sign_owner_contract`, all at once.

**`gc_change_orders`** (`ChangeOrder`): `id`, `project_id`, `number` (unique per project, given
at the draft), `description` (not blank), `reason` (`owner`, `field`, `plans`), `schedule_words`
(`schedule`, default `none`), `package_id` (FK `gc_trade_packages`, restrict; null is our own work),
`cost`, `price` (negative for a credit), `status` (`draft`, `sent`, `signed`, `declined`), `sent_on`,
`answered_on`, `answered_how` (`office`, `portal`), `pct_done` (0 to 100), `days` (0 or more),
`days_on_chart` uuid[] (the schedule moves a time extension asks for, G-141), `plan_set_id` (FK
`gc_plan_sets`, set null: the set that started it), `created_by`, `created_at`. Checks: sent needs
`sent_on`, signed or declined needs `answered_on`, and a time extension has cost and price 0.
Agreed with the other lanes:
- the RFI and the trade's ask keep the link (`gc_rfis.change_order_id`, U5;
  `gc_trade_change_requests.change_order_id`, P4);
- the trade's side lives on Building's `gc_change_order_trade_sends` (U6);
- this migration adds `gc_schedule_moves.change_order_id`'s foreign key, which that column's
  comment waits for. The table is empty on prod, so the check is instant.

**`gc_owner_pay_apps`**: our pay applications as each went (`OwnerPayAppSent`). Columns:
- `id`, `project_id`, `number` (unique per project, 1 up), `final` boolean, `period_to`,
  `sent_on`, `sent_by`;
- `retainage_pct` and the step as it went (the same three columns and check), `retainage`,
  `work_to_date`, `due`;
- the certificate: `certified` (null while it waits on the architect), `certified_on`,
  `certified_note`, `certified_by` (who typed it);
- `invoice_id` (FK `jobs_ledger_invoices`, set null: the bill made at the certificate,
  decision 3) and `conditional_waiver_id` (FK `job_lien_releases`, set null: our conditional
  waiver with it). *As built:* both come with O4a's migration, which first uses them, so only
  `billing_job_id` leans on decision 1 until then (the lead, 2026-10-07).

*As built in O1:* a sent row is held by privileges, the schedule's pattern, not a trigger
(HANDOFF's gotcha: a sent bill keeps what it went with). `authenticated` has no UPDATE, DELETE or
TRUNCATE on pay applications, their lines, reminders and interest bills. Two column grants stay:
the certificate's four columns, and a reminder's `email_send_log_id`. O4a adds the grants for its
two links. The trade keys on contract lines, change orders and pay application lines, and the
change order key on those lines, are `DEFERRABLE INITIALLY DEFERRED`. A billed or signed trade
can't be deleted, and a whole project still goes by cascade. Without the deferral, a project
delete failed before the cascade reached the bill lines (found on a local Postgres run). Paid is not stored.
It is read from the bill's payments in `jobs_ledger_payments`, and the bill's own `status = 'paid'`
closes it, so there is one record of money in.

**`gc_owner_pay_app_lines`**: one row per line of a sent pay application (`doneToDate`,
`worthByLine`, `storedByLine`). Columns: `pay_app_id` (cascade), `line` (`trade`, `self`, `gc`,
`contingency`, `fee`, `change_order`), `package_id`, `change_order_id`, `label` (as it went),
`worth`, `done_to_date`, `stored`. The lines are kept before the spread: the fee is a line here,
which is why the table is owner and controller only, and why the printed 703 is rebuilt from it
(`spreadMarkup`), never stored.

**`gc_owner_pay_reminders`**: our asks to pay a late bill (`OwnerPayAppSent.reminders`):
`pay_app_id`, `sent_on`, `sent_by`, `pay_by`, `note`, `subject`, `lines` text[], `email_send_log_id`.
A reminder is never a promise. The RPC that writes it also writes a chase touch on the billing job
(`add_payment_chase_touch`, outcome `note`, "Reminder emailed, pay by Oct 12"). That way the
Pipeline's chase list knows we touched them.

**`gc_owner_interest_bills`** (`OwnerInterestBill`): `project_id`, `number` (unique per project),
`sent_on`, `amount` (above 0), `invoice_id` (FK `jobs_ledger_invoices`; the interest bill is a bill
on the billing job, with its own **Pay**; *as built,* it comes with O4a), `created_by`. Paid is read from the bill, as above.

**`gc_owner_acceptances`**: the customer accepts the work (`OwnerBilling.acceptedOn`). Columns:
`project_id` (primary key), `accepted_on`, `accepted_by_name` (who walked it), `how` (`office`,
`portal`), `note`, `recorded_by`, `created_at`.

**Not tables, because the app has them**: payments (`jobs_ledger_payments` on the bill), promises
(`job_payment_promises` on the billing job), the bills themselves (`jobs_ledger_invoices`), our
waivers (`job_lien_releases` on the billing job, `invoice_ids` naming the bill), the emails
(`email_send_log`, `sent_documents`).

## What the app already has, reused

- **The AIA form**: `src/lib/aiaG702G703Template.ts` and `src/lib/fillAiaG702G703Workbook.ts`
  (ExcelJS). **This changes the brief.** The filler already writes every 703 line, rows 13 to 46
  (`writeLines`, `aiaPayApplicationLines.ts`, 34 rows; a 35th throws `AiaTooManyRows`), since the
  Pipeline's history train. What it lacks for us:
  - "TO OWNER:" at A5 is fixed, and the certificate is signed by "CONSTRUCTION MGR:" (J44), not an
    architect;
  - the notary block (J26 to J29) is static text;
  - each row's retainage is the formula `H × C28`, one rate, so a retainage step cannot print;
  - there is no PDF.
  O4a adds those as options the Pipeline's window never passes, so the Jobs Stages tab's file is
  unchanged.
- **The bill, Pay, Stripe, bank transfer, payments, promises, the chase list, pay speeds**: on the
  billing job (decision 1). `customerPaymentTerms.ts` and `billedExpectedPay.ts`'s late rule are
  the Pipeline's, and they agree with the prototype's ("late the day after").
- **Our lien waivers**: the train's four forms (`LienWaiverFormType`: `conditional_progress`,
  `unconditional_progress`, `conditional_final`, `unconditional_final`). `job_lien_releases` sits
  on the billing job, made and signed in `LienReleaseModal` with the stored ink, and emailed by
  `send-lien-release-email`. The portal's *Waivers* section (`_shared/portalWaivers.ts`) shows them
  with no change. We are already the releasing party there.
- **The trades' waivers to us** are a different system (`LienWaiverSendModal`,
  `person_contract_documents`, the Texas statutory forms) and are Building's (U6). Our
  `tradeWaiverChecks` reads what U6 records.
- **The customer's usual days to pay**: `get_billed_customer_pay_speeds` (the customer's median;
  null when they have not paid us, as the kernel expects, never the company's median).
- **Sent copies**: `fileSentCopy` / `printAndFile` with new kinds `gc_pay_application`,
  `gc_change_order` and `gc_interest_bill` (`docs/SENT_COPIES.md`). Every outside email files its
  copy through `_shared/sentCopyEmail.ts`.
- **Emails**: `sendEmailViaResend` from `COMPANY_EMAIL_FROM`, Reply-To the project manager
  (`gc_projects.project_manager_user_id`), the way `gc-plan-question-email` does.
- **The GC entity's name**: `src/lib/gc/company.ts` (`GC_COMPANY`) for the G702's FROM block, until
  the owner names it (call 12).

## Kernels that move over with their tests

Word for word, function by function, into `src/lib/gc/` (`BUILD_MAP.md` section 5). The prototype
deletes what moved and re-exports it (Helper 7's follow-up commit). `to-dos/gc-mode/scripts/lift-same.cjs`,
with a manifest per PR (`owner-billing-o2a.lift.json`, `-o2b`), shows each moved declaration equals
the spike's. The prototype's tests play the reducer (`gcOwnerBilling.test.ts` calls `gcReducer` 133
times), so they stay on the spike. Main gets `*.direct.test.ts` files that run each kernel on the
test state and pin the prototype's own answers, the schedule's pattern.

**The types**: `src/lib/gc/types.ts` gains, additions only: `OwnerBilling`, `OwnerPayAppSent`,
`OwnerRetainageStep`, `OwnerInterestBill`; the rest of `ChangeOrder` (`reason`, `schedule`, `cost`,
`price`, `pctDone`); the owner-billing fields of `GcProject`; `GcCustomer.payDays`, `retainagePct`
and `address`. `PayAppLine` and `PayApplication` come from whichever of O2a and U2 lands first
(agreed with Helper 4). The test state (`src/lib/gc/schedule/testState.ts`) is regenerated by
`to-dos/gc-mode/scripts/schedule-test-state.ts`, never by hand. It is Helper 1's file, so O2a
messages Helper 1 before the regeneration.

**O2a: everything whose inputs are on main today** (about 650 lines):

- `ownerBilling.ts` (extends the file the schedule's 1a started):
  - the calendar and the price: `OWNER_BILL_DAY`, `OWNER_RETAINAGE_DEFAULT_PCT`, `nextOwnerBillDay`,
    `ownerContractWorthNow`, `ownerContractWorthOf`, `ownerContractPrice`;
  - one bill's money: `ownerPayAppsSent`, `appCertified`, `appClaimed`, `appPaid`, `appOpen`,
    `ownerRetainageOn`, `ownerRetainageWords`, `ownerCarriedForward`, `ownerPayAppHasWork`,
    `ownerPayAppToSend`;
  - the account and its due days: `ownerAccount`, `ownerExpectPaidOn`, `ourOwnerWaivers`,
    `ownerReleasedRetainage`, `ownerPayDue`, `ownerLateBills`;
  - the spread and change orders: `OUR_COST_LINE_IDS`, `spreadMarkup`, `markupOnTop`,
    `CHANGE_ORDER_REASON_WORDS`, `isChangeOrderLineId`, `daysWords`, `changeOrderScheduleWords`,
    `changeOrderPrice`, `changeOrderWho`;
  - the types `OwnerLine`, `OwnerPayApp`, `OwnerAccount`, `OurOwnerWaiver`, `OwnerPayDue`.
- `ownerBillingInterest.ts`: all of it (`OWNER_INTEREST_DEFAULT_PCT`, `ownerInterestFrom`,
  `ownerInterestOnBill`, `ownerInterest`).
- `ownerBillingRemind.ts`: all of it (`PAY_REMINDER_DAYS`, `payReminderStep`, `customerGreeting`,
  `payReminderEmail`, `latePayApps`, `payReminderSentWords`).
- `ownerBillingFinish.ts`: `ownerFinishRisk` (it reads `projectedFinish` and
  `substantialCompletionOn`, on main since the schedule's 1b).
- `payAppFile.ts`: `payAppCells`, `splitAddress`, `PayAppParties`, `PayAppRow`, `PayAppCells`,
  `PAY_APP_FIRST_ROW`, `PAY_APP_LAST_ROW` (agreed with Helper 4: the cells are Owner Billing's, the
  trade's `payApplication` is Building's).
- From other lanes' files, by agreement: `proposalTotals` and `ProposalTotals` into `bids.ts` (the
  Board's; whichever of O2a and B2 is cut first, Helper 2's OK), and `money` into `words.ts`.

**O2b: what reads Building's kernels** (waits on U2: `ownCrewWork`, `changeOrderTradePct`,
`retainageHeldNow`, `tradeCloseout`, `payApplication`, `drawLinesOf`, `drawMoney`, `drawPayDays`,
`tradeRetainageOpensOn`, and `Draw`'s fields):

- `ownerBilling.ts`: `ownerPayApp` with its private `tradeLine` and `changeOrderLine`,
  `changeOrderPct`, `sentPayAppLines`, `ownerAllBilled`, `ownerCloseout`, `ownerFinalPayAppToSend`,
  `tradeWaiverChecks`, `missingTradeWaivers`, `tradesOwingUnconditional`, `owedDrawWords`,
  `ownerPayAppParties`, `ownerPayAppForm`, `projectCash`, `allJobsMoney`.
- `ownerBillingDay.ts` (`billDay`), `ownerBillingMargin.ts` (`jobMargin`, `allJobsMargin`),
  `ownerBillingAhead.ts` (`cashMoves`, `cashAhead`), `billingForecast.ts` (all), `cashForecast.ts`
  (all).
- `lateFinish.ts` and `timeExtension.ts` (G-98 and G-141), at `src/lib/gc/`, not in `schedule/`.
  Agreed with Helper 1: billing reads the schedule kernels and no schedule kernel reads billing.
  `whatIfDiff` stays for Helper 1's PR 11, which imports `billingForecast` from here.

If U2 slips past day 3, O2b is cut with the Building reads taken as arguments (the schedule's way
3), and a later PR swaps them for the imports. Helper 1 hears by the morning of day 3 whether the
forecast is in.

**What does not move**: `customerMessages` and `customerMessageParties` (the real list is what
went), the Board's `gcCustomerSend` builders, and the reducer's actions (they become the RPCs
below).

**The mapper**: `ownerBillingFromRows` beside `projectRows.ts`. It turns the rows into the
prototype's shapes, so no kernel changes when the data is real:
- the contract lines → `ownerContractWorth`;
- `gc_projects`' columns → the step, the interest and the late fee;
- the change orders, and the pay applications with their lines → `doneToDate`, `worthByLine` and
  `storedByLine`;
- each bill's `jobs_ledger_payments` → `payments`, its status `paid` → `paidOn`;
- the billing job's live promises → each bill open when they were made (decision 8);
- the reminders, the interest bills and the acceptance;
- `owner_retainage_pct` and the pay speed → the customer's `retainagePct` and `payDays`.
Its test runs on a row set built from the fixture's Helotes Dental Office.

## The RPCs

All `SECURITY INVOKER`, so RLS decides who may. Each is one transaction, and each refuses in
words before a table would.

- **`gc_sign_owner_contract(p_project_id, p_signed_on date, p_lines jsonb)`** (O1). It writes the
  date and the price by line at once. The lines come from the client's `ownerContractWorthNow`,
  since the quotes behind them are the Board's. It refuses lines that do not name every trade once
  and our three lines once. A null day clears both (the prototype's *marked not signed*). Board's
  B6 and the portal's Sign call it (Helper 2).
- **`gc_draft_change_order(p_project_id, p_draft jsonb)`** (O3). It gives the next number under a
  lock on the project's row, and takes the `draftChangeOrder` action's shape. Its siblings:
  - `gc_send_change_order(p_id)`;
  - `gc_answer_change_order(p_id, p_signed boolean, p_on date, p_how text)`;
  - `gc_draft_time_extension(p_project_id, p_moves uuid[], p_days int)`;
  - from P4, `gc_draft_change_order_from_request(p_request_id, …)` and
    `gc_turn_down_change_request(p_request_id, p_note)` (agreed with Helper 3). Each writes the
    request's columns in the same transaction.
  The percent done is a plain update under RLS.
- **`gc_send_owner_pay_app(p_project_id, p_app jsonb)`** (O4a). It files the record and its lines
  as `ownerPayAppToSend` built them. It refuses a number other than the next, a bill day before the
  last one, and an empty bill. It opens the billing job if the project has none (decision 1). The
  final pay application goes through it with `final`, after the acceptance.
- **`gc_record_certificate(p_pay_app_id, p_amount, p_on, p_note)`** (O4a). It records the
  certificate (an amount above what we asked is refused, and less needs a note). It makes the bill
  on the billing job for the certified amount, `status = 'billed'`, `billed_at` the day, and the bill-to
  fields from the customer. It writes `invoice_id`.
- **`gc_remind_customer_to_pay(p_pay_app_id, p_pay_by, p_note, p_subject, p_lines)`** (O5). It
  writes the reminder and the chase touch. It refuses a bill not certified, paid, or not yet due
  (the kernel's `payReminderStep` rule).
- **`gc_send_owner_interest_bill(p_project_id, p_amount)`** (O6). It writes the interest bill and
  its bill on the billing job.
- **`gc_record_acceptance(p_project_id, p_on, p_by_name, p_how, p_note)`** (O7). It refuses
  before every line is billed. The kernel's `ownerAllBilled` is checked in the client too.
- **Plain updates under RLS**: the retainage step, the interest rate, the late fee, the days to
  pay, a change order's percent. Payments and promises use the Pipeline's own RPCs
  (`mark_invoice_paid`, `add_job_payment_promise`) on the billing job.

## Edge functions

- **`gc-customer-email`** (O4b, then a kind per PR). The customer's and the architect's emails by
  kind:
  - `pay_app` (the customer: the 702, the 703 and our conditional waiver; the architect: *Please
    certify*);
  - `certified` (the customer: the amount, the due day, **Pay**);
  - `change_order` (to sign);
  - `reminder`, `interest_bill` and `accept_work`.

  The words live in `supabase/functions/_shared/gcCustomerEmails.ts` (built from
  `payReminderEmail` and the prototype's message builders). Each kind needs, or CI fails as it did
  on #4815 (HANDOFF):
  - `file:` on `sendEmailViaResend`;
  - a `CUSTOMER_SURFACES` entry;
  - a journey step with a sample email;
  - an answer in `personJourney.ts`.
- **`gc-money-monday-email`** (O7). Monday morning, to the owner and the controller: the lowest week
  in `cashAhead` with the late money not counted (*We go down to $39,272 carrying the week of
  Oct 12*). Cron. It needs a `[functions.gc-money-monday-email] verify_jwt = false` block in
  `config.toml`, or the gateway refuses the cron call (the outage fixed in v2.4817).

The lead deploys both. A helper never does.

## The PRs, in order

Each ships alone behind the dev door, cut from `origin/main`, with its release note, docs fragment,
and from the first screen on its help guide. The version and the stamp are claimed at the cut. One
migration a day on this lane. "Check" is how the reviewer sees it work.

1. **O1, the tables** (day 1, 10-08). The migration above: the columns on `gc_projects`, the
   seven tables, the foreign key on `gc_schedule_moves`, and `gc_sign_owner_contract`. No screen.
   *Check:* the migration doc's verify steps.
   - Each table is empty, with its one dev policy.
   - A training-mode user's insert is refused (a transaction that never commits).
   - `gc_sign_owner_contract` on the test project writes the lines and a null clears them, run as a
     dev and rolled back.
   - A sent pay application's `due` cannot be changed.
2. **O2a, the kernels that can move today** (day 2). The list above, with `proposalTotals` and
   `money`, the types, and the regenerated test state. *Check:* `npm test`; `lift-same.cjs` green on
   the O2a manifest; on the spike, after Helper 7's follow-up, the golden test passes without `-u`.
3. **O2b, the rest of the kernels** (day 3, after U2). *Check:* as O2a, plus the mapper's test.
   Helper 1 confirms PR 11 can import `billingForecast`.
4. **O3, change orders on real data** (day 4). The RPCs (one migration). A **Change orders**
   window from the project's row on `/gc` (the project's tab once the Board's B3 is in):
   - draft one by hand, from the set that started it, or from an RFI once U5 is in;
   - **Send for signature**: it marks the change order sent and downloads its PDF, until O4b's
     email;
   - **They signed** or **They declined**, with the day;
   - the percent done, and a time extension from the late days.

   Guide: `change-our-contract-with-the-customer.md`. *Check:* on the test project, a change order
   drafted, sent, signed and set to 40% reads back with its number, price and days. The contract's
   day moves by its days on the Schedule tab.
5. **O4a, our bill** (day 5). The filler's options (TO CUSTOMER, the property's owner, the
   architect's certificate, each row's retainage when the step applies, the notary block filled
   for a wet signature). `payAppWorkbook` and `payAppPdf` on main's filler; the second piece is a
   rewrite, since the spike's wrote the rows itself (an adapter from `PayAppRow` to
   `PayApplicationLine`). The migration: `gc_send_owner_pay_app` and `gc_record_certificate`, the
   service type (decision 10). **Bill the customer** window:
   - the draft with its lines, spread or as lines;
   - **Retainage**;
   - **See the form** (Excel and PDF);
   - **Send**;
   - **Record the certificate**;
   - **So far with** the customer;
   - our conditional waiver on progress payment, made with each send through `LienReleaseModal`
     on the billing job, prefilled with the amount asked and the bill day.

   Guide: `bill-the-customer-on-a-gc-job.md`. `BILLING_FLOWS.md` gains a GC billing job section.
   *Check:* the test project with its contract signed at test numbers and a signed change order at
   50% drafts a bill for half its price less 10%. Sent, it files the record and a sent copy. Its
   703 opens with every line and the property owner, and the Pipeline's own AIA window on any job
   prints as before. The certificate makes a bill on the billing job, and the test customer's portal
   statement shows it with **Pay**.
6. **O4b, the emails** (with or right after O4a). `gc-customer-email` with `pay_app`, `certified`
   and `change_order`. *Check:* the owner's yes to email one test address. One pay application,
   its certificate and a change order arrive, each with its sent copy filed.
7. **O5, money in** (day 6). The bill's payments read back from `jobs_ledger_payments` (part and
   whole). Promises on the billing job from Bill the customer (**They said when…**) and from the
   portal. **Remind them to pay** (the RPC and the `reminder` email). Our unconditional waiver for
   each payment, through `LienReleaseModal` on the billing job (the conditional one went with the
   bill in O4a). *Check:*
   - a part payment typed in the Pipeline's Billed modal on the test bill shows here as part paid;
   - a promise there moves the due day here;
   - a reminder writes its row and a chase touch;
   - the unconditional waiver shows in the test customer's portal.
8. **O6, interest, the late finish and Money** (day 7). The interest rate per job, built up per
   bill, **Bill the interest** (the RPC and the `interest_bill` email). `ownerInterestFrom` reads
   `owner_pay_days` (decision 7, the one kernel change, its test changed with it). **Finish date**
   with the late fee. The **Money** tab:
   - `allJobsMoney`, who owes us, `cashAhead` (owner side only until U6), `jobMargin`;
   - bill day across the jobs, the billing forecast.

   For the owner and the controller only, so dev-only here. Guide:
   `see-the-money-on-our-gc-jobs.md`. *Check:* on the test bill held late in a rolled-back
   transaction, the interest reads to the cent against `ownerInterestOnBill`'s own test.
9. **O7, closeout and the Monday email** (day 8). **Accept the work** recorded by the office. Our
   final pay application for what they hold, with our conditional waiver on final payment, and the
   unconditional one when it is paid. `gc-money-monday-email` and its cron. *Check:* the test
   project's final pay application asks for exactly what the last bill held. The Monday email
   reaches the lead's address once, on the owner's yes.
10. **O7b, the customer portal's own presses** (after O7). `customer-portal` shows the GC job's
    change orders to sign and **Accept the work**. `submit-portal-request` gains the kinds
    `gc_change_order_answer` and `gc_accept_work`, which call O3's and O7's RPCs as the service
    role, checked against the portal link's customer. The lead deploys both functions. *Check:* the
    test customer's portal link signs a test change order, and the office sees it signed.
11. **O8, the customer pays a certified bill by card** (after O7c; the owner's answer to the Stripe
    question, 2026-10-09). From their portal, the customer turns a certified bill into a card-only
    Stripe invoice with a "Credit card fee (3%)" line, and staff never convert one. Three PRs, O8a
    to O8c: `mockups/owner-billing-o8.md`. *Check:* there, on Grace's yes, in Stripe test mode.
12. **O9, the money team reads the trades' money** (after O8c; the lead's call (a), 2026-10-09). Money and Bill the
    customer are the money team's, but the trades' statements of work and draws were a dev's alone, so a leader's or
    the controller's bill drafted every trade at $0. One migration opens reading, never writing, on the seven tables
    to `gc_money_team()`. Co-signed by Building, the Board and the Portal: `mockups/owner-billing-o9.md`. *Check:* the
    bed's controller reads what a dev reads and writes none. Cut 2026-10-09: PR #5262, v2.5133, migration
    `20261010050000`.

**The door** (its own PR when the lead says the trade side is real): the policies swap
`is_dev()` for the owner and controller predicate, with `ACCESS_CONTROL.md` in the same PR, the
schedule's PR 10 the pattern.

13. **O10, the office's notices** (after O9; the lead's ask, 2026-10-09): bill day minus 2 days to the project
    manager, the architect reminded at 3 days and the project manager at 5, from `README.md` → *Workflow steps not
    built yet*. One record written before each send, so each goes once, behind a switch that starts off, with a
    preview. Two PRs, O10a (the record and what is due) and O10b (the sender): `mockups/owner-billing-o10.md`.
    *Check:* the bed's notices due on the right days to the right reader, each once; then Preview, on Grace's yes.

**Later, once the rest is in**: the customer's notice 3 days before a bill is due (O10's call 5); our own crew at its
Pipeline cost in `jobMargin` (U8); general conditions at actual cost.

## Docs each PR touches

- **Migration docs** (`docs/migrations/<stamp>_<slug>.md`): O1, O3, O4a, O5, O6, O7.
- **`docs/EDGE_FUNCTIONS.md`**, a section and a TOC line each: `gc-customer-email` (O4b, and each
  new kind after), `gc-money-monday-email` (O7), `customer-portal` and `submit-portal-request`
  (O7b).
- **`docs/BILLING_FLOWS.md`**: the GC billing job (O4a).
- **`docs/SENT_COPIES.md`**: the new kinds (O4a, O6).
- **`docs/ACCESS_CONTROL.md`**: the door.
- **`PROJECT_DOCUMENTATION.md`**: the windows (O3, O4a, O6).
- **`docs/GLOSSARY.md`**: our pay application, the architect's certificate, retainage step, change
  order (to the customer), billing job, interest bill, late finish, acceptance of the work (O3,
  O4a, O6, O7).

The help guides, each in plain words:
- `change-our-contract-with-the-customer` (O3);
- `bill-the-customer-on-a-gc-job` (O4a);
- `record-what-a-gc-customer-paid` (O5);
- `see-the-money-on-our-gc-jobs` (O6);
- `close-out-a-gc-job-with-the-customer` (O7).

## The other lanes (agreed 2026-10-07)

| With | Agreed |
|---|---|
| Building (Helper 4) | `gc_change_orders` is O1's; `gc_rfis.change_order_id` FK is Building's, after O1. The trade's side of a change is `gc_change_order_trade_sends` in U6. `payAppCells` and its kin are O2's, at `src/lib/gc/payAppFile.ts`; O4 adds the writers. `payApplication`, `payApplicationForDraw` and `changeOrderTradePct` are U2's, in `building.ts`. `PayAppLine` and `PayApplication` come from whichever lands first. |
| Portal (Helper 3) | `gc_trade_change_requests` (P4) with its FK to `gc_change_orders`. The office's answers are this plan's two RPCs, under office RLS on P4's table. `gc_trade_sign_change` writes Building's table. "Your part" is the change order's cost on the trade's package, never its price. The trades' emails go through P3. |
| Board (Helper 2) | O1 owns `owner_contract_signed_on`, `gc_owner_contract_lines` and `gc_sign_owner_contract`. B6 calls it, and the portal's Sign will. Sending the contract is B6's. `proposalTotals` moves to `bids.ts` with whichever is cut first. The company record is `gc_companies`, with `company_id`. |
| Schedule (Helper 1) | `timeExtension.ts` and `lateFinish.ts` go at `src/lib/gc/`, not `schedule/`. Nothing in `schedule/` imports billing. `whatIfDiff` is Helper 1's (PR 11), reading `billingForecast` from O2b, which aims for day 3. Changes in `schedule/` are messaged first, and so is O2a's regenerated test state. |

## The owner's calls this plan leans on

For the lead's one list. Decisions 1 to 10 above, then:

1. **Bill day the 25th** (HANDOFF call 6: monthly was confirmed, the day was not).
2. **Retainage 10%** per job, typed per job (decision 6). **The step, when chosen**, from half done
   to 5%, on the rest.
3. **Interest 1.5% a month**, off unless set on the job, from the day after the contract's days to
   pay (decision 7). To check against Texas's prompt pay law for private work (Property Code
   chapter 28): as read here it gives the owner 35 days from the request and sets 1.5% a month on
   what is late. The owner or his counsel should confirm it before the rate or the 35 is used as
   the default.
4. **A reminder's pay-by day 5 days out.**
5. **Stored materials** billed at the trade's cost, our costs and fee once in place.
6. **The notification timings**: bill day minus 2 days; the architect reminded at 3 days, the
   project manager at 5; the customer 3 days before a bill is due; the Monday email.
7. **The customer emails' words** (not read by him yet), in O4b's PR for him to read.
8. **Who signs our G702 for us, and the notary**: the app fills the block for a wet signature and
   a notary's stamp, with no e-notary. Who signs: the owner by default.
9. **The GC entity's name** on the G702's FROM block (call 12).
10. **The test rows on prod** (call 13). This plan adds a billing job, a test bill and its waivers
    on the test project, each named "… test …, delete me" in its PR's *Status*.

## Is this the best we can do?

It reuses every money path the app has, and it puts no new money on a screen anyone but the owner
and the controller sees. It could be better three ways:

1. **One AIA store for both modes.** Our pay applications could live in `job_pay_applications` on
   the billing job, with the certificate and a bill link added there, and the unspread lines in an
   owner-only side table. The Documents tab's AIA history would then list GC bills too. It would
   also answer the open item 2 of `to-dos/aia-pay-application-follow-ups.md` (an application tied
   to its bill) for both modes at once. Not taken now: it changes a live table the office uses
   daily, and its window would need to learn never to reprint a GC application. Worth a look once
   O4a has run a month.
2. **The architect certifies from a link.** The prototype's *See what the architect sees*, built on
   the Portal lane's one-link-per-company (the architect is a customer row): **Certify $X** or
   **Certify less** with why. It removes the office's typing and the wait for a scanned page. The
   architect's answers to plan questions could live there too. It waits for P1's pattern.
3. **Bills that chase themselves.** Nothing in the app emails a customer about late money today
   (the scout's finding: the chase list is a phone queue). The reminder here is one press. A
   scheduled pair (3 days before a bill is due, and the morning after it is late) would serve GC
   bills and, later, the Pipeline's own. The owner would set the words once, and the chase list
   would show each as a touch.

## Status

**2026-10-09, evening.** Every Owner Billing PR through O7c and O5e is merged, and gcIo's last untyped calls go typed in #5198 (v2.5096). O8, card payment from the customer's portal, is planned in `mockups/owner-billing-o8.md`. It waits on the owner's answer on card only or card or bank, and on the surcharge rules check.

**2026-10-08.**
- **O1 is live.** #4851 is applied and verified, Status in #4877.
- **O2a (#4858) is merged.** Its spike follow-up was written by Helper 7.
- **O3 (#4948, v2.4915, migration `20261008110000`) is live.** It is applied and verified (Status PR #4954), with types in #4953. It made no second mapper: the Board's `boardProjectFromView` is main's one, the lead's ruling.
- **O2b (#4956, v2.4922) is armed.** It brings the rest of the kernels; `timeExtension.ts` and `lateFinish.ts` live at `src/lib/gc/`.
- **O3-ui is built and walked on prod.** It is the Change orders window on `/gc` for a dev, cut once #4956 and #4953 merge.
- **O4a waits on the owner's billing-only answer** (`mockups/billing-only-job.md`). O5's plan is next (`mockups/owner-billing-o5.md`).

**Test rows on prod (call 13):**
- "GC test project, delete me" (`ef8905d1-…`) is at `building`, with `started_on` 2026-10-05. It was set for O3-ui's walk with the lead's OK, and left there for Building's U3 check.
- Its change order 1, "Test change, delete me: add a slab thickening at grid C, per S-102", is signed at 40%. The keep-what-went trigger refuses a plain delete; the project's own delete removes it by cascade.

**2026-10-07, evening.**
- **O1** is clickconstruction/pipetooling.github.io#4851 (v2.4831 after the queue's renumber;
  migration `20261008010000_gc_owner_billing_tables`), reviewed by the lead and armed. Its push
  goes in the 10-08 evening batch.
- **O2a** is #4858 (v2.4842), armed. It lifts everything whose inputs are on main, with the
  manifest `scripts/owner-billing-o2a.lift.json`. `lift-same` reports all of it word for word.
- **Decision 10's check came back "it would show on crew screens".** O4a waits for the owner's
  word on the fix above.

Planned 2026-10-07 by Helper 5 on `spike/owner-billing-plan`, cut from `spike/gc-mode` at
e8f61a36f. Two read-only scouts mapped main's AIA filler, the waiver train, the bill, the payment
recording, the promises and the chase list; their findings are folded in above (the filler's every
703 line; everything in billing keyed to `jobs_ledger`). Seams agreed with Helpers 1 to 4 the same
evening. Nothing built. O1 is cut on day 1 once the lead approves and the owner says yes to
decisions 1 to 4.
