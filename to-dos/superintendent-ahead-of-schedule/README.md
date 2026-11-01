---
name: "Superintendent ahead of schedule: hours on every commercial job, a line that says ahead or behind, and a reward paid at the certified pay app"
number: 234
group: gated
status: thought through 2026-11-01 with the owner, read against the Costs tab, the Labor tab, the Build desk and People → Review; three mock-ups; nothing built; three decisions are the owner's and he is not ready to make them
summary: >
  The owner's long-term aim: associate hours with commercial work so a superintendent can see
  whether he is on track or ahead of schedule, and so the company can reward superintendents for
  being ahead. Residential and service calls are too hard to estimate and stay out. The app already
  holds the pieces: a job's hours baseline on the Costs tab (from the bid's Labor tab, or typed,
  frozen as a snapshot), the Costs verdict's ahead-of-the-work figure and its time-left-at-pace,
  the Build desk's hours-in against percent-out, the pay application's certified line percents, and
  People → Review's earned column. What is missing is a baseline on every commercial job at award, a
  percent the superintendent cannot grade himself on, a planned finish carried from the bid's rough
  schedule, one line on the superintendent's phone, and a computed score the office pays on. The
  discussion stops here until the owner settles what counts as certified, whether the bonus is on
  hours saved or days ahead, and whether a sub-performed stage counts.
next: The owner's three calls under *Open questions*. Then PR 1, the baseline at award, which is useful on its own.
size: M as a train of four (S · S · M · M); one migration for the award snapshot and the planned dates; no edge function
blocker: The owner's three calls. He said on 2026-11-01 he is not ready to answer them yet; the card holds the thinking until he is.
ver: v2.3297 · 3299 · 3361 · 3360 · 3598 · 4781 · 5216 · 5244 · 5245 · 5929 · 6077 · 6090
opinion: later — the thinking is sound and PR 1 is safe to build before the calls, but the reward is the point and the reward waits on what counts as certified
mockup: to-dos/superintendent-ahead-of-schedule/mockup-phone.html
---

# Superintendent ahead of schedule (#234)

## The ask

The owner, 2026-11-01, after reading where a job's hours live on the Costs tab:

> It's really hard to estimate the number of hours we should spend on a job when the job is
> residential or a service call. But there's great value in associating those hours with commercial
> work. Long term, one of the features enabled by this is a superintendent's ability to see if they
> are on track or ahead of schedule and then we can reward superintendents for being ahead of
> schedule. Can you help me think through how we could enable and strengthen this in the app?

And, the same day, on saving it: he is not ready to answer the questions, and wants the canvas and the
thinking kept so the discussion can continue before anything is built.

The thinking came out of the owner's larger measure for the app (the read-and-judge session of
2026-11-01): a screen should move decisions off a person who has to think. The superintendent's
decision is "am I ahead or behind, and what do I do today"; the office's is "who earned the bonus".

## The mock-ups

Three boards, made-up names and figures, beside this file:

- `mockup-phone.html` — the superintendent's phone: one card per project with "3 days ahead at this
  pace" or "4 days behind", the done and hours bars, the planned finish against the finish at pace,
  the proof line (the certified pay app percent, the checklist's ready count, his own percent marked
  provisional), the one move when behind, and his running score for the pay-app period.
- `mockup-baseline.html` — the Costs tab's baseline strip in three states: today's amber "no baseline,
  bid sent without hours"; a proposed assumed-hours baseline at award, grey, from the Labor tab's own
  jobs baseline (hours per $1k from similar jobs); and the from-the-bid baseline at award with a change
  order added and the planned finish from the rough schedule. Under them, the Quickfill deck line
  "commercial jobs working with no hours baseline" with its three answers.
- `mockup-scoreboard.html` — People → Review's Schedule table, one row per superintendent, with the
  rule card and the Settings card where the three decisions sit as bracketed choices.

