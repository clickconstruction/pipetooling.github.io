---
name: "Messages: the build plan"
parent: to-dos/gc-mode/messages/MESSAGES_PLAN.md
status: written 2026-10-11 at the owner's ask ("the edits are becoming cosmetic; help me plan the build"); brought up to the prototype's v1.177 on 2026-10-12 ("I am just about ready to build it")
---

# Messages: the build plan

The prototype (`prototype.html`, v1.177) is the spec. This file is the order to build it in, what each
cut touches, and what it reuses. `MESSAGES_PLAN.md` holds the why and the decisions; this holds the
how. The owner will keep changing the prototype while this is built; a change there is a change to
the cut that owns the surface, named below.

## 1. What we are building, in one paragraph

Every call, text and email with a person, in one thread per person, with the jobs they are on as
labels on the person and on each line. Follow up is one queue of everything waiting on us. A flow per
kind of person (customer, trade partner, architect) says where each one is, and every step of it is
finished by a fact the app already keeps, never by a typed word. The papers a step turns on are sent,
signed and reminded from the thread. Bill day reads the trades' pay applications against the
deadline, with the superintendent's walk feeding it. One rule under all of it, from the plan: **a step
is finished by a fact the app keeps.** Everything else is a view.

## 2. What exists on main and is reused, never rebuilt

| Need | What exists |
|---|---|
| The people | `customers` and their contacts, the GC customer contacts, `gc_companies` and their people, the Person Desk. A contact here must be one of them (the open item *which record a contact is*, settled in cut 1). |
| The jobs | `bids`, `gc_projects`, `jobs_ledger`; `gc_trade_packages` for which trade a company is on a job. |
| Email out | Resend through the edge functions (`gc-trade-email`, `gc-customer-email`, `gc-architect-email`); every sent copy in `sent_documents` (`docs/SENT_COPIES.md`). |
| Email in | Nothing. Cut 6 builds the bids@ reader. |
| Calls and texts | Nothing. Cut 5 builds the Quo link (`HANDOFF.md` section 5 holds the taken design: one company number, two seats, every call recorded). |
| The flow's facts | The stamps the sweep found (`MESSAGES_PLAN.md` → *What finishes each step today*): `gc_invites`, `gc_companies.portal_opened_on`, `person_contract_documents` (w9, coi, agreement), `gc_quotes`, `gc_trade_packages`, `gc_sows`, `gc_draws`, `gc_projects.*_on`, `gc_owner_pay_apps`, `gc_change_orders`, `gc_plan_sets`, `gc_plan_questions`, `gc_rfis`, `gc_submittal_rounds`. |
| A state per step from stamps | `src/lib/journeys/personJourney.ts` and `journeyHealth.ts`: five journeys, a state per step. The flow is that kernel's list made editable. |
| A paper to sign | `src/lib/gc/paperSend.ts` and `GcPaperSend.tsx` (send, remind, the history words); `src/lib/esignConsent.ts` (the consent, versioned); the sign page the office's email opens (`GcTradePortalPapers.tsx`, `/contract/accept`). |
| The trade's portal | `GcTradePortal.tsx` over `gc-trade-portal`, EN and ES (`PORTAL_SPANISH.md`). |
| Bill day, the owner's half | `src/lib/gc/ownerBillingDay.ts` (`billDay`, the amber notes), `billingForecast.ts`, `ownerBillingRemind.ts`, the Money page (`GcMoney.tsx`), the office notices (`gc_office_notices`). |
| The trades' draws | `gc_draws`, `gc_draw_lines` (`we_see`), `gc_sow_lines`, `drawRows.ts`, `drawsIo.ts`, the Draws window, `tradeCloseout` in `building.ts`. |
| The daily log | `buildingLog.ts`, `gc_crew_on_site`, the log's photos. |
| Quick replies | Nothing; cut 3. |
| Who has it, Open · Snoozed · Done | Nothing; cut 2. |
| Help, release notes, the app directory | `src/content/help/`, `src/content/releaseNotes/`, `docs/twins/APP_DIRECTORY.md`, as CLAUDE.md says. |

## 3. The data

Every table gets the read-only and digital-twin fences (`apply_read_only_write_blocks`,
`apply_read_only_stmt_blocks`, `apply_digital_twin_write_blocks`), `SET lock_timeout = '3s'`, the
`docs/migrations/<version>_<slug>.md` note, and a number claimed from `origin/main`.

