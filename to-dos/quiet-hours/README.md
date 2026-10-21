---
name: "Quiet hours: a 24/7 switch on Office hours, and each person's own hours for pushes"
number: 141
group: ready
status: proposed 2026-10-21 — planned and drawn; nothing built; waits on the owner's yes and one call (decision 2)
summary: >
  Two related asks. One: the Office hours card gets a switch, The office is open around the clock,
  that saves the hours as always open, hides the day and time fields while it is on, and tells
  the reply push, the after-hours answer and the tech's hold what 24/7 means. Two: each person
  sets, under Settings → Your account, when their phone is pushed and when it is not: quiet
  hours as days plus one window in the company's time zone. A push that lands in a person's
  quiet hours is held for them and, when it is a customer's reply, handed to the office after
  the reply push wait, so no customer waits on a sleeping phone. The company's hours gate what
  customers see. A person's quiet hours gate only what reaches that person.
next: The owner reads The decisions, takes or changes decision 2 (one window a day or a different window on weekends), then PR 1 goes.
size: M as a train of five (S S S M S); one migration, one mirrored kernel, three function redeploys
blocker: the owner's yes
ver: proposed
opinion: build — the 24/7 switch is an afternoon and fixes a real lie on the card today; the quiet hours are the first per-person control over the phone the app has ever had, and the hand-on rule keeps them from ever costing a customer an answer.
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

Two asks, one page each. The first is a company switch on a card that exists. The second is a
new per-person card, and a rule for what the app does with a push it is told not to send.

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
- *The after-hours answer*: never due. The `emergency` number has no reader while the switch is
  on, and the card says so under the switch: *The after-hours text never goes while this is on.*
- *The tech's hold*: still ends at `techUntil`. A tech who texts at 2 PM keeps the replies until
  5 PM, then the office has them. A tech who texts at 8 PM keeps them until midnight. The card
  reads the hour back as a line, *A tech who texts a customer keeps the replies until 5:00 PM*,
  so the owner can see it. Making it a field is a small later PR, not this one.
- *The hand-off line*: *Passed from Luis to the office.* with no opening time.
- *The switch card on Messages*: the Office hours row's why reads *the office is open around
  the clock* while the switch is on.

### 2. The shape of a person's quiet hours: days plus one window

**Alternatives.**

- *A. One switch: Do not push me outside the office hours.* One press, no times to type.
  Under 24/7 it means nothing, which is the owner's case today. And a tech who works 7 to 4 is
  not the office; their quiet hours are their own.
- *B. A weekly grid of quiet hours.* Seven rows of hours, painted on and off. Exact, and
  heavy: a phone screen of 168 cells for a choice most people make once, as *not after 8 and
  not before 6, every day*.
- *C. Days plus one window.* Seven day toggles, as the Office hours card already draws them,
  and one window: *Quiet from 8:00 PM to 6:00 AM*. The window may cross midnight. A day
  toggled off has no quiet hours. One line reads it back: *Quiet every day, 8:00 PM to 6:00 AM.*

**Recommendation: C**, and the owner's one call is inside it: whether one window serves every
day, or weekends get their own window (*Fri 6 PM to Mon 6 AM*). The mock-up draws one window
with the days, and a second row **Weekends** folded under a quiet link, *Different hours on
weekends*, off by default. One window ships in PR 2; the weekend row is a kernel field with no
screen until the owner asks. The draft keeps the shape of `officeHoursCard.ts`: a draft, a
problem line, Save and Put back.

**The line under the card** says what happens, in the words the mock-up draws:

> A push that comes in your quiet hours waits for you. You get one push when they end, with
> what waited. A customer's reply also goes to the office after the reply push wait. Nobody
> waits on a sleeping phone.

The card has its own switch, **Quiet hours** On or Off, so a person turns them off without
clearing the days: off reads *No quiet hours. Every push reaches you when it is sent.*

**The data: one row per person, `user_quiet_hours`.** `user_id` (PK, FK users), `on boolean`,
`days int[]`, `starts text` and `ends text` ("HH:MM", Chicago), `weekend_starts` and
`weekend_ends` (null until the owner asks for the second window), `updated_at`. RLS: a person reads and writes their own
row; the service role reads every row for the senders. The migration ends with the three
read-only and twin calls. Why a table and not a column on `users`: `users` is read by every
role's rosters and guarded against self-edits by the role trigger, so a self-written column
there is a policy change on a hot table; a row of its own is the `tell_customer_prefs` shape,
already shipped and fail-soft. Why not an `app_settings`-style row: those are the company's.

