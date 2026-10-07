---
name: "GC mode, New Project: the real build plan"
parent: to-dos/gc-mode/README.md (punch list #81)
status: planned 2026-10-04 by the New Project lane at the owner's ask ("yes, write the real build plan") · the owner took the five defaults the same day · PR 1 (the pure kernels in src/lib/gc/) in · amended 2026-10-05 for the 2026-10-04 rounds (the scope book, the Drive link and its check, set kinds, We work for, budgets by size) · nothing touches the database until the owner approves a step
summary: >
  How New Project, the plan sets and the questions about the plans move from the prototype
  (made-up data on branch spike/gc-mode) into the real app: the tables, what the app already has
  that they reuse, the kernels that move over with their tests, and the PRs in order. The owner
  said the real build starts with bidding (question 2); this is the front of bidding.
size: L (12 tables, 3 RPCs, 3 edge functions, about 11 PRs)
blocker: the owner's word that the shape is settled (PR 1b, then the tables); the company record and the
  invitations (the Board and Portal lanes' part of the plan) before Who to ask and the set emails
---

# GC mode, New Project: the real build plan

## What moves, and what stays

The prototype proved these, and they move: **New project** (who we work for, the project, the plans
and their Drive link, the trades with budgets by size, each scope with its sheets, sections and what
it leaves out, who to ask, budgets from past jobs), **the scope book** (its lines, sets and
exclusions, on step 4 and on its own page),
**A new set of plans came in** (addenda and bulletins, a whole reissued set compared with ours,
sheets and sections taken out or renamed, lines tied to new sheets, who checked it, the email),
**Questions about the plans** (asked, sent to the architect, answered, carried in the next set,
closed three days before our bid is due), and **the plans window**.

These stay with the lanes that own them, and this plan only points at them: the company record,
the invitations and the trade's portal (Board and Portal), the schedule and its pushes
(Building), and change orders to the owner (Owner Billing). A step below that needs one of them
says so.

## Decisions before the first migration

Each has a default the plan is written to. **The owner took all five defaults on 2026-10-04**
("yes to the defaults"). He changes any of them by saying so.

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
   *Amended 2026-10-04 and 2026-10-05 by the owner:* every set carries the Google Drive link of its
   files, pasted by whoever uploaded and checked them, and the app says whether anyone with the link
   can open it ("this works") or only some people ("please correct"). A link only some can open is
   a warning, never a stop. Each project folder holds **Plans** (anyone with the link can view:
   trades and us) and **Team only** (the Calls, texts and big files proposal, README). The Shared
   Drive has worked since 2026-08-29 (`docs/DRIVE_INTAKE_SETUP.md`), so no Google grant is needed.

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
Added for the 2026-10-04 rounds: `customer_role` (text, `owner`, `gc` or `owners_rep`, default
`owner`; *We work for*, `GcProject.customerRole`; the customer stays `projects.customer_id`) and
`property_owner_customer_id` (FK `customers.id`, null when the customer owns the property;
`GcProject.propertyOwnerId`; Owner Billing's pay application shows it when set). `sq_ft` is typed in
step 1's **Size** box and stored as typed; `size_note` holds only the words after it (the prototype
joins the two into `sizeNote` and reads the number back with `sqFtInText`).

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
"Addendum 2"), `kind` (the first set: bid, pricing or permit, step 2's chips with their **i**,
`SET_KIND_HELP`; a later set: addendum, bulletin, revised, permit or construction, `SET_KINDS`),
`issued_on`, `note`, `checked_by_user_id` (required in the app; `PlanSet.checkedBy`), `created_by`.
The Drive link (`PlanSet.drive`) replaces `drive_folder_url`: `drive_url` (a Drive file or folder
link, `driveLink`; required on the first set, and on a later set that brings drawings,
`driveLinkProblem`), `drive_access` (`anyone` or `restricted`, null until checked) and
`drive_checked_on` (date). Unique (`project_id`, `rev`).

**`gc_plan_set_items`**, what each set did to each sheet and section, one row each: `set_id`,
`kind` (sheet, section), `number` ("E-201", "09 91 23"), `title`, `change` (issued, revised, added,
removed, renamed), `was_title` (for renamed), `discipline` (text, null when the number's letters say
it; `PlanSheet.discipline`, picked in the sheet table) and `page` (int, the plan PDF page a sheet was
read from; `PlanSheet.page`). The first set's rows are all "issued"; that is the
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

**The scope book** (the owner, 2026-10-04, Round 4). The book is read, not stored: `scopeBook` builds
it from every scope line on our GC projects (`gc_scope_items` with their trade, and
`added_in_set_id` for a line that came in late), the usual lines (`TRADE_TEMPLATES`) and the
office's own changes. Only those changes are tables, one per list in `ScopeBookStore`, company-wide
(no project key), with the GC projects' RLS (decision 2; the book carries no money, so it can open
to estimators first):

