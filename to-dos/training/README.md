---
name: "Training: courses the crew takes at their own pace, with a clock on each"
number: 111
flagged: true
group: ready
status: BUILT and LIVE 2026-10-16; the fourteen-year-old's read over the OSHA refresher, every OSHA word met first where it is explained by adding words only, is v2.5624 (2026-10-18) — the six PRs (#5758, #5757, #5761, #5762, #5763, #5764), the types regen #5759 and the test fix #5768 merged; migration 20261015060000 on prod (drift 925/925), dev-mcp redeployed; walked live as the dev on prod data (the course page previews while off, lesson 19 recorded a pass, the Settings tab flips the policy, the Dashboard card read red with Continue and the People rail read the need while the course was on for devs, then the policy was put back: off, required for the five field roles); left: the owner or a dev presses On in Settings → Training, then the crew walk · 2026-11-08 the On, View as, Off proof of the switch is briefed for a session on another computer (§ Pick up), nothing pressed from this machine · 2026-11-08 (later) the pick-up ran from this computer: the course read lesson by lesson with 34 doubted facts under § Read-through and no fix PR, and the dev seat read all three courses already On since 2026-10-18 (a dev's press), so nothing was pressed and the proof became a read of the live state, the helper's red card and lesson 1 shot through View as on the dev server (§ Where it stands)
summary: >
  A Training section at the bottom of the Dashboard, under My Time, where each person sees the
  courses their role must take, in one of three states: not done (red), done but lapsed or
  about to (amber), caught up (green). A course is a page of short lessons, each ending in a
  check the person must get right, and a final check. A dev manages each course's policy in
  Settings → Training: who must take it, how long a pass is good for, and a press that makes
  everyone take it again. The People rail and the Users row carry a training chip beside the
  paperwork ones. The first course is the OSHA 30 refresher, 30 lessons plus a final check,
  built from the owner's capture of the ClickSafety course.
next: The owner reads § Read-through and decides each of the 34 rows, the three ★ first; the switch already stands On for all three courses (a dev's press, 2026-10-18), so the only press left is his, Off if the course is not meant to be live before his correction pass, otherwise none; then the first crew member through a lesson, a week of use and the seven calls at the mock-up's foot; delete this folder once nothing comes up.
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

7. **The fourteen-year-old's read** (v2.5624, after Intro to plumbing's v2.5621). OSHA's own
   words go on the trade-word rule's list for this course alone (`COURSE_TRADE_TERMS` in
   `src/lib/training/tradeTerms.ts`, seventy-seven words), and the seventeen met first in a quiz,
   a Traps line, a Numbers label or a caption each get one defining clause where the lesson
   teaches, or the sentence that teaches them moves above the first use (the GFCI in lesson 9).
   Nothing is removed: no fact, number, question, option or figure line changes, and every
   `from:` line stands. `src/lib/training/questionTaught.ts` holds every Check yourself and
   final-bank question to words a teaching sentence carries. The load the owner may want to
   look at is listed in `docs/recent-features/v2.5624.md`, not changed.

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

## Follow-ups from the walkthrough (2026-10-16)

