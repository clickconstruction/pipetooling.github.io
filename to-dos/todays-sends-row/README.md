---
name: "Today's sends and The office's round: two Dashboard cards that say what is wanted"
number: 424
group: close
status: asked 2026-11-23 on the owner's phone · read and drawn twice the same day · the owner picked A for both cards · the office's round built as v2.8331 · left: the Today's sends row, then the window, the name and the Customers row on his word
summary: >
  The Dashboard's Needs you list has a row called Today's sends. Its title is a place, its press
  says Open, and its count adds texts that can go to texts that cannot. The owner could not tell
  what it wanted from him. The row is the pile of texts the app wrote for customers and is holding
  for a person to press. This card says what the row knows, why it reads as it does, and draws a
  before and after of the row and of the window behind it. It also weighs a new name. The same day
  the owner added The office's round, the card under the list, for the same fault. It is drawn
  before and after on the same page.
next: Build the Today's sends row as picked (A), once the Needs you row's layout has settled in its own PR. Then ask the owner about the window, the name and the Customers row.
size: M as a train of five (S · M · S · XS · S); left: the row (S), the window (M), the name (S), the Customers row (XS)
blocker: The row waits on the Needs you layout PR. The window, the name and the Customers row wait on the owner's word.
ver: v2.8331
opinion: build — the row is picked and small; the window is client-only; the rename is the owner's call
---

# Today's sends and The office's round: two Dashboard cards that say what is wanted

The mock-up is [`mockup.html`](mockup.html). Vite dev serves it at `/to-dos/todays-sends-row/mockup.html`.
Every name, text, phone number and count on it is made up. The repo is public, so nothing from the owner's
screenshot is copied here: no count, no figure and no picture.

## The ask

The owner, 2026-11-23, with the row circled on a screenshot of his phone in dark mode:

> On the dashboard Today's sends doesn't make any sense to me as a user. There's not enough context for
> this item. Help me present this differently to users. Show me a before and after of what you're proposing.

The row read **Today's sends** as its title, a line of counts under it (*N texts ready to send, N held*), a
bare number at the right and an orange **Open** beside the number. Its neighbours read *N people are waiting
on us* with **Follow up**, *Sign N lien notices before the run* with **Sign them**, and *N permits wait on a
skim* with **Skim them**.

## What the row is telling a person

The app writes texts to customers: a reminder on a step, a review ask, a text for a moved visit, a text the
office chose to send later. Where the owner's switch for a step is set to **Offers**, the app does not send.
It writes the words and holds them. Today's sends is that pile.

What a person needs from the row alone, and what the app knows when it draws the row:

| The question | The answer | Does the app know it at the row? |
|---|---|---|
| What are these texts? | Reminders and asks the app wrote, and texts the office set aside. | Yes. Each open row carries its step and its words. |
| Who do they go to? | Customers, by name. | Yes. Each row carries the person's name, else the number. |
| Why is the app asking? | The step is set to Offers, so a person presses Send. | Yes by construction. An app-made row exists only for an Offers step. |
| What if nobody presses? | Nothing goes. The text waits, and the run writes no second one for that step while it waits. | Yes. The run keeps a step back while an open offer exists for it. |
| What is held? | The text cannot go as it is. Each held row says why. | Yes. Every hold has its reason and its door in words. |
| Does a held text need me? | Yes. Fix what it names, or put it away with Not this one. One kind clears itself the next morning. | Yes. |

The point that matters for the fix: `useTodaysSends` already reads every open text and builds the full rows
with `todaysSends(await loadOpen())`. It then keeps only a count and one line of counts. So the row can say
far more with no new read.

Verified in code:

- `src/hooks/useTodaysSends.ts` builds the rows and returns `{ count: rows.length, line: todaysSendsLine(rows) }`.
- `src/lib/offers/offers.ts` → `todaysSends` gives each row `who`, `step`, `body`, `held`, `goesOn`, `goesAt` and `office`.
  `todaysSendsLine` writes *N texts ready to send, N go later, N held*.
- `src/lib/offers/offersIo.ts` → `loadOpen` reads `nudge_offers` where `sent_at` and `dismissed_at` are null, with
  the names, the numbers and the step names. It applies the holds for a step already texted, a review already
  answered and a job paid in kind.
- `src/lib/flows/nudgeDispatch.ts` → `offeredAlready` keeps a step back while a text for it waits, and
  `supabase/functions/messages-nudge-dispatch/index.ts` reads the open rows for that check.
