---
name: "Training: courses the crew takes at their own pace, with a clock on each"
number: 111
group: close
status: BUILT and LIVE 2026-10-16 — the six PRs (#5758, #5757, #5761, #5762, #5763, #5764), the types regen #5759 and the test fix #5768 merged; migration 20261015060000 on prod (drift 925/925), dev-mcp redeployed; walked live as the dev on prod data (the course page previews while off, lesson 19 recorded a pass, the Settings tab flips the policy, the Dashboard card read red with Continue and the People rail read the need while the course was on for devs, then the policy was put back: off, required for the five field roles); left: the owner or a dev presses On in Settings → Training, then the crew walk
summary: >
  A Training section at the bottom of the Dashboard, under My Time, where each person sees the
  courses their role must take, in one of three states: not done (red), done but lapsed or
  about to (amber), caught up (green). A course is a page of short lessons, each ending in a
  check the person must get right, and a final check. A dev manages each course's policy in
  Settings → Training: who must take it, how long a pass is good for, and a press that makes
  everyone take it again. The People rail and the Users row carry a training chip beside the
  paperwork ones. The first course is the OSHA 30 refresher, 30 lessons plus a final check,
  built from the owner's capture of the ClickSafety course.
next: Press On in Settings → Training (the one press left; it puts the red card in front of every helper, sub, primary, master and superintendent at once), watch the first crew member through a lesson, then use it for a week and answer the seven calls at the mock-up's foot; delete this folder once nothing comes up.
size: L (six PRs, each S or M; the lesson rewrite into plain words is the biggest single piece)
blocker: none; the seven calls are built to the drawn leans and each is one constant or one Settings number.
opinion: build it as drawn; the Dashboard section and the course page are the feature, the rest is wiring the three states into places that already show paperwork state.
mockup: to-dos/training/mockup.html
---

# Training: courses the crew takes at their own pace

## The ask

Grace, 2026-10-15, with the OSHA 30 capture on her Desktop (`osha30-refresher.md`, 21,000 words
drawn from every lesson, knowledge check and quiz of the ClickSafety OSHA 30-Hour Construction
course, which the owner finished 2026-10-15 at 100% on every quiz and the final exam):

> I wanted to build my own mini refresher for the app. I wanted to offer it on a new dashboard
> section at the bottom below My Time called "Training" where users could complete training at
> their own pace. I see training as separate courses, managed by a dev in settings, that have a
> "currency" window where once a user takes the course a clock starts ticking before they need
> to take it again. Just like the People page shows a user's documents are not up to date, show
> that they have training outstanding (red), lapsed (yellow), all caught up (green). The
> streamlined OSHA 30 course is a great first course. Think about this holistically, come up with
> a course, make mock-ups, then ask yourself: is this the best we can do? Show me that one.

## The whole thing, in one read

**What a person sees.** At the bottom of the Dashboard, under My Time, a **Training** card. It
opens with one line in one colour: *1 course to do* (red), *1 course to take again* (amber), or
*You are caught up* (green). Under it, one row per course the person's role must take: the
course's name, where they stand (*not started*, *12 of 31 lessons*, *done Mar 3, due again Mar 3,
2027*), and one press (**Start**, **Continue**, **Take it again**, **Read it again**). A caught-up
card is one line, never a nag. A lapsed course never blocks anything, not the clock, not a job.
It shows, and the office can see it.

**What a course is.** A page of its own at `/training/<slug>`, so a two-hour read works on a
phone in the truck and resumes where it stopped. A rail lists the parts and their lessons with
a tick on each one done. A lesson is five minutes: *Why it matters* in one line, *Must know* as
short plain sentences with the numbers in bold, two or three *Traps* the real quizzes set, a
*Numbers to remember* strip, and *Check yourself*: four questions, one right answer each, in the
course's own wording. A wrong pick says why in one line and offers **Try again** with the options
reshuffled. The lesson is done when all four are right. Lessons open in any order. The
**Final check** (20 questions drawn from every part, 14 right passes, retake allowed) opens once
every lesson is done, and passing it is the course's pass. The pass is a record: who, which
course, which content version, the day, the score.

