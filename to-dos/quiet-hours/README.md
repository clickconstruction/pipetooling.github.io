---
name: "Quiet hours: a 24/7 switch on Office hours, and each person's own hours for pushes"
number: 141
group: ready
status: the owner's yes 2026-10-21; PR 1 (v2.5721, the 24/7 switch) merged as #5972 the same day, the three functions redeployed; PR 2 (v2.6026, Push me on the Push Notifications card) merged as #6383 and PR 3 (v2.6029, the reply push honours a person's hours) as #6385, both on 2026-10-28, their two migrations pushed and messages-notify deployed the same day (v2.6033 fixed the line's capital); PR 4 (v2.6060, what waited on the Dashboard, the pill's off words, the coverage line) open as #6434 on 2026-10-29, its one migration, the office's read of every row, to push after the merge; PR 5 not started
summary: >
  Two related asks. One: the Office hours card gets a switch, The office is open around the clock,
  that saves the hours as always open, hides the day and time fields while it is on, and tells
  the reply push and the tech's hold what 24/7 means. Two: each person sets, in the Push
  Notifications card they already have under Settings → Your account, the days and hours their
  phone is pushed, in the Office hours card's own shape: Push me any time, or only at these
  hours. A push outside a person's hours is held for them, and a customer's reply is handed to
  the office at once, so no customer waits on a sleeping phone. The company's hours gate what
  customers see. A person's hours gate only what reaches that person.
next: After PR 4 merges, push 20261029180000 (no function to deploy, nothing mirrored changed), then PR 5, the other thirteen senders through one shared helper, which deletes this folder. No call is left open; the weekend question became a day toggle.
size: M as a train of five (S S S S S); three migrations, one mirrored kernel, three function redeploys
blocker: none; PR 5 waits on nothing but a session
ver: v2.5721 · v2.6026 · v2.6029 · v2.6060
opinion: build — the 24/7 switch is an afternoon and fixes a real lie on the card today; the person's hours are the first per-person control over the phone the app has ever had, reuse the office card's kernel whole, and the hand-on rule keeps them from ever costing a customer an answer.
mockup: to-dos/quiet-hours/mockup.html
---

# Quiet hours (#141)

## The ask in the owner's words

Robert, 2026-10-21, after setting the Office hours card to every day, 12:00 AM to 11:59 PM,
because the company is effectively 24/7 right now:

> I would like there to be a checkbox in settings where a user can click it and it clarifies
> that the office is twenty four seven. But realistically, long term, I would like for users to
> be able to set when they receive notifications and when they don't receive notifications. I
> don't think we have those settings currently. Perhaps a user should be able to set them
> inside of their settings. Can you help me think through what this could look like and help me
> make a mock up and plan.

And, on the first draft of this to-do the same day: *I like your recommendations, is this the
best we can do?* The second pass changed four things; *Is this the best we can do?* at the end
says which.

Two asks, one card each. The first is a company switch on a card that exists. The second is a
block on a card that exists, and a rule for what the app does with a push it is told not to send.

## What exists today