- **`gc_scope_book_saved`**, a line saved by hand: `trade`, `words`, `spec`, `leaves_out_label`,
  `leaves_out_by` (a `ScopeExclusion`), `saved_by`, `saved_at` (`ScopeBookSaved`).
- **`gc_scope_book_edits`**, read oldest first: `trade`, `words` (the line as the book had it),
  `to_words`, `to_spec`, `clear_spec` (boolean), `to_leaves_out_label`, `to_leaves_out_by`,
  `clear_leaves_out` (boolean), `edited_by`, `edited_at` (`ScopeBookEdit`; the mapper turns a
  `clear_*` into the kernel's null).
- **`gc_scope_book_merges`**: `trade`, `from_words`, `into_words`, `merged_by`, `merged_at`
  (`ScopeBookMerge`; `resolveWords` follows a chain of merges).
- **`gc_scope_sets`**, a named list of one trade's lines: `trade`, `name`, `lines` (text[]),
  `from_project_id` (FK `projects.id`, nullable), `saved_by`, `saved_at` (`ScopeBookSet`).

Its exclusions are read too (`scopeBookExclusions`): the usual ones, each project's
`gc_scope_exclusions`, and what quotes left out (the Board's quote table, once it exists). "It cost
a change order" on a late line reads Owner Billing's change orders once that table exists; until
then a late line says only which set brought it.

## What the app already has, reused

- **The customer, the property's owner and the architect**: `customers` and
  `customer_contact_persons`. Step 1's pickers read them; **Someone new** inserts a customer. The
  prototype's picker narrows to a customer's kind for *We work for* (`CUSTOMER_ROLES.fits`);
  `customers` has no such kind, so the real picker lists every customer.
- **The team who can check a set**: `users` (any role) for the project manager, and
  `project_superintendents`.
- **Drive**: `drive-intake` finds or makes a folder under `DRIVE_JOBS_FOLDER_ID` and can upload a plan
  set from a link; `plan-fetch` reads the PDFs behind a link or a folder (it merges a folder's
  PDFs and can probe that the set is readable); `_shared/driveUpload.ts` holds `findOrCreateFolder`.
  The service account is already a member of the Shared Drive, so no new Google setup is needed.
  **Open the folder** on the plans window becomes a real link. New: **`gc-drive-access`**, the check
  behind "this works" and "please correct". It asks Drive about the link with no sign-in (the Drive
  API with an API key answers only for a link anyone can open), and failing that opens the page and
  treats a sign-in page or "You need access" as restricted. It runs when a project is made, when a
  set is issued, and on **Check again**.
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

**PR 1b, the kernels from the 2026-10-04 rounds**, pure and tested, moved the same way:

- The sheet table: `SHEET_DISCIPLINES`, `disciplineOf`, `withPickedDisciplines`, `SheetIndexRow`,
  `rowProblems`, `sheetsOfRows`, `nextSheetNumber`, `readSheetLines`, `PdfTextItem`,
  `readTitleBlock`. pdf.js itself stays in the screen; the kernel takes its text items.
- Budgets by size: `perSqFtWords`, `budgetBySize` (`BudgetLine`).
- The Drive link: `driveLink`, `driveLinkProblem`. `driveAccessStandIn` and the two made-up links
  stay in the prototype; `gc-drive-access` replaces them.
- Set kinds: `SET_KINDS`, `defaultSetKind`, `nextSetLabel`, and `SET_KIND_HELP` (the owner's words
  for a bid, pricing and permit set).
- We work for: `CustomerRole` and the role words now in `GcNewProject.tsx` (`CUSTOMER_ROLES`: label,
  customer, them), moved to a kernel without `fits`.
- The scope book, all of `gcScopeBook.ts`: `scopeWordKey`, `scopeBook`, `inScopeBook`, `lateWords`,
  `searchScopeBook`, `oftenMissed`, `scopeSetsFor`, `linesToAdd`, `scopeBookDuplicates`,
  `scopeBookUseWords`, `scopeBookExclusions`, `scopeBookExclusionWords`, `EMPTY_SCOPE_BOOK` and the
  store types. One change on the way: `scopeBook` takes the projects, the store and the past jobs'
  lines as arguments instead of the whole state and the prototype's `PAST_JOBS`, so the real build
  passes its closed jobs. The tests stay as they are.
- `exclusionsFor(trade, book?)`, `exclusionName` and its folding table, from the Board's
  `gcExclusions.ts`, which the scope book needs (the Board lane's OK, 2026-10-05). `gcExclusions.ts`
  re-exports them, so there is one copy and nothing on the branch changes.

The kernels read the prototype's shapes (`GcProject`, `PlanSet`, `TradePackage`). A mapper,
`gcProjectFromRows`, turns the database rows into those shapes, so no kernel changes when the data
becomes real. The mapper gets its own test against a row set built from the fixture's Boerne.

## Writing it: three RPCs, so a step is all or nothing

- **`gc_create_project(draft jsonb)`**: the `projects` row, `gc_projects`, the packages, scope lines,
  exclusions, set 0 and its items, in one transaction. It takes the prototype's `NewProjectDraft`
  shape, with `customerRole`, the property's owner, `sqFt` and the first set's `drive` (already
  checked by `gc-drive-access`). `SECURITY INVOKER`, so RLS decides who may.
- **`gc_issue_plan_set(set jsonb)`**: the set, its items, the lines it adds, the lines it ties to new
  sheets (`retiedLines`), the trades it brings, the questions it carries, in one transaction. It
  takes the `issuePlanSet` action's shape and refuses a lost bid and a set with no checker. Its
  `drive` is checked first, like the first set's. **Check again** is a plain update of the set's
  three Drive columns under RLS (`checkPlanSetDrive`).
- The scope book's writes are single inserts under RLS (save a line, edit, merge, save a set), so
  they need no RPC.
- **`gc_record_question`** and **`gc_answer_question`**: small writes, kept as RPCs so the closing
  day is checked in one place (`questionsOpen`'s rule, three days before the bid is due).

## The PRs, in order

Each ships alone behind the dev gate, with its release note, docs fragment and, from the first
screen on, its help guide. "Check" is how the reviewer sees it work.

1. **Lift the kernels** into `src/lib/gc/` with their tests; the prototype imports them. No
   database, no screen change. *Check:* `npm test` passes, and the prototype on `/bids/gc` behaves
   as before. **1b.** The same for the 2026-10-04 rounds' kernels (listed under *Kernels*), with the
   `scopeBook` argument change. *Check:* as PR 1.
2. **Migration: projects, trades, scope and the scope book** (`gc_projects` with `customer_role`,
   `property_owner_customer_id` and `sq_ft`, `gc_trade_packages`, `gc_scope_items`,
   `gc_scope_exclusions`, and the book's four tables), RLS for dev, master and controller, the
   read-only blocks, the regenerated types. *Check:* the migration doc's SQL shows each table empty and its policies; a read-only
   user's insert is refused.
3. **Migration: plan sets and questions** (`gc_plan_sets` with `kind` and the three Drive columns,
   `gc_plan_set_items` with `discipline` and `page`, `gc_plan_questions`, `gc_plan_set_sends`).
   *Check:* as PR 2.
4. **New project on real data**, steps 1 to 4, on a dev-only page, through `gc_create_project`, and
   the mapper: step 1 with *We work for*, the property's owner and the **Size** box; step 2 with the
   set's kind and its **i**, the sheet table (a plan PDF with a text layer, a paste or typing) and
   the Drive link with its check; step 3 with budgets by size; step 4 with the scope book (start
   from a set, *Often missed*, *Add a line* searching the book, *Save to the book*). Who to ask is
   hidden until the company record lands. Until `gc-drive-access` lands with PR 5, the link is
   checked for being a Drive link only and its access shows as not checked. *Check:* make the clinic from the prototype's made-up index; the project
   appears with its 21 sheets, 14 trades, scope lines with their sheets and sections, and the gaps.
**4b. The scope book's page on real data** (*Open the scope book*: lines and sets by trade, edit,
   merge duplicates, save a project's scope as a set, its exclusions), with its door from Trade
   partners once the Board's page is real. *Check:* save Boerne's sitework as a set and start Pad B
   from it.
5. **Drive**: making a project makes its folder with **Plans** and **Team only** inside
   (`drive-intake`, folders only), and sets Plans to anyone with the link; `gc-drive-access` checks
   each set's link on making, issuing and **Check again**; the plans window opens the link;
   `plan-fetch` probes that the set's PDFs are readable. First see whether the Shared Drive lets
   its files be shared with anyone with the link, and whether the service account's role may set
   that (it could not delete its own file in August). *Check:* the folders appear in the Shared
   Drive; a link only some can open shows "please correct" until it is fixed in Drive.
6. **A new set of plans came in on real data**, through `gc_issue_plan_set`: names and kinds, notes,
   the set's Drive link with its check, the pasted index and table of contents compared with ours, take out and rename, lines left behind tied to
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

`docs/migrations/<version>_<slug>.md` for PRs 2 and 3; `docs/EDGE_FUNCTIONS.md` for PRs 5 (with
`gc-drive-access`), 7 and 8;
`docs/ACCESS_CONTROL.md` when the page and its roles are set (PR 4), and again if decision 2 widens;
`docs/twins/APP_DIRECTORY.md` and `PROJECT_DOCUMENTATION.md` when the page is added (PR 4);
`GLOSSARY.md` for GC project, plan set, bid set, pricing set, permit set, addendum, bulletin,
scope line, scope book and scope set. Help guides: "start a GC project from its plans" (PR 4),
"keep the lines we always write in the scope book" (PR 4b), "send out a new set of plans" (PR 6),
"answer a question about the plans" (PR 8).

## Status

Planned 2026-10-04. The owner said yes to the five defaults the same day ("yes to the defaults,
start the first PR"). PR 1 is in: the pure kernels at `src/lib/gc/plans.ts` with
`src/lib/gc/plans.test.ts`, merged on main 2026-10-04 (clickconstruction/pipetooling.github.io#4448, c459ecee4), and on this branch,
where `gcNewProject.ts` and `gcPlans.ts` now import and re-export them (one copy). The kernels that
need a whole project (a line's reach, a set's fold, the set email, the questions) move with PR 4,
beside the real types and the row mapper. Nothing builds the tables (PRs 2 and 3) until the owner
says the shape is settled.

Amended 2026-10-05 for the 2026-10-04 rounds: the scope book (four tables, its page as PR 4b), the
Drive link and its check (three columns on a set, `gc-drive-access`, Plans and Team only folders),
set kinds (bid, pricing and permit for the first set), *We work for* and the property's owner (two
columns on `gc_projects`), budgets by size (`sq_ft` stored as typed), and PR 1b for their kernels.
PR 1b is next, on the owner's word.

Amended 2026-10-06, the day the owner said the shape is settled: PR 1b landed as v2.4696
(clickconstruction/pipetooling.github.io#4687: sheets, budgets, drive, set kinds, customer role,
exclusions and the scope book kernels in `src/lib/gc/`). PR 2 landed as v2.4703 (#4699, migration
`20261006233000_gc_projects_trades_scope`) and PR 3 as v2.4691 (#4701, migration
`20261006234000_gc_plan_sets_questions`); both are applied to prod with `supabase db push`, the
types PR is #4713. PR 4 is cut in two on main: 4a, v2.4707 (#4718), is `gc_create_project` and the
row mapper `src/lib/gc/projectRows.ts`; 4b, v2.4708 (branch `claude/gc-real-build-pr4b-new-project`),
is the window ported with its first four steps, `src/lib/gc/gcIo.ts`, the dev-only page at `/gc`
and the guide `start-a-gc-project`. Step 5, Who to ask, stays on this branch until the company
record exists. The scope book page (4b-second) and the Drive check (PR 5) are next.

Amended 2026-10-06, late: step 4 landed. 4a, `gc_create_project` and the row mapper, merged as
v2.4716 (clickconstruction/pipetooling.github.io#4718, migration `20261007030000_gc_create_project`,
applied; types in #4751). 4b, the window on real data behind the dev door at `/gc`, merged as
v2.4748 (#4764). The plan's check passed on prod: a test project ("GC test project, delete me",
with a new customer and architect) was made from the window in one press and read back with its
set, 7 sheets, 3 sections, 5 trades with their budgets, 20 scope lines with their sheets and
sections, and the gaps. Next: 4b-second (the scope book page), then step 5 (Drive).

Amended 2026-10-06, later still: 4b-second and step 5 are built. The scope book's window on real
data is v2.4752 (clickconstruction/pipetooling.github.io#4770, in the queue): the four writes to the
book's tables, *Open the scope book* and a trade's *Save as a set* on the GC projects page; the
check passed on prod, a set saved from the test project's Concrete scope offered under *Start from
the book* on the next project. Step 5 is v2.4754 (its PR follows #4770): the edge function
`gc-drive-access` (`make_folders`, `check`), deployed and checked on prod. The folders appeared in
the jobs Shared Drive, Plans reads *anyone* (the Shared Drive allowed the anyone-with-the-link
share, the question the plan asked), and a link the service account cannot see says so with the
words to fix it. Still to come from step 5: the plans window opening the link, `plan-fetch`
probing the set's PDFs, and the check on issuing a new set, which land with step 6.

Amended 2026-10-06, night: 4b-second merged as v2.4752 (#4770) and step 5 is #4776 in the queue.
Step 6 is cut in two. 6a, `gc_issue_plan_set` and the line-reach kernel `src/lib/gc/lineReach.ts`,
merged as v2.4757 (clickconstruction/pipetooling.github.io#4774, migration
`20261007090000_gc_issue_plan_set`, applied; types in #4784). 6b, the new-plans window on real data
(`GcNewPlans.tsx`, the draft kernel `planSetDraft.ts`, the Drive check before the issue, the guide
`issue-a-new-set-of-plans`), merged as v2.4773 (clickconstruction/pipetooling.github.io#4789, renumbered from v2.4758 by the
merge-conflict watcher). Its check passed on prod 2026-10-07: a permit set issued on the test project
from the notes "S-101 is taken out. S-102 Foundation details added." read back as the newest of two
sets with 7 sheets, S-101 gone, S-102 new, the Foundations line retied to S-102 from the
*Lines left with nothing to read* list, and the Drive check run on the set (the job folder reads
*only some people can open it*, as it should). Step 9, the plans window on real data (`planSetReads.ts` folds a set's sheets and
specs from the set items; `GcPlansWindow.tsx` opens the Drive link, no stand-in drawings; guide
`read-the-plans-of-a-gc-project`), is v2.4774 on the same stack. Step 8 is cut in two: 8a,
v2.4775, is the record behind the window (migration `20261007130000_gc_plan_questions_rpcs`:
`asked_by_name`, `gc_record_question`, `gc_answer_question`, the closing day, and
`gc_issue_plan_set` carrying the answers in a set; the kernel `questions.ts`); 8b, v2.4776, is the
questions window (`GcQuestions.tsx`), the edge function `gc-plan-question-email` (Reply-To the PM)
and the guide `ask-the-architect-about-the-plans`. The stack merges in the order 6b, 9, 8a (then its
migration and types), 8b. Step 7, the set email, waits on the company record (no lane has built it).
The plan's checks on prod (a permit set on the test project taking S-101 out; a question emailed to
a test architect) run as each lands.
