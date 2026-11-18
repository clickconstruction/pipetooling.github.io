---
name: "Paint a map from the Dashboard: a press that is always there, and every map on a job"
number: 392
group: gated
status: asked 2026-11-17 · designed, drawn and rendered the same day (ten states at a phone's width and one at a desk) · shown to the owner with nine calls, each with a pick · nothing built · carded the same evening at the owner's word
summary: >
  The owner wants anyone to make a one-off map and text it from the Dashboard, clocked in or not,
  with a job today or not. Every map must be tied to a job, and picking the job must be easy.
  Today a person with no schedule and no clock-in has no Paint a map press on the Dashboard. The
  only door is the header's search, and it starts the map on no job. The design puts one press on
  the Dashboard's top row, the row that holds Tally and Job Report on every Dashboard. When the app
  knows the job, the map lands on it with no question. When it does not, the person picks from
  today's jobs and the jobs they were on lately. After Save, one press opens the phone's own
  Messages with the link written. A map that takes nine presses and two bouts of typing today
  takes four.
next: The owner's word to build, and a different pick on any of the nine calls the owner wants changed. Then step 1, the kernel.
size: L as a train of five (S · M · L · M · S)
blocker: The owner's word. Each call has a pick, so a plain *build it* is enough to start.
opinion: build — the doors, the start sheet and the job gate already exist, so it is one press, a picker and a shorter share
---

# Paint a map from the Dashboard (#392)

The mock-up is [mockup.html](mockup.html). It draws ten states side by side. Add `?s=<state>` to see
one alone: `tech-job`, `tech-nojob`, `office-phone`, `picker`, `picker-near`, `start`, `saved`,
`share`, `messages` or `office-desk`. Add `&plain=1` to take off the purple marks that show what is
new. Every job, street and link code on it is made up. It was rendered at 375 px and at a desk's
width before it was shown, and the render's own check found nothing off the side of the screen.

## The ask, in the owner's words

2026-11-17, after a read-only walk of painted maps on the live site:

> Design it and let me know what it would look like but don't add it yet. And if we are going to
> build it we need to be able to easily assign a job, as each map should be tied to a job.

The two rules this card designs to, both the owner's:

1. A Paint a map press on the Dashboard that is always there, whether or not the person is clocked
   in or has a job on today's schedule.
2. Every map is tied to a job, and picking the job is easy.

The use in mind: someone needs a one-off map to text to someone, and is most likely on a job
already.

## What a person meets today

- **From a job it works.** The job window's Job tab, under Where, or a tech's Job Mode card:
  **＋ Paint a map**, the start sheet, paint, **Share**, **Make a link**, **Send it another way…**,
  then the phone's Messages.
- **With no job it does not.** A person with no schedule and no clock-in has no Paint a map press
  on the Dashboard. The only door is the header's search: type *paint*, press **Paint a map**. The
  start sheet opens on no job, with a small **Pick the job it is for**.
- **Text it…** is the office's, and sends to the job's customer from the company's number.
- **A link** is made only by the painter or the office.

## What changes

1. **The press.** Paint a map joins the Dashboard's top row, the one that holds Tally and Job
   Report (`DashboardPinnedQuickRow`). That row is drawn on every Dashboard: Job Mode, the short
   Dashboard and the full one. It takes the row's three shapes:
   - Job Mode, at every width: a wide press beside the Tally square, in the slot the Job Report
     button left empty (punch list #189). Its second line says where the map will land: *On J2417 ·
     Cedar Hollow 12*, or *You pick the job it is for*.
   - The office's phone: a third quiet link beside *Job report* and *Tally*.
   - A desk, and a field person on the full Dashboard: a square after Job Report.

   No header button, no dock slot, nothing on the day's press bar.
2. **The job.** When the app knows the job, the start sheet opens with it set: the job the person
   is clocked onto, else the next job on today's schedule. When it does not, **Which job is it
   for?** opens first: today's jobs, the jobs the person was on lately, **Find the jobs near me**,
   then a search. One press on a row opens the start sheet.
3. **The start sheet.** *For* moves to the top and always names a job, with **Change the job**
   beside it. *Leave it on no job* leaves this sheet. A job in a development keeps its two chips,
   the job or every lot.
4. **After Save.** The map says *Saved on* the job, and offers **Text it from my phone…** at once.
   That press makes the link and opens the phone's own Messages with the words written. The Share
   sheet loses its *Make a link* step: the first press there makes the link.
5. **A wrong job.** **Move it to another job…** joins *Rename this map* and *Throw this map away*,
   for the painter and the office. The database already allows the move.

The marking tools do not change.

## Presses, from the Dashboard to a text ready to send

| | Today | With this card |
|---|---|---|
| No job known | 9 presses and two bouts of typing | 4 presses, no typing |
| Job known | 6 presses | 3 presses |

Painting and Save are not counted on either side. Today, with no job known: the search, type
*paint*, **Paint a map**, **Pick the job it is for**, type, the job, **Draw it by hand**, then
**Share**, **Make a link**, **Send it another way…** and Messages. With this card: **Paint a map**,
the job, **Draw it by hand**, then **Text it from my phone…**.

## What was read that shapes it

- **Who may paint on a job.** A map on a job is open to whoever passes `on_site_can_touch_job`: the
  office and anyone who sees the job, or a person on the job's team. A schedule block puts a person
  on the team (`ensure_job_team_member_from_schedule_block`).
- **The job search finds more than a person may paint on.** `search_jobs_ledger` is SECURITY
  DEFINER and finds jobs a helper is not on, so a helper could pick a job the database then refuses
  at Save. The picker lists only jobs the person can paint on, and says so on a search hit they
  cannot. Not checked: whether clocking onto an unscheduled job puts a helper on its team.
- **A job has no point of its own.** Its point comes from `address_geocodes`, a cache by address.
  *Find the jobs near me* can list only jobs whose address is already in it.
- **Put it on a job…** moves a map from no job to a job only. A map on a job cannot be moved from
  the screen today.
- **Making a link** is the painter's and the office's (`painted-map-link`). The owner's use is a
  painter sharing their own map, so this card does not widen it.
- **One press to Messages** depends on the phone opening Messages after the short wait for the link.
  It has not been tried on a real iPhone or Android phone. If a phone refuses, the press becomes
  two: the link is made, then *Open Messages*.

## The calls, each with a pick

1. **Where it sits.** The top row beside Tally, since one component already draws that row on every
   Dashboard. The other choice is the Job Mode card plus a quick button for the office, which is two
   places.
2. **The strip's own ＋ Paint a map under a job's address.** Keep it, since it sits with the job's
   maps and serves the job window too. In Job Mode on a job, that makes two presses on one screen.
3. **A map on no job.** Retire it from every Paint a map door (the Dashboard, the header's search,
   the Documents page's tab), so the person always picks a job. Maps already on no job stay, with
   **Put it on a job…**. No database rule yet: a rule needs a migration and a look at what is on no
   job today.
4. **A map a task paints.** Keep it as the one exception. Its home is its task, and a task has no
   job to land it on. The stricter choice asks for the job in the task's Map sheet too, one more
   press on every task map.
5. **A development's map for every lot.** Keep it, and count it as tied, since it shows on every
   lot's job.
6. **The next scheduled job, with no question, when the person is not clocked in.** Yes, since *For*
   names it at the top and **Change the job** is one press.
7. **A tech's own text.** Yes: **Text it from my phone…**, from the person's own number to whoever
   they pick. **Text it…** to the customer from the company's number stays the office's.
8. **Who may make a link.** Leave it with the painter and the office, since a link with no sign-in
   deserves its own decision.
9. **Find the jobs near me.** Build it last or not at all, since it lists only jobs the app has
   already placed.

## Where it plugs in

- The top row: `src/components/dashboard/DashboardPinnedQuickRow.tsx`, mounted twice in
  `src/pages/Dashboard.tsx`, once in Job Mode and once on the Dashboard every other person sees.
- Job Mode: `src/components/jobMode/DashboardJobModeCard.tsx`, the strip under the address in
  `JobModeDetailsSection.tsx`, and `JobModePressBar.tsx`, which this card leaves alone.
- The door and the screens: `src/lib/paintedMap/paintedMapDoor.ts` (`startPaintedMap`),
  `src/components/paintedMap/PaintAMapStartSheet.tsx` (the *For* block, **Pick the job it is for**,
  *Leave it on no job*), `PaintedMapWindow.tsx` (**Put it on a job…**, **Share**),
  `PaintedMapShareSheet.tsx`, `JobPaintedMapsStrip.tsx` and `src/lib/paintedMap/paintedMapSearch.ts`.
- The database and functions: `on_site_can_touch_job`, `ensure_job_team_member_from_schedule_block`,
  `search_jobs_ledger`, `address_geocodes` and the `painted-map-link` function.

## The plan, once the owner says build

1. **The kernel** (S), no screen. Which job the press lands on, the second line's words and the
   picker's order, with tests. An Office or billing-only clock is not a job.
2. **The press** (M) on the Dashboard's top row, opening today's start sheet with the job set. The
   guide `paint-a-map`, a release note, a fragment and the Glossary's entry amended.
3. **The picker** (L). *For* at the top with **Change the job**, *Leave it on no job* retired from
   the doors, and **Move it to another job…**.
4. **The share step** (M). The Saved band, **Text it from my phone…**, and the Share sheet with no
   *Make a link* step. Walked on a real iPhone and a real Android phone before it merges.
5. **Find the jobs near me** (S), if the owner wants it.

## How to verify

- Kernel tests for the job the press lands on in each state: clocked onto a job, clocked onto
  Office or billing only, a next job on today's schedule, and nothing today.
- Render tests on the top row in its three shapes, and on the picker with a search hit the person
  cannot paint on.
- A local harness at 375 px before each screen PR, to see the press beside Tally with the app's own
  CSS.
- On the live app: a made-up map on a made-up job, as a tech and as the office, thrown away after.
- Step 4 on two real phones, as above.

## Out of scope

The marking tools. The `/way` page and *Who opened it*. A tech texting from the company's number.
Who may make a link. Task Mode's own screens. A header button or a dock slot. Any change to who can
open a map. Pins on a painted map are [#393](../painted-map-pins.md), and Google's map under a
painted map is [#387](../painted-maps-on-google.md).
