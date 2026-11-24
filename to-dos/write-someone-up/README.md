---
name: "Write someone up, from the Dashboard, on a phone"
number: 410
group: close
status: asked by Taunya 2026-11-20 · assessed, drawn twice and put to her the same night · her go 2026-11-21, *build it all and let me know when it's live*, with every pick kept · the database half v2.8157, pushed 2026-11-21 · the press, the sheet, the short pages, no signal, the office's card, Add to it and Take it back v2.8160, walked on a ZZ Test person the same day · photos v2.8172 and v2.8174, with the old HR Report card retired, walked live on a ZZ Test person 2026-11-21: taken, sent, shown to the office and filed with its evidence record · walked again at an iPhone's size as a leader, as a superintendent and with the signal cut · the person's side dropped on Taunya's word 2026-11-21 · the kept note that stayed after a no-signal send fixed in v2.8250 and walked live 2026-11-22 · Job Mode and its Short view walked live 2026-11-24, nothing written · photos on a weak signal, a kept write-up after the app is closed, the short Dashboard and Add to it walked live the same day, each write-up taken back · left: a look on real phones in real hands, see *Left to do and to walk*
summary: >
  Taunya said writing someone up was not made easy enough for a leader or a superintendent from
  their Dashboard. A leader's only door was the HR Report card, 8.7 phone screens down the full
  Dashboard and folded, and a superintendent had none. The plan is one named press, Write someone
  up, on the full Dashboard, the short Dashboard and Job Mode. It opens a phone sheet: who, what
  kind, what was seen, photos, who saw it, then a read-back and one press that sends. It lands in
  the Pending reports the office already reads, with the job, the time and the facts the record
  lacked. Seven PRs, built on the HR report queue and not on the Writeups forms.
next: A leader and a superintendent each write one up about ZZ Test Hand on their own phone, with a photo and a few spoken words, once with no signal. Then the card closes on Taunya's word. The smaller walks are walked, see *Left to do and to walk*.
size: L as a train of seven (S · M · S · M · M · S · S); left: a look on a real phone (XS)
ver: v2.8157, v2.8160, v2.8172, v2.8174, v2.8250
blocker: A leader's and a superintendent's own phone. A kept voice recording is set aside and the person's side is dropped, see *Set aside*.
opinion: your call — the train is built and live, and what is left is watching a leader use it once
---

# Write someone up, from the Dashboard, on a phone (#410)

The mock-up is [`mockup.html`](mockup.html): ten frames, 380 px wide, in light and in dark. Every name,
job, address and event on it is made up. The repo is public, so nothing below is a real name or event.

## The ask

Taunya, 2026-11-20:

> I don't think we did a good enough job making it easy for a leader or superintendant to write someone up
> from their dashboard. I think that we should add a feature that allows a leader to click one thing, choose
> a person, and then write up what that person did wrong and with details on their phone that we can record
> and save to HR.

She asked for a plan, a mock-up and a pass of *is this the best we can do?*. On 2026-11-21, after reading
them: *I like what you are proposing, please build it all and let me know when it's live.*

## What the assessment found

Read in the code on `main` and walked at 375 px wide as the leader's and the superintendent's sample
accounts. Nothing was written.

- **Two things are called a write-up.** People, Paperwork, **Writeups** is a form built from an office
  template (`writeups`, `writeup_templates`). The **HR Report** card on the Dashboard writes a short dated
  note about a person (`person_reports`), which waits on People, HR, **Pending reports** until a dev files
  it onto the person's Timeline.
- **A leader's door was far away.** The HR Report card sat 7,095 px down a page 8,209 px tall, 8.7 screens,
  folded. It was not on the short Dashboard or in Job Mode. Its presses were 27 to 36 px tall. One press
  sent, with no confirm.
- **The Writeups window does not fit a phone.** It is 420 px wide on a 375 px screen, and People is not on
  the phone's bar.
- **A superintendent had no door.** The card was not drawn for the role, the database refused the save, and
  People sent the role back to the Dashboard.