**The company's hours.** Settings → Phone and texts → **Office hours** (`OfficeHoursSettingsCard.tsx`
over `officeHoursCard.ts`, v2.5709) writes `app_settings` `messages_office_hours_v1`: `days`,
`opens`, `closes`, plus `techUntil` (5 PM) and the after-hours `emergency` number, which only a
dev sets by hand. `hasRule.ts` reads it (`parseOfficeHours`, `officeOpen`, `nextOpening`,
`lastClosing`, `techHoldUntil`, `autoAnswerDue`, `whoHasReply`). It is a mirrored kernel: the
copy in `_shared/gcKernels/` is read by `messages-notify` (the reply push, through
`messagesReplyPush.ts`) and `quo-send` (a tech's text from Job Mode, through `quoTechSend.ts`,
which sets the tech's hold). `messages-nudge-dispatch` imports the copy too, so a regenerate
names it for redeploy, though it does not read the hours itself.

What the hours govern, each in its own words:

| Piece | What it reads | What it does after hours |
|---|---|---|
| Who has a reply (`whoHasReply`) | `officeOpen` | nobody has it; the row waits on Needs a reply until `nextOpening`; the pill reads *Open · waits for Mon 7:30 AM* |
| Reply push (`notifyRule.ts` `pushesFor`) | the rule's `has: 'nobody'` | one push to the whole office at once, *Dana wrote after hours. It waits for the morning.*; no wait push |
| The office's wait (`messages_office_wait_minutes`) | the rule's `has: 'tech'` or `'office'` | only inside the hours: whoever has it hears at once, the office after the wait when nobody wrote back |
| The after-hours answer (`afterHoursAnswer`, `autoAnswerDue`) | `lastClosing` | written, never sent: no caller today; `notifyPlan.ts` passes `lastAutoAnswerAt: null` and the push says *waits for the morning* |
| The tech's hold (`techHoldUntil`) | `techUntil` | a tech who texts a customer keeps the replies until 5 PM that day, or midnight when the text went after 5 |
| The hand-off line (`handOffEvent`) | `officeOpen`, `nextOpening` | *Passed from Luis to the office. It opens tomorrow at 7:30 AM.* |
| The switch card on Messages (`switchCard.ts`) | `officeHoursSet` | the Office hours row's why: *after hours the office hears first and the reply waits for the morning* |

**Today's 24/7 is a lie by a minute.** Every day, 00:00 to 23:59 leaves one closed minute a day:
`officeOpen` is false from 11:59 PM to midnight, so a reply in that minute has nobody, the office
gets the after-hours push, and `autoAnswerDue` would send *We open Wednesday at 12 AM* if the
answer ever gets a caller. The card's line reads *Every day, 12:00 AM to 11:59 PM*, which is
not what the owner means.

**Per-person settings.** Settings → **Your account** is the rail's *Just you* zone (its hint:
*Just you: profile, notifications, your schedule and email times.*). It holds the profile, **Push
Notifications** (turn on, send a test through `send-checklist-notification`), **My way**
(`tell_customer_prefs`, one row per person, read fail-soft, v2.5597), **Report notifications**
(`user_report_notification_preferences`), **My email schedule** and the time-off and salary
blocks. Nothing on it says when a push may reach the person.

**Every push the app sends today** (`web-push` to `push_subscriptions`, one `notification_history`
row per person; the senders are the files named):

| Push | Sender | Who gets it | When |
|---|---|---|---|
| A customer's, a lead's or a sub's reply | `messages-notify` (`messagesReplyPush.ts`, `notifyPlan.ts`) | whoever has it at once; the office after the wait when nobody wrote back; the whole office at once after hours | the minute cron while Reply push is on |
| A clause change to approve, or its answer | `messages-notify` | a dev or the controller; the editor | at the press, with an email |
| A dispatch request filed, closed or reopened | `notify-dispatch-request` | the dispatch group; then the requester | at the press |
| An estimator request | `notify-estimator-request` | the estimator group | at the press |
| A bid marked for someone | `notify-bid-mark` | the one person named | at the press, only when the sender ticks the phone |
| Help feedback | `notify-help-feedback` | the devs | at the press |
| A lien notice to approve | `notify-lien-approval` | the job's master, else every leader; email when no device | at the press |
| Take them again? at a trial helper's clock-out | `notify-team-lead-clock` | everyone who could run that job | at the clock-out |
| A bid's call-again day | `remind-bid-followups` | the account manager, else the estimator | hourly from 8 AM office time, once per bid and day |
| Ready to Bill | `paid-job-email` | the people on `ready_to_bill_notify_recipients_v2`, each with a push or email pick | the queue, within minutes |
| A check came back | `arReturnCaseNotify.ts` | the Payment made stream, else the office roles | the hour it is found |
| A work order | `send-workflow-notification` | the sub or tech named, with an email | at the press |
| A checklist assignment, and the Settings test push | `send-checklist-notification` | the one person named | at the press |
| A checklist reminder | `send-scheduled-reminders` | the item's assignees | the Chicago quarter-hour the item was set to |
| A filed report | `send-report-notification` | the people opted in to that report kind | at the filing |

Not pushes, so not in scope: the morning run's texts to customers (`messages-nudge-dispatch`,
9 AM Central), the On my way and I'm here texts, the Dashboard's **Today's sends** line and the
rest of the **Needs you** card (read when the person opens the app, never pushed), and every
email stream on Emails & reports (`docs/REPORT_SUBSCRIPTIONS.md`), which already has its own
days and times per subscription.

## The decisions

### 1. How the kernel keeps 24/7: `always: true`, not 00:00 to 23:59

