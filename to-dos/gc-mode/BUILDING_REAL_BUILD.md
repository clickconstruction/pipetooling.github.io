---
name: "GC mode, Building: the real build plan"
parent: to-dos/gc-mode/README.md (punch list #81) · HANDOFF.md (The real build, in order, step 9) · PLAN_2026-10-07.md (Helper 4's row)
status: first draft 2026-10-07 by Helper 4 at the lead's ask, for the lead's review and then the owner's · the seams with the Board (Helper 2), the Portal (Helper 3) and Owner Billing (Helper 5) agreed with each the same evening · the lane is Helper 14's since 2026-10-08 (U4 is Helper 18's) · U1, U2 and U3a are on main, Status below
summary: >
  How Building moves from the prototype (made-up data on branch spike/gc-mode) into the real app: the
  daily log, the punch list, submittals, questions during construction (RFIs), the trades' draws and
  pay applications, the Friday report to the customer, and our own crew read from its Pipeline job.
  What moves and what stays, the decisions with a default each, the tables, what the app already has,
  the kernels that move with their tests, the writes, and the PRs in order with a Check each.
size: L (15 tables in two migrations, 1 column, about 20 database functions, 2 new edge functions, 8 PRs and a door)
blocker: U3b and U4 need the Board's B6 (signed statements of work and the award). U6 needs B6, P5 (the trade's pay application) and O1. O1 and O2's late finish are on main.
---

# GC mode, Building: the real build plan

## What moves, and what stays

The prototype proved these, and they move:

- **The daily log.** Our superintendent's log for each working day on a job being built: the
  weather and whether work stopped for it, each trade on site and how many, what got done, what held
  work up (the look-ahead's five reasons), inspections and visitors. Today's log starts from the day
  before. A working day in the last week with no log is flagged with **Write**.
- **The punch list.** What is left to fix on each trade we hire. The trade marks an item fixed in its
  portal, and our superintendent checks it or sends it back with a note. We accept a trade's work
  once every item is checked fixed.
- **Submittals.** The register by trade, numbered by spec section, with the work each holds and its
  lead days. Whose move it is, when it is needed, how late. The trade sends it from its portal, we
  send it to the architect, we record the architect's answer, and *Revise and resubmit* sends it back.
- **RFIs** (the owner, 2026-10-05: yes to all four). Their own tab, numbered RFI-001. A trade asks
  from its portal, the answer is needed 3 days before the work it holds, and an answer with a cost
  starts a change order in one press.
- **The trades' draws and pay applications.** Percent reported per line, a draw asked from the portal
  with its G702 and G703, stored materials per line, approve, approve for less, send back, pay, the
  waivers, and the trade's side of a signed change order. Then closeout: accept the work, the final
  pay application for the retainage, its release 10 days after the customer pays ours, and **Close
  the job**.
- **The Friday report.** The weekly report to the customer, drafted from the week's records, sent
  from me or from the company, and kept as sent for their portal.
- **Our own crew.** Its percent per stage from its Pipeline job, and its head count on the daily log
  from its clock-ins (G-51), in place of the prototype's typed numbers.

These stay with the lanes that own them, and this plan only points at them:

- **Inspections and their failures are the schedule's** (decision 1). Their tables are on main.
- **The statement of work and its lines** are the Board's (B6: `gc_sows` on `step_commitments`,
  `gc_sow_lines`). Building keys its reports and draws to them.
- **The company record and its people** are the Board's (B1: `gc_companies`, `gc_company_people`).
- **Back-charges and change requests** are the Portal's (P4: `gc_back_charges`). Building owns the
  office screen that keeps, drops and takes a charge, and U6 adds the charge's link to a draw.
- **Change orders to the customer** are Owner Billing's (O1: `gc_change_orders`). Building owns the
  trade's side of a signed one.
- **The trade's portal and its writes' door** are the Portal's (P1 to P5). Building owns each write's
  table and rule (decision 5).
- **The AIA file**: Owner Billing's O2 lifts `payAppCells` and its constants to
  `src/lib/gc/payAppFile.ts`, and O4 teaches `fillAiaG702G703Workbook` every 703 line, the notary
  block and *TO CUSTOMER*. U6 reads it for the trades' pay applications.
- **The price card** was built by Building on the Board's row, but its kernel reads only the
  Board's, so the Board's B2 lifts `gcPriceStanding` (Helper 2, 2026-10-07).
- **The Follow up sheet** was built by Building on the Board's tab. Its last four kernels lift once
  the Board's and the Portal's kernels they read are on main (U2b).

A step below that needs one of them says so.

## Decisions before the first migration

Each has a default the plan is written to. The owner changes any of them by saying so.

1. **Inspections stay the schedule's.** An inspection is a bar on the schedule
   (`gc_schedule_activities` kind `inspection`, `passed_on`), and its failures are
   `gc_schedule_inspection_failures`. Both are on main and applied since v2.4798 (#4814). Passing and
   failing are the schedule's RPCs (`gc_schedule_pass_inspection`, `gc_schedule_fail_inspection`,
   its PR 5), and their screens are its PR 9. *Default:* Building makes no inspection table and no
   inspection write. It reads them: the daily log's inspections line, a company's Activity
   (`buildingActivity`), the Friday report's *Inspections*, and the portal's `inspectionItems`
   (already on main). U4 is submittals only.
2. **What a hold is keyed to.** A submittal's `lineIds` and an RFI's `holds` are schedule lines. In
   the prototype a line's id is its scope line's (`sowFromBid` keeps `item.id`), and a submittal may
   hold a line before the schedule is drawn. *Default:* a hold is a row keyed to the scope line
   (`gc_scope_items.id`), in a join table per record, and the mapper hands the kernels those ids as
   `lineIds`. An inspection or an added bar is never held: the prototype never offers one.
3. **Who owns what on the trade's money.** Agreed with the Board (Helper 2) and Owner Billing
   (Helper 5) on 2026-10-07:
   - The statement of work is the Board's `gc_sows` (one per awarded package, on
     `step_commitments`) and `gc_sow_lines` (`id`, `sow_id`, `position`, `label`, `amount`,
     `scope_item_id`, `change_order_id`, exactly one of the last two). The mapper hands the kernels
     `SovLine.id = scope_item_id`, so no kernel changes. A change order's line keeps its own id.
   - Building owns the trade's report on each line (`gc_sow_line_reports`), the draws, their lines,
     the pay applications, the pay applications sent back, and the trade's side of a signed change
     order (`gc_change_order_trade_sends`). `pctReported` is the newest report and `pctBilled`
     follows from approved draws. Neither is stored on the line.
   - The RFI keeps the link to the change order it starts (`gc_rfis.change_order_id`), as the
     prototype's `Rfi.changeOrderId`, and Owner Billing's table carries no Building column.