The wider canvas these came from, with the before-and-after boards of the owner's seven changes, is
*Click Tooling before and after* — https://claude.ai/artifact/3qAyRskDe9gdeQMn8K57g3 (private to the
owner; its before boards hold live figures, so they are not in this folder).

## The thinking

**The measure, in one rule.** For a commercial job, "ahead" is two numbers the Costs tab already
computes and nobody in the field can see: percent done minus percent of baseline hours used (the
verdict's ahead-of-the-work figure, `aheadPts` in `src/lib/jobs/jobCostsVerdict.ts`), and the finish
at today's progress pace against a planned finish (the verdict's `timeLeft`). A real job showed why
the baseline matters: its bid predicted 9 hours, the job took 334, and the only reason the app could
say "the book was light here" is that a number was frozen before the work started.

**Leg one: every commercial job carries a frozen hours baseline at award.** Today a baseline exists
only when a bid is linked and its Labor tab carried hours (`job_budgets`, kind `bid`, v2.3297), or
when someone typed one on the Costs tab (kind `typed`, v2.3299). The usual gap is a bid sent without
hours. Three moves close it: gate by kind, so residential and service jobs carry no baseline and no
score (the property kind is already on the customer); for a commercial job whose Labor tab is not
usable, write the Labor head's own jobs baseline (hours per $1k from similar jobs, the tile on
Bids → Labor, v2.3598) as an assumed baseline in hours, marked a guess the way the Bridge greys a
pile; and a Quickfill deck line so the office fills the rest one job at a time with the presses the
strip already has (Take its estimate, Refresh from bid).

**Leg two: a percent the superintendent cannot grade himself on.** The crew's stepper sets percent
today (`FieldPctUpdateModal`, `job_pct_events`, v2.5245), and the person being rewarded would control
it. Anchor the scored percent to something outside the crew: the pay application's line percents,
which the AIA G702/G703 form already offers from the crew's figure and the GC then certifies
(v2.6090); inspections passed; and the stage checklist's ready count (v2.6077). The crew's own percent
stays but reads provisional until one of those confirms it. The settlement moment is the certified
pay app, which is also when the money is real.

**Leg three: a planned finish.** The rough schedule on a GC bid already draws weeks by stage
(`gc_rough_schedules`, dev-only, v2.4781). Carry it onto the job at award as planned stage dates,
frozen like the baseline, so "ahead" reads in days as well as hours.

**What the superintendent sees.** One line on his job window and his Dashboard, no money: "Building
C: 52% done, 44% of hours used, 3 days ahead at this pace." Green, amber or red by rule, and when
red, the one move: the stage that is eating hours and has not moved, in the Build desk's own words
(`src/lib/bridge/build/buildDesk.ts`, v2.5929), with Set the % and the checklist as the proof.

**The reward.** Score each superintendent per pay-app period, on certified percent only: hours under
baseline at that percent times the job's labor rate is labor saved, and days ahead is its own figure.
Pay a share of labor saved, or a day rate for days ahead, when the GC certifies and the bill goes
out. One kernel, two readers: People → Review, which already credits people by the Bridge's earned
rule (`src/lib/people/reviewEarned.ts`, v2.3360) and takes a Schedule column, and the
superintendent's own phone, so he sees the number the office pays on. Never typed, always computed.

**Guard rails.** The baseline is the award snapshot; Refresh from bid writes a dated new one but the
score reads the award. Change orders add hours to the baseline, so bigger scope does not read as
behind. A job with no baseline is not scored and says so. Sub-performed stages have no clock hours,
so they are scored on the sub's hours or excluded, named either way. Every certified job feeds Book
vs jobs → Set, which calibrates the labor book (v2.3598), so each scored job sharpens the next
baseline. That is what makes the Bridge's Build link (v2.5216, v2.5244) a reading instead of a guess.

## Open questions

The owner's, and he said on 2026-11-01 he is not ready to answer them:

1. **What counts as certified?** The GC's certified pay application, a passed inspection, or the
   office's sign-off. The pay app is the recommendation: it is the GC's word and the moment the bill
   goes out.