- **The record lacked** the job, the time, the kind, who saw it, whether the person was told, and a photo.
  With no signal the send failed and nothing was kept.

## The decision

Built on the HR report queue. Its subject is a roster row, so a person with no login can be written about.
An author reads only their own. Nothing reaches a file until the office files it. The Writeups forms stay
the office's formal paper, and the office can start one from a field write-up.

The flow, as the mock-up draws it:

1. **Write someone up**, a named line under the top row. The row of squares is full at phone width.
2. **Who is it about?** The crew on the job today first, then this week's, then a search. Nobody is on
   their own list.
3. **What happened.** Who, when and which job are filled in. The kind, then what was seen, typed or spoken.
   Photos, who saw it, and whether the person has been talked to.
4. **Read it back**, then **Send write-up to HR**, the only press that saves.
5. The writer's own write-ups, each with where it stands. With no signal it is kept on the phone.
6. The office's Pending reports card with every fact, filed to the Timeline as before.

## Taunya's calls

All were put to her with a pick on 2026-11-20. Her go kept every pick.

| Call | Kept |
|---|---|
| What it is built on | The HR report queue |
| The name | **Write someone up** |
| Good news through the same press | Yes, as the last kind |
| *Details we can record* | Photos, and spoken words the phone types. No sound is kept. |
| Where it lands | The office reads it first, as before |
| Who reads the queue | Dev seats, as before, with a line the same day. She names anyone else later. |
| Whom a leader may write up | Anyone but themselves |
| The short pages | They show the press |
| The person written up | Told nothing by the app |
| Take it back | Until the office files it, kept with its reason |

## The plan

1. **The database half (S).** Built, v2.8157, pushed 2026-11-21. The record's new facts, the superintendent's
   right to write and to read their own, the list of people and the function a send lands through. Taking one
   back and adding to one came with it, so step 7 needed no migration of its own.
2. **The press and the sheet (M).** Built, v2.8160. The kernel, the sheet, the press on the full Dashboard for a
   leader and a superintendent, spoken words, the read-back and the writer's own list. The help guide.
3. **The short pages (S).** Built, v2.8160. The same press on the short Dashboard, Job Mode and its Short view.
4. **No signal (M).** Built, v2.8160. The write-up is kept on the phone and sent when the signal is back.
5. **Photos (M).** Built, v2.8172 for the place and v2.8174 for the screens. Taken in the sheet, kept with no
   signal, shown on the office's card, one evidence record once filed. The old HR Report card went with v2.8174.
   The same change keeps a draft's words across a reload, since the first live walk met the app's *Reload* toast
   in the middle of one.
6. **The office's card (S).** Built, v2.8160. Pending reports shows the facts, and a line shows the same day.
   **Start a Writeup from it** is not built: it waits for a word that it is wanted.
7. **Add to it and Take it back (S).** Built, v2.8160.

Steps 2 to 4, 6 and 7 went in as one change. Each costs most of an hour in CI and the queue, and none ships
alone to any use.

## Set aside

- **The person's side. Dropped.** The office would press *Show it to them* on one write-up, and the person
  would read it and write their side. Taunya, 2026-11-21: *It doesn't really matter if the person who's written
  up reads it. What matters is that the company records it.* Frame 10 of the mock-up draws what is not built.
- **A kept voice recording.** It needs storage, a rule for who may play it, and a lawyer's answer before the
  app keeps sound of another person.

## Where it plugs in

- Exists: `person_reports`, `file_person_report`, `dismiss_person_report`, `DashboardPersonReportCard` (retired in v2.8174),
  `HrPendingReportsSection`, the outbox (`src/lib/offline/outbox.ts`), report photos (`useReportPhotos`),
  spoken words (`useVoiceNote`), the supervision rule (`src/lib/people/supervision.ts`).
- New: the kernel `src/lib/people/writeUp.ts`, the sheet under `src/components/writeUp/`, and the press.

## How to verify

Kernel tests on made-up rows. A live walk on a `ZZ Test` person as a leader and as a superintendent, 375 px
wide, with every row made deleted or named in the report. Never a write-up on a real person.

