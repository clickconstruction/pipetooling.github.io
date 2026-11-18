---
name: "Paint a map from the Dashboard: a press that is always there, and every map on a job"
number: 392
group: ready
status: asked 2026-11-17 · designed, drawn and rendered the same day (ten states at a phone's width and one at a desk) · shown to the owner with nine calls, each with a pick · nothing built · carded the same evening at the owner's word · the Share sheet was built apart as #394 on 2026-11-18 (v2.7788 · 7790) · walked the same day as a leader on a phone, and the missing Dashboard press was the walk's worst snag · a leader's phone drawn the same day (three states), a tenth call added with a pick, and the plan's order changed so the Saved band comes before the picker · the owner's word the same day (*Yes, build it*) · the kernel and the press built the same day (v2.7859), walked on a local server in a headless Chrome at a phone's width and a desk's, light and dark · the Saved band built the same day (v2.7866), walked the same way on a made-up map on no job, thrown away after · the picker built the same day (v2.7868), walked with made-up jobs answered to its reads and nothing saved · not yet tried on a real phone
summary: >
  The owner wants anyone to make a one-off map and text it from the Dashboard, clocked in or not,
  with a job today or not. Every map must be tied to a job, and picking the job must be easy.
  Today a person with no schedule and no clock-in has no Paint a map press on the Dashboard. The
  only door is the header's search, and it starts the map on no job. The design puts one press on
  the Dashboard's top row, the row that holds Tally and Job Report on every Dashboard. When the app
  knows the job, the map lands on it with no question. When it does not, the person picks from
  today's jobs and the jobs they were on lately. After Save, one press opens the phone's own
  Messages with the link written. A map that takes seven presses and two bouts of typing today
  takes four.
next: Step 5, Find the jobs near me. One call is the owner's, call 11: the two short pages do not draw the top row, so the press is behind Everything else there. The text press wants one press on a real iPhone and a real Android phone, with #394's.
size: L as a train of five (S · M · S · L · S), the first four built; left: S
blocker: None for step 5. Call 11 is the owner's, and so is a real phone for the text press.
ver: v2.7859 · 7866 · 7868
opinion: keep building — the press is in, so what is left is the Saved band, which is small, and the picker, which is the owner's second rule
---

# Paint a map from the Dashboard (#392)

The mock-up is [mockup.html](mockup.html). It draws thirteen states side by side. Add `?s=<state>` to see
one alone: `tech-job`, `tech-nojob`, `office-phone`, `leader-phone`, `leader-phone-clocked`,
`leader-phone-link`, `picker`, `picker-near`, `start`, `saved`, `share`, `messages` or `office-desk`. Add `&plain=1` to take off the purple marks that show what is
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
  **＋ Paint a map**, the start sheet, paint, **Share**, then **Text it from my phone…**, which
  opens the phone's Messages (#394).
- **With no job it does not.** A person with no schedule and no clock-in has no Paint a map press
  on the Dashboard. The only door is the header's search: type *paint*, press **Paint a map**. The
  start sheet opens on no job, with a small **Pick the job it is for**. Walked as a leader on
  2026-11-18: see *The walk as a leader* below.
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
   - A desk, and a field person on the full Dashboard: a square after Job Report. A leader's phone
     is this shape at 375 wide, drawn as `leader-phone` and `leader-phone-clocked` (call 10).

   No header button, no dock slot, nothing on the day's press bar.

   **Built, v2.7859.** The two short pages (#384, built after this card was written) do not draw
   that row, so the press is behind **Everything else** there (call 11).
2. **The job.** When the app knows the job, the start sheet opens with it set: the job the person
   is clocked onto, else the next job on today's schedule. When it does not, **Which job is it
   for?** opens first: today's jobs, the jobs the person was on lately, **Find the jobs near me**,
   then a search. One press on a row opens the start sheet.
3. **The start sheet.** *For* moves to the top and always names a job, with **Change the job**
   beside it. *Leave it on no job* leaves this sheet. A job in a development keeps its two chips,
   the job or every lot.
4. **After Save.** The map says *Saved on* the job, and offers **Text it from my phone…** at once.
   That press makes the link and opens the phone's own Messages with the words written. The Share
   sheet loses its *Make a link* step: the first press there makes the link. The Share sheet is
   drawn whole on [#394](../painted-map-share-sheet/README.md), which replaces this mock-up's
   `share` state.
5. **A wrong job.** **Move it to another job…** joins *Rename this map* and *Throw this map away*,
   for the painter and the office. The database already allows the move.

The marking tools do not change.

## Presses, from the Dashboard to a text ready to send

| | Today | With this card |
|---|---|---|
| No job known | 7 presses and two bouts of typing | 4 presses, no typing |
| Job known | 4 presses | 3 presses |

Painting and Save are not counted on either side. Today, with no job known: the search, type
*paint*, **Paint a map**, **Pick the job it is for**, type, the job, **Draw it by hand**, then
**Share** and **Text it from my phone…**. With this card: **Paint a map**, the job, **Draw it by
hand**, then **Text it from my phone…**. Before #394 built the Share sheet, today's count was 9
and 6.

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

## The walk as a leader, 2026-11-18

The owner asked whether a leader can easily draw a map and text it. The flow was walked as the
Sample leader at 375 by 812 on a local server, with one made-up map on no job, thrown away after.
What it found that bears on this card:

- **No press, Job Mode on or off.** With nothing on the schedule, the leader's Dashboard has no
  Paint a map press in either mode. This was the walk's worst snag: a first-timer does not start.
- **The search finds it by the right words only.** *draw a map* lists **Paint a map** first.
  *paint* lists it third, under two jobs with paint in their names. *map* alone lists it far down.
- **Dashboard to the first corner was 5 presses, a typed word and a scroll**: the search, *paint*,
  **Paint a map**, a name chip, **Draw it by hand** below the fold, then **Start the map where I
  am**, since a map on no job opens on the whole country. Call 3 ends that last press.
- **A leader's phone is not the office's phone.** `isPhoneOfficeRole` does not count a master, so
  a leader on a phone gets the square row: Tally 48 wide, the clock 231 and Job Report 64, inside
  a 359 wide row. The mock-up drew squares only at a desk's width.
- **Making the link took 1.3 seconds at a desk.** #394's sheet already falls back to a second
  press when a phone will not open Messages after that wait.

## A leader's phone

Drawn in three states, rendered at 375 wide with nothing off the side of the screen.

- **`leader-phone`, clocked out.** A fourth square, 72 wide, after Job Report. The clock goes from
  231 to 151 wide. **Clock In** still fits on one line.
- **`leader-phone-clocked`, clocked in.** At 151 wide the red press breaks onto two lines, the time
  then *Clock Out*. The row grows from 104 to 108 tall. Nothing is cut off.
- **`leader-phone-link`, the other choice.** The row stays as it is today and **Paint a map** is a
  line under it, 44 tall, as on the office's phone. The clock keeps its one line.

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
10. **A leader's phone: a square or a line.** The square, since the walk's worst snag was that
    nothing on the Dashboard says map, and a square beside Job Report reads as a press of the same
    rank. Its cost is the clocked-in clock on two lines. The other choice is the line under the
    row, which costs nothing and is easier to miss. **Built as the square, v2.7859.** The live
    square is 48 tall, so the row is no taller than before.
11. **The two short pages.** The short Dashboard and Job Mode's short page (#384) draw no top
    row, by design: the card's top, what waits, tomorrow and one door. The press is one press
    away, behind **Everything else**. Leave it there, since a short page is short on purpose and
    the job's own **＋ Paint a map** is one fold away on Job Mode's short card. The other choice
    is one more line on each short page.

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

1. **The kernel** (S). **Built, v2.7859**, with the press. Which job the press lands on and the
   second line's words, with tests. An Office or billing-only clock is not a job. The picker's
   order was left for step 4, where the picker's rows are known.
2. **The press** (M) on the Dashboard's top row. **Built, v2.7859.** It opens today's start sheet
   with the job set, and a job the press picked can be changed there with **Change the job**, over
   the sheet's own job search. A leader's phone at call 10's pick. The square and the link read
   the day on the press and wait at most 2.5 seconds. The guide `paint-a-map`, a release note, a
   fragment and the Glossary's entry amended. The header's search was left alone: it lists
   matching jobs above pages for every word, so **Paint a map** stays third for *paint*.
3. **The Saved band** (S). **Built, v2.7866.** The map says *Saved on* the job and offers **Text it from my phone…**
   at once, with one blue press on the screen and the press back in view after a place is added.
   The Share sheet itself is built ([#394](../painted-map-share-sheet/README.md)), so this is what
   is left of the old share step. The press is the Share sheet's own, with its fall back to
   **Open Messages**. Built on the owner's word to build every step, so the walk on a real iPhone
   and a real Android phone is still to do, together with #394's.
4. **The picker** (L). **Built, v2.7868.** **Which job is it for?** opens first when a map is started
   with no job: today's stops, the jobs clocked onto in the last 45 days, then a search of every
   job, with a job the person may not paint on listed grey with its reason. *For* leads the start
   sheet with **Change the job**. *Leave it on no job* is gone from every door. **Move it to another
   job…** joins *Rename this map*, and **Put it on a job…** opens the same picker. **Draw it by hand**
   and **Start with a place** are above the fold at 812: the sheet is 775 tall.
   One way onto no job is kept, and it is not in call 3: with no signal the lists cannot be read,
   and a person on site must still be able to paint. The picker then offers **Paint now and pick
   the job later**, and the map waits for **Put it on a job…**.
5. **Find the jobs near me** (S), if the owner wants it.

The Saved band was fourth and the picker third until 2026-11-18. The band is small and is where a
saved map still loses people, so it goes first. That puts the rule that every map is tied to a job
one small step later: until step 4, the press opens today's sheet with the job set when the app
knows it and **Pick the job it is for** when it does not. The owner may swap 3 and 4 back.

Step 4 took over **Change the job**: it opens the picker.

## How to verify

- Kernel tests for the job the press lands on in each state: clocked onto a job, clocked onto
  Office or billing only, a next job on today's schedule, and nothing today.
- Render tests on the top row in its three shapes, with the square row at a phone's width, and on
  the picker with a search hit the person cannot paint on.
- A local harness at 375 px before each screen PR, to see the press beside Tally with the app's own
  CSS.
- On the live app: a made-up map on a made-up job, as a tech and as the office, thrown away after.
- Step 3 on two real phones, as above.

## Out of scope

The marking tools. The `/way` page and *Who opened it*. A tech texting from the company's number.
Who may make a link. Task Mode's own screens. A header button or a dock slot. Any change to who can
open a map. Pins on a painted map were #393 (closed 2026-11-18, in
[the Closed lines](../README.md)), and Google's map under a painted map is
[#387](../painted-maps-on-google.md).