**What the clock is.** Each course carries a policy: who must take it (by kind: helpers, subs,
primaries, masters, superintendents, the office) and how long a pass is good for (months). A
person's state on a course is read, never stored: no pass and required is **red**; a pass older
than the window, or within 30 days of it, is **amber**; otherwise **green**. One kernel decides
it (`trainingState`), and the Dashboard card, the People rail, the Users row and the Settings
counts all read that one kernel, the way `attributeJobPayments` is the one reader of owed money.

**Where the office sees it.** The People rail dot and the Users row's needs already turn amber
or red for expiring papers and licenses (`deskRailAttention.ts`, `rowNeeds.ts`). Training joins
as a fourth subject beside Hours, Paperwork and Account: a red *training due* chip, an amber
*training lapsed* chip, with the course named in the fold-out and the door opening the person's
Desk at a Training line. Settings → Training (dev) shows each course with its counts: *14
current · 3 lapsed · 5 not done* and a *See who* link.

**What a dev manages.** Settings → Training lists every course the app ships, each with: **On**,
*Required for* role chips, *Good for N months*, the counts, **Preview the course**, and
**Everyone takes it again…**, which stamps a date before which no pass counts (a changed law, a
near miss, a new year). The lessons themselves live in the repo like help guides, one markdown
file per lesson under `src/content/training/<course>/`, so CI holds them to plain words and
dead-link checks, a course is versioned with the app, and a dev adds a course by adding files.
Settings holds the policy; the repo holds the words. (Considered and dropped: lessons edited in
Settings and stored in a table. It loses CI, versioning and the help-guide renderer, and nobody
but a dev writes a lesson anyway.)

**What it is not.** It is not an OSHA card. The course's first page says so: the card comes from
the real 30-hour course; this is the refresher that keeps it fresh. It records nothing anyone
could mistake for a certification. Outside credentials (the real OSHA 30 card, a license) keep
living on People → Licenses with their expiry.

### Design decisions taken (reversible, each one line)

- A Dashboard **section**, not a nav page: the person meets it where they clock in; the office
  reads the roll-up on People and Settings. No header item.
- The course is a **page**, not a window: a two-hour read on a phone wants a URL, scrolling and
  a resume, and a lazy chunk (the lesson text must never ride in the main chunk, v2.4695's
  6 MiB lesson).
- **Three states, not five.** *Due soon* folds into amber with its day shown, so the colours mean
  the same thing on the Dashboard, the rail and the row. *Started* is red with a progress bar.
- **Checks per lesson, one final check, no module quizzes.** Four questions a lesson is the
  refresher's own shape and keeps a lesson to five minutes; the final check is the pass.
- **Every check right to finish a lesson**, with retries and reshuffles, instead of a score.
  A refresher is for knowing, not grading; the final check carries the grade.
- **State is read, never stored.** A pass row and a policy row make the colour; a dev changing
  the window recolours everyone at once with no migration of state.
- **The pass records the content version.** Changing a lesson's words never voids a pass;
  **Everyone takes it again…** is the one press that does, on purpose.
- **Nothing blocks.** A lapsed course nags the person and shows the office. The owner may later
  tie it to the clock; that is one gate, not this build.
- **Plain words.** A lesson is read by a first-timer, so the words follow `plainWords.ts` like a
  guide: one idea a sentence, none over 20 words, the control's exact name. The refresher's text
  is rewritten lesson by lesson, numbers kept exact, and `src/lib/training/courseContent.test.ts`
  holds every lesson to it with no exemption list.
- **Questions avoid Appendix B.** The refresher lists where the course's own key contradicts its
  lessons; no check question is built on one of those.

### What "training" already means in the app

