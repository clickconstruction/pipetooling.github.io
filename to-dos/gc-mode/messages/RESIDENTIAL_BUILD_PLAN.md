# Residential customers in Messages — the build plan

*Written 2026-10-13 from `customer-messages-prototype.html` v0.8, `customer-messages-integrations-mockups.html` v0.2 and the owner's decisions in `MESSAGES_PLAN.md` → *Residential customers and the Messages page*. It sits beside `BUILD_PLAN.md` (the GC Messages build) and uses its words: a cut is a slice with its kernels first, one PR per change, the spike never merges, the lead merges.*

## 1. What we are building, in one paragraph

The same spine for the plumbing company's own customers. A residential customer is already a contact (cut 1 points at `customers` and `customer_contact_persons`), so the work is not a second Messages. It is: the person's thread opened from everywhere a customer appears, with the job's activity in it behind a switch; the job activity panel showing the customer's lines through their tie; **Text** and **Email** beside **Note** in the job window with the quick replies strip; a **Message the customer** press on Job Mode with the lines the office marked for the phone and nothing to type; a residential flow read from facts the app already keeps; **Messages** in the header for the office with a **New** lane that sorts what came in; two boxes and two numbers behind one inbox; seven kinds of contact; and the sixteen integrations the owner picked. Orange means the customer saw it or did it.

## 2. What exists and is reused, never rebuilt

| On main today | Where | Used for |
|---|---|---|
| The spine: `contacts`, `contact_channels`, `contact_jobs`, `messages`, `name_contact`, `tie_message` | `20261012010000_messages_spine.sql`, `src/lib/contacts/`, `src/lib/messages/` | every residential line; Who is this?; the tie |
| The reply box, the opt-out line, the count | `src/lib/messages/compose.ts` | the job window's Text and Email, the phone's send |
| Quick replies: kinds, steps, mine/team, versions, Removed, Find, guess | `src/lib/quickReplies/kernel.ts` | the strip and the editor; the phone's lines are rows of it |
| Follow up's queue, one row per person, Open · Snoozed · Done, who has it | `src/lib/followUp/queue.ts` | the Messages page; the New lane is a fourth section |
| Flows read from facts, `readFlow`, the step card, the nudges, the morning run | `src/lib/flows/` | the residential flow; the strip above the box; the stage sends |
| Quo in and out, the webhook's signature | `src/lib/quo/` | the office line; the second number |
| The portal's words, Your move, Where you are | `src/lib/portal/pageWords.ts`, `src/lib/flows/portalPage.ts` | the residential portal page |
| The job activity feed and its event registry | `src/components/JobThreadNotesPanel.tsx`, `src/components/jobs/JobActivityView.tsx`, `src/lib/jobActivityEvent.ts` | **the one row model**: five kinds added to the registry |
| Job Mode | `src/components/jobMode/`, `DashboardJobModeCard.tsx` | the press and the sheet |
| Needs you | `src/lib/dashboardNeedsYou.ts` | the Customers line |
| The access teams and the doors | `src/lib/gc/access.ts`, `src/lib/gc/doors.ts` | the tech's door, the kinds' doors |
| The notify functions, Resend senders, `sent_documents` | `supabase/functions/notify-*`, `send-*`, `docs/SENT_COPIES.md` | push; the app's emails as lines |

Wave 2 of the GC plan lands the screens these stand on: cut 1's thread window, cut 2's Follow up screens, cut 3's quick replies SQL and editor, cut 4's flow tables, cut 5's `quo-webhook` and `quo-send`, cut 6's reader. This plan does not count those PRs; section 8 says which of them each cut waits on.

## 3. The data

New, in order of appearance. Every migration starts `SET lock_timeout = '3s';`, is idempotent, and ends with the three fence calls when it creates a table (`CLAUDE.md`).