**Alternatives.**

- *A. The switch saves every day, 00:00 to 23:59.* No kernel change, no edge redeploy. But the
  closed minute stays, the line still reads *12:00 AM to 11:59 PM*, every reader has to compare
  times to know it is 24/7, and the day and time fields keep real-looking values the owner never
  chose.
- *B. `always: true` in the JSON, read by `parseOfficeHours`.* `OfficeHours` gains `always:
  boolean` (default false). `officeOpen` returns true whenever `always` is set, `nextOpening`
  returns the instant itself, `lastClosing` returns null, `autoAnswerDue` returns false, and
  `hoursLine` reads *Open around the clock*. The days and times stay in the row under the switch,
  so turning it off puts the old hours back. `hasRule.ts` is mirrored, so the copy regenerates
  and `messages-notify`, `quo-send` and `messages-nudge-dispatch` redeploy.

**Recommendation: B.** The kernel is the one reader of the JSON, and 24/7 is a fact about the
office, not a pair of times. One boolean lets every reader say the true thing in words instead of
inferring it. The cost is one regenerate and three redeploys, which the train pays once.

**Belt and braces for the deploy window.** The save writes `always: true` and leaves the days and
times as they were. An edge function not yet redeployed reads the five old fields and sees the
old hours, so the order is: merge, deploy the three functions, then the client deploys by CI
and the owner presses the switch. The release note says so.

**What 24/7 means for each reader.**

- *Who has a reply*: never nobody. The tech's hold, then the office's pick, at any hour. The
  pill never reads *waits for*.
- *Reply push*: the after-hours push never goes. Whoever has it hears at once, the office after
  the wait, at 3 AM as at 3 PM. The reply push's own words do not change.
- *The office's wait*: unchanged, and now the only thing between a reply and the whole office
  at night. The card's note says that in one line while the switch is on.
- *The after-hours answer*: never due. It has no caller today either, so the card says nothing
  about it, as v2.5709 chose: a card promises nothing about a text that does not go.
- *The tech's hold*: still ends at `techUntil`. A tech who texts at 2 PM keeps the replies until
  5 PM, then the office has them. A tech who texts at 8 PM keeps them until midnight. The card
  reads the hour back as a line, *A tech who texts a customer keeps the replies until 5:00 PM*,
  so the owner can see it. Making it a field is a small later PR, not this one.
- *The hand-off line*: *Passed from Luis to the office.* with no opening time.
- *The switch card on Messages*: the Office hours row's why reads *the office is open around
  the clock* while the switch is on.

### 2. The shape of a person's hours: the Office hours card's own, said the right way round

**Alternatives.**

- *A. One switch: Do not push me outside the office hours.* One press, no times to type.
  Under 24/7 it means nothing, which is the owner's case today. And a tech who works 7 to 4 is
  not the office; their hours are their own.
- *B. A weekly grid.* Seven rows of hours, painted on and off. Exact, and heavy: a phone
  screen of 168 cells for a choice most people make once.
- *C. Quiet hours: days plus one quiet window, 8 PM to 6 AM.* The first draft's pick. On a
  second look it has three faults. The day toggles read backwards: a person who takes Sunday
  off presses Sunday *off*, and in a quiet-hours card that means pushed all Sunday. The window
  crosses midnight, so it needs its own rule and its own kernel. And it is a new card with a new
  anchor beside the Push Notifications card that already owns the phone.
- *D. The days and hours you are pushed, inside the Push Notifications card.* **Push me**:
  *Any time*, or *Only at these hours*, two rows in My way's shape (v2.5597). Under the second:
  seven day toggles and **From** and **To**, the Office hours card's exact controls, and its
  line, *Mon to Fri, 6:00 AM to 8:00 PM*. A day toggled off is a day with no pushes. The window
  never crosses midnight for anyone who sleeps at night, so the office card's one rule holds:
  the end comes after the start.

**Recommendation: D.** It reads the way a plumber thinks, in shifts, not in silences. It is the
same card the person already uses to turn pushes on and send a test, so there is nowhere else
to look. And it reuses the office card whole: `draftProblem`, `toggleDay`, `hoursLine`,
`daysWords` and `timeWords` from `officeHoursCard.ts` as they are, and `officeOpen` and
`nextOpening` from `hasRule.ts`, already mirrored, for the check itself. The weekend question
the first draft left to the owner is gone: Sat and Sun off is two presses.

