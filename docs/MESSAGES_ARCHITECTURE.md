# Messages: the system map

---
file: docs/MESSAGES_ARCHITECTURE.md
type: Engineering / Architecture
purpose: One page for a developer new to Messages — the contact spine, the thread and its slots, Follow up, the flows and the morning run, the channels (Quo texts, email in and out, the portals, push), who sees what, the switches and crons, how to test it live, how it deploys, and what is still open. Everything here is a pointer into code and the per-version record; nothing is repeated that a kernel's header or a fragment already says.
audience: Developers, AI Agents
last_updated: 2026-11-01
---

## What it is, in one paragraph

Every call, text, email, note and portal message with a person we work with, in **one thread per person**, with the jobs
they are on as labels on the person and on each line. **Follow up** is one queue of everything waiting on us, with who
has each conversation. A **flow** per kind of person says where each one stands, and every step of it is finished by a
fact the app already keeps, never by a typed word. The papers a step turns on are sent, signed and reminded from the
thread. One rule under all of it: **a step is finished by a fact the app keeps.** Everything else is a view.

It was built in two trains in October 2026, then worked into a desk by two punch-list trains on 2026-10-20 and 21 (#139, `to-dos/press-always-answers/README.md`, v2.5681 to v2.5708; #140, `to-dos/messages-desk/README.md`, v2.5709 to v2.5717): the GC Messages build (cuts 1 to 10, for trade partners, architects and the
customers of GC projects) and the residential build (cuts R0 to R9, the plumbing company's own customers, leads, subs,
supply houses and candidates on the same spine). The per-version record is `docs/recent-features/v2.5247.md` onward;
the design is the plans named at the end of this page.

## Where it is in the app