2. **Hours saved or days ahead?** Hours saved against the baseline at the job's labor rate, paid as a
   share; or days ahead of the planned finish at a day rate. Hours saved is the recommendation: it
   needs only leg one and two, and it is the number the book learns from.
3. **Does a stage a sub performs count?** Sub labor sheets carry no clock hours. Count it on the sub's
   sheet hours, or leave it out of the score.

And three the build will meet: whether the assumed-hours baseline scores at all or only the from-the-bid
one (the mock-up says only the bid's scores); whether a superintendent sees other superintendents'
rows (the mock-up shows him only his own); and what a job that runs over reads on the scoreboard
(the mock-up shows a negative saved figure and "$0, nothing owed back").

## Where it plugs in

What exists:

- `job_budgets` with kind `bid` / `typed` and the resolved budget's three footings
  (`src/lib/jobs/jobBudget.ts`, v2.3297); the Costs tab's baseline strip and Budget card
  (`src/components/jobs/JobBudgetCard.tsx`, `JobCostsVerdict.tsx`, v2.3299, v2.3361).
- The verdict's ahead-of-the-work and time-left-at-pace (`src/lib/jobs/jobCostsVerdict.ts`).
- The Labor tab's head: usable-as-a-job-budget bar, field hours, jobs baseline per $1k, Book vs
  jobs → Set (`docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`, v2.3598).
- Percent done: `job_pct_events`, the crew's stepper and the office's percent window (v2.5245); the
  pay application's line percents offered from the crew's figure (v2.6090); the stage checklist's
  ready count (v2.6077).
- The rough schedule on a GC bid (`gc_rough_schedules`, v2.4781).
- The Build desk's hours-in against percent-out per job (`src/lib/bridge/build/buildDesk.ts`,
  v2.5929) and the earned rule (`src/lib/bridge/earnedRevenue.ts`).
- People → Review's earned column (`src/lib/people/reviewEarned.ts`, v2.3360).
- The superintendent's reach: assigned projects, the percent stepper, job thread notes, no money
  (`docs/ACCESS_CONTROL.md` → superintendent).

What is new: the award snapshot and its freeze; the assumed-hours baseline in hours; the commercial
gate; planned stage dates on the job; the superintendent's line kernel and card; the Schedule column
and the bonus setting; the certified-percent source rule.

## The plan

1. **PR 1 · the baseline at award** (S). Commercial gate by property kind; at award, snapshot the
   bid's hours into `job_budgets` as today, and when the Labor tab is not usable, write the assumed
   hours from the jobs baseline with the wave glyph; the Quickfill deck line "commercial jobs
   working with no hours baseline". Useful on its own: the Pipeline's burning card and the Build desk
   read it at once.
2. **PR 2 · the planned finish** (S). Carry the rough schedule's stage weeks onto the job at award as
   planned dates; one migration with the award snapshot's freeze.
3. **PR 3 · the superintendent's line** (M). The kernel (ahead-of-the-work, days vs plan, the proof
   sources, the one move), the card on his Dashboard and job window, the guide.
4. **PR 4 · the scoreboard** (M). The Schedule column on People → Review, the superintendent's own
   row on his phone, the bonus rule in Settings → People, paid at the certified pay app.

## How to verify

On the dev server as the dev, prod data, nothing written outside ZZ Test rows: make a ZZ Test
commercial job from a ZZ Test bid with hours on its Labor rows, award it, and read the strip
(frozen hours, the planned finish); clock ZZ Test hours and set a percent; read the superintendent's
line as the Superintendent sample through View as; certify a ZZ Test pay app and read the Review
row. Delete every ZZ Test row after.

## Where it stands

2026-11-01: thought through with the owner and mocked up; nothing built. The owner asked to keep the
canvas and the thinking here and to continue the discussion before any PR. PR 1 is safe to build
before his three calls; PR 3 and PR 4 are not.