| Table | Holds | Cut |
|---|---|---|
| `contacts` | A view over the people the app has, not a fifth list: the record it points at (`customer_contact_id` / `gc_company_person_id` / `person_id`), `kind` (customer, trade, arch, unknown), `goes_by`, `opted_out_at`, `state` (waiting, snoozed, done), `snoozed_until`, `has_user_id`, `has_since`, `has_how` (took it, by the rule, handed), `off_since`, `off_why`, `off_by`. | 1, 2 |
| `contact_channels` | A phone number or email that is theirs; a number nobody knows is a contact with one channel until *Who is this?* names it, which re-points the contact and keeps its thread. | 1 |
| `contact_jobs` | The association, with `is_default` (one per contact). | 1 |
| `messages` | One row per call, voicemail, missed call, text, email, team note or event: `contact_id`, `job_id` (null = on the person), `channel`, `direction` (in, out, team), `who_user_id` or `who_text`, `at`, `subject`, `body`, `quo_id` / `gmail_id` (the source id, unique), `recording_url`, `transcript`, `summary`, `duration`, `optout_line` (first, silence), `back_on`, `back_by` (a note's follow-up day), `step_id` (a note tied to a step). | 1, 5, 6 |
| `message_attachments` | A file as it arrived or went: `kind`, `name`, `size`, `bucket_path` (our copy), `link` (a link is a link), `sent_as` (file, link, picture), `drive_file_id` once filed. | 6, 7 |
| `message_highlights` | `message_id`, `text`, `by`, `at`. | 2 |
| `message_promises` | What a line was read as: `kind` (quote, start, papers, payment), `day`, `state` (offered, written, no), `by`, `where` (the row it was written to). | 2 |
| `contact_owed` | What we owe a person: `what`, `by_day`, `marked_by`, `marked_at`, `done_at`, `done_note_message_id`. One open row per contact. | 2 |
| `quick_replies` | `text`, `for_kind`, `step_id`, `scope` (team, mine), `added_by`, `removed_at`; `quick_reply_uses` (`user_id`, `contact_id`, `at`); `quick_reply_versions` (every edit with who and when). | 3 |
| `flows` / `flow_steps` | One flow per kind: `lane` (once, per_job, any_time), `order`, `name`, `name_es`, `who` (us, them, both), `seat_user_id`, `facts` (ids from the code list), `join` (and, or), `papers`, `loop` (each ask, …), `nudge_days`, `nudge_how`, `nudge_send` (ask, app), `nudge_day_fact`; `flow_step_history`; `flow_removed_steps`. **State is never stored**: it is a read. | 4 |
| `contact_step_notes`, `contact_step_skips` | A team note tied to a step; a step skipped for one person with a reason. | 4 |
| `flow_fact_wishes` | *Ask for a fact that is missing*: `text`, `step_id`, `by`, `at`. | 4 |
| `nudge_holds`, `nudge_sent` | *Hold until Mon*; what the app or a person sent for a step and when, so a reminder never doubles. | 4, 5 |
| `superintendent_checks` | Per draw line, per walk: `we_see_pct` or `stored_on_site`, `by`, `at`, `photo_id`, `note`. The Draws window reads the newest into `gc_draw_lines.we_see`. | 9 |
| `bill_day_nothing` | *Nothing this period*: `sow_id`, `period_to`, `said_by`, `at`. | 9 |
| Four facts the app does not keep | `gc_trade_portal_links.first_opened_at`; `gc_trade_packages.lost_on` per invite (or a `gc_invites.lost_on`); `gc_projects.won_on`; warranty end computed from `gc_owner_acceptances.accepted_on` + 1 year (no column). | 4 |

The flow's facts are **a list in code** (`src/lib/flows/facts.ts`): id, words, the group, the column
each reads, and whether it names a paper we send. A fact that is not there cannot be picked.

## 4. The build, in order

Kernels first (`src/lib/…`, pure, unit-tested), then SQL, then the read, then the screens; one
change, one PR, auto-merge; every PR its release note, its `docs/recent-features/` fragment, its
help guide when it changes a flow a person meets, and its `APP_DIRECTORY.md` line when it adds a
page. The prototype's words are the words; its hover cards are the help text.

### Cut 1 · The spine: a contact, its channels, its jobs, its messages (read only)

- **Kernels**: `contacts/kernel.ts` (which record a contact is, the matching rule by number and
  address, `firstName` from `goes_by`), `messages/thread.ts` (the thread in time order, the day
  dividers, a line's job, whose move from the last in and out, `whenWords`), `messages/stamps.ts`
  (Them · Us, the `(+6)` mark, the calendar).
- **SQL**: `contacts`, `contact_channels`, `contact_jobs`, `messages` with its fences; the RPCs
  `contact_for_channel`, `name_contact` (*Who is this?*: re-points, keeps the thread), `tie_message`,
  `set_default_job`; a seed that reads the people the app has into contacts.
- **Screens** on `/gc`: the Messages tab (the list as three lines per row, All · Customers · Trades ·
  Who is this?, the rail of faces, search across words); the thread as a window (name row with the
  pair ☎ ⋯, the company line with its chevron over the phone and the email, the status row that
  leads with the move strip, the stamps sentence, the jobs rail as tiles with the default star, drag
  and press-and-hold to tie; v1.166); a message's time on its last line when there is room (v1.156);
  a repeated job within a day as its number alone (v1.158); the message window (the whole text, its
  facts, one highlight slot that reads Remove or Highlight by the selection, Copy, Print, Share; v1.159).
- **Decision taken here**: *which record a contact is* (section 7).

### Cut 2 · Follow up, whose move, and what we owe

- **Kernels**: `followUp/queue.ts` (Needs a reply, longest waiting first; Needs you; We owe them),
  `messages/owed.ts` (the two blanks, the flow's our-move words, `readDay`, done with a note),
  `messages/promises.ts` (a day heard: the kinds by who they are, *just talk*).
- **SQL**: `contact_owed`, `message_promises`, `message_highlights`; `contacts.state`, `has_*`,
  the rule in Settings → Phone and texts (`app_settings.messages_assign_rule`); RPCs `take_it`,
  `hand_to`, `set_state`, `mark_owed`, `owed_done`, `write_down`, `highlight`.
- **Screens**: the Follow up tab (Needs you, Needs a reply, We owe them, the nudge section lands in
  cut 4); the who-has-it pill and Open · Snoozed · Done; the owed strip above the box; the settling
  note; a note's follow-up day (*Bring it back on a day…*); the highlight and its three removes.
  Open · Snoozed · Done is the app's to set and the ⋯ menu's to override (v1.146); the list sorts by
  the newest conversation only (v1.147).

### Cut 3 · Replying: the box, quick replies, the send window

- **Kernels**: `messages/compose.ts` (the kinds, the from line, the greeting from `goes_by`, the
  subject from the job and the first line, the signature from the account, the opt-out line's two
  rules and 30 quiet days, the segment count), `quickReplies/kernel.ts` (groups by kind and step,
  most used first, the search mark, `qrGuess`).
- **SQL**: `quick_replies` and its two side tables; RPCs `use_quick_reply`, `edit_quick_reply`
  (versioned), `remove_quick_reply`, `restore_quick_reply`.
- **Screens**: the reply box (Text blue, Email white, Note yellow, the orange ring, the from line
  floating in the empty box, Tie to left and Send right); the quick replies strip folded to a press
  on the kinds row; *Find a reply*; the Edit quick replies window with history and Removed; the send
  window (what they see, the To line editable, the subject editable, *After this sends*, the opt-out
  line as the app's own bubble, the email note at the bottom); the sent copy filed through the
  existing `sent_documents`; the Attach picker's *preview* on every file (v1.148); the count line by
  kind (v1.149); the strip's rows with their titles and the narrow box that adds a reply when it finds
  none (v1.142–v1.145).
- **Sending** reuses Resend for email; a text waits on cut 5 (until then the send window says so).

### Cut 4 · The flow suite

- **Kernels**: `flows/facts.ts` (the list), `flows/state.ts` (done, on now, next, late, lapsed,
  waiting on someone else, skipped, off the flow, as reads over the stamps; the per-job lane per
  job; `wouldBeNow` for the editor's preview), `flows/card.ts` (the step card's words: the status
  sentence, what we need, until then, next, reminder, so far), `flows/nudges.ts` (which rows Follow
  up gets, the folding of a lapsed step into the same person's row, the row that goes to the other
  person), `flows/board.ts` (everyone by step, by company), `flows/going.ts` (the usual, the funnel,
  where it sticks).
- **SQL**: `flows`, `flow_steps`, `flow_step_history`, `flow_removed_steps`, `contact_step_notes`,
  `contact_step_skips`, `flow_fact_wishes`, `nudge_holds`; the four missing facts' columns; a seed
  with the three flows as the prototype has them.
- **Screens**: the flow panel and its rail (the marks, the paper marks, the day, the lapsed reason,
  the person waited on, the per-job caption's picker, the title by kind); the step card (as a card
  at a desk, a sheet on a phone); Settings → Flows (the editor, the fact picker, the who-moves
  preview, History, How it is going); Trade partners (By step, By company, Asks) and the same two
  on Customers, plus *By trade* (one row per trade, v1.172); By step on the six pieces (the tiles
  with a dot per company, empty steps folded, chips grouped by job, days against the step's usual,
  a press per row that is the step's own nudge, the job and the seat as pickers; v1.173–v1.174); a
  round pill's window (a change order with its facts, whether the customer opened it, the paper and
  Ask again; a pay application with what it covers and its certificate; v1.168); the job page's
  *Papers on this job* as a grid with the counts in the title and the strip before the job's day,
  List behind a tab (v1.176); *See their page* with the globe under the panel and on the card
  (v1.167); the Messages list's *by step* chip; Follow up's *Nudges from the flow*; the Attach
  picker's starred rows for a step.
- **The lanes as settled** (v1.157, v1.160): a customer's Once lane holds only the master agreement,
  which a one-job customer skips; the ask, the bid, the yes and the contract are per job; change
  orders sit in Per job apart under Warranty with no arrow into them (`aside` on the step), never
  named as what comes next.
- **Papers**: *Send it* and *Remind them* call the existing paper send; the sign page is the existing
  one with the consent kernel verbatim; the customer's contract and a change order go the same way
  (the contract's send exists as `gc_owner_contract_sends`).
- **A new paper from the editor** (v1.177): the prototype registers it in its own lists; on main a paper
  lives in the Contract library (`contract_template_documents`, a packet's copy per person in
  `person_contract_documents`), with a Form Studio template behind one that is filled or signed
  (`contract_form_templates`, `doc_type` of agreement, coi, w9, license or other), on the company's
  Documents through `src/lib/gc/companyPapers.ts`, and on the Settings → Contracts & terms index, which
  CI holds to the customer-surface registry. So the add is: a library document with its kind (upload,
  contract, notice), a form template for a contract with the clauses in both languages and a version, a
  `doc_type` beyond the five or `other` with a name, a fact in `flows/facts.ts` that reads the document
  row (on file, current, signed, sent), a column on the job's grid, and a line on the index. Nothing of
  this is a new table; it is the library and the flow agreeing on one id. The window asks the kind
  first: an upload (a name, a date it runs out), a contract (between whom, who signs and the order,
  the fields it draws from the job, the clauses in both languages, the consent fixed, Preview the sign
  page, draft or published v1) or a notice (subject, the words in both languages, what rides with it).
  A contract has a version and never a date; an upload has a date and never clauses.
- **A change order from a message** (asked 2026-10-12, not drawn): a *Start a change order* press on
  a customer's message, the job from the message's tie, the message kept on the order and a *became
  CO 2* chip on the message; the order gains who signs, where it came from, a sketch from the job's
  files and a send record like the contract's (sent, the link, opened, signed, the name, the
  signature, the consent). Draft by anyone, send by the money team. Its own PR after cut 4.

### Cut 4c · Contracts from clauses (after cut 4; `MESSAGES_PLAN.md` → *Contracts from clauses*)

- **Kernels**: `contracts/assemble.ts` (the base plus the trade's exhibit for a company on a job, the fields
  filled, the version), `contracts/approval.ts` (who may publish, what a proposal is, the Needs you row).
- **SQL**: `contract_clauses` (`paper_id`, `order`, `text_en`, `text_es`, `scope` = all or a trade, `version`,
  `published_by`, `published_at`), `contract_clause_proposals` (`clause_id` or null for new, the words, the
  scope, `by`, `why`, `state`, `decided_by`, `decided_at`, `decline_why`), a `clause_versions` column on the
  signed copy in `person_contract_documents` and `gc_owner_contract_sends`. The Contract library's document
  becomes the paper the clauses hang on; Form Studio's template is the frame around them.
- **Edge**: the approvers' push and email on a proposal (`messages-notify`), the editor's text on a decision.
- **Screens**: Settings → Contracts and clauses; the Needs you rows; the sign page's version and exhibit line;
  the builder's scope per clause and preview per trade.
- **Access**: edit by any office role; approve and publish by controller and dev (`ACCESS_CONTROL.md`).
- **The bridge until then**: one master agreement document per trade in the library's packets.

### Cut 5 · Calls and texts: the Quo link

- **Edge**: `quo-webhook` (`message.received`, `call.completed`, `call.missed`,
  `call.voicemail.completed`, `call.recording.completed`, `call.transcript.completed`,
  `call.summary.completed`; checked as Quo's; matched by `contact_for_channel`; threaded; tied to the
  default job; a number nobody knows makes an unknown contact and a *Who is this?* row), `quo-send`
  (a text from the company number, with the opt-out line when `compose.ts` says so, refusing an opted-out
  number), the HELP, INFO, REVOKE and OPT OUT answers (Quo answers STOP itself and the app mirrors the opt-out), the signature check on every event and a 28-hour memory of webhook ids for Quo's retries. `docs/EDGE_FUNCTIONS.md` sections for each.
- **Settings → Phone and texts** becomes live: the connection, the seats, who gets a new message.
- **The nudge the app sends** (`flow_steps.nudge_send = 'app'`): a scheduled function that reads
  `flows/nudges.ts` each morning and sends through `quo-send`, writing `nudge_sent`; off for every
  step until the owner turns it on.
- **Decision taken here**: whether the app may send a nudge itself (section 7).

### Cut 6 · Email in: the bids@ reader and the files that arrive

- **Edge**: `gmail-sync` on a Google grant to the bids@ account (push or a short poll): every email
  into `messages` by `gmail_id`, the sender matched by address, the thread by the sender; a small
  attachment copied into the private `message-attachments` bucket; a link kept as a link; a file
  that is a step's paper (a signed W-9, a certificate) read as that paper and filed on the company's
  Documents when sure, else offered in the thread as *File this as their certificate*. The subject
  or title block that names a job ties the email to it.
- **A forwarded copy** as the fallback for mail that lands in a person's own inbox: the same reader
  on a forward to bids@.
- **Screens**: the message window's attachments (Open, Save to Drive, *a link, not a file*, *our copy
  kept on arrival*); the thread's chips.
- **Decisions taken here**: the Google grant on bids@; whether the agent files on its own when sure;
  how long an email's copy of a file stays in our bucket (section 7).

### Cut 7 · Files going out: Documents' one list and the Drive handler

- **Kernels**: `documents/jobFiles.ts` (the one list of a job's files: the papers the app makes,
  the Drive folder's Plans and Team only halves, `gc_trade_files`, the sent copies, the files that
  arrived on messages, each tagged with where it lives and its portal page), `documents/outgoing.ts`
  (by size and kind: the file, our link, the picture on an email only since Quo sends no picture messages; a plan set always a link; a file from this
  computer into Team only first).
- **Edge**: `drive-link` (the app's own link to a Drive file: a signed file link or the portal
  page; forwards to the file; counts who opened it; can be cut off).
- **Screens**: the Attach picker (the job's files, this computer, a photo); the send window's file
  notes; the sent copy keeping its files (`sent_documents` + `message_attachments`).

### Cut 8 · Their own view: the portal's first page

- **Kernels**: `flows/portalPage.ts` (the same list read from their side: their-move steps as the
  only buttons with why in a sentence, the one we are on as *We are on it* with what to expect, the unreached ones as *Later* with when they come, a done step's day,
  one section per job, nothing of ours; the step names in both languages).
- **Edge**: `gc-trade-portal` gains the page's read; the uploads there already finish the steps.
- **Screens**: the portal's first page, EN and ES; *See their page* from the panel, the card and ⋯.
- **The customer's page**: shape B, a home and four tabs (`customer-portal-mockups.html`, the prototype
  v1.162, `MESSAGES_PLAN.md` → *The customer's portal*): Your move, Where you are, This week, Your people; Money,
  Schedule, Papers, Messages; EN and ES. Kernels `flows/customerMove.ts` (the first thing we need from them in
  the flow's order), `portal/moneyLines.ts` (contract, signed changes, pay applications → six lines),
  `portal/papers.ts` (signed, waiting, comes later). Edge: `customer-portal` gains the five reads and a write
  that lands a `portal` message in the thread; a view per paper in `public_page_views` keyed by the paper.
  Screens: the page; the thread header's portal pill, the step card's So far line, Needs you's two portal rows,
  By company's Portal column. Field: one customer line and a photo mark on the daily log; the Friday roll-up.
  The Money tab as picked (v1.163, `money-tab-mockups.html`): the win first (*34% built*, paid of revised, *paid
  on time* only when true, the sum is the contract plus the signed changes), one card per pay application with
  what it covers, its photos, the certificate, the waivers and the day the trades were paid, *After that* as a
  range from the schedule of values, History folded as the money timeline, the six-line statement folded;
  kernel `portal/moneyStory.ts` beside `moneyLines.ts`. The office side of the window (v1.164): Edit mode
  tags every card with the page that feeds it and takes you there; *Ready for Priya?* is one row per piece
  (something to do, this week's line fresh, photos marked, every application with its covers sentence, the
  next one sized, every schedule move with its why, people to call, both languages) with a fix link, kernel
  `portal/readiness.ts`; Settings → Customer page holds every sentence of ours in EN and ES and the switches
  per job. The list's words (v1.165): the step we are on reads *We are on it* with what to expect, the unreached
  ones *Later* with when they come, each step's when-line on the flow in both languages.

### Cut 9 · Bill day: From the trades, and the superintendent's walk

- **Kernels**: `billDay/trades.ts` (the cascade's days from the 25th and the cut-off setting; the
  seven gates read from the draws, the waivers, the change orders and last period's certificate; the
  groups; Expected from `billingForecast.ts`; the total line), `billDay/lines.ts` (claimed, we see,
  the schedule, this draw's money at what we see, the held-out change order, retainage),
  `billDay/walk.ts` (the claims to check in walking order by where a line is, the photo-or-note
  rule, when the checked gate clears), `billDay/asks.ts` (the one-press ask, each its own text; the
  send-back note written from the walk).
- **SQL**: `superintendent_checks`, `bill_day_nothing`, `app_settings.bill_day_cutoff_days`,
  `gc_sow_lines.where_on_site`.
- **Screens**: Money → Bill day → *From the trades* beside the existing *To the owner* and
  *Forecast*; the project card's *Bill day · 3 of 7* pill; the access points (the pay application
  card's round line, Follow up's section head, the job page's line, the Draws row on Trade partners,
  the trade's portal naming the period); the daily log's *Claims to check* on the checking days for
  the superintendent assigned to the job; the text she gets on the first checking day and *Ask Wendi
  to walk it*. Approve and Send back stay the Draws window's own.
- **The top of the page** (v1.169–v1.171, `bill-day-summary-mockups.html`): the money river, one bar
  of the draws by state in dollars flowing into the owner's number, the legend as columns in the bar's
  order, the dates under it evenly spaced with today marked; beside it the 3 of 7 ring and *Today*, the
  first three open gates with their own presses; the calendar cards and the gate list fold; *See their
  page* under every trade's name; kernel `billDay/summary.ts`.
- **Access**: amounts for the money team only (as the Draws window is gated); the superintendent's
  paths show percents and photos, never a dollar.

### Cut 10 · The phone, the Pipeline's Job activity, photos

- The thread and Follow up at 375 px (the folded header, the rail's sheet, the by-step rows);
  press-and-hold in place of drag.
- Calls, texts and emails mixed into the Pipeline's Job activity (team-only rows yellow).
- Photos saved on arrival to the job's photos; the file agent copying and naming.

## 5. The kernels, listed

`contacts/kernel.ts` · `messages/thread.ts` · `messages/stamps.ts` · `messages/compose.ts` ·
`messages/owed.ts` · `messages/promises.ts` · `followUp/queue.ts` · `quickReplies/kernel.ts` ·
`flows/facts.ts` · `flows/state.ts` · `flows/card.ts` · `flows/nudges.ts` · `flows/board.ts` ·
`flows/going.ts` · `flows/portalPage.ts` · `flows/customerMove.ts` · `flows/jobPapers.ts` (the grid's cell
states, the counts, the strip before the job's day) · `portal/moneyLines.ts` · `portal/moneyStory.ts` ·
`portal/papers.ts` · `portal/readiness.ts` · `documents/jobFiles.ts` · `documents/outgoing.ts` ·
`billDay/trades.ts` · `billDay/summary.ts` · `billDay/lines.ts` · `billDay/walk.ts` · `billDay/asks.ts`.

Each ships with its unit test, and each screen with a render smoke (`*.render.test.tsx`). The
prototype's functions are the first draft of each kernel; lift the words, not the DOM.

## 6. The edge functions, listed

`quo-webhook` · `quo-send` · `gmail-sync` · `drive-link` · `messages-nudge-dispatch` (the app's
reminders, each morning) · `bill-day-ask` (the one-press asks and the superintendent's text).
`gc-trade-portal` gains the page read. Each gets its `docs/EDGE_FUNCTIONS.md` section and TOC line,
and is deployed by hand after merge (`supabase functions deploy`).

## 7. Decisions still the owner's

Each is taken in the cut that needs it; none blocks cut 1 through 4 except the first.

1. **Which record a contact is** (cut 1): a view over the people the app has, pointing at one of
   them. Lean: yes, and *Who is this?* re-points.
2. **A person on two flows** (cut 4): one contact with two flows as tabs, or two contacts. Lean: one
   contact, two tabs.
3. **Whether the app may send a nudge itself** (cut 5): per step, off until turned on.
4. **The Google grant on bids@** (cut 6): the app reads the whole box.
5. **Whether the file agent files papers on its own when sure** (cut 6), or always offers.
6. **How long an email's copy of a file stays** once it is in Drive (cut 6). Lean: keep it.
7. **The cut-off** as a setting or fixed days before bill day (cut 9). Lean: a setting, one for
   every job.
8. **Whether a superintendent's tap that matches the claim approves the line** (cut 9). Lean: no;
   the walk informs, the office approves.
9. ~~Whether the customer's portal gets the page~~ Taken 2026-10-11: shape B, with the Money tab as
   picked (cut 8). Still open there: whether Accept the work and the warranty year sit on Home or
   Papers; whether the architect sees the page or a cousin; whether photos are opt-in per job.
10. Yearly or monthly Quo billing; Claude from the first day or later (`MESSAGES_PLAN.md`).
11. **Who may start a change order from a message** (after cut 4): the money team only, or draft by
    anyone and send by the money team. Lean: the split.
13. ~~Who edits clauses~~ Taken 2026-10-12: anyone in the office edits, a controller or a dev approves,
    with a push and an email; the exhibits live on both the master agreement and the statement of work.
12. **Over usual on the boards**: a watch in orange, never a call and never in Follow up's count
    (taken in the prototype, v1.174); the usuals themselves are the flow's to tune.

## 8. What is left out, on purpose

The prototype's demo-only presses (*They text back*, *their upload arrives*, *sign (demo)*, the ten
companies with no thread), the Board's ring reading the flows (its own cut, later), round robin or
load balancing on who gets a message, a second contact per role, a files@ address, a Flows tab of
its own, and any screen that writes a draw outside the Draws window.

## 9. The order, and where to start

The cuts are in the order their data needs; the value lands earlier than the numbering says, because
main already holds most of the facts. The first useful day for the office is the end of cut 2: one
thread per person over what the app already sends, Follow up as one queue, and whose move. Cut 4 is
the big one and the one the prototype spent the most on; it is also the one with no outside
dependency, so it can run beside cuts 5 and 6, which wait on Quo and on the Google grant.

| Order | Cut | Waits on | Rough size | What the office gets at its end |
|---|---|---|---|---|
| 1 | 1 · the spine | decision 1 | 2 weeks | the people, their jobs, every sent email in one thread per person |
| 2 | 2 · Follow up | cut 1 | 1 week | one queue, whose move, what we owe, notes that come back |
| 3 | 3 · replying | cut 1 | 1 week | the box, quick replies, the send window (texts wait on 5) |
| 4 | 4 · the flow suite | cut 1 | 4 weeks | the flows, the cards, the boards, the papers, the job's grid, the editor with new papers |
| 4b | the change order from a message | cut 4 | 1 week | decision 11 |
| 5 | 5 · Quo | the Quo account | 2 weeks, beside 4 | calls and texts in the thread, the app's nudges off by default |
| 6 | 6 · bids@ | the Google grant | 2 weeks, beside 4 | email in, the files that arrive |
| 7 | 7 · files out | cut 6 | 1 week | one list of a job's files, our link |
| 8 | 8 · the portals | cut 4 | 3 weeks | the trade's first page; the customer's home and four tabs; Edit mode and the readiness list |
| 9 | 9 · Bill day | cut 4, the Draws window | 3 weeks | From the trades with the river and today's three things; the walk |
| 10 | 10 · the phone and the rest | 8, 9 | 1 week | the phone layouts, Job activity, photos |

Sizes are one builder's weeks with helpers on the screens; the kernels come first in every cut and
can be lifted from the prototype's functions by name (`MESSAGES_PLAN.md` → *Prototype log* names the
version each one landed in). Three things to settle before cut 1 starts: decision 1 (which record a
contact is); whether the prototype's demo people become the seed (no: the seed reads the people the
app has); and which helper sessions take which screens (the ledger in `docs/SESSIONS.md`).

## 10. How a cut is done

A cut is done when: its kernels and tests are on `main`; its migrations are pushed with
`supabase db push` and verified read-only on prod; its edge functions are deployed and
`npm run check:edge-drift` is clean; its screens pass the render smokes and the deploy checks;
its help guide passes the plain-words test; its release note and fragment are in; `APP_DIRECTORY.md`,
`PROJECT_DOCUMENTATION.md`, `GLOSSARY.md` and `ACCESS_CONTROL.md` say what changed; and the owner
has pressed on it on prod with a test row that matches nothing real.

## 11. Wave 2 status, the lead's ledger (2026-10-13, 05:00 UTC; amended 09:00 UTC; the clock in this section is GitHub's where a PR is named, else the lead's estimate)

*The lead is the session "GC MODE" on the owner's Mac since 2026-10-13 04:40 UTC, after "GC Review" (the first wave 2 lead, with "GC Reviews helper 1" to "9") went quiet about 03:00 UTC and left no hand-off. The residential customer-communication build (`RESIDENTIAL_BUILD_PLAN.md`, `HANDOFF_RESIDENTIAL_2026-10-13.md`) runs beside this one under the session "cc"; the two leads agreed that cc's #5560 goes second on `src/lib/flows/load.ts`, and that each takes its own one-line resolve on `docs/ACCESS_CONTROL.md` near the Messages cut 1 bullet and on the Glossary's thread entry. Amend this section as the state moves; it is the hand-off.*

**Merged**: wave 1's nine kernel clusters and about sixty wave 2 PRs, cut 1 through cut 9 (the spine and the thread window, Follow up's data and Settings → Phone and texts, the quick replies tables, the flow tables and the first flow screens, contracts from clauses through cluster 9 PR 2, the change order from a message, the Quo tables and seats, the bids@ reader and its switch, the Drive links table, the customer page's database and words, all five Bill day screens).

**In the queue or armed**: #5478 (cut 2 PR B, the Follow up tab; queue position 30 at 04:45 UTC), #5497 (cut 3 R1, the reply box; rebased onto main and squashed to one commit, armed 04:44 UTC, enters the queue on green), #5522 (cut 10 SQL, re-stamped 20261014011000, armed about 04:55 UTC by helper 7) and #5460 (the boards' read, armed about 05:05 UTC by helper 3; `loadFlowDef` now caches main's `readFlowDef` instead of a second `flow_steps` select). A queue group that fails on `QuoSeatsSettingsSection.render.test.tsx` › *lets the owner add a seat* is the flake #5599 fixes; re-arm it, do not debug it.

**Open, by chain and owner** (each helper rebases the previous helpers' PRs onto their parents, keeps a child a draft until its parent is on main, then retargets it to main, marks it ready and arms it; anything new starts with a five-line prepare note and the lead's go):

| Helper | Chain | PRs, in order |
|---|---|---|
| 1 | cut 3 screens | #5500 (R2; the lit pill, the pill's count and the prototype's words restored in review) → #5502 (R3, ready only after C2 #5600 and after helper 5's texting switch, which it rebases onto) → #5515 (R4); each body carries a *Changed from the prototype* section. Then the **Edit quick replies window** #5609 (cut 3's last screen, a draft on R2, v2.5439; the residential R3's Phone tab and Spanish box stack on it as cc's helper 10's draft; prototype as-is: the strip's Edit press returns, Find a reply gets *Edit quick replies*, R2's add window becomes the editor's add row; tabs from `editorTabs` so the residential R3's Phone tab and Spanish box join as one more tab and fields under the line; what main's tables cannot hold yet is listed in its body). Then `scripts/check-css-tokens.mjs` (a CI check for a `var(--name)` no CSS defines: main has 38 such names at 289 sites; the sweep fixes 37 by a mapping table with `--fix`, fixes `--text`'s 9 non-color sites, and leaves its 151 `color:` sites on a pending list for a second sweep after a daylight screenshot pass; it amends CLAUDE.md's theme bullet with one clause; mechanical, merges alone) |
| 2 | cut 2 screens | #5489 (C1, on #5478) → #5600 (C2, draft) → the `gcNeedsYou` / `phraseFor` drop (prepared; the spike side comes as `spike/h2-needsyou-bodies`, which the lead merges first) |
| 3 | cut 4 boards (cluster 6) | #5460 armed → #5463 → #5465 → #5466 → #5468 (the add/add on `flows/load.ts` was only the stale wave 2 base; replaying each child's own commit leaves main's file alone, so cc's #5560 does not wait). Rulings about 05:05 UTC: the boards use main's `billDayHref` and write `?view=`; a row's press opens the company's or customer's window on its **Flow** tab through `findFlowContactId`, the step's own nudge stays the row's button (in B); E fixes the `GcJobPapersWindow` border warning. |
| 4 | cut 4 editor | **#5479 merged 08:1x UTC, 20261013140000 pushed 08:2x UTC (include-all: cc's 220000 and 230000 were already applied)** → #5484 (ready, queued 36 at 08:30 UTC; `get-job-contract` redeploy after it) → #5487 → #5476 → #5498 (waits on #5460, queued) |
| 5 | cut 5 Quo | #5452 (quo-send, quo-webhook; under review) → #5523; then the texting switch (an `app_settings` key read by quo-send and by the client in place of `TEXTS_ON`). Helpers 4, 5 and 6 dropped about 05:25 UTC under parallel full typechecks and were back by 05:45 with nothing lost. #5452 is queued (35); #5523 follows it. The texting switch PR (v2.5440, migration 20261014030000) is built on a local base of #5452 + #5497 + #5523 and cuts from main once those land: `app_settings.messages_texts_on_v1` seeded `'false'` with a master-or-dev policy; the gate lives in `_shared/quoLines.ts`'s `sendText` (503 `textsOff`), so quo-send and the morning run inherit it; HELP answers and the one STOP confirmation stay outside the switch (carrier rules); `TEXTS_ON` in `replyIo.ts` becomes a read; a Settings → Phone and texts card for the owner and devs; it lands before helper 1's R3, which rebases onto it. **quo-send's edits land in this order**: #5452 → #5523 → the switch → cc's tech path for Job Mode (their helper 6: `messages_tech_team()` + `messages_tech_can_read`, the phone picked server-side, the job tie required, `quick_reply_id` stamped, the reply hold written; needs #5590 on prod); I deploy quo-send after each. **#5452 and #5497 both read unmergeable at the queue's head on the generated catalog (08:40 UTC): both dequeued; #5497 rebased with the catalog regenerated, SendWindow's two undefined `--surface-muted` tokens mapped to `--bg-subtle`, re-armed 08:40, then rebased once more at 08:55 after #5526 touched `ThreadWindow.tsx` (both P1's `columnRef` and R1's `OpenThreadContext` provider kept; both new `sentLines` tests kept; the Glossary heading gains *· reply box*), tip 872d10985, so helper 1 restacks R2 to the editor onto it; #5452 waits dequeued until #5497 is on main, then helper 5 rebases it the same way (serial, never stacked, so a kicked group cannot carry the other's work).** The two also conflict in four files (the dev-mcp catalog, `customerJourneys.ts`, `customerSurfaceRegistry.ts`, `journeys/personJourney.ts`: regenerate the catalog, keep both sides elsewhere); whichever the queue lands second, its owner rebases. |
| 6 | cut 8 customer page | #5469 (migration 20261014000000, a seed) → #5492 → #5496 → #5501. The children failed only on stale pre-rebase copies of v2.5263 and v2.5303; replaying each child's own commit clears the bed-registry conflicts too. Rulings about 05:10 UTC on #5469 before the children rebase: `payAppOf` reads paid against the bill's own amount (a short-certified application paid in full read *Due* forever), with a test; *Your people* shows name and role only, the phone is the office line's (a personal `users.phone` never goes on a public page by default; the owner may add one later); the daily-log read is one per job if small. 8e needs no migration (`messages_channel_known` already allows `portal`). |
| 7 | cut 10 | #5522 armed (migration 20261014011000, two indexes, no table, no fences) → #5524 and #5526 **merged 08:3x and 08:5x UTC**; #5527 (P2) ready and armed 08:55 → #5528 → #5531 in turn; #5532 (J2) rebased onto main, a draft until 20261014011000 is on prod |
| 8 | cuts 6 and 7 | #5537 (armed), **#5552 merged 06:09 UTC and drive-link deployed 06:15 UTC (version 1)** → #5614 (the drive-link hardening, armed: inline types as attachment + nosniff, Drive's Content-Length cap, no second Save to Drive copy, pageToken encoded; a second drive-link deploy after it) → #5606 (7c, ready and armed 06:25 UTC) → 7e after R1; 7d is helper 1's: the /f/<link> page #5618 (v2.5447, armed and queued 07:10 UTC; a trade-journey step `gc-file-link` in the registry; "From Click Construction." without the job or a number until the door's answer carries `job` and `lang`) and the office half on /files/:source/:id after #5537; the 7c/7d work #5552's body claimed exists only on the previous helper's machine |
| 9 | cut 4 small | #5525, #5521, #5517 **merged 08:3x UTC**; then `messages-nudge-dispatch`: A #5605 (the run's inputs kernel, armed; the per-step switch is `{"<kind>": {"<stepId>": true}}`, nested because step ids repeat across flows), B #5607 (armed; migration 20261014012000 seeds `messages_nudge_app_sends_v1` and `messages_nudge_last_run_v1`, the run's morning summary the owner can read), C the function (built locally; the 9 AM Central gate on two UTC crons, `?dry=1`, customers whose read-back the service role cannot read go to *unread* and are never texted; waits on #5452 deployed), D the cron.schedule in its own migration, opened only after C is deployed |

**Pace at 09:00 UTC**: 81 wave 2 PRs merged, the queue at 29 with #5460 at its head, nine merges an hour over the last three; the board projects the open PRs landed tonight (Tuesday) and everything by Wednesday morning at the day's average.

**Rules added in flight**: a push hold on draft and child PRs from 05:55 UTC while the runner backlog (71 queued runs) drained, armed PRs and real fixes excepted, lifted 06:45 UTC after the queue's four head groups landed at 06:41 (pushes paced, one PR at a time); the overnight watcher session raised the ruleset's merge-queue check timeout from 30 to 90 minutes with the owner's approval; helpers run only the narrow typecheck locally and leave the full `tsc -b` to CI (the Mac killed six to eight parallel full builds, exit 144); nobody rewrites a PR in the other lead's lane without a word (#5497 was force-pushed at 04:58 UTC by the other build). The CI concurrency rule is #5604 (v2.5432), armed with the owner's approval. The board the owner reads is the artifact *Messages Wave 2 Board*, regenerated hourly from GitHub by the lead session.

**The lead's own list**: push each migration with `supabase db push` as its PR merges, in stamp order across both builds (140000 before the residential 170000 to 230000, then 20261014000000, 011000, 012000, 030000 and the residential 002000 to 004000; pushed so far: 120000 and 150000 (the Docsmit side), 220000 and 230000 (cc, 08:14 UTC), 140000 (the lead, 08:2x UTC); drift 891/891; `scripts/db-push.sh` takes the out-of-order case itself and regenerates the types and the catalog); deploy `messages-email` + `dev-mcp` after #5497, `get-job-contract` after #5484, `quo-webhook` + `dev-mcp` after #5452 (expect Quo's 27-hour retry burst of the last day's calls and texts to land in threads, and 0206400 refusals until the A2P registration is approved), `quo-webhook` again after #5523, `quo-send` + `quo-webhook` after the switch PR, `drive-link` done 06:15 UTC after #5552, again after its hardening, `customer-portal` after #5469 and after #5501 (+ `submit-portal-request`), `messages-nudge-dispatch` after C and then D's cron; fold the helpers' held Glossary clauses into the Messages entry once; fold every prepare-note correction into the cut it belongs to above.
