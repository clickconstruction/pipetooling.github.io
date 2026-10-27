---
name: "Room for a crowded end on the phone's Where everyone stands band"
number: 203
group: gated
status: proposed 2026-10-27 from the band's edge fix (v2.5980) · a mock-up and the owner's pick come first
summary: >
  The Bid Board's Health section hangs one name tag per person under the Where everyone stands band,
  on two rows. On a phone the band is 343 px wide at a 375 screen and 288 px at 320. When several
  people crowd one end, two rows cannot hold their tags, so the tags overlap and names hide under
  their neighbours. v2.5980 kept every tag inside the band and cleared the other end, but the
  crowded end's tags now sit flush with the band and tuck further under. A third row or initials on
  a narrow band would make room. Either changes how the band looks on a phone, so it starts with a
  mock-up.
next: Mock up a third row and initials (and any better idea) at 375 and 320 with made-up names, desktop unchanged, for the owner to pick.
size: S
blocker: The owner's pick of a mock-up.
ver: v2.5980
opinion: build — on a phone the crowded end hides names today, and desktop need not change; which layout is your call
---

# Room for a crowded end on the phone band (#203)

## The ask

The owner asked on 2026-10-27 to put the session that v2.5980 recommended on the punch list. That
session was proposed as the follow-up of v2.5980, which kept the band's name tags inside the band on a
phone. It found this end left crowded.

## What is wrong

- The band is block *2 · Field band* in `src/components/bids/BidBoardEstimatingPulseSection.tsx`. It
  hangs a tag for each person, plus the dark ALL tag, under the five-zone strip. The tags sit on two
  rows, one with a 10 px stem and one with a 34 px stem.
- `buildPulseBandItems` in `src/lib/bids/estimatingPulse.ts` sends a tag to the long-stem row when it
  is within 12 points of the one before it. Since v2.5980 it also does so when the two tags would
  touch at the band's measured width.
- On a desk-wide band (700 px and up), 12 points is wider than a tag, so two rows are plenty.
- On a phone, a tag is 40–65 px and 12 points is 41 px (375) or 35 px (320). When four or five tags
  fall within a quarter of the band, a third tag lands on the first.
- Since v2.5980, a tag near an edge sits flush with the band instead of hanging past it. Its stem
  stands on the true won %. At a crowded end, the flush tags tuck further under their neighbour.
- Measured on the Plumbing board as the estimator twin, same-row overlap before and after v2.5980
  went from 45 to 59 px at 375 and from 71 to 89 px at 320. All of it is at the crowded end. The
  other end came clear.
- The caption under the band (*0% – 100% Won rate…*, pulled up by `margin: -3.4rem 0 0`) runs
  beneath the first row of tags, on desktop too.

## Options to mock up

- **A. A third row on a narrow band.** Rows get stems of 10, 34 and 58 px. The kernel places each
  tag on the first row where it fits at the measured width, using `pulseBandTagSpanPx` and
  `estimatePulseBandTagPx`. It keeps the 12-point rule as a floor, so desktop rows don't change. The
  band's bottom margin (4.6rem) and the caption's pull-up grow only when a third row is used. Every
  name stays whole, and a crowded phone board's band grows about 24 px taller.
- **B. Initials on a narrow band.** Below a band width, say 480 px, tags show initials or a short
  first name, and a tap opens the full record. The band keeps its height. The names stop reading at
  a glance.
- **C. A list under the band on a phone.** The band keeps its stems and the dark ALL tag, and the
  names move to a ranked list under it. A bigger change than A or B.
- Any of them can also move the caption above the band or below the last row.

## Where it plugs in

- `src/lib/bids/estimatingPulse.ts`: `PulseBandItem.row` is `0 | 1`. `buildPulseBandItems(people,
  stats, { bandPx })` assigns rows. `pulseBandTagBox`, `pulseBandTagSpanPx` and
  `estimatePulseBandTagPx` are the band's geometry since v2.5980. Tests in `estimatingPulse.test.ts`.
- `src/components/bids/BidBoardEstimatingPulseSection.tsx`: the band block, the stem heights
  (`it.row === 1 ? 34 : 10`), the band's `4.6rem` bottom margin and the caption's `-3.4rem`.
  `bandPx` comes from `useMeasuredWidth` on the section root. Render smoke in
  `BidBoardEstimatingPulseSection.render.test.tsx`.
- The guide `src/content/help/read-estimating-health.md` → *Where everyone stands*, if the phone
  band reads differently after the change.

## The plan

1. **Mock-up.** Make the to-do a folder with `mockup.html` beside it. Show today, A, B and C at 375
   and 320, plus desktop at 1,280 unchanged. Use made-up names and made-up rates.
2. **The owner picks.**
3. **One PR.** It covers the kernel's row rule, the band, the tests, and the guide if it reads
   differently, with its release note and fragment.

## How to verify

- Dev server, `/dev-login?as=twin:estimator`, Bid Board, Plumbing. The Health section is at the
  bottom of the page.
- At the phone preset (375) and at 320 × 740, measure the same-row overlap of the pills. Group each
  pill's `getBoundingClientRect` by its top. Check that `document.documentElement.scrollWidth` equals
  `innerWidth`, and that no element passes the window outside a scroll box.
- At 1,280, rows and tag positions must match today's. The v2.5980 fragment has the recipe.
- Real names and won rates from the live band stay out of the repo, the PR and every mock-up.