`users.read_only` is the **read-only (training) mode** a new hire starts in (*Start in training
mode* on + Hire, the Account lens, `GLOSSARY.md` → Read-only (training) mode). The two will sit
on the same People screens. The section and the Settings tab are called **Training**; the
read-only flag keeps its words for now. Owner's call 5 below asks whether the flag should become
*practice mode* so the word *training* means one thing.

## The first course: OSHA 30 refresher

Built from `osha30-refresher.md`: Unit 0 and 34 units in eight parts, the capstone case, the
final-exam bank, Appendix A's numbers and Appendix B's quirks. Streamlined for a plumbing and
electrical contractor: the units a crew meets every week stay whole (the Focus Four, trenches,
confined spaces, ladders, PPE, respirators and silica, hot work, electrical), the units met only
on another trade's site are folded together (cranes, concrete, steel; vehicles and forklifts).
Thirty lessons of about five minutes, plus the final check: roughly two and a half hours, taken
over as many sittings as the person likes.

| Part | # | Lesson | From | Minutes |
|---|---|---|---|---|
| Start here | 1 | How safety works on a site | Unit 0.1–0.4 | 6 |
| Start here | 2 | Every day on the job | Unit 0.5–0.11 | 6 |
| 1 Foundations | 3 | OSHA and your rights | Unit 1 | 5 |
| 1 Foundations | 4 | Safety programs and leading a crew | Units 2, 3 | 6 |
| 1 Foundations | 5 | Finding and fixing hazards | Unit 4 | 5 |
| 1 Foundations | 6 | Mental health on the crew | Unit 5 | 4 |
| 2 The Focus Four | 7 | Falls: the hazard | Unit 6 | 5 |
| 2 The Focus Four | 8 | Falls: the gear | Unit 7 | 6 |
| 2 The Focus Four | 9 | Electrocution | Unit 8 | 6 |
| 2 The Focus Four | 10 | Caught in or between | Unit 9 | 5 |
| 2 The Focus Four | 11 | Struck by | Unit 10 | 5 |
| 3 PPE and health | 12 | PPE | Unit 11 | 5 |
| 3 PPE and health | 13 | Respirators | Unit 12 | 6 |
| 3 PPE and health | 14 | Chemicals, HazCom and biological hazards | Unit 13 | 5 |
| 3 PPE and health | 15 | Noise, heat and cold | Unit 14 | 5 |
| 3 PPE and health | 16 | Silica and asbestos | Units 15, 16 | 6 |
| 4 Ladders, scaffolds, trenches | 17 | Ladders and stairs | Unit 17 | 5 |
| 4 Ladders, scaffolds, trenches | 18 | Scaffolds | Unit 18 | 5 |
| 4 Ladders, scaffolds, trenches | 19 | Trenches: soil and protection | Unit 19 | 6 |
| 4 Ladders, scaffolds, trenches | 20 | Trenches: getting out, air, water and rescue | Unit 20 | 6 |
| 5 Materials and other trades | 21 | Lifting, handling and storing materials | Unit 22 | 5 |
| 5 Materials and other trades | 22 | Cranes, concrete and steel on someone else's site | Units 21, 23, 24 | 6 |
| 6 Tools and vehicles | 23 | Hand and power tools | Unit 25 | 5 |
| 6 Tools and vehicles | 24 | Vehicles and forklifts | Units 26, 27 | 5 |
| 7 Special hazards | 25 | Fire, hot work and torches | Units 28, 29 | 6 |
| 7 Special hazards | 26 | Confined spaces | Unit 30 | 6 |
| 7 Special hazards | 27 | Ergonomics | Unit 31 | 4 |
| 7 Special hazards | 28 | Electrical safety and NFPA 70E | Unit 32 | 6 |
| 8 People and culture | 29 | Correcting unsafe behavior and leading the culture | Units 33, 34 | 5 |
| 8 People and culture | 30 | The capstone case: the excavator | Module 37 | 5 |
| Final check | — | 20 questions from every part, 14 right passes | Final bank + the checks | 15 |