Walked on clicktooling.com on 2026-11-21, on the roster's `ZZ Test Hand`, at phone width:

- As a leader's sample account: the press on the first screen, the list, the search, the form, the read-back,
  the send, **Your write-ups** and the office's card with its facts and counts.
- As a dev seat, after v2.8174: a photo on the form, a reload that kept the words and dropped the photo, the
  photo on the read-back and on the office's card, and **File**, which put the entry on the file with the photo
  as its evidence record.

Walked again the same day at an iPhone's size, with touch and a phone's user agent, by a script on the live
site:

- As the leader's and the superintendent's sample accounts: the press, the search, the form with a photo, the
  read-back and the send. Each was taken back.
- As a dev seat with the signal cut: the write-up and its photo were kept on the phone, and went to HR by
  themselves when the signal came back. The app keeps nothing on the phone while View as is on, so this part
  cannot be walked as a sample account.
- In an iPhone simulator's Safari: the press on a leader's first screen, and the sheet.

Found on that walk: the *Kept on this phone* note stayed on **Your write-ups** after the write-up had gone. Fixed
in v2.8250 and walked live on 2026-11-22 at an iPhone's size as a dev seat, with the signal cut and restored: the
note turned into *Sent to HR at 12:42 am* within three seconds of the signal coming back, over a row reading
**Waiting on HR**. The write-up was then taken back.

What the company keeps: a write-up is on the person's file from the moment it is sent, with its writer and its
day. One that is taken back stays there too, marked dismissed with the reason.

## Left to do and to walk (2026-11-22)

Every walk so far used the roster's `ZZ Test Hand` and a made-up test picture. The script walks ran in a desktop
browser set to an iPhone's size, 390 px wide, with touch and a phone's user agent. A simulator's Safari drew the
press and the sheet, but its automation could not type into them.

### Walked 2026-11-24: Job Mode and its Short view

On clicktooling.com, by a script in a desktop browser set to a phone, 375 px wide and 667 px tall, with touch and a
phone's user agent. As the leader's and the superintendent's sample accounts by View as, in light and in dark.
Nothing was filled in and nothing was sent. Read back after: the same seven test rows and five test pictures.

- **A leader in Job Mode.** The press sits 12 px under the Job Mode card and above My Time. It is 359 px wide and
  52 px tall, 8 px from each edge. As the page opens it sits from 493 to 545 px down. Job Mode's own bottom strip,
  **Leave report** and **Clock In**, is fixed from 534 px down, so the strip covers the lowest 11 px of the press. A
  press on its middle opens the sheet. A press on its lowest edge lands on **Clock In**. A small scroll clears it.
- **The same press on a first visit.** The mode row is open at the top then, and the press sat from 528 to 580 px
  down. By its place 46 of its 52 px were under the strip. That pass measured the place and did not try a press.
- **A leader has no Short view in Job Mode.** That is the rule of #365. With the view held Short the page stayed the
  full Job Mode card.
- **A superintendent in Job Mode.** The press sits under the Job Mode card, from 291 to 343 px down, or 326 to 378
  with the mode row open. It is clear of the strip on the first screen.
- **A superintendent's Short view.** The press sits in the same place, under the job card and above **Tomorrow** and
  **Everything else**. Nothing waited on the sample account, so the *Waiting on you* card drew nothing above it. The
  whole page is one screen tall.
- **The sheet.** One press opened it every time, over the strip and the bar, from 100 px down to the bottom of the
  screen, at the full width. **Close** is 48 px square. **Search everyone** is 48 px tall. Each of the 38 people's
  rows is 60 px tall, and `ZZ Test Hand` is among them. **Your write-ups** is 60 px tall. Nothing scrolls sideways.
  Light and dark each drew the press and the sheet in the theme's own colours. **Close** closed it, no draft was
  kept, and the press did not say *1 not finished*.
- **Not opened.** The form and the read-back need a person picked, so this walk left them. They are the same sheet
  the walks of 2026-11-21 filled in.
- **The Short view is not kept in the browser.** It rides `users.dashboard_view`, and both sample accounts read Full.
  The walk held Short in the browser: it answered the one read of the view itself, and the row was not changed.
