---
name: "A box's own screen: the parts first, four tiles that carry their facts, the rare presses behind More"
number: 398
group: close
status: asked 2026-11-18 with a screenshot of a box on the Tally's On site tab · walked read-only and drawn the same day · the six calls taken as picked, then a second pass on his ask (is this the best we can do) · the owner's go the same day (I like it, build it all) · built 2026-11-18 as v2.7873, one PR (#8831), on top of Take from a box (v2.7824, v2.7828), on main
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
next: The owner sees the screen on a phone. The walks the build could not make go with that look, a crew member's own screen, the camera and a box with several kinds of part. Then retire the card.
size: M as two client-only PRs (S · M), built as one; left: the owner's look on a phone (XS)
ver: v2.7873
blocker: None. The screen is built and live. The owner's look on a phone is all that is left.
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
   - **Add a part**: *1 kind in G12 now*. Not drawn on an empty box, whose empty state has the
     press.
   - **Where is it?**: the place, the where line and the pin's state.
6. *Photos and takes*: the box's photos and its last takes with their pairs, in one strip. A photo
   still on the phone keeps its amber words and **Send now**. A filed one has no words.
7. Take from a box's **Take from G12**, sticky at the bottom.

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
fit one drawn screen with 6 px to spare and every row closed. Not walked at 320 wide or with large
text.

**Left alone on purpose**: Damaged and Back to the supply house sit under Move to…, where a person
with a cracked fitting may not look. That sheet wants its own look.

### The walk of 2026-11-21

The owner's main session walked the screen at 375 px in a browser, signed in as the dev, looking only, on the test job's empty box. Every press met 48 px but one, and v2.8227 fixed it:

- **The More sheet's × was 39 by 38.** It is 48 by 48 now, on every sheet of the On site tab, and the title row did not move.

Read by the walk and left as they are:

- **An empty box still draws the sticky *Take from …* press.** It shows on every box but Unsorted and a box with a run left open. Should an empty box hide it, or grey it with a line that says there is nothing to take? That changes what the screen does, so it waits for the owner's word.
- **The sheet read *Say it better* where this card said *Say what is in it*.** Both are the screen's own words: *Say it better* over a box that has a line, *Say what is in it* on a box with none yet. The sentence above now says both.

This card still waits on the screen in the owner's hand.