**The kernel: `src/lib/messages/quietHours.ts`**, pure, mirrored. `parseQuietHours(row)`,
`quietNow(at, quiet)` (whether the instant is in the person's quiet hours, in Chicago, a
window across midnight read as last night's), `quietEnds(at, quiet)` (the ISO the current quiet
window ends), `quietLine(quiet)` (the words), `draftProblem(draft)` (*Pick at least one day.*,
*Pick a start and an end.*, only while the switch is on; a window may cross midnight, so no order rule), and
`pushDecision(push, quietByUser, now)`, which splits one push's `userIds` into `send` and `held`.

### 3. What quiet hours do to each push: hold, hand on, or ignore

Three verbs. **Hold**: the push is not sent now; a `notification_history` row is written with
`channel = 'held'` and the person gets one catch-up push when their quiet hours end, *While you
were quiet: 3 replies and a work order waited. Open the Dashboard.* **Hand on**: someone else
hears now. **Ignore**: quiet hours do not apply.

| Push | Verb | Why |
|---|---|---|
| A reply, to whoever has it | **hold and hand on** | the holder is quiet, so the office's wait push goes as it does today, to the office members who are not quiet; the holder's catch-up names the reply if nobody answered it |
| A reply, the office after the wait | **hold**, per member | each office member who is quiet is held; the rest hear |
| A reply after hours, the office at once | **hold**, per member | the line waits for the morning anyway |
| A clause change to approve | hold | the email goes now |
| A dispatch request filed | **hold**, per member | the dispatchers who are awake hear; the requester's strip shows it waiting |
| A dispatch request closed or reopened | hold | the requester sees it on Job Mode's strip |
| An estimator request | hold, per member | as the dispatch request |
| A bid marked for someone | hold | the mark is on the Bid Board |
| Help feedback | hold | the inbox is on Help |
| A lien notice to approve | hold | the Needs you card carries it; the email fallback is unchanged |
| Take them again? | hold | the Dashboard card is there in the morning |
| A bid's call-again day | hold | a day-level reminder; the catch-up names it |
| Ready to Bill | hold | the email pick is unchanged |
| A check came back | hold | the email goes now |
| A work order | hold | the email goes now |
| A checklist assignment | hold | |
| The Settings test push | **ignore** | the person pressed it to see a push |
| A checklist reminder | hold | the person set the time, but a quiet window set later wins |
| A filed report | hold | |
| Texts to customers, the morning run, Today's sends, Needs you, every email stream | **ignore** | not pushes to a person, or read when the app is opened |

**When everyone in the office is quiet.** A reply's wait push may find no one awake. The row
stays on Needs a reply as today, the thread's pill reads *Open · the office is quiet until 6 AM*,
and the Office hours card grows one honest line while 24/7 is on: *Nobody hears a reply from
11 PM to 6 AM. Rosa, Evan and Taunya are all quiet then.* The company's switch says the office
is open; the people's hours say whether anyone is. The line is where the two meet, and it is
the owner's to act on, not the app's.

### 4. How the company's hours and a person's quiet hours combine

The company's hours gate what customers see: who has a reply, the after-hours answer, the
hand-off line, the morning's texts. A person's quiet hours gate what reaches that person's
phone, and nothing else. Neither changes the other's record: a held push is still a
`notification_history` row, a quiet person still *has* the conversation on Messages, and the
office's wait still runs from the reply's time, not from the quiet end. Under 24/7 the rule is
the same with the after-hours branch never taken.

### 5. The catch-up push: one, at the quiet end

**Alternatives.** *A.* Send each held push when the quiet hours end. A phone buzzing nine times
at 6 AM. *B.* Send nothing; the app's screens carry it. Honest, but the person asked for pushes
and gets none. *C.* One push per person at the quiet end that counts what waited by kind and
opens the Dashboard.

**Recommendation: C.** `quiet-hours-catch-up`, a small function on the `messages-reply-push`
minute cron's lane every 15 minutes, reads the `held` rows since each person's quiet began,
sends one push and marks the rows `channel = 'push'` with the catch-up's time. A reply that was
answered meanwhile is not counted. PR 4 ships it; until then a held push is held and the row
says so.

## The mock-up

[`mockup.html`](./mockup.html): the Office hours card with the switch off and on, in the card's
own words and tokens; the **Quiet hours** card on Settings → Your account in shape C, with the
read-back line, the weekend fold and the problem line; the thread's pill and the Office hours
card's coverage line when every office member is quiet. Light and dark by the page's toggle,
drawn on `src/index.css`'s tokens. Every name and number is made up.

## The plan

