---
name: "Tasks on a phone: what the New task walk left"
number: 348
group: close
status: carried from #331 when it closed 2026-11-13 · built the same day on the owner's word *build the leftovers* · PRs 1 to 4 merged as v2.7185 (#8003), v2.7188 (#8008), v2.7189 (#8009) and v2.7190 (#8012) · rows 9 and 10 built in v2.7203 (#8025) on the owner's word *Yes, build both* · all five on main by 2026-11-14 · the thread window's header under the keyboard built 2026-11-21 as v2.8267 · the name's room in that header built 2026-11-22 as v2.8300 · walked in an iPhone simulator 2026-11-25: the Messages sheets and the Dispatch job picker stay on screen with the keyboard up, and two small things were seen in Messages beside them · both mended in v2.8563 · both mends held in the simulator the same day, at 402 points and at 125% text, with one new fault at 125% in the open reply box, read in the code and mended in v2.8585, merged 2026-11-25, held in the simulator the same day at 125%, 115% and 100% text · left: the look at 375 points, a small phone in a hand, and Grace's two notes
summary: >
  Punch list #331 redrew the window that gives a task, and its close-out walk in the iPhone
  simulator fixed the one thing that broke it: the window leaving the top of the screen when the
  keyboard came up. The same walk saw thirteen smaller things in and around the task windows. One is
  a fault: on a phone the three-dot menu of the last task on Manage is cut off, so Delete cannot be
  reached. Three sheets are still pinned to the page the way the task window was. The rest are
  words that read wrongly and rows that run past one phone screen. Two notes of Grace's from #331
  ride along, waiting on her word. No database change in any of it.
