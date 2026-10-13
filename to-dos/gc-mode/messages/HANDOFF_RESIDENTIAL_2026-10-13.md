# Hand-off: the residential Messages build (customer communication)

*Written 2026-10-13, about 22:45 CT, by the coordinating session ("customer-comunication") at the owner's ask. Everything here is on `spike/gc-mode` under `to-dos/gc-mode/messages/` unless a path says otherwise. Read this file, then `RESIDENTIAL_BUILD_PLAN.md`, then `BUILD_HELPERS.md`. The prototype and the mockups are for reference; the plan is the brief.*

## 1. What this is, in one paragraph

The owner wants the plumbing company's own customers on the Messages spine so a tech texts a customer from the job with no misspelling and a customer's reply shows on every active job of theirs. A customer told him "communication from the office has been non existent". The design is `customer-messages-prototype.html` (eight screens, v0.8) and `customer-messages-integrations-mockups.html` (seventeen before-and-after cards, v0.2, with the owner's picks stamped: sixteen Add, history No). The code plan is `RESIDENTIAL_BUILD_PLAN.md`: nine cuts R0 to R9, 46 PRs on top of the GC Messages build's wave 2, 10 migrations, 2 edge functions. Nine helper sessions have been building it since about 20:40 CT. Twenty-two PRs are open, none merged yet.

## 2. The first thing to do

0. **No stamp collision after all** (settled 22:55 CT): GitHub's ledger holds `refs/claims/migration-20261013200000` for #5586 (the sub flow) and `20261013210000` for helper 7's R3 SQL; `npm run claim` had already given helper 7 the next number. The push order is 170000, 180000, 190000, 200000, 210000. The tables below are corrected.
1. **Announce yourself to the helpers.** They are Claude Desktop sessions named "Customer communication helper 1" through "9", reachable by name with `SendMessage` (run `ListAgents` to see them). Tell each: "I am the new lead. Send me your next report." They were told to finish their current piece, open its PR, and wait for the next lead.
2. **Do not touch the merge queue.** Our PRs are queued behind a CI backlog of our own making (about 46 runs at 22:35). A queued PR shows no `autoMergeRequest`; read `mergeQueueEntry` by GraphQL instead. A re-arm on a queued PR does nothing; a dequeue costs its place.
3. **Push migrations in stamp order after each merges**, with `supabase db push` from a checkout with `.env.local` (copy it from a sibling worktree; see the memory file "env-local-file-is-fine-to-use"). Review the landed file first. Run `npm run check:migration-drift` after. The order is in section 6.
4. **Keep the plan current.** Every prepare note that corrected the plan was folded into `RESIDENTIAL_BUILD_PLAN.md` the same hour. Keep doing that; the plan is the one place the next person reads.

## 3. The working loop (how the helpers were run)

- A brief names the files, the exports, the tests, the docs, and what not to touch. The helper answers with a **prepare note** of five lines: the tables and columns it found, anything in the plan that does not match main, and its calls. The lead answers each call with yes or a correction and says **go**. The helper builds, breaks two pins on purpose, runs the narrow typecheck, lint, the eight `check:*` scripts and theme, opens the PR with `gh pr merge --auto`, and sends the number.
- One PR per change; kernel and test first; screens in their own PR; the fragment and release note in every PR; `npm run claim` for versions and migration stamps, never a hand-picked number.
- A PR that stacks on another session's open PR opens as a **draft against main carrying the parent's commits, not armed**; when the parent lands the helper rebases onto main, marks ready and arms. (Armed, the queue could land the parent's work under the child's title.)
- Files are owned: one helper per file at a time. Where two needed the same file the second stacked on the first's branch.
- The Glossary's **Messages (GC mode, the build)** entry is one long line and six PRs touch it. Helpers were told to leave their clause out when the line is busy; helper 9 will write one consolidating docs PR once #5565, #5558 and #5577 land (section 7).
- Models: the lead on Fable 5.1 at high; helpers on Opus 5.5 at xhigh; max only for migrations.

## 4. Every PR, as of 22:40 CT

State is GitHub's: queued = in the merge queue (position in parentheses); armed = auto-merge on, waiting for CI; held = open and clean on purpose, not armed; draft = stacked on another PR, not armed.

| PR | Cut | Piece | Helper | Branch | State |
|---|---|---|---|---|---|
| #5557 | R1 | job activity inside a person's thread, kernel | 7 | `claude/messages-thread-job-activity` | queued (6) |
| #5563 | R8 · 14 | the Dashboard's Customers line, behind `CUSTOMER_MESSAGES_LINE_ON = false` | 8 | `claude/r8-14-customers-needs-you` | queued (7) |
| #5558 | R3 | blanks and the phone's lines (`quickReplies/blanks.ts`, `phone.ts`) | 4 | `claude/r3-quick-reply-blanks` | queued (9) |
| #5562 | R7 | the New lane, kernel | 6 | `claude/r7-new-lane-kernel` | queued (10) |
| #5565 | R0 | seven kinds of contact, kernel | 2 | `claude/customer-communication-helper-0646a5` | queued (12); **four PRs stack on it** |
| #5561 | R5 | who answers a reply (`messages/hasRule.ts`) | 5 | `claude/r5-has-rule` | queued (13) |
| #5566 | R8 · 6 | They owe us, kernel | 9 | `claude/they-owe-us` | queued (16) |
| #5559 | R8 · 1 | the app's own emails in the thread (`sentLines.ts` who, new `appLines.ts`) | 7 | `claude/messages-app-lines` | **held**: same Glossary line as #5557; helper 7 rebases and arms when #5557 lands |
| #5568 | R4 | the residential flow: facts, seed and migration 20261013170000 | 3 | `claude/r4-residential-facts-seed` | draft on #5565; clean |
| #5560 | R4 | the residential loader (`residentialStampsFor`) | 1 | `claude/residential-flow-loader` | draft on #5568 |
| #5572 | R4 | the stage sends and the board dot (`flows/stageSends.ts`); exports `sentLately` | 1 | `claude/residential-stage-sends` | draft on #5560 |
| #5580 | R4 | the step strip above the box (`stepStrip` in `card.ts`) | 1 | `claude/residential-step-strip` | draft on #5560, sibling of #5572 |
| #5570 | R0 | the loaders for the four kinds; `nameContact` names a booked lead | 2 | `claude/r0-contact-loaders` | draft on #5565 |
| #5583 | R8 · 9 | leads: `prospects/leadThread.ts` | 6 | `claude/r8-9-lead-thread` | open on #5565's commit, not armed |
| #5584 | R8 · 11 | candidates: `hiring/candidateHandoff.ts` | 9 | `claude/candidate-handoff` | open on #5565's commit, not armed |
| #5571 | R8 · 3 | what slides on the board (`scheduleDispatch/whatSlides.ts`) | 7 | `claude/dispatch-what-slides` | armed |
| #5575 | R8 · 8 | a line on an estimate from a message (`estimates/lineFromMessage.ts`) | 6 | `claude/r8-add-on-from-message` | armed |
| #5576 | R8 · 7 | the Lien desk's sends (`messages/legalLines.ts`) | 8 | `claude/r8-7-legal-lines` | armed |
| #5577 | R8 · 4 | voicemails read (`messages/voicemailRead.ts`) | 9 | `claude/voicemail-read` | armed |
| #5579 | R8 · 10 | a supply house's email to the RFQ (`rfq/messageToRfq.ts`) | 7 | `claude/rfq-message-match` | armed |
| #5581 | R5 | the push rule (`messages/notifyRule.ts`) | 8 | `claude/r5-notify-rule` | armed |
| #5582 | R6 | two boxes, two numbers (`messages/boxes.ts`) | 7 | `claude/messages-two-boxes` | armed |
| #5586 | R8 · 12 | the sub flow: six facts, `SEED_FLOWS.sub`, migration 20261013200000 re-creating `flow_fact_ids()` and `flows_seed()`, a `sub-flow` bed | 1 | `claude/sub-flow-facts-seed` | draft on #5568 |
| #5588 | R3 | the SQL: `text_es`, `phone_order`, `phone_name`, the `es` and `phone` version kinds with from and to order, `edit_quick_reply` recreated (a LATER re-run in the bed), seven kinds widened, `messages.quick_reply_id`; migration 20261013210000 | 7 | `claude/quick-replies-phone-es-sql` | armed |

Committed locally and not yet open: helper 2's R0 SQL (branch `claude/r0-contacts-seven-kinds-sql`, migration 20261013180000, v2.5410; opens when #5565 lands, since its ACCESS_CONTROL clause edits a line #5565 changes); helper 3's stepsByFlow kernel (branch `claude/r3-steps-by-flow`, v2.5411; opens after #5568 lands).

## 5. Each helper's current piece and what it is waiting for

| Helper | Building now | Waiting on | Then |
|---|---|---|---|
| 1 | done: #5586 opened; stopped and waiting | #5568 → #5560 → #5572/#5580/#5586 to rebase down | PR 2 the two sheet columns (`on_site_at`, `done_at`, one trigger, a backfill); PR 3 the loader `subStampsFor` and `subLinesOnSheet` |
| 2 | R0 SQL, committed (see above) | #5565 to land | open and arm the SQL; then the fetchers' new columns after the push |
| 3 | stepsByFlow (`quickReplies/kernel.ts`: `stepsByFlow`, `qrStepName` across flows, the `es` and `phone` version words), committed | #5568 to land; #5558 for the one `textEs` field | arm it; delete the `PhoneLine.textEs` redeclaration if #5558 landed first |
| 4 | nothing assigned since #5558 | | assign: see section 8 |
| 5 | nothing assigned since #5561 | | assign: see section 8 |
| 6 | R8 · 16 language on the customer: PR 1 the column (stamp from `npm run claim`), PR 2 the reads on #5570 (go given) | #5558 for `wordsFor` | |
| 7 | done: #5588 opened and armed; waiting | #5557 to land | #5559's rebase and arm |
| 8 | R5 SQL, stamp 20261013190000 (go given) | | |
| 9 | R7 SQL `messages.tied_by` (brief sent, no prepare note needed) | #5565 to land for #5584 | the Glossary consolidation PR (section 7) |

## 6. Migrations: push in this order after each merges

| Stamp | Cut | PR | Helper |
|---|---|---|---|
| 20261013170000 | R4 flow: `flows_kind_known`, fact and paper lists, residential seed | #5568 | 3 |
| 20261013180000 | R0 kinds: `contacts_kind_known`, four id columns, `contacts_one_record`, `name_contact`, `contacts_subs_from_roster()`, `follow_up_count` | not open yet | 2 |
| 20261013190000 | R5: `messages_tech_team()`, the tech's door, `has_until`, `office_only`, hours and wait settings, `notification_history.message_id` | not open yet | 8 |
| 20261013200000 | R8 · 12 PR 1: the sub flow's fact and seed lists | #5586 | 1 |
| 20261013210000 | R3: `text_es`, `phone_order`, `phone_name`, `es` and `phone` version kinds, `edit_quick_reply` recreated, `messages.quick_reply_id`, `quick_replies_for_known` widened | #5588 | 7 |
| next claimed | R8 · 16 (`customers.language`), R7 (`messages.tied_by`) | | 6, 9 |

Main's newest migration is `20261013110000_drive_links.sql`. Beds run only in CI from this Mac. After each push, read the drift check; after the kinds push, one types PR from a prod regen.

## 7. Decisions made this session (the owner's, and the lead's in his place)

The owner's: orange is the customer's in the job window; the quick replies are the GC strip and editor with blanks, a phone mark and Spanish; two boxes and one inbox (team@ against office@ still open); Messages in the header with a New lane (mockup A); sixteen integrations Add and history No; candidates and subs as kinds; Job activity inside a person's thread behind a switch.

The lead's, each reversible and recorded in the plan: a lead's home is Messages, not the Prospects deck, with **Add to Prospects** as a press (decision 8 for the owner); R8 · 2 reports and photos is **parked** because a field report keeps no photos on main (decision 9 for the owner); the office close stays 5 PM and is a setting; after hours a reply goes to nobody with the app's one answer and waits for the morning; the bill reminder's day stays stamped from the expected-pay model though the reminder is off; Billed and Paid loop one round per bill; the residential text steps are read from the words until `messages.quick_reply_id`; `FLOW_KINDS` follows the widened check with the test reading the newest defining migration; the "add-on" is a **line on an estimate** (add-on is Estimates' option kind); the push is a new body on the existing `messages-notify`, not a new function; late bills alone count on the badge; a STOP is per box.

Still the owner's, listed in the plan's section 7: the tech's door (lean: dispatched or clocked on, this week and last), free text for techs (lean: quick replies only), who edits the phone's lines (lean: the office), who answers a reply (lean: the tech until 5 PM), team@ or office@, which reminders start on (lean: estimate and bill), the Job activity switch's default (lean: on for the office, off on the phone), leads' home, report photos.

### Two notes from helper 5 for R5's later PRs

- R5's SQL seeds `messages_office_hours_v1` as `{"days":[1,2,3,4,5],"opens":"07:30","closes":"17:00","techUntil":"17:00"}` with **no `emergency` key** until the owner sets a number (helper 8's brief said `emergency: null`; either reads the same in `parseOfficeHours`, but say which in the migration note). #5561's `write` expects `contacts.has_until` beside `has_how = 'rule'`.
- R5's Job Mode or screens PR must **skip `whoHasReply` when `has_how` is `took` or `handed`**: the rule does not check whether someone took the conversation after the tech's text.

## 8. What is left to assign

Kernels not yet started: none of consequence; every kernel in the plan has a PR or a helper. Helpers 4 and 5 are idle and could take: R7 · 3 and 4's screens once wave 2's cut 2 Follow up screens (#5478, #5489) land; the fetchers' new columns after the R0 push; the `messages-notify` body (R5's edge PR) once #5581 and the R5 SQL land; the Glossary consolidation if helper 9 is busy.

Screens wait on wave 2 (GC Review's open PRs): the thread window (cut 1), Follow up (cut 2: #5478, #5489), the reply box and quick replies (cut 3: #5497, #5500, #5502), Settings → Flows (#5498), the inbox reader (cut 6: #5537, #5549). R2, R5's Job Mode, R7's lane and R3's editor are the first screens once those are on main. The first useful day for the office is the end of R5: a tech texts the customer from Job Mode in two presses and hears the reply.

## 9. Files

- `to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md` — the plan, amended through the day; its data table and the "Migrations in flight" table are current.
- `to-dos/gc-mode/messages/customer-messages-prototype.html` — v0.8, eight screens; tab 6 is its log.
- `to-dos/gc-mode/messages/customer-messages-integrations-mockups.html` — v0.2, the seventeen cards with the owner's picks stamped.
- `to-dos/gc-mode/messages/MESSAGES_PLAN.md` → *Residential customers and the Messages page* — the decisions in the plan's voice.
- `to-dos/gc-mode/messages/BUILD_PLAN.md` and `BUILD_HELPERS.md` — the GC build's plan and the helpers' rules; this build uses both.
- A trajectory chart, `customer-communication-trajectory.html`, was sent to the owner from the scratchpad and is not in the repo; its DATA block is a hand-kept list and is stale as of #5575.
- The GC Review lead's session ("GC Review") runs wave 2; its helpers are "GC Reviews helper 1" to "9". Cut 10 (#5522, #5524, #5532, GC Reviews helper 7) is the job activity side of R1 and uses the prototype's orange.

## 10. Things that bit, so you do not repeat them

- `git checkout <ref> -- .` in a worktree stages another branch's files; undo with `git restore --source=HEAD --staged --worktree -- <paths>`; the classifier refuses `git reset --hard`.
- The helpers' prepare notes corrected the plan nine times (tables that did not exist, functions with other names, a column that was a policy key). Trust the note over the plan and fold the correction in.
- Six PRs editing one Glossary line is a rebase chain; hold the clause when the line is busy, consolidate once.
- `plainWordsFailures` refuses `·` as glue and parentheses, so phone numbers are hyphenated and the mockups' `·` phrases became sentences or parts.
- A stacked PR opened armed can land its parent's work under its own title. Open stacked PRs as drafts, arm after the rebase.
