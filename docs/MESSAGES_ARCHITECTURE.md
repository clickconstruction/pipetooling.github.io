# Messages: the system map

---
file: docs/MESSAGES_ARCHITECTURE.md
type: Engineering / Architecture
purpose: One page for a developer new to Messages — the contact spine, the thread and its slots, Follow up, the flows and the morning run, the channels (Quo texts, email in and out, the portals, push), who sees what, the switches and crons, how to test it live, how it deploys, and what is still open. Everything here is a pointer into code and the per-version record; nothing is repeated that a kernel's header or a fragment already says.
audience: Developers, AI Agents
last_updated: 2026-10-17
---

## What it is, in one paragraph

Every call, text, email, note and portal message with a person we work with, in **one thread per person**, with the jobs
they are on as labels on the person and on each line. **Follow up** is one queue of everything waiting on us, with who
has each conversation. A **flow** per kind of person says where each one stands, and every step of it is finished by a
fact the app already keeps, never by a typed word. The papers a step turns on are sent, signed and reminded from the
thread. One rule under all of it: **a step is finished by a fact the app keeps.** Everything else is a view.

It was built in two trains in October 2026: the GC Messages build (cuts 1 to 10, for trade partners, architects and the
customers of GC projects) and the residential build (cuts R0 to R9, the plumbing company's own customers, leads, subs,
supply houses and candidates on the same spine). The per-version record is `docs/recent-features/v2.5247.md` onward;
the design is the plans named at the end of this page.

## Where it is in the app