**The line under the block** says what happens:

> Outside these hours a push waits for you. A customer's reply still goes to the office at once.
> The Dashboard lists what waited when you are back.

**The data: one row per person, `user_push_hours`.** `user_id` (PK, FK users), `days int[]`,
`opens text` and `closes text` ("HH:MM", Chicago), `updated_at`. No row is *Any time*. RLS: a
person reads and writes their own row; the owner and a dev read every row (the coverage line,
decision 3); the service role reads for the senders. The migration ends with the three
read-only and twin calls. Why a table and not a column on `users`: `users` is read by every
role's rosters and guarded against self-edits by the role trigger, so a self-written column
there is a policy change on a hot table; a row of its own is the `tell_customer_prefs` shape,
already shipped and fail-soft. Why not an `app_settings`-style row: those are the company's.

**The kernel: `src/lib/messages/pushHours.ts`**, pure, mirrored, and small because the office
card did the work: `parsePushHours(row)` (an `OfficeHours` with `always: false`, or null for any
time), `pushedNow(at, hours)` (`officeOpen`), `backAt(at, hours)` (`nextOpening`, for the pill
and the office's words), `pushHoursLine(hours)` (*Pushed Mon to Fri, 6:00 AM to 8:00 PM* or
*Pushed any time*), the words, and `pushDecision(push, hoursByUser, now)`, which splits one
push's `userIds` into `send` and `held`.

### 3. What a person's hours do to each push: hold, hand on, or ignore

Three verbs. **Hold**: the push is not sent; a `notification_history` row is written with
`channel = 'held'`, and the Dashboard's Needs you card lists what waited when the person is back
(decision 5). **Hand on**: someone else hears now. **Ignore**: the hours do not apply.

| Push | Verb | Why |
|---|---|---|
| A reply, to whoever has it | **hold, and hand on at once** | the holder cannot answer, so the office does not wait 15 minutes for nothing: the office hears now, *Dana wrote to Luis, who is off until 6 AM*, then her words; the holder still has it on Messages and the office takes it with Who has it |
| A reply, the office after the wait | **hold**, per member | each office member who is off is held; the rest hear. When the only office recipient is the Customers seat and the seat is off, the push widens to the office roles who are on |
| A reply after hours, the office at once | **hold**, per member | the line waits for the morning anyway |
| A clause change to approve | hold | the email goes now |
| A dispatch request filed | **hold**, per member | the dispatchers who are on hear; the requester's strip shows it waiting |
| A dispatch request closed or reopened | hold | the requester sees it on Job Mode's strip |
| An estimator request | hold, per member | as the dispatch request |
| A bid marked for someone | hold | the mark is on the Bid Board |
| Help feedback | hold | the inbox is on Help |
| A lien notice to approve | hold | the Needs you card carries it; the email fallback is unchanged |
| Take them again? | hold | the Dashboard card is there in the morning |
| A bid's call-again day | hold | a day-level reminder; the Needs you line names it |
| Ready to Bill | hold | the email pick is unchanged |
| A check came back | hold | the email goes now |
| A work order | hold | the email goes now |
| A checklist assignment | hold | |
| The Settings test push | **ignore** | the person pressed it to see a push |
| A checklist reminder | hold | the person set the time, but hours set later win |
| A filed report | hold | |
| Texts to customers, the morning run, Today's sends, Needs you, every email stream | **ignore** | not pushes to a person, or read when the app is opened |

**When everyone in the office is off.** A reply's push may find no one on. The row stays on
Needs a reply as today, the thread's pill reads *Nobody has it · the office is off until 6 AM*, and the
Office hours card grows one honest line while 24/7 is on: *Nobody hears a reply from 11 PM to
6 AM. Rosa, Evan and Taunya are all off then.* The company's switch says the office is open;
the people's hours say whether anyone is. The line is where the two meet, and it is the owner's
to act on, not the app's. It reads the rows through the owner-or-dev SELECT policy, no RPC.

### 4. How the company's hours and a person's hours combine

The company's hours gate what customers see: who has a reply, the after-hours answer, the
hand-off line, the morning's texts. A person's hours gate what reaches that person's phone, and
nothing else. Neither changes the other's record: a held push is still a `notification_history`
row, a person who is off still *has* the conversation on Messages, and the office's wait still
runs from the reply's time. Under 24/7 the rule is the same with the after-hours branch never
taken.