- The morning run is at 9 AM (`RUN_HOUR` in `src/lib/flows/nudgeRunLog.ts`).
- The row shows to the GC office team (`needsYouSources.ts`, source `todaysSends`, `canOpenGcProjects(role)`).

Not known at the row today: the day a text was written. `OfferRow` has `preparedAt` but `TodaysSend` drops it.
Carrying it is a small change to the pure kernel, and it is what lets the row say *The oldest has waited 4 days*.

## Why it reads as it does

Every Needs you row is one item from `buildNeedsYouItems` in `src/lib/dashboardNeedsYou.ts`: a `title`, a
`detail`, a `figure` and an `actionLabel`. Most sources write a sentence for the title from their count. This
one is written by hand as a name:

```ts
title: 'Today’s sends', detail: t.line, figure: String(t.count), actionLabel: 'Open'
```

The door is `needsYouDoor` in `src/lib/needsYouDoors.ts`, which answers `{ kind: 'window', window: 'todays-sends' }`
for both hosts. `useNeedsYouPress` mounts `TodaysSendsWindow` over the card. So a change to the item's words
reaches the Dashboard's Cards view, Walk the list, the folds' summary and the trail chips at once. Quickfill
does not show this row: its Messages station carries the pile instead, as a quiet line
(`QUICKFILL_CARRIED_BY_STATION`, `textsLedger.ts` → `W.todaysSends`, `W.todaysSendsOpen`).

**Why Open sat beside the count.** `DashboardNeedsYouCard.tsx` draws a row as a wrapping flex line: the words
at `flex: 1 1 240px`, then the figure, then the press. On the owner's phone a press as short as **Open** fits on
the line, and **Follow up** does not. That is history now. See *The row's layout* below.

## The window behind the press

`src/components/dashboard/TodaysSendsWindow.tsx` has every press it needs. It does not explain itself:

- Its one line of help says *Prepared this morning from the flows, or by you for a morning.* The office does
  not say *the flows* or *for a morning*, and a text may be days old.
- A row's heading is *Dana Whitfield · Approved*. Nothing says Approved is the step the reminder is for.
- Ready, timed and held texts are one list, in that order, with no headings. The held ones are the rows with no Send.
- **Hold until…**, **Stop reminding on this job** and **Not this one** sit side by side as small blue words.
  Nothing says how they differ.
- Send is 34 px tall (`minHeight: 34`) and the blue words are smaller. The app's rule is 44.
- A ready row does not show the number it goes to. Only some held rows name it, inside the reason.
- `TODAYS_SENDS_WORDS.takeBack` (*Take it back*) is defined and used nowhere. A timed text is taken back with Not this one.

The mock-up draws the window before and after.

## The three options for the row

- **A · The row shows the texts (recommended).** Second drawing, after the owner's word on 2026-11-23:
  *show instead of tell*, and *clearly distinguish the values and variables that can change so a user knows
  what is syntax and what is signal*. The title is **3** texts to send. Under it are the names the texts go
  to. A clock chip carries a timed text and its time. An amber chip carries a held text and its cause, such
  as *no number*. There are no sentences. The count is the texts that can go. The press is **Read them**.
  Other days: one text shows the text itself in a bubble; held only reads **2** texts cannot go, each name
  with its cause, and **Fix them**; a timed one alone reads **1** text goes **Tue 9:00 AM**, in grey.
- **B · The first text is on the row.** The row shows the next text itself, with **Send to Dana** and **Next**.
  No window to open. Against it: a text to a customer is one press from a scroll of the Dashboard, and a row
  of its own shape with two presses breaks the one shape the owner set for the list on 2026-11-23.
- **C · No row of its own.** One Messages row counts replies, senders to name and texts to send, and the pile
  moves to the Messages page. Against it: the biggest build, and the texts to send become a fourth number in one row.

A's row has no sentence to hold to `plainWordsFailures`. Its fixed words are a title and two chip labels.
Values are drawn with the app's own two looks from `valuesInPlace/`: bold for one the app works out, tinted
with a dotted line for one a person can change. Fixed words are grey.

## The name

**Recommended: change it to *Texts to send*, as its own PR after the row and the window.** Three things are
wrong with *Today's sends*. The texts are not today's. Nothing on the list is sent until a person presses.
And the switch that fills the list reads **Off · Offers · Sends**, where Sends means the app sends by itself,
so the list called *sends* holds only the texts of steps that are not set to Sends.

With row A the name leaves the Dashboard row. It stays on the window's title and in the places below, so the
rename is separable and can be dropped.

