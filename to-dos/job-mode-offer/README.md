---
name: "The Job Mode offer becomes a mode row tucked above the page"
number: 425
group: close
status: asked 2026-11-23 with a phone screenshot of the card · read and drawn four ways the same day · the owner picked C, the switch, and asked for it tucked above the page with Task Mode on its left · drawn as a playable phone, and he picked Tucked · built as v2.8332 the same day · the owner's second look the same day took the row off the desk and put the three in the gear menu as a list with one dot, v2.8373 · left: a real phone in a hand, three calls built on their drawn defaults, and the four calls of the desk's list
summary: >
  The owner likes the Job Mode offer on top of the Dashboard. Nobody read its small grey text, and
  that text was the only place the card said how to get back. Four ways were drawn and he picked C,
  a switch with no card, then turned it: one row, Task Mode, Dashboard, Job Mode, above the top of
  the page, which a person at the top can pull down. It is built for leaders, superintendents, subs
  and helpers. On a phone the row shows until its first press and after every switch, then tucks
  behind a small handle. The offer card is gone. Past a phone's width the row is not drawn: the gear
  menu lists Dashboard, Job Mode and Task Mode with one dot (v2.8373).
next: Try the pull on a real phone, as a leader and as a sub, and on a Home Screen iPhone. Then answer the three calls and delete the card.
size: M, built as one client-only PR; left: a look on a real phone (XS)
blocker: A real phone in a hand.
ver: v2.8332, v2.8373
opinion: close — built as picked, for everyone but the estimator; the two open calls are one line each in modeRow.ts
---

# The Job Mode offer becomes a mode row tucked above the page (#425)

Two mock-ups sit beside this card. Their jobs, numbers, streets and tasks are made up.

- [`mockup.html`](mockup.html) is the card as it is and four options, each on a 320 px phone with the
  moment after the press. The owner picked C from it.
- [`switcher-mockup.html`](switcher-mockup.html) is C as he turned it: a phone to scroll and press, with
  three ways to hide the row, first visits against later ones, and a handle on or off.

The pages as the owner saw them are private artifacts:

- *Job Mode offer* — https://claude.ai/artifact/S1WZddnkfByY3rcLaYLHmU
- *Mode switcher* — https://claude.ai/artifact/SXUHHDMazRYZbSNaYEg38h

## The ask

The owner, 2026-11-23, with a phone screenshot of the card in dark mode:

> I absolutely love that we have this at the top of many people's dashboard, but no one reads the small
> text. How could we make this better for someone who is impulsive like a twelve year old?

## What the reading found

The card is `DashboardJobModeFirstRunCard.tsx`. Its rule is `showJobModeFirstRunCard` in
`src/lib/jobModeToggle.ts`. A leader or a superintendent sees it on the full Dashboard while the phone holds
no choice about Job Mode and the card was never put away.

**What the small text carries.** Two things. What Job Mode is, and that the gear menu turns it off. The
first is nice to know. The second is the one a person needs, and nothing else on either page says it.

**What each press does today.**

- **Turn on Job Mode** stores `card` on the phone and the whole Dashboard becomes the Job Mode page. The
  header changes and a tab bar pins to the foot. Nothing on that page turns Job Mode off. The way back is
  two taps: the gear, then **Job Mode** under *Modes*. **Show full dashboard** sits at the foot of a long
  page and lasts until the app reloads.
- **Not now** stores `dashboard_job_mode_card_dismissed_<user>` and the card is gone from that phone for
  good. The glossary's *with nothing stored and not dismissed* is the rule for when the card shows, not
  what the press does. The v2.2877 note is right.
- Both presses are about 36 px tall, under the 44 px the app asks of a press.

**So a wrong press costs this.** A wrong green press leaves a non-reader on a page they did not expect,
with the way out behind a gear they were never told about. A wrong **Not now** ends the offer on that
phone. The card is weakest exactly where the impulsive reader is strongest.

**The same shape recurs.** A tinted panel, a bold question, a muted reason, a main press and **Not now**
is drawn by hand in four places, each keeping its put-away differently:

| Card | Put away in |
|---|---|
| `DashboardJobModeFirstRunCard` | the phone, for good |
| `materials/PinAskStrip` | the page's own state |
| `jobs/BillTextOfferStrip` | the page's own state |
| `bids/GcDifficultyAsk` | the database |

