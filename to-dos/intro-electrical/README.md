---
name: "Intro to electrical: what is live, what the panel does, and where our work touches it"
number: 120
group: gated
status: BUILDING 2026-10-18 — the owner read the outline and said build it, with six changes written in below (the water heater's scope line, the jumper lesson moved up into Part 1, the hot wire in the plain ink, the shock numbers from the refresher, the final check at twenty and fourteen, the seven calls decided); PR 0 (the drawing language, Start here and all of Power in, ten lessons, three drawn, the seed row off and offered) is v2.5614; PR 1 (Power in drawn, the seven held-back figures) is v2.5615; PR 2 (The devices, lessons 11 to 18 and eight figures) is v2.5616; the reader is still unnamed, so every `from:` cites the published page or the owner and the first page carries a blank for the name
summary: >
  The third training course: thirty five-minute lessons on how a house's electrical system
  works, for the plumbing crew that works beside it. Understanding, not doing. Part 1 is power
  in, from the service drop through the meter and the panel to the branch circuit, with volts,
  amps and watts in plain words and the neutral and the ground told apart, and the
  bonding jumper a plumber must not break taught beside the ground it carries. Part 2 is the
  devices, receptacles, switches, GFCI and AFCI, lights, the water heater's circuit, the
  disposal, the dishwasher, the sump and the well pump, and the low-voltage world. Part 3 puts
  the two trades together under conditions, a tripped breaker, a GFCI trip at a sink, water on
  a panel, a cut in the bonded pipe, a water heater with no power, a backfeed.
  Part 4 is the job: what is live and how to know, lockout as a plumber sees it, where our work
  touches theirs, what the inspector looks at, the field mistakes. Electrical is not the
  company's trade, so a named licensed reader or a published source checks every lesson, and no
  lesson reads as instruction to do electrical work.
next: PR 1 (Part 1's seven held-back figures), then Parts 2, 3 and 4 as one PR each; the owner names the reader, whose read-through and corrections ride the PRs as commits and whose name and code cycle go on the first page.
size: L (PR 0 is M; each part is an M PR of five to eight drawings; the reader's corrections ride each one)
blocker: none for the build (PR #5827 and #5828 merged 2026-10-18); the switch to On waits on the reader the owner names, because the company cannot vouch for electrical facts itself.
opinion: build it as outlined once a reader has corrected it; the drawings are the course, the mechanism needs nothing new, and the one rule that matters is that every lesson ends at "do not touch it" and never at "here is how".
mockup: not required — the outline is the thing to read; PR 0 draws three lessons on the real course page as the proof, shot at three widths in both themes
---

# Intro to electrical (#120)

The Training mechanism is live (#111, v2.5564 to v2.5592) with its drawings (#116, v2.5598 to
v2.5609). Intro to plumbing (#119) is being built from its outline: PR #5827 adds the offered
state, the pipe drawing language and the first eleven lessons, and PR #5828 stacks Water out on
it. The owner, a master plumber, asked for the next course after it: an introduction to
electrical for the same crew. Understanding, not doing. What is live, what the panel does, why
GFCI and bonding exist, and where plumbing work touches electrical. Electrical is not the
company's trade, so this course needs a reader the company does not have in house. This folder is
the outline for the owner's read and for that reader's correction, not a finished lesson.

## The whole thing, in one read

**What a person sees.** A third row on the Dashboard's Training card: *Intro to electrical · 30
lessons of about five minutes · about 2 hours 45 minutes in all*, with **Start**. For the roles it
is required of it sits with the OSHA refresher and Intro to plumbing in the red, amber or green
rows. For everyone else it sits under the **Available** line that PR #5827 adds, with no colour
and no clock. The course page is the one that exists, `/training/<slug>`, with its rail of parts,
its five-section lessons and its final check.

**What the course is.** Four parts and a Start here, thirty lessons, a final check of twenty
questions drawn from every part. Every lesson teaches one fact a first-timer can carry away, and
draws it. The drawings are the course: a conductor is one line, current is an arrow along it, a
breaker is a gate in the line, a ground is three bars to earth. A circuit is drawn with the
current going round it, so the shape explains itself. A condition is a strip of three or four
still frames, the way the OSHA lift and the plumbing flush are drawn, so a trip or a backfeed
reads at a glance.

**What is already built.** The course folder, the parser and its test, the figure line, the
figure registry and its test, the course page, the Dashboard card, the policy in Settings →
Training, the pass and its clock. PR #5827 adds the offered state, the shared parts file and the
tokens file. A new course is a folder of markdown and a folder of drawings, and this one needs
no mechanism at all.

**What it is not.** It is not a wiring course. Nobody who finishes it may open a panel, land a
wire or reset anything but a breaker, a GFCI or a water heater's high-limit button. The course's
first page says so, and every lesson ends at the same place: here is what it does, here is how you
know it is live, here is what you do not touch, here is who you call. The owner's reader, a
licensed electrician or a published text, checks every number and every claim, and the lesson's
`from:` line names them.

**The water heater's scope line (the owner, 2026-10-18).** The rule above has one exception, and
it is the company's own trade: an electric water heater is plumbing work. Lessons 15 and 24 say
what a plumber on the company's truck may do on a water heater, which is the whip, the elements,
the thermostats and the high-limit reset, and only with the breaker off and the circuit tested
dead first; and what they may not, which is the panel, the breaker's wiring and anything upstream
of the heater's disconnect. The two lessons write it as the company's rule, with `from:` naming
the owner, and the content test's no-instruction rule (call 6) reads "a plumber on the company's
truck" as the who.

## Where it plugs in

Everything below exists today, or lands with PR #5827, and takes the new course without a change.

- **The content folder** `src/content/training/<slug>/`: `course.md` with `title`, `summary`,
  `line` (what the course is not), `final_draw`, `final_pass`, `lessons`, `minutes` and a
  `## Parts` list that runs 0, 1, 2…; `NN-<slug>.md` per lesson, numbered from 01 and consecutive,
  with `title`, `part`, `minutes` and `from`, and the five sections in order: Why it matters,
  Must know, Traps, Numbers, Check yourself with four questions of four options and one right
  answer. `final-bank.md` holds twenty or more questions. The parser is
  `src/lib/training/courseContent.ts` and `courseContent.test.ts` is the gate: the shape, the
  plain words, the figure names both ways, and at least ten lessons and sixty minutes per
  course, which is why PR 0 ships a whole part and not three lessons (#119 PR 1 met the same
  gate with eleven). The `from:` line names the source a lesson was built from; here it names
  the reader's correction or the published page the fact came from, so a later reader knows
  whose fact it is and that it is not ours.
- **The figure line** `{{figure:<name>|<caption>}}` in a Must know or Traps item
  (`src/lib/training/figures.ts`, `FIGURE_NAMES`), one component per name under
  `src/components/training/figures/`, mapped in `figures/index.ts`, drawn by
  `TrainingFigure.tsx` at the column's width with the caption under it. Every caption is held to
  the plain-words rules like a sentence. A figure stays under 4 KB and lives in the course page's
  lazy chunk. PR #5827 adds `plumbingParts.tsx` (`Pipe`, `Seal`, `Hatch`, `Flow`, `Hub`,
  `Valve`, `Person`, `Sink`, `Label`, `Panel`) and `plumbingTokens.ts` (the four tints, `WRONG`
  and `RIGHT`, the two bores); this course reuses them and adds a parts file of its own.
- **The policy** `training_courses`: `slug`, `title`, `enabled`, `required_roles text[]` held to
  the nine role words, `good_for_months`, `due_soon_days`, `retake_from`, and `offered` from PR
  #5827. The seed row for this course is one insert in a later migration, off and offered, with
  `required_roles` per call 2.
- **The state** `src/lib/training/trainingState.ts`: `courseStanding` for the required roles,
  `offeredCourses` for the rest. Nothing to add.
- **The OSHA refresher already teaches two electrical lessons**: lesson 9, Electrocution (the
  current scale, the GFCI's 5 mA, the breaker's 15,000 mA, the power-line clearances, the dig
  flags) and lesson 28, Electrical safety and NFPA 70E (the boundaries, the arc flash
  categories, the qualified person). This course does not repeat them. It links to them where a
  fact is theirs (`current-scale` is drawn again in lesson 22 here, by name, with its own
  caption) and teaches what they assume: what the current is running through, and why the
  breaker and the GFCI are two different protections.

## Who checks the content (the first call)

The company holds a plumbing licence, not an electrical one. A lesson that says what a breaker
does, or what size wire a 20 A circuit takes, is a claim the company cannot vouch for itself,
and a crew member who reads it will treat it as true. So before PR 0 the owner names the reader,
and every lesson's `from:` line names the reader's correction or the page it came from. Three
options, each one line of cost:

1. **A licensed electrician the company works with.** The electrical sub on the company's jobs
   reads each part before its PR merges, in an hour per part, and corrects it in place. Their
   name goes on the course's first page as *read by*, with their licence number if they want it
   there. The best option, because they know the company's cities, the brands on the jobs and
   the code cycle the inspectors use. Costs four hours of their time and a favour.
2. **A published source.** A trade-school introduction (Mullin and Simmons, *Electrical Wiring
   Residential*, is the one most programs teach from) or the NFPA's own plain-language guides to
   the NEC (the National Electrical Code, NFPA 70). Each number in the outline is checked against
   a page and the `from:` line cites it. No one reads the course, but every fact has a home a
   licensed reader could check later. Costs one book and a day of checking.
3. **Both.** The numbers come from the source and the electrician reads the result. The draft
   below is written so either reader can start from it.

Drawn: option 3, with the sub's read as the gate. The outline cites the NEC where the code gives
a number, as #119 cites the IPC, and the reader corrects each one to the code cycle the company's
cities inspect under. **The owner's question: who reads it, and may their name go on the first
page?**

## The drawing language

The OSHA figures and the plumbing figures are line drawings in the page's ink: `currentColor`
strokes, the theme's tints for fills, one SVG per figure at `viewBox="0 0 300 N"`, no second
drawing for dark. This course keeps all of that, reuses the plumbing parts where the shape is the
same, and adds a small vocabulary of its own so thirty drawings of circuits read as one system.

- **A conductor is one line.** A single stroke, thinner than a supply pipe, so wire and pipe
  never read as the same thing in a drawing that has both. The hot is the plain ink line, the way
  a black wire is black. The neutral is white, the surface colour with a grey edge, the way a
  white wire is white. The ground is the plumbing's waste amber tint for bare copper, because
  green is the status colour and must stay a verdict. The same three everywhere, so a reader who
  has seen three figures knows which wire is which in the fourth, and no wire shares a tint with
  the hot water pipe (the owner, 2026-10-18: red is for one thing only).
- **Current is an arrow along the line.** A filled triangle in the ink, one per leg, pointing
  the way the current goes, out on the hot and back on the neutral. The house red `#b91c1c` is
  used for one thing only in the whole course: current where it should not be, through a person,
  through a pipe, through the ground wire, on the arrow that carries it and nowhere else, the way
  the lift strip marks the twist and the plumbing marks a fitting the wrong way round.
- **A breaker is a gate in the line.** A short bar that stands in the conductor when it is
  closed and swings open when it trips, with its amp rating beside it. Open is the one thing in
  a circuit drawing with a gap, so a trip reads as a gap.
- **A receptacle is its face.** The two slots and the round hole, drawn the way a reader sees it
  on the wall, with the three conductors landing on it from behind in their tints. A GFCI face
  carries its two small buttons. A 240 V receptacle carries its different slots so the shape says
  it is not a 120 V one.
- **A ground is three bars to earth.** The standard symbol, and the only place it appears is at
  the panel's rod and the water pipe, so the reader learns that the ground has one home.
- **A switch is a hinged line.** Closed in the run, open at an angle, like the breaker but with
  no rating, so a reader tells a switch from a breaker by the number beside it.
- **A load is a box with its name.** A lamp a circle with a cross, a motor a circle with an M, a
  heating element a zigzag, the water heater the plumbing's `WaterHeaterCutaway` with the
  element added. Each is drawn with the current going through it, never empty.
- **A pipe is still two lines.** Where a drawing has both, the plumbing's `Pipe` draws the
  pipe and the conductor is the one thin line, so the bonding lessons show the two trades in
  the same picture with no label.
- **A person is a stick figure** at the OSHA and plumbing scale. A person who is the path is drawn
  with the red arrow running through them, head to feet.

**The primitives.** One file, `src/components/training/figures/electricalParts.tsx`, about 8 KB
as `plumbingParts.tsx` is,
exporting small components a figure composes: `Conductor` (from, to, tint, an optional arrow),
`Breaker` (x, y, amps, open or closed), `Receptacle` (120, 120 GFCI, 240), `Ground` (x, y),
`Switch` (open or closed), `Load` (lamp, motor, element, named box), `Meter` (the dial face),
`PanelBox` (the enclosure with its bus bars and a row of breaker slots). It reuses `Person`,
`Label`, `Panel` (the strip frame), `Pipe`, `Valve` and `Flow` from `plumbingParts.tsx`, and
`WRONG` from `plumbingTokens.ts`, adding one file `electricalTokens.ts`: `WIRE` (hot
`currentColor`, neutral `var(--surface)` over an ink edge, ground `var(--bg-amber-100)`),
`CONDUCTOR` (the line's width) and `FAULT`, which is `WRONG` under the name the course uses. A
figure is then thirty lines that name parts, not three hundred that draw them.

**The conditions strips.** Part 3's lessons are three or four frames in a row, each a bordered
panel with a title and a sub-line, the way `LiftSteps` and the plumbing's flush strip are drawn:
frame 1 the circuit at rest, frame 2 the condition, frame 3 what the current does, frame 4 what
you do, which in this course is always a call or a step back, never a fix.

**The shots.** Every drawing is shot at 375, 768 and 1280 px in light and dark before its PR
merges, as #116 did from PR 1 on and as #119 PR 1 did (eight label collisions found from the
shots and fixed), and the shots are read before the PR is called done. The rule is the shot, not
the code.

## The outline

Thirty lessons of five minutes and a final check of twenty, about 2 hours 45 minutes. Every
lesson has the one fact it teaches, its Numbers to remember and the one figure it needs. Numbers
are drawn from the NEC where the code gives one and from trade practice where it does not. They
are a draft for the reader to correct, and nothing in them is the company's claim until the
reader has signed off. Each figure's name is the registry name; each caption is what the reader
sees under the drawing. Every lesson ends at what not to touch and who to call.

### Start here

| # | Lesson | The one fact | Numbers to remember | Figure |
|---|--------|--------------|---------------------|--------|
| 1 | One loop, out and back | Electricity only moves in a loop. It leaves the panel on one wire, does its work, and comes back on another. Break the loop and it stops. | **2** wires make a loop, the hot out and the neutral back · **1** more, the ground, for when something goes wrong · **0** work done until the loop is closed | `one-loop` — Current leaves the panel on the hot wire, does its work, and comes back on the neutral. The ground waits for a fault. |

### Part 1 · Power in

| # | Lesson | The one fact | Numbers to remember | Figure |
|---|--------|--------------|---------------------|--------|
| 2 | The service drop and the meter | Power arrives on three wires from the pole or from underground. The meter counts it. Everything before the meter is the utility's, and it is never off. | **3** wires, two hots and a neutral · **the utility's** up to the meter · **never off**, even with the main thrown | `service-and-meter` — Three wires come from the pole to the meter. Everything on the street side of the meter stays live. |
| 3 | The main panel and the main breaker | One box takes the three wires and splits them into every circuit. One big breaker at the top shuts off everything below it, and nothing above it. A subpanel is a second box fed by one breaker in the first. | **1** main breaker · **100 to 200 A** a common house · **the lugs above it** stay live with the main off · **a subpanel's** real off is its breaker in the main panel | `main-panel` — The main breaker feeds two bus bars. Every branch breaker hangs off them. The lugs above the main are live whatever you do. |
| 4 | Volts, amps and watts in plain words | Volts is the push, amps is the flow, watts is the work. Push times flow is work. Like pressure, gallons per minute and the shower. | **volts × amps = watts** · **120 V** the push on a wall outlet · **15 A** the flow a small circuit allows · **1,800 W** the work that makes | `volts-amps-watts` — Volts is the push. Amps is the flow. Watts is the work they do together. |
| 5 | 120 and 240 | One hot and the neutral make 120 V. Two hots together make 240 V. Big loads take 240 so the amps stay smaller. | **120 V** one hot to neutral · **240 V** hot to hot · **the water heater, the dryer, the range, the AC** take 240 · **half the amps** for the same work | `one-twenty-two-forty` — One hot and the neutral is 120 V. The two hots together is 240 V. |
| 6 | The neutral and the ground are not the same | The neutral carries current every time something runs. The ground carries current only when something has gone wrong. They meet in one place, the main panel, and nowhere else. | **the neutral** carries current all day · **the ground** carries it only in a fault · **1** place they join, the main panel · **white** and **bare or green** | `neutral-vs-ground` — The neutral carries the current back every day. The ground carries it only when something has gone wrong. They join once, in the main panel. |
| 7 | Where the ground goes | The ground wire ends in the earth. It runs to a rod outside and to the metal water pipe, so a fault has a path with no person in it. | **1** rod, often **2** · **8 ft** long · **within the first 5 ft** of the metal water pipe inside the wall is where it clamps on · **a bonding jumper** around the meter | `ground-path` — The ground runs from the panel to a rod in the earth and to the metal water pipe. A fault goes there and not through you. |
| 8 | The jumper you must not break | The metal water pipe is part of the ground path. A jumper wire carries the ground around the meter, a filter and any break, so the path holds when a section comes out. A plumber never removes one and never leaves a metal to plastic change without a word to the electrician. | **the metal water pipe** is a grounding electrode · **a jumper** around the meter, a filter and any break · **plastic** breaks the path · **never** remove a jumper · **tell the electrician** before a metal to plastic change | `bonding-jumper` — The ground runs through the metal water pipe. A jumper carries it around the meter. The jumper stays, whatever comes out of the pipe. |
| 9 | The branch circuit | A branch circuit is one breaker, one wire run and the outlets on it. The breaker's number is the most amps that wire may carry. | **15 A** or **20 A** a general circuit · **one breaker** per branch · **the code counts watts**, not outlets | `branch-circuit` — One breaker, one wire run, the outlets on it. The breaker's number is the most the wire may carry. |
| 10 | Wire sizes and the breaker that protects each | A wire has a size, and the breaker must match it. The breaker trips on too many amps, fast on a short and slow on an overload. It protects the wire in the wall, not you. | **14 AWG** with a **15 A** breaker · **12 AWG** with **20 A** · **10 AWG** with **30 A** · smaller number, bigger wire · **the wire**, not the person | `wire-and-breaker` — The breaker's number matches the wire's size. A short trips it at once. An overload trips it in minutes. Either way it saves the wire, not you. |

### Part 2 · The devices

| # | Lesson | The one fact | Numbers to remember | Figure |
|---|--------|--------------|---------------------|--------|
| 11 | Receptacles | The three holes are the three wires. The short slot is hot, the long slot is neutral, the round hole is ground. A 240 V receptacle has a different face so a 120 V plug cannot fit it. | **short** slot hot · **long** slot neutral · **round** ground · **a 240 face** will not take a 120 plug | `receptacle-faces` — The short slot is hot. The long slot is neutral. The round hole is ground. A 240 V face takes a different plug. |
| 12 | Switches and lights | A switch breaks the hot wire only, and the light hangs on the leg past it. Off at the switch leaves the box live on the line side. LED does the same light for a tenth of the watts. | **the hot** is the wire it breaks · **2** switches in a three-way · **line side live** with the switch off · **60 W** an old bulb, **9 W** the LED that matches it | `switch-and-light` — The hot runs to the switch, then up the switch leg to the light, and back on the neutral. The box stays live on the line side when the switch is off. |
| 13 | GFCI: what it catches and where it lives | A GFCI compares current out and current back. A difference means current went somewhere else, maybe through a person, and it trips in a blink. It lives wherever water and a person can meet. | **5 mA** the difference that trips it · **1/40 s** to trip · **no ground** needed · **6 ft** of a sink · **bathrooms, kitchens, garages, outdoors, basements, laundry** · **monthly** press Test | `gfci-compare` — The GFCI counts current out and current back. A difference means some went through you. It trips before the breaker knows. |
| 14 | AFCI: what it catches | An AFCI listens for the crackle of an arc, a loose wire or a nail through a cable, and trips before it starts a fire. It is not a GFCI and catches a different thing. | **arcs**, not shocks · **bedrooms and living areas** · **the breaker** is where it usually lives · **a nail** through a cable is what it is for | `afci-listens` — An AFCI listens for the arc of a loose wire or a nail through a cable. It trips before the fire. It is not a GFCI. |
| 15 | The water heater's circuit | An electric water heater is a 240 V load on its own two-pole breaker, with no neutral. Two elements take turns. The thermostat on each switches it. The company's rule: a plumber on the truck works on the whip, the elements, the thermostats and the high-limit reset, with the breaker off and the circuit tested dead first, and never on the panel, the breaker's wiring or anything upstream of the heater's disconnect. A gas heater has a cord too, the power-vent blower's, so no power can mean no hot water on a gas heater as well. | **240 V** · **30 A** two-pole breaker · **10 AWG** · **4,500 W** a common element · **2** elements, never both at once · **no neutral** · **the breaker off and tested dead** before the cover · **the disconnect** is where the plumber's side ends | `water-heater-circuit` — Two hots feed the heater on a two-pole breaker. The top thermostat runs first, then hands off to the bottom one. The plumber's side begins at the disconnect. |
| 16 | The disposal and the dishwasher | Two kitchen loads under one sink. The disposal runs on a switch; the dishwasher runs on its own circuit. Each has a cord or a direct wire, and a box under the sink that is live. | **20 A** a kitchen appliance circuit · **the wall switch** runs the disposal · **its own circuit** for the dishwasher · **live boxes** under the sink | `under-the-sink` — The disposal runs on a switched outlet. The dishwasher has its own circuit. Both boxes under the sink stay live with the switch off. |
| 17 | The sump and the well pump | A sump pump is a 120 V motor on a float switch and its own GFCI outlet. A well pump is often a 240 V motor on a pressure switch, with a control box. Both start on their own with nobody there. | **120 V** sump · **240 V** well, often · **a float** starts the sump · **a pressure switch** starts the well, **30 to 50 psi** · **starts by itself** | `pumps-start-alone` — The sump starts when the float lifts. The well starts when the pressure drops. Neither waits for a person. |
| 18 | Low voltage: a different world | Thermostats, doorbells, irrigation and a gas water heater's valve run on 24 V from a transformer. It will not hurt you. It still connects to a 120 V box somewhere, and that box can. The thermocouple on a standing-pilot heater makes its own tiny current and needs no wire from the house at all. | **24 V** the usual low voltage · **a transformer** makes it from 120 · **thermostat, doorbell, sprinkler, gas valve** · **the transformer's box** is 120 V · **the thermocouple** makes its own | `low-voltage-world` — A transformer turns 120 V into 24 V for the thermostat, the doorbell and the gas valve. The 24 V side is safe. The 120 V side of the transformer is not. |

### Part 3 · The two together, under conditions

Each of these is a strip of three or four frames. The last frame is always what you do, which is
a step back, a call, or the one thing a plumber may reset.

| # | Lesson | The one fact | Numbers to remember | Figure |
|---|--------|--------------|---------------------|--------|
| 19 | A tripped breaker | A breaker trips for a reason. Reset it once. If it trips again, something is wrong on that circuit and it is not yours to find. | **once** · **the middle** position means tripped · **off then on** to reset · **a second trip** means call | `tripped-breaker-strip` — The handle sits in the middle. Push it off, then on. If it trips again, stop and call. |
| 20 | A GFCI trip at a sink | A wet hand on a cord, a damp appliance or a worn tool leaks a little current. The GFCI sees it leave and trips. Press Reset once. If it will not hold, the leak is still there. | **Reset** once · **5 mA** was enough · **the downstream outlets** are dead too · **dry it** before anything | `gfci-trip-strip` — A damp cord leaks current. The GFCI sees it leave and trips. Dry the cord. Press Reset once. If it will not hold, call. |
| 21 | Water on a panel | Water in a panel or on a live box makes a path. A leak above a panel is an electrical emergency, not a plumbing one. Do not touch the panel. Shut the water off elsewhere. | **do not touch** · **the main shutoff** for the water, not the main breaker · **the utility** can kill the power at the meter · **the water heater pan** is why it has a drain | `water-on-panel-strip` — A leak drips onto the panel. The panel is live. Shut the water off at the main, not the power at the panel. Call. |
| 22 | A wet floor and a cord | A tool on a cord on a wet floor is the path waiting for a person. Through a wet hand, across the chest and out the feet is the path that kills, and the numbers are small. The GFCI is the only thing between the two. The numbers are the OSHA refresher's lesson 9, verbatim, and no new threshold is taught here. | **1 mA** a tingle · **5 mA** a slight shock, and the GFCI trips · **30 mA** locks your muscles so you cannot let go · **50 to 150 mA** stops breathing · **200 mA** can stop the heart · **15,000 mA** the breaker trips · **across the chest** is the path to fear | `wet-floor-strip` — A cord on a wet floor. The tool's frame goes live. The GFCI trips before the person is the path. Without one, the person is. Reuses `current-scale` from the refresher's lesson 9. |
| 23 | A cut in the bonded pipe | Lesson 8 as a strip, the day it goes wrong. A plumber cuts out a meter, a filter or a section of the metal water pipe. With the jumper in place the ground goes round the gap. With no jumper, a fault upstream has no way to earth, or finds one through the two pipe ends and the person holding them. | **the jumper** before the cut · **both ends** of the gap are the path without it · **plastic** in a metal run is the same gap, for good · **tell the electrician** before a metal to plastic change · **a temporary jumper** across the cut is the electrician's call, not the plumber's | `cut-pipe-strip` — The ground runs through the pipe. The jumper is on, and the cut is safe. The jumper is off, and the person holding both ends is the path. |
| 24 | A water heater with no power | No hot water is often an electrical fault: a tripped breaker, a tripped high-limit reset, a dead element, a thermostat. The company's rule: a plumber on the truck may reset the breaker once, and with the breaker off and the circuit tested dead may open the covers and work on the high-limit reset, the thermostats, the elements and the whip. The panel, the breaker's wiring and anything upstream of the heater's disconnect are the electrician's. | **the breaker** first, once · **off at the breaker and tested dead** before any cover comes off · **the high-limit button** behind the top cover, once · **the elements and the thermostats** are the plumber's, dead · **the disconnect** is where the plumber's side ends · **a second trip** means call | `water-heater-no-power-strip` — The breaker is on. The high-limit button has tripped. Breaker off, tested dead, cover off, press once. If it trips again, call. |
| 25 | A generator or a solar backfeed | A generator or a solar array can push power into a house that the utility has turned off, and out to the street. A wire the plumber thinks is dead can be live from the other end. | **a transfer switch** keeps it inside · **a backfeed** goes out to the lineman · **solar** makes power whenever the sun is up · **never assume dead** on a house with either | `backfeed-strip` — The utility is off. The generator or the solar array pushes power the other way. The wire that should be dead is live from the other end. |

### Part 4 · On the job

| # | Lesson | The one fact | Numbers to remember | Figure |
|---|--------|--------------|---------------------|--------|
| 26 | What is live and how to know | A wire is live until a tester says it is not. A non-contact tester beeps near a live hot. A switch off, a breaker off or a dark light proves nothing. | **every wire** is live until tested · **a non-contact tester** beeps on a hot · **test the tester** on a known live outlet first · **the lugs above the main** stay live | `test-before-touch` — The breaker is off. The tester still goes to the wire first. Test it on a known live outlet, test the wire, test the known outlet again. |
| 27 | Lockout and tagout as a plumber sees it | When a plumber's work needs a circuit off, the electrician or the owner opens the breaker, locks it, and tags it. The plumber checks the lock is on, tests the circuit dead, and never removes someone else's tag. | **the one who locks it** is the one who unlocks it · **a tag** says who and why · **test dead** after the lock · **never** cut another person's lock | `lockout-tag` — The breaker is off, locked and tagged with a name. The plumber tests the circuit dead. Only the name on the tag takes the lock off. |
| 28 | Where our work touches theirs | Five places a plumbing job meets a circuit: the water heater, the disposal and dishwasher, the sump and the well, the bonding jumper, and holes near wiring. Each has one rule. A cable sits set back in the stud, with a plate where it cannot, and a drill into it is a short, a fire or a shock. | **5** places · **the water heater** off at the breaker · **under the sink** the boxes stay live · **the pumps** start by themselves · **the jumper** stays · **1-1/4 in** from the stud's face is where cables sit, **a nail plate** where they cannot | `five-touch-points` — Five places a plumbing job meets a circuit. The water heater, the sink, the pumps, the jumper, and the holes you drill. The cable runs through the middle of the stud, and the hole goes where it is not. |
| 29 | What the inspector looks at | The electrical inspector reads the panel, the GFCI and AFCI protection, the bonding and the clearances. The plumbing inspector reads the water heater's bonding and the pan. A plumber's job can fail an electrical inspection by one missing jumper. | **the jumper** around the meter · **a 240 V disconnect** within sight of the water heater in some cities · **36 in** clear in front of a panel · **the pan and its drain** | `inspector-electrical` — The inspector reads the jumper, the disconnect, the clearance in front of the panel and the GFCI faces. One missing jumper fails the job. |
| 30 | The field mistakes a plumber makes near electrical | Five mistakes, each drawn beside the right way: a jumper left off, a metal to plastic change with no word to the electrician, a tool on a wet floor with no GFCI, a cover off with the breaker on, a drilled cable. | **the jumper** · **the plastic section** · **the GFCI** · **the breaker** before the cover · **the cable** behind the drywall | `plumber-mistakes` — A jumper left off, a plastic section, a cord with no GFCI, a cover off live, a drilled cable. Each beside the right way. |

**The final check**: twenty questions drawn one part at a time, as the parser already draws
them, fourteen right to pass, retake allowed. The bank holds at least twenty questions of its
own, checked by the reader, with no question that asks how to do electrical work.

**`course.md`**: `title: Intro to electrical`, `line: An introduction, not a licence. Nothing here
lets anyone do electrical work. Read by: (the reader's name and the code cycle go here)` until the
owner names the reader, then their name and the cycle in its place, `final_draw: 20`, `final_pass: 14`,
`lessons: 30`, `minutes: 165`, and `## Parts` as `0. Start here`, `1. Power in`,
`2. The devices`, `3. The two together`, `4. On the job`.

## PRs, in order

PR #5827 (`plumbingParts.tsx`, `plumbingTokens.ts` and eleven names in `FIGURE_NAMES`) and PR
#5828 (Water out, eight more names) merged on 2026-10-18 before PR 0 was cut; #5830 and #5831 add
their names behind it, and each part PR rebases over whatever has landed.

0. **Three drawn lessons as the proof, inside a whole part** (v2.5614). The course folder with
   Start here and all of Part 1, lessons 1 to 10, because the content test holds a course to ten
   lessons and sixty minutes. Three of the ten are drawn, lessons 1, 6 and 8 (the loop, the
   neutral and the ground, the jumper); the other seven are words with their figure lines held
   back. `electricalParts.tsx` and `electricalTokens.ts`, the three figures, a bank of twenty
   questions over the ten lessons, `lessons: 10`, `minutes: 65`. The seed row off, offered and
   required of nobody, in a migration numbered from `origin/main`'s newest. The content test's
   no-instruction rule for this course (call 6). The guide `take-a-training-course` gains nothing,
   since the Available row is already in it. `docs/twins/APP_DIRECTORY.md` gains the course's
   path. Every `from:` cites the published page or the owner until the reader is named. Shots of
   the three drawings at 375, 768 and 1280 px in both themes, read before the merge.
1. **Part 1, power in, drawn** (v2.5615): the seven figures held back from lessons 2 to 10, shot at
   the three widths in both themes; the reader's corrections to the words ride a later PR.
2. **Part 2, the devices** (v2.5616): lessons 11 to 18 and their eight figures.
3. **Part 3, the conditions**: lessons 19 to 25, the seven strips, `current-scale` reused by name.
4. **Part 4, on the job**: lessons 26 to 30, the five figures, the bank filled from every part,
   `lessons: 30` and `minutes: 165`, the glossary's Training line naming three courses.
5. **The reader's read-through** of the live course as a dev preview, every correction as one
   commit with the `from:` line naming it, the reader's name on `course.md`'s `line`, then **On**
   in Settings → Training.

Each part PR is cut from fresh main, carries a release note and a fragment, runs `npm run build`
before the merge, and is walked as the sample helper on a 375 px phone in both themes. The
reader's corrections ride each PR as commits.

## Is this the best we can do?

What the first cuts had, and what the one drawn keeps:

- **A safety course.** The OSHA refresher already has two electrical lessons, and a third safety
  course would repeat them. The cut drawn teaches the system the safety rules assume, the loop,
  the panel, the two protections, and sends the reader to the refresher for the numbers it
  already holds.
- **A wiring course.** The first draft explained how a receptacle is wired. A crew member who
  reads that will do it. Every lesson now ends at what it does, how you know it is live, what you
  do not touch and who you call, and the content test can hold a rule for it: no lesson's Must
  know item starts with an imperative that lands a wire (call 6 asks whether to write that test).
- **A course by device** (a breaker lesson, a receptacle lesson, a switch lesson) taught parts and
  not the loop. The cut drawn goes the way the current goes, in at the drop and out at the load,
  and meets each device where the current does, the same shape as the plumbing course.
- **Folding it into the plumbing course** as a fifth part. Six lessons cannot carry the neutral
  and the ground, the two protections and the bonding jumper, and the plumbing course would lose
  its one subject. A course of its own, with a reader of its own.
- **No reader, the owner's word.** The owner is a master plumber and would catch most of it. A
  crew member hurt on the word of a lesson the company could not vouch for is the one outcome
  this plan refuses, so the reader is the gate and the `from:` line says so.
- **Photos of panels and devices.** A photo of a panel is a grey box. A drawing shows the bus bars,
  the main and the lugs above it in three tints, follows the dark theme and weighs nothing.

Not drawn, on purpose: a figure inside a check question (#116's open call 3), the Spanish copy
(the one Spanish switch, after the English course has been through a crew), and gas (call 4).

## Owner's calls (decided 2026-10-18)

1. **Who reads it.** Both: a published source for every number and a licensed reader for the
   result, whose name and the code cycle go on the course's first page. Until the owner names the
   reader, `course.md`'s `line` carries *Read by: (the reader's name and the code cycle go here)*
   and every `from:` cites the published page or the owner.
2. **Who must take it.** Offered to every role and required of nobody for the first version. The
   owner flips helpers to required after the reader signs off.
3. **The office.** Offered.
4. **Gas and low voltage.** Low voltage is one lesson here (18) and gas is its own course later.
   The gas heater's controls lesson of the first draft folds into lessons 15 and 18, so the jumper
   lesson's move into Part 1 keeps the course at thirty.
5. **Brands.** None. The common ratings only, so the course is true on any job.
6. **A test that no lesson instructs.** Yes: the content test gains a rule for this course alone,
   that no Must know or Traps item begins with a verb from a short list (connect, land, wire,
   splice, install, replace, remove the cover) unless the sentence names who does it.
7. **The code the numbers cite.** The reader names the cycle. Where cycles differ (the water
   heater's disconnect, the AFCI rooms, the GFCI rooms) the lessons say *the company's rule*.

## How to verify (once built)

- The content test holds the lessons and the bank to the shape, the plain words, the figure names
  both ways and, if call 6 is yes, the no-instruction rule; `npm run build` passes with the course
  in the lazy chunk and the Dashboard's chunk unchanged.
- A controller, who needs no course, sees the Training card with the course under Available;
  **Start** opens it; passing a lesson turns the press to **Continue**.
- A helper sees the course in red beside the other two; passing the final check writes one
  `training_passes` row and the row turns green with its due day.
- Every `from:` line names the reader's correction, a page of the published source or the owner,
  and the course's `line` names the reader once the owner has.
- No Must know or Traps item in the course begins with connect, land, wire, splice, install,
  replace or remove the cover without naming who does it (`courseContent.test.ts`).
- Every drawing read at 375, 768 and 1280 px in light and dark, with no sideways scroll and the
  caption under it; VoiceOver reads the caption. Where a drawing has a pipe and a conductor, the
  two read apart at 375 px with no label.