| Cut | Change | Why |
|---|---|---|
| R0 | `contacts_kind_known` widened to `lead`, `supply_house`, `candidate`, `sub`; three id columns beside the five, `prospect_id` (a lead is a `prospects` row), `supply_house_id`, `team_prospect_id` (a candidate is a `team_prospects` row, Prospects → Team); a sub is a `people` row with `kind = 'sub'` through the `people_id` that exists; `contact_for_record` reads the three new tables (helper 2's read of main, 2026-10-13) | seven kinds of contact, one change |
| R0 | `contacts_kind_door` policies: supply house and candidate rows readable by the office, never counted by `followup_queue` | off Follow up by default |
| R1 | none | the registry is code; the job panel reads `messages` by `job_id` |
| R3 | `quick_replies.text_es`, `quick_replies.phone_order` (null = not on the phone), `quick_replies.phone_name`; `quick_reply_versions.kind` gains `es` | blanks are text; the phone mark; Spanish |
| R4 | `flow_steps` seed rows for `residential` (eleven steps); no new fact columns | the flow reads dispatch, clock, reports, estimates, status, invoices, payments as they are |
| R5 | `messages_tech_can_read(contact_id)` and the `messages_tech_read` / `contacts_tech_read` policies: a tech reads contacts on jobs they are dispatched to or clocked on, this week and last, and never a row whose kind is `billing` or whose `direction` is `team` with `office_only` | the tech's door |
| R5 | `contacts.has_until` (timestamptz) beside `has_user_id` | the tech has it until 5 PM, then the office |
| R5 | `app_settings.messages_office_wait_minutes` (15) | push to the office after a wait |
| R6 | `messages.mailbox` (`bids` · `team`), `contact_channels.from_number_id` per kind | two boxes, two numbers, the reply from the box they wrote to |
| R8 · 16 | `customers.language` (`en` · `es`) | read by every contact of theirs |
| R8 · 8 | `estimate_lines.source_message_id` and an `estimate_add_on_from_message` RPC | the add-on from a message |
| R8 · 3 | `dispatch_move_reason` on the board's move RPC | a Running late press moves the board with a reason |
| R8 · 12 | the sub sheet's facts as stamps: `people_labor_jobs.asked_at`, `said_yes_at`, `on_site_at`, `done_at`; `paid` from the sheet's payments | the sub flow |

## 4. The build, in order

Each cut lists its PRs. A PR is one change, kernel and test first, screens in their own PR, docs and the help guide in the PR that ships the flow.

### R0 · Seven kinds of contact (3 PRs)

- **Kernels**: `contacts/kernel.ts` — `ContactKind` gains `lead`, `supply_house`, `candidate`, `sub`; `ContactRecord` points at `prospects` for a lead, `supply_houses`, `team_prospects` for a candidate, and `people` with `kind = 'sub'` for a sub (`kindOf(record, rosterKind)`); `KIND_WORD`; `followUp/queue.ts` leaves supply houses and candidates out of every section; `quickReplies/kernel.ts` — `QuickReplyFor` follows; `flows/facts.ts` — `FlowKind` gains `residential` and `sub` with no steps yet. One PR.
- **SQL**: `contacts_kind_known` widened, the three id columns, `contact_for_record` extended, the two policies. One PR, pushed by the lead. `flows_kind_known` is R4's SQL, not this one, so `FLOW_KINDS` in `flowsSql.test.ts` stays at four until then while the `FlowKind` type gains the two.
- **Loaders**: `contacts/load.ts` reads the four records' names, companies and addresses (a supply house by `supply_houses.email`). One PR.
- **Docs**: `ACCESS_CONTROL.md` → Messages cut 1's paragraph gains the kinds; `GLOSSARY.md` → Messages entry.

### R1 · One row model: the registry and the two panels (3 PRs)

- **Kernel**: `jobActivityEvent.ts` gains `message_text`, `message_email`, `message_call`, `message_voicemail`, `message_portal` with render meta (the customer orange, `bucket: 'customer'`, `direction` on the item) and `messagesToActivityItems(rows)`; `jobActivityFilter.ts` gains **Customer**. The orange becomes a registry color, never a rule in Messages. One PR.
- **The job activity panel**: `JobThreadNotesPanel` and `JobActivityView` read `messages` where `job_id` is the job, through `messagesToActivityItems`; the **Customer** chip with its count; the move line under the crew row (whose move, when they wrote, when we wrote) from `messages/thread.ts` → `courtOf` and the stamps. One PR with render smokes.
- **The thread's switch**: `messages/activityRows.ts` — `threadWithActivity(messages, activityItems, jobsTied, on)` merges the job's rows for the jobs the person's lines are tied to, in time order, plain; the **Job activity** switch on the thread header, kept in `localStorage`, on by default for the office and off on the tech's phone. One PR.
- **Docs**: `GLOSSARY.md` → Job activity ledger gains the five kinds; guide `read-a-customers-thread` (new).

### R2 · The thread everywhere (3 PRs)

*Waits on wave 2 cut 1 (the thread window).*

- **The route**: `/messages` in `App.tsx`, the header entry for the office team (`canOpenMessages` = `GC_OFFICE_TEAM` in `access.ts`), the page as cut 2's Follow up with the kind filters (Customers · Trade partners · Architects · Leads · Subs · one more pill for Supply houses and Candidates) and the thread window at its URL contract (`?thread=&at=`, v2.5287). One PR. `APP_DIRECTORY.md` gains `/messages`.
- **The job window's box**: **Note · Text · Email** kinds, the composer turning orange on a customer kind, the quick replies strip from cut 3's kernel, `send` through `quo-send` and the customer email sender; the **Customer** chip opens the person's thread at the line. One PR.
- **Openers**: a customer's name on Customers, Jobs and Estimates opens the thread; the Dashboard's Customers line (R8 · 14 is its count; the opener lands here). One PR.
- **Guides**: `text-a-customer-from-the-job` (new), `send-a-customer-an-email-from-the-job` (new).

### R3 · Quick replies, the four additions (3 PRs)

*Waits on wave 2 cut 3 (the quick replies tables and editor).*

- **Kernel**: `quickReplies/blanks.ts` — `BLANKS` (the fill table: `first`, `me`, `address`, `job`, `minutes`, `window`, `back day`, `back time`, `day`, `link`, `amount`), `fillLine(text, fills)` → `{ text, left }`, `blanksIn`; `quickReplies/kernel.ts` — `phoneLines(lines, stepId)` (the step's first, six at most, by `phoneOrder`), `shortName`, `stepsByFlow` (steps per flow, not per kind), `wordsFor(line, lang)`; a version kind `es`. One PR.
- **SQL**: the three columns and the version kind. One PR.
- **Screens**: the editor's chips, preview, Spanish box, phone tick and short name, the **Phone** tab with its order; the strip reading filled lines with unfillable blanks lit and Send refusing; the **no es** mark. One PR with smokes.
- **Guide**: `edit-the-quick-replies-for-the-phone` (new); `plainWords.ts` holds every line.

### R4 · The residential flow (4 PRs)

*Waits on wave 2 cut 4 (the flow tables).*

- **Facts and seed**: `flows/facts.ts` gains the residential facts (`booked` from dispatch's block, `on_way` from the step's text, `arrived` from the clock-in at the job, `found` from a status report, `estimate_sent`, `estimate_approved` from accept-estimate, `working`, `done` as Ready to Bill, `billed`, `paid`, `review_asked`); `flows/seed.ts` the eleven-step flow with its nudges off and its `owedWords`. One PR.
- **The loader**: `flows/load.ts` → `residentialStampsFor(rows)` from `schedule_blocks`, `clock_sessions`, reports, `estimates`, `job_status_events`, `jobs_ledger_invoices`, `jobs_ledger_payments`. One PR.
- **The strip above the box** (integration 5): `flows/card.ts` → `stepStrip(card)` folds the step card to one line of presses; **Approve for her** writes what the portal press writes with `how = 'office'` (accept-estimate takes it); **Move the day** opens dispatch; **Send it again**; **She declined**. One PR.
- **The stages the customer feels** (integration 15): the morning run's per-step switch on for scheduled, started, done, billed, paid; the Jobs board dot and hover from the queue by job. One PR.
- **Guide**: `see-where-a-customer-is-on-their-job` (new); `docs/GLOSSARY.md` → the residential flow under Messages.

### R5 · The tech's door and Job Mode (4 PRs)

*Waits on R2 and R3.*

- **SQL**: `messages_tech_can_read`, the two policies, `contacts.has_until`, the wait setting; `doors.ts` lists them; `access.ts` → `MESSAGES_TECH_TEAM` (`primary` and `helpers`, the field roles in `roleLabels.ts`; `subcontractor` stays out until R8 · 12) with `canMessageCustomersFromJobMode`; `access.test.ts` holds it to the policy. One PR, pushed by the lead.
- **Job Mode**: **Message the customer** on `DashboardJobModeCard` (a dot when a reply waits); the sheet with `phoneLines`, each by its short name and a hint from its blanks; the preview with the fill row for a blank the tech owns; **Something else** as a note to the office; the reply to the tech until 5 PM. One PR with smokes at 375 px.
- **Who answers**: `messages/hasRule.ts` — a reply goes to the tech who texted until `has_until`, then to the office; after hours the app answers once and the row waits on Needs a reply; the words in `plainWords`. One PR.
- **Push** (integration 13): `messages-notify` edge function on a new inbound row: the tech at once, the office after the wait, never a candidate's or supply house's line; `docs/EDGE_FUNCTIONS.md` section. One PR, deployed by the lead.
- **Guide**: `message-a-customer-from-job-mode` (new); `ACCESS_CONTROL.md` → the tech's door.

### R6 · Two boxes, two numbers, one inbox (3 PRs)

*Waits on wave 2 cut 5 and cut 6, and the owner's call on team@ against office@.*

- **SQL**: `messages.mailbox`, `contact_channels.from_number_id`. One PR.
- **The reader**: cut 6's `gmail-sync` takes two grants and stamps `mailbox`; the sender matched first, the box the first guess for an unknown sender; a reply goes from the box they wrote to, a new conversation from the box of their kind. One PR (edge, deployed by the lead).
- **Compose and sort**: `compose.ts` → `mailboxFor(kind)` and `fromNumberFor(kind)`; Who is this? orders its guesses by the box; the letterhead, the lien reply-to and the website terms read the chosen customer address. One PR.

### R7 · The New lane (3 PRs)

*Waits on R0 and wave 2 cut 2.*

- **Kernel**: `followUp/newLane.ts` — `newLane(contacts, messages, ties)` gives the rows with their sort: **Who is this?** (a sender nobody has named, the guesses ordered by box: the team line offers customers and leads, bids@ trade partners and supply houses, a candidate on either), **Which job?** (two or more active jobs and no tie; the default already took it), **Who has it?** (nobody on it; the rule's pick first); `queue.ts` counts the lane in the badge. One PR.
- **The lane and the sort card**: the lane on Follow up (mockup A), the sort card above the thread, each press writing through `name_contact`, `tie_message`, the has rule. One PR with smokes.
- **Sort all**: the desk (mockup C) behind the lane's header, one card at a time. One PR.
- **Guide**: `sort-new-messages` (new).

### R8 · The integrations (17 PRs)

In the order that each unblocks the next. Numbers are the mockups' card numbers.

| # | Integration | PRs | What each PR is |
|---|---|---|---|
| 14 | The Dashboard's Customers line | 1 | `dashboardNeedsYou.ts` key `customer-messages`: need a reply · we owe · to sort, opening `/messages?kind=customer` |
| 1 | The app's own emails in the thread | 1 | `messages/sentCopies.ts` reads `sent_documents` by contact into folded **the app** lines with read and paid stamps; `sent_documents.contact_id` set by every sender (cut 7) |
| 4 | Voicemails read | 1 | the transcript as the line; `messages/owed.ts` → `readDay` on it; **Keep the day** writes cut 2's day heard |
| 6 | They owe us on Follow up | 1 | `followUp/queue.ts` → `theyOweUs(bills)` from the AR page's reads; the bill's reminder as the step's quick reply, sent by the morning run at the terms |
| 2 | Reports and photos | 1 | the report as a source in `documents/jobFiles.ts`; **Attach from the report** on the send; a photo reply filed by cut 6 |
| 7 | The Lien desk's sends | 1 | a `legal` line kind from the desk's sent rows, read-only, the box off under it, the reply to the office alone |
| 8 | An add-on from a message | 2 | the RPC and the column (SQL); the ⋯ press through `changeOrders/fromMessage.ts` with the estimate's form |
| 3 | Dispatch writes back | 2 | `dispatch/whatSlides.ts` (the stops that move and by how much); the ask on the send, the move RPC with its reason, the dispatcher told |
| 9 | Leads on Prospects | 1 | Prospects shows the thread window on a lead's card; booking re-points the contact to the customer (the `name_contact` fold) |
| 10 | Supply houses to the RFQ | 1 | an email from a supply house ties to the open RFQ; the RFQ page reads its lines |
| 11 | Candidates to the hiring board | 1 | Who is this? hands the text to the board's thread; Messages keeps no row |
| 16 | Language on the customer | 1 | `customers.language` (SQL and the reads in one PR: the strip, the phone, the morning run through the contact) |
| 12 | Residential subs | 3 | the sheet's facts as stamps (SQL); the sub flow in `facts.ts` and `seed.ts` with its loader; the sub's lines on the sheet |

### R9 · The docs pass (1 PR)

The catch-up after the last cut lands: `PROJECT_DOCUMENTATION.md` (§6 Jobs gains the Customer chip and the box; §8 the Customers line; a new section for `/messages`), `GLOSSARY.md` → the Messages entry says residential, the seven kinds and the orange, `ACCESS_CONTROL.md`, `APP_DIRECTORY.md`, and a `RECENT_FEATURES` fragment per PR along the way as `CLAUDE.md` asks. Guides ship in their feature PRs, listed above; this PR only reconciles the maps.

## 5. The count

| Cut | PRs | Migrations | Edge functions |
|---|---|---|---|
| R0 · kinds | 3 | 1 | — |
| R1 · one row model | 3 | — | — |
| R2 · the thread everywhere | 3 | — | — |
| R3 · quick replies | 3 | 1 | — |
| R4 · the residential flow | 4 | — | — |
| R5 · the tech's door, Job Mode, push | 4 | 1 | 1 (`messages-notify`) |
| R6 · two boxes | 3 | 1 | 1 (`gmail-sync`, second grant) |
| R7 · the New lane | 3 | — | — |
| R8 · the integrations | 17 | 4 | — |
| R9 · the docs pass | 1 | — | — |
| **Residential, on top of wave 2** | **44** | **8** | **2** |
| Wave 2 pieces it stands on (cut 1 screens, cut 2 screens, cut 3 SQL and editor, cut 4 tables, cut 5 functions, cut 6 reader), already in `BUILD_PLAN.md` | ~18 | 4 | 3 |
| **Everything from today to done** | **~62** | **12** | **5** |

PR sizes follow wave 1's: a kernel PR is a day with its tests; a screens PR two to three with smokes; a SQL PR a day plus the bed and the push. Four helpers in parallel after R0 and R1 land, which are the floor everyone else builds on.

## 6. The order, and where to start

| Order | Cut | Waits on | Rough size | What the office gets at its end |
|---|---|---|---|---|
| 1 | R0 · kinds | nothing | 3 days | nothing visible; every later cut needs it |
| 2 | R1 · one row model | nothing | 1 week | the customer's lines in the job activity panel, the move line, the switch |
| 3 | R3 · quick replies | wave 2 cut 3 | 1 week | the strip with blanks, the phone's lines in the editor |
| 4 | R2 · the thread everywhere | wave 2 cut 1 | 1 week | **Messages** in the header; Text and Email in the job window |
| 5 | R5 · the tech's door, Job Mode | R2, R3 | 1.5 weeks | **the fix for the complaint**: a tech texts the customer from the job in two presses, and hears the reply |
| 6 | R4 · the residential flow | wave 2 cut 4 | 1.5 weeks | Where you are, the strip above the box, the stages that text |
| 7 | R7 · the New lane | R0, wave 2 cut 2 | 1 week | what came in, sorted in one press |
| 8 | R6 · two boxes | cuts 5 and 6, the owner's call | 1 week, beside 6 and 7 | team@ and bids@ in one inbox, two numbers |
| 9 | R8 · the integrations | each as listed | 4 weeks across helpers | the sixteen, in the table's order |
| 10 | R9 · docs | everything | 2 days | the maps say what shipped |

The first useful day is the end of R5: a tech can text the customer from Job Mode, the reply comes back to them, and the office sees it in the job window and on Messages. That is seven weeks of one lead with helpers on the screens, if wave 2's cut 1 and cut 3 land first. Everything after R5 is better days, not the first one.

## 7. Decisions still the owner's

From the prototype's screen 5, with the lean each cut builds to unless told otherwise:

1. **The tech's door** (R5): dispatched to or clocked on, this week and last; no money lines, no office-only notes.
2. **Free text for techs** (R5): quick replies only; **Something else** is a note to the office.
3. **Who edits the phone's lines** (R3): the office team.
4. **Who answers a reply** (R5): the tech until 5 PM, then the office; after hours the app answers once.
5. **team@ or office@** (R6): office@ is on the letterhead, the lien reply-to and the website terms today; whichever is chosen goes everywhere.
6. **Which reminders start on** (R4): the estimate and the bill; the review ask after ten real threads.
7. **The Job activity switch's default** (R1): on for the office, off on the phone.

## 8. How a cut is done

As `BUILD_PLAN.md` § 10: kernels and tests on `main`; migrations pushed with `supabase db push` and verified read-only on prod; edge functions deployed and `check:edge-drift` clean; screens past the render smokes and the deploy checks; the guide past the plain-words test; the release note and fragment in; the maps updated; and the owner has pressed on it on prod with a test row that matches nothing real. For R5 the press is the one that matters: a text from Job Mode to a test number the office holds, and the reply back on the phone.