Where the name appears (both apostrophe forms counted, `git grep -i -E "today('|’)s sends"`):

**Words a person reads, in the app's source: 18 lines in 12 files.**

| File | What it says |
|---|---|
| `src/lib/offers/offers.ts` | the window's title |
| `src/lib/dashboardNeedsYou.ts` | the row's title |
| `src/components/dashboard/TodaysSendsWindow.tsx` | the read failure's words, and the stored reason *Stopped from Today's sends* |
| `src/lib/offers/offersIo.ts` | the read failure's context |
| `src/lib/offers/sendLater.ts` | Tell the customer, after Send later: where the text waits |
| `src/lib/flows/appSends.ts` | four lines: under Offers in Flows and Phone and texts, the toast, a kept-back reason, the run's summary |
| `src/lib/flows/nudgeDispatch.ts` | two lines: a kept-back reason, and the line the run writes in a customer's thread |
| `src/lib/flows/nudgeRunLog.ts` | two lines: a kept-back reason, and the run's summary |
| `src/lib/flows/stageSends.ts` | the line a stage's text writes in the thread |
| `src/lib/customerJourneys.ts` | a step's sublabel on the customer journeys page |
| `src/lib/journeys/sampleTexts.ts` | a sample text's note |
| `src/lib/quickfill/textsLedger.ts` | Quickfill's quiet line |

**The server's copy.** `nudgeDispatch.ts` and `nudgeRunLog.ts` are mirrored to
`supabase/functions/_shared/gcKernels/lib/flows/` (`npm run gen:edge-kernels`), and `messages-nudge-dispatch`
is deployed again so the run writes the new words. Its own `index.ts`, `_shared/ratingMint.ts` and
`_shared/sendWindow.ts` name it in comments only.

**Tests that quote the name: 12 files**, among them `TodaysSendsWindow.render.test.tsx`,
`QuickfillTextsSection.render.test.tsx`, `SettingsFlowsTab.render.test.tsx`, `appSends.test.ts`,
`nudgeDispatch.test.ts`, `nudgeRunLog.test.ts` and `stageSends.test.ts`.

**Help guides: 8 files, 23 mentions.**

| Guide | Mentions |
|---|---|
| `work-todays-sends.md` | 5, and its slug. A new slug needs a row in `src/lib/helpGuideFormerSlugs.ts` |
| `offer-the-apps-reminders.md` | 3 |
| `set-up-the-steps-a-person-goes-through.md` | 3 |
| `schedule-a-job-and-tell-the-customer.md` | 3 |
| `pick-the-number-a-text-goes-to.md` | 2 |
| `ask-a-customer-for-a-review.md` | 1 |
| `needs-you-card.md` | 1 |
| `see-who-is-waiting-on-us-and-what-we-owe-them.md` | 1 |

