---
name: "The mode row shows for five seconds, then leaves"
number: 433
group: close
status: asked 2026-11-24 after a look at the row on a phone · read and drawn twice the same day, the ask word for word and then again after a critique · the owner liked the second draw and asked that the iPhone's camera bar be allowed for, drawn the same day · then *build it all*, so the nine calls stand on their picks · built whole as v2.8461 in one PR: the New mark off, the five seconds, the bar, the row over the page, and the other ways of going to the Dashboard · left: a real phone in a hand
summary: >
  The owner likes the idea of the mode row and not how it was built. The New mark comes off Job Mode.
  The row shows on top of a phone's Dashboard for five seconds on each visit, with a bar that says
  when it will go, then slides up and out. Drawn word for word, the page jumps under a thumb, the row
  can leave under a finger, Task Mode loses its way out and the bar reads as loading. The second draw
  lays the row over the page so nothing under it moves, holds it while a finger is on it, keeps the
  handle and the pull that are already built, and runs a grey bar down to nothing.
next: Try the row on a real phone, an iPhone on its Home Screen first, then delete the card.
size: M, built as one client-only PR; left: a look on a real phone (XS)
blocker: A real phone in a hand.
opinion: close — built on the picks, as the owner said; each call stays a line or a rule to flip later
---

# The mode row shows for five seconds, then leaves (#433)

[`mockup.html`](mockup.html) sits beside this card. It is one page with a phone that moves, a
**Play again** press, the four moments of each draw as stills, the critique and the calls. It has a
light and a dark look, an iPhone's camera bar and a View as band to switch on and off, and the form a
person gets who asked their phone for less motion. Every job, street and name on it is made up.

The page as the owner saw it is a private artifact:

- *Mode row, five seconds* — https://claude.ai/artifact/4APpmR7afehEXRiBQKoJMt