**PR 1 · The 24/7 switch (S).** `hasRule.ts`: `always` on `OfficeHours`, `parseOfficeHours`
reads it, `officeOpen` / `nextOpening` / `lastClosing` / `autoAnswerDue` honour it, `hasHover`
and `handOffEvent` never take the closed branch. `officeHoursCard.ts`: `always` on the draft,
the words (*The office is open around the clock*, *Open around the clock*, *The after-hours text
never goes while this is on*, the tech's-hour line), `serializeOfficeHours` writes `always` and
keeps the hours, `draftProblem` skips the day and time checks while it is on.
`OfficeHoursSettingsCard.tsx`: the switch first, the day and time fields hidden while it is on,
the tech's-hour line read-only. `switchCard.ts`: the row's why under 24/7. Regenerate the copy
(`npm run gen:edge-kernels`). Tests: `hasRule.test.ts` (open at 3 AM, no next opening, no
answer due, the hover's words), `officeHoursCard.test.ts` (the round trip with and without
`always`, the words plain), `OfficeHoursSettingsCard.render.test.tsx` (the switch on hides the
fields and saves `always`, off restores the hours), `switchCard.test.ts`, `edgeKernels.test.ts`.
Guide: *turn on the reply push* → *Set the office hours* gains the switch and what it means.
Docs: `MESSAGES_ARCHITECTURE.md`'s switches table row, `GLOSSARY.md`'s R5 line, the release note
and fragment. No migration. Deploy: `messages-notify`, `quo-send`, `messages-nudge-dispatch`
before the owner presses the switch.

**PR 2 · The Quiet hours card (S + migration).** Migration `user_quiet_hours` (the three calls at
the end; `docs/migrations/` entry). `src/lib/messages/quietHours.ts` (pure; `parseQuietHours`,
`quietNow`, `quietEnds`, `quietLine`, `draftProblem`, the words) and `quietHoursIo.ts` (own row,
fail-soft, upsert). `QuietHoursCard.tsx` under Your account after Push Notifications, anchor
`settings-quiet-hours` in `settingsDeepLink.ts`. Tests: `quietHours.test.ts` (a window across
midnight, each day on and off, the ends, plain words), `quietHoursIo.test.ts`,
`QuietHoursCard.render.test.tsx`. Guide: *settings basics* → a **Quiet hours** section after
Push notifications. Docs: `SETTINGS_TABS_ARCHITECTURE.md` (the account tab's blocks),
`PROJECT_DOCUMENTATION.md` §22, `GLOSSARY.md`. The card saves and reads back; nothing holds a
push yet, and the card's note says *From the next update, …* until PR 3 lands.

**PR 3 · The reply push honours quiet hours (S, edge).** `quietHours.ts` joins the mirrored
copy; `pushDecision` in `notifyRule.ts` or beside it; `messagesReplyPush.ts` reads
`user_quiet_hours` for the plan's users and splits each push into sent and held; held rows
written with `channel = 'held'` (migration: widen `notification_history_channel_check`, one line,
same PR). Tests: `notifyPlan.test.ts` (a quiet holder, the wait push to the awake office, every
member quiet), `messagesReplyPush` bed. Deploy `messages-notify`. Docs: `EDGE_FUNCTIONS.md`
messages-notify section, `MESSAGES_ARCHITECTURE.md`'s push paragraph.

**PR 4 · The catch-up push and the coverage line (M).** `quiet-hours-catch-up` function and its
cron entry (migration, `docs/migrations/` entry, `EDGE_FUNCTIONS.md` section and TOC line);
`catchUpWords` in `quietHours.ts`; the thread's pill when every holder is quiet; the Office
hours card's coverage line (`coverageGaps(hours, quietRows)` in `quietHours.ts`, read through
a small RPC behind `is_master_or_dev()` that returns the office members' names and quiet
windows for the owner's card). Tests on the kernel and the card. Guide: the Quiet hours section gains *What you get
when they end*.

**PR 5 · The other senders (S each, one PR).** `pushDecision` in each of the thirteen other
push senders, one shared helper `_shared/quietPush.ts` that reads the rows, splits, sends and
writes `held`. The Settings test push skips it. Deploy each. `EDGE_FUNCTIONS.md`: one line per
section. Release note and fragment.

Each PR: `npm run claim`, a release note, a fragment, `npm run check:todos` while this file
stands; the last PR deletes the folder.

## Not carried

- **A field for the tech's hour** (`techUntil`) and **the after-hours number** on the card: the
  card reads the hour back as a line; the fields are a later small PR, and the number has no
  sender until the after-hours answer gets a caller.
- **A second window for weekends**: a kernel field with no screen until the owner asks.
- **Quiet hours for emails**: every stream already has days and times per subscription on
  Emails & reports.
- **Quiet hours for texts to customers**: the company's hours and the morning run's 9 AM own
  that.
- **Holding a push per kind** (reply yes, work order no): one window for every push is the
  honest first cut; a kind picker is a row the card can grow if anyone asks.
- **The hour the after-hours answer sends**, and holidays: `hasRule.ts`'s header says holidays
  are not known; still true.