| Surface | Route | Who | Code |
|---|---|---|---|
| Messages, the office's one page | `/messages` (`?kind=` pills, `?thread=<contact id>&at=<message id>`, `?answer=all` opening Answer all since v2.5816) | the office team (`canOpenMessages`) | `src/pages/Messages.tsx`, its sections in page order, each with its own kernel and read under `src/lib/messages/`: the owner's **Finish switching Messages on** card (v2.5712, `components/messages/SwitchOnCard.tsx` over `switchCard.ts`), **Show** Mine · Everyone (v2.5713, `showLens.ts`, kept per browser), the search box and **Lines that match** (v2.5701, `searchLines.ts`; `?q=` since v2.5708), **The last 7 days** (v2.5715, `WeekStrip.tsx` over `weekStrip.ts`, its own fourteen-day read), **the jump strip** (v2.5799, `MessagesJumpStrip.tsx` over `jumpStrip.ts`: the Pipeline's stage bar over the lanes with the headings' own counts, pinned, the lane being read lit, a press scrolling to the lane), since v2.5801 all of the top in **one bar** (`MessagesTopBar.tsx` over `topBar.ts`: the kind picker, Show, the search glass that opens the box, the strip, and 7 days opening The last 7 days per browser; pinned on a desktop, the controls scrolling away on a phone; since v2.5802 a **?** whose card, `LaneLegend.tsx` over `laneLegend.ts` and `followUp/laneNotes.ts`, says what each lane holds, the lanes' headings being bands in their colors with the count in a pill, `FollowUpSections`' `laneLook: 'bands'`), Follow up's queues (folding on a phone when nothing waits, v2.5708, `queuesFold.ts`; **Answer all** on Needs a reply, v2.5716, `followUp/AnswerAllDesk.tsx` over `followUp/answerDesk.ts`), **Waiting on them** (v2.5704, `WaitingOnThem.tsx` over `waitingOnThem.ts`, thirty days of lines), **Went out**, every text and email we sent in the last 7 days (v2.5686, `WentOutToday.tsx` over `wentOut.ts`; emails and the Both · Texts · Emails filter v2.5707, Quo's delivery mark v2.5703), and **Everyone we have talked with** behind Show everyone (v2.5700, `everyone.ts`); the full view (`useMessagesHost`'s `enabled`) loads only for Everyone, a search or the desk; the route also takes `?q=` and, on a thread, `?nudge=text|email` (v2.5714) |
| Messages → **My email** (punch list #230 PR 3, v2.6274): the person's own Inbox and Sent read live and kept nowhere until a tag, **To tag · Tagged · All**, the search, the notices behind one fold line, the guess with **Yes**, **Tag…** through the job picker, the reader with **Untag**, *Who is this?* for a sender a tag could not place; no count, no unread, no reply | `/messages?tab=my-email` (`?view=tagged` or `all`, To tag the default; `?q=` read as Gmail's own search on this tab), the tab drawn in the bar while the person's `users.my_mail_on` is on | the office team (`canOpenMessages`), each person their own mail alone: `gmail-mine` reads the signed-in person's `users.email` and no other address | `src/components/messages/myMail/` (`MyMailTab.tsx`, `MyMailListRow.tsx`, `MyMailReader.tsx`) over `src/lib/myMail/` (`tab.ts`, `list.ts`, `reader.ts`, `picker.ts`, PR 1's `contract.ts` and `view.ts`) and `myMailIo.ts`, the page holding `useMessagesHost` open for the picker's jobs and a tagged line's thread; the switch and the labels left out are Settings → Your account → **My email in Messages** (`components/settings/MyMailCard.tsx` over `settingCard.ts`, saved through `my_mail_set`) |
| GC projects → Messages, Follow up, the boards, Papers, Money | `/gc?view=messages` (since v2.5717, punch list #140 PR 9, the **Messages** pill is a link to `/messages?kind=trade`, `GC_MESSAGES_PAGE_HREF`; the view still draws for `?view=messages&thread=` links in the wild), `?view=followUp`, … | the office team (`canOpenGcProjects`); Money the money team | `src/pages/GcProjects.tsx` |
| The thread window (every door opens the same one) | over either page | the office; a tech through Job Mode's door | `src/components/gc/messages/ThreadWindow.tsx`, `openThread.ts`, `useMessagesHost.ts`; since v2.5698 our estimate email's **Open estimate #N** (`components/estimates/useEstimateDoorThreadSlots.tsx` over `lib/messages/estimateDoor.ts`; since v2.5706 our estimate text's too, `estimateDoorIo.ts`'s `loadTextDoors` by the link's token hash); since v2.5703 a sent text's **✓ delivered** / **⚠ not sent** / **⚠ not delivered** (`thread.ts`'s `deliveryMark`, `ThreadLine.tsx`); since v2.5711 a lead's **Book a visit** and **Start an estimate** (`components/messages/useLeadDoorThreadSlots.tsx` over `lib/messages/leadDoors.ts` and `leadDoorsIo.ts`); since v2.5714 a nudge asked in the URL written into the box (`reply/NudgedReplyBox.tsx` over `lib/messages/nudgeDraft.ts`) |
| A job's box, **Note · Text · Email** | a job's window on the Pipeline | the office | `src/components/jobs/JobCustomerBox.tsx` over `reply/ReplyBox.tsx`; since v2.5895 the Job tab opens on **Where it stands with ‹name›** (`JobThreadSummary.tsx` over `lib/jobs/threadSummary.ts`, read by `threadSummaryIo.ts`): the newest word in either direction, their written promise and what we owe, stamped, *Where it stands* and *Their word* a door to their line when one is behind them (*Our word* never), the customer named by the name they go by on their thread, else in full (v2.5973), **Keep as a note** the one write |
| The customer's door, **Call · Text · Email · Open their thread · Their record** (v2.5626), the thread's last three lines and the bubble's **waiting dot** (v2.5632) | the speech bubble on a Pipeline row or card, a window over the board; the dot on the bubble itself | the office | `src/components/jobs/JobCustomerSheet.tsx` over `JobCustomerBox`, its rows and last lines from `lib/messages/customerDoor.ts`; the dot `hooks/useBoardDots.ts` over `lib/messages/boardDots.ts` (`flows/stageSends.ts`'s `boardDot` over Follow up's `needsReply`) and `boardDotsIo.ts`, drawn by `MessagesButton`'s `dot` |
| Job activity's message lines | Jobs → Pipeline → a job's activity | the office; techs by the gate (see *Who sees what*) | `src/components/jobs/JobActivityView.tsx`, `src/hooks/useJobMessages.ts` |
| Job Mode: **Message the customer**, the customer's texts in Job updates, since v2.5573 the big button **On my way** / **I'm here** (the office's two press lines, `quick_replies.phone_press`), and since v2.5590 the tech's **bio** as a second text the first time a customer hears from them (`BioPickWindow` to pick the lines for one customer; the memory is `messages.introduces_user_id`; the office writes the bio on the person desk's Bio section, the tech picks the usual lines on Settings → Your account → Your bio) | Job Mode | primary and helpers (`MESSAGES_TECH_TEAM`); the clock-in half of On my way for every Job Mode role | `src/components/jobMode/`, `src/lib/jobModeMessageCustomerIo.ts`, `src/lib/jobModeOnMyWayIo.ts`, `src/lib/jobMode/onMyWay.ts`, `src/lib/bio/` |
| **Tell the customer** (punch list #115): the sheet before a customer's text, and the receipt with the call after — on the schedule (v2.5593, a job's first visit, the office's Booked line filled from the block) and on the estimate (v2.5594, the email and the text with the accept link in one press); **Send in the morning** on a booking (v2.5595) hands the text to the 9 AM run; the receipt's **Add to my calls** (v2.5596) makes the call a task; since v2.5597 the sheet notes the customer's say (`contacts.prefers`), presses itself when My way (`tell_customer_prefs`) says send, offers **Make this the office's line**, and a moved first visit's Rescheduled text waits on Today's sends; since v2.5627 (punch list #123) a forward move on the Pipeline to Working, Ready to Bill or Billed asks the same way while the homeowner flow's step is set to **Asks** (`tellCustomer/moveOffer.ts`) | Add job to schedule, from the job and from the Dispatch hub's picker (`ScheduleJobModal`); Send to customer on a normal estimate (`Estimates.tsx`); a forward move on the Pipeline (`JobsStagesTab`'s `askAfterMove`, on the move hook's `followMovedJob` notice) | the office team (`GC_OFFICE_TEAM`); the send is the reply box's path through `quo-send` | `src/components/customers/TellCustomerSheet.tsx`, `src/lib/tellCustomer/` |
| **Today's sends** (v2.5595, punch list #115): the texts the morning run prepared for the office to press instead of sending (a step set to *Offers* in Flows), and the texts the office handed to a morning; Edit, Send, Send all that are ready, Not this one, Hold until a day, Stop reminding on this job; a held one says why | the Dashboard's Needs you line *Today's sends* (`todays-sends`) | the GC office team (`canOpenGcProjects`); a press is the reply box's path through `quo-send`, then `nudge_offer_sent` | `src/components/dashboard/TodaysSendsWindow.tsx`, `src/lib/offers/`, `nudge_offers` |
| **Call tasks** (v2.5596, punch list #115): the call the receipt suggests, as a task in Follow up → We owe them with the day and the script; Call (since v2.5803 **Call in Quo** or **Call from my phone**, the person's pick on each phone, `CallButton`), I called, Tomorrow, Skip; closed by an answered call Quo logs or, since v2.5710, a call the office logs from the reply box (`log_call`) | **Add to my calls** on the Tell the customer receipt, and the quiet line under a text we sent a customer today on Messages (`useFollowUpThreadSlots` `underLine`) | the GC office team (`follow_up_press`); `quo-webhook` closes as the service role | `src/lib/calls/`, `src/components/followUp/FollowUpSections.tsx` (`CallRowView`), `call_tasks`, `flow_steps.call_script` |
| Settings → Phone and texts | `/settings?tab=settings-phone-texts` (each card an anchor since v2.5712, `#settings-phone-texts-<card>`, which `settingsDeepLink.ts` maps to the tab) | the office reads; the owner or a dev flips the switches, pastes the Quo key (v2.5718, the **Quo connection** card above Company phone seats) and, since v2.5709, sets the **Office hours** (`isOwnerOrDev`) | `src/components/settings/` cards over `src/lib/quo/*Card*.ts`, `src/lib/messages/*Card.ts` and `*Io.ts` |
| Settings → Flows | `/settings?tab=settings-flows` (`&kind=` opens that flow since v2.5712, `kindFromParam`) | the office edits (`canEditFlows`) | `src/lib/flows/editor.ts`, `flowEditorIo.ts` |
| Settings → What customers see | `/settings?tab=settings-what-customers-see` | the office | `src/lib/portal/customerPageWords*.ts` |
| The customer's portal, Messages tab | `/portal?t=<token>` | the customer, no login | `src/pages/CustomerPortal.tsx` over the `customer-portal` function |
| The trade partner's portal | the portal link in the invite email | the trade partner, no login | `src/pages/GcTradePortal.tsx` over `gc-trade-portal` |
| A kept file's lasting link | `/files/<source>/<id>` (`messages`, `drive`, since v2.6095 `bills`: a supply-house bill dropped on the Add invoice window, `/files/bills/<invoice id>`, the path read off the row's `bill_read`) | anyone signed in whom the file's row lets read | `src/pages/FileOpen.tsx`, `src/lib/files/fileRoute.ts` |
| Quickfill → Messages, the round's second station (v2.6098, punch list #178; the Texts station of v2.5816 folded into it, `/quickfill#texts` landing here) | `/quickfill#messages` on the page and in the Roller | the office team (`canOpenMessages`; anyone else keeps the note alone) | `src/components/quickfill/QuickfillMessagesSection.tsx` over `src/lib/quickfill/messagesStation.ts` (the page's lanes with their counts, each a door to `/messages#<lane>`, which the page lands on; the badge's count; the Next line; the Mark's note) with the Texts ledger folded under the lanes (`QuickfillTextsSection.tsx` over `textsLedger.ts`: Needs a reply narrowed to texts, Not delivered, Went out today); one read, `messagesStationIo.ts` through `textsLedgerIo.ts`'s `readTextsLedgerSources` and `queueFromRows`, Follow up's `loadQueue` and Went out's `loadWentOut` and nothing of its own; the hook `useQuickfillMessages` at page level in `Quickfill.tsx`, re-reading on `useMessagesLive` |

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
with one channel until **Who is this?** names it (`name_contact`), which re-points the contact and keeps its thread. One of
our own numbers or addresses never becomes one: the readers place it only while the walk kit's contact carries it
(punch list #142, v2.5726, `walk/kit.ts`'s `numberPlan` and `kitCarries`), and skip or ignore it otherwise.

- `contact_channels` — a phone number or email that is theirs, with the opt-out (`opted_out_at`, and per box since R6,
  `opted_out_by_box`, because a carrier's STOP is per number pair).
- `contact_jobs` — the association to a bid, a GC project or a Pipeline job (`jobs_ledger`), one default per contact.
  A line's job is its own column; the tie moves with `tie_message`. The jobs a person is on *by the facts* (an invite,
  a quote, a dispatch) sit beside the ones the office tied (`src/lib/messages/factJobs.ts`).
- `messages` — one row per call, voicemail, missed call, text, email, team note, event or portal line: `contact_id`,
  the job keys (`bid_id`, `project_id`, `jobs_ledger_id`), `channel`, `direction` (in, out, team), `who_user_id` or
  `who_text`, `at`, `subject`, `body`, the source id (`quo_id`, the RFC `Message-ID` for email, since v2.5705 `estimate:<id>:opened|accepted|declined` on the estimate's event lines, unique so a resend never
  doubles), `delivery` (Quo's answer on our sent text, read on the client since v2.5703), `mailbox` (team, bids, or since punch list #230 `mine`, an email tagged from a person's own box, whose `mail_user_id` names), `quick_reply_id` (or `introduces_user_id` on a bio text, v2.5590), `estimate_id`, `office_only`, `optout_line`, `back_on` / `back_by`
  (a note's follow-up day), and cut 5's call columns (recording, transcript, summary, length).
- `message_attachments` — a file as it arrived or went (`bucket_path` our copy, `link`, `sent_as`, `drive_file_id` once
  filed, `paper_answer` once read as a paper).
- `message_highlights`, `message_promises` (what a line was read as: a quote, a start, papers, a payment, with the day; since v2.5710 `said`, the day a person gave on a logged call),
  `contact_owed` (what we owe a person, one open row), `quick_replies` with its uses and versions (and `phone_press`, the one live On my way and I'm here line each, v2.5573), `user_bio_lines` (a tech's bio, v2.5587), `nudge_offers` (Today's sends, v2.5595), `call_tasks` (v2.5596), `tell_customer_prefs` (My way, v2.5597) and `email_tag_threads` (punch list #230, v2.6266: a Gmail conversation a person tagged onto a job from the My email tab, which reads their own box only while their `users.my_mail_on` is on; read by the office team, written by `gmail-mine`).

The kernels are `src/lib/contacts/` (`kernel.ts`, `names.ts`, `load.ts`) and `src/lib/messages/`: `thread.ts` (one
thread per person, the rows and the move line), `stamps.ts` (their last word and ours), `load.ts` and `jobKeys.ts` (the
rows as the screens load them), `compose.ts` and `textOut.ts` (the reply box's words and the rules for a text going
out), `owed.ts`, `promises.ts`, `jobTiles.ts` (a job as the thread names it), `listRows.ts` (the Messages list), and the page's own since punch lists #139 and #140: `everyone.ts`, `searchLines.ts`, `queuesFold.ts`, `waitingOnThem.ts`, `wentOut.ts`, `weekStrip.ts`, `showLens.ts`, `switchCard.ts`, `officeHoursCard.ts`, `callLog.ts`, `leadDoors.ts`, `nudgeDraft.ts` and `estimateDoor.ts` (each with its `Io.ts`), with `followUp/answerDesk.ts`. The
reads and the presses are `messagesIo.ts`. The SQL doors are the definer functions a migration under
`supabase/migrations/202610*` names: `name_contact`, `tie_message`, `contact_for_customer`, `contact_find_or_make`,
`contact_for_channel`, `contact_set_off` / `contact_put_back_on`, `edit_quick_reply`, `quick_reply_step`, `set_quick_reply_press`, `edit_bio_line` / `bio_line_say` / `bio_opener`, `contact_set_prefers`, `call_task_add` / `call_task_done` / `call_task_move`, `nudge_offer_make` / `nudge_offer_sent` / `nudge_offer_dismiss`, `log_call` (v2.5710, the one definer among Follow up's presses), and the flow
and nudge functions below. Every table carries the three fences (`CLAUDE.md`).

### Lines from other systems

The thread is not only `messages`. Five readers turn what main already keeps into lines, each pure and each with its
test: `sentLines.ts` (every email the app sent through `sent_documents`, `docs/SENT_COPIES.md`), `appLines.ts` (the
app's own automatic sends, marked as the app's), `legalLines.ts` / `legalRoute.ts` (the Lien desk's notices and where a
reply after one goes), `activityRows.ts` (a job's activity in the thread, behind the thread's switch), and
`sheetLines.ts` (a sub's lines on their sheet). A new source of lines is a fifth reader of the same shape, merged in
`load.ts`; it is never a write into `messages`. The one exception is the app's own event line, the morning run's shape (`channel 'event'`, `direction 'team'`, `who_text 'The app'`, keyed on `quo_id` with `ignoreDuplicates`): since v2.5705 `get-estimate-for-customer` and `accept-estimate` write the customer's open, accept and decline of an estimate that way (`_shared/estimateEventLine.ts`, pure, and `estimateThreadLine.ts`, which finds the customer's contact through `findPageContact` and never makes one), so the thread shows *👀 opened*, *✍️ accepted* and *🚫 declined* between our email and their reply (since v2.5934 `job-rating` writes the customer's rating the same way, `_shared/ratingThreadLine.ts` over the pure `ratingEventLine.ts`, keyed `rating:<id>:answered|score:N|words|google`: *⭐ Dana left 5 stars on job 1312.*, ⚠ below four, their words, and the Google press); the search and the last-line reads skip event lines, as they skip the run's.

## The thread window and its slots

`ThreadWindow.tsx` owns the layout: the header (name, the jobs rail, ☎ and ⋯), the move strip, the day rows, the lines
(`ThreadLine.tsx`, `LineFiles.tsx`), and the foot. **Everything a later cut draws inside it is a slot**
(`threadSlots.tsx`, `ThreadSlots`): `headerRight`, `statusRow`, `aboveLines`, `menuRows`, `aboveBox`, `box`,
`underLine`, `lineBody`, `side` (cut 4's flow rail; since v2.5797 nothing while the sender's kind is `unknown`), the message window's first slot and, since v2.5710, `court`, a slot that returns facts rather than something to draw (`CourtFacts`: what we owe, a written promise's day), merged field by field with the later cut winning and spread into `courtOf`, so the chip reads *Their move · until Fri Oct 9 · their word*; Follow up's hook fills it from the read it already makes (`courtFactsFromRows`). A slot is a function of the person or the line
that returns what to draw; an empty slot draws nothing. Cut 2's heard-day offer under a line was never drawn; since
v2.5649 (punch list #129) `underLine` carries **Write down their word** under a customer's own call, voicemail, text or
email (`useFollowUpThreadSlots`, `messages/wordFromLine.ts` over `list_customer_money_strip`): the Pipeline's promise
sheet on the line's job, else the customer's one job with money open, else a pick, the name and the channel filled in. `useThreadSlots` merges the cuts in order — cut 2's Follow up
pieces, cut 3's reply box (the nudged one since v2.5714), cut 4's flow rail (not mounted while the kind is `unknown`, v2.5797, punch list #149 PR 3: the placeholder flow seeded for an unnamed sender has one step, *Who is this?*, which the pill beside the name and the sort card already ask; the rail appears the moment they are named and their kind's flow applies; the seed and its `named` fact are untouched), cut 4b's change order, R8's estimate line, the estimate doors (v2.5698, v2.5706), cut 6's paper offer, a lead's doors (v2.5711, in `aboveLines` while the kind is `lead`), R7's sort
card — so the page never changes for a slot. **To add something to the thread, add a slot there and nowhere else.** What `aboveLines` draws has its own scrolling
wrapper (`data-thread-above`, v2.5570): a card taller than the room shrinks and scrolls before the lines and the box do.
Keys inside the column are prefixed per slot (`reply:`, `flow:`, `new-lane:`), since the slots are siblings.

The header's second row says what the person is to us (*Customer: Acme*); for a number nobody has named it reads
`unnamedWords` (`contacts/names.ts`: *A number nobody has named*, *An address nobody has named*, *Nobody has named
them*), and the blue **Who is this?** under it is the header's only one (the lanes' rows — **Went out**, **Waiting on them**, **Lines that match** — name an unnamed person by the way the line went, `unnamedOnLine` beside it, v2.5994: an email *An address nobody has named*, any other channel or none *A number nobody has named*; the week strip's waits and Quickfill's texts ledger keep *a number*; v2.5541; since v2.5811 it sits on the sort card while the card asks who, and the header drops it meanwhile). Its ☎ link, the dim *No number to
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
(Text · Email · Note and, since v2.5710, **Call**, or one kind; a job's box offers no Call: `callLog.ts` and `compose.ts`, the dial line above the box, what they said, the day they gave as a `said` promise, Their move or Our move, **Save the call** through `ReplyIo.logCall` → `followUpIo.logCall` → `log_call`, which `messages_move_state` reads as a reply and which closes the person's open call tasks), the quick replies strip (`QuickRepliesStrip.tsx`, the editor with its phone block's **Big button on Job Mode**, **Find a reply**; on a job's box since v2.5629 the lines on the job's stage lead under **For this stage**, `stageStepIds` from `messages/stageLines.ts`, the app's own words standing in for a step with no team line, and the strip opens on its own unless folded by hand, reading its lines as it appears since v2.5639 (one `stripShown` both draws and reads; a strip folded by hand reads nothing); a line's `{bill}` fills with the pay page of the job's newest bill billed through Stripe, `billing/billLink.ts`'s `newestBillLink` read once per job by `JobCustomerBox`, v2.5628, and since v2.5641 the bill a line about money speaks of, with its `{amount}` and `{number}`, from the customer's papers, `messages/papers.ts` over `papersIo.ts`, read when the lines are (`usePapers`), and since v2.5642 listed after the lines when the `/` words call them (`slashPaperKind`, `listedPapers`), a pick putting in a line about that paper; since v2.5643 estimates too, a line's `{estimate}` a link made for the message (`messages/estimateLinkIo.ts` over `share_estimate_link`, the emailed link untouched; since v2.5992 **Extend good-through** pushes these links' `expires_at` to the end of the new day too, `20261027220000`; since v2.5645 the line goes in at once with its blank and the link fills it through the box's current text, a later press superseding a share still out, a job's box speaking of its own estimate, `defaultEstimatePaper`, and an approved estimate taking the app's copy words; since v2.5877 a line's `{rate}` the same way — a one-tap rating ask minted for the message, `ratings/ratingLinkIo.ts` over `mint_customer_rating`, the customer answering at `/rate?t=` (v2.5876) and the send waiting while the link is made; since v2.5943 the box's opening words mint it too, so the Review asked step's **Nudge** opens with the link made); a `/` typed at the start of the box or after a space opens the same lines above it by keyboard, `reply/SlashList.tsx` over `quickReplies/slash.ts`, v2.5637, a line's own `/` word first since v2.5638, `quickReplies/shortcut.ts`),
the textarea with the opt-out line and the count, **Attach** (`AttachPicker.tsx` over `attachIo.ts`, `replyFiles.ts`),
**Tie to**, and the send window (`SendWindow.tsx`). What it sends is one interface, `replyIo.ts`, so the smokes hand it
a fake. While texts are off (`useTextsOn`), the Text kind draws the wait line in place of the composer (`TextsWaitLine`: the switch is the first card on Settings → Phone and texts, a link for the owner or a dev; v2.5538). A nudge asked in the thread's URL (`?nudge=text|email`, v2.5714, `useThreadWindow`'s `OpenThreadMore`) fills the box once with the step's reminder as the morning run would send it (`NudgedReplyBox.tsx` over `nudgeDraft.ts`'s `nudgeDraftFor`, `nudgeLine` over the step on now and the team's quick replies) and opens the send window once, a text, or an email when the text cannot go.

## Follow up

`src/lib/followUp/queue.ts` is the queue: one row per person, Open · Snoozed · Done, who has it (`has_user_id`,
`has_how`), the move line, and the lanes the screens group by — **New** (R7, what came in and still needs sorting:
`newLane.ts`, **Sort all** in `sortDesk.ts`; since v2.6222 (punch list #223 PR 3) a fourth sort ahead of the three, **Bid it?**, on an email in that `emailIn/invitation.ts` read as an invitation to bid (`messages.invitation`, written by the reader through `email_write_line`; an older line read again by the client, `newLaneRows.ts`'s `lineInvitation`), the row's press in the estimator's purple, the card's `BidBody` with the **Bid** field, *Start a bid on …* per customer the sender may be (`bidCustomerChoices`, `start_bid_from_message`, then `bidHref` to the Bid Board), *Make the customer and start the bid*, *Not for us* with its reason and *Keep it* (`answer_invitation`), the reader handing the thread to the trade seat when nobody has it; since v2.6231 (PR 4) a subject that names a live bid lands the line on it (`bidInSubject`, read in `gmail-sync`'s `jobFor` after the numbers and the sender's own names, before the star), an unnamed sender's addendum so landed making no row, and the notices the reader set aside (`email_set_aside`, written by the reader for a marked sender or a body cue; `followUpIo.loadQueue`'s soft read, seven days, through `useFollowUpQueue`'s `setAside`) fold under New's rows (`FollowUpSections.tsx`'s `SetAsideFold`, `setAsideFold.ts`'s words) with **Put back** (`email_put_back`, which the next run takes with `takeOne(…, putBack)`); since v2.5793 a row's one press is the sort's question, *Who is this? ›*, nothing repeating it under the words, before the name since v2.6191 with the address or the number the line came from after it (`NewLaneRow.reach` by `rowReach`, the card head's `reachWords` rule, '' for a row named by its number or address; `FollowUpContact.channels` carries them in); since v2.5798 the card's head asks about the sender, *Who is Dale Ferris, dale@ridgeway.example?* (`newLane.ts`'s `whoHead`: `senderFacts`' name, then the address or the number as 512-555-0142, the line's channel first; the row's pill and the thread header's button keep the short words, the name beside them); since v2.5811 a *new trade partner*, a *supply house* and a *candidate* are made by the press too (`makesRecord` on the guess, `newLaneCardIo.makeRecord`: `gc_add_company` with the trade picked, a `supply_houses` row with the sender as its default rep, a `team_prospects` row under no role), the blue *Who is this?* sits on the card while it asks who (`acts.whoDrawn`, the header dropping its own), `laneRowFor` draws no card for an `OFF_FOLLOW_UP` kind, and the thread's side folds under the × with ‹ › (`SideActs.has` from the rail's `onHas`, by itself when the kind has no flow, `noFlowWords` when opened); since v2.5795 the *Who is this?* card opens on both boxes with **A customer we know**, the customers the sender may be and why (`customerLink.ts`'s `customerMatches` over `senderFacts`: the address or number on a customer or a person at one, a bid or a job that names them, which takes the thread through `name_contact`'s job, the name, the company's domain, each read of `newLaneCardIo.loadKnown` failing soft), and **A new customer** as one live press, `makeCustomer`, the lead doors' insert then `name_contact`, a company typed in the field becoming the customer with the sender as its person), Needs a reply (since v2.5716 **Answer all** on its header, `answerDesk.ts` and `AnswerAllDesk.tsx`: a desk built like Sort all that walks the lane one person at a time with the reply box, the person pinned so a live re-read never swaps the card, on `/messages` alone since the page holds whether it is open through the panel's `answerAll` prop; a lead's row carries **Book a visit** and **Start an estimate** since v2.5711, `needsReply`'s acts through the panel's `leadIo`; a logged call reads as a reply and clears the row), We owe them (`owed.ts`; since v2.5596 the call rows too, `FollowUpQueue.calls` from `callTasksFromRows`, `CallRowView`), They owe us (`theyOweUs.ts`). On `/messages` the page's `narrow` composes `queueForShow` (v2.5713, `messages/showLens.ts`: Mine keeps the people whose `hasUserId` is mine, Everyone the queue as built) over `queueForPill`, the whole queue still counted through the panel's `onQueue` and `onCount`. **Waiting on them** (v2.5704, `messages/waitingOnThem.ts`) is the other direction and sits outside the queue: the people whose newest line is ours and two days old.
`team.ts` says who a conversation can be handed to; since v2.6228 a hand-off pushes the person it went to (`followUpIo.handTo` calls `messages-notify` with `{ handed: { contact_id } }` after `hand_to`, the function checking the hand is fresh and the caller's; the words are `messages/handedPush.ts`, the person's push hours kept, one `notification_history` row as `message_handed`) and a thread's ⋯ has **Send as task** (`messages/threadTask.ts`: Add a task with the thread on its bar, link [1] the thread at the line); `assignSeats.ts` is **Who gets a new message** (the rule and its
seats, `app_settings.messages_assign_rule_v1`; the walk kit's contact goes to nobody, `walkKit`, v2.5728); `hasRule.ts` is R5's answer to who answers a customer's reply (the tech
who last texted them until 5 PM, `has_until`, then the office in its hours, or at any hour under the Office hours card's
around-the-clock switch, v2.5721). The screens are `src/components/followUp/`
(`FollowUpPanel`, `FollowUpSections`, `WhoHasItPill`, `OwedStrip`, `SettlingNote`, `NewLaneCard`, `SortAllDesk`, `AnswerAllDesk`; since v2.5332 `NudgesFromTheFlow` over `useFlowNudges`, whose *Text Greg* and *Email Jonah* open the thread with the nudge written since v2.5714) and the
two slot hooks that put them in the thread. The Dashboard's Customers line (and `follow_up_count`; since v2.5596 a customer with an open call counts once) counts from the same reads
(`customerCounts.ts`; on Quickfill the line is carried by the Messages station since v2.6098, which counts the people waiting on us once; v2.5823's `textsElsewhere` flag stays on the kernel, unused by a host).

## Flows, steps and the morning run

A **flow** is one per kind (`flows`, `flow_steps`, seeded by `src/lib/flows/seed.ts`; `flowsSql.test.ts` pins the seed
to the newest migration). A step has a lane (once, per job, any time), whose move it is, the facts that finish it, the
papers it turns on, and its nudge (after how many days, how, and whether the app may send it: off, offers or sends; since v2.5943 the residential **Review asked** step carries the one reminder on our own move, counted from the day Paid turned true and held while the customer waits on us, `nudges.ts`'s `afterPrior`; since v2.6007 it is finished by the rating link the text carries, `residentialLoad.ts`'s `isReviewAskText` over `ratings/ratingAsk.ts`, and a job the customer answered is never asked again from the run or from Today's sends) and since v2.5596 its call script (`call_script`, `call_script_es`, `suggest_call`). **State is never stored**:
`flows/state.ts` (`readFlow`) reads where a person stands from the stamps `flows/load.ts` and `residentialLoad.ts` (wired for a `residential` contact since v2.6232: `person.ts` picks `residentialStampsFor` when `FlowRows.residential` is there, the Pipeline rows read beside `flow_rows_for` — days and marks, never an amount — by the step card's `flowPersonIo.ts` and the run's `nudgeRunReads` through `flows/residentialRows.ts`'s `PIPELINE_SELECTS` and `residentialRowsOf`; without them the lanes read empty, as before)
gather out of the rows main keeps (invites, portal opens, signed papers, quotes, draws, schedule blocks, clock sessions,
reports). The facts a step may pick from are **one list in code**, `flows/facts.ts`; a fact that is not there cannot be
picked, and the SQL (`flow_fact_ids`, `flow_facts_ok`) refuses one it does not know.

Around the read: `card.ts` (the step card in plain words), `nudges.ts` (the reminders due), `panel.ts` (the rail beside
the thread and the panel it opens to), `now.ts` (where one person is, in a line, for the quick replies), `going.ts` and
`goingInputs.ts` (**How it is going**), `board.ts`, `boardRead.ts` and `flowsIo.ts` (the boards over `flow_rows_kind`,
the office's one read), `editor.ts`, `editorKinds.ts` and `flowEditorIo.ts` (Settings → Flows, `flow_save`,
`flow_paper_create`, the history), `jobPapers.ts` (Papers on this job), `portalPage.ts`, `portalSteps.ts` and
`customerMove.ts` (the customer's side), `stageSends.ts` (R4, the stages a residential customer feels; its felt moves are the board's ask since v2.5627, `tellCustomer/moveOffer.ts`), `callScripts.ts` (the seeded scripts, v2.5596). A step's note goes
through `flow_add_note`, a skip for one person is `contact_step_skips` (`flow_rows` reads it back from either job column, `project_id` or a Pipeline job's `jobs_ledger_id`, since v2.6028, so Put it back finds a residential customer's skip), and a wish for a missing fact is `flow_fact_wishes`; a press names a residential customer's job a Pipeline job and anyone else's a GC project (`person.ts`'s `pressJobOf`, v2.6016 — before it every press said GC project and `contact_job_check` refused a Pipeline job's id).

The **morning run** is `messages-nudge-dispatch`, fired by the cron `messages-nudge-dispatch` at 14:00 and 15:00 UTC
with `X-Cron-Secret` from the vault. Its decisions are the kernels' (`nudgeRunInputs.ts`, `nudgeDispatch.ts`,
`nudgeRunLog.ts`, copied to the edge; `nudgeDispatch.ts`'s `nudgeLine` is the one place a reminder's words come from, the thread's Nudge drawing from it since v2.5714, when the residential Approved and Paid steps gained lines of their own): everyone's flow, the steps due, what was already sent (`nudge_sent`, never
doubled), what is held (`nudge_holds`, **Hold until Mon**), and the per-step switch
`app_settings.messages_nudge_app_sends_v1` — **off until the owner turns a step on** (the plan's decision 3); since v2.5595 three ways per step, off, **offers** (`'offer'`: the run writes the text to `nudge_offers` for the office to press on the Dashboard's Today's sends, held with why when the number is missing, sent STOP or asked for email, v2.5597, or, since v2.6079, when the line still holds a blank the run cannot fill, `blanks left`, with the door to the thread where the box fills it; the run fills `{first}`, `{job}` and `{link}`, and since v2.6224 `{amount}`, `{bill}` and `{number}` from the step's job's newest open bill through the box's own `messages/papers.ts` and `defaultPaperFills`, a bill outside Stripe leaving `{bill}`; on sends a line with a blank left is kept back under the same reason after the person's own, the words `blanksLeftWords` shared with Tell the customer) and **sends** (`true`), and the run also sends the texts the office handed to a morning (Send in the morning, `prepared_by` office with a `send_on`); a moved first visit's Rescheduled offer has no `send_on` and waits for a press, and an email-only person's text is kept back (`prefers email`, v2.5597); the walk kit's contact is left out of the morning entirely while a walk is set up (v2.5728, punch list #142 PR 6: `nudgeRunReads`' `walkKitContactId`, the kit read once per run). Since v2.5943 a review text the run sends itself gets its `{rate}` link minted by `_shared/ratingMint.ts` (a fresh unanswered ask is reused; a job already answered is kept back with *they answered the review already*), and an offer keeps the blank for the press, which keeps an answered job back the same way since v2.6007 (`ratings/ratingAsk.ts`, the one rule every door keeps; the run keeps such an offer back too). A residential customer's text, its `nudge_sent` row, its event line and its offer file on the Pipeline job's `jobs_ledger_id`, a GC person's on `project_id` (v2.6007, the run's `jobAtFor`; `person.ts`'s `jobOfMark` reads a hold, a reminder or, since v2.6016, a step note from either column, and the step card, Follow up and the run select `jobs_ledger_id` beside `project_id`). The run
writes its summary to `messages_nudge_last_run_v1`, which Settings → Flows reads as *Last morning run …*. The first run
fired 2026-10-14 with nothing switched on: *no text went, none kept back*.

## The channels

**Texts, through Quo.** `quo-webhook` takes every event of our numbers (signature checked, `quo_webhook_ids` keeps a
replay out) and lands it in the sender's thread as a line, keeps a picture that came with it (`mediaKeep.ts`, then the
`photo-save` sweep every five minutes files it to the job's photos), and answers HELP and STOP itself (since v2.5597 the one-word EMAIL or TEXT too, `PREFER_WORDS` → `contacts.prefers` with a gray line, and since v2.5596 an answered call closes the person's open call tasks, `call_tasks_close_by_call`, as a call the office logs does since v2.5710). `quo-send` is a
text going out: from the reply box's send window, from a job's box, and from Job Mode (`techSend.ts`, R5: the line with `fills: { minutes }`, and since v2.5590 `kind: 'bio'` with the picked line ids, composed by `composeBioText`); a contact tied to a prospect and not to a customer is refused until the prospect's `ok_to_text` is yes (`textRefusal`, v2.5606). The events come from Quo webhook 43696, made through Quo's API (version 2026-03-30), which Quo's settings page does not list; its key and how to rotate it are in `MESSAGES_SWITCH_ON_HANDOFF_2026-10-14.md`. Both are
gated by **Send texts** (`messages_texts_on_v1`, Settings → Phone and texts; the owner or a dev), paused while Quo will
not take one (`paused.ts`), and read the company phone seats (`messages_quo_seats_v1`) and the two boxes
(`messages_boxes_v1`, R6: the team's number and bids@'s, one inbox). The pure parts are `src/lib/quo/`; the edge
function reads, writes and calls.

**Calls, through Quo** (v2.5803, to-do #152). Quo's API has no door that places a call for a person, so every Call in
the app is `CallButton` (`components/messages/CallButton.tsx`) over `quo/dial.ts` (its one read `dialIo.ts`, the seats and the boxes once a page load, shared by every button): `tel:` for anyone with no seat; for a
seat holder on a phone, the first press opens a sheet with the two ways, Quo's own link (`openphone://dial?number=…&from=<the box's number>&action=call`, the box the thread texts from) or `tel:`, the pick is kept per browser (`messages_call_through`, read by `useCallThrough` for every button on the page at once) and a ▾ beside the button brings the sheet back; on a desk `tel:` with the one-time default-calling-app words a ▾ away. The button says *Call in Quo* only when that is what it does. Since v2.5904 the button takes a `site`, and a press that dials writes `call_pressed{#surface=<site>}` as the signed-in viewer (`recordCallPressed`) — the main link and a way picked on the sheet, not the sheet's own open; `CallPhoneButton` does the same, the pay page passes no site, and Quickfill's Texts station passes none either, so those presses write no row. A call made in Quo lands by the webhook as any Quo call does and closes the call task; the seat is the person's own or the one shared by the office. Nothing on the server.

**Email out** is `messages-email` from the reply box to one of the person's addresses, a plain email since v2.6038 (`buildPlainMessagesEmail`: the words as typed with the greeting the box pre-types, the signature kept on Settings → Your account with two lines of the person's own, nothing after it; the From the company's name on `EMAIL_FROM`, the Reply-To the box); the GC senders (`gc-trade-email`,
`gc-customer-email`, `gc-architect-email`) and the notify and send functions already keep every copy in
`sent_documents`, which the thread reads back as lines. **Email in** is `gmail-sync` (cut 6): the bids@ reader, under a
service account's delegation, every minute (v2.5719) while **Read bids@** is on (`gmail_sync_on_v1`, `gmail_sync_state`),
and since v2.6275 (punch list #230) `gmail-mine`, which reads a person's own Inbox and Sent live for the My email tab under the same delegation and writes a Gmail conversation's lines (`mailbox` `mine`, the `.eml` beside each) only when they tag it onto a job;
each email lands in its sender's thread with its files as `message_attachments` (a copy one of us forwards, on its first sender's, with the forwarder's note as a team note and the job from the forwarded mail's own subject, not the forward's: `emailIn/forwarded.ts`, taught since v2.6257 by the guide *tag an email onto a job from Gmail*), and a file that reads as a trade
partner's paper is offered under its line (`PaperOffers.tsx`) until someone answers it. A teammate's mail lands too
since v2.5722: on their Our team thread, or, copied to the box on a mail to a customer, on the customer's thread as
ours (`emailIn/emailLine.ts`'s `emailParty`); a sender the office marked **A notice, not a person** on the sort card (v2.6202, punch list #223 PR 1: `email_left_out_senders` through `mark_notice`, read once per run with `emailIn/leftOutSenders.ts`) is left out before the address is placed; only the boxes' own addresses and the app's sender are left out as ours,
and one of those is a person only while the walk kit's contact carries it (punch list #142, v2.5726: `walk/kit.ts`,
`messages/ownChannels.ts`), so the kit's reply from bids@ lands on the kit's thread and real mail never moves. **Email counted** (v2.5814, punch list #159): beside the taker, `gmail-count` (PR 2 of the train) sweeps the boxes and labels on `email_box_watch` under the same delegation with Gmail's metadata-only scope for Quickfill's Email station, keeping each thread's sender, subject and dates in `email_box_threads` and the day's trend in `email_box_days`, never a body; it writes nothing to Gmail. The kernels are `emailIn/countedBoxes.ts` (the list, not `readerBoxes.ts`), `labelSweep.ts` and `labelFacts.ts`.

**The portals.** The customer's page (`customer-portal`, cut 8 and R8) draws **Your move** and **Where you are** from the
flow read on their side, the money story, the papers, and a Messages tab whose write is a portal line in the thread;
the words are the office's (`customer_page_words`, Settings → What customers see). The trade partner's portal
(`gc-trade-portal`) carries the papers to sign and the pay application. A sample token (`?t=sample`, `sample-owner`,
`sample-gc`, `sample-done`) draws the page with made-up rows and saves nothing.

**Push.** `messages-notify` pushes a customer's, a lead's or a sub's reply to whoever has it (R5, `notifyRule.ts`,
`notifyPlan.ts`), driven by the `messages-reply-push` cron every minute while **Reply push** is on, and tells the
people a clause change waits on. The holder hears once more at 50 minutes when still nobody has answered, ten before
the strip's hour, never after hours (`BREACH_MINUTES`, v2.5875). A line on the walk kit's contact pushes the real dev accounts alone, at once, never
the holder, the office's wait or the after-hours push (v2.5728, punch list #142 PR 6: `notifyPlan.ts`'s kit branch,
the kit read once per run through `_shared/walkKit.ts`). Each person's own hours (**Push me**, `pushHours.ts`,
`user_push_hours`, v2.6026) hold a push for them since v2.6029 (punch list #141 PR 3): the planner splits each due push
with `pushDecision`, a held person gets a `notification_history` row with `channel = 'held'` and no push, the office
hears at once when the holder is off (`message_reply_off`, *Dana wrote to Luis, who is off until 6 AM.*), and a push to
the Customers seat alone widens to the office roles who are on while the seat is off. Every other push the app sends
(a dispatch or estimator request, a marked bid, help feedback, a lien notice, the try-out question, a bid's call-again
day, Ready to Bill, a returned check, a work order, a checklist item or reminder, a filed report) goes through the same
hours since v2.6217 (punch list #141 PR 5): `_shared/pushHoursSend.ts` reads the rows, splits with `pushDecision`,
sends to the people on through `_shared/webPushSend.ts` and writes each held person's row as `held` with the sender's
own `template_type`, which the Dashboard's line names (`heldKind`). The Settings test push alone skips the hours. What a hold did shows on three
surfaces (v2.6060, punch list #141 PR 4): the Dashboard's **While you were off** line reads the person's own held rows
since their hours last closed, one wait per line, a line answered meanwhile left out and named (`messages/whatWaited.ts`
over `whatWaitedIo.ts`, `useWhileOff`, the Needs you key `while-off`); the thread's pill says *off until 6 AM* for the
holder, or *the office is off until 6 AM* when nobody has it and every member is (`messages/whoIsOff.ts`, `WhoHasItPill`,
the team's rows read by the office through `user_push_hours_office_read`, migration `20261029180000`); and the Office
hours card draws the coverage line, and since v2.6154 the coverage grid above it (`messages/coverageGrid.ts`, `CoverageGrid.tsx`: a row per member by the hour, the uncovered stretches as red columns), while the office is open around the clock (`coverageGaps`, `coverageLine`,
`pushCoverageIo.ts`).

**Files.** A file on a line is our copy in the private bucket; its lasting link is `/files/messages/<id>`; **Save to
Drive** (`drive-link`, cut 7b) files it to the job's Drive folder and the link becomes `/files/drive/…`. A reply's files
go out as a file, a link or a picture (`replyFiles.ts`, `sentLineFiles.ts`). Since v2.6276 (punch list #230 PR 5) the
Legal desk's Evidence door **From the job's messages…** reads a collections account's email lines with their files and
puts each email on a matter as an `.eml` (a tagged line's raw copy at `mine/<line id>.eml` as received, else one made
from the line by `lib/legal/evidenceFromMessages.ts`'s `emlOf`), the matter's row naming the line in
`legal_matter_documents.source_message_id`; the desk pulls, and nothing in Messages writes to a matter.

## Who sees what

The teams are in `src/lib/gc/access.ts`. `GC_OFFICE_TEAM` (dev, master_technician, assistant, controller, estimator)
opens Messages and GC projects and edits flows; `isOwnerOrDev` (the client's copy of `is_master_or_dev()`, v2.5709) sets the office hours and sees the switch card; `GC_MONEY_TEAM` sees Money and Bill day; `MESSAGES_TECH_TEAM` (primary,
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
| Quo connection (Quo's API key, pasted once; the seats and the inboxes then pick from Quo's lists, v2.5718) | Settings → Phone and texts, the owner or a dev | Vault `quo_api_key` through `quo-config`; `QUO_API_KEY` the fallback |
| Company phone seats (a Quo seat to a person, or one shared by the office since v2.5548; picked from Quo's members since v2.5718) | Settings → Phone and texts | `messages_quo_seats_v1` |
| Who gets a new message (the rule and its seats) | Settings → Phone and texts | `messages_assign_rule_v1` |
| Inboxes (the two boxes: address, number, number id; the number picked from Quo's numbers since v2.5718) | Settings → Phone and texts | `messages_boxes_v1` |
| The office's wait before it hears a reply nobody answered (0 is at once) | Settings → Phone and texts → Reply push, under the switch (v2.5540) | `messages_office_wait_minutes` |
| Office hours (the days, the open and the close, or the switch *The office is open around the clock*, `always: true`, under which `officeOpen` is true at every instant, there is no next opening or last close, no after-hours answer is due and the kept days and times come back when it goes off; the tech's hour is read back as a line and, with the after-hours number, stays a dev's by hand) | Settings → Phone and texts → Office hours (v2.5709, punch list #140 PR 1; the switch v2.5721, punch list #141 PR 1; `officeHoursCard.ts`, the owner and a dev) | `messages_office_hours_v1` |
| Missed calls (the text back after a call nobody answered, punch list #195: the switch, off as it ships, and the three lines, in office hours, after hours and with a voicemail; `quo-webhook` claims each call in `missed_call_replies` and texts through every gate, its line marked `messages.auto` so it neither clears Needs a reply nor starts Waiting on them; the card lists the last ten with what went or why nothing did, the caller named from the record the thread names, else the number, v2.6036) | Settings → Phone and texts → Missed calls (v2.6012 the text back, v2.6018 the card; `quo/missedReply.ts`, `messages/missedReplyCard.ts`, the owner and a dev) | `messages_missed_call_reply_v1` |
| Reply push | Settings → Phone and texts | `messages_reply_push_on_v1`; the cron `messages-reply-push`, every minute, calls `messages-notify` |
| Read bids@ | Settings → Phone and texts | `gmail_sync_on_v1`; the cron `gmail-sync`, every minute (v2.5719) |
| The reminders the app sends itself, per step: off, offers or sends (v2.5595) | Settings → Flows, on each such step, and Settings → Phone and texts → Reminders the app offers (v2.5720; `messages/remindersCard.ts`, the owner and a dev: every step the app can text across the flows as saved, the same control over the same setting through the Flows tab's io) | `messages_nudge_app_sends_v1`; the cron `messages-nudge-dispatch`, 14:00 and 15:00 UTC; the summary `messages_nudge_last_run_v1` |
| My way: per moment, *Ask me first* or *Send it and show me the receipt* (v2.5597) | Settings → Your account, each office member's own | `tell_customer_prefs` |
| Photos saved on arrival (the tick on a line) | the line | the cron `photo-save`, every five minutes; `photo_saves` |
| The customer page's words and its paper views per job | Settings → What customers see | `customer_page_words` |
| A customer's language | the customer's record | `customers.language` (en, es) |

The reads and the one write of each card are a pair of files, `<card>.ts` (pure) and `<card>Io.ts`, under
`src/lib/quo/` or `src/lib/messages/`.

## The edge, and the copy of the kernels

The functions of the system: `quo-webhook`, `quo-send`, `quo-config` (v2.5718, the key in Vault and Quo's lists), `gmail-sync`, `gmail-mine` (v2.6275, the My email tab's), `messages-email`, `messages-notify`,
`messages-nudge-dispatch`, `photo-save`, `drive-link`, `customer-portal`, `gc-trade-portal`, since v2.5705 `get-estimate-for-customer` and `accept-estimate` for the estimate's event lines, since v2.5934 `job-rating` for the rating's, with `dev-login` for the
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
- **Live, end to end, in one command.** `npm run walk` (`docs/WALK_KIT.md`, punch list #142, v2.5739) runs the whole loop
  on prod on the company's own inbox and number: the kit's customer, the tester's two sends through the app's doors,
  the open from bids@, the email and text replies, STOP and START, the office's view through the screens' own
  kernels, the stray check and cleanup, with a report of what landed where and when. The walk below, pressed by a
  person, is the fallback (`--owner-presses`).
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
  definer functions are the SQL beds CI runs on a bed's change (`supabase/tests/messages_follow_up/`, `30_log_call.sql` since v2.5710). Punch list #140's live checks (Route B, two ZZ rows seeded through the pooler) are in `to-dos/messages-desk/BUILD_PLAN.md` § 3.

## Deploying and operating it

The four tracks of `CLAUDE.md` apply: the client by CI; `supabase db push` for a migration, after its PR is on main;
the functions by hand; the Cloudflare Workers unchanged by this build. What the owner operates by hand: Quo's
webhook 43696 (through Quo's API, never its settings page) and the A2P registration; the switches above; Quo's API key,
pasted once on Settings → Phone and texts → Quo connection (v2.5718; `QUO_API_KEY` is the fallback the senders read while
the vault holds none); the secrets `CRON_SECRET` and `PROJECT_URL` in the vault for the crons; and the morning run's dry
run with the secret before a step is switched on.

## What is still open (as of 2026-10-21)

- **The switch-on**: texts in are live since 2026-10-14; since v2.5712 the **Finish switching Messages on** card on `/messages` says which of the eight are still off; the order is in
  `MESSAGES_SWITCH_ON_HANDOFF_2026-10-14.md`.
- From punch lists #139 and #140: Waiting on them holding a row until the day of a `said` promise (left by v2.5710 and v2.5714); a call task written when Quo reports a failed text (v2.5703, a webhook kernel change); a text tied to no job when its estimate link was re-minted before the job was made (v2.5706); `leadDoorsIo.startEstimate` writing its own draft row instead of `Estimates.tsx`'s `createDraft` (v2.5711); Went out's opened · accepted chip on estimate emails alone (v2.5707); the search not covering the app's own sent emails (v2.5701); and the GC in-page Messages view, which retires once the reply push and Job activity's trade lines point at `/messages` (v2.5717).
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
- `to-dos/press-always-answers/README.md` (punch list #139: the sheet that answers every press, then the page's sections) and `to-dos/messages-desk/README.md` with its `BUILD_PLAN.md` (punch list #140: Messages worked like a desk), the two trains of 2026-10-20 and 21, each README's *Where it stands* reading what shipped.
- The prototypes and mock-ups stay on branch `spike/gc-mode` under `to-dos/gc-mode/messages/` (`prototype.html`
  v1.178 is the GC spec; `customer-messages-prototype.html` and `customer-messages-integrations-mockups.html` the
  residential one; one `*-mockups.html` per screen). Read one with `git show origin/spike/gc-mode:<path>`.
- The words a user reads: the Glossary's **Messages · thread · contact**, **Flow · step · step card**, **Tell the customer**, **Today's sends**, **Call task**, **The customer's say** and **Messages
  (GC mode, the build)** entries; the help guides under Messages in `src/content/help/` (answer everyone waiting on us from one page, find every message with a person in one place, reply from a thread, see who is
  waiting on us, set up the steps a person goes through, turn on texts, choose who gets a new message, set up the two
  inboxes, turn on the reply push, turn on reading the bids inbox, message a customer from Job Mode, sort new messages,
  edit the quick replies, open a job's activity full screen, schedule a job and tell the customer, work Today's sends, call a customer from a task).