`AddTaskShortcutBanner` and `UpdatePrompt` are near relatives. None of them shares a component. The answer
here is small enough to build once for this card. If B is picked, its two rules are worth writing as one
pattern for the next offer: the main press says what it does, and the moment after it shows the way back.

**What the app already has for showing instead of telling.**

- `showActionToast` (`src/contexts/ToastContext.tsx`) is a toast with one press, such as **Undo**. It sits
  top right and leaves after ten seconds. It was weighed for the way back and left out: a non-reader misses
  a timed corner toast.
- `BillTextOfferStrip`'s green line that says what just happened is the model for B's strip.
- `SpotlightTour` could ring the gear after the press. It dims the page and blocks it until answered,
  which is more reading, not less. Left out.
- The help guides' `:::example` panel is the nearest thing to a small picture of a screen. No component
  draws a small preview of a real card. `DashboardJobModeCard` loads its own data and has no sample mode,
  so A's picture is hand-drawn markup.
- The short page's **‹ Back to the short page** press on top of the full Dashboard is the closest relative
  of B's strip: a way back drawn where the person lands.
- *New phone layout* is a tick row in the gear menu only. It has no card.

## The four options, and the pick

Each was judged against a reader who looks for one second and presses the brightest thing.

- **A · Show it.** The grey text becomes a small picture of the Job Mode card.
- **B · Try it.** *Working in the field?* and one green **Try Job Mode**, then a strip in the same spot
  whose only press goes back. This was the session's recommendation.
- **C · A switch, no card.** A control on top of both pages for good. **The owner picked C**, 2026-11-23:
  *C has the most potential and is the most correct.*
- **D · Your own day.** The card waits for a day with stops and shows the person's own.

## C as the owner turned it

His words: the part of the page below the switcher is the unofficial head of the page, so a person who
scrolls all the way up can pull the switcher down. Task Mode is offered too. It is the least likely to be
pressed, so it sits to the left of Dashboard.

So the row is three thirds, **Task Mode · Dashboard · Job Mode**, each 44 px tall. It replaces the offer
card, the green *Task Mode · Exit* strip and **Show full dashboard** at the foot of the Job Mode page.

He played with the second drawing and picked **Tucked**, 2026-11-23: *Yes, build Tucked.*

## What was built (v2.8332)

`docs/recent-features/v2.8332.md` is the record. In short:

- `src/lib/modeRow.ts` is the rule and every word. `src/components/layout/ModeRow.tsx` draws the row
  as the first line above the header, mounted by `Layout.tsx`.
- Every role whose first page is the Dashboard gets it, on the Dashboard and on the Task Mode checklist.
  That is all nine but the estimator, whose first page is Bids. It was first built for the four field
  roles. Asked about the office, the owner said *give it to everyone*.
- A press goes through `usePageMode`'s `set`. The middle third switches Task Mode and Job Mode off and
  never touches Dispatch Mode.
- On a phone it shows for the first five opens or until a third is pressed, and after every switch.
  Then it tucks behind a 24 px handle. On a desk it always shows. An open counts once the row has
  stayed for a second and a half, since the office's phone is sent on to the schedule as it opens.
- Two guards hold it open: Task Mode, where it is the way out, and a sub or a helper who is off Job Mode.
- The offer card and its rule are deleted. The green Task Mode strip and **Show full dashboard** are
  drawn only for the estimator. The window that shows another person's Task Mode draws the row too.
- **Job Mode** and **Task Mode** left the gear menu for the roles with the row, on the owner's word the
  same day: *since we're adding this, we can remove the job mode and task mode from the gear wheel
  dropdown*. Whoever can hold **Dispatch Mode** keeps it there. The estimator keeps all the rows the
  estimator had, since the row is not drawn for the estimator and the menu is the only way in.

## The desk's list (v2.8373)

`docs/recent-features/v2.8373.md` is the record. The owner looked at the row on a desk the same day:

> At the moment on mobile we have task mode, bid mode, and job mode at the top of mobile screens. But I
> don't think they should exist on desktop that way. I think they should be put in the gear wheel on the
> top right hand side as a selector.

Three selectors were drawn: a list with one dot, the three thirds inside the menu, and one row with a
dropdown. He picked the list.

- The row is a phone's (`modeRowDrawnHere`). Past 640 px it is not drawn for any role.
- The gear menu's *Modes* group holds **Dashboard**, **Job Mode** and **Task Mode** as a list with a blue
  dot on the one drawn (`GearModeList`, rows from `gearModesRows`). The estimator has the list at every
  width, in place of the two ticks.