The headless walk as the dev on prod data (the policy flipped to devs and put back) found nine
small things, drawn as one spot each with the critique in `to-dos/training/followups.html` and
shipped in three PRs (the page and the card #5775; the questions #5778; the office polish #5780),
then walked live again the same day (every spot confirmed; the touch rule needed `!important`
over the inline sizes, the fourth PR):

1. **The card says the size** before the first press (*30 lessons of about five minutes · about
   3 hours in all*, from `course.md`'s `minutes:`), and *N of 30 lessons done* once started.
2. **Lessons and the final check counted apart** on the page: *N of 30 lessons* and a green
   *Final check passed* chip, not *N of 31*.
3. **No red chip until there is a pass to date**; the lesson count already says it.
4. **A pass says the day** it is due again and offers *Back to the Dashboard* beside *Read a
   lesson again*.
5. **The question is a heading inside its box**, not a legend on the border.
6. **44 px on touch** for every answer row, lesson row and press.
7. **Seven lesson checks reworded** so the wrong options no longer give the answer away, with
   questions from the owner's unused pool; the final bank loses the asks a lesson already asks,
   and a draw never repeats an ask.
8. **Settings → Training previews the course** with one link, and the retake day is a chip with
   a *Clear*.
9. **The Users row's training cap** matches the rail's lead.

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

## Pick up (2026-11-08)

The owner asked, 2026-11-08, that the switch be proved from a session on another computer, so this
section is the whole brief. It runs after #119's read (`to-dos/intro-plumbing/README.md` § Pick up),
and it proves the switch in its reversible shape: On for minutes, then Off, with the final On left
to the owner. Nothing was pressed from the session that wrote it.

**The rules, from the owner.** Work in his Chrome on that computer, signed in as the owner, through
Claude in Chrome: open your own tab, work only in it, never close, select or act in another tab,
and keep every click inside clicktooling.com. Other sessions may share that Chrome: a View as there
swaps the whole browser's session for minutes, and a window resize moves every coordinate, so prefer
element refs over coordinates and hold a write while the tab reads as someone else. Open Settings →
Release notes first and confirm the top entry is v2.6691 or later; an older one is the stale
service-worker bundle, so reload until it is current. Every step on a test account or reversible.
The repo is public: no customer or private name in anything committed.

**What the switch does, and why it is minutes.** The policy is the company's, not a sample's: the
moment a course is On, every real person of a required role who opens the Dashboard in that window
sees the red card. Intro to plumbing is required of helpers alone and offered to everyone else
(#119, owner's call 1 as drawn), so it is the course to press, and the window is kept under ten
minutes, in an hour the crew is off the app. The OSHA refresher's switch stays as it is.

**The steps, each shot to the session's scratchpad.**

1. As the owner, open Settings → Training (`/settings?tab=settings-training`). Note every course's
   switch and its Required for chips as they stand, so the end matches the start. Shot
   `111-settings-before`.
2. Press **On** on Intro to plumbing. The row's counts line turns live. Shot `111-settings-on`.
3. Open the View as door, the Settings rail's chip **View as…** (`/settings#view-as`,
   `docs/ACCESS_CONTROL.md` → Sample accounts), and pick the helper's sample under Roles. Open the
   Dashboard. Under My Time the Training card reads red, *1 course to do*, with the Intro to
   plumbing row, its size line and **Start**. Shot `111-helper-card-on`. A View as swaps the whole
   browser's session, so every other tab in that Chrome reads as the helper until Exit: move
   through steps 3 to 5 without a pause.
4. Press **Start**. The course page `/training/intro-to-plumbing` opens with its rail; open lesson 1
   and answer its four Check yourself questions. Shot `111-helper-lesson-1`. The mark may land or be
   refused: the fence holds a View as sample off `training_lesson_passes` (§ How to verify), so a
   refusal in the house words is the fence working, not a defect, and the rail's tick and the
   card's *1 of 30 lessons* then stay for the owner's first real helper. Record which it was. If the
   mark lands, it lands on the sample account and nobody's record.
5. **Exit** View as. As the owner, back in Settings → Training, press **Off** on Intro to plumbing.
   Shot `111-settings-off`. Then View as the helper's sample again, open the Dashboard and confirm
   the Training card draws no Intro to plumbing row (with the refresher off too, the card itself is
   gone). Shot `111-helper-card-off`. Exit View as. Settings → Training must read as shot 1 did.

**Checked off 2026-11-08, from this computer, on the dev server as the dev.** The steps were written
for a switch that stood off. It did not: the dev seat's read of `training_courses` (read only) found all
three courses `enabled` since 2026-10-18 16:04Z, set by a dev account, so no press was made and the Off
half of the proof was not run. What each step read instead:

1. Settings → Training as the dev: Intro to electrical **On**, required for devs; Intro to plumbing
   **On**, required for devs and helpers, good for 120 months; OSHA 30 refresher **On**, required for
   masters, subcontractors, helpers, primaries and superintendents, good for 12 months, *0 current ·
   0 lapsed · 30 not done*. Shots `111-settings-before` and `111-settings-before-refresher`.
2. Not pressed. On stood already, and Off would have hidden a live course from the crew.
3. View as → Sample helper → Dashboard: the Training card under My Schedule reads red, *2 courses to
   do*, Intro to plumbing and the OSHA 30 refresher each with its size line and **Start**, Intro to
   electrical under *Available*. Shot `111-helper-card-on`.
4. **Start** on Intro to plumbing opened `/training/intro-to-plumbing` with its rail at *0 of 30
   lessons*; lesson 1's four checks answered right read *All four right. This lesson is done.* and the
   rail *1 of 30 lessons*. The mark **landed**: one `training_lesson_passes` row on the Sample helper
   account (`is_sample`), lesson `01-two-systems-one-house`, one try. Nobody's record. Shot
   `111-helper-lesson-1`.
5. **Exit** returned the dev to Settings → Training, which read as step 1 did. No Off, so no
   `111-settings-off` or `111-helper-card-off`.

The shots sit in the session's scratchpad and in this group's shared notes folder outside the repo.

**Done looks like.** A dated line per step under § Where it stands naming its shot and what it
read, with any defect in one line; the `status` and `next` lines amended, `next` saying the switch
is proved both ways and the owner's own press to On, after his correction pass of #119, stays his;
the card shipped in the same docs-only PR as #119's read (`gh pr create`, `gh pr merge --auto`; no
version claim; `npm run check:todos` green), the one press on Auto-fix in the PR bar named in the
wrap-up for the owner; the session card in the main checkout's `.claude/sessions/active/` removed
when done. The report to the owner names the shots and whether the lesson mark landed or was
refused.

## Read-through 2026-11-08

Thirty-four doubted facts, read lesson by lesson on 2026-11-08 from the words in
`src/content/training/osha-30-refresher/` and the labels of their drawings, with the real standard's
number where I know it. Doubt is the bar, not certainty: the owner's correction pass and a safety
professional decide, and nothing here was changed. No typo and no plain-words break was found; the
content test (300 cases) and the figures test are green on the words as they stand, so there is no
fix PR. The three fixes most worth a look are marked ★: lessons 8 and 22 disagree on whether a net
prevents a fall, the final bank's table-saw question explains itself with silica where lesson 16 says
wood has none, and lesson 28's Trap teaches that a rubber-coated tool is insulated.

| Lesson | The sentence as it stands | Why I doubt it |
|---|---|---|
| 1 How safety works on a site | *A signal person is certified* | 1926.1428 asks for a *qualified* signal person, evaluated by the employer or a third party; certified is the crane operator's word |
| 2 Every day on the job | *a trench air permit for one day* | OSHA has no permit by that name; 1926.651(g) asks for atmospheric testing where a hazardous atmosphere could exist, and the record is the test |
| 2 Every day on the job | *use hand tools within 3 ft of a flag* | the hand-dig zone is state law; Texas Utilities Code ch. 251 sets it at 18 in each side of the marked line (lesson 9 and the dig-flags drawing say 3 ft too) |
| 2 Every day on the job | *materials 6 ft from edges* | 1926.250(b)(1) says 6 ft from a hoistway or floor opening and 10 ft from an exterior wall the stack rises above (lesson 10 repeats it as *from any edge*) |
| 3 OSHA and your rights | *It covers all employees, whatever their citizenship or the size of the company* and the not-covered list | state and local government workers are outside federal OSHA too; Texas has no state plan, so a city's crew is not covered |
| 3 OSHA and your rights | *There are seven categories, from De Minimis with no fine to Willful and Repeated* | OSHA's own list is six: De Minimis, Other-than-Serious, Serious, Willful, Repeated, Failure to Abate |
| 7 Falls: the hazard | *A 20-ft ladder's base sits 5 ft out from the wall* and the ladder-angle drawing | the 4-to-1 rule in 1926.1053(b)(5) runs on the height to the top support, not the ladder's length; a 20-ft ladder reaching 16 ft sits 4 ft out |
| 7 Falls: the hazard | *Platforms above 10 ft need guardrails on all sides* | 10 ft is the scaffold rule (1926.451(g)); any other platform needs its guardrail at 6 ft under 1926.501 |
| 8 Falls: the gear | *Posts take 200 lb* and the chip *200 lb a guardrail post holds* | 1926.502(b)(3) puts the 200 lb on the top rail; the midrail takes 150 lb; a post has no number of its own |
| 9 Electrocution | *200 mA can stop the heart* and the current-scale drawing | OSHA's own current chart puts ventricular fibrillation at 1,000 to 4,300 mA and cardiac arrest at 10,000 mA; 100 to 200 mA is the textbook figure, so the sources disagree |
| 9 Electrocution | *Test them monthly* (GFCIs) | 1926.404(b)(1)(iii)'s program tests cords and receptacles every 3 months; monthly is the maker's advice, not a rule |
| 10 Caught in or between | *ROPS, the roll cage over the operator, is required on all heavy machinery on any ground* | 1926.1000 names scrapers, loaders, dozers, tractors and graders; an excavator, a crane or a skid steer is outside it |
| 10 Caught in or between | *Seat belts are enforced under the General Duty Clause* | 1926.602(a)(2)(i) requires seat belts on equipment that carries ROPS; the clause is the fall-back where no standard reaches |
| 10 and 20 | the cave-in-signs caption *Six ways a wall says it is about to go* | the drawing carries seven labels (bulging, cracks along the edge, cracks on top, boiling, heaving, slumping, sliding); lesson 20's sentence names six and lesson 10's four or five |
| 11 Struck by | *Powder-actuated and pneumatic tools need certification* and *An uncertified nail gun killed an apprentice* | 1926.302(e) asks for training on the powder-actuated tool in use; a pneumatic nail gun has no OSHA certification |
| 11 Struck by | *Reversing needs a back-up alarm and a spotter* | 1926.601(b)(4) asks for a reverse alarm audible above the noise *or* an observer, one or the other |
| 11 Struck by | *Brace walls 8 ft or higher* | 1926.706(b) says walls *over* 8 ft (lesson 22 has it right) |
| 15 Noise, heat and cold | *An 8-hour TWA of 85 dBA starts a hearing conservation program. That means noise monitoring, free hearing protection, training, records, and baseline and annual hearing tests* and its Trap | the 85 dBA action level and the test program are general industry's 1910.95; construction's 1926.52 has no action level and its program starts at the 90 dBA PEL |
| 16 Silica and asbestos | *presume it in shingles, pipe insulation, fireproofing, vinyl flooring, popcorn ceilings and plaster* | 1926.1101's presumption covers thermal system insulation, surfacing material and asphalt or vinyl flooring from 1980 or before; shingles are not in it |
| 16 Silica and asbestos | the chip *30 years silica exposure records kept* | no sentence in the lesson teaches it; 1910.1020 keeps exposure records 30 years, so the number is right but stands alone |
| 17 Ladders and stairs | *The yearly inspection is the employer's job* | 1926.1053(b)(15) asks for periodic inspection by a competent person and sets no interval |
| 18 Scaffolds | the power-line caption *10 ft from anything else* | 1926.451(f)(6) adds 0.4 in per kV past 50 kV; 10 ft is the floor, not the whole rule |
| 19 Trenches: soil and protection | the Trap *edge fall protection at 6* | 1926.501(b)(7)(ii) guards a pit or shaft 6 ft or deeper only when it cannot be readily seen; a trench edge has no blanket 6 ft rule |
| 20 Trenches: getting out | *A trench deeper than 4 ft needs a ladder, stair or ramp within 25 ft* | 1926.651(c)(2) says 4 ft *or more*; a trench of exactly 4 ft is inside the rule |
| 20 Trenches: getting out | *The competent person's atmospheric permit lasts one day* and the chip *1 day the atmospheric permit* | OSHA has no such permit (as in lesson 2); the day is the course's own |
| 21 Lifting, handling and storing | *Cylinders stay no higher than 5 ft unless racked* and the stacking-limits drawing | I find no cylinder height in 1926.250; the lumber, brick and block numbers are there, this one may be the course's own |
| 22 Cranes, concrete and steel | *A certified signal person is required* and the Trap *A signal person is certified* | the same doubt as lesson 1: 1926.1428 says qualified |
| 22 Cranes, concrete and steel ★ | *Harnesses, lifelines and anchor points are fall protection. Nets and guardrails are fall prevention* and its Trap | lesson 8's Trap says *Nets do not prevent a fall*; the two lessons disagree, and a final draw can ask a reader both |
| 22 Cranes, concrete and steel | Check 1's wrong line *Gloves, grounding and care do not beat high voltage* | no option names gloves; the three wrong picks are a careful operator, not holding the tag line and grounding the crane |
| 24 Vehicles and forklifts | *Orange or yellow means warning. Yellow and black means caution* and the sign-colours drawing | ANSI Z535 makes warning orange and caution yellow with black; *orange or yellow* blurs the two |
| 24 Vehicles and forklifts | *An empty truck's center of gravity is higher than a loaded one's* and the load-center caption *an empty truck is top-heavy too* | a load on the forks moves the combined center of gravity forward and usually up, so the sentence reads backwards; the course's own words may differ |
| 28 Electrical safety and NFPA 70E | *It has three chapters and 19 non-mandatory annexes* and the chip *19 annexes* | the 2024 edition's informative annexes run A to R by my count, 18; worth a look at the book |
| 28 Electrical safety and NFPA 70E ★ | the Trap *A rubber-coated tool prevents electricity from traveling through the tool* | a rubber dip on a plier handle is a grip, not insulation; the insulated tools the lesson rates at 1,000 V are the ASTM F1505 kind, so the quiz's answer may teach the wrong lesson |
| Final bank ★ | Q8's right line *Silica dust is a hazard for everyone nearby*, for a table saw with no dust collection | a table saw cuts wood, and lesson 16 says silica is *not in paint or wood*; wood dust is the hazard unless the saw cuts tile or block |

Counted another way: twenty-one rows are a standard's number or word the course rounded (the signal
person, the 4 ft trench, the 8 ft wall, the back-up alarm, the hearing program), eight are the
course's own terms or counts OSHA does not set (the trench air permit, the atmospheric permit, the
yearly ladder inspection, the cylinder height, the seven violation categories), two are captions that
disagree with their lesson's words, and three are the ★ rows where the course would teach a reader
something wrong. Every
`from:` line stands; no question, option or figure was touched.

