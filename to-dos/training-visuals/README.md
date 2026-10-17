---
name: "Training visuals: a drawing beside the sentence it explains"
number: 116
group: close
status: BUILDING 2026-10-17 — Grace picked line drawings and all thirty-five; PR 0 (the mechanism, the controls ladder in lesson 1, the clearance stack in lesson 8) is v2.5598; next PR 1 space
summary: >
  Read as a fourteen-year-old on a phone, the OSHA 30 refresher holds up where a lesson is a
  rule or a story and fails in four kinds of places: shapes in space (a ladder's angle, a
  guardrail's heights, a trench's slopes, a swing radius), things you must recognise by sight
  (the nine pictograms, sign colours, flag colours, fire classes), scales a number cannot make
  you feel (current, noise, oxygen, the hard hat's limits), and motions (the lift, PASS, the
  seal check). This plan adds one small thing to the lesson format, a figure line that draws an
  SVG beside the sentence it explains, and a catalog of thirty-five figures in five groups, each
  a line drawing in the page's own ink so it reads in both themes, loads with the lesson, and
  never goes stale.
next: PR 1 space (figures 3 to 10 and the lesson 30 map), then sight, scales, motions, reuse; call 3 (a figure inside a question) stays open.
size: M (PR 0 is S; each figure PR is S, about eight drawings)
blocker: none; nothing waits on a migration, a function or another stream.
opinion: build it as drawn; the figures are the feature, the mechanism is thirty lines and a test, and the catalog below is the whole scope so nothing is invented later.
mockup: to-dos/training-visuals/mockup.html
---

# Training visuals (#116)

