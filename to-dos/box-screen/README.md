---
name: "A box's own screen: the parts first, four tiles that carry their facts, the rare presses behind More"
number: 398
group: close
status: asked 2026-11-18 with a screenshot of a box on the Tally's On site tab · walked read-only and drawn the same day · the six calls taken as picked, then a second pass on his ask (is this the best we can do) · the owner's go the same day (I like it, build it all) · built 2026-11-18 as v2.7873, one PR (#8831), on top of Take from a box (v2.7824, v2.7828), on main · walked in an iPhone simulator 2026-11-25 on a box with five kinds of part: the screen's presses hold, five small faults were found, and two things wait on the owner's word · 2026-11-25 (UTC) in the managing session: the first of the two is answered, an add counts its own line and not the box; the second is not decided, and a mock-up of the screen as it is and of each option is owed first; one photo of a box on the ZZ test job was given a yes, asked again at the time · seen in the simulator the same day with the text at 125%: none of the four tiles is on the first screen · four small faults mended in v2.8583, merged 2026-11-25, not yet seen in the simulator · read in the code the same day: the added part's own count and the list's Count chip are ruled in the database too, so the two are one small lane with a migration, briefed and not built · the owner the same day: a crew member may retire, edit or move a box, as built · two of v2.8583's mends held in the simulator the same day · the photo was not taken, since a simulator's camera takes no picture, so it waits for a real phone · seen on that look, briefed and in review: the tally says a site has no containers while it is still reading, and after a read failed
mockup: to-dos/box-screen/mockup.html
summary: >
  A crew member at a cage asks two things: is this the box in front of me, and what is in it.
  Today the answer starts two thirds of the way down the phone, among 22 presses of much the
  same weight, six of them under 48 high. The box says what is in it three times, one chip row
  does three unlike jobs, office work has a third of the box's presses, and Short does not say
  what it does. The redrawn screen is the box's name, then its parts as closed rows with their
  numbers, then four tiles that each carry their own fact (Count, Photo, Add a part, Where is
  it?), then photos and takes, with Take from a box's press at the bottom as the only blue one.
  Edit, Say it better, Move box, the three paper presses and Retire go behind one More press.
  Eight presses in place of 22, every one 48 high or more.
next: The mend of the tally's false empty words is in review, the client alone, and needs a look once it is live. The simulator saw two of v2.8583's four mends hold; the other two are not looked at yet. Build the one lane left of the small faults, a migration and the client together, pushed on its own yes: an added part counts its own line and not the whole box, and the list's Count chip leaves an empty box out. Draw the mock-up the tiles call asked for before it can be made: the screen as it is beside each way to make the four tiles fit, at 125% text too. Then the owner sees the screen on a phone, with a crew member's own screen and the camera, which no walk has made. Box ZZ4 on the test job holds five kinds of part for that look.
size: M as two client-only PRs (S · M), built as one; left: the five small faults and the add that counts its own line (S), a mock-up for the tiles call, and the owner's look on a phone (XS)
ver: v2.7873 · v2.8583
ask: owner · decide · With five kinds of part the four tiles do not fit above the Take bar on a phone. Which gives way, once the mock-up of each option is drawn?
blocker: The tiles call waits on a mock-up of the screen as it is and of each option, which is not drawn. The lane with the migration waits on a builder and, at the time, a yes for its push.
opinion: build — the owner said build it all; the size of each press now follows how often the crews use it
---

# A box's own screen (#398)

## The ask

The owner, 2026-11-18, with a screenshot of a box's screen on the Job Parts Tally's On site tab:
*Help me improve this page it is hard to follow as a user, once you think you have improvements
show me the before and after as a mockup.*

After the first drawing: *This is really good! using all the defaults can you give it one more
pass asking is this the best we can do? I'm a huge fan of show instead of tell.*

After the second: *I like it, build it all and let me know when it is live.*

The look, with today's screen marked up and every press listed, is a private page:
*A box's own screen* — https://claude.ai/artifact/D31N5J6KVxkUxZqJZ6F9XM. The mock-up beside this
card is the same drawing with made-up names.

## What is wrong today

Walked in the running app at 390 by 844 and 430 by 932 on a test job, with every write refused in
the browser. The screen is the branch of `src/components/tally/TallyOnSiteTab.tsx` where
`view.kind === 'container'`, drawn inside `src/pages/JobTally.tsx`.

- **22 presses under the app's bar.** Six are the Tally's own (← Dashboard, three tabs, Photo of
  a ticket and its link). Sixteen are the box's. Each extra kind of part adds four.
- **Six of the box's sixteen are under 48 high**: Edit 42 by 36, Say it better 94 by 36, Move box,
  Where is it? and Photo 110 by 36, Retire 68 by 36.
- **The parts start at 600 of 844.** The screen is 1,028 px tall on that phone.
- **The box says what is in it three times**: *1 parts* under the name (the code has no
  singular), the box's own line, then the part's card.
- **One chip row does three unlike jobs.** Move box changes the record, Where is it? is for
  someone who has not found the box yet, Photo opens the camera.
- **Edit already holds two other presses.** Its window has *What is in it* and *Which place on
  site*, the fields behind Say it better and Move box.
- **Short does not say what it does.** It asks the office for more. The guide uses *a short count*
  for a count that comes up missing.
- **Office work has a third of the box's presses**: two prints, a copy and Retire.
- **Three nouns for one thing**: cage in the title, box on the presses, container on the back
  press and in the empty state.
- **An empty box offers Add a part twice.**

## The decision

All six calls of the first pass were taken as picked. The second pass found three faults in the
first and changed one pick.

1. Edit, Move box, the three paper presses and Retire go behind one **More** press. *Taken.*
2. **Short** becomes **Ask for more**. *Taken.*
3. The app's own line and Say it better leave the box's screen. A person's own words stay under
   the name. The line stays on the list, the labels and the office page. *Taken.* This touches
   #351, whose try on a real site is still open.
4. A mixed box's lines start closed, one open at a time. *Taken*, and widened by the second pass:
   **the usual box's one line starts closed too**, with its four presses one tap in.
5. **Take from G12** is the only blue press. Count is never blue, and turns amber when due.
   *Taken.*
6. The Tally's title row folds with its tabs while a box is open. *Taken.*

What the second pass found in the first:

- **The most used presses were the smallest.** The ledger held 162 counts, 94 box photos, 3
  presses of Used and 1 of Can't find. The first pass shrank Count from 342 by 48 to 110 by 48
  and gave four presses of 152 by 52 to the line.
- **A fact sat in one place and its press in another**: *Counted yesterday by …* as a caption,
  Count as a small button further down.
- **Where is it?**, a press for someone who is not there yet, took a full row above the parts.

### The screen as decided, top to bottom

1. `‹`, the box's name large with its kind small beside it, a person's own line under it, and
   **⋯ More**.
2. The left-run strip and the pin ask, where they apply, as today.
3. The parts. Each is a closed row with its number. A tap opens Used, Move to…, Can't find and
   Ask for more under it, two by two at 52 high. One row is open at a time. A row with something
   missing wears the amber edge and its reason. On Unsorted a row opens by itself, since
   **Put in…** is that screen's whole point.
4. One muted line: *Tap a part if some are missing, moved or needed.*
5. Four tiles, two by two, each a press that carries its fact:
   - **Count G12**: *Counted yesterday by Mateo*. Amber with *Due. Last counted 16 days ago* when
     a count is due. Not drawn on a box with nothing to count.
   - **Photo**: *1 so far, Nov 17*. For the ten minutes after a count, an added part or a put
     away it is outlined blue and reads *Of G12 as you counted it*, in place of today's chip that
     turns blue and says nothing.
   - **Add a part**: *1 kind in G12 now*. On an empty box it is still drawn, and reads *The first
     part in G12*. The empty state has no press of its own, so the press is offered once. This
     line said the opposite until 2026-11-25. The code and its test have always done this.
   - **Where is it?**: the place, the where line and the pin's state.
6. *Photos and takes*: the box's photos and its last takes with their pairs, in one strip. A photo
   still on the phone keeps its amber words and **Send now**. A filed one has no words.
7. Take from a box's **Take from G12**, sticky at the bottom. On a box with nothing on hand it is a quiet
   link instead (v2.8263).

**More for G12** lists Edit G12, Say it better (Say what is in it on a box with no line yet), Move G12, Print the label, Print the manifest
and Copy the label code, each with one line that says what it does. Retire G12 sits apart at the
bottom, and the *Last touched* line is under it. Every sheet behind a row is the one the app has
today.

Presses on the usual box: 22 today, 18 after Take from a box as designed, 11 in the first pass,
**8** in the second. The part starts 71% of the way down today and 21% as drawn.

### Weighed and not picked

- **A bar under the thumb with Count, Photo and Take.** Photo and Take both open the camera, and
  side by side they are the wrong photo press that Take from a box is taking away.
- **The box's photo large at the top.** A person at the cage is looking at the cage. The picture
  helps someone who is not there, and Where is it? already opens on it.
- **The usual box's line left open**, as the first pass drew it. If the closed row costs reports
  of Can't find, this is the way back: the open card with the four tiles under it.

## Where it plugs in

- **Exists**: the box view in `TallyOnSiteTab.tsx` with its sheets (`edit-box`, `say-line`,
  `move-box`, `where`, `retire`, `qty`, `short`, `move`, `add-part`), `LabelsPrintModal` and
  `ManifestPrintModal`, `PhotoPress` and `BoxPhotos`, `PinAskStrip`, `EmptyState`, the words in
  `src/lib/materials/onSite.ts` (`lastCountWords`, `countIsDue`, `containerWords`), `boxLine.ts`,
  `whereIsBox.ts`, `shortRequest.ts` and `photo.ts` (`actIsFresh`).
- **From Take from a box**: the tabs and the ticket press folded while a box is open (`boxOpen` in
  `JobTally.tsx`), the left-run strip, the sticky Take bar, a box's photos drawn on every phone,
  and in its step 4 the takes with their pairs.
- **New**: a kernel for the screen's words, `src/lib/materials/boxScreen.ts` (the four tiles'
  facts, More's rows, which tiles a box draws, which row opens by itself); the screen's body as
  its own component, `src/components/tally/OnSiteBoxScreen.tsx`; a `more` sheet in the tab.
- **Words that move**: Short's label in `shortRequest.ts`; the guide
  `keep-track-of-the-material-in-the-cages-and-boxes-on-site`, which names Edit beside the name,
  the four presses on each line, Photo's blue chip, Paper for A1 and Retire under Done with this
  box.
- **Docs**: `docs/MATERIALS_ON_SITE_ARCHITECTURE.md`, `PROJECT_DOCUMENTATION.md` and
  `GLOSSARY.md` for the More sheet and the renamed press.

## The plan

Client only. No migration, no edge function, no new table. The two steps below were planned as
two PRs and shipped as one, v2.7873, once Take from a box's steps 3 and 4 were on main.

1. **The More sheet (S).** The seven rows behind one press. The app's line off the box's screen.
   *1 parts* gone, one name for the box on every press, the empty box's press said once. The
   kernel with tests, a render smoke, the guide, a release note.
2. **The regroup (M).** The parts first, closed until tapped. The four tiles with their facts,
   Count's amber and Photo's words after a count. Photos and takes as one strip. Short renamed in
   the press, its words file and the guide. The Tally's title row folded while a box is open.
   Render smokes at 375 and 320 wide.

The kernel and the component are new files, so they are written while the train is open. Only
the wiring into `TallyOnSiteTab.tsx` and `JobTally.tsx` waits.

## How to verify

- The dev server from a worktree, signed in as the dev. A box's screen is
  `/tally?tab=on-site&job=<job id>&container=<box id>` on the ZZ Test Walk Project, which the dev
  seat's `read_on_site` finds with its boxes. Sample accounts are on no job's team and stop at
  *No jobs assigned*.
- Read only: a headless Chrome whose `page.route` refuses every non-GET call to Supabase but auth
  and `rpc`. Count the refused calls and say the number.
- Measure at 390 by 844, 430 by 932, 375 and 320: every press on the screen 48 high or more, no
  sideways scroll, where the first part starts, and that a box with five kinds of part shows its
  four tiles above the Take bar with every row closed.
- A headless browser cannot open a camera. Photo and Take are checked by their render smokes.

## Where it stands

2026-11-18: designed, drawn twice and approved the same day. Built as one PR in v2.7873, on top of
Take from a box (v2.7824 the run, v2.7828 the takes). The card stays until the owner has seen the
screen on a phone.

**Not verified by the look**: no crew role's screen was walked, and no crew member was asked. The
closed row is a bet: Can't find was pressed once when it stood in plain sight. A real mixed box
was not walked; the test job holds one box with one part and two empty ones. Five kinds of part
fit one drawn screen with 6 px to spare and every row closed. That was measured on this card's
own drawing, a phone 744 px tall with one bar. A real phone does not fit them: see the walk of
2026-11-25. Not walked at 320 wide or with large
text.

**Left alone on purpose**: Damaged and Back to the supply house sit under Move to…, where a person
with a cracked fitting may not look. That sheet wants its own look.

### The walk of 2026-11-21

The owner's main session walked the screen at 375 px in a browser, signed in as the dev, looking only, on the test job's empty box. Every press met 48 px but one, and v2.8227 fixed it:

- **The More sheet's × was 39 by 38.** It is 48 by 48 now, on every sheet of the On site tab, and the title row did not move.

Read by the walk and left as they are:

- **An empty box drew the sticky *Take from …* press.** It showed on every box but Unsorted and a box with a run left open. It was not a slip: a take on a box with no line reads *Nothing is listed in ZZ2.* and offers **Something not on the list…**, for parts found in a box the app has as empty. The owner picked a quiet link the same day, and v2.8263 built it: a box with nothing on hand shows **Took something out of ZZ2? Say what ›** at its foot, 48 px tall and not pinned, and it opens the same take. A box with a part on hand keeps the blue press.
- **The sheet read *Say it better* where this card said *Say what is in it*.** Both are the screen's own words: *Say it better* over a box that has a line, *Say what is in it* on a box with none yet. The sentence above now says both.

This card still waits on the screen in the owner's hand.

### Walked in a simulator (2026-11-25)

Walked on 2026-11-25 in an iPhone simulator, in Safari at 402 by 874 points, in dark, as the dev, on the live site. It is a simulator and not a real phone, so the owner's look still stands. Walked on the test job's boxes: ZZ1 with one part, ZZ2 and ZZ4 empty, then ZZ4 with five ZZ Test parts added on the phone. No crew member's screen was seen and no photo was taken.

**Holds.** The name row, the parts as closed rows, the muted line, the tiles, photos and takes, then the Take press. A tap opens **Used**, **Move to…**, **Can't find** and **Ask for more**, two by two, each 52 tall, one row open at a time. **More** lists its six rows with **Retire** apart. **Where is it?** opens its sheet. **Photo** opens the camera in one press. **Count** opens the count and × leaves it with nothing saved. An empty box shows no Count tile and the quiet link. **Add a part** keeps its field above the keys.

**Five small faults, read in the code the same day.** Faults 1, 3 and 4 are mended in v2.8583, with the sixth below. Fault 2 is not the client alone: see under the list. Fault 5 was to weigh and is left.

1. **A filed photo whose file is gone draws an empty dashed frame and no reason.** ZZ2 has one: filed, then lost in Drive. The strip shows a reason only for a photo not yet filed, and the frame's own words sit where a phone never shows them (`PhotoPress.tsx`). The rule above, *a filed one has no words*, needs this one exception. XS.
2. **The list's Count chip counts an empty box.** It read *Count 2* for two empty boxes, and neither box offers a count. The chip asks only how old a box's last count is (`flowRow.ts`), and the tile asks whether there is a part to count. XS.
3. **The Add a part sheet does not follow the keyboard.** With the number pad up, Safari's address pill sat on **Add 1 and another part** and the keyboard's bar covered **Pick a different part**. The On site sheets are pinned to the page (`OnSiteSheet.tsx`), where the app's other phone sheets size to what shows. S, and it mends every On site sheet.
4. **Back from a box lands at the top of the list,** not at the box's row. S.
5. **Rows show through under the pinned Take bar,** behind Safari's glass bar. Nothing is out of reach. XS, to weigh.

**Fault 2 and the first call below are one rule, and the database holds it too (read 2026-11-25).** When a box is due a count is worked out in three places in the client and in two database functions: `on_site_door_facts`, for the Job Mode card's line, and `on_site_job_summary`, for the office's chip. A mend in the client alone would make the phone's list disagree with both. So the two are one small lane: a migration that replaces both functions and the client's three places in one PR, with one push on its own yes. Briefed, not built.

**Two things for the owner's word.**

1. **One added part marks the whole box counted today.** An add writes *added on site* and *counted as added*, by the owner's call in v2.8284, which speaks of that part's line. But a box's last count is the newest count of any line in it. So after one add ZZ4 read *Counted today*, and it left the list of boxes due a count. On an overdue box, one added part would clear the amber for parts nobody counted. The pick: the add counts its own line and not the box.
   - **Answered 2026-11-25 (UTC) in the managing session.** Asked *Adding one part marks the whole box as counted today. Is that wanted?*, the answer was "No, the add counts its own line (Recommended)", quoted from that session's record of the user's answers. What it frees: the mend, with the five small faults above. Where a box's last count is worked out was not read for this line, so whether the mend is the client alone is the build's to say. Not built.
2. **Five kinds of part: the four tiles are not above the Take bar.** The first pair's top edge showed at about 665 points down, and the Take press covers 686 to 742. A scroll of about 108 points brings all four onto the screen. Above the screen's own parts stand the phone's status bar, the app's bar, the orange Add Task banner at 53 points, and Safari's two bars. The pick: take the caption off the Take bar, then measure again.
   - **Asked 2026-11-25 (UTC) in the managing session, and not decided.** Asked *With five kinds of part the four tiles do not fit above the Take bar on a real phone. What gives way?*, the answer was typed, quoted from that session's record of the user's answers: "This one's very nuanced, you'll need to show me a mock-up of my options And what currently exists before I can decide". Owed first: a mock-up, on made-up data, that shows the screen as it is and each option beside it. The options asked were to drop the Take bar's caption, to put the tiles above the parts, and to leave the screen. The mock-up draws the orange Add Task banner off the page, since the answer of the same day on card #428 holds that banner to the Dashboard on a phone. Nothing of this call is built until it is answered.

**At large text, 2026-11-25, a second sitting.** Box ZZ4 at 402 points with the text at 125%, looking only. None of the four tiles is on the first screen. The Take bar and its caption cover part rows four and five and the line under them. The four tiles stack one a row. A scroll of about 470 points brings the tiles and the bar onto one screen. So the second call above weighs more again at large text, and the mock-up it waits on should draw this size too. **A sixth small fault:** opened from a list that was scrolled, the box's screen opens scrolled down by the same amount, not at its top. The client alone, XS. Mended in v2.8583.

**A third sitting, the same day, on v2.8583.** A box opened from a scrolled list opens at its name. Back from a box lands on that box's row, at the very foot of the screen. The missing photo's words and the Add a part sheet over the keyboard were not looked at. **The photo was not taken:** the tile opens the camera alone, and a simulator's camera takes no picture, so the one photo waits for a real phone and its yes is unspent. **One fault, read in the code and briefed, in review as this is written:** the tally's list said *No containers on this site yet*, with **Add a container**, for a site with three boxes, once under a read that had failed and once under *Loading the boxes…*. The list draws its empty words without asking whether the read is in.

**Seen, and it is as built or the phone's own.** The Photo tile counts the box's own photos, and **Where is it?** shows the newest photo of any kind, a take's included, so the two can name different photos. Scrolled, the app's top bar slides under the phone's status bar, which is Safari's doing on a page whose bar is not pinned.

**Left on the live site.** Box ZZ4 holds five ZZ Test parts: ten ledger rows, five *added on site* and five *counted as added*. A dev can take a press back from Jobs → Materials, in the look by person, so they are not on the list of presses nothing takes back (#443). They are kept for the owner's look at a box with several kinds.

**One photo of a box, given a yes on 2026-11-25 (UTC) in the managing session.** Asked *May a walker take one photo of a box on the ZZ test job? It files into that job's Drive folder and the app has no delete for it.*, the answer was "Yes, one photo", quoted from that session's record of the user's answers. It is history: the photo is a row on prod and a file in Drive, so the yes is asked again at the time. Once taken it belongs on the list of presses nothing takes back (#443). Not taken.

**As a crew member, the same day.** Seen through View as the sample helper, who is on the test job's team, looking only. The helper has a bottom bar, and the Take bar is pinned above it. The first screen showed four and a half of the five rows and none of the four tiles, and a scroll of about 170 points reaches them. So the second call above weighs more for a crew member than for the office. The helper's **More** lists all seven rows, **Retire** among them. None was pressed. Read in the code the same day: nothing holds a row of **More** to a role, on the screen or in the database, so a crew member on the job's team can edit, move and retire a box today, with the change kept in their name. Whether that is wanted is the owner's word. **Answered 2026-11-25 (UTC) in the managing session.** Asked *"Do all the picks on round 2, rows 1 to 22, stand?"*, the answer was "Yes, all picks", quoted from that session's record of the user's answers. The row read: *#398: a crew member may retire, edit or move a box, as built*, and the pick was yes. So nothing is to build here.