### 5. What you get when your hours open: a line on the Dashboard, not a push

**Alternatives.** *A.* Send each held push when the hours open. A phone buzzing nine times at
6 AM. *B.* One catch-up push per person at the open that counts what waited: a new function, a
cron entry and a migration, the first draft's pick. *C.* The Needs you card's first line when
the person opens the app, *While you were off: 3 replies and a work order waited*, read from
the person's own `held` rows since their last open, each a door; no cron, no function.

**Recommendation: C.** The person opens the app at the start of their day anyway, and the
Needs you card is where the app already says what needs them. A reply answered meanwhile is
not counted. The catch-up push is a later ask if anyone misses it, and *Not carried* says so.

## The mock-up

[`mockup.html`](./mockup.html): the Office hours card with the switch off and on, in the card's
own words and tokens; the Push Notifications card on Settings → Your account with the **Push me**
block in shape D, any time and at these hours, the read-back line and the problem line; the
thread's pill, the office's push and the Dashboard's line when a holder is off; the Office hours
card's coverage line when every office member is off. Light and dark by the page's toggle,
drawn on `src/index.css`'s tokens. Every name and number is made up.

## The plan

**PR 1 · The 24/7 switch (S).** `hasRule.ts`: `always` on `OfficeHours`, `parseOfficeHours`
reads it, `officeOpen` / `nextOpening` / `lastClosing` / `autoAnswerDue` honour it, `hasHover`
and `handOffEvent` never take the closed branch. `officeHoursCard.ts`: `always` on the draft,
the words (*The office is open around the clock*, *Open around the clock*, the tech's-hour
line), `serializeOfficeHours` writes `always` and keeps the hours, `draftProblem` skips the day
and time checks while it is on. `OfficeHoursSettingsCard.tsx`: the switch first, the day and
time fields hidden while it is on, the tech's-hour line read-only. `switchCard.ts`: the row's
why under 24/7. Regenerate the copy (`npm run gen:edge-kernels`). Tests: `hasRule.test.ts` (open
at 3 AM, no next opening, no answer due, the hover's words), `officeHoursCard.test.ts` (the
round trip with and without `always`, the words plain), `OfficeHoursSettingsCard.render.test.tsx`
(the switch on hides the fields and saves `always`, off restores the hours),
`switchCard.test.ts`, `edgeKernels.test.ts`. Guide: *turn on the reply push* → *Set the office
hours* gains the switch and what it means. Docs: `MESSAGES_ARCHITECTURE.md`'s switches table
row, `GLOSSARY.md`'s R5 line, the release note and fragment. No migration. Deploy:
`messages-notify`, `quo-send`, `messages-nudge-dispatch` before the owner presses the switch.

**PR 2 · Push me, the block on Push Notifications (S + migration).** Migration `user_push_hours`
(own-row policies, the owner-or-dev read, the three calls at the end; `docs/migrations/`
entry). `src/lib/messages/pushHours.ts` (pure; `parsePushHours`, `pushedNow`, `backAt`,
`pushHoursLine`, the words) and `pushHoursIo.ts` (own row, fail-soft; a save upserts, *Any time*
deletes). The block in `SettingsAccountTab.tsx`'s Push Notifications card, under the turn-on and
test buttons, reusing `officeHoursCard.ts`'s draft, problem and words. Tests: `pushHours.test.ts`
(each day on and off, the ends, no row, plain words), `pushHoursIo.test.ts`, the account tab's
render smoke. Guide: *settings basics* → *Push notifications* gains **When you are pushed**.
Docs: `SETTINGS_TABS_ARCHITECTURE.md` (the account tab), `PROJECT_DOCUMENTATION.md` §22,
`GLOSSARY.md`. The block saves and reads back; nothing holds a push yet, and the line says
*From the next update, …* until PR 3 lands.