This card follows [#425](../job-mode-offer/README.md), which built the row.

## The ask

The owner, 2026-11-24, with a phone screenshot of the row in the dark look, **Dashboard** filled,
**Job Mode** wearing a green *New*, and the amber *Exit (Sample superintendent)* band under it:

> I like the idea of how we implemented this, but I don't love the implementation. We need to remove
> the new icon from job mode. And I want it to appear at the top for only five seconds at a time when
> a user goes to the dashboard and then I want it to slide up and out away from the page where a user
> can no longer see it. I also want to see a timer of sorts, like a bar that slides across the screen
> to let the user know when it's going to go away.

So four things. The *New* mark comes off. The row shows for five seconds on each visit to the Dashboard.
Then it slides up and out. While it shows, a bar says when it will go.

## What is there today

`docs/recent-features/v2.8332.md` and `v2.8373.md` are the record. What matters here:

- **The row** is `ModeRow` (`src/components/layout/ModeRow.tsx`), the first line of `Layout`'s
  `layoutBody`, inside an `AppTopBanner`. `src/lib/modeRow.ts` is its rule and every word. It is a
  phone's alone (`modeRowDrawnHere`, 640 px), for every role but the estimator, on the Dashboard in
  any mode and on the checklist while Task Mode is on.
- **It already tucks.** The row shows on a person's first five opens of the page, or until a third is
  pressed (`modeRowFirstVisits`, `MODE_ROW_FIRST_VISITS`). After that the page opens with a 24 px
  handle in its place (`MODE_ROW_HANDLE`), and a tap on it or a 36 px pull down at the top of the page
  brings the row back for that visit (`modeRowPull`). Leaving the page or putting the phone away tucks
  it again. So the handle and the pull are built. The ask changes when the row shows, not whether it
  can hide.
- **Two guards hold it open** (`modeRowHeldOpen`): Task Mode, where the row is the way out, and a sub
  or a helper who is off Job Mode.
- **The row is in the page.** It is a line of the page's flow, so the page starts lower while it
  shows. On a Home Screen iPhone the first line showing pays the status bar (`.appTopBanner` in
  `src/index.css`), and that is the row or its handle.
- **What sits under it**, in order: the Add Task offer, the twin line, the training mode line,
  Customer Waiting, the View as band (`ViewAsExitStrip`), then the header.
- **A phone has no other door.** `gearModesRows` (`src/lib/gearMenuSections.ts`) gives the gear menu
  no Job Mode and no Task Mode row where the row is drawn, on the owner's word of 2026-11-23. On a
  phone the green *Task Mode · Exit* strip and **Show full dashboard** are not drawn either. With the
  row gone, the handle and the pull are all there is.

**Why the *New* mark is there, and what turns it off.** `modeRowNewMark` draws it on **Job Mode** while
the page is not in Job Mode and this phone holds no press of a third for this person. The first press
of any third stores `mode_row_pressed_<user>` on the phone, and the mark is gone for good. So it reads
*new* to anyone on a fresh phone, and to anyone looking through View as, whose sample account never
pressed anything on that phone. That is what the screenshot shows.

## The design

The mock-up draws it twice and keeps both.

**First draw: the ask, word for word.** The row stays a line of the page. A blue bar fills across its
bottom edge. At five seconds the row slides up and the page slides up after it. Nothing is left behind.

**What is wrong with it**, read as the person holding the phone:

1. **The page jumps under a thumb.** Everything under the row moves up 58 px, five seconds into every
   visit. A thumb on its way to Clock In lands on the card below it.
2. **The row can leave under a thumb.** The count does not wait for a finger resting on a third.
3. **There is no way back.** The gear lost its rows, and nothing is left on the screen.
4. **Task Mode becomes a trap.** Five seconds after the switch its way out is gone.
5. **The bar reads as loading.** A blue bar filling from the left is what a page shows while it loads,
   and blue is the colour of the third that is on.
6. **The band under the row moves too.** View as, and any other line above the header, rides up.
7. **It plays at people who asked for less motion.**

**Second draw: the one to build.**

- **The row lies over the page.** It comes down over the top of the page the way a phone's own
  notification does, and goes back up. It never pushes the page, so nothing under it moves either
  time. The handle keeps its 24 px line in the page for good, and the row covers it while it shows.
- **The bar** sits on the row's bottom edge, the width of the screen. It starts full and its end runs
  to the left until nothing is left. It is `var(--text-muted)`, a grey, because it is only time.
- **A finger on the row holds it.** The count starts whole again when the finger lifts. A press on a
  third switches the page and the row gets a fresh five seconds, so the way back is under the thumb.
  A swipe up on the row sends it away at once.
- **The way back** is the handle and the pull, as built. The row also comes back by itself on the
  next visit.
- **Task Mode keeps the row**, with no count and no bar. There the row stays a line of the page, as
  it is today. A row that lay over the page for good would cover the header. The mock-up draws it
  lying over, and the build does not.
- **Less motion:** no slide. The row is there, then fades out. The bar is five blocks that go out one
  a second.
- **The strip the row uncovers takes no press for a third of a second**, so a thumb aimed at a third
  does not land on the gear.
- **The camera bar.** The owner, 2026-11-24, on seeing the second draw: *I like your improvements to
  make this seamless. Please be aware that on iPhones there is a bar at the top that we need to
  accommodate that holds the camera.* On a Home Screen iPhone the page starts at the top of the glass,
  under the clock, the camera and the battery. The row never draws there. Its thirds start under that
  bar, and the row is clipped at the bar's lower edge, so it slides up behind the bar and no word
  crosses the clock or the camera. The band under the bar is painted by the page's first line, as
  today: the handle's grey, which is the row's own. With no handle (call 1 flipped) it is the View as
  band's amber or the header's grey.

**What the second draw still costs.** For five seconds on each visit the row covers the search box,
the gear and any band above the header. A swipe up clears it. That is the price of a page that never
jumps, and call 5 is where to refuse it.

## The calls

Each is drawn on its pick. The owner flips one with its number and a word.

1. **The way back.** *Pick:* the handle stays and the pull works, both as built. Someone who finds
   neither gets the row back on their next visit to the Dashboard. *Flip:* no handle, so nothing is
   left to see. Or the three modes go back in the phone's gear menu as a second door.
2. **What counts as going to the Dashboard.** *Pick:* opening or reloading the app on it, arriving
   from another page, pressing the Dashboard link while already there, coming back to the app after a
   minute or more away, and any press on the row. *Flip:* only opening the app and arriving from
   another page.
3. **Task Mode and Job Mode.** *Pick:* Job Mode is drawn on the Dashboard and gets the same five
   seconds. Task Mode keeps the row for good. The guard for a sub or a helper off Job Mode goes: one
   rule for everyone. *Flip:* five seconds in Task Mode too, with the handle as the way out.
4. **Does the count pause.** *Pick:* yes. A finger on the row holds it and the count starts whole on
   release. A keyboard's focus inside the row holds it. For a screen reader the handle is a named
   press that never times out. *Flip:* the count picks up where it stopped.
5. **What the page does when the row leaves.** *Pick:* nothing, since the row lies over the page.
   *Flip:* the row stays a line of the page and the page slides up after it, as in the first draw.
6. **The bar.** *Pick:* the row's bottom edge, full and running out to the left, grey. *Flip:* blue,
   or filling from the left.
7. **Less motion.** *Pick:* a fade and five blocks. *Flip:* the row does not come by itself for these
   people, and the handle is their door.
8. **The other bands.** *Pick:* they stay where they are and the row lies over the top one for five
   seconds, Customer Waiting included. *Flip:* the row waits while Customer Waiting is up.
9. **The *New* mark.** Off, as asked. Nothing marks Job Mode as new after that. A row that arrives
   with a moving bar on every visit draws the eye more than the mark did. No flip is drawn.

## The build (v2.8461)

The owner, 2026-11-24, on the mock-up with the camera bar drawn: *build it all, let me know when it's
live.* So every call stands on its pick. `docs/recent-features/v2.8461.md` is the record, with what was
walked.

The plan read as a train of small PRs. It is built as one, client only, no migration and no function.
The merge queue was twelve deep that night, and the steps were one ask on one component.

- **The *New* mark is off.** `modeRowNewMark` and its rule are deleted.
- **The count** is `src/lib/modeRowCount.ts`, pure: one state (`showing`, `held`, `leaving`, `gone`)
  and one step function. `ModeRow` holds it in a reducer and sets one timer for the moment it names.
  The bar is a CSS animation of the kernel's own length and decides nothing.
- **The row over the page.** On the Dashboard the handle is always the page's first line, the
  `AppTopBanner` that pays `env(safe-area-inset-top)`. The row is drawn over it in `.modeRowClip`,
  which names no `top` and so starts where that line's content does, under the camera bar.
- **A hold, a swipe, a press.** A finger or a keyboard's focus holds the count, a 16 px swipe up
  sends the row, a press gets five fresh seconds, and the uncovered strip is dead for 300 ms.
- **Less motion:** a fade, and five blocks for the bar.
- **Task Mode** keeps the row as a line of the page, with no count (`modeRowHeldOpen`).
- **Visits:** the page becoming the Dashboard, the Dashboard link pressed while there
  (`modeRowSamePlaceVisit`), and a return after a minute away (`modeRowBackIsVisit`).
- **Gone:** the first five opens, the phone's memory of opens and of a press, and the guard for a
  sub or a helper.

To flip a call later: the handle is `MODE_ROW_HANDLE`, the five seconds `MODE_ROW_SHOW_MS`, the minute
away `MODE_ROW_AWAY_MS`, Task Mode's hold `modeRowHeldOpen`, and the bar's colour one line of
`.modeRowBar` in `src/index.css`.

## How to verify

1. As a leader on a phone, open the Dashboard. The row shows with **Dashboard** filled and no mark on
   **Job Mode**. A grey line under it runs out, and at five seconds the row slides up. A small grey
   bar is left. Nothing under the row moved.
2. Tap the grey bar. The row slides down for five seconds more. Pull the page down from its top after
   it has gone. The same.
3. Rest a finger on the row past five seconds. It stays. Lift the finger off the row. Five seconds
   later it goes. Swipe up on the row. It goes at once and nothing is pressed.
4. Tap **Job Mode**. The Job Mode page opens and the row is still there, **Job Mode** filled, for
   five seconds. Tap **Task Mode**. The checklist opens with the row as a line of the page, and it
   stays. Tap **Dashboard**.
5. With the row gone, tap the **Dashboard** link in the header. The row comes back. Go to Jobs and
   back. The same.
6. Put the phone away for two minutes and wake it. The row shows. Do it again for ten seconds. It
   does not.
7. Switch the phone to less motion. The row fades instead of sliding, and the line is five blocks.
8. On a Home Screen iPhone the row starts under the clock and the camera, and slides away behind them.

## What a real phone must check

The lens frame cannot answer these. A Home Screen iPhone and an Android phone, in a hand:

1. **The camera bar.** On an iPhone with the island and on one with the notch: the thirds start
   clear of the camera, the band under the clock is one grey with the row, and the row slides away
   behind the bar with no word crossing the clock. The same with the phone turned on its side, where
   the camera is at an edge.
2. **Five seconds, felt.** Whether it is long enough to read three words and press one, with the bar
   in the corner of the eye.
3. **A resting thumb.** A real finger on a third holds the row past five seconds, and lifting it
   without a press starts the count whole.
4. **The swipe up and the pull down**, against the phone's own gestures: an iPhone's pull from the
   top edge opens its notifications, and Android Chrome has its own pull to refresh.
5. **The uncovered strip.** A press on a third at the moment the row leaves does not open the gear.
6. **Less motion**, switched on in the phone's settings: the fade and the five blocks.
7. **A screen reader.** VoiceOver and TalkBack read the three thirds while the row shows and the
   handle by its name after.
8. **Back from the lock screen** after two minutes, and after ten seconds.

## Where it stands

Built whole as v2.8461. The built row was walked headless at a phone's width through the lens frame,
with real touch events, and not on a real phone. The mock-up was walked headless at a desk's
width in the light look and a phone's in the dark: the count, the handle, a held press, a press that
switches, the swipe up, the pull down and Task Mode holding each did what the page says. With the
camera bar drawn, the row's thirds start 7 px under it and nothing of the row draws over it at any moment.
