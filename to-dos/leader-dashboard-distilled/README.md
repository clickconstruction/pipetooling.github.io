---
name: "The leader's Dashboard, distilled"
number: 365
group: close
status: the owner picked direction B, the short Dashboard · PR 1 (v2.7466), PR 2 (v2.7568, the office's Waiting on card) and the first half of PR 4 (v2.7572, the bar's Dashboard tab) are built · the short page was walked live as the leader's sample account on 2026-11-17 · the owner answered the seven calls on 2026-11-17 and every default stands · nobody is on Short yet · the two places the view is set were read in an iPhone simulator 2026-11-25, and two small faults were seen on a person's desk on the way · the short page walked there the same day on the dev's own account, where it holds but for two lines that are wrong for about three seconds on a fresh open · all three faults mended · a fourth sitting the same day saw the two counts move ten seconds after they drew, which is not mended and is larger than a small fix, and a small Remind press on the office's Team's open tasks, mended in v2.8600, not yet seen · v2.8581's two desk mends held in the simulator on 2026-11-25 and the desk link held in the browser pane at 1280 px the same evening
summary: >
  One leader has been given too much on his Dashboard. He will not look at any of it, uses the app only on
  his phone, and hands even small updates to his assistants. The assessment counted 44 cards, strips and
  squares on his page, none of them folded, and found that only seven are his alone. The owner picked a
  short Dashboard: one list of what waits on him alone with one press a row, his day, and one door to
  everything else, set per person so a leader who wants everything keeps it. PR 1 builds that page and its
  setting. PR 2 gives the office the same list with a Remind press. The owner kept every default on
  2026-11-17, so no text goes to him and his bar keeps its five tabs. What is left is the press that sets him
  to Short.
next: Set the leader to Short on his People desk, then walk his page with him on his phone. Nothing else is owed until the owner asks for the text or the four tabs.
size: M as a train of four (M · S · M · S); built: PRs 1 and 2 and the first half of 4; set aside by the owner's answers: PR 3 (M) and the four tabs (S)
blocker: None in the code. Setting the leader to Short is the owner's or the office's press.
ver: v2.7568, v2.8581, v2.8600
opinion: build — the first PR changes nobody's page until the office presses Short, so the risk is in what the short page hides, and that is the owner's call to make with the leader beside him
---

# The leader's Dashboard, distilled (#365)

The mock-up is [`mockup.html`](mockup.html), also at https://claude.ai/artifact/UYBwzvLrw7CwmnY56dAqmG.
Its names and figures are made up. The repo is public, so nothing below is a real name or a real figure.

## The ask

The owner, 2026-11-16, paraphrased closely: look holistically at the leader's Dashboard. Some leaders embrace
knowing everything. Others need to focus on what they are good at. This leader was given too much, and now he
will not look at any of it without getting overwhelmed. Turn his Dashboard into something more distilled, and
still give him the tools to jump in where he needs to. He has so little interest in technology that he would
rather task the smallest updates to his assistants. He uses the app only on his phone.

## What the assessment found

Read from the code on `main` and from the dev seat reading as itself. His live screens were not seen: the
session had no sign-in as him.

- **44 cards, strips and squares** on the Dashboard page for a leader with Job Mode off. About 26 hide on a
  quiet day. Around the page: a fixed bar of 5 tabs, 14 menu entries, 17 gear entries and 6 header icons.
- **Nothing is folded for him.** `isPhoneOfficeRole` (`src/lib/dashboard/phoneOffice.ts`) gives the phone
  folds to assistant, controller, primary and estimator. The leader is not on it.
- **Needs you** can show him lines from 49 of its 56 sources (`src/lib/needsYouSources.ts`).
- **Two homes.** With Dispatch Mode on, the bar's Dashboard tab opens `/dispatch-mode`, not `/dashboard`.
- **No per-person view existed.** Only quick-button ticks, their placement, pins, daily goals and the week
  signal, and the office could set none of the layout ones for him.

### The three piles

- **Only he can do it (7 of 44).** Needs you, for the five lines the database reserves for a leader: approve
  a lien notice, sign one, approve a GC's run, sign a lien waiver, review the assumed line budgets. My
  Schedule. His HR report. And four that show now and then: a trial helper's verdict, Rate your crew, his
  partner ledger, required training.