Each lesson's shape, held by the content test: `title`, `part`, `minutes`, a `## Why it matters`
of one or two sentences, `## Must know` of five to nine sentences, `## Traps` of two or three,
`## Numbers` as chips, and `## Check yourself` with exactly four questions of four options and
one right answer, each with a one-line *why* for the wrong picks. The questions use the course's
wording from the refresher's *Check yourself* lists and the final-exam bank; the wrong options
come from the captured course notes (`osha30-course-notes.md` holds every quiz's full option
list), never invented. The mock-up draws lesson 19 whole, in plain words, as the sample.

## The data

- **`training_courses`** (the policy, one row per course the app ships; the slug ties it to the
  content folder): `slug`, `title`, `on`, `required_kinds text[]`, `good_for_months`,
  `due_soon_days` (default 30), `retake_from date` (the *Everyone takes it again* stamp, null
  until pressed), `content_version` (stamped by the build), `updated_by`. Dev writes; everyone
  signed in reads. Seeded by a migration for `osha-30-refresher` with `on = false` so nothing
  shows until a dev turns it on.
- **`training_lesson_passes`**: `user_id`, `course_slug`, `lesson_key`, `passed_at`, `tries`.
  One row per lesson per person, upserted by `training_pass_lesson(slug, lesson_key, tries)`
  (SECURITY INVOKER, own row only). Resumes the rail's ticks.
- **`training_passes`**: `user_id`, `course_slug`, `content_version`, `passed_at`, `score`,
  `questions`. Written by `training_finish_course(slug, answers jsonb)`, which grades the final
  check server side from the content's answer key (the key is in the repo bundle, so the
  function takes the key's hash and the picks, and the client never sends "right"). One row per
  pass; the newest decides the state.
- **`training_state`** is a kernel, not a table: `(policy, passes, today) → red | amber | green`
  with the day it turns, the same function on the client (`src/lib/training/trainingState.ts`)
  and in SQL (`training_state_for(user_id)` for the People rail and the Settings counts).
- RLS: own rows for passes; the office roles (dev, master, assistant, controller) read every
  pass; `training_courses` dev-write. New tables end with the three fence appliers; twins are
  fenced from writing a pass. Every new table gets its door line in `ACCESS_CONTROL.md`.
- Content: `src/content/training/osha-30-refresher/course.md` (frontmatter: title, summary,
  parts, minutes, the *not a card* line) and `NN-<slug>.md` per lesson, loaded by a `glob` like
  the guides and rendered by `helpGuideHtml.ts` with the same tokens. The bundle is a lazy
  chunk behind the `/training` route and the Dashboard card reads only the catalog (titles,
  counts), never the lessons.

## PRs, in order

0. **This to-do** (the mock-up, the plan). Owner's look.
1. **Content and kernel.** The 30 lessons and the final bank rewritten into plain words under
   `src/content/training/osha-30-refresher/`; `src/lib/training/courseContent.ts` (parse,
   registry, lesson order, the answer key, its hash); `courseContent.test.ts` (shape, four
   questions a lesson, one right answer, plain words, no Appendix B question); `trainingState.ts`
   with its tests. No screen. The biggest PR by words; cut it into content batches if the
   queue wants it.
2. **The tables.** Migration (`lock_timeout`, the three tables, the two RPCs, `training_state_for`,
   the fences), its SQL bed in `scripts/sql-beds.txt`, `docs/migrations/<version>_training.md`,
   the seed row for `osha-30-refresher` switched off. Push before PR 3 merges; the client reads
   `training_courses` and fails soft on `42P01` until then.
3. **The course page** `/training/<slug>`: the rail, the lesson, the check, the final check, the
   resume, the phone layout (rail as a sheet). `pageGate` on the route. Guide *take a training
   course* (Field Work). `docs/twins/APP_DIRECTORY.md` row.
4. **The Dashboard card**: `DashboardTrainingSection` under My Time (dock id `dash-training`,
   label *Training*), the three states, hidden entirely when no course is on or none is required
   for the role.