- **What the walk left.** Three rows in the View as record, `user_imitations`, one for each View as. The page saves
  a press count for each press on **Write someone up** and for switching Job Mode on. The walk held those at the
  browser, with the page's activity stamp, so none landed.

### Walked 2026-11-24: the four walks that write

Diane's go, 2026-11-24: *Yes, all four*. Before the first send the send path was read in the code. A send is one
row, and one file and one row for each photo. No trigger, email, push or text hangs off it. The dev seats see a
line for it, and nobody else is told. Every write-up was about `ZZ Test Hand`, began *TEST. Not a real event.* and
was taken back at the end of its walk. The script read the name on the read-back before each send. Nothing was
filed and nothing was deleted. All four ran at 375 by 667 px, by a script on clicktooling.com.

- **The short Dashboard.** As the leader's sample account by View as. In his own Settings, **Your dashboard**,
  **Dashboard view**, a press on **Short** saved. The Dashboard then opened as the short page, in light and in
  dark. The press sits under the *Waiting on you* list and above the line about the office. The sample leader has no
  schedule, so none drew above it. It is 359 px wide and 52 px tall and opened the same sheet. As the page opened
  it sat from 600 to 652 px down, and the phone's bottom bar starts at 607 px. So the bar covered it, and a press
  there did not reach it. One scroll shows it. Two lines waited on him, and the mode row and a new browser's *Add
  Task* line were open at the top. **Full** was then pressed in the same place. The view reads `full` now. It was
  empty before, which reads the same. View as keeps nothing on the phone, and that changed nothing here: this walk
  sends nothing.
- **Add to it.** As the leader's sample account. A new write-up was sent and read **Waiting on HR**. On its row
  **Add to it**, 44 px tall, opened the form as *Write up · adding to one you sent about ZZ*, with the kind kept.
  That one was sent too, and its row points at the first. As a dev seat, People, HR, **Pending reports** drew the
  two cards one after the other, the addition second, with its *Adds to* line. Nothing was pressed there. Both
  were then taken back and read **Taken back**. The row kept for Taunya was not pressed and still waits.
- **A kept write-up after the app is closed.** As a dev seat, with one small made-up picture. With the signal cut,
  **Send write-up to HR** answered *Kept on this phone*, and the row read **Waiting for signal**. The browser was
  closed with no signal and opened again 15 seconds later with signal, on the Dashboard, with nothing pressed. The
  picture went first, then the write-up, about one second after the page loaded. The row's press time is 21
  seconds before the time it landed. **Your write-ups** then showed it as **Waiting on HR** with no kept line. It
  showed no *Sent to HR at* line: that line is drawn in the sitting that sends. The walk ran with the service
  worker off, so the app opened as a fresh page load and not from its saved copy.
- **Photos on a weak signal.** As a dev seat. The picture was made up, 4,000 by 3,000 px and 3.7 MB. The sheet
  shrank it to 1,600 by 1,200 px and 123 KB in about a second. A made-up picture shrinks further than a real
  photo. For the send the link was held weak and not cut: 600 ms of delay, 150 kbit/s up and 400 kbit/s down.
  **Sending…** showed for 9.7 seconds, 7.4 for the picture and 0.7 for the write-up. It ended in *Sent to HR* and
  was never kept on the phone. The link was weak for the send alone. The app was opened on a full link.
- **What these walks left** is listed by id under *Test rows on prod*. Each press count the page saves was held at
  the browser. The two View as sittings each left a row in the View as record.

### Walks still owed

- **A real phone in a crew lead's hand.** `/dashboard`, **Write someone up**. A real leader and a real
  superintendent, each on their own phone, one iPhone and one Android, on `ZZ Test Hand`, in the light they work
  in. They should see the camera open on **Take a photo**, the phone type their words on **Talk it through**, the
  read-back and *Sent to HR*. Not walked because it needs those people and their phones. This is the card's
  `next`.
- **A kept write-up that is refused.** Only smoke tests cover the case where the server refuses a write-up that
  waited on the phone. It is hard to make happen live, and is listed for completeness.