**Living docs: 11 files, 40 mentions.** `GLOSSARY.md` 9 (and the entry's heading), `MESSAGES_ARCHITECTURE.md` 8,
`EDGE_FUNCTIONS.md` 7, `twins/APP_DIRECTORY.md` 4 (then `supabase/functions/twin-mcp/briefs.ts` is generated
from it and `twin-mcp` deployed), `DASHBOARD_SECTIONS_ARCHITECTURE.md` 3, `PROJECT_DOCUMENTATION.md` 3,
`QUICKFILL_ARCHITECTURE.md` 2, and one each in `ACCESS_CONTROL.md`, `AI_CONTEXT.md`,
`MESSAGES_RESIDENTIAL_BUILD_PLAN.md` and `SCHEDULE_DISPATCH_ARCHITECTURE.md`.

**Never edited.** 27 `docs/recent-features/` fragments, 13 release notes, 6 migration docs, 10 migrations and
the other to-do cards that name it. They are the record.

**Cannot be changed.** Lines the run already wrote in customers' threads, run summaries already stored, and
stop reasons already saved keep the old name.

Code names stay as they are: `todays-sends` the key, `todaysSends` the source, `TodaysSendsWindow`,
`useTodaysSends`, `nudge_offers`. A rename is words only.

## The row under it

**Customers** / *3 need a reply, 2 to sort.* / **Messages** has the same fault in a milder form: a place for a
title and a place for a press. It is built a few lines above this row in the same builder
(`customerMessagesLine`). The same grammar fixes it: *3 customers wait on a reply* / *2 more texts came from
numbers nobody has named.* / **Answer them**. It is drawn on the mock-up as a step of its own, and it is not
part of this pick unless the owner says so.

## The row's layout

The owner spoke twice on 2026-11-23 about where a Needs you row's press sits on a phone. First:

> On a phone, I think that these buttons should be much more uniform and we should move them all to the right
> hand side because people will read from left to right.

Then, on seeing this card's rows drawn that way, with a 104 by 44 px press beside the words:

> I don't like the buttons squeezing the text to the left, because some of the text is multiple lines. I would
> prefer we instead just keep it like a smaller button in the bottom right.

So the mock-up's After rows give the words the full width, and a small press sits at the bottom right, on the
row's last line. It is drawn 32 px tall, the size of today's press. The session *needs-you-press-right* owns
that layout in `DashboardNeedsYouCard.tsx` and was sent his second words. This card changes only what a row
says. A press that small needs a 44 px touch area around it, which is that session's to settle.

## The plan

Nothing is claimed, branched or built. Each PR ships its release note, its `docs/recent-features/` fragment
and the guides and docs named.

1. **The row's words (S, client only).** A pure `todaysSendsNeed(rows, now)` in `src/lib/offers/offers.ts`
   returns the count, the names, the timed chip, the held chip with its cause, the press and the severity for
   each state, as marked parts and not as one finished sentence, with tests. `TodaysSend` gains `preparedAt`. `useTodaysSends` returns it, and
   `dashboardNeedsYou.ts` reads all four from it. Quickfill's quiet line says *N texts the app wrote wait on a
   person* with **Read them ›**. Guides: `work-todays-sends.md` → *Find the list*, `needs-you-card.md`.
   Docs: the `todays-sends` row of the sources table in `DASHBOARD_SECTIONS_ARCHITECTURE.md`, the GLOSSARY entry's
   line on what the row counts, `QUICKFILL_ARCHITECTURE.md`.
2. **The window (M, client only).** Three steps drawn across the top, stopped on *You press Send*, in place
   of the help line. Three count chips that jump to Ready, Timed and Held. Each text drawn as a text, with its
   number, its step as a chip and the day it was written (`TodaysSend` gains `number`). **Don't send** opens
   three presses in place: Not this one, Hold until a day, Stop on this job. A held text's cause is a chip, and
   it gets **Open their thread** (`messagesThreadHref`). A timed text's time is the thing pressed to change it,
   with the pieces in `valuesInPlace/`. **Take it back** on a timed text. Every press 44 px. Guide: `work-todays-sends.md` rewritten with a new example. Docs: GLOSSARY,
   `MESSAGES_ARCHITECTURE.md`, `PROJECT_DOCUMENTATION.md`.
3. **The name (S, a sweep that merges alone; only if the owner says change).** Everything under *The name*
   above. Then `npm run gen:edge-kernels`, deploy `messages-nudge-dispatch`, regenerate the twins' brief and
   deploy `twin-mcp`.
4. **The Customers row (XS; only if the owner says so).** `customerMessagesLine` and its item in
   `dashboardNeedsYou.ts`, the guide `needs-you-card.md`.

## Second card: The office's round

The owner, 2026-11-23, with the card circled on a second screenshot:

> On the dashboard, the office round is not context rich and as a result a user looking at it for the first
> time in a while has no idea what it means.

The card had a red border, the heading **The office's round**, a red chip *No round* with a day, a grey line
*Last round* with a day, a time and a count of stations, and one sentence: *The round did not run* that day.
*Today's starts on Today's lines, marked last* another day. It ended in a blue link, **Start today's round ›**.

### What it is

The round is the office's daily pass through Quickfill. Quickfill is one page of stations. A station is one
list to check, and it ends in a press that marks it looked at. The card is the round's close sheet in two
lines, so the owner knows the round ran without opening Quickfill.

Verified in code:

- `src/components/dashboard/DashboardOfficeRoundCard.tsx` reads ten days of `quickfill_section_mark_events`
  once per visit. `src/lib/quickfill/roundClose.ts` does the rest: `officeRoundState`, `officeRoundHeadline`,
  `roundStartStation`, `roundStartWords`, `roundStartPress`.
- Three states. `today`: any station marked today. `not-yet`: none today, and the previous workday had marks.
  `missed`: the previous workday had no mark at all. Only `missed` is red, on the border and the chip.
- **Who sees it:** `enabled={officeEligible}`, which is `isNeedsYouOfficeRole`: a dev, the owner's role
  `master_technician`, an assistant and a controller, whether or not that person ever runs the round. So it
  shows to the owner, who reads about the round and may never run it. The words are the same for everyone.
  Not checked: whether every one of those roles can open Quickfill, where the press lands. Check it in the build.
- It is drawn under the Needs you list in `DashboardPinnedQuickRow.tsx`. Under the new phone layout it stays on
  the Dashboard (`cardsStay` in `src/lib/phoneLayout/needsYouPlace.ts`).
- *Today's lines* is the label of the first station (`sections.ts`, `needs-you`). So *Today's starts on
  Today's lines* means today's round starts on the station called Today's lines. One word, two meanings.
- A workday is Monday to Friday (`isWorkdayYmd`). A weekend with a marked Friday reads *Weekend* in grey. A
  weekend after a missed Friday reads red, with **Start the round**.

### What a person coming back needs, and what the card knows

| The question | Does the card know it? |
|---|---|
| What is the round? | Yes, it is fixed words. The card never says it. |
| Whose is it? | In part. It knows who pressed most in the last round (`sheet.who`). Nobody is assigned a round in the app. |
| What does today ask? | In part. `roundStartStation` picks where the round starts. Which stations are due today is the queue's to say, on Quickfill. |
| How much of a round was done? | Only as a count. A round is the stations due that day, so there is no fixed total to set it against. |
| What did the last round leave? | Yes. `sheet.open` and `sheet.questions`. Shown only on a day the round ran. |
| How many days were missed? | Yes. The days with marks are in the ten days read, and `workdaysBetweenYmd` counts workdays. The card names one day only. |
| What did a missed day cost? | No. A station counts its work only when someone opens it. The card reads marks, not work. |

### Is the red earned

Not for one day. The card knows that no station was marked on the previous workday. It does not know that
anything broke. The red is the same after one missed day and after ten, it shows at one in the morning before
the office is in, and it shows on a weekend. One marked station then turns the chip green and reads *ran today*,
whatever was left. **Built:** amber for one or two missed workdays, red from three in a row.

### The two options

- **A · The card shows the week (picked, built as v2.8331).** Second drawing, on the same word: show, do not
  tell. Six cells, the last five workdays and today. Each is a bar with the stations looked at under it and
  who ran it. A missed day is an empty dashed cell that reads *missed*. Today is the outlined one. The head
  says *each workday on Quickfill*, which is all the card says about what a round is. Under the week, chips
  say what the last round left open, and a small press sits at the bottom right: **Start the round**. The
  miss is said once, by the hole.
- **B · A Needs you row, and no card.** The round becomes one more row in the list, and nothing shows on a day
  it ran. Against it: the owner loses the proof that the round ran and the doors to what it left open, and a
  row has room for one sentence.

### What the build found

The first drawing showed *19 of 21 stations* and two states for today, *under way* and *done*. A round is
not every station every day. It is the stations due that day, each on its own rhythm (`roundQueue` in
`src/lib/quickfill/round.ts`). So no day has a fixed count to be measured against. As built, a bar is that
day against the fullest day drawn, and the number under it is the fact. The card reads marks, not the queue,
so it does not say whether today's round is finished. After today's first mark its press reads **Open
Quickfill** and claims nothing.

**Left, if the owner wants it (S):** read the queue on the Dashboard, so today's cell can say how many
stations are still due and the card can tell *under way* from *done*. `roundRows` and `roundQueue` are pure,
but which stations a person may see is decided inside `src/pages/Quickfill.tsx`, and it would have to move
into a kernel first so the card and the page cannot disagree.

Never start a round on the live app to look at this. A mark is a real record of who looked.

## What the owner is asked

The office's round: picked and built. A, with red from three missed workdays in a row.

Today's sends:

1. The row: picked, A.
2. The window as drawn: yes or no.
3. The name: keep *Today's sends*, or change to *Texts to send*.
4. A timed text that needs nobody: a grey row, or no row.
5. The Customers row: fix it too, or leave it.

## How to verify, once built

- The kernel's tests cover each state: one ready, several ready, ready with a timed and a held one, held only, timed only.
- `DashboardNeedsYouCard.render.test.tsx` and `TodaysSendsWindow.render.test.tsx` cover the wiring. The window
  takes an `io` prop, so a smoke hands it made-up rows and never sends.
- A live look follows `docs/DB_FREEZE_RUNBOOK.md` → Standing protections: one page at a time, by hand. Never
  press Send or Send all on a real customer's text. A ZZ Test customer with a made-up number makes a held row to look at.