5. **The office side**: `loadRailFacts` reads `training_state_for`, `deskRailAttention` and
   `rowNeeds` gain the *training* subject and door, a Training line on the Person Desk, and the
   Users tab fold-out names the course and the day.
6. **Settings → Training** (dev): the course list, the policy editor, the counts with *See who*,
   **Preview the course**, **Everyone takes it again…** (a confirm that names the count it
   voids). `PROJECT_DOCUMENTATION.md` Settings section, `GLOSSARY.md` *Training · course · pass*.

Later, each its own card: a Spanish copy of a course (`PORTAL_SPANISH_ON` is the one Spanish
switch); a *training due* line in the weekly digest; a CSV of passes for an insurer or a GC's
prequalification; more courses (a trench tailgate, lockout/tagout, confined-space entry, each
20 minutes); tying a lapsed course to the clock if the owner wants it.

## Is this the best we can do?

What the first cuts had, and what the one drawn keeps:

- **A list of courses in a table** on the Dashboard read like paperwork. The cut drawn leads
  with the verdict line in the state's colour and keeps one row per course with one press, so a
  caught-up crew member reads one green line and moves on.
- **A Training page in the header** put a two-hour read beside Jobs and Bids for everyone,
  including people with nothing due. The cut drawn opens the course from the card and from the
  rail; the URL exists for the phone and the resume, not the nav.
- **A modal player** matched the app's windows but fought a long read on a phone and lost its
  place on a backdrop press. The page keeps its place.
- **Five states** (not started, started, due soon, lapsed, current) said more and meant less
  across three surfaces. Three colours, with the day in words, say the same thing everywhere.
- **Module quizzes plus lesson checks** doubled the asking. Four checks a lesson and one final
  check keep a lesson to five minutes and give the pass one place.
- **Lessons edited in Settings** gave a dev a text box and took away CI. The policy stays in
  Settings; the words stay in the repo.
- **Counting a read-through as done** made the record worthless to an insurer. Every check right
  and a graded final check make the pass mean the person knew it that day.

Not drawn, on purpose: the Person Desk's Training line (it is the rail's reason, one line) and
the preview in Settings (it is the course page). Both are in the PR list.

## Owner's calls (at the mock-up's foot too)

1. **Who must take the OSHA 30 refresher.** Drawn: helpers, subcontractors, primaries, masters
   and superintendents; the office optional. Subs are another employer's workers, so *required*
   for them is a company rule, not OSHA's.
2. **The clock.** Drawn: good for 12 months, amber from 30 days before the day. Six months is
   one number away.
3. **The pass rule.** Drawn: every lesson check right (retries allowed) and 14 of 20 on the
   final check, the real exam's bar. Or a read-through with the final check alone.
4. **The record.** Is *who, course, version, day, score* enough for the insurer and a GC's
   prequalification, or should it export as a CSV from day one.
5. **The word *training*.** The read-only account flag is called *training mode* on + Hire and
   the Account lens. Rename it *practice mode* so *Training* means courses, or leave both.
6. **Spanish.** A Spanish copy of the course is a second content folder and the one Spanish
   switch. Now, or after the English course has been through a crew.
7. **Blocking.** Drawn: a lapsed course never blocks the clock or a job. Keep it that way, or
   tie it to the clock after a grace period.

## How to verify (once built)

- A helper with no pass sees the red card; passing lesson 19 ticks it in the rail and the card
  reads *1 of 31 lessons*; passing the final check writes one `training_passes` row and the card
  turns green with the day it is due again.
- Setting `good_for_months` to 0 in Settings turns the same person amber everywhere at once: the
  card, the rail, the Users row, the Settings count.
- **Everyone takes it again…** stamped today turns every green person red, and the count in
  Settings says so before the confirm.
- A twin or a View-as sample cannot write a pass (the fence refuses it with the house words).
- `npm run typecheck`, the content test (plain words, four questions a lesson, no Appendix B
  question), the SQL bed, the render smokes for the card, the page and the Settings tab.
