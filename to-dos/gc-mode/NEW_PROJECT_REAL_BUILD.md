---
name: "GC mode, New Project: the real build plan"
parent: to-dos/gc-mode/README.md (punch list #81)
status: planned 2026-10-04 by the New Project lane at the owner's ask ("yes, write the real build plan") · nothing built · nothing touches the database until the owner approves a step
summary: >
  How New Project, the plan sets and the questions about the plans move from the prototype
  (made-up data on branch spike/gc-mode) into the real app: the tables, what the app already has
  that they reuse, the kernels that move over with their tests, and the PRs in order. The owner
  said the real build starts with bidding (question 2); this is the front of bidding.
size: L (6 tables, 3 RPCs, 2 edge functions, about 9 PRs)
blocker: the owner's calls under "Decisions before the first migration"; the company record and the
  invitations (the Board and Portal lanes' part of the plan) before Who to ask and the set emails
---

# GC mode, New Project: the real build plan

## What moves, and what stays

The prototype proved these, and they move: **New project** (the project, the plans, the trades,
each scope with its sheets, sections and what it leaves out, who to ask, budgets from past jobs),
**A new set of plans came in** (addenda and bulletins, a whole reissued set compared with ours,
sheets and sections taken out or renamed, lines tied to new sheets, who checked it, the email),
**Questions about the plans** (asked, sent to the architect, answered, carried in the next set,
closed three days before our bid is due), and **the plans window**.

These stay with the lanes that own them, and this plan only points at them: the company record,
the invitations and the trade's portal (Board and Portal), the schedule and its pushes
(Building), and change orders to the owner (Owner Billing). A step below that needs one of them
says so.

## Decisions before the first migration

Each has a default the plan is written to. The owner changes any of them by saying so.

1. **Where a GC project lives.** *Default:* a row in `projects` (it already has the owner as
   `customer_id`, the address, a `plans_link` and a `project_number` from its sequence) plus a
   one-to-one side table, `gc_projects`, for everything only GC mode needs. Nothing about
   `projects` changes. `jobs_ledger` stays the plumbing job's record; a job we win as GC can link
   to its `projects` row the way `jobs_ledger.project_id` already allows.
2. **Who sees a GC project.** *Default:* dev only while it is built (the page redirects anyone
   else, as Bridge does). Then dev, master and controller, since a project carries money: budgets,
   our number and its fee ("finances stay owner-only"). Estimators and superintendents get a view
   without money in a later step, if the owner wants it.
3. **The project manager.** The app has no project manager role. *Default:* `gc_projects.project_manager_user_id`
   points at any user, the way `bids.account_manager_id` does. Superintendents use the existing
   `project_superintendents` table. Together they are the team that can check a set.
4. **The architect.** `customers` has no owner or architect column. *Default:* an architect is an
   ordinary customer row (commercial), and the project names it in `gc_projects.architect_customer_id`.
   **Someone new** on step 1 makes the customer row, as the prototype does. `customers` is not changed.
5. **The plans in Drive.** The owner: plans live in Google Drive, uploaded by someone who checks
   them. *Default:* each GC project gets its folder in the same Shared Drive the bids use
   ("PipeTooling Jobs", `DRIVE_JOBS_FOLDER_ID`), and each set is a subfolder named for the set
   ("Addendum 1"). The app links to Drive; it never copies the files. Who opened a set comes from
   the portal's own link, not from Drive.

## The tables

Every migration follows `CLAUDE.md`: it starts with `SET lock_timeout = '3s';`, is numbered from
`origin/main`, is claimed with `npm run claim -- --migration <file>`, is written idempotent, and is
pushed with `supabase db push` only after it is on `main`. Every table has RLS, and every
migration that creates a table ends with both `SELECT public.apply_read_only_write_blocks();` and
`SELECT public.apply_read_only_stmt_blocks();`. Each column below names the prototype field it
carries (in `src/lib/gcMode/gcTypes.ts`).

**`gc_projects`**, one row per GC project, keyed by `project_id` (FK `projects.id`):
`stage` (bidding, buyout, building, closed; `GcProject.stage`), `bid_due` (date), `size_note`
(text) and `sq_ft` (numeric, read from the size note by `sqFtInText`), `architect_customer_id`,
`project_manager_user_id`, `general_conditions`, `contingency_pct`, `fee_pct`, `drive_folder_url`,
`lost_on`, `lost_why`, `won_by`, `lost_note` (the Board's lost bid), `created_by`, `created_at`.

**`gc_trade_packages`**, one row per trade on a project: `project_id`, `trade` (text), `position`
(the trade list's order, `tradeOrder`), `budget` (numeric), `ours` (boolean, our own crew), and
`own_bid_id` (FK `bids.id`, nullable: our own number lives in a Trades mode bid, and the trade
counts as real once that bid is priced; `selfPerform.priced`). The Board adds its own columns in
its own PR: `carried_invite_id` and `carried_plug`, `awarded_invite_id` and `awarded_by` (the taken
alternates stay on the quote, `taken_alternates`). Vetting sits on the Board's company record
(`gc_partners.vetting_*`), not per project, and promises in one `gc_trade_promises` table keyed to
the company (Board lane, 2026-10-04).

**`gc_scope_items`**, one row per scope line: `package_id`, `position`, `label`, `sheets` (text[],
null = follow the guess; `ScopeItem.sheets`), `specs` (text[], null = follow the guess;
`ScopeItem.specs`), `added_in_set_id` (the set that added it, null for the first scope;
`PlanSet.addedLines`).

**`gc_scope_exclusions`**, what a trade's quote leaves out: `package_id`, `position`, `label`, `by`
(text: a trade's name, "the owner" or "us"; `ScopeExclusion`).

**`gc_plan_sets`**, one row per set: `project_id`, `rev` (0 is the first set), `label` ("Bid set",
"Addendum 2"), `kind` (addendum, bulletin, revised, permit, construction), `issued_on`, `note`,
`checked_by_user_id` (required in the app; `PlanSet.checkedBy`), `drive_folder_url`,
`created_by`. Unique (`project_id`, `rev`).

**`gc_plan_set_items`**, what each set did to each sheet and section, one row each: `set_id`,
`kind` (sheet, section), `number` ("E-201", "09 91 23"), `title`, `change` (issued, revised, added,
removed, renamed), `was_title` (for renamed). The first set's rows are all "issued"; that is the
sheet index and the manual's table of contents. The sheets as they stand at any set are a fold over
these rows, which is what `sheetsAtRev`, `sheetsGoneAtRev`, `specsAtRev` and `specsGoneAtRev`
already do with the prototype's arrays. One table holds sheets and sections, so a set that
changes both is one list.

**`gc_plan_questions`**: `project_id`, `package_id`, `company_id` (the Board's company record),
`text`, `sheets` (text[]), `asked_on`, `sent_to_architect_on`, `answered_on`, `answer`,
`answer_sent_to` (company ids), `in_set_id` (the set that carried the answer).

**Sends** are not a table of their own: each set email and answer email is logged in the existing
`email_send_log` (Resend), with `email_type` `gc_plan_set` or `gc_plan_answer`. Which companies a
set reached, and whether it changed their trade, goes in **`gc_plan_set_sends`** (`set_id`,
`company_id`, `touched`, `email_send_log_id`), because the portal and the Board read it
(`PlanSet.sentTo`).

## What the app already has, reused

- **The owner and the architect**: `customers` and `customer_contact_persons`. Step 1's pickers read
  them; **Someone new** inserts a customer.
- **The team who can check a set**: `users` (any role) for the project manager, and
  `project_superintendents`.
- **Drive**: `drive-intake` finds or makes a folder under `DRIVE_JOBS_FOLDER_ID` and can upload a plan
  set from a link; `plan-fetch` reads the PDFs behind a link or a folder (it merges a folder's
  PDFs and can probe that the set is readable); `_shared/driveUpload.ts` holds `findOrCreateFolder`.
  The service account is already a member of the Shared Drive, so no new Google setup is needed.
  **Open the folder** on the plans window becomes a real link.
- **Email**: `_shared/resendSendEmail.ts` (`sendEmailViaResend`, which logs to `email_send_log`),
  sent from `COMPANY_EMAIL_FROM` with the project manager as Reply-To, the way `send-bid-room-link`
  does. The words come from `planEmail` in the prototype.
- **No-password links in emails**: the app's token pattern (`sub_portal_links` with a token hash and a
  slug). The trade's portal link itself is the Portal lane's.
- **Our own number**: Trades mode bids. A trade that is ours links its Trades mode bid in
  `own_bid_id`; making that bid from New project is a later step, since a `bids` row needs a customer
  and a service type the plan has not settled.
- **The read-only blocks, release notes, docs fragments, help guides and the plain-words test**: as
  every feature.

## Kernels that move over with their tests

These are pure functions with tests today (`gcNewProject.test.ts`, `gcPlans.test.ts`). They move to
`src/lib/gc/` unchanged, and the prototype imports them from there, so there is one copy:

- Reading what is pasted: `sheetIndexInText`, `specIndexInText`, `sqFtInText`, `sheetsInText`,
  `specsInText`, `takenOutInText`, `sheetAsIndexed` (and `titleWords`, private today, exported on
  the way).
- Splitting the plans into trades: `TRADE_TEMPLATES`, `tradesForSheets`, `tradeForSpec`,
  `tradesForPlans`, `usualScope`, `usualExcludes`, `tradeOrder`.
- Lines and what reaches them: `guessLineSheets`, `guessLineSpecs`, `lineSheets`, `lineSpecs`,
  `lineReads`, `lineReadsSpec`, `linesOnSheets`, `linesOnSpecs`, `linesOnPlans`, `linesATradeHears`,
  `linesLeftBehind`.
- A set: `indexDiff`, `nextSetLabel`, `defaultSetKind`, `SET_KINDS`, `sheetsAtRev`, `sheetsGoneAtRev`,
  `specsAtRev`, `specsGoneAtRev`, `packagesForSheets`, `packagesForSpecs`, `planEmail`,
  `changeOrderFromSet`, `changeOrderTakingTheDays`.
- The gaps and the budgets: `scopeGaps`, `projectScopeGaps`, `tradeCostHistory`, `budgetForSize`
  (with no past GC jobs yet it falls back to the rough rates, `BUDGET_PER_SQ_FT`, until real ones
  close).
- Questions: `questionsCloseOn`, `questionsOpen`, `questionState`, `openQuestions`,
  `answeredNotInSet`, `questionInNote`.

The kernels read the prototype's shapes (`GcProject`, `PlanSet`, `TradePackage`). A mapper,
`gcProjectFromRows`, turns the database rows into those shapes, so no kernel changes when the data
becomes real. The mapper gets its own test against a row set built from the fixture's Boerne.

## Writing it: three RPCs, so a step is all or nothing

- **`gc_create_project(draft jsonb)`**: the `projects` row, `gc_projects`, the packages, scope lines,
  exclusions, set 0 and its items, in one transaction. It takes the prototype's `NewProjectDraft`
  shape. `SECURITY INVOKER`, so RLS decides who may.
- **`gc_issue_plan_set(set jsonb)`**: the set, its items, the lines it adds, the lines it ties to new
  sheets (`retiedLines`), the trades it brings, the questions it carries, in one transaction. It
  takes the `issuePlanSet` action's shape and refuses a lost bid and a set with no checker.
- **`gc_record_question`** and **`gc_answer_question`**: small writes, kept as RPCs so the closing
  day is checked in one place (`questionsOpen`'s rule, three days before the bid is due).

## The PRs, in order

Each ships alone behind the dev gate, with its release note, docs fragment and, from the first
screen on, its help guide. "Check" is how the reviewer sees it work.

1. **Lift the kernels** into `src/lib/gc/` with their tests; the prototype imports them. No
   database, no screen change. *Check:* `npm test` passes, and the prototype on `/bids/gc` behaves
   as before.
2. **Migration: projects, trades, scope** (`gc_projects`, `gc_trade_packages`, `gc_scope_items`,
   `gc_scope_exclusions`), RLS for dev, master and controller, the read-only blocks, the regenerated
   types. *Check:* the migration doc's SQL shows each table empty and its policies; a read-only
   user's insert is refused.
3. **Migration: plan sets and questions** (`gc_plan_sets`, `gc_plan_set_items`, `gc_plan_questions`,
   `gc_plan_set_sends`). *Check:* as PR 2.
4. **New project on real data**, steps 1 to 4 (the project, the plans, the trades, each scope), on a
   dev-only page, through `gc_create_project`, and the mapper. Who to ask is hidden until the
   company record lands. *Check:* make the clinic from the prototype's made-up index; the project
   appears with its 21 sheets, 14 trades, scope lines with their sheets and sections, and the gaps.
5. **Drive**: making a project makes its folder (`drive-intake`, folder only); a set records its
   folder link; the plans window opens it; `plan-fetch` probes that the set's PDFs are readable.
   *Check:* the folder appears in the Shared Drive, and **Open the folder** opens it.
6. **A new set of plans came in on real data**, through `gc_issue_plan_set`: names, notes, the pasted
   index and table of contents compared with ours, take out and rename, lines left behind tied to
   new sheets, trades brought, **Checked by** from the team. No email yet. *Check:* the prototype's
   walk, a permit set that takes C-201 out and renames C-101, on a real project.
7. **The set email** (edge function `gc-plan-set-email`): to the companies on each touched trade
   while we bid, only the one on it once ours, through Resend with the project manager as Reply-To,
   logged in `email_send_log` and `gc_plan_set_sends`. Needs the invitations (Board and Portal).
   *Check:* a test company's inbox gets the touched-trade email naming its lines.
8. **Questions about the plans on real data**: recording one, sending it to the architect (edge
   function `gc-plan-question-email`), the answer to every company quoting the trade, carried in
   the next set. *Check:* the prototype's Pad B question, end to end, on a real project.
9. **The plans window on real data**: the sheets and the manual as they stand at each set, what each
   set took out, the scope that reads from a sheet or a section. *Check:* the permit set's C-201 is
   under Taken out, and C-101 lists Clearing and grading.

**Later, once the rest of the plan is in:** Who to ask on real data (after the company record and
invitations); a set's schedule pushes and new work on the schedule (after Building's schedule
tables); change orders a set starts (after Owner Billing's); reading the sheet index from the PDF's
own text instead of a paste (`plan-fetch` and pdf.js, `src/lib/pdfjsDocument.ts`); budgets from the
company's closed GC jobs as they close.

## Docs each PR touches

`docs/migrations/<version>_<slug>.md` for PRs 2 and 3; `docs/EDGE_FUNCTIONS.md` for PRs 5, 7 and 8;
`docs/ACCESS_CONTROL.md` when the page and its roles are set (PR 4), and again if decision 2 widens;
`docs/twins/APP_DIRECTORY.md` and `PROJECT_DOCUMENTATION.md` when the page is added (PR 4);
`GLOSSARY.md` for GC project, plan set, addendum, bulletin and scope line. Help guides:
"start a GC project from its plans" (PR 4), "send out a new set of plans" (PR 6), "answer a
question about the plans" (PR 8).

## Status

Planned 2026-10-04. Next: the owner's answers to the five decisions, then PR 1.