- **The office can do it, or already does (24).** The money cards, billing, who is clocked in and the hours
  to approve, Crew Day, both inboxes, reports, inspections, and every other Needs you line.
- **Nobody needs him to see it (13).** The floating section chips, the nine quick buttons, Clock in and My
  Time (his hours are written from the schedule), the map, My Bids, the lien month, Money in, the Projects
  strip and the Job Mode card.

### What his assistants see and can do

- They see *N waiting on* him on the Lien Board's tile, and a Waiting on group on the Lien desk with a
  Remind press. Since v2.7445 anyone in the office can remind him.
- They can act for him on lien papers four ways: record his spoken word, have him draw on their screen, type
  his signing code, or record his pen on paper.
- Until v2.7568 nothing showed them the waivers, the line budgets or the tagged notes that wait on him. The
  Waiting on card on their Dashboard lists them now.
- Nothing scheduled tells him what waits. Asking him for a waiver signature sends him nothing.

## The three directions

| | What he sees | Build | What it risks |
|---|---|---|---|
| **A. Fold what is there** | Today's page as about 12 one-line bars, his lines first | Small, no database change | Still a list of everything |
| **B. The short Dashboard** (picked) | What waits on him, his day, one door to everything else | Medium, one added column | Money over 30 days, crew problems and hours to approve leave his first screen |
| **C. Bring it to him** | A text that opens one signing screen | Medium to large: a daily send | Texts become the next thing he ignores |

The owner picked **B** on 2026-11-16. C reads best later on top of B, since the text needs a screen to land
on. A's folds came along free: a person on Short who opens Everything else on a phone gets them.

## Where it plugs in