4. **Who may read and write.** *Default:*
   - **While it is built**: dev only, every table, one policy each, as New project's and the
     schedule's are.
   - **Then, in Building's door PR**: the daily log, the punch list, submittals, RFIs and the Friday
     report take the schedule's team, `gc_on_schedule_team(project_id)` (its PR 10: the office and
     estimators, the job's superintendents, its project manager). They carry no money but an RFI
     answer's cost (call 1 below).
   - The draws, their lines, the pay applications and the reports on lines take the money roles,
     dev, master and controller, as New project's tables do (its decision 2). The project manager
     approving a draw is call 5 below.
   - **The trades and the customer** have no policy. They reach their slice only through their
     portals' functions.
5. **The trades' writes are Building's SQL functions** (agreed with the Portal, Helper 3). Each is
   `gc_trade_<verb>(p_company_id uuid, …)`, `SECURITY INVOKER` with a pinned `search_path`, as the
   Portal's P2a verbs settled, revoked from `PUBLIC`, `anon` and `authenticated` and granted to
   `service_role` only. A refusal raises a key the portal says in the company's language, with its
   reason as the DETAIL. It checks the row is
   on a package that company was awarded, checks what the reducer checks, and writes. The Portal's
   submit function resolves the link to its company, rate-limits, and calls it. It never takes a
   company from the body. Building's migration ships the function. The Portal's next PR adds the
   kind to its switch.
6. **Files live in Google Drive** (the owner's call). The app keeps a link, never a copy.
   *Default:*
   - A submittal round keeps `file_name` and `drive_url`. The office pastes a link for one that came
     by email, checked by `gc-drive-access` `check` as a plan set's is: "please correct" is a
     warning, never a stop. The trade's upload from its portal (P5) lands in the job folder's
     **Submittals** folder through `_shared/driveUpload.ts`.
   - A daily log may carry a link to that day's photos (`photos_url`). The job folder gets a
     **Daily log** folder beside **Plans** and **Team only**, made by `gc-drive-access`
     `make_folders`. A punch item may carry a photo link too.
   - The Quo file agent (`HANDOFF.md` section 5) files photos into those folders later. Nothing here
     waits for it.
7. **Which writes are RPCs.** *Default:*
   - **An office write with a rule across rows, or a number to hand out, is an RPC**,
     `SECURITY INVOKER` so RLS decides who may, as `gc_record_question` is: the log with its crews
     and delays, a punch item added or checked, a submittal added with its number, a round recorded,
     sent or answered, an RFI added with its number, sent or answered, and an RFI's change order.
   - **The Friday report as sent is a plain insert** under RLS, append only.
   - **A trade's write is decision 5's function.**
   - None of Building's writes touches the schedule's plan, so none carries the schedule's version.
     A report that sets a bar's real days (`withReportedActuals`) is the schedule's PR 16 reader
     (U6, below).
8. **The daily log's crews and delays are rows, not jsonb.** The schedule's readers (the log
   against the chart G-60, days lost G-58, the crew projection G-57, people on site G-84) and our
   crew's clock-ins (U8) read them by trade. *Default:* one log per project and day. Saving again
   replaces that day's crews and delays in one transaction (the prototype's rule) and keeps who wrote
   it and when.
9. **The promises Building's moves keep.** The prototype's `buildingPromisesKeptBy` reads the
   reducer's actions, so it cannot move to main. *Default:* its five rules become SQL. Each Building
   write that keeps a promise (a log with the trade on site, the last submittal the trade owed, a
   pay application sent again, the last punch item fixed, the closeout papers in) marks it kept in
   the same transaction, through the Board's helper in B1 (Helper 2, 2026-10-07):
   `gc_keep_promises(p_company_id, p_kind, p_project_id, p_package_id, p_on)` marks kept the open
   promise of that kind, company, job and trade, and does nothing when none is open. The Board's own
   `promisesKeptBy` and `keepPromisesOn` stay on the spike for the same reason.
   The rest of `gcBuildingPromises` (the starts to ask about, the papers owed) moves in U2.