- A press goes through the row's own rule, so the list and the row cannot disagree.
- **Dispatch Mode** keeps its own tick under the list.
- With no row, the green Task Mode strip and **Show full dashboard** are the ways back that stay in sight.

Four calls were built on a default, for the owner:

1. **A tablet** is wider than 640 px, so it has the list and not the row.
2. **Dispatch Mode** stays apart from the list. As a fourth choice, **Dashboard** would have to switch
   Dispatch Mode off, which the phone's middle third never does.
3. **A press lands on the Dashboard.** Dashboard or Job Mode pressed from another page opens the
   Dashboard, as the row does. An estimator who leaves Task Mode from the list lands there too, where the
   old tick stayed on the checklist.
4. **The green *New* mark** on Job Mode is not drawn in the list.

## Where the build left the drawing

The drawing tucked the row by opening the page scrolled just past it. The build does not, for two
reasons found in the shell.

- The header is not sticky, and on a Home Screen iPhone the first line of the page pays the status bar.
  A page that opened scrolled would put the header under the clock.
- A dozen places jump a page to its top. Each would have landed on the row.

So the tucked row is not on the page. The app already switches off the rubber band at the top of every
page, which leaves a downward drag there with nothing to do. The row listens for that drag. To a thumb
it is the same move as the drawing: at the top, pull down. Once down, the row stays for that visit.

On a desk the drawing put the row inside the header. The build puts it on its own line above the
header, since the header measures its own links to decide when to fold them away.

## The calls

1. **How it hides:** answered, Tucked.
2. **When it starts to tuck:** built as drawn, after the first press or five opens (`MODE_ROW_FIRST_VISITS`).
3. **The handle:** built as drawn, on (`MODE_ROW_HANDLE`). It is 24 px, the smallest press the app allows.
4. **Who gets it:** answered, everyone (`modeRowOfferedToRole`). Built for the eight roles whose first
   page is the Dashboard.
5. **The estimator:** answered, left out. An estimator who opens the app lands on Bids, since the route
   guard sends `/` there, and only a fresh sign-in lands on the Dashboard. The owner saw a before and
   after of the row on top of Bids, with **Bids** as the middle third, and said to leave it out
   (2026-11-23). The estimator keeps the gear menu's two rows and the green strip.

Calls 2 and 3 are one line each in `src/lib/modeRow.ts`.

The owner's third look, 2026-11-24, asks for the row to show for five seconds on each visit and then
leave, which replaces calls 2 and 3. It is drawn and planned in [#433](../mode-row-five-seconds/README.md).

## How to verify

1. View as a leader on a phone with nothing stored. The Dashboard opens with the row showing,
   **Dashboard** filled and a green *New* on **Job Mode**.
2. Press **Job Mode**. The Job Mode page opens with the row showing and **Job Mode** filled. Press
   **Dashboard**. The Dashboard is back, with the Dispatch Mode bar if the leader had it.
3. Reload. The page opens with only the handle. Pull down at the top of the page. The row comes down.
   Reload and tap the handle. The same.
4. Press **Task Mode**. The checklist opens with the row showing and no green strip. Reload. The row
   is still showing. Press **Dashboard**.
5. As a sub, press **Dashboard**, then reload. The row is still showing. Press **Job Mode** and reload.
   Only the handle shows.
6. The gear menu of each role with the row lists neither **Job Mode** nor **Task Mode**. A dev's, a
   leader's, an assistant's and the controller's still list **Dispatch Mode**.
7. On a desk the row always shows, above the header.
8. An assistant, the controller, a dev and a primary see the row and no green strip in Task Mode. An
   assistant's phone that opens on the schedule has not used up one of the five opens.
9. An estimator sees no row. The estimator's gear menu still lists Job Mode and Task Mode, and Task Mode
   still shows the green strip.
10. On a Home Screen iPhone the row, or its handle, starts under the status bar and the header under it
   does not pad twice.

## Where it stands

Built and walked hard on the dev server through the lens frame, over invented data: a leader, a
superintendent and a sub on a phone at 390 px and 320 px, a leader on a desk, and an assistant to see
the office untouched. Not tried on a real phone: the pull under a thumb and the status bar on a Home
Screen iPhone are what is left.

The desk's list (v2.8373) was walked the same way: a leader at 800 px and 1280 px, an estimator at a
phone's width and a desk's, a sub on a desk in the dark look, and a leader's phone to see the row
untouched. Its four calls above wait on the owner.