Built in PR 2 (v2.7568): `src/lib/dashboard/waitingOnLeader.ts` (the rows and the words, held to the short
page's six keys by its test), `waitingOnLeaderLien.ts`, `waitingOnLeaderIo.ts`, `useWaitingOnLeader`,
`DashboardWaitingOnLeaderCard.tsx` under Needs you, and `src/lib/jobs/lienReminderRun.ts` for the send.

Built in PR 1 (v2.7466):

- `src/lib/dashboard/shortDashboard.ts`: the view, who may have it, the six keys that are his alone, the
  three-way split over `needsYouActor`, the read state that stops a false *Nothing waiting on you*, every word.
- `src/components/dashboard/DashboardShortView.tsx`: the page. It reads `useNeedsYouInputs` once and presses
  through `useNeedsYouPress`, and draws v2.7435's `LienLeaderSignCardView` for the lien notices.
- `src/pages/Dashboard.tsx`: an early return after Job Mode's, and **Back to the short Dashboard** on the
  full page.
- `users.dashboard_view` and `set_dashboard_view` (`20261117030000_dashboard_view.sql`), `useDashboardView`,
  `DashboardViewPicker` in Settings, and the People desk's **Dashboard view** section.

## The plan

1. **The short page and its setting.** Built, v2.7466.
2. **The office's Waiting on card.** Built, v2.7568. The same rows on an assistant's Dashboard: *Waiting on
   Marcus*, the lien rows with Remind, and one press for *Marcus is here, sign with the signing code*. No
   function was needed: the office already reads the waivers, the line budgets and the tagged notes under its
   own row-level security. A waiver, a tagged note and the line budgets have no reminder yet, and the row says
   so. Step 3 is where a send for them belongs.
3. **A text when a paper is ready (M).** Set aside, 2026-11-17: the owner kept call 6's default, no text
   yet. If he asks later, it is direction C on top of the short page: one text at an hour he picks, with a
   link that opens the signing screen. A daily send, a schedule and a per-person switch.
4. **His bottom bar (S).** The first half is built, v2.7572: on Short, the Dashboard tab opens the short page
   whichever mode is on, and one press on it leaves Everything else. The four tabs are set aside,
   2026-11-17: the owner kept call 5's default, so the bar keeps its five tabs. If he asks later, the phone
   dock's four slots and its More sheet, the assistant's today, are where they would go.

## The owner's calls

PR 1 took the default in brackets for each. All seven were put to the owner on 2026-11-17, in the session
that built PR 2. **He answered the same day: the defaults stand, all seven.** Nothing built changed for it.

1. Are the five leader-only lines the whole of what stays his alone? [The five, plus a job note that tagged him.]
2. May he sign several notices with one press after reading the list, or one paper at a time? [One at a time.]
3. Who owns what leaves his screen: money over 30 days, hours to approve, bank label approvals? There is no
   controller account today. [It stays behind Everything else, and the door says how many are his.]
4. Does his day belong on the page, or only the list? [His day is on it.]
5. Which four tabs sit at the bottom of his phone? [The bar is untouched.]
6. Should a text reach him when a paper is ready, and at what hour? [No text yet.]
7. Is Short the default for every leader, or set person by person? [Person by person. Everyone is on Full
   until someone presses Short.]

What the answer settles:

- **Call 5** keeps the bar's five tabs, so the four tabs half of step 4 is not built.
- **Call 6** sends him no text, so step 3 is not built. The office's **Remind** on the Waiting on card is how
  word reaches him.
- **Call 7** leaves every leader on Full until someone presses Short on that person's desk.

One thing was built on the bar before the answer came: v2.7572 changes where the Dashboard tab leads for a
person on Short, and nothing else about the bar. Nobody is on Short, so nobody's bar changed. If *untouched*
was meant to cover that too, v2.7572 is the one to take back.

## How to verify

- `npx vitest run src/lib/dashboard/shortDashboard.test.ts src/components/dashboard/DashboardShortView.render.test.tsx src/components/personDesk/sections/PersonDeskDashboardViewSection.render.test.tsx`.
- Live, after the migration is pushed: on People, open the leader's desk and press **Short** under
  **Dashboard view**. Imitate him at 375 px wide. The Dashboard opens on the short page. Each press opens
  what the Needs you card's press opens. **Everything else** opens the full page folded, and **Back to the
  short Dashboard** returns.
- Read only as him: press nothing that signs, approves or sends.
- A dev's own account can be set to Short too, which is the quick way to look without imitating anyone.

## The live walk, 2026-11-17

The short page was walked on the live app as the leader's sample account, 375 px wide, through View as. The
view was answered Short in that browser only. Nothing was written: no row was set, and nothing was signed,
approved or sent.

- **It shows** the greeting and the count, **Waiting on you** with two rows that day (lien notices to sign
  with **Sign them**, and the assumed lines with **Review**), the office's line, the door with *6 more of
  yours are in there*, and Training.
- **It hides** the Job Mode nudge, the Clock In, Job report and Tally squares, the Needs you card and its 26
  lines, the three money cards, Money in, Projects, the nine quick buttons, Crew Day, My Inbox, Your people,
  Recent reports, the Billing pipeline, the lien month, the HR report and My Time.
- **Everything else** opens the full page, three times as tall, with nine sections folded to one line each
  and **Back to the short Dashboard** on top. Back returns to the short page.
- **The bar** holds its five tabs: Dashboard, Schedule, Inbox, Customers, PO.
- No sideways scroll at 375 px.

Four things for the owner's eye:

1. **His day did not draw.** The sample account has nothing scheduled, so nothing sat between the list and
   the office's line. His own day is still unseen.
2. **Training shows three courses**, the one required and two that are optional. On a short page that is
   three **Start** buttons under the door.
3. **The line budgets row is long**: a figure and two sentences of instruction under one button.
4. **The HR report is behind the door.** The assessment counted it among the seven that are his alone.

Not walked: the dark theme on the live page, the lien card (no notice waited on an approval outside a run
that day), and any press that signs.

## Where it stands

PR 1 is on `main` (v2.7466) and its migration is pushed (2026-11-16). PR 2 (v2.7568) is the office's
Waiting on card, client only. The first half of PR 4 (v2.7572) is on `main`. The owner answered the seven
calls on 2026-11-17 and every default stands, so the text and the four tabs are not built. The leader has
not been set to Short: every leader's and dev's row reads Full. That press is the owner's or the office's.

## Read in a simulator (2026-11-25)

Read on 2026-11-25 in an iPhone simulator, in Safari at 402 by 874 points, as the dev, on the live site. Nothing of the short page was seen, and nothing was pressed: setting an account to Short is a write the walk was not cleared to make.

- **Both places the view is set read as built.** Settings → Your dashboard → **Dashboard view** offers **Short** and **Full** with their one line each, Full lit. The sample leader's desk has the same two, Full lit, with the line that the office can set it for them.
- **Two small faults on a person's desk on a phone, read in the code the same day. Mended in v2.8581, and both held in the simulator's fourth sitting the same day.** Each is the client alone, S.
  1. **The link to this section lands one swipe short.** A link that ends `&section=dashboard_view` opened the desk at Licenses and Your week. The desk scrolled to the section once, before the sections above it had loaded and grown (`PersonDeskBody.tsx`). v2.8581: the aim is held for a second and a half while they settle, waits for a section that draws late, and lets go at a touch.
  2. **The desk's pinned head takes about half the screen.** On that account, with two amber notices, the head took about 445 of 874 points and the sections scrolled in a window of about 315. The head sat outside the scrolling part and nothing folded it. v2.8581: on a phone the head scrolls away with the sections and the name's row with its × stays pinned. The amber bands are not folded into one line, which is a bigger change and a call.
- **Still owed.** The short page itself, **Everything else**, **Back to the short Dashboard** and the bar's Dashboard tab, on an account set to Short.

## The short page, walked in a simulator (2026-11-25)

Walked on 2026-11-25 in an iPhone simulator, in Safari at 402 by 874 points, in dark, on the live site, on the dev's own account set to Short for three and a half minutes and put back to Full, on the owner's yes. It is a simulator and not the leader's phone. The leader's own account was not set to Short.

**Holds.** **Short** saves at once. The page reads the greeting, the count, *Waiting on you* with its rows, the office's line, **Everything else** with its count, then Training. It draws no top row, no Clock In, no money cards and no Needs you card, and nothing runs off the side. **Everything else** opens the full page with **‹ Back to the short Dashboard** on top, and its Needs you card counts what waits plus the door's count. **Back** returns. A fresh open of the Dashboard lands on the short page. **Full** puts it back.

**One fault found, mended in v2.8581 and not yet seen: two lines were wrong while the list is read.** On a fresh open the list reads *Reading what waits on you…*, which is right. For about three seconds the line under it reads *Nothing else is open.* and the door reads a count far under the true one. Once the read ends both are right. The list holds a reading state, and these two lines do not: they are drawn from the counts as they stand while the sources come in (`DashboardShortView.tsx`). The mend is the client alone, XS: while the list is read, the office's line is not drawn and the door says its words without a count.

**For the owner's look.**

- Training is the lower half of the page: four **Start** presses under the door on that account.
- **Write someone up** stands above *Waiting on you*. It came later, with #410.
- The header's home press does not leave Everything else. Only **‹ Back to the short Dashboard** returns. That is as v2.7572 built it: only the bottom bar's Dashboard tab carries the mark that returns.

**Not seen.** His day: the account had nothing on its schedule. The folds behind Everything else. The bottom bar's Dashboard tab on Short, since that account has no bottom bar. The leader on Short, and the office's Waiting on card.

**As the sample leader and the sample assistant, looking only.** The leader's bottom bar has Dispatch Mode's home under its Dashboard tab, not the Dashboard: the *two homes* this card names.

## The simulator's fourth sitting (2026-11-25)

As the sample leader set to Short for the look.

**The two counts move after they draw. Not mended.** The page read *23 other things* and *4 more of yours*, and ten seconds later *24* and *6*. v2.8581 made the two lines wait for the page's read, but that read asks about the two lien reads alone (`shortDashboardRead`). The counts come from every source of the Needs you card. `useNeedsYouInputs` reads 67 sources, and about sixty of them hand back no word on whether they are still reading. So making the counts wait for all of them means a loading flag on about sixty hooks. That is a medium piece of work with a call in it, not a small fix, and it was sent back on 2026-11-25. The list under *Waiting on you* did not move.

**Remind on the office's *Team's open tasks* stood about 27 points tall on a phone. Mended in v2.8600.** It stands 44 on a phone now and gives the difference back to its row, so the row is as tall as it was. At a desk it is as it was. Not yet seen in the simulator.

**v2.8581's two desk mends held.** The link that ends `&section=dashboard_view` opened the desk on that section, and the
desk's pinned head was one row of about 60 points where it had been about 445. The same evening the browser pane opened the
same link at 1280 px on a fresh load: the head one block above the sections, and the **Dashboard view** section's head at
the top of the scrolling part. Neither **Short** nor **Full** was pressed on either look.

**Which card *Waiting on* means.** Not *Team's open tasks*. It is the card under **Needs you** titled *Waiting on* and the leader's first name, drawn only when a leader has lien rows waiting. A look at it needs a ZZ lien paper waiting on a leader, which is a write and its own yes.