next: The look at 375 points waits on leave to use the small simulator. A small phone in a hand has not seen the sheets, and should say whether **Send text…** sits under Safari's bar at 125% text. Grace's two notes wait on her word. Read 2026-11-27 in the iOS Simulator at 375 by 667 points and 100% text on v2.8691 (the simulator thread's sitting 2), on a ZZ Test thread with nothing typed or sent. One finding: with the keyboard up, **Send email…** is cut to a sliver and **Send text…** is off the screen until one scroll inside the thread, which does reach it. Asked *Mend it, or accept it and close*, the answer on 2026-11-27 was to mend it, and v2.8736 has the thread scroll the send press up by itself when the box wakes and when the keyboard takes room (finding 319). That is proved on a desk with a made-up keyboard room only, so the small simulator reads it again at 375 by 667 with the keyboard up. Not read: 125% text, and the Dispatch job picker.
size: M as five small PRs (S · S · XS · S · S), built; left: a look at the two mends in Messages (XS) and a walk on a small phone
blocker: a person at a phone for the walk, and Grace's word for her two notes. The look on a real phone was taken off on Taunya's words of 2026-11-27 (*looks that only a real phone can give, we can skip them*).
ver: v2.7155 · v2.7185 · v2.7188 · v2.7189 · v2.7190 · v2.7203 · v2.8267 · v2.8300 · v2.8563 · v2.8585
opinion: close it after the walk — every row that could be built is built, and the two sheets left unwalked take the same two numbers the walked ones do
mockup: not required — each row is a fix to a screen that exists, found on a walk
---

# Tasks on a phone: what the New task walk left (#348)

## Where this comes from

Punch list #331 closed on 2026-11-13 on the owner's word. Its last step was a walk of **New task**,
**Edit task** and the roadmap's **Add task** in the iOS Simulator: an iPhone 17 Pro on iOS 26.4,
Safari, the on-screen keyboard up. The walk and its fix are in
[docs/recent-features/v2.7155.md](../docs/recent-features/v2.7155.md).

The walk also saw the rows below. None was a reason to keep #331 open, and none has a home
without this card. Every one was seen on the simulator, not on a phone in a hand.

## The rows

### PR 1 · Manage on a phone (S)

1. **The ⋮ menu of the last task is cut off.** The menu opens under its press, inside the list
   (`position: absolute; top: 80%` in `src/pages/Checklist.tsx`). The list's edge cuts it, so on the
   last task, or the only one a search finds, the top of *Edit* shows and *Delete* cannot be
   reached. The fix is a menu that opens upward when there is no room below, or one drawn over the
   page instead of inside the list.
2. **"No tasks yet." over an error.** When the list fails to load, Manage draws the error and,
   above it, *No tasks yet. ＋ New task adds the first.* Both cannot be true. With an error on the
   page the empty line should not draw.
3. **A task only for its giver reads *notifies on done*.** The bell is hidden in the window when
   the task is only yours, but the stored tick stays on, and Manage's chip reads it. The chip
   should stay off when the giver is the only one who has the task.

### PR 2 · The sheets follow the keyboard (S)

4. **Where is it?** (`TaskPlaceSheet`) is pinned to the page. With the keyboard on the place's
   name, Safari slides the page and the sheet's title and *Cancel* leave the top. The name and
   **Use this place** stay in view, so the place can still be saved.
5. **`PhoneSheet` and the dispatch job picker** read `useVisualViewportHeight`, which hears the
   keyboard take room but not the page slide. They were not walked. They should take
   `useVisualViewportBox` and `taskWindowPhoneFrame` as the task window did, and be walked.

### PR 3 · Words (XS)

6. **The roadmap's sentence doubles a full stop.** A stage named *North fence.*
   reads "It joins the stage North fence.. Nobody has it yet."
   (`roadmapTaskSentence` in `src/lib/tasks/newTaskWindow.ts`). Drop the stage name's own last
   full stop before the sentence adds one.
7. **Edit task tells a one-time task about days to come.** Every Edit task shows "Saving reshapes
   the days still to come. The ones already done keep their notes." That is about a task that
   repeats. A one-time task should not show it.

### PR 4 · Rows that pass one phone screen (S, wants a pick)

8. **Someone else's names sit under the bar.** With the keyboard up, the search box lands just
   above the bar and the names it finds are below it until the rows are swiped. The box could be
   brought to the top of the rows when it takes the keyboard.
9. **Done when…'s hint is five lines on a phone.** Open, it pushes the window past one screen.
   A shorter hint, or one behind a press, would keep it to one.
10. **Pick a day's four weeks** open under the bar and push Where and Add below the screen. The
    iPhone's own calendar already opens from the date. On a phone the four weeks could wait for a
    task that repeats.
11. **A narrow screen or larger text.** At 322 px wide, *Repeats* is cut at the edge of the When
    bar and the Add row takes four lines. Safari's text at 125% on a current iPhone is that wide.

### Seen, and left alone unless someone asks

12. **Opening.** The roadmap's Add task raises the keyboard as it opens. New task rings its box
    and waits for a tap. An iPhone only raises the keyboard inside a tap, so this may be the
    phone's rule and not ours.
13. **After turning the phone and back**, Safari draws the bar's Send words larger. It is the
    browser's own text sizing.

## Waiting on Grace's word (carried from #331)

- **An old task's sentence in Edit task** reads like *Theo gets it on Tue, Feb 17.* for a day long
  past. *has had it since Tue, Feb 17.* may read better. Wording only.
- **The faces do not hold everyone.** Replayed on the record, Me and the last four people covered
  87 of 137 tasks, and the rest press **Someone else** first. Count it again after two weeks of
  use before changing anything.

## What I would not claim

- **None of this was seen on a real phone.** The simulator's Safari and keyboard are Apple's own.
  A phone in a hand, a small iPhone and Android were not walked.
- **Row 5 is a reading of the code**, not a sighting. The two sheets use the hook that missed the
  slide. Whether a field in them sits low enough to cause it has to be walked.
- **Row 1 was seen once**, on a list a search had cut to one task. It follows from where the menu
  is drawn, so it should hold for the last task of any list.

## The build

| PR | What | Size |
|---|---|---|
| 1 | Manage on a phone: the ⋮ menu reaches Delete, no empty line over an error, no *notifies on done* on a task only for its giver | S |
| 2 | Where is it?, `PhoneSheet` and the dispatch job picker follow the keyboard's slide, each walked in the simulator | S |
| 3 | The roadmap sentence's full stop, and Edit task's hint only on a task that repeats | XS |
| 4 | Someone else's names, the Done when… hint, Pick a day's four weeks and the narrow When bar, after a pick | S |

## Where it stands

Built 2026-11-13 on the owner's word *build the leftovers*. Each PR carries its release note and its fragment, and this card is not edited by any of them.

| PR | Rows | What was built | Checked |
|---|---|---|---|
| #8003 | 1, 2, 3 | The ⋮ press and its menu are one piece, drawn over the page. It opens above its press when there is no room under it. No empty line draws beside a load error. A task only for its giver no longer reads *notifies on done*. | On the local app at phone size: the menu of the last task opened upward with *Delete* in reach. |
| #8008 | 4, 5 | Where is it?, `PhoneSheet` and the dispatch job picker fill the part of the page that shows. The place sheet's map gives way so the name and **Use this place** stay above the keyboard. | Where is it? walked in the iPhone simulator with the keyboard up. The other two are covered by tests and were not walked. |
| #8009 | 6, 7 | The roadmap sentence closes a stage name once. Edit task shows its line about days to come only on a task that repeats. | Tests. |
| #8012 | 8, 11 | The Someone else search box goes to the top of the rows when it takes the keyboard. The When bar's words tighten on a narrow screen. | Both walked in the iPhone simulator, the bar at 125% text. |
| v2.7203 | 9, 10 | The Done when… hint is one line in each window. On a phone the four weeks draw only for a task that repeats. | Measured on the local app at phone size: with Done when… open the window no longer scrolls, and Pick a day shows the date box alone. |

**Left.**

- **Row 5** wants a walk of `PhoneSheet` and the dispatch job picker on a phone. Reaching them means a real person's thread or Dispatch mode, so it was left for someone at a phone.
- **Rows 12 and 13** are left alone, as written.
- **Grace's two notes** below still wait on her word.

### The walk of 2026-11-21

The owner's main session opened a person's thread on `/messages` in the iOS Simulator's Safari (iPhone 17, iOS 26.2), looking only. Two things were seen.

- **The list page was wider than the phone.** Fixed in v2.8232: the page, both lanes and their rows now fit (punch list #324 has the cause).
- **With the keyboard up in a thread, the reply box and its send press sat on the keyboard, but the window's header left the top of the screen**: the way back, the name and ⋯. The thread window (`ThreadWindow.tsx`) was pinned to the page, `inset: 0`, as the sheets inside it were before row 5. Fixed in v2.8267, on the owner's word the same day.

What v2.8267 built, after a first try that kept the header and cut the foot of the reply box:

1. **The window follows the part of the page that shows** on a phone, as `PhoneSheet` does.
2. **An order for what gives way** while under 480 px shows: the reply box whole, then the header's first row, then the header's other rows and the flow strip, which wait until the keyboard goes, and the lines last, with no floor.
3. **A net under it**: the lines and the box scroll as one, so on a small phone a box taller than the room is reached and not cut.

Walked in the iOS Simulator (iPhone 17, iOS 26.2, Safari) on a ZZ Test person's thread, nothing typed and nothing sent: in Text and in Email the header's first row and the whole box, with its send press, show above the keyboard, and every row is back when the keyboard goes. A small phone was measured in a browser at 375 × 290 and 320 × 240, not walked in a simulator.

**Left from this walk.**

- **A small phone in a hand**, in Text and in Email, to see the scroll reach the box's foot.
- **At 320 px wide the header's first row was 37 px too wide**, keyboard or not: the name got no width and ⋯ sat half off the right edge. Fixed in v2.8300. It was not a 320 px fault alone: at 375 the name had 18 px and on an iPhone 17 it had 45, so it read as two letters. The who-has-it pill's words took 171 px of the row. The folded header was drawn on 2026-10-12 with that pill as a face alone, and the window has handed that look to the slot since, but the slot never read it. It reads it now: a face 28 px wide, with the words as its name to a screen reader, and its menu slid onto the screen from wherever the face sits. The name gets 106 px at 320, 161 of its 164 at 375 and all of it at 402. Measured in a browser at 320, 375, 402 and 1,400 wide, not in a simulator. One pick is left to the owner: nobody's face is a grey **?**, as the whole pill drew it beside its words.

It changes nothing at a desk: every branch is behind the window's own phone flag.


To walk a phone window in the simulator, switch its on-screen keyboard on first. It is hidden
until this is run once for the device, and a field is tapped again:

```bash
xcrun simctl spawn <udid> defaults write com.apple.Preferences AutomaticMinimizationEnabled -bool NO
```

Run Vite with `--host 127.0.0.1`, since the simulator's Safari does not reach `localhost`. For a
narrow room on one device, Safari's page menu has a larger-text press: 125% is 322 px wide.

### Walked in a simulator (2026-11-25)

Walked on 2026-11-25 in an iPhone simulator, in Safari at 402 by 874 points, in dark, as the dev, on the live site. It is a simulator and not a real phone. Nothing was sent.

**Holds, row 5.** With the keyboard up, the sheet stays on screen in **Email**, in **Text**, on *Put a job on*, and in the Dispatch job picker. The keyboard came up and a field took typed words, against the earlier note that the simulator's keyboard could not be raised.

**Not walked.** A small iPhone.

**Two small things seen in Messages, read in the code the same day, not built.**

1. **Under *Lines that match* in the search, each row's box and its date run past the right edge.** The list of hits is a grid that names no column, so one hit with a long unbroken run in it, such as a link, sets the width of every row (`Messages.tsx`). It is the fault v2.8232 mended for the lanes (`pageFit.ts`), and the search list was not given the mend. XS, the client alone.
2. **With the keyboard down, the reply box's grey words are cut at the foot.** Folded, the box is one row high and its grey words are two sentences, which wrap to a second line beside a name of some length (`ReplyBox.tsx`). This is the likely cause, read and not seen drawn. XS, the client alone.

**Both mended in v2.8563.**

1. **The rows.** The list of hits names its one column, as the lanes do. A row may wrap, the name and the words may break where they must, and the date stays one line at the right: beside the words when it fits, on its own line under them when it does not.
2. **The reply box.** Its cause was seen drawn before the build and is the one read: the two sentences wrapped, and the top of the second line showed in the box's lower padding. Folded, the grey words are now the first sentence alone, *Write to* and the name, held to one line. A press into the box opens it to three rows with both sentences, as before. The phone's safe-area inset was not the cause and nothing was built for it.

Measured in Chromium and in WebKit at phone width, on the page's own markup with the app's stylesheet, not on a phone and not in the simulator:

| Look | 402 wide, before | 402, after | 320 wide, before | 320, after |
|---|---|---|---|---|
| A search row's right edge, with a link of 97 letters in one hit | 77 px past the screen's | 28 px inside it | 159 px past | 28 px inside |
| The date | 63 px past the edge | whole, beside the words | 145 px past | whole, on its own line under the words |
| The folded box's grey words, beside a name of 23 letters | two lines, the second cut | one line | two lines, the second cut | one line |

**The simulator's look at both, 2026-11-25, on the live site.** At 402 points and again with the text at 125%, as the dev, with nothing sent.

- **The search rows hold.** Every row ends inside the screen and the date shows whole. At 125% the date drops to its own line under the words.
- **The folded box holds.** One whole grey line at both sizes.
- **One fault at 125%, in the open box, mended in v2.8585.** The grey words wrap to two lines, and so does the caption about the company number. The caption's first line sits on the grey words' second line. The caption is drawn over the box's foot with no limit to one line (`ReplyBox.tsx`). At 100% it is one line and clears them. The client alone, XS.
- **Seen, to weigh.** At 125% with the keyboard up, the row with *Tie to*, **Attach** and **Send text…** is under Safari's keyboard bar.
- **The mend, v2.8585, merged 2026-11-25.** The caption is held to one line, with dots where it is cut. The box was not made taller: with the caption on one line the grey words clear it, and a taller box would push the send row further under the keyboard bar. Not yet seen in the simulator.
- **The mend held, the same day.** In the simulator the caption is one line at 125%, 115% and 100% text, and clears the grey words. Still so, and not the mend's: at 125% with the box open, **Send text…** sits under Safari's bar with the keyboard up, and half under it with the keyboard down. To weigh on a real phone.

**Left from this walk.** The look at 375 points: a small simulator is made and waits on leave to use it.