The course is live (#111, v2.5564–v2.5592). Grace asked, after Isiah's first press: *imagine you are
a fourteen-year-old taking the course, are there any areas where we should offer visuals instead of
words?* Then: *can we go through one by one and improve all of these? Help me come up with a plan and
mock-ups first.* This is that plan. The mock-up draws the first ten figures where they would sit.

## What a fourteen-year-old meets

The sentences are already short (the plain-words rule, twenty words at most, one idea each), the
acronyms are spelled out where they appear, and a lesson is five minutes. The trouble is not the
reading. It is four kinds of fact that a sentence cannot hand over:

1. **Shapes in space.** "Extend it 3 ft above the landing at a 4:1 angle." Until you see the ladder,
   "4:1" is a ratio on a test. The same for the guardrail's three heights, the clearance stack under
   a harness, the trench's slopes and its box, the swing radius and the blind spots, the power-line
   distances, the stacking limits, the forklift's load center, the lifting zone.
2. **Things you recognise by sight.** The nine HazCom pictograms, the four sign colours, the three
   flag colours, the double-insulated symbol, the hard hat's markings, the NIOSH label, poison ivy,
   the cave-in signs, the fire classes. Nobody learns a pictogram from a sentence.
3. **Scales.** "About 30 mA locks your muscles so you cannot let go" means nothing until it sits on
   a scale next to 5 mA, where the GFCI trips, and 15,000 mA, where the breaker does. The same for
   noise by tool, oxygen, the heat stages, the fall's one second, the hard hat's limits.
4. **Motions.** The five-step lift, PASS, the seal check, three points of contact, staying belted in
   a tip-over, the hand signals, the three confined-space roles.

Lessons 3, 4, 6 and 29 (rights, programs, mental health, leading the culture) are ideas and
conversations. They stay words.

## The mechanism (PR 0)

One line in a lesson's **Must know** or **Traps** list draws a figure:

```
- {{figure:clearance-stack|A 6-ft lanyard needs 18 ft of clear space below you.}}
```

- **`src/lib/training/figures.ts`**: `parseFigureItem(text)` reads the token into `{ name, caption }`
  or null; `FIGURE_NAMES` is the registry's list, so the content test can hold the two sides equal.
- **`src/lib/training/courseContent.ts`**: a Must-know or Traps item is `string | { figure, caption }`.
  The caption goes through the plain-words rules like any sentence. The content version hashes the
  figure's name and caption with the words, so a changed caption counts as changed wording and, by
  v2.5569's rule, never voids a pass. A redrawn figure under the same name changes nothing.
- **`src/components/training/figures/<name>.tsx`**: one React component per figure returning an
  inline `<svg viewBox="0 0 300 N" role="img" aria-labelledby=…>` in the page's ink: `currentColor`
  strokes, `var(--bg-subtle)` and the house status colours for fills, so it reads in light and dark
  with no second drawing. `figures/index.ts` maps name to component. Each stays under 4 KB; the whole
  catalog is under 120 KB and lives in the course page's lazy chunk, never in the Dashboard's.
- **`TrainingFigure.tsx`**: a `<figure>` at full width, the SVG scaling to the phone, the caption in
  a `<figcaption>` under it. The list item that holds a figure draws no bullet.
- **Tests**: `figures.test.ts` (every figure a lesson names exists, every registered figure is named
  by a lesson, every figure renders in jsdom with an accessible name); the existing content tests
  take the new item shape; `npm run build` before the merge, since a lazy glob broke the build once
  (v2.5589).
- **The walkthrough scripts** read `mustKnow` as strings; they take the union.

## The catalog

Thirty-five figures. *Beside* names the sentence the figure sits under; *reuse* names the other
lessons that draw the same figure.

| # | Lesson | Beside | Figure | Kind |
|---|--------|--------|--------|------|
| 1 | 1 | Controls run from most to least effective | The controls ladder: elimination, substitution, engineering, administrative, PPE, most to least effective. Reuse: 5, 21, 27 | space |
| 2 | 8 | Clearance adds four things to the free fall | The clearance stack: 6 ft free fall, 3.5 ft to slow, 1 ft D-ring shift, 5 ft D-ring height, 2 ft safety, 18 ft below you | space |
| 3 | 8 | Guardrail top rail at 42 in | A rail beside a person: top rail 42 in, midrail 21 in, toeboard 3.5 in, a 24-in parapet. Reuse: 18 (38 to 45 in on a scaffold) | space |
| 4 | 17 | Extend it 3 ft above the landing at a 4:1 angle | The ladder: one out for every four up, 3 ft above the landing, tied top and bottom, three points of contact. Reuse: 7, 20 | space |
| 5 | 19 | Slopes: Type A at ¾ to 1 | The trench section: the three slopes, the box 18 in above the top, spoil 2 ft back, the ladder within 25 ft. Reuse: 20 | space |
| 6 | 11 | The swing radius is the full 360 degrees | The excavator from above: the circle to the furthest moving point, the three blind spots, where you stand. Reuse: 22, 30 | space |
| 7 | 9 | Overhead lines are always live | Power-line clearances by voltage: 10 ft to 50 kV, 15 ft to 200 kV, 20 ft to 350 kV. Reuse: 18 (3 ft and 10 ft from a scaffold) | space |
| 8 | 10 | Stack on stable, level ground | Stacking limits: lumber 16 ft by hand and 20 ft by machine, bricks 7 ft tapering above 4 ft, blocks tapering above 6 ft, cylinders 5 ft. Reuse: 21 | space |
| 9 | 24 | The load center is the distance from the fork backrest | The forklift's load center and the stability triangle, the load low | space |
| 10 | 21 | The safe lifting zone is mid-thigh to mid-chest | The lifting zone on a body, and the work heights: precision 4 in above the elbow, heavy 4 to 6 in below. Reuse: 27 | space |
| 11 | 14 | The nine pictograms include the flame | The nine pictograms, drawn simply, each named | sight |
| 12 | 24 | Red signs mean danger | The four sign headers: red Danger, orange Warning, yellow and black Caution, blue Notice | sight |
| 13 | 9 | Underground flags: yellow gas or oil | The three flags and the double-insulated symbol, a square within a square | sight |
| 14 | 12 | Type 1 protects the top of the head | A hard hat's markings: Type 1 and 2, Class C, G and E, the date wheel | sight |
| 15 | 13 | A NIOSH mask shows the maker | The NIOSH label's five fields, and the lot number that is not one of them | sight |
| 16 | 14 | Poison ivy: leaves of three | Leaves of three, next to a five-leaf vine that is not it | sight |
| 17 | 20 | Warning signs: bulging, cracking, boiling | A trench wall with the six warning signs drawn: bulging, cracks parallel to the edge, boiling, heaving, slumping, sliding. Reuse: 10 | sight |
| 18 | 25 | Fire classes: A ordinary combustibles | The five classes with the extinguisher that fits each, and the one that never goes on electricity | sight |
| 19 | 12 | Chemical ratings on gloves run VG, G, F, P | The glove label and the welding shade scale 2 to 14 | sight |
| 20 | 9 | 1 mA is a tingle | The current scale: 1, 5 (the GFCI trips), 30 (you cannot let go), 50 to 150, 200, and the breaker at 15,000 | scale |
| 21 | 15 | A nail gun is 95 | Noise by tool with the hours you can stand each: 8 h at 90, 4 at 95, 2 at 100, 1 at 105, 30 min at 110 | scale |
| 22 | 13 | Normal air is 20.9% oxygen | The oxygen gauge: 23.5 enriched, 20.9 normal, 19.5 deficient, 10 deadly. Reuse: 26 | scale |
| 23 | 15 | Heat illness runs rash, cramps, exhaustion | The four heat stages to 104°F, with the one sign that means call 911 | scale |
| 24 | 7 | A fall is fast | The fall timeline: 0.3 s to notice, 0.33 s to react, one second to drop 16 ft; and suspension trauma's 3 to 5 minutes and 30 | scale |
| 25 | 11 | A hard hat has limits | Six objects at the height each one hurts you from: a 1-lb wrench at 30 ft down to a 50-lb block at 1 ft | scale |
| 26 | 10 | A cubic yard of soil weighs 2,000 to 3,000 lb | A cubic yard of soil beside a car | scale |
| 27 | 28 | Arc flash PPE categories | The four categories, 4, 8, 25 and 40 cal/cm², and the two boundaries | scale |
| 28 | 16 | Respirable particles under 10 microns | A silica particle beside a hair | scale |
| 29 | 21 | The lift has five steps | The lift in five frames: plan, squat, grip close, move without twisting, set down | motion |
| 30 | 25 | Use PASS from 6 to 8 ft away | PASS in four frames: pull, aim at the base, squeeze, sweep, from 6 to 8 ft | motion |
| 31 | 13 | On a tight-fitting respirator, cover the exhalation valve | The seal check: cover the valve, breathe out, feel it bulge | motion |
| 32 | 17 | Keep three points of contact | Three points of contact on a ladder, and the two that are not | motion |
| 33 | 10 | If it tips, stay inside, belted | The tip-over: belted, gripping the wheel, leaning away; beside the jump that kills | motion |
| 34 | 22 | A certified signal person is required | The crane signals stop, raise and lower, and the flagger's two. Reuse: 24 | motion |
| 35 | 26 | The entrant does the work | The three roles in place: entrant inside, attendant outside with no other duty, supervisor; the rescue order. | motion |

And one map: lesson 30's site, the trench, the excavator, the swing radius, the pipe and where you
stand, with the four decisions placed on it. It is figure 6 redrawn for the case, so it ships with
figure 6's PR.

## PRs, in order

0. **The mechanism** with figures 1 and 2 in lessons 1 and 8, the registry, the tests, a build run.
   The guide `take-a-training-course` gains one sentence: a drawing sits under the sentence it
   explains, and a reader who cannot see it gets its caption.
1. **Space**: figures 3 to 10, and the lesson 30 map.
2. **Sight**: figures 11 to 19.
3. **Scales**: figures 20 to 28.
4. **Motions**: figures 29 to 35.
5. **Reuse**: the controls ladder into lessons 5, 21 and 27, the swing radius into 22, the ladder into
   7 and 20, the guardrail into 18, the oxygen gauge into 26, the trench signs into 10, the lifting
   zone into 27, the signals into 24. A figure drawn once, named in every lesson that teaches it.

Each figure PR is cut from fresh main, carries a release note and a fragment, runs `npm run build`
before the merge, and is walked as the sample helper on a 375 px phone in both themes.

## Is this the best we can do?

What the first cuts had, and what the one drawn keeps:

- **Photos.** A photo of a real guardrail says less than a drawing with three dimension lines, costs
  a licence or a site visit, weighs a hundred times more against the 6 MiB precache, and cannot
  follow the dark theme. Line drawings in the page's ink do all four.
- **Animated recordings.** The help guides use recordings for the app's own screens, never a static
  image, because a screen goes stale. A drawing of a ladder never goes stale, and a motion in four
  still frames reads at a glance where a loop has to be watched through.
- **A Pictures section** at the foot of the lesson. The reader meets the sentence, then scrolls to a
  picture they have to match back to it. The figure sits under its sentence and nowhere else.
- **One poster per lesson.** A poster says everything and teaches nothing; the reader cannot tell
  what matters. One figure per fact, only where words fail.
- **Interactive figures** (tap to reveal a label). Worth doing for two or three later, the trench
  section first. Static first, because a figure that needs a tap is invisible to a skim and to a
  screen reader.
- **Numbers chips as the picture.** The Numbers to remember row already lists the values. It is a
  summary for the retake, not a way to understand the first time.

Not drawn, on purpose: a figure in a check question (the owner's call 3), and a figure in the final
check (the same call, later).

## Owner's calls

1. **Line drawings or photos.** Drawn: line drawings in the app's ink. Photos only where a drawing
   cannot do it, which the catalog does not find.
2. **The first ten or all thirty-five.** The mock-up draws the ten with the most weight: the controls
   ladder, the clearance stack, the guardrail, the ladder, the trench section, the swing radius, the
   current scale, the signs sheet, the hard hat's limits, PASS with the fire classes. All thirty-five
   is five small PRs over a few days.
3. **A figure in a question.** "Which slope is Type C?" with the three drawn. Not in this plan; a
   later PR once the figures exist.
4. **The pictograms.** Ours are simple drawings that resemble the GHS set, enough to recognise the
   real one on a label. The lesson does not link out; the app stays the one place.
5. **Spanish.** Captions ride with the Spanish course when it comes; the drawings need no second copy.

## How to verify (once built)

- The content test holds every figure name both ways and every caption to the plain-words rules.
- The course page as the sample helper (View as… on Settings) on a 375 px phone: each figure fits
  the width with no sideways scroll, reads in dark, and shows its caption; VoiceOver reads the caption.
- The Dashboard chunk's size is unchanged, the course chunk grows by the figures and no more.
- `npm run build` passes before every merge.