**PR 3 · The reply push honours a person's hours (S, edge).** `pushHours.ts` joins the mirrored
copy; `pushDecision` beside `pushesFor` in `notifyRule.ts`; `pushesFor` gains the hand-on at
once (the holder off: the office's push now, with its words) and the seat widening;
`messagesReplyPush.ts` reads `user_push_hours` for the plan's users and splits each push into
sent and held; held rows written with `channel = 'held'` (migration: widen
`notification_history_channel_check`, one line, same PR). Tests: `notifyRule.test.ts` (the
hand-on words, the widening), `notifyPlan.test.ts` (a holder off, the wait push to the office
members who are on, every member off), the `messagesReplyPush` bed. Deploy `messages-notify`.
Docs: `EDGE_FUNCTIONS.md` messages-notify section, `MESSAGES_ARCHITECTURE.md`'s push paragraph.

**PR 4 · What waited, the pill and the coverage line (S + migration; v2.6060).** `whatWaited.ts`
(the Needs you item `while-off` in `dashboardNeedsYou.ts`: the person's own `held` rows since
their hours last closed, one wait per line, a line answered meanwhile left out and named, the
door to the first still waiting) and `whoIsOff.ts` (the Who has it pill's off words and hover in
`WhoHasItPill.tsx`, the holder or the whole office; the Office hours card's coverage line,
`coverageGaps` and `coverageLine`, the rows read as the owner or a dev). Two departures from the
first plan: the kernels sit beside `pushHours.ts`, not in it, since PR 3 mirrored that file to
the edge and a change would have cost a `messages-notify` redeploy for words the edge never
reads; and one migration, `20261029180000`, lets the office team read every row, since the
pill's audience is the office and the own-row and owner-or-dev reads of PR 2 left it blind to a
holder's hours. Tests on the kernels, the three surfaces' renders and the Needs you builder.
Guides: the Push notifications section gains *What waited while you were off*, *Open around the
clock* reads the coverage line, *Who has it* reads the two off pills.

**PR 5 · The other senders (S each, one PR).** `pushDecision` in each of the thirteen other
push senders through one shared helper, `_shared/pushHoursSend.ts`, that reads the rows, splits,
sends and writes `held`. The Settings test push skips it. Deploy each. `EDGE_FUNCTIONS.md`: one
line per section. Release note and fragment.

Each PR: `npm run claim`, a release note, a fragment, `npm run check:todos` while this file
stands; the last PR deletes the folder.

## Is this the best we can do?

The first draft, read back against the house's lenses, lost four things to the second:

1. **Reuse.** The first draft wrote a second hours kernel for a quiet window that crosses
   midnight. The second says the person's hours the way the office's are said, and the office
   card's kernel and controls serve both. One shape, one set of words, one `officeOpen`.
2. **Fewer presses, nowhere else to look.** A new Quiet hours card with its own switch and anchor
   became a block in the Push Notifications card the person already uses. The weekend fold and
   the owner's call under it became two day toggles.
3. **Do what is ready.** A holder who is off cannot answer, so the office waited 15 minutes for
   nothing. Now the office hears at once, with who is off. And the first draft's wait push could
   reach nobody when the Customers seat alone was named and off; it widens.
4. **Cut.** The catch-up push, a function, a cron and a migration, is gone in favour of one line
   on the Needs you card. And the Office hours card no longer promises anything about the
   after-hours text, which has no sender.

## Not carried

- **A field for the tech's hour** (`techUntil`) and **the after-hours number** on the card: the
  card reads the hour back as a line; the fields are a later small PR, and the number has no
  sender until the after-hours answer gets a caller.
- **A different window on weekends**: Sat and Sun off is two presses; a shorter Saturday is
  not drawable, and nobody has asked.
- **Hours across midnight**, a night shift pushed 8 PM to 6 AM: the office card's rule holds
  for now; a night shift is two rows of hours the day it is asked for.
- **A catch-up push** at the hours' open: the Needs you line first; the push if anyone misses it.
- **The line on the Job Mode Inbox tab**: a tech's focused Dashboard hides the Needs you card by
  design (v2.917) and keeps notifications on its Inbox tab, so a tech reads *While you were off*
  under **Show full dashboard** (PR 4); a line on the Inbox tab is a small later PR if a tech asks.
- **Hours for emails**: every stream already has days and times per subscription on Emails &
  reports.
- **Hours for texts to customers**: the company's hours and the morning run's 9 AM own that.
- **Holding a push per kind** (reply yes, work order no): one window for every push is the
  honest first cut; a kind picker is a row the block can grow if anyone asks.
- **Holidays**: `hasRule.ts`'s header says they are not known; still true.