10. **Who hears what, by email only, through Resend** (question 29). *Default:*
    - **The architect** gets a submittal and an RFI by email from one new function,
      `gc-architect-email` (kinds `submittal` and `rfi`). It sends from `COMPANY_EMAIL_FROM` with the
      project manager as Reply-To, as `gc-plan-question-email` does. It files its sent copy, has its
      row in `CUSTOMER_SURFACES`, a journey step with a sample email, and its answer in
      `personJourney.ts`, or CI fails as it did on #4815. The prototype only logged it.
    - **The trade** hears of a punch item added or sent back, a submittal sent back and an RFI
      answered through the Portal's messages (P3), not a Building function.
    - **The customer's Friday report**: *From me* opens the user's own mail with the draft filled in
      (`mailto:`, as the prototype does) and records it as sent. *From Click* goes through a new
      function, `gc-weekly-report-email`, with the same four pieces as the architect's.
    - The office's own reminders (`README.md` → *Building's events*) wait until the app's morning
      email learns GC mode.
11. **Our own crew** (G-51, the schedule's PR 16). *Default:* `gc_trade_packages.job_ledger_id`
    names our trade's Pipeline job (`selfPerform.ref` in the prototype). Each stage reads that job's
    newest percent report by stage name (`currentReportPctByJobId`, `newestPercentEvent`), and its
    head count a day is the people clocked in on that job (`clock_sessions.job_ledger_id`), read and
    never stored. The daily log shows our crew's row read only, beside the trades' typed ones.
12. **The project's days.** B1 adds `gc_projects.started_on` and Start's other columns (Helper 2,
    2026-10-07), and B6's Start sets them, so the daily log has its first day. *Default:* U6 adds
    `closed_on`, set by **Close the job**.

## The tables

Every migration follows `CLAUDE.md`:

- It starts with `SET lock_timeout = '3s';`.
- It is numbered after `origin/main`'s newest when its PR is cut, and claimed then with
  `npm run claim -- --migration <file>`.
- It is written idempotent, and pushed by the lead with `supabase db push` only after it is on main.
- Every table has RLS, dev only while it is built: one policy a table, `FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()))`, with `anon` revoked, as the
  schedule's tables do.
- Every migration that creates a table ends with `SELECT public.apply_read_only_write_blocks();`,
  `SELECT public.apply_read_only_stmt_blocks();` and `SELECT public.apply_digital_twin_write_blocks();`.

Each column names the prototype field it carries (`src/lib/gcMode/gcTypes.ts`).

### U1: the records (ten tables)

**`gc_daily_logs`**, one per project and day (`DailyLog`):

- `id`, `project_id` (FK `gc_projects.project_id`, cascade), `log_date` (`date`).
- `sky` (`clear`, `cloudy`, `rain`, `storm`, `wind`; `WeatherSky`), `high` and `low` (integers,
  degrees Fahrenheit), `weather_stop` (boolean).
- `done` and `visitors` (text, the superintendent's words), `photos_url` (text, a Drive link; decision 6).
- `written_on` (date, the company day the writer gives: later than `log_date` means caught up),
  `written_by` (FK `users.id`), `updated_at`.
- Unique (`project_id`, `log_date`). Checks: `written_on` on or after `log_date`.

**`gc_daily_log_crews`**, each trade on site that day (`DailyLog.crews`): `log_id` (cascade),
`package_id` (FK `gc_trade_packages.id`, cascade), `workers` (integer, from 1). Primary key
(`log_id`, `package_id`). A trade not listed was not there.

**`gc_daily_log_delays`**, what held work up (`DailyLog.delays`): `id`, `log_id` (cascade),
`position`, `package_id` (null: the job's own; FK, cascade), `reason` (`weather`, `trade before`,
`materials`, `crew`, `other`: `LookAheadReason`, the same check as the schedule's late notices),
`note` (text).

**`gc_punch_items`** (`PunchItem`):

- `id`, `project_id`, `package_id` (FK, cascade), `position`.
- `text` (never blank), `where_on` (text: a room, a grid line; `where` is a reserved word),
  `photo_url` (text, a Drive link).
- `added_on`, `added_by` (FK `users.id`).
- `fixed_on` (the trade's word; its portal sets it through `gc_trade_punch_fixed`).
- `checked_on`, `checked_by` (FK `users.id`).
- `sent_back_times` (integer, from 0), `sent_back_note`, `sent_back_on` (`PunchItem.sentBack`).
- Checks: checked only once fixed, the days in order, and the send-back's three columns together.

**`gc_submittals`** (`Submittal`):

- `id`, `project_id`, `package_id` (FK, cascade).
- `number` (text, "26 24 16-01", `nextSubmittalNumber`), unique per project.
- `title` (never blank), `kind` (`product data`, `shop drawings`, `samples`), `spec_section`.
- `lead_days` (integer, from 0), `needed_by` (date: used only when no line it holds is on the
  schedule), `asked_on`, `created_by`.

**`gc_submittal_holds`** (`Submittal.lineIds`): `submittal_id` (cascade), `scope_item_id` (FK
`gc_scope_items.id`, cascade). Primary key both. The RPC holds it to a line of the same trade's job.

**`gc_submittal_rounds`** (`SubmittalRound`), one per time it was sent:

- `id`, `submittal_id` (cascade), `round` (integer, from 1), unique (`submittal_id`, `round`).
- `sent_on`, `sent_by` (`trade`: from its portal; `office`: it came by email and we recorded it;
  decision 6), `file_name` (never blank), `drive_url`, `note`.
- `to_architect_on`, `email_send_log_id` (the email that took it there).
- `answered_on`, `answer` (`approved`, `approved as noted`, `revise`), `answer_note`.
- Checks: an answer and its day together, only after it went to the architect; *revise* has a
  note; the days in order.

**`gc_rfis`** (`Rfi`):

- `id`, `project_id`, `number` (integer, from 1, unique per project; RFI-001).
- `question` (never blank), `sheets` (text[]).
- `package_id` (null: our own work; FK, set null).
- Who asked: `asked_by_company_id` (`gc_companies.id`, a trade from its portal or by phone) or
  `asked_by_user_id` (our superintendent), not both. `asked_on`.
- `needed_days` (integer, from 0, default 3: `RFI_NEEDED_DAYS`).
- `sent_to_architect_on`, `email_send_log_id`.
- The answer (`Rfi.answer`): `answered_on`, `answer_text`, `answered_by` (`architect` or `us`),
  `impact` (`none`, `plans`, `cost`), `cost` (from 0), `days` (from 0).
- `change_order_id` (`gc_change_orders.id`, set null).
- Checks: the answer's columns together; the architect answers only what was sent to them; a cost
  answer has a cost or days.
- The two foreign keys to other lanes' tables go in a `DO` block that adds each when its table is
  on main (the schedule's PR 4 did this for its template key). Otherwise the next Building
  migration adds it: U3's for the company, U5's for the change order.

**`gc_rfi_holds`** (`Rfi.holds`): `rfi_id` (cascade), `scope_item_id` (FK, cascade). Primary key both.

**`gc_weekly_reports`** (`WeeklyReportSent`), every send kept as it went:

- `id`, `project_id`, `week_of` (a Monday, checked), `sent_on`.
- `sent_from` (`me` or `company`), `sent_by` (FK `users.id`), `by_name` (as it read that day),
  `to_words` (the customer's contact and company), `copied_architect` (boolean).
- `subject` and `body` (never blank), `email_send_log_id` (a send from the company).
- Append only: `authenticated` has no UPDATE, DELETE or TRUNCATE on it. The newest for a week is the
  one the customer's portal shows (`latestWeeklyReports`).

### U6: the trades' money (five tables and two columns, its own migration)

Written against B6's `gc_sows` and `gc_sow_lines`, P4's `gc_back_charges` and O1's
`gc_change_orders`. Its SQL is planned in full in `mockups/building-u6.md` once those three are on
main, so the keys are the merged ones. The shape:

- **`gc_sow_line_reports`**: `id`, `sow_line_id` (cascade), `pct` (0 to 100), `reported_on`, by the
  company (`reported_by_company_id`) or our user (`reported_by`), `part_id` (a part of a split line,
  G-39, `tradeReportPart`). Append only; the newest is `pctReported`.
- **`gc_draws`** (`Draw`): `id`, `sow_id`, `number` (unique per statement of work), `requested_on`,
  `gross`, `retainage`, `net`, `status` (`requested`, `approved`, `paid`), `waiver` (`conditional`,
  `unconditional`), `final` (the retainage release), `approved_on`, `paid_on`, the approved-for-less
  note and what was asked (`Draw.asked`), and the pay application's own words (`DrawPayApp`:
  `period_to`, `address`, `license`, `signed_by`, `signed_title`, `signed_on`).
- **`gc_draw_lines`**: `draw_id`, `sow_line_id`, `to_pct`, `stored` (dollars of materials on site,
  question 12). Primary key both.
- **`gc_draw_sent_backs`** (`DrawSentBack`): the draw as the trade sent it (jsonb, read whole), `on`,
  `note`, and what we see on each line we doubt.
- **`gc_change_order_trade_sends`** (`ChangeOrder.tradeChange`): `change_order_id`, `sent_on`,
  `signed_on`, `sow_line_id` (the line it became).
- **Columns**: `gc_back_charges.taken_draw_id` (P4's table, the draw a charge came off) and
  `gc_projects.closed_on`.
- The trades' waivers are the lien waiver train's four forms pointed the other way
  (`LienWaiverFormType`), with the trade as the one who signs.

### U8: one column

`gc_trade_packages.job_ledger_id` (FK `jobs_ledger.id`, set null), our trade's Pipeline job
(decision 11).

## What the app already has, reused

- **The project, its trades and scope lines**: `gc_projects`, `gc_trade_packages`, `gc_scope_items`.
- **The schedule** (on main): the bars a hold's day reads, the inspections and their failures, and
  `gc_on_schedule_team` for the door, once its PR 10 lands.
- **The company record** (B1), **the statement of work** (B6), **change orders** (O1) and
  **back-charges** (P4): decision 3.
- **The page**: New project's dev-only page at `/gc` (`src/pages/GcProjects.tsx`) and its io,
  `src/lib/gc/gcIo.ts`. Building's io is a rows file and an io file per record beside it
  (`dailyLogRows.ts` and `dailyLogIo.ts` first, U3a-ii; then `submittalRows.ts` and `submittalsIo.ts`,
  U4), each laid over the Board's `boardProjectFromView` on the page, as `withChangeOrders` is.
- **The team**: `users` and their roles, `project_superintendents`,
  `gc_projects.project_manager_user_id`.
- **Drive**: `gc-drive-access` (`make_folders`, `check`), `_shared/driveUpload.ts`, the "PipeTooling
  Jobs" Shared Drive (`docs/DRIVE_INTAKE_SETUP.md`).
- **Email**: `_shared/resendSendEmail.ts` with the sent copy (`file:`), `CUSTOMER_SURFACES`,
  `customerJourneys.ts`, `customerSampleEmails.ts`, `personJourney.ts`; `gc-plan-question-email` is
  the pattern.
- **The pay application file**: `aiaG702G703Template.ts` and `fillAiaG702G703Workbook.ts`, taught
  every 703 line by O4.
- **Waivers**: the lien waiver train's forms (v2.4274 to v2.4335).
- **Our crew**: `jobs_ledger`, its percent reports (`currentReportPctByJobId` in
  `jobSummaryPercentComplete.ts`, `newestPercentEvent` in `jobChargesTimeline.ts`) and
  `clock_sessions.job_ledger_id`.
- **The read-only blocks, the twin fence, release notes, docs fragments, help guides and the
  plain-words test**: as for every feature.

## Kernels that move over with their tests (U2)

They are pure functions in `src/lib/gcMode/`. They move to `src/lib/gc/` word for word, each to the
Building file on main that the schedule's lift started (`building.ts`, `buildingLog.ts`,
`followUpSheet.ts`) or a new `building*.ts` beside them. The prototype deletes what moved and
re-exports it from main (PR 1's pattern). A dry run of `lift-extract.cjs` on the spike at e8f61a36f
(2026-10-07) placed every name: **125 of Building's 133 exports move, about 1,660 lines; 8 wait.**
The price card's 7 are the Board's lift.

| Spike file | To on main | Moves in U2 | Waits, and for what |
|---|---|---|---|
| `gcBuildingLog` | `buildingLog.ts` (adds to it) | all 10 | |
| `gcBuildingPunch` | `buildingPunch.ts` | all 8 | |
| `gcBuildingSubmittals` | `buildingSubmittals.ts` | all 11 | |
| `gcBuildingRfis` | `buildingRfis.ts` | all 15 | |
| `gcBuildingWords` | `buildingWords.ts` | all 4 (`bw` on `portalI18n.ts`'s `PortalLang`) | |
| `gcBuildingActivity` | `buildingActivity.ts` | both | |
| `gcBuildingPay` | `buildingPay.ts` | all 4 | |
| `gcBuilding` | `building.ts` (adds to it) | 43 of 45: the pay application's math, sent back, our crew's work, closeout, the trade's side of change orders (`changeOrderTradePct`, which O2 reads) | `tradePayAppParties` (O2's `PayAppParties`, and our company's address, call 12) and `drawOnTheirSov` (`stageReached`, with B6's statement of work): U6 |
| `gcBuildingPromises` | `buildingPromises.ts` | 9 of 10 (`START_ASK_DAYS`, `firstOnSite`, `startsToPromise`, `papersOwed`, `papersOwedWords`) | `buildingPromisesKeptBy` reads the reducer's actions: it stays, and its rules become SQL (decision 9) |
| `gcBuildingWeekly` | `buildingWeekly.ts` | 10 of 11 | `weeklyReport` reads O2's `lateFinish`: U7 |
| `gcFollowUpSheet` | `followUpSheet.ts` (adds to it) | 9 of 13 (`smsHref`, `mailHref`, `telHref`, `followUpCount`, the types) | `followUpDraft` (P1's `portalLink`) and the two that build the reducer's actions: U2b. `followUpPeople`, with its private `lastAsk` and `cap`, goes with the schedule's 7c-i |
| `gcPriceStanding` | `priceStanding.ts` | | the Board's B2 lifts all 7: they read only `gcBids` |

Small helpers go under their lanes' files, as the schedule's 1b did: `money` joins `words.ts`, and
`PAY_WITHIN_DAYS` starts `src/lib/gc/portal.ts`, the Portal lane's file, which P1 extends. Our
company's name is `company.ts`'s.

**The types.** `types.ts` gains, word for word, the fields these read: on `GcProject` the
`punch`, `submittals`, `rfis`, `weeklyReports`, `architect`, `ownerBilling` (the final pay
application's paid day only, which closeout reads) and the rest of `DailyLog`; on `Sow`, `SovLine`
and `Draw` their whole shapes; new `PunchItem`, `Submittal`, `SubmittalRound`, `Rfi`, `RfiImpact`,
`WeeklyReportSent`, `DrawPayApp`, `TradePromise`. `PayAppLine` and `PayApplication` go in from
whichever of O2 and U2 lands first, and the other imports them (Helper 5). The config is
`scripts/building-u2.lift.json`, with each shape's `fields` listed as the schedule's 1b did, and
`lift-same.cjs` shows each moved declaration equals the spike's.

**The tests.** Most Building tests on the spike play the reducer, so they stay. *Amended at the
cut (2026-10-07):* the 19 that read only the kernels and the made-up data move as they are. Main gets
a direct test for each other moved function over three lines (38). The test data is the schedule's
`schedule/testState.ts`, written again by `schedule-test-state.ts` with this lift's fields (one file,
never by hand), not a Building file of its own. It carries Fair Oaks D's logs from Sep 21 with Sep 30
missed, its six submittals, its four RFIs, its punch list and the trades' statements of work with
their draws. The spike's tests keep passing against main's copy after the follow-up, and the golden
test keeps passing without `-u`.

**U2b** lifts the last three from `gcFollowUpSheet`, `followUpDraft` and the two that build the
reducer's actions, the day P1's kernels are on main, in the same way. The schedule's 7c-i lifts
`followUpPeople` with its private `lastAsk` and `cap` (Helper 11, 2026-10-08). If `followUpDraft`
needs them, U2b exports them from `followUpSheet.ts` and never copies them. The Board's B2b waits on U2 the other way: its `partnerWork` reads `retainageHeldNow`, its
`partnerActivity` reads `buildingActivity`, and its own promise rules read closeout and the punch
list.

**The mapper.** There is one project mapper, the Board's `boardProjectFromView` (`PLAN_2026-10-07.md`).
Each Building record lays its rows over the job it builds: `withDailyLogs` lays `dailyLogs` (U3a-ii,
`dailyLogRows.ts`), and `punch`, `submittals`, `rfis` and `weeklyReports` follow the same way, then from
U6 each package's `sow` with its lines, reports and draws. Each overlay gets its own test, so no kernel
changes when the data becomes real.

## Writing it

Each office write is `SECURITY INVOKER`, so RLS decides who may. The screen works the answer out
with the kernel, as the prototype does, and the RPC checks what the reducer refuses.

| RPC | The prototype's action | What it writes, and what it refuses |
|---|---|---|
| `gc_save_daily_log` | `saveDailyLog` | The day's log, its crews and its delays, replacing that day's. Refuses a job not being built, a day before `started_on` or after the writer's day, and a trade without a signed statement of work or ours (`logTrades`). Keeps the trades' start promises (decision 9) |
| `gc_add_punch_item` | `addPunchItem` | The item. Refuses a job not being built, our own crew's trade, a trade not signed, work already accepted, and blank words |
| `gc_check_punch_item` | `checkPunchItem` | Checked fixed, or back to the trade with a note, counting the times. Only an item the trade marked fixed and not checked |
| `gc_add_submittal` | `addSubmittal` | The submittal, its number and its holds. Refuses our own crew's trade, a trade not awarded, a blank title, and a hold on another trade's line |
| `gc_submittal_came_in` | new (decision 6) | A round the trade sent by email, recorded by the office, with its file name and Drive link. Only while it is the trade's move |
| `gc_send_submittal_to_architect` | `sendSubmittalToArchitect` | The round's day it went, and the email's log id. Only while it is ours |
| `gc_answer_submittal` | `answerSubmittal` | The architect's answer on the newest round. *Revise* needs a note and makes it the trade's move again |
| `gc_add_rfi` | `addRfi` | The RFI, its number and its holds. Refuses a job still bidding or closed, and blank words |
| `gc_send_rfi_to_architect` | `sendRfiToArchitect` | The day it went, and the email's log id. Not once answered or sent |
| `gc_answer_rfi` | `answerRfi` | The answer. The architect answers only what was sent; a cost answer has a cost or days |
| `gc_rfi_change_order` | `draftChangeOrderFromRfi` | A draft change order on O1's table (`rfiChangeOrderDescription`, the reason `plans`, our cost, the days, the trade) and the RFI's link to it, in one transaction. Only a cost answer with no change order yet |

**The trades' writes** (decision 5), one function each, called by the Portal's submit function:

| Function | The prototype's action | PR |
|---|---|---|
| `gc_trade_punch_fixed` | `tradeFixPunchItem` | U3 |
| `gc_trade_submittal_send` | `tradeSendSubmittal` | U4 |
| `gc_trade_rfi_ask` | `tradeAskRfi` (it holds the trade's next work not started, `rfiDefaultHolds`) | U5 |
| `gc_trade_sow_report`, `gc_trade_sow_report_part` | `tradeReport`, `tradeReportPart` | U6 |
| `gc_trade_pay_app`, `gc_trade_final_pay_app`, `gc_trade_unconditional_waiver` | `tradeSendPayApp`, `tradeSendFinalPayApp`, `tradeSignUnconditional` | U6 |

**U6's office writes** (planned in full in `mockups/building-u6.md`): approve, approve for less, send
back, pay, approve the retainage, accept the work, send a signed change to the trade, and close the
job. Each pays or holds money, so each is an RPC under the money roles' policy.

**The reads.** Each record's io file (`dailyLogIo.ts`, then `submittalsIo.ts` and the rest) reads its
rows in one select and hands them to its overlay; the screens call the kernels. The portal's read function returns one
company's slice of the same rows, built in `supabase/functions/_shared/`, with a test that the slice
never carries our price to the customer, our budget or another company's name (the Portal's rule).

## Who reads whose code

Building's kernels other lanes read, once they are on main (U2):

| Kernel | Read by |
|---|---|
| `submittalHolding`, `rfiHolds` | The schedule's PR 9: its holds join RFIs and submittals (`chartHolds`, `pullHolds` by way 3) |
| `submittalRowsOn`, `portalRfis`, `portalCanAskRfi`, `punchItems`, `punchState`, `bw` | The Portal (`portalWeeks`, `portalHome`); its blocks stay hidden on main until U2 |
| `changeOrderTradePct` | Owner Billing's O2 (`changeOrderPct`), by way 3 until U2 lands |
| `drawPayDays`, `drawsToPay` | Owner Billing (the forecast), from U6 |
| `buildingActivity` | The Board (a company's Activity) |
| `partnerReach`, `telHref`, `followUpPeople`, `followUpDraft` | The Board (U2b; `followUpPeople` with the schedule's 7c-i) |
| `retainageHeldNow`, `tradeCloseout`, `punchItems`, `buildingActivity` | The Board's B2b (`partnerWork`, `partnerActivity`, its promise rules) |
| The Friday report's subject and body | Owner Billing (Their messages), from U7 |
| `onSite`, `onSiteWords`, `isWorkday` | The schedule (on main since its 1b) |

## The PRs, in order

Each ships alone behind the dev door, cut from `origin/main` with its version and stamp claimed at
the cut, with its release note, docs fragment and, from the first screen on, its help guide. Auto
merge is armed with `gh pr merge <n> --auto`, and the lead pushes each migration and deploys each
function. One Building migration a day. *Check* is how the reviewer sees it work.

1. **U1, the records' tables** (day 1, 10-08): the ten tables above, dev-only RLS, the three block
   calls, the doc. *Check:* the migration doc's SQL shows each table empty with its policy; a dev's
   insert of a log dated after its written day is refused; a read-only user's insert is refused; a
   delete from `gc_weekly_reports` is refused.
2. **U2, the kernels lifted** (day 2, 10-09), no database, no screen: the 125 above with
   the 19 moved tests, 38 direct ones and `testState.ts` written again; then the spike's follow-up deletes what moved and
   re-exports it from main. *Check:* `npm test` passes on main; on the spike the golden test passes
   without `-u` and `lift-same.cjs` is green.
3. **U3, the daily log and the punch list on real data** (day 3, 10-10, if a job is being built):
   the migration with `gc_save_daily_log`, `gc_add_punch_item`, `gc_check_punch_item` and
   `gc_trade_punch_fixed`; `buildingIo.ts` and the mapper with its test; the Daily log window (the
   week at a glance, **Write** for a missed day, today's log started from yesterday's) and the
   punch list per trade, opened from the project's row on `/gc` as the questions window is, and
   becoming tabs once the Board's project page (B3) has its tab row. *As cut (2026-10-08):* U3a-i the
   press (#5003, v2.4957, migration `20261009120000`), U3a-ii the Daily log window (#5051, v2.4988),
   and U3b after the Board's B6: the press's `logTrades` rule, the start promises a crew on site keeps
   (`gc_keep_promises`, which needs the award's company), a missing temperature refused instead of
   saved as 0, the date words "Oct 5", and the punch list's presses and window. *Check:* on the test project,
   started, write today's log with two trades and a delay, catch up a missed day, and see it read
   back. Add a punch item, mark it fixed through the trade's function as the service role, send it
   back, and see it counted.
4. **U4, submittals on real data**: its four RPCs and `gc_trade_submittal_send`; the Submittals
   window; `gc-architect-email` with the `submittal` kind and its four email pieces. *Check:* add
   a submittal holding a line on the drawn schedule, record a round that came by email with a Drive
   link, send it to a test architect's inbox (the owner's yes, as step 8b), record *Revise and
   resubmit*, and see it the trade's move again.
5. **U5, RFIs and the change order they start**: its four RPCs and `gc_trade_rfi_ask`; the
   RFIs window; the `rfi` kind on `gc-architect-email`. *Start a change order* needs O1 on main
   and opens Owner Billing's change order to price and send (O3); until then the answer records its
   cost and the button waits. *Check:* the prototype's four, one in each state, on the test project,
   and a cost answer drafting a change order that carries the RFI's number.
6. **U6, the trades' draws and pay applications** (needs B6, P5 and O1; stays dev-only until the
   trade side is real): the money tables, their RPCs and the trades' functions, the Draws window
   (**To pay**, the pay application read only, send back, approve for less), back-charges' office
   screen with P4's table, closeout and **Close the job**, and the schedule's PR 16 reader for a
   trade's percent on its bar (`withReportedActuals`). Likely cut in two (the money, then closeout).
   *Check:* a friendly trade's pay application from its portal, with stored materials, approved for
   less, paid, its unconditional waiver signed; Owner Billing's draft bill reads the line.
7. **U7, the Friday report** (needs O2's `lateFinish`): `weeklyReport` lifted; the report window
   (sections, names off, *From me* or the company, short or full, a line of my own, copy the
   architect, edit the text); `gc-weekly-report-email`; the newest per week on the customer's
   portal with the schedule's PR 15. *Check:* a Friday report on the test project, sent from me
   (mail opens with the draft) and from the company to a test inbox, both kept, the newest shown.
8. **U8, our own crew from its Pipeline job and clock-ins** (the schedule's PR 16, G-51): the
   `job_ledger_id` column, the stage percents from the job's reports, and the head count from its
   clock-ins on the daily log and the schedule's people on site. *Check:* link the test project's
   plumbing to a Pipeline job with a report and a clock-in today; the log shows our crew's count, and
   the stages read the report.
9. **The door, Building to the team**: the migration that swaps the dev-only policies for the
   schedule's team (decision 4) and the money roles on U6's tables, the window gates to match,
   `docs/ACCESS_CONTROL.md`. With Helper 6, after the schedule's PR 10. *Check:* a superintendent on
   the job writes a log and adds a punch item; one not on it sees nothing; a read-only user's write
   is refused; a superintendent sees no draw.
10. **U2b** whenever B2 and P1 are on main: the Follow up sheet's last four kernels.

## Docs each PR touches

- **`docs/migrations/<version>_<slug>.md`**: U1, U3, U4, U5, U6, U8 and the door.
- **`docs/EDGE_FUNCTIONS.md`** (a section and a TOC line): U4 (`gc-architect-email`), U5 (its `rfi`
  kind), U7 (`gc-weekly-report-email`).
- **`docs/ACCESS_CONTROL.md`**: U3 (the dev gate) and the door.
- **`PROJECT_DOCUMENTATION.md`**: U3 (the daily log, the punch list), U4, U5, U6 and U7.
- **`GLOSSARY.md`**: daily log, punch list, punch item, submittal, submittal round, RFI, draw, pay
  application, stored materials, retainage release, closeout, Friday report.
- **`docs/twins/APP_DIRECTORY.md`**: only if Building gets a page of its own. As windows and tabs of
  `/gc` it does not.
- **Help guides**, each with its share card and the plain-words test:
  - *write the daily log for a job we are building* (U3)
  - *keep a trade's punch list* (U3)
  - *send a trade's submittal to the architect* (U4)
  - *ask the architect a question while we build* (U5)
  - *pay a trade's draw* (U6)
  - *send the customer the Friday report* (U7)
- **Release notes and recent-features fragments**: every PR, one `v2.NNNN` each.

## Building's defaults the plan leans on

Each is a constant in the code, changed freely (`HANDOFF.md` call 7 and the lane's own):

| Constant | Value | Where |
|---|---|---|
| `LOG_LOOKBACK_WORKDAYS` | a missing log is flagged for the last 5 working days | `buildingLog.ts` |
| `RFI_NEEDED_DAYS` | an answer is needed 3 days before the work it holds | `buildingRfis.ts` |
| `START_ASK_DAYS` | a trade's start 14 days out asks for its day | `buildingPromises.ts` |
| `TRADE_RETAINAGE_WAIT_DAYS` | a trade's retainage 10 days after the customer pays ours | `building.ts` |
| `PAY_WITHIN_DAYS` | an approved draw is paid within 10 days | `portal.ts` (the Portal's) |
| `WEEKLY_REPORT_DAY` | the Friday report is ready from Friday | `buildingWeekly.ts` |
| `CREW_STAGE_WEIGHTS` | our crew's stages 20, 35, 25, 20 | `building.ts` (on main) |
| `MILESTONE_GRACE_DAYS`, `RELIABILITY_WEEKS` | a milestone's 3 days' grace, reliability over 4 weeks | `schedule/schedule.ts` (on main) |
| Every day a working day | the owner's call 1, 2026-10-05 | the schedule (on main) |

## The owner's calls this plan raises

1. **An RFI answer's cost**: seen by the whole team, superintendents included (the default), or by
   the money roles only.
2. **A submittal that came by email**: the office records it (the default, new beside the prototype,
   where only the portal sent one).
3. **The architect by email from the app** for submittals and RFIs (the default). The prototype
   only logged it.
4. **A day's photos**: a link to that day's Drive folder (the default), or none until the Quo file
   agent.
5. **Who approves and pays a trade's draw**: the money roles (the default), or the job's project
   manager approving and the money roles paying.

## Is this the best we can do?

Three ways it could be better:

1. **The tables and the writes in fewer migrations.** U1's tables, then U3's, U4's and U5's writes,
   are four Building migrations on four days. Writing all four in U1 saves three pushes and three
   types PRs on the lead's queue, but the SQL of the writes would be written before the screens
   that use them prove it. **My pick: keep them apart.** The queue is one migration a lane a day
   anyway, and the screens find the rules the tables miss, as New project's step 6 did.
2. **The log fills itself.** The weather is typed by hand, and so are the trades' head counts. A
   small function could fill the day's sky and temperatures from the National Weather Service for
   the job's geocoded address, and today's crews could start from the trades' own counts (G-142)
   instead of yesterday's log. The superintendent would only correct. That changes `newDailyLog`, a
   lifted kernel, so it is the owner's word. **My pick: offer it after U3**, once a real
   superintendent has written a week of logs.
3. **The submittal register drafts itself.** Each spec section's *Submittals* paragraph says what
   the trade must send. New project already reads the manual's table of contents from its text
   layer, and the same reading could draft the register when a job is awarded. **My pick: later.**
   It needs the section text, not just the table of contents, and a scanned manual has none.

Three calls for the lead:

- U1 as written (ten tables, the cross-lane keys in `DO` blocks), or wait for B1 so the company key
  is plain.
- U3's windows opened from the project's row until B3's tabs, or wait for B3.
- U6 planned in full only once B6, P4, P5 and O1 are on main (the default), or now against their
  plans.

## Status

First draft 2026-10-07 by Helper 4 on `spike/building-plan`, cut from `spike/gc-mode` at e8f61a36f,
and checked against `main` at 70854eb04. The seams were agreed the same evening:

- **Board** (Helper 2): `gc_companies(id)`; `gc_sows` on `step_commitments` with `gc_sow_lines`
  carrying `scope_item_id`; B1 adds `started_on`; back-charges are not Building's.
- **Portal** (Helper 3): back-charges are P4's; each trade write is Building's
  `gc_trade_<verb>` function called by the Portal's submit function; the portal maps one company's
  slice into the kernels' shape.
- **Board, later:** the promise helper is `gc_keep_promises` in B1, called inside Building's writes.
- **Owner Billing** (Helper 5): `gc_change_orders`; the RFI keeps the change order's link; the
  trade's side of a change is U6's; O2 lifts `payAppFile.ts`'s pure half and O4 its writers.

**2026-10-08, Helper 14 (the lane after Helper 4):** U1 (#4848) and U2 are on main and prod. U3a-i,
the daily log's press (`gc_save_daily_log`, #5003, v2.4957, migration `20261009120000`), merged at
21:22 UTC and was applied and verified by the lead (steps 1, 2 and 4; step 3, the live log, waits on
Grace's yes in the lane's chat); its types are #5039. U3a-ii, the Daily log window for a dev (#5051,
v2.4988), merged at 00:15 UTC on 2026-10-09, rebuilt on main over `boardProjectFromView`, since the
old machine's branch never reached origin. Next: U3b after the Board's B6, and U4 (Helper 18's, submittals) after B6-a.

**2026-10-10, gc 4 (the lane after Helper 18):** U3b is planned in `mockups/building-u3b.md`: U3b-i the daily log's tighter rules and the punch list's presses (one migration, green on the real gc-building bed), U3b-ii the punch list's window and the daily log's blank temperature. U6a to U6d are cut (U6d #5251).