| Surface | Route | Who | Code |
|---|---|---|---|
| Messages, the office's one page | `/messages` (`?kind=` pills, `?thread=<contact id>&at=<message id>`) | the office team (`canOpenMessages`) | `src/pages/Messages.tsx` |
| GC projects → Messages, Follow up, the boards, Papers, Money | `/gc?view=messages`, `?view=followUp`, … | the office team (`canOpenGcProjects`); Money the money team | `src/pages/GcProjects.tsx` |
| The thread window (every door opens the same one) | over either page | the office; a tech through Job Mode's door | `src/components/gc/messages/ThreadWindow.tsx`, `openThread.ts`, `useMessagesHost.ts` |
| A job's box, **Note · Text · Email** | a job's window on the Pipeline | the office | `src/components/jobs/JobCustomerBox.tsx` over `reply/ReplyBox.tsx` |
| Job activity's message lines | Jobs → Pipeline → a job's activity | the office; techs by the gate (see *Who sees what*) | `src/components/jobs/JobActivityView.tsx`, `src/hooks/useJobMessages.ts` |
| Job Mode: **Message the customer**, the customer's texts in Job updates, since v2.5573 the big button **On my way** / **I'm here** (the office's two press lines, `quick_replies.phone_press`), and since v2.5590 the tech's **bio** as a second text the first time a customer hears from them (`BioPickWindow` to pick the lines for one customer; the memory is `messages.introduces_user_id`; the office writes the bio on the person desk's Bio section, the tech picks the usual lines on Settings → Your account → Your bio) | Job Mode | primary and helpers (`MESSAGES_TECH_TEAM`); the clock-in half of On my way for every Job Mode role | `src/components/jobMode/`, `src/lib/jobModeMessageCustomerIo.ts`, `src/lib/jobModeOnMyWayIo.ts`, `src/lib/jobMode/onMyWay.ts`, `src/lib/bio/` |
| **Tell the customer** (punch list #115): the sheet before a customer's text, and the receipt with the call after — on the schedule (v2.5593, a job's first visit, the office's Booked line filled from the block) and on the estimate (v2.5594, the email and the text with the accept link in one press); **Send in the morning** on a booking (v2.5595) hands the text to the 9 AM run; the receipt's **Add to my calls** (v2.5596) makes the call a task; since v2.5597 the sheet notes the customer's say (`contacts.prefers`), presses itself when My way (`tell_customer_prefs`) says send, offers **Make this the office's line**, and a moved first visit's Rescheduled text waits on Today's sends | Add job to schedule, from the job and from the Dispatch hub's picker (`ScheduleJobModal`); Send to customer on a normal estimate (`Estimates.tsx`) | the office team (`GC_OFFICE_TEAM`); the send is the reply box's path through `quo-send` | `src/components/customers/TellCustomerSheet.tsx`, `src/lib/tellCustomer/` |
| **Today's sends** (v2.5595, punch list #115): the texts the morning run prepared for the office to press instead of sending (a step set to *Offers* in Flows), and the texts the office handed to a morning; Edit, Send, Send all that are ready, Not this one, Hold until a day, Stop reminding on this job; a held one says why | the Dashboard's Needs you line *Today's sends* (`todays-sends`) | the GC office team (`canOpenGcProjects`); a press is the reply box's path through `quo-send`, then `nudge_offer_sent` | `src/components/dashboard/TodaysSendsWindow.tsx`, `src/lib/offers/`, `nudge_offers` |
| **Call tasks** (v2.5596, punch list #115): the call the receipt suggests, as a task in Follow up → We owe them with the day and the script; Call, I called, Tomorrow, Skip; closed by an answered call Quo logs | **Add to my calls** on the Tell the customer receipt, and the quiet line under a text we sent a customer today on Messages (`useFollowUpThreadSlots` `underLine`) | the GC office team (`follow_up_press`); `quo-webhook` closes as the service role | `src/lib/calls/`, `src/components/followUp/FollowUpSections.tsx` (`CallRowView`), `call_tasks`, `flow_steps.call_script` |
| Settings → Phone and texts | `/settings?tab=settings-phone-texts` | the office reads; the owner or a dev flips the switches | `src/components/settings/` cards over `src/lib/quo/*Card*.ts`, `src/lib/messages/*Io.ts` |
| Settings → Flows | `/settings?tab=settings-flows` | the office edits (`canEditFlows`) | `src/lib/flows/editor.ts`, `flowEditorIo.ts` |
| Settings → What customers see | `/settings?tab=settings-what-customers-see` | the office | `src/lib/portal/customerPageWords*.ts` |
| The customer's portal, Messages tab | `/portal?t=<token>` | the customer, no login | `src/pages/CustomerPortal.tsx` over the `customer-portal` function |
| The trade partner's portal | the portal link in the invite email | the trade partner, no login | `src/pages/GcTradePortal.tsx` over `gc-trade-portal` |
| A kept file's lasting link | `/files/<source>/<id>` (`messages`, `drive`) | anyone signed in whom the file's row lets read | `src/pages/FileOpen.tsx`, `src/lib/files/fileRoute.ts` |

## The spine: contacts and messages

A **contact** is a view over the people the app already has, never a fifth list. `contacts` points at one record —
`customer_contact_id`, `gc_company_person_id`, `person_id`, `prospect_id`, `supply_house_id`, `supply_house_contact_id`
or `team_prospect_id` — and carries `kind` (`ContactKind` in `src/lib/contacts/names.ts`: customer, trade, arch, lead,
supply_house, candidate, sub, team since v2.5546 (a roster row that is not a sub; the seed gives every roster person a
contact with the roster's number, and *Who is this?* names a number the roster lacks and writes it back; read into the view since v2.5552, where
`contacts/load.ts` had kept only the seven kinds it knew, so a teammate's thread said *This person is not in Messages.*
and their text left Follow up's lanes — its known kinds are a `Record<ContactKind, true>` now, so a kind the loader
does not read fails the type check), unknown), `goes_by`, the Follow up state (`state`, `snoozed_until`, `has_user_id`,
`has_until`, `has_since`, `has_how`), the customer's say (`prefers`, `prefers_how`, `prefers_at`, v2.5597) and the off-the-list columns. A number nobody knows is a contact of kind `unknown`
with one channel until **Who is this?** names it (`name_contact`), which re-points the contact and keeps its thread.

- `contact_channels` — a phone number or email that is theirs, with the opt-out (`opted_out_at`, and per box since R6,
  `opted_out_by_box`, because a carrier's STOP is per number pair).
- `contact_jobs` — the association to a bid, a GC project or a Pipeline job (`jobs_ledger`), one default per contact.
  A line's job is its own column; the tie moves with `tie_message`. The jobs a person is on *by the facts* (an invite,
  a quote, a dispatch) sit beside the ones the office tied (`src/lib/messages/factJobs.ts`).
- `messages` — one row per call, voicemail, missed call, text, email, team note, event or portal line: `contact_id`,
  the job keys (`bid_id`, `project_id`, `jobs_ledger_id`), `channel`, `direction` (in, out, team), `who_user_id` or
  `who_text`, `at`, `subject`, `body`, the source id (`quo_id`, the RFC `Message-ID` for email, unique so a resend never
  doubles), `mailbox` (team, bids), `quick_reply_id` (or `introduces_user_id` on a bio text, v2.5590), `estimate_id`, `office_only`, `optout_line`, `back_on` / `back_by`
  (a note's follow-up day), and cut 5's call columns (recording, transcript, summary, length).
- `message_attachments` — a file as it arrived or went (`bucket_path` our copy, `link`, `sent_as`, `drive_file_id` once
  filed, `paper_answer` once read as a paper).
- `message_highlights`, `message_promises` (what a line was read as: a quote, a start, papers, a payment, with the day),
  `contact_owed` (what we owe a person, one open row), `quick_replies` with its uses and versions (and `phone_press`, the one live On my way and I'm here line each, v2.5573), `user_bio_lines` (a tech's bio, v2.5587), `nudge_offers` (Today's sends, v2.5595), `call_tasks` (v2.5596) and `tell_customer_prefs` (My way, v2.5597).

The kernels are `src/lib/contacts/` (`kernel.ts`, `names.ts`, `load.ts`) and `src/lib/messages/`: `thread.ts` (one
thread per person, the rows and the move line), `stamps.ts` (their last word and ours), `load.ts` and `jobKeys.ts` (the
rows as the screens load them), `compose.ts` and `textOut.ts` (the reply box's words and the rules for a text going
out), `owed.ts`, `promises.ts`, `jobTiles.ts` (a job as the thread names it), `listRows.ts` (the Messages list). The
reads and the presses are `messagesIo.ts`. The SQL doors are the definer functions a migration under
`supabase/migrations/202610*` names: `name_contact`, `tie_message`, `contact_for_customer`, `contact_find_or_make`,
`contact_for_channel`, `contact_set_off` / `contact_put_back_on`, `edit_quick_reply`, `quick_reply_step`, `set_quick_reply_press`, `edit_bio_line` / `bio_line_say` / `bio_opener`, `contact_set_prefers`, `call_task_add` / `call_task_done` / `call_task_move`, `nudge_offer_make` / `nudge_offer_sent` / `nudge_offer_dismiss`, and the flow
and nudge functions below. Every table carries the three fences (`CLAUDE.md`).

### Lines from other systems

The thread is not only `messages`. Four readers turn what main already keeps into lines, each pure and each with its
test: `sentLines.ts` (every email the app sent through `sent_documents`, `docs/SENT_COPIES.md`), `appLines.ts` (the
app's own automatic sends, marked as the app's), `legalLines.ts` / `legalRoute.ts` (the Lien desk's notices and where a
reply after one goes), `activityRows.ts` (a job's activity in the thread, behind the thread's switch), and
`sheetLines.ts` (a sub's lines on their sheet). A new source of lines is a fifth reader of the same shape, merged in
`load.ts`; it is never a write into `messages`.

## The thread window and its slots

`ThreadWindow.tsx` owns the layout: the header (name, the jobs rail, ☎ and ⋯), the move strip, the day rows, the lines
(`ThreadLine.tsx`, `LineFiles.tsx`), and the foot. **Everything a later cut draws inside it is a slot**
(`threadSlots.tsx`, `ThreadSlots`): `headerRight`, `statusRow`, `aboveLines`, `menuRows`, `aboveBox`, `box`,
`underLine`, `lineBody`, `side`, and the message window's first slot. A slot is a function of the person or the line
that returns what to draw; an empty slot draws nothing. `useThreadSlots` merges the cuts in order — cut 2's Follow up
pieces, cut 3's reply box, cut 4's flow rail, cut 4b's change order, R8's estimate line, cut 6's paper offer, R7's sort
card — so the page never changes for a slot. **To add something to the thread, add a slot there and nowhere else.** What `aboveLines` draws has its own scrolling
wrapper (`data-thread-above`, v2.5570): a card taller than the room shrinks and scrolls before the lines and the box do.
Keys inside the column are prefixed per slot (`reply:`, `flow:`, `new-lane:`), since the slots are siblings.

The header's second row says what the person is to us (*Customer: Acme*); for a number nobody has named it reads
`unnamedWords` (`contacts/names.ts`: *A number nobody has named*, *An address nobody has named*, *Nobody has named
them*), and the blue **Who is this?** under it is the header's only one (v2.5541). Its ☎ link, the dim *No number to
call*, the ⋯ button and the who-has-it pill (`WhoHasItPill` `bare`, through `headerRight`) wear one class,
`.thread-head-control` in `src/index.css`: 28 px, no border, a hover on the pressable ones; Follow up's rows keep the
bordered pill (v2.5542).

The window reads the open thread through `useThreadWindow` and asks for the read again after its own write with
`useMessagesReread`. Since v2.5572 a row the page did not write reaches it too: `useMessagesLive` holds one realtime
channel on `messages` and `contacts` (migration `20261016010000`; Realtime reads the tables' own row policies) behind one
bus (`lib/messages/liveReread.ts`) shared by the host, Follow up and the header's badge, settles a burst into one read,
and reads again when the tab comes back to focus. On a phone the header folds (`threadFold.ts`), ⋯ is a sheet, and a press and hold on a line opens
**Tie this message to** (`tieSheet.ts`).

The **reply box** (`reply/ReplyBox.tsx`) is one component for the thread's foot and the job's box: the kinds row
(Text · Email · Note, or one kind), the quick replies strip (`QuickRepliesStrip.tsx`, the editor with its phone block's **Big button on Job Mode**, **Find a reply**),
the textarea with the opt-out line and the count, **Attach** (`AttachPicker.tsx` over `attachIo.ts`, `replyFiles.ts`),
**Tie to**, and the send window (`SendWindow.tsx`). What it sends is one interface, `replyIo.ts`, so the smokes hand it
a fake. While texts are off (`useTextsOn`), the Text kind draws the wait line in place of the composer (`TextsWaitLine`: the switch is the first card on Settings → Phone and texts, a link for the owner or a dev; v2.5538).

## Follow up

`src/lib/followUp/queue.ts` is the queue: one row per person, Open · Snoozed · Done, who has it (`has_user_id`,
`has_how`), the move line, and the lanes the screens group by — **New** (R7, what came in and still needs sorting:
`newLane.ts`, **Sort all** in `sortDesk.ts`), Needs a reply, We owe them (`owed.ts`; since v2.5596 the call rows too, `FollowUpQueue.calls` from `callTasksFromRows`, `CallRowView`), They owe us (`theyOweUs.ts`).
`team.ts` says who a conversation can be handed to; `assignSeats.ts` is **Who gets a new message** (the rule and its
seats, `app_settings.messages_assign_rule_v1`); `hasRule.ts` is R5's answer to who answers a customer's reply (the tech
who last texted them until 5 PM, `has_until`, then the office). The screens are `src/components/followUp/`
(`FollowUpPanel`, `FollowUpSections`, `WhoHasItPill`, `OwedStrip`, `SettlingNote`, `NewLaneCard`, `SortAllDesk`) and the
two slot hooks that put them in the thread. The Dashboard's Customers line (and `follow_up_count`; since v2.5596 a customer with an open call counts once) counts from the same reads
(`customerCounts.ts`).

## Flows, steps and the morning run

A **flow** is one per kind (`flows`, `flow_steps`, seeded by `src/lib/flows/seed.ts`; `flowsSql.test.ts` pins the seed
to the newest migration). A step has a lane (once, per job, any time), whose move it is, the facts that finish it, the
papers it turns on, and its nudge (after how many days, how, and whether the app may send it: off, offers or sends) and since v2.5596 its call script (`call_script`, `call_script_es`, `suggest_call`). **State is never stored**:
`flows/state.ts` (`readFlow`) reads where a person stands from the stamps `flows/load.ts` and `residentialLoad.ts`
gather out of the rows main keeps (invites, portal opens, signed papers, quotes, draws, schedule blocks, clock sessions,
reports). The facts a step may pick from are **one list in code**, `flows/facts.ts`; a fact that is not there cannot be
picked, and the SQL (`flow_fact_ids`, `flow_facts_ok`) refuses one it does not know.

Around the read: `card.ts` (the step card in plain words), `nudges.ts` (the reminders due), `panel.ts` (the rail beside
the thread and the panel it opens to), `now.ts` (where one person is, in a line, for the quick replies), `going.ts` and
`goingInputs.ts` (**How it is going**), `board.ts`, `boardRead.ts` and `flowsIo.ts` (the boards over `flow_rows_kind`,
the office's one read), `editor.ts`, `editorKinds.ts` and `flowEditorIo.ts` (Settings → Flows, `flow_save`,
`flow_paper_create`, the history), `jobPapers.ts` (Papers on this job), `portalPage.ts`, `portalSteps.ts` and
`customerMove.ts` (the customer's side), `stageSends.ts` (R4, the stages a residential customer feels), `callScripts.ts` (the seeded scripts, v2.5596). A step's note goes
through `flow_add_note`, a skip for one person is `contact_step_skips`, and a wish for a missing fact is `flow_fact_wishes`.

The **morning run** is `messages-nudge-dispatch`, fired by the cron `messages-nudge-dispatch` at 14:00 and 15:00 UTC
with `X-Cron-Secret` from the vault. Its decisions are the kernels' (`nudgeRunInputs.ts`, `nudgeDispatch.ts`,
`nudgeRunLog.ts`, copied to the edge): everyone's flow, the steps due, what was already sent (`nudge_sent`, never
doubled), what is held (`nudge_holds`, **Hold until Mon**), and the per-step switch
`app_settings.messages_nudge_app_sends_v1` — **off until the owner turns a step on** (the plan's decision 3); since v2.5595 three ways per step, off, **offers** (`'offer'`: the run writes the text to `nudge_offers` for the office to press on the Dashboard's Today's sends, held with why when the number is missing, sent STOP or asked for email, v2.5597) and **sends** (`true`), and the run also sends the texts the office handed to a morning (Send in the morning, `prepared_by` office with a `send_on`); a moved first visit's Rescheduled offer has no `send_on` and waits for a press, and an email-only person's text is kept back (`prefers email`, v2.5597). The run
writes its summary to `messages_nudge_last_run_v1`, which Settings → Flows reads as *Last morning run …*. The first run
fired 2026-10-14 with nothing switched on: *no text went, none kept back*.

## The channels

**Texts, through Quo.** `quo-webhook` takes every event of our numbers (signature checked, `quo_webhook_ids` keeps a
replay out) and lands it in the sender's thread as a line, keeps a picture that came with it (`mediaKeep.ts`, then the
`photo-save` sweep every five minutes files it to the job's photos), and answers HELP and STOP itself (since v2.5597 the one-word EMAIL or TEXT too, `PREFER_WORDS` → `contacts.prefers` with a gray line, and since v2.5596 an answered call closes the person's open call tasks, `call_tasks_close_by_call`). `quo-send` is a
text going out: from the reply box's send window, from a job's box, and from Job Mode (`techSend.ts`, R5: the line with `fills: { minutes }`, and since v2.5590 `kind: 'bio'` with the picked line ids, composed by `composeBioText`); a contact tied to a prospect and not to a customer is refused until the prospect's `ok_to_text` is yes (`textRefusal`, v2.5606). The events come from Quo webhook 43696, made through Quo's API (version 2026-03-30), which Quo's settings page does not list; its key and how to rotate it are in `MESSAGES_SWITCH_ON_HANDOFF_2026-10-14.md`. Both are
gated by **Send texts** (`messages_texts_on_v1`, Settings → Phone and texts; the owner or a dev), paused while Quo will
not take one (`paused.ts`), and read the company phone seats (`messages_quo_seats_v1`) and the two boxes
(`messages_boxes_v1`, R6: the team's number and bids@'s, one inbox). The pure parts are `src/lib/quo/`; the edge
function reads, writes and calls.

**Email out** is `messages-email` from the reply box to one of the person's addresses; the GC senders (`gc-trade-email`,
`gc-customer-email`, `gc-architect-email`) and the notify and send functions already keep every copy in
`sent_documents`, which the thread reads back as lines. **Email in** is `gmail-sync` (cut 6): the bids@ reader, under a
service account's delegation, every three minutes while **Read bids@** is on (`gmail_sync_on_v1`, `gmail_sync_state`);
each email lands in its sender's thread with its files as `message_attachments`, and a file that reads as a trade
partner's paper is offered under its line (`PaperOffers.tsx`) until someone answers it.

**The portals.** The customer's page (`customer-portal`, cut 8 and R8) draws **Your move** and **Where you are** from the
flow read on their side, the money story, the papers, and a Messages tab whose write is a portal line in the thread;
the words are the office's (`customer_page_words`, Settings → What customers see). The trade partner's portal
(`gc-trade-portal`) carries the papers to sign and the pay application. A sample token (`?t=sample`, `sample-owner`,
`sample-gc`, `sample-done`) draws the page with made-up rows and saves nothing.

**Push.** `messages-notify` pushes a customer's, a lead's or a sub's reply to whoever has it (R5, `notifyRule.ts`,
`notifyPlan.ts`), driven by the `messages-reply-push` cron every minute while **Reply push** is on, and tells the
people a clause change waits on.

**Files.** A file on a line is our copy in the private bucket; its lasting link is `/files/messages/<id>`; **Save to
Drive** (`drive-link`, cut 7b) files it to the job's Drive folder and the link becomes `/files/drive/…`. A reply's files
go out as a file, a link or a picture (`replyFiles.ts`, `sentLineFiles.ts`).

## Who sees what

The teams are in `src/lib/gc/access.ts`. `GC_OFFICE_TEAM` (dev, master_technician, assistant, controller, estimator)
opens Messages and GC projects and edits flows; `GC_MONEY_TEAM` sees Money and Bill day; `MESSAGES_TECH_TEAM` (primary,
helpers) may message a customer from Job Mode (`canMessageCustomersFromJobMode`), read a job's lines in Job activity
(`canReadJobMessages`) and see the customer's texts in Job updates. Under them the database says the same: the office
reads through the kinds' doors; a tech reads a contact and its lines only on a job they were dispatched to or clocked
on, Monday of last week through Sunday (`messages_tech_can_read`, the `messages_tech_read` and `contacts_tech_read`
policies, migration `20261013190000`), never a phone number or an address, and nothing marked `office_only`. Sample
accounts and digital twins are hidden from every picker (`activeUsersQuery`'s predicates). The role matrices are
`docs/ACCESS_CONTROL.md`; the page sections are `docs/PROJECT_DOCUMENTATION.md`.

## The switches, the settings and the crons

| What | Where | Key or job |
|---|---|---|
| Send texts (the office texts from the company number) | Settings → Phone and texts | `messages_texts_on_v1` |
| Company phone seats (a Quo seat to a person, or one shared by the office since v2.5548) | Settings → Phone and texts | `messages_quo_seats_v1` |
| Who gets a new message (the rule and its seats) | Settings → Phone and texts | `messages_assign_rule_v1` |
| Inboxes (the two boxes: address, number, number id) | Settings → Phone and texts | `messages_boxes_v1` |
| The office's wait before it hears a reply nobody answered (0 is at once) | Settings → Phone and texts → Reply push, under the switch (v2.5540) | `messages_office_wait_minutes` |
| Office hours | `app_settings`, set by a dev (no card yet) | `messages_office_hours_v1` |
| Reply push | Settings → Phone and texts | `messages_reply_push_on_v1`; the cron `messages-reply-push`, every minute, calls `messages-notify` |
| Read bids@ | Settings → Phone and texts | `gmail_sync_on_v1`; the cron `gmail-sync`, every three minutes |
| The reminders the app sends itself, per step: off, offers or sends (v2.5595) | Settings → Flows | `messages_nudge_app_sends_v1`; the cron `messages-nudge-dispatch`, 14:00 and 15:00 UTC; the summary `messages_nudge_last_run_v1` |
| My way: per moment, *Ask me first* or *Send it and show me the receipt* (v2.5597) | Settings → Your account, each office member's own | `tell_customer_prefs` |
| Photos saved on arrival (the tick on a line) | the line | the cron `photo-save`, every five minutes; `photo_saves` |
| The customer page's words and its paper views per job | Settings → What customers see | `customer_page_words` |
| A customer's language | the customer's record | `customers.language` (en, es) |

The reads and the one write of each card are a pair of files, `<card>.ts` (pure) and `<card>Io.ts`, under
`src/lib/quo/` or `src/lib/messages/`.

## The edge, and the copy of the kernels

The functions of the system: `quo-webhook`, `quo-send`, `gmail-sync`, `messages-email`, `messages-notify`,
`messages-nudge-dispatch`, `photo-save`, `drive-link`, `customer-portal`, `gc-trade-portal`, with `dev-login` for the
test recipe below. Each has its section in `docs/EDGE_FUNCTIONS.md`, and each is deployed by hand after its PR merges
(`supabase functions deploy <name>`; `npm run check:edge-drift` says what is behind). A function cannot import
`src/lib` as it stands, so `scripts/edge-kernels.mjs` copies what the edge needs into
`supabase/functions/_shared/gcKernels/` from the entries it lists: **regenerate the copy, never edit it**, keep it free of
billing and job-report code (the residential loader was split into `residentialLoad.ts` for that), and when two PRs
touch the copy's index or the dev-mcp catalog, land them one after the other and regenerate on the rebase.

## Testing it

- **Kernels first.** Every rule is a pure `.ts` with its unit test beside it; every screen has a render smoke
  (`*.render.test.tsx`, `renderWithProviders`). The shared demo data is `src/lib/messages/messagesDemo.ts` and
  `src/lib/flows/demoPeople.fixture.ts`: the prototype's eight people, so a test reads like the mock-up. The reads and
  presses are interfaces (`replyIo`, `attachIo`, `FollowUpIo`), so a smoke hands a fake and never touches the network.
- **Live, as a sample account.** The project's harness is the `dev-login` function with `VITE_DEV_LOGIN_SECRET` from
  `.env.local`, signing in as `sample-<role>@samples.pipetooling.local` (`src/lib/sampleAccounts.ts`; assistant,
  primary, controller and estimator exist, no master or dev) against a local Vite on prod's Supabase —
  `scripts/mobile-surface-shots.mjs` is the pattern (sign in, walk URLs, measure overflow and tap targets at a phone
  width). The live-walk sheets of both builds (`docs/MESSAGES_LIVE_WALK_2026-10-14.md` and the lead's walk of
  2026-10-14 in `docs/recent-features/v2.5514.md` to `v2.5516.md`) say what to press and what to read. Rules: write only
  to the test records in prod (the contact "Test contact" and the two "GC test … delete me" jobs), never a real
  person; the portal's sample tokens save nothing; the desktop app's browser pane is hidden, so drive it headless; and
  measure a phone layout with device emulation off, since an emulated phone grows its viewport to hide an overflow.
- **The database.** Every migration of the build is a `docs/migrations/<version>_*.md`; the schema's RLS and the
  definer functions are the SQL beds CI runs on a bed's change.

## Deploying and operating it

The four tracks of `CLAUDE.md` apply: the client by CI; `supabase db push` for a migration, after its PR is on main;
the functions by hand; the Cloudflare Workers unchanged by this build. What the owner operates by hand: Quo's
webhook 43696 (through Quo's API, never its settings page) and the A2P registration; the switches above; the secrets `CRON_SECRET` and `PROJECT_URL` in the
vault for the crons; and the morning run's dry run with the secret before a step is switched on.

## What is still open (as of 2026-10-14)

- **The switch-on**: texts in are live since 2026-10-14; the switches, in order, are in
  `MESSAGES_SWITCH_ON_HANDOFF_2026-10-14.md`.
- The morning run's follow-ups: `textNumberOf` picks a number by the older `opted_out_at`; the portal tables'
  grants widen to the service role before any customer reminder step is switched on; the What customers see wording
  for the reminders.
- The Attach sheet's words when a message is tied to the person alone and the contact has jobs.
- The full-size photo link and a Photos view; a text's files in Attach once texts are on; the photo tick on a job's
  own Documents; PDF writers for the papers other than the contract (the pay app, the SOW and the schedule go out as
  portal pages).
- Left out on purpose: the Board's ring reading the flows (its own cut, later), round robin on who gets a message, a
  second contact per role, a files@ address, Claude-written photo captions (the owner's lean: words now).
- The owner's decisions still open are listed in the plans' §7 (below).

## Where the design lives

- `docs/MESSAGES_PLAN.md` — the why and the decisions, in the owner's words (the parent of both plans).
- `docs/MESSAGES_BUILD_PLAN.md` — the GC build: the data, the cuts, the kernels and functions listed, the owner's
  decisions, what was left out, and §11, the lead's ledger of wave 2 (what merged, in what order, and the rules the
  queue taught).
- `docs/MESSAGES_RESIDENTIAL_BUILD_PLAN.md` — the residential build, R0 to R9, with its own data, order, owner's calls
  and after-live list; `docs/MESSAGES_RESIDENTIAL_HANDOFF_2026-10-13.md` and `docs/MESSAGES_LIVE_WALK_2026-10-14.md`
  beside it.
- The prototypes and mock-ups stay on branch `spike/gc-mode` under `to-dos/gc-mode/messages/` (`prototype.html`
  v1.178 is the GC spec; `customer-messages-prototype.html` and `customer-messages-integrations-mockups.html` the
  residential one; one `*-mockups.html` per screen). Read one with `git show origin/spike/gc-mode:<path>`.
- The words a user reads: the Glossary's **Messages · thread · contact**, **Flow · step · step card**, **Tell the customer**, **Today's sends**, **Call task**, **The customer's say** and **Messages
  (GC mode, the build)** entries; the help guides under Messages in `src/content/help/` (reply from a thread, see who is
  waiting on us, set up the steps a person goes through, turn on texts, choose who gets a new message, set up the two
  inboxes, turn on the reply push, turn on reading the bids inbox, message a customer from Job Mode, sort new messages,
  edit the quick replies, open a job's activity full screen, schedule a job and tell the customer, work Today's sends, call a customer from a task).
