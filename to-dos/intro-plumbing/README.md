---
name: "Intro to plumbing: how water comes in and goes out, in drawings"
number: 119
group: close
status: BUILDING 2026-10-18 — the owner said build it, checking the work along the way; PR 1 (the offered state, the pipe drawing language, Start here and all of Water in, eleven lessons and eleven figures shot at three widths in both themes) is v2.5610; Part 2 Water out next; the six calls taken as drawn until the owner says otherwise
summary: >
  The second training course: thirty five-minute lessons on how a house's plumbing works, for
  understanding and not for estimating. Part 1 is water in under pressure, from the meter to the
  tap, with every valve and supply fitting drawn doing its job. Part 2 is water out by gravity,
  the drain, the trap and the vent, with the DWV fittings drawn and the reason their shape differs.
  Part 3 puts the two systems under conditions, a flush, a clog, a dry trap, a freeze, each as a
  still-frame strip. Part 4 reads a job: rough-in, top-out, trim, the inspector's tests and the
  first-timer's mistakes. The course rides the Training mechanism built for the OSHA 30 refresher
  and adds one thing to it, an offered state so a course can be open to every role and required
  for some. The owner, a master plumber, co-writes and corrects every lesson.
next: PR 2, Water out (lessons 12 to 19 and their eight figures, the trap and its seal among them), then Part 3 and Part 4; the owner corrects any fact or number in place as each part lands.
size: L (PR 1 is M; each part is an M PR of eight to ten drawings; the owner's corrections ride each one)
blocker: none; the six calls are built to the drawn leans and each is one row in Settings or one line in a lesson.
opinion: build it as outlined once the owner has corrected it; the drawings are the course, the mechanism is one column and one row on the card.
mockup: not required — the outline is the thing to read; PR 1 draws three lessons on the real course page as the proof, shot at three widths in both themes
---

# Intro to plumbing (#119)

The Training mechanism is live (#111, v2.5564 to v2.5592) with its drawings (#116, v2.5598 to
v2.5609). The owner, a master plumber, asked for the next course: an introduction to plumbing for
the people who work beside the plumbers. Understanding, not estimating. Stick figures and line
drawings of what each kind of fitting does, and how the sanitary sewer and the freshwater system
work together under various conditions. An intro to electrical comes after it. The owner will
co-write the course and correct the content, so this folder is the outline for that read, not a
finished lesson.

## The whole thing, in one read

**What a person sees.** A second row on the Dashboard's Training card: *Intro to plumbing · 30
lessons of about five minutes · about 2 hours 45 minutes in all*, with **Start**. For a helper it
sits with the OSHA refresher in the red, amber or green rows. For everyone else it sits under an
**Available** line, with no colour and no clock, because the course is open to every role and
required of some. The course page is the one that exists, `/training/<slug>`, with its rail of
parts, its five-section lessons and its final check.

**What the course is.** Four parts and a Start here, thirty lessons, a final check of twenty
questions drawn from every part. Every lesson teaches one fact a first-timer can carry away, and
draws it. The drawings are the course: a pipe is two lines, water is a tint, flow is an arrow,
and the trap's seal is a hatch. A fitting is drawn with the water going through it, so the shape
explains itself. A condition is a strip of three or four still frames, the way the OSHA lift and
PASS are drawn, so a flush or a freeze reads at a glance.

**What is already built.** The course folder, the parser and its test, the figure line, the
figure registry and its test, the course page, the Dashboard card, the policy in Settings →
Training, the pass and its clock. A new course is a folder of markdown and a folder of drawings.
The one thing the mechanism lacks is a way to open a course to a role without requiring it.

**What it is not.** It is not a licence, a code class or an estimating course. The course's
first page says so. Nothing in it tells a person how to price a job or lets them do licensed
work. The owner's numbers are the numbers; where this outline cites a code figure, the owner
corrects it to the code the company's cities inspect under.

## Where it plugs in

Everything below exists today and takes the new course without a change, apart from the one
mechanism gap in the next section.

- **The content folder** `src/content/training/<slug>/`: `course.md` with `title`, `summary`,
  `line` (what the course is not), `final_draw`, `final_pass`, `lessons`, `minutes` and a
  `## Parts` list that runs 0, 1, 2…; `NN-<slug>.md` per lesson, numbered from 01 and consecutive,
  with `title`, `part`, `minutes` and `from`, and the five sections in order: Why it matters,
  Must know, Traps, Numbers, Check yourself with four questions of four options and one right
  answer. `final-bank.md` holds twenty or more questions. The parser is
  `src/lib/training/courseContent.ts` and `courseContent.test.ts` is the gate: the shape, the
  plain words, the figure names both ways. The `from:` line names the source a lesson was built
  from; here it names the owner's note or correction the lesson came from, so a later reader
  knows whose fact it is.
- **The figure line** `{{figure:<name>|<caption>}}` in a Must know or Traps item
  (`src/lib/training/figures.ts`, `FIGURE_NAMES`), one component per name under
  `src/components/training/figures/`, mapped in `figures/index.ts`, drawn by
  `TrainingFigure.tsx` at the column's width with the caption under it. Every caption is held to
  the plain-words rules like a sentence. A figure stays under 4 KB and lives in the course page's
  lazy chunk.
- **The policy** `training_courses` (migration `20261015060000_training_courses.sql`, documented
  in `docs/ACCESS_CONTROL.md` → Training): `slug`, `title`, `enabled`, `required_roles text[]`
  held to the nine role words (dev, master_technician, assistant, subcontractor, helpers,
  estimator, primary, superintendent, controller), `good_for_months` (0 to 120, default 12),
  `due_soon_days` (default 30), `retake_from`, `updated_by`, `created_at`, `updated_at`. Everyone
  signed in reads it; a dev writes it through Settings → Training.
- **The state** `src/lib/training/trainingState.ts`: `courseStanding` returns null when the
  course is off or the role need not take it, so the card, the People rail, the Users row and
  the Settings counts all show nothing for that person. `training_state_for` and
  `training_standings` are its SQL twins and key on `required_roles` the same way.
- **The doors** `training_pass_lesson` and `training_finish_course` check the caller's own row
  and the fences, not the policy, so a person may pass a course their role need not take. The
  course page already lets anyone signed in read a course that is on.
- **The card** `src/components/dashboard/DashboardTrainingSection.tsx` draws nothing while no
  standing exists for the viewer, so today an open-to-all course would be invisible to the
  roles it is not required of.

## The one mechanism gap: an offered course

A course today is either required of a role or invisible to it. The intro course should be
required of the people who most need it and open to everyone else, with no clock on the ones who
chose to take it. One column and one row on the card do it.

**The migration** (one file, `SET lock_timeout = '3s';` first, numbered from `origin/main`'s
newest, which is `20261017010000_prospect_person_fields.sql` today):

- `ALTER TABLE public.training_courses ADD COLUMN IF NOT EXISTS offered boolean NOT NULL DEFAULT
  false;` with a comment: *open to every role; a role not in required_roles may take it with no
  colour and no clock.*
- The seed row: `('intro-to-plumbing', 'Intro to plumbing', enabled false, required_roles per the
  owner's call 1, offered true)`, `ON CONFLICT DO NOTHING`, off until a dev turns it on.
- Nothing else moves. `training_state_for` and `training_standings` keep keying on
  `required_roles`, so an offered course gives no colour, no chip on the People rail, no count in
  Settings. The two write doors already take a pass from any role. RLS is the row's and the new
  column rides it. No table is created, so no fence applier is needed. The migration doc goes to
  `docs/migrations/<version>_training_offered.md`, and the `training_courses` line in
  `docs/ACCESS_CONTROL.md` gains the column.

**The kernel**: `TrainingPolicy` gains `offered: boolean` and `policyFromRow` reads it. A new
pure function `offeredCourses(policies, passes, role)` returns the courses that are on, offered
and not required of the role, each with its newest pass day or null. `courseStanding` and
everything downstream of it are untouched, so the colours mean what they meant.

**The card's row**: under the coloured rows, an **Available** line in muted text, then one row per
offered course: the title, its size from `TRAINING_COURSE_FACTS`, and one press: **Start**,
**Continue** when a lesson is passed, **Read it again** after a pass. No dot, no colour, no due
day. The verdict line keeps counting required courses only. The card draws when there is a
standing or an offered course, so a controller with nothing required sees *Training · at your
own pace* and the Available row alone, with no verdict line. A caught-up helper sees one green
line and one Available row, still never a nag.

**Settings → Training**: an **Open to everyone** switch beside **On** on each course, and for an
offered course the counts line adds *· N took it*, read from `training_passes` under the office's
existing read. The retake stamp applies to the required roles as it does today and leaves an
offered pass alone, since it had no clock.

**The pass still counts.** State is read, never stored, so if the owner later makes the course
required of a role, every pass those people already took turns green on the day the policy
changes. A person who took it when it was offered never takes it twice.

**Considered and dropped**: a tenth role word *everyone* in `required_roles`. It would make the
course red for the office and put a clock on people who took it by choice, and *required* would
stop meaning one thing.

## The drawing language

The OSHA figures are line drawings in the page's ink: `currentColor` strokes, the theme's tints
for fills, one SVG per figure at `viewBox="0 0 300 N"`, no second drawing for dark. This course
keeps all of that and adds a small shared vocabulary so thirty drawings of pipes read as one
system.

- **A pipe is two lines.** Two parallel strokes with the bore between them. Supply pipe is
  narrow, about 6 units; drain pipe is wide, about 14 units, so a drain reads bigger than a
  supply line without a label.
- **Water is a tint in the bore.** Cold water `var(--bg-blue-200)`, hot water
  `var(--bg-red-100)`, waste water `var(--bg-amber-100)`, air an empty bore. The same four
  tints in every drawing, so a reader who has seen three figures knows which pipe is which in the
  fourth.
- **Flow is an arrow on the centreline.** A filled triangle in the ink, one per run, pointing the
  way the water goes. A pressure push is a short bar behind the arrow; gravity is the slope the
  pipe is drawn at.
- **The trap seal is a hatch.** Diagonal lines over the water in the bend, and only there, so the
  seal is the one thing in a DWV drawing with a pattern. Sewer gas is a dotted arrow stopped at the
  hatch.
- **A valve is its symbol with the water drawn through it.** A ball valve a circle with a bore,
  open or turned; a gate a wedge dropping into the bore; a check a flap; the PRV a spring over a
  diaphragm with a wide bore in and a narrow one out.
- **A fitting is drawn with water going through it**, never empty. A sanitary tee shows the
  branch's water curving into the run; a wye shows it joining at 45. A fitting drawn the wrong
  way round carries the house red `#b91c1c` on the arrow that fights the flow, the way the lift
  strip marks the twist.
- **A person is a stick figure** at the same scale as the OSHA strips, so a hand on a valve or a
  face at a gurgling drain reads the same way in both courses.

**The primitives.** One file, `src/components/training/figures/plumbingParts.tsx`, under 6 KB,
exporting small components a figure composes: `PipeRun` (from, to, bore, tint, an optional
arrow), `Elbow` (90 or 45, bore, tint), `Tee` (supply) and `SanTee` / `Wye` (drain), `Trap`
(P-trap with the hatch on or off), `Valve` (ball, gate, check, prv, open or shut), `Fixture`
(a sink, a toilet, a tub as a glyph), `Arrow` (flow, pressure, gas). A figure is then thirty
lines that name parts, not three hundred that draw them, and a change to how a pipe looks is
one edit. `figures.test.ts` keeps holding every figure under 4 KB of its own source, so the
parts file is the one that may grow.

**The conditions strips.** Part 3's lessons are three or four frames in a row, each a bordered
panel with a title and a sub-line, the way `LiftSteps` and `PassSteps` are drawn: frame 1 the
system at rest, frame 2 the condition, frame 3 what the water does, frame 4 the fix. On a phone
at 375 px the four frames are 70 units wide each and still read, which the OSHA strips proved.

**The shots.** Every drawing is shot at 375, 768 and 1280 px in light and dark before its PR
merges, as #116 did from PR 1 on, and the shots are read before the PR is called done. The
second pass of #116 (v2.5609) redrew four figures after reading every shot; the rule is the shot,
not the code.

## The outline

Thirty lessons of five minutes and a final check of fifteen, about 2 hours 45 minutes. Every
lesson has the one fact it teaches, its Numbers to remember and the one figure it needs. Numbers
are drawn from the International Plumbing Code where the code gives one and from trade practice
where it does not. They are a draft for the owner to correct. Each figure's name is the registry
name; each caption is what the reader sees under the drawing.

### Start here

| # | Lesson | The one fact | Numbers to remember | Figure |
|---|--------|--------------|---------------------|--------|
| 1 | Two systems, one house | Water comes in under pressure and leaves by gravity. The two never touch. | **2** systems · **0** places they connect · **the fixture** is where they meet | `two-systems` — Water comes in under pressure. Water leaves by gravity. The two never touch. |

### Part 1 · Water in

| # | Lesson | The one fact | Numbers to remember | Figure |
|---|--------|--------------|---------------------|--------|
| 2 | The meter and the main shutoff | All the water enters at one pipe, and one valve at the house stops all of it. | **2** valves, the city's at the meter and yours at the house · **3/4 in** the common service line · find yours before you need it | `meter-and-main-shutoff` — The city's valve is at the meter. Yours is where the pipe enters the house. |
| 3 | Pressure and the PRV | Pressure is the push. Too little and the shower dribbles. Too much and the fittings fail. The PRV holds it down. | **40 to 60 psi** comfortable · **80 psi** the most the code allows · **a PRV** above 80 · **2.31 ft** of height per psi | `pressure-and-prv` — The gauge reads the push. The PRV lets high street pressure through as a lower house pressure. |
| 4 | The water heater | A tank takes cold water at the bottom, heats it, and sends hot water out the top. A safety valve guards it. | **120°F** the set point · **150 psi or 210°F** opens the T&P valve · **40 to 50 gal** a common tank · an expansion tank when the system has a PRV or a check | `water-heater-cutaway` — Cold goes in at the bottom through the dip tube. Hot leaves at the top. The T&P valve is the safety. |
| 5 | Hot and cold around the house | Every fixture gets two lines, hot and cold. A house runs them as a trunk with branches or as a manifold with one line per fixture. | **hot on the left**, cold on the right · **3/4 in** trunk · **1/2 in** branch · **one line** per fixture from a manifold | `trunk-vs-manifold` — Trunk and branch is one big line with small lines off it. A manifold runs one line to each fixture. |
| 6 | Copper | Copper is soldered. Heat draws the solder into the gap between pipe and fitting. | **M, L, K** thin to thick · **1/2 and 3/4 in** the common sizes · **lead-free** solder since 1986 | `copper-sweat-joint` — The heat pulls the solder into the gap between the pipe and the fitting. |
| 7 | PEX | PEX bends, so it needs fewer fittings. It is joined by a crimp ring or by expansion. | **A, B, C** the three kinds · **100 psi at 180°F** · **no sunlight** · a bend no tighter than **6 to 8** pipe widths | `pex-joints` — A crimp ring squeezes PEX onto a barbed fitting. An expansion joint stretches it over the fitting and lets it shrink back. |
| 8 | CPVC and the glued joint | CPVC is glued and takes hot water. The cement melts the two faces into one piece. | **100 psi at 180°F** · **its own cement**, never PVC's · hold the joint **30 seconds** · **hours** before pressure | `solvent-joint` — Primer softens both faces. Cement melts them into one piece. |
| 9 | Ball, gate and check valves | Three valves do three jobs. A ball valve stops fast. A gate valve stops slow and sticks. A check valve lets water go one way. | **a quarter turn** the ball · **many turns** the gate · **one way** the check · **50 to 60 psi** a PRV's usual setting | `ball-gate-check` — A ball valve turns a quarter. A gate valve winds a gate down. A check valve swings shut when flow turns around. |
| 10 | Valves at the fixture and the hose | An angle stop under every fixture stops one line without stopping the house. A hose bib has a vacuum breaker so the hose cannot pull water back. | **1** angle stop per line · **every** hose bib has a breaker · **8 to 12 in** the frost-proof bib reaches into the wall | `fixture-valves` — An angle stop under every fixture. A vacuum breaker on every hose bib. |
| 11 | Supply fittings: what each shape does | Each fitting does one thing to the water: turns it, splits it, joins it, shrinks it, ends it or changes its material. | **90** a quarter turn · **45** an eighth · **tee** splits · **coupling** joins · **union** is the one that comes apart · **reducer**, **cap**, **adapter** | `supply-fittings` — Each fitting does one thing to the water. It turns it, splits it, joins it, shrinks it, ends it or changes its material. |

### Part 2 · Water out

| # | Lesson | The one fact | Numbers to remember | Figure |
|---|--------|--------------|---------------------|--------|
| 12 | Gravity and slope | Waste has no pump. It runs downhill at a set slope. Too flat leaves water. Too steep leaves solids behind. | **1/4 in per ft** for pipe up to 2-1/2 in · **1/8 in per ft** allowed from 3 in · **2 ft per second** carries solids | `slope-rule` — A quarter inch of fall for every foot of pipe. Flatter leaves water. Steeper leaves solids. |
| 13 | The trap and its seal | The water sitting in the bend under every fixture is the seal. Sewer gas stops at it. | **2 to 4 in** of seal · **1** trap per fixture, never two · **1-1/4 in** a lav trap · **1-1/2 in** a sink trap | `p-trap-seal` — The water sitting in the bend is the seal. Sewer gas stops at it. |
| 14 | Why vents exist | Rushing water pulls air behind it. Without a vent it pulls the seal out of the trap. A vent lets air follow instead. | **1** vent for every trap · **6 ft** the 1-1/2 in trap arm · **8 ft** the 2 in trap arm · the arm drops **no more than its own width** | `siphon-and-vent` — Without a vent the rushing water pulls the seal out behind it. With a vent, air follows the water and the seal stays. |
| 15 | Vent types | Vents join and leave through the roof. An individual vent serves one trap, a common vent two, a wet vent carries water too, and an air admittance valve lets air in where no pipe can reach the roof. | **6 in** above the roof · **10 ft** from a window or **3 ft** above it · an AAV **4 in** above the trap arm | `vent-types` — Every trap has a vent. The vents join and leave through the roof. |
| 16 | The building drain, the sewer and the cleanouts | The building drain collects every stack under the house and becomes the sewer outside the wall. A cleanout is where you get into the pipe. | **4 in** the common building drain · **30 in** outside the wall the sewer begins · a cleanout every **100 ft** and at every turn over **45°** · **1,000 gal** a common septic tank | `house-to-sewer` — The building drain runs under the house and becomes the sewer outside the wall. A cleanout where it leaves. |
| 17 | Sanitary tee vs wye | DWV fittings sweep because solids must keep moving. A sanitary tee drops a branch into a vertical stack. A wye joins a horizontal run at an angle. | **sanitary tee** on a vertical drain only · **wye** on a horizontal run · **45°** the wye's branch · **never** a tee on its back | `san-tee-vs-wye` — A sanitary tee drops a branch into a vertical stack. A wye lets a branch join a horizontal run at an angle. |
| 18 | Combos, sweeps and direction | The turn the water makes picks the fitting. A drop into a vertical pipe can be short. A landing on a horizontal pipe is long. Every fitting points the way the water goes. | **long sweep** on every horizontal turn · **two 45s** do the same · a **combo** is a wye and an eighth bend · **short sweep** only into a drop | `sweeps-and-direction` — A long sweep turns a horizontal run. A combo joins and turns in one fitting. Every fitting points the way the water goes. |
| 19 | PVC, ABS and cast iron | Three pipes do one job. PVC and ABS are glued, each with its own cement. Cast iron is clamped and quiet. | **white** PVC, **black** ABS · **never** the same cement on both · **60 in-lb** on a no-hub band · **50 to 100 years** for cast iron | `dwv-materials` — PVC and ABS are glued, each with its own cement. Cast iron is clamped with a no-hub band. |

### Part 3 · The two together, under conditions

Each of these is a strip of three or four frames.

| # | Lesson | The one fact | Numbers to remember | Figure |
|---|--------|--------------|---------------------|--------|
| 20 | A flush | A flush is both systems in four seconds. The tank dumps, the bowl's own trap siphons, the vent lets air follow, and the fill valve refills from the supply. | **1.6 gal** a flush, **1.28** WaterSense · **3 in** the smallest closet drain · the bowl has **its own trap** | `flush-strip` — The tank dumps into the bowl. The bowl's own trap siphons. The vent lets air follow. The fill valve refills the tank. |
| 21 | A clog | Water seeks the easiest way out. A clog backs water up to the lowest open fixture, which is why a tub fills when a toilet is flushed. | **the lowest fixture** shows it first · **the cleanout** is the door in · **100 ft** between cleanouts | `clog-strip` — A clog backs water up to the lowest open fixture. Water seeks the easiest way out. |
| 22 | A dry trap | A trap nobody uses dries out. Sewer gas comes through the empty bend. A cup of water fixes it. | **a month** of no use can dry a floor drain · **1 cup** refills it · **a trap primer** keeps it full | `dry-trap-strip` — A trap left unused dries out. Sewer gas comes through the empty bend. |
| 23 | A blocked vent | A blocked vent makes the drain gulp air through the nearest trap. The gurgle is the seal leaving. | **a gurgle** is air through the seal · **the roof** is where to look first · **leaves, a nest, ice** are the usual blocks | `blocked-vent-strip` — A blocked vent makes the drain gulp. The trap next to it loses its seal. |
| 24 | A pressure drop | Two fixtures on one small line share the push. A half-shut valve, a pinched pipe or a failing PRV does the same to the whole house. | **4 psi** lost for every 10 ft of height · **a half-closed valve** acts like a small pipe · **a PRV** that fails reads low or high | `pressure-drop-strip` — Two fixtures on one small line share the push. A half-shut valve or a pinched pipe does the same. |
| 25 | A freeze | Water grows when it freezes and splits the pipe. The leak shows when it thaws. | **32°F** water freezes · **9%** bigger as ice · **20°F** the night to worry about · **a drip** keeps it moving | `freeze-strip` — Ice grows along the pipe and splits it. The leak shows when it thaws. |
| 26 | Water hammer | A valve shutting fast stops moving water dead. The pipe takes the hit. An arrestor's air cushion takes it instead. | **a fast valve** starts it, a washer or a dishwasher · **an arrestor** near that valve · **an old air chamber** waterlogs in months | `water-hammer-strip` — A valve shutting fast stops moving water dead. The pipe takes the hit. An arrestor's air cushion takes it instead. |
| 27 | Backflow and cross-connection | Supply water must never touch anything else. If street pressure drops, a hose in a bucket pulls the bucket into the house. The air gap and the breaker stop it. | **an air gap** of twice the pipe's width, at least **1 in** · **a vacuum breaker** on every hose bib · **a backflow preventer** on the irrigation line | `cross-connection-strip` — A hose sits in a bucket. Street pressure drops. The bucket's water is pulled back into the house line. |

### Part 4 · Reading the job

| # | Lesson | The one fact | Numbers to remember | Figure |
|---|--------|--------------|---------------------|--------|
| 28 | Rough-in, top-out, trim | A plumber visits three times. Rough-in puts the pipes under the slab and in the walls. Top-out brings them to the fixture and through the roof. Trim sets the fixtures. | **3** visits · **3** inspections · rough-in **before** the slab · trim **last** | `three-visits` — Rough-in puts the pipes under the slab and in the walls. Top-out brings them to the fixture. Trim sets the fixtures. |
| 29 | What the inspector tests | The inspector reads a gauge, not your word. The drains hold a head of water. The supply holds pressure. At the end every fixture runs and every trap holds. | **10 ft** head of water on the DWV · **5 psi** air for **15 min** instead · **50 psi** air on the supply · every trap **holds** at the final | `inspector-tests` — The DWV holds a 10-foot head of water for 15 minutes. The supply holds pressure. The inspector reads the gauge. |
| 30 | The first-timer's mistakes | Four mistakes a first-timer makes, each drawn beside the right way: an S-trap, a tee on its back, a flat run, a trap arm too long. | **an S-trap** siphons itself · **a tee on its back** fights the flow · **1/4 in per ft** or it is flat · **6 ft** the 1-1/2 in arm | `first-timer-mistakes` — An S-trap, a tee on its back, a flat run, a trap arm too long. Each beside the right way. |

**The final check**: twenty questions drawn one part at a time, as the parser already draws
them, fourteen right to pass, retake allowed. The bank holds at least twenty questions of its
own in the owner's wording.

**`course.md`**: `title: Intro to plumbing`, `line: An introduction, not a licence. Nothing here
lets anyone do licensed work.`, `final_draw: 20`, `final_pass: 14`, `lessons: 30`,
`minutes: 165`, and `## Parts` as `0. Start here`, `1. Water in`, `2. Water out`, `3. The two
together`, `4. Reading the job`.

## PRs, in order

0. **This to-do.** The outline, for the owner's read. Docs only, no version.
1. **The offered state, the drawing language and the first part as the proof** (v2.5610). The
   migration and its doc, the kernel's `offered` and `offeredCourses`, the card's Available row,
   the Settings chip, the `training_courses` line in `ACCESS_CONTROL.md`, `plumbingParts.tsx`
   and `plumbingTokens.ts`, and the course folder with lessons 1 to 11 (Start here and all of
   Water in) and a bank of twenty-four. Eleven lessons and not three, because the content test
   holds every course to at least ten lessons and over an hour. The seed row off and offered. The
   guide `take-a-training-course` gains one line on the Available row. `docs/twins/APP_DIRECTORY.md`
   gains the course's path. The SQL bed's section 9 for the column and the seed. Every drawing shot
   at 375 px in both themes and at 768 and 1280 px on the real page; eight label collisions found
   in the shots and fixed before the merge.
2. **Part 1, water in**: shipped in PR 1.
3. **Part 2, water out**: lessons 12 to 19 and their eight figures.
4. **Part 3, the conditions**: lessons 20 to 27, the eight strips.
5. **Part 4, reading the job**: lessons 28 to 30, the three figures, the bank filled from every
   part, `lessons: 30` and `minutes: 165`, the glossary's Training line naming two courses.
6. **The owner's read-through** of the live course as a dev preview, every correction as one
   commit, then **On** in Settings → Training.

Each part PR is cut from fresh main, carries a release note and a fragment, runs `npm run build`
before the merge, and is walked as the sample helper on a 375 px phone in both themes. The
owner's corrections ride each PR as commits, with the lesson's `from:` line naming them.

## Is this the best we can do?

What the first cuts had, and what the one drawn keeps:

- **A course by material** (a copper lesson, a PVC lesson, a valves lesson) taught parts and not
  the system. The cut drawn goes the way the water goes, in at the meter and out at the sewer,
  and meets each material and fitting where the water does.
- **Fittings as a catalogue**, one lesson of thirty shapes. Nobody learns a wye from a chart. One
  lesson per family, each fitting drawn with the water in it, and the shape teaches the rule.
- **Conditions as sentences.** "A blocked vent siphons the trap" is true and teaches nothing.
  Four frames with the seal hatched and then gone teach it in one look, which the OSHA strips
  proved.
- **Photos of fittings.** A photo of a sanitary tee is a black shape. A drawing shows the sweep
  and the arrow, follows the dark theme, and weighs nothing against the 6 MiB precache.
- **A required course for every role.** The office would turn red over a course meant for the
  truck, and a clock would sit on people who took it for interest. The offered state keeps
  *required* meaning one thing.
- **Estimating alongside** (what a fitting costs, how long a rough-in takes). The owner asked for
  understanding, not estimating. Pricing has the Workbench and its own walkthrough.
- **Gas in this course.** Gas is a third system with its own code and its own licence. It is one
  of the owner's calls below, drawn as its own short course.

Not drawn, on purpose: a figure inside a check question (#116's open call 3) and the Spanish copy
(the one Spanish switch, after the English course has been through a crew).

## Owner's calls

1. **Who must take it.** Drawn: required of helpers, offered to every other role. One number away
   from required of helpers, subcontractors and primaries, or of nobody and offered to all.
2. **The name on the card.** Drawn: *Intro to plumbing*. Also on the table: *How water moves*,
   *Plumbing basics*. The title is one row in `training_courses` and one line in `course.md`.
3. **Gas.** Drawn: its own course, after electrical. Or a fifth part of this one, five lessons:
   the meter and the shutoff, pressure and the regulator, black iron and CSST, the drip leg and
   the sediment trap, the leak test.
4. **Brands and the stock.** Drawn: no brands, the common sizes only, so the course is true on
   any job. Or the fittings lessons name what the truck carries, which makes the course the
   company's and dates it with every stock change. A stock list is a help guide, not a lesson.
5. **The code the numbers cite.** The outline cites the International Plumbing Code where the
   code gives a number. Texas lets a city pick the IPC or the UPC, and the trap-arm and vent
   numbers differ between them. The owner names the code, or says the lessons give the
   company's rule and not a code's.
6. **The clock.** Drawn: good for 120 months, the most the column allows, so a required helper
   takes it once. Or the usual 12 months, so it is read again every year like the refresher.

## How to verify (once built)

- The content test holds the thirty lessons and the bank to the shape, the plain words and the
  figure names both ways; `npm run build` passes with the course in the lazy chunk and the
  Dashboard's chunk unchanged.
- A controller, who needs no course, sees the Training card with an Available row and no verdict
  line; **Start** opens the course; passing a lesson turns the press to **Continue**.
- A helper sees the course in red beside the refresher; passing the final check writes one
  `training_passes` row and the row turns green with its due day.
- Switching **Open to everyone** off hides the Available row from the controller at once and
  leaves the helper's row as it was.
- Making the course required of controllers in Settings turns the controller's existing pass
  green on the spot, with no second pass.
- Every drawing read at 375, 768 and 1280 px in light and dark, with no sideways scroll and the
  caption under it; VoiceOver reads the caption.
