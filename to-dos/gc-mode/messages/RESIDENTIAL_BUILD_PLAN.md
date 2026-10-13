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
| R0 | `contacts_kind_known` widened to `lead`, `supply_house`, `candidate`, `sub`; four id columns beside the five, `prospect_id` (a lead is a `prospects` row), `supply_house_id` (the counter, no unique index: a second person named on it keeps their own contact), `supply_house_contact_id` (a rep, `supply_house_contacts`, unique like `gc_company_person_id`; `supply_houses.email` was retired 2026-09-08), `team_prospect_id` (a candidate is a `team_prospects` row, Prospects → Team); a sub is a `people` row with `kind = 'sub'` through the `people_id` that exists, and PR 2 backfills `contacts.kind = 'sub'` where `people.kind` is sub; the seeds `contacts_subs_from_roster()` and `contacts_from_supply_houses()` copy each record's phone and email into `contact_channels` (no `contact_for_record` exists on main or any branch; an earlier line here named one); `contact_display_name` and the keep-thread trigger read the four new tables, so a hard delete of a prospect, candidate, house or rep keeps the thread; a RESTRICTIVE read policy on `contacts`, `contact_channels` and `messages` keeps a candidate to a dev and the hiring board (the owner's yes, 2026-10-13); #5593 | seven kinds of contact, one change |
| R0 | `contacts_kind_door` policies: supply house and candidate rows readable by the office, never counted by `followup_queue` | off Follow up by default |
| R1 | none | the registry is code; the job panel reads `messages` by `job_id` |
| R3 | `quick_replies.text_es`, `quick_replies.phone_order` (null = not on the phone), `quick_replies.phone_name`; `quick_reply_versions.kind` gains `es`; `messages.quick_reply_id`, the line a sent text came from, so the flow's `on_way` and `review_asked` read a column instead of the words (helper 3's gap, 2026-10-13) | blanks are text; the phone mark; Spanish; which line a text was |
| R4 | in the facts and seed PR: `flows_kind_known` widened to `residential` and `sub`, the eleven facts in `flow_fact_ids()`, the two papers in `flow_paper_ids()`, the residential `flow_steps` seed rows (`flowsSql.test.ts` pins the seed to the newest migration, so the SQL cannot trail the code); no new fact columns: the loader reads `job_schedule_blocks`, `clock_sessions`, `reports`, `estimates` (`sent_at`; `status = 'customer_accepted'` with `acceptor_consented_at`), `job_status_events`, `jobs_ledger_invoices` (`billed_at`, else `sent_to_customer_at`; `pay_by` = that day plus `customers.payment_terms`), `jobs_ledger_payments`, and `messages` by words until `quick_reply_id` lands (helpers 1 and 3, 2026-10-13) | the flow reads what the app keeps |
| R5 | `messages_tech_team()` (primary, helpers; no function on main covers both) and `messages_tech_can_read(contact_id)` with the `messages_tech_read` / `contacts_tech_read` policies: a tech reads contacts on jobs they are dispatched to (`job_schedule_blocks.assignee_user_id`) or clocked on (`clock_sessions.user_id`), Monday of last week through Sunday of this week in Chicago, through `contact_jobs` and the customer's `jobs_ledger` rows; `messages.office_only boolean` so a team note can be kept from the field; billing stays the kernel's `noMoney` since no column on `messages` says billing; no read on `contact_channels` for a tech, since `quo-send` sends; stamp 20261013190000 (helper 8's prepare note, 2026-10-13) | the tech's door |
| R5 | `contacts.has_until` (timestamptz) beside `has_user_id` | the tech has it until 5 PM, then the office |
| R5 | `app_settings.messages_office_wait_minutes` (15); `app_settings.messages_office_hours_v1` as JSON `{"days":[1,2,3,4,5],"opens":"07:30","closes":"17:00","techUntil":"17:00","emergency":null}`, read by `parseOfficeHours` with the defaults as the fallback; `emergency` set adds one sentence to the after-hours answer naming the number (helper 5's prepare note, 2026-10-13) | push to the office after a wait; who answers, and when the office is closed |
| R6 | `messages.mailbox` (`team` · `bids`); `app_settings.messages_boxes_v1`, JSON `{team, bids}` of `{address, phone, numberId}`, where today one secret holds one number and `gmail_sync_state` one grant; `contact_channels.opted_out_by_box` jsonb keyed by box, since a carrier's STOP is per number pair and one `opted_out_at` cannot say which of our numbers it stopped (helper 7's prepare note, 2026-10-13); `contacts_fold` is recreated to call a definer `contact_channels_keep_stops(keep, gone)` before each delete, since the office user may update only `contact_id` on channels, the one exception to "no cut redefines contacts_fold" (#5598) | two boxes, two numbers, the reply from the box they wrote to; a STOP on one number leaves the other open |
| R8 · 16 | `customers.language` (`en` · `es`) | read by every contact of theirs |
| R8 · 8 | `messages.estimate_id`, the estimate a message started or joined (moved off `estimates.source_message_id` 2026-10-13, the owner's yes: many messages feed one draft, so the link sits on the message; no column grant, since PR 2 writes the draft and the link in one definer RPC as cut 4b's `gc_draft_change_order_from_message` does, refusing a message that already has an estimate; the job's open estimate is the newest draft a message tied to the same Pipeline job points at, since `estimates.job_ledger_id` is UNIQUE and means the job this estimate created, and a new draft takes `job_ledger_id` only while no estimate holds that job, so `autoCreateJobGuard` never mints a twin job from its signing; follow-ups: the customer's hand-made drafts offered as candidates by address, and a guard rule for the taken case (#5595, #5601); main keeps lines as `estimates.line_items_snapshot` JSON and has no estimate_lines table or save RPC; the Estimates page's write path takes the draft; helper 6's prepare note, 2026-10-13) | a line on an estimate from a message |
| R8 · 3 | one definer `running_late_move(p_moves, p_reason, p_job_line, p_note_title, p_note_summary)` performs `self_move_schedule_block` per row in one transaction, so a refusal moves nothing; one `running_late` job activity event on the moved job carries the reason, from, to and the slid ids (no reason column anywhere), and `self_move_schedule_block`, recreated from 20260813224521, skips its own thread note for the block the RPC names; the dispatcher's note is a `dispatch_requests` row the tech inserts (the baseline policy allows it, as QuickEstimateWizard does) with `pending_action = 'running_late'` and no button, and the existing `notify-dispatch-request` push tells the dispatcher; the board's day ends at 8:00 PM (`job_schedule_blocks_time_bounds` holds every block to 04:00–20:00), so a slide past it is refused in words (helper 6's prepare notes, 2026-10-13; #5602) | a Running late press moves the board with a reason |
| R8 · 12 | the sub flow's facts on main: asked = `step_commitments.offered_at`, said yes = `accepted_at`, declined = `declined_at` (the fork's way out), on site = the first portal `progress_at` (half), done = the stage past working (half, the day lost once it moves on), paid = `subLaborJobBalance` at zero dated by the newest payment (`paid_at` is never written); PR 2 adds `people_labor_jobs.on_site_at` and `done_at`, filled by one trigger on the sheet's existing writes, `done_at` backfilled from the activity events; on site counts only a real percent (`progress_pct > 0`, so a 0% or note-only report does not) and done never fills on site (the owner's calls, 2026-10-13); PR 1 ships the fact list and seed migration as #5568 did; a sub's job is the labor job, an order before its sheet on a lane keyed `order:<step_commitments.id>` (helper 1's prepare note, 2026-10-13) | the sub flow; PR 3 (#5628): `subStampsFor` beside `residentialStampsFor` in `flows/load.ts`, `sub_paid` needs a balance at or under zero AND a payment, the default lane is the newest unpaid sheet else the newest lane, `messages/sheetLines.ts` returns parts, a hand-made sheet reads as agreed outside the app, and a sub's lanes take no skips until `contact_step_skips` has a sheet column | the sub flow |

### Migrations in flight (2026-10-13, pushed by the lead in stamp order after each merges)

| Stamp | Cut | PR | What |
|---|---|---|---|
| 20261014050000 | R4 | #5568 (helper 3) | `flows_kind_known` + residential and sub, the fact and paper lists, the residential seed | (renumbered 2026-10-13 by the first Mac's rebase)
| 20261013180000 | R0 | #5593 (helper 2; rebuilt, since the first build stayed on another Mac) | `contacts_kind_known`, four id columns, `name_contact` for the new kinds and a lead with no record, the sub backfill, reps in the seed |
| 20261013190000 | R5 | #5590 (helper 8) | `messages_tech_team()`, the tech's door, `has_until`, `office_only`, the hours and wait settings, `notification_history.message_id` |
| 20261014060000 | R8 · 12 | #5586 (helper 1) | the sub flow's fact and seed lists, `SEED_FLOWS.sub` | (renumbered with it)
| 20261013210000 | R3 | #5588 (helper 7) | `text_es`, `phone_order`, `phone_name`, the `es` and `phone` version kinds, `edit_quick_reply` recreated, `messages.quick_reply_id` |
| 20261013220000 | R8 · 16 | #5585 (helper 6) | `customers.language` |
| 20261013230000 | R7 | #5591 (helper 9) | `messages.tied_by`, stamped by `tie_message` |
| 20261014002000 | R8 · 8 | #5595 (helper 5) | `messages.estimate_id` and its partial index |
| 20261014003000 | R6 | #5598 (helper 8) | `messages.mailbox`, `messages_boxes_v1`, `contact_channels.opted_out_by_box`, `gmail_sync_state` keyed by box, `contact_channels_keep_stops` |
| 20261014004000 | R8 · 12 | #5597 (helper 1) | `people_labor_jobs.on_site_at` and `done_at`, the trigger and the backfill |
| 20261014005000 | R8 · 8 | #5601 (helper 5) | `draft_estimate_line_from_message` |
| 20261014010000 | R8 · 3 | #5602 (helper 6) | `running_late_move`, `self_move_schedule_block` recreated |
| 20261014020000 | R2 · 3a | #5608 (helper 9) | `contact_for_customer`, the keep-thread trigger on `customers` |
| 20261014040000 | R5 | #5611 (helper 6) | `quick_replies_phone_tech`, a tech reads the phone's lines |

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
- **The thread's switch**: `messages/activityRows.ts` — `threadWithActivity(messages, activityByJob, { on, noMoney })` merges the activity of the jobs the person's lines carry (keyed by `messages/load.ts`'s `jobKey`, since an activity item has no job on it), in time order, plain; `noMoney` drops financial items for the tech's door; `switchState(read, write, door)` keeps the **Job activity** switch per computer with one key per door, on by default for the office and off on the phone (helper 7's prepare note, 2026-10-13). One PR.
- **Docs**: `GLOSSARY.md` → Job activity ledger gains the five kinds; guide `read-a-customers-thread` (new).

### R2 · The thread everywhere (3 PRs)

*Waits on wave 2 cut 1 (the thread window).*

- **The route**: `/messages` in `App.tsx`, the header entry for the office team (`canOpenMessages` = `GC_OFFICE_TEAM` in `access.ts`), the page as cut 2's Follow up with the kind filters (Customers · Trade partners · Architects · Leads · Subs · one more pill for Supply houses and Candidates) and the thread window at its URL contract (`?thread=&at=`, v2.5287). One PR. `APP_DIRECTORY.md` gains `/messages`.
- **The job window's box**: **Note · Text · Email** kinds, the composer turning orange on a customer kind, the quick replies strip from cut 3's kernel, `send` through `quo-send` and the customer email sender; the **Customer** chip opens the person's thread at the line. One PR.
- **Openers** (three PRs, 2026-10-13): 3a the door, `contact_for_customer(p_customer_id)` finding or making a customer's own contact (SECURITY DEFINER, `gc_office_team()`), with a `BEFORE DELETE` trigger on `customers` that turns its contacts into unknown numbers keeping the name, since the screens hard-delete customers and `contacts.customer_id` is RESTRICT (#5608; its migration goes to prod before 3b merges); 3b one shared `MessagesButton` beside the name in five places and the Customers phone row, for `canOpenMessages` roles, calling the door then `/messages?thread=<contact>` while every name keeps its old press, and `CUSTOMER_MESSAGES_LINE_ON` flipped on (#5620, on R2 PR 1 #5619); and the Jobs phone cards' name opening the profile (#5610). The plan's "a customer's name opens the thread" became the button beside the name, since every name already had a press people use.
- **Guides**: `text-a-customer-from-the-job` (new), `send-a-customer-an-email-from-the-job` (new).

### R3 · Quick replies, the four additions (3 PRs)

*Waits on wave 2 cut 3 (the quick replies tables and editor).*

- **Kernel**: `quickReplies/blanks.ts` — `BLANKS` (the fill table: `first`, `me`, `address`, `job`, `minutes`, `window`, `back day`, `back time`, `day`, `link`, `amount`), `fillLine(text, fills)` → `{ text, left }`, `blanksIn`; `quickReplies/kernel.ts` — `phoneLines(lines, stepId)` (the step's first, six at most, by `phoneOrder`), `shortName`, `stepsByFlow` (steps per flow, not per kind), `wordsFor(line, lang)`; a version kind `es`. One PR.
- **SQL**: the three columns and the version kind. One PR.
- **Screens** (two PRs, 2026-10-13, on the GC lead's Edit quick replies window #5609): A (#5616) the kernel and IO — `QrEditorTab` gains `phone`, `editQuickReply` writes words, tags, es then phone, `rows.ts` reads the three columns and all seven kinds; B (#5617) the Phone tab panel (↑, ↓, off, a seventh line waits), the opened line's chips, preview, Spanish box, tick and short name, ☎ and es / no es marks, the step picker grouped by flow, `FilledLine` on the strip and in Find with Send waiting on a blank. 20261013210000 must be on prod before A merges, the one exception to client-first, since `rows.ts` reads the new columns (done 08:20Z). Spanish and the phone are set by opening a line, not on the add row (`add_quick_reply` has no es or phone args); the Phone tab shows once a line is on the phone. Guide `edit-the-quick-replies-for-the-phone`.
- **Guide**: `edit-the-quick-replies-for-the-phone` (new); `plainWords.ts` holds every line.

### R4 · The residential flow (4 PRs)

*Waits on wave 2 cut 4 (the flow tables).*

- **Facts, seed and SQL**: `flows/facts.ts` gains the residential facts (`booked`, `on_way`, `arrived`, `found`, `estimate_sent`, `estimate_approved`, `working`, `done`, `billed`, `paid`, `review_asked`) in a fifth group, On the job, with the `estimate` and `bill` papers; `flows/seed.ts` the eleven-step flow with the prototype's step ids (booked, onway, arrived, found, estimate, approved, working, done, billed, paid, review), the estimate reminder on Approved and the bill reminder on Paid (`nudgeDue` never fires on our move, so Estimate sent and Billed carry none), the review ask left to the stage send, all off; the migration above in the same PR, pushed by the lead after it lands. Stacks on R0. One PR.
- **The loader**: `flows/load.ts` → `residentialStampsFor(rows, now)` from the tables in the data table, one `JobStamps` per `jobs_ledger` job; `on_way` and `review_asked` guessed from the words by two small exported rules until `quick_reply_id` lands. Stacks on the facts PR. One PR.
- **The strip above the box** (integration 5): `flows/card.ts` → `stepStrip(card)` folds the step card to one line of presses; **Approve for her** writes what the portal press writes with `how = 'office'` (accept-estimate takes it); **Move the day** opens dispatch; **Send it again**; **She declined**. One PR.
- **The stages the customer feels** (integration 15): the morning run's per-step switch on for scheduled, started, done, billed, paid; the Jobs board dot and hover from the queue by job. One PR.
- **Guide**: `see-where-a-customer-is-on-their-job` (new); `docs/GLOSSARY.md` → the residential flow under Messages.

### R5 · The tech's door and Job Mode (4 PRs)

*Waits on R2 and R3.*

- **SQL**: `messages_tech_can_read`, the two policies, `contacts.has_until`, the wait setting; `doors.ts` lists them; `access.ts` → `MESSAGES_TECH_TEAM` (`primary` and `helpers`, the field roles in `roleLabels.ts`; `subcontractor` stays out until R8 · 12) with `canMessageCustomersFromJobMode`; `access.test.ts` holds it to `messages_tech_team()` in the newest migration that defines it. The hours and the wait are set by `is_master_or_dev()`, as the Quo seats are. One PR, pushed by the lead.
- **Job Mode** (#5615, behind `JOB_MODE_MESSAGES_ON = false`): **Message the customer** beside Hand the phone on `DashboardJobModeCard`, an orange dot when the customer answered; the sheet (`jobMode/MessageCustomerSheet.tsx`, `ResponsiveModalShell`) lists the phone's lines with Something else last, a preview in the customer's orange with the fill row, Send held until every blank is filled; Something else writes a job thread note; lines needing {amount} or {link} stay off; no ReplyBox, since the phone has no free text; `jobModeMessagesOffered(role, on)` in `jobBox.ts`. A tech makes no contact, so the send passes `{ from: 'job_mode', customerId, contactId (may be null), jobId, quickReplyId, body }`. Two pieces the door needed (helper 6's read, 2026-10-13): a `quick_replies_phone_tech` SELECT policy for `messages_tech_team()` (#5611, 20261014040000), since `quick_replies_team` is office-only; and a tech path on `quo-send` after the GC lead's switch PR (tech team + `messages_tech_can_read`, the phone picked server-side, the job tie required, `quick_reply_id` stamped, the reply hold written), which turns the switch on.
- **Who answers**: `messages/hasRule.ts` — a reply goes to the tech who texted until `has_until`, then to the office; after hours the app answers once and the row waits on Needs a reply; the words in `plainWords`. One PR.
- **Push** (integration 13): the rule as a kernel first (`messages/notifyRule.ts`: the tech at once, a seat pick at once, the office after the wait, the office first after hours, never a candidate's or supply house's line, a legal reply to the office alone, never twice for one line), then a new body shape on the existing `messages-notify` function (v2.5317) rather than a new one, with `notification_history.message_id` nullable in R5's SQL so a sent push can be read back; the tech's push carries no URL until Job Mode's thread has one; `docs/EDGE_FUNCTIONS.md` section amended. The owner's calls (2026-10-13, helper 4's prepare note): a push only for a customer's, a lead's or a sub's line until Quo's functions write inbound lines; with no seat picked the office push goes to the Customers seat holder, and to the five office roles when that seat is empty; the after-hours line stays out until `quo-send` exists; the wait push needs a pg_cron behind a switch that ships off; `routeReply` moves to `messages/legalRoute.ts` and hasRule's row type to a type-only file, so the edge copy stays small. Five PRs with the kernel (the type move, the split, the body, the cron), the function deployed by the lead (helper 8's prepare note, 2026-10-13).
- **Guide**: `message-a-customer-from-job-mode` (new); `ACCESS_CONTROL.md` → the tech's door.

### R6 · Two boxes, two numbers, one inbox (3 PRs)

*Waits on wave 2 cut 5 and cut 6, and the owner's call on team@ against office@.*

- **SQL**: `messages.mailbox`, `messages_boxes_v1`, `contact_channels.opted_out_by_box`; `gmail_sync_state` one row per grant. One PR.
- **The reader**: cut 6's `gmail-sync` takes two grants and stamps `mailbox`; the sender matched first, the box the first guess for an unknown sender; a reply goes from the box they wrote to, a new conversation from the box of their kind. One PR (edge, deployed by the lead).
- **Compose and sort**: `compose.ts` → `mailboxFor(kind)` and `fromNumberFor(kind)`; Who is this? orders its guesses by the box; the letterhead, the lien reply-to and the website terms read the chosen customer address. One PR.

### R7 · The New lane (4 PRs)

*Waits on R0 and wave 2 cut 2.*

- **Kernel**: `followUp/newLane.ts` — `newLane(contacts, messages, activeJobIds, now)` gives the rows with their sort: **Who is this?** (a sender nobody has named; the guesses on the team line run a matched customer, a new lead on Prospects, a new customer, a candidate, someone else; on bids@ a trade partner on an open ask whose domain matches, a new trade partner, a supply house, a candidate, someone else), **Which job?** (two or more active jobs and the newest inbound line on the default job with `tiedByHand` false), **Who has it?** (nobody on it; the rule's pick passed in from R5); `newLaneCount` for the badge, wired into `queue.ts` by the lead. One PR (helper 6's prepare note, 2026-10-13).
- **SQL**: `messages.tied_by` (null when the default job took the line, the user when someone tied it), written by `tie_message`; main cannot tell the two apart today. One small PR.
- **The lane and the sort card**: the lane on Follow up (mockup A), the sort card above the thread, each press writing through `name_contact`, `tie_message`, the has rule. One PR with smokes.
- **Sort all**: the desk (mockup C) behind the lane's header, one card at a time. One PR: #5655 (v2.5485, helper 3), a draft on #5652; the record-making guesses still wait (§ 7, call 10).
- **Guide**: `sort-new-messages` (new).

### R8 · The integrations (17 PRs)

In the order that each unblocks the next. Numbers are the mockups' card numbers.

| # | Integration | PRs | What each PR is |
|---|---|---|---|
| 14 | The Dashboard's Customers line | 1 | `dashboardNeedsYou.ts` key `customer-messages`: need a reply · we owe · to sort, opening `/messages?kind=customer`; built real behind `CUSTOMER_MESSAGES_LINE_ON = false` until R2's route exists, `toSort` counting open unknown contacts until R7's lane replaces it (helper 8's prepare note, 2026-10-13) |
| 1 | The app's own emails in the thread | 1 | `messages/sentCopies.ts` reads `sent_documents` by contact into folded **the app** lines with read and paid stamps; `sent_documents.contact_id` set by every sender (cut 7) |
| 4 | Voicemails read | 1 | the transcript as the line (`QuoLine.transcript` and `summary`, not yet on `ThreadMessage`); `heardDay` finds the phrase with `readDay` over short runs of words and a small time reader; **Keep the day** writes cut 2's `message_promises` offered row through `dayKept` (helper 9's prepare note, 2026-10-13) |
| 6 | They owe us on Follow up | 1 | `followUp/queue.ts` → `theyOweUs(bills)` from the AR page's reads; the bill's reminder as the step's quick reply, sent by the morning run at the terms |
| 2 | Reports and photos | 1 | **parked 2026-10-13, the owner's call**: a field report has no photos on main (`report_template_fields.input_type` is long_text, percent or signature; no photo table, no Drive column, no upload). It needs a photo field and a store first, then the report as a `source: 'report'` in `documents/jobFiles.ts` (kind `image`, home by where the bytes live, keyed `drive:<id>`), **Attach from the report** on the send, and one link line per photo unless `linkLines` learns a grouped link; a photo reply is cut 6's (helper 7's read, 2026-10-13) |
| 7 | The Lien desk's sends | 1 | a `legal` line kind from the desk's sent rows, read-only, the box off under it, the reply to the office alone |
| 8 | A line on an estimate from a message | 2 | the column (SQL); the ⋯ press through `estimates/lineFromMessage.ts`, cut 4b's kernel with the estimate's form; never called an add-on, which is Estimates' option kind (helper 6, 2026-10-13) |
| 3 | Dispatch writes back | 2 | `dispatch/whatSlides.ts` (the stops that move and by how much); the ask on the send, the move RPC with its reason, the dispatcher told |
| 9 | Leads | 1 | **moved off Prospects 2026-10-13**: Prospects is a cold-call deck of companies, so a homeowner who texted is a `lead` contact with no record whose home is Messages and Follow up; a `prospects` row is written only on the card's **Add to Prospects**; booking re-points the contact to the new customer and keeps the thread (R0's SQL lets `name_contact` re-point a lead); the Who is this? guess still reads "a new lead" (helper 6's read, 2026-10-13) |
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
| R4 · the residential flow | 4 | 1 | — |
| R5 · the tech's door, Job Mode, push | 5 | 1 | 1 (`messages-notify`, amended) |
| R6 · two boxes | 3 | 1 | 1 (`gmail-sync`, second grant) |
| R7 · the New lane | 4 | 1 | — |
| R8 · the integrations | 17 | 4 | — |
| R9 · the docs pass | 1 | — | — |
| **Residential, on top of wave 2** | **46** | **10** | **2** |
| Wave 2 pieces it stands on (cut 1 screens, cut 2 screens, cut 3 SQL and editor, cut 4 tables, cut 5 functions, cut 6 reader), already in `BUILD_PLAN.md` | ~18 | 4 | 3 |
| **Everything from today to done** | **~64** | **14** | **5** |

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
5. **team@ or office@** (R6): office@ is on the letterhead, the lien reply-to and the website terms today; whichever is chosen goes everywhere. R6's SQL makes the address a setting, so the answer is typed in Settings, not migrated. Still open with it: whether office@ is a real Workspace user (a group or alias cannot be read through the delegation), the second Quo number to buy for bids, and counsel on whether a STOP to one of our numbers silences the other.
6. **Which reminders start on** (R4): the estimate and the bill; the review ask after ten real threads.
7. **The Job activity switch's default** (R1): on for the office, off on the phone.
8. **Leads' home** (R8 · 9): the pick said Prospects; the build keeps a texting homeowner on Messages until they book, with Add to Prospects as a press, because Prospects is the companies' cold-call deck and a homeowner would land in it as "never called". Object if you want them in the deck.
9. **Photos on a field report** (R8 · 2): main keeps none. Adding a photo field to reports is its own small cut (the input type, a store, the upload from Job Mode) before the thread can offer them to a customer. Yes, later, or no?
10. **Records made from the sort** (R7, Sort all, #5655): four *Who is this?* guesses need a record made first (a new customer, a new trade partner, a supply house, a candidate). The New lane (#5652) and the Sort all desk (#5655) leave them waiting, each saying where to make the record. Making the record from the card, then naming the number as it, is its own PR. Lean: not yet, until the office says the walk to Customers or Trade partners slows them. Yes, later, or no?
11. **Who reads a lead's prospect record** (R0 PR 4, the fetchers): `prospects` is readable only by `user_has_prospects_staff_access()`, the dev, the owner and the assistants. An estimator or a controller on the office team gets no prospect row, so a lead shows the name `name_contact` stored on the contact, and a lead added to Prospects with no name of its own reads blank for them. The build keeps the existing policy. Should estimators and controllers read `prospects`? A yes is a policy migration of its own.

## 8. How a cut is done

As `BUILD_PLAN.md` § 10: kernels and tests on `main`; migrations pushed with `supabase db push` and verified read-only on prod; edge functions deployed and `check:edge-drift` clean; screens past the render smokes and the deploy checks; the guide past the plain-words test; the release note and fragment in; the maps updated; and the owner has pressed on it on prod with a test row that matches nothing real. For R5 the press is the one that matters: a text from Job Mode to a test number the office holds, and the reply back on the phone.