## Where it stands

2026-11-08, afternoon (newest first; the morning's line is at the foot): that morning's line had no read behind it. The dev seat read `training_courses`
at 13:50 CST and all three courses have been On since 2026-10-18 16:04Z, pressed by a dev account the
day the fourteen-year-old's reads (v2.5621, v2.5624) landed; Intro to plumbing is required of helpers
and devs, the refresher of the five field roles, Intro to electrical of devs. No course pass exists
yet (`training_passes` is empty to the dev, who reads every pass); two lesson passes exist, the
refresher's lessons 1 and 2 on a helper's account on 2026-10-17, before the press. So the course has
been live for the crew for three weeks and the owner's "press to On" already happened.

2026-11-08: the read-through of the OSHA 30 refresher, thirty lessons, their drawings and the final
bank, is § Read-through above: 34 doubted facts, three starred, no typo and no plain-words break, so
no fix PR; the content and figures tests are green on the words as they stand.

2026-11-08: the switch proof ran in the shape the live state allowed (§ Pick up → Checked off): the
Settings tab read three On switches, the Sample helper's Dashboard read red with *2 courses to do*,
lesson 1 of Intro to plumbing passed and its mark landed on the sample account, Exit returned the dev
and the tab read unchanged. Nothing was pressed in Settings → Training. The Off half waits on the
owner: it is his call whether a course should come off before his correction pass of #119 and of
§ Read-through here.

2026-11-08: #119's read ran at the same time in a sibling session, so this card ships in its own
docs-only PR, not #119's; that session was told the course already reads On.

2026-11-08: at the owner's word the On, View as, Off proof moves to a session on another computer;
§ Pick up above is its brief. Nothing was pressed in Settings → Training from this machine; both
courses stand as they did, the refresher off and required for the five field roles, Intro to
plumbing off and offered.