### Loose ends

- **PRs.** None open. The train merged as #9197, #9201, #9208, #9222, #9265, #9285, #9317 and #9327, with
  #9235 for a timer that turned CI red.
- **Migrations.** Both are pushed to prod: `20261121131500_person_report_write_up.sql` and
  `20261121143500_person_report_photos.sql`.
- **Edge functions.** None owed. `npm run check:edge-drift` was clean on 2026-11-22. On 2026-11-21 it named
  `your-week-email` and `bridge-weekly-sheet` as one shared line behind. Neither reads that line, and both are
  current now.
- **A fault seen and not fixed.** The app's own *A new version is ready* toast sits over the sheet's bottom
  button until **Not now** or **Reload** is pressed. A reload keeps the words since v2.8174, but not the photos.
  The walk of 2026-11-24 did not meet the toast. In the code the toast is drawn on a layer above the sheet's, 1rem
  from the bottom of the screen, which is where the sheet's bottom button sits.
- **A second fault seen and not fixed.** At 375 by 667 px a leader's press in Job Mode opens partly under Job
  Mode's own **Clock In** strip, see *Walked 2026-11-24*. A superintendent's does not. On the short Dashboard the
  sample leader's press opened under the phone's bottom bar on the same screen, one scroll away.
- **Test rows on prod**, all about `ZZ Test Hand`, all saying they are tests. Each id below is a
  `person_reports` row.
  - `281fd830-3872-4561-bd23-2e12ae99baed` is **Waiting on HR**, written by the leader's sample account. It is
    left for Taunya to try filing.
  - `0ff1a92e-fed1-4ee0-a8c6-917dc3094934` is filed. Its file entry is `034282d1-18b9-43f1-a172-87ac58a2f0a0`
    and its evidence record `928c063e-694c-4a28-a745-63ed9d5d837e`, exhibit 3, with its photo copied into the
    test person's Drive folder. File entries and evidence append and never change, so these stay.
  - Five are taken back: `7194284a-2754-4ddd-ad8d-627e5eced37e`, `71e274cc-3c2a-42a7-9ffb-bcd6be20c6f7`,
    `d5802b28-d465-40ed-85c5-2a639b002a61`, `421325f4-e2b3-4cee-8812-47f550c5d6e7` and
    `032d8704-5fed-40f8-97b2-dc90d336a232`. A delete of the first was declined on 2026-11-21, so they stay
    unless Taunya says otherwise.
  - Five test pictures sit in the private `person-report-photos` bucket, one row each in
    `person_report_photos`.
  - Four more are taken back, from the walks of 2026-11-24. `81d0b2ed-1aca-4a98-ad55-95a88d1670e6` is the weak
    signal walk's. `ed3a9823-6232-4a03-8653-fb637b8b65c2` is the kept one's. `5e8e87e0-f89b-46ad-8002-2008e968d27b`
    is the first of Add to it, and `c0eb054c-3bff-4604-90c0-c25294b3075d` is its addition. They wait on Taunya's
    word like the five above.
  - Two more test pictures sit in the same bucket, one row each, and wait on her word too:
    `47f58a4e-3c6f-43b5-af75-b16520051ccb` from the weak signal walk and `34c22864-c3cd-4a16-9c83-d408efea6cd0` from
    the kept one. The writer cannot remove a picture once its write-up has landed.
  - The leader's sample account has `users.dashboard_view` at `full`. It was empty before the short Dashboard walk.
  - Read back on 2026-11-24 after the walks: eleven rows about `ZZ Test Hand`, one waiting, one filed and nine
    taken back, and seven pictures.

### Set aside and Taunya's calls

- **The person's side** is dropped, see *Set aside*.
- **A kept voice recording** is set aside until a lawyer answers.
- **Start a Writeup from it** on the office's card is not built. It waits for her word that it is wanted.
- **Who reads Pending reports** is dev seats, as built. She names anyone else later.
- **The test rows above** stay unless she says to delete the taken-back ones.
- **Closing the card** is hers, after the real-phone look.
