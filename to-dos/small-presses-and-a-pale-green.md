---
name: "Small presses and a pale green: four app-wide things an audit met on the way"
number: 414
group: close
status: found 2026-11-20 by the audit of punch list #382's PR 10 and PR 11 · each was measured on a phone-width screen · none is that card's own, so none was fixed there · written here on Taunya's word of 2026-11-21 · the three sizes shipped 2026-11-23 on her word, the toast at the foot v2.8359, Retry at 44 px v2.8361 and the inbox doors at 44 px v2.8362 · the mock-up of the two greens is beside the card · the sweep landed the same day, green presses filled with `#15803d` v2.8364 (PR #9482) · none of the four has been walked on a phone
summary: >
  The audit of Before we start measured four things that are not its own. The green fill most
  presses use is too pale under white words. A toast covers the heading of the card under it on a
  phone. The shared Retry press is under the size a thumb needs. And the doors of a row in the
  Dispatch inbox are under it too. Each one is shared by many screens, so fixing it on one screen
  would leave the others. This card holds the four with their measures, so one decision covers
  each wherever it shows.
next: A walk of the four on a real phone. A toast over a card, Retry with no signal, the doors of an inbox row, and a green press in light and in dark. Then the owner's word to close the card.
size: M as four small parts (S · S · S · S), each alone
ver: v2.8359 · 8361 · 8362 · 8364
blocker: none. All four are on `main`. The walk on a phone is what is left.
opinion: your call — all four are built and each is held by a test; the walk on a phone is the one thing a test cannot give
---

# Small presses and a pale green (#414)

## Where this came from

Taunya asked for an audit of punch list #382's PR 10 and PR 11, the crew's **Is it as told?** and the
Schedule look's line of time. The audit measured the new screens at 390 px, light and dark. Four of
the things it measured belong to the whole app and not to those two PRs.

On 2026-11-21 she said to write them on the punch list and not to fix them on one screen.

Every measure below is from a walk on made-up rows.

## The four

### 1. ~~The green fill is pale under white words~~ Shipped v2.8364

The green send on **Is it as told?** is white 16 px words on `#16a34a`. That is about 3.3 to 1. Small
words need 4.5 to 1.

The fill is not that card's own. It is the app's most used green: over a hundred presses draw white
words on it.

- **A pick:** keep the white words and deepen the fill, as the orange and the blue were deepened.
  `#15803d` reads about 5 to 1 under white.
- **Why it waited:** it changes the look of every green press at once. A mock-up of the two greens side
  by side came before the change.
- **How it was done:** a script across the files, merged alone, as `CLAUDE.md` asks of a sweep.
- **The mock-up, 2026-11-23:** [`small-presses-and-a-pale-green-greens.html`](small-presses-and-a-pale-green-greens.html), the
  same presses drawn twice, today's green left and the deeper one right, in light and in dark, with each ratio worked
  out on the page. White on `#16a34a` reads 3.30 to 1. White on `#15803d` reads 5.02 to 1. The sweep
  (`scripts/codemods/press-green-sweep.mjs`) landed 2026-11-23 as v2.8364, PR #9482: 136 styles and 4 stylesheet rules.
  `npm run check:press-green` fails a PR that fills a green press with `#16a34a` under white words again.

### 2. ~~A toast covers the heading of the card under it~~ Shipped v2.8359

Built 2026-11-23 on the owner's word: on a phone the corner toast draws at the foot of the screen, 12 px above
the tab bar and the Job Mode press bar, centred. The outbox bar is the strip at the top of the page, so the foot
is clear of it, and the section dock draws nothing at phone width. A desktop's toast, an anchored toast and a
centre toast keep their places.

At phone width a toast sat over the top of the page while it was up. On **Is it as told?** it covered
the card's heading for as long as the *not kept* words showed.

The toast's place is the app's. Every screen with a card at the top of a phone has the same overlap.

- **A pick:** move the phone's toast to the foot of the screen, above the bar, where no heading is.
- **To check first:** what sits at the foot on each kind of screen, the outbox bar and Job Mode's strip
  among them.

### 3. ~~The shared Retry press is small~~ Shipped v2.8361

Built 2026-11-23 on the owner's word: `OfflineRetryPanel` draws **Retry** 44 px tall on a phone, with a little more
room each side, and keeps its 36 px on a desktop.

**Retry** on a lost signal was 67 by 36 px at 390 px. A thumb needs 44.

It is drawn by `OfflineRetryPanel`, which every crew screen uses for a read that fails.

- **A pick:** 44 px tall on a phone, as the other presses of those screens are.

### 4. ~~The doors of a Dispatch inbox row are small~~ Shipped v2.8362

Built 2026-11-23 on the owner's word: on a phone every door on an inbox row is 44 px tall and takes a share of the
row, so two sit side by side when they fit and stack when they do not. In the window a row opens, **Lower
priority** and **Open the job ›** are 44 px tall on a phone. A desk keeps its sizes.

On a row of the Dispatch inbox at 390 px, **Open the list** was 112 by 31 px and **Open the job** beside
it was the same. In the window a row opens, **Lower priority** is 103 by 23 px and **Open the job ›** is
90 by 20 px. Inside that window **Open the list** is 116 by 48 px, which is right.

These are the row's doors from punch list #245, and every kind of request draws them.

- **A pick:** 44 px tall on a phone for each, with the row's two doors stacked when they do not fit
  side by side.

## Where it plugs in

| Thing | Where |
|---|---|
| The green fill | `src/index.css` and the inline fills that write `#16a34a` under white words |
| The toast | the toast's own container, drawn once for the app |
| Retry | `src/components/OfflineRetryPanel.tsx` |
| The inbox doors | `src/components/DispatchInboxSection.tsx` and the request's window |

## The plan

Four small PRs, each alone and in any order.

| PR | What it brings | Owed first |
|---|---|---|
| 1 | The mock-up of the two greens (beside the card), then the sweep · shipped v2.8364 | Nothing |
| 2 | The phone's toast at the foot · shipped v2.8359 | Nothing |
| 3 | Retry at 44 px on a phone · shipped v2.8361 | Nothing |
| 4 | The inbox doors at 44 px on a phone · shipped v2.8362 | Nothing |

## How to verify

Each is a measure. Draw the screen at 390 px and read the press's box, or the two colours' ratio, before
and after. For the toast, hold one up over a card and read whether the heading shows.

## Where it stands

The three sizes shipped 2026-11-23 on Taunya's word: the toast at the foot v2.8359, Retry at 44 px v2.8361, the
inbox doors at 44 px v2.8362. None was walked on a phone; each is held by a render test that measures the press at
phone width. The mock-up of the two greens is beside this card. The sweep landed the same day as v2.8364, PR #9482:
green presses fill with `#15803d` under white words, 5.02 to 1 where the pale green read 3.30 to 1. The green was
not looked at in a browser after the sweep. Left as found: on the dark surface the deeper fill's edge reads 2.93 to
1, a touch under the 3 to 1 a shape asks, as the press blue's does.
