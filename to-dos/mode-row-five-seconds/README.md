---
name: "The mode row shows for five seconds, then leaves"
number: 433
group: gated
status: asked 2026-11-24 after a look at the row on a phone · read and drawn twice the same day, the ask word for word and then again after a critique · nothing is built · waits on the owner's look at the mock-up and a word on nine calls
summary: >
  The owner likes the idea of the mode row and not how it was built. The New mark comes off Job Mode.
  The row shows on top of a phone's Dashboard for five seconds on each visit, with a bar that says
  when it will go, then slides up and out. Drawn word for word, the page jumps under a thumb, the row
  can leave under a finger, Task Mode loses its way out and the bar reads as loading. The second draw
  lays the row over the page so nothing under it moves, holds it while a finger is on it, keeps the
  handle and the pull that are already built, and runs a grey bar down to nothing.
next: The owner watches the mock-up and answers the nine calls. PR 1, the New mark coming off, needs no answer and can go first.
size: M as a train of five (XS · S · S · M · S)
blocker: The owner's look at the mock-up and a word on the calls. PR 1 waits on nothing.
opinion: gated — the second draw is the one to build; calls 1, 2 and 5 are the three that change the build, the rest are a line each
---

# The mode row shows for five seconds, then leaves (#433)

[`mockup.html`](mockup.html) sits beside this card. It is one page with a phone that moves, a
**Play again** press, the four moments of each draw as stills, the critique and the calls. It has a
light and a dark look, a View as band to switch on and off, and the form a person gets who asked their
phone for less motion. Every job, street and name on it is made up.

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
- **Task Mode keeps the row**, with no count and no bar.
- **Less motion:** no slide. The row is there, then fades out. The bar is five blocks that go out one
  a second.
- **The strip the row uncovers takes no press for a third of a second**, so a thumb aimed at a third
  does not land on the gear.

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

## The build

Five PRs, each client only, no migration and no function. Each feature PR carries its release note,
its fragment and its docs. PR 1 waits on nothing. PRs 2 to 5 are written for the picks above, and a
flipped call changes the PR named beside it.

### PR 1 · The *New* mark comes off (XS)

- **Out:** `modeRowNewMark`, `MODE_ROW_WORDS.newMark`, the `isNew` prop of `ModeRowThirds`, the
  `.modeRowNew` rule in `src/index.css`.
- **Tests:** the mark's cases leave `modeRow.test.ts`. `ModeRow.render.test.tsx` holds that a phone
  with nothing stored draws three thirds and no fourth word.
- **Docs:** the *New* sentence in `docs/GLOSSARY.md`'s **Mode row** line, and step 1 of #425's *How
  to verify*.
- **Proof:** the lens frame at 390 px as a superintendent with nothing stored, light and dark.

### PR 2 · The count's kernel, nothing drawn (S)

- **Kernel:** `src/lib/modeRowCount.ts`, pure. One state (`showing` with the time it ends, `held`,
  `leaving`, `gone`) and one step function over the events *arrive*, *touch*, *release*, *press*,
  *swipe up*, *time* and *hidden*. The numbers are named: `MODE_ROW_SHOW_MS` 5000, the 180 ms in, the
  240 ms out, the 300 ms the uncovered strip stays dead, `MODE_ROW_AWAY_MS` 60000.
  `modeRowArrival(before, after)` says whether a change of place is a visit: the path became the
  Dashboard, or the Dashboard link was pressed there. A change of the query alone is not one, so a
  window opened by a link does not replay the row. `modeRowBarLeft(state, now)` is the share of the
  bar left, and `modeRowBlocksLit` the five blocks.
- **Tests:** every event from every state, with a clock passed in. A touch at 4.9 s holds. Release
  starts whole. Task Mode never counts. A return after 59 s is no visit and after 61 s is one.
- **Proof:** the tests. Nothing on a screen changes. Calls 2, 3 and 4 live here.

### PR 3 · The row lies over the page (S)

- **What changes:** on the row's pages the handle is always the page's first line, and the row is
  drawn over it, fixed to the top of the glass, paying `env(safe-area-inset-top)` itself. Its timing
  does not change yet: the first five opens, then the handle. So this PR is one visible change, the
  page no longer starting lower while the row shows.
- **Where:** `ModeRow.tsx` and the `.modeRow` block of `src/index.css`. The handle stays the
  `AppTopBanner`. The row over it is not one, so `lib/topBannerInset.test.ts` gets the row's own case.
- **Tests:** the render smoke holds the handle under a showing row and one line of flow either way.
- **Docs:** the *Order in `layoutBody`* line of `docs/APP_SHELL_ARCHITECTURE.md`.
- **Proof:** the lens frame at 320 px and 390 px with each band up in turn. A Home Screen iPhone for
  the status bar. Call 5 flipped drops this PR, and PR 4 then needs a guard for the jump.

### PR 4 · Five seconds, the bar, the slide (M)

- **What changes:** `ModeRow` runs the kernel. The row shows on each visit, the bar runs, the row
  slides up and the handle is what is left. A finger holds it, a swipe up sends it, the uncovered
  strip is dead for 300 ms. Under `prefers-reduced-motion` the slide is a fade and the bar is five
  blocks. Task Mode holds the row.
- **One clock.** The kernel's end time is the truth and a timer in the component calls *time*. The
  bar is a CSS animation of the time left, keyed on the showing, and it never decides anything.
- **Out:** the first five opens (`modeRowFirstVisits`, `MODE_ROW_FIRST_VISITS`, `modeRowCountOpen`,
  `MODE_ROW_OPEN_DWELL_MS`), the phone's memory of opens and of a press, and the guard for a sub or a
  helper in `modeRowHeldOpen`.
- **Tests:** the render smoke with fake timers set before the first draw and stepped in turns: the
  row at 4.9 s, the handle alone at 5.3 s, a held row at 10 s, a press that restarts, Task Mode at
  30 s, and the reduced form. The usage rows gain `mode_row_shown` with `#visit` and `#swipe`.
- **Docs:** `task-mode.md` and the guide that says how to switch modes, the glossary's **Mode row**
  line, `docs/DASHBOARD_SECTIONS_ARCHITECTURE.md`'s *way in* line, and #425's card.
- **Proof:** the lens frame, light and dark, at 320 px and 390 px, each of the eight roles once, then
  a real phone (below). Calls 1, 4, 6, 7 and 8 are a line or a rule each here.

### PR 5 · The other ways of going to the Dashboard (S)

- **What changes:** coming back to the app after a minute away, and pressing the Dashboard link while
  on it, each count as a visit (`modeRowArrival`, `MODE_ROW_AWAY_MS`).
- **Tests:** the kernel's cases from PR 2 wired: a `visibilitychange` after 61 s shows the row, one
  after 10 s does not.
- **Proof:** a real phone left on the Dashboard, locked for two minutes and woken. Call 2 flipped
  drops this PR.

## What a real phone must check

The lens frame cannot answer these. A Home Screen iPhone and an Android phone, in a hand:

1. **The status bar.** The row's colour runs up under the clock, the row clears the camera, and it
   slides out past the top of the glass with no strip left behind.
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

A mock-up and this plan. Nothing in the app has changed. The mock-up was walked headless at a desk's
width in the light look and a phone's in the dark: the count, the handle, a held press, a press that
switches, the swipe up, the pull down and Task Mode holding each did what the page says.
