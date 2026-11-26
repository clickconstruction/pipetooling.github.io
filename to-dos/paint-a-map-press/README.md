---
name: "Paint a map from the Dashboard: a press that is always there, and every map on a job"
number: 392
group: close
status: asked 2026-11-17 · designed, drawn and rendered the same day (ten states at a phone's width and one at a desk) · shown to the owner with nine calls, each with a pick · nothing built · carded the same evening at the owner's word · the Share sheet was built apart as #394 on 2026-11-18 (v2.7788 · 7790) · walked the same day as a leader on a phone, and the missing Dashboard press was the walk's worst snag · a leader's phone drawn the same day (three states), a tenth call added with a pick, and the plan's order changed so the Saved band comes before the picker · the owner's word the same day (*Yes, build it*) · the kernel and the press built the same day (v2.7859), walked on a local server in a headless Chrome at a phone's width and a desk's, light and dark · the Saved band built the same day (v2.7866), walked the same way on a made-up map on no job, thrown away after · the picker built the same day (v2.7868), walked with made-up jobs answered to its reads and nothing saved · Find the jobs near me built the same day (v2.7869), pressed live from a made-up spot beside the test jobs · every step built · merged 2026-11-18 as one PR (#8814) · the Saved band's press was a step behind the Share sheet's, and #394's session brings it in line in #8856: Messages opens inside the press, and a false note is taken back · not yet tried on a real phone · the owner opened the picker on 2026-11-19 with nothing on his schedule and no clock, met an empty window and asked for his last jobs there · the rows were read, the window drawn three ways at a phone's width and a desk's, light and dark, and shown to him with four calls · his word the same day (*I like C and then if they click to change the job it should show B*) · built the same day as one change (v2.7915): the sheet opens on the last job, and Change the job opens the refitted picker with Your last jobs · walked on a local server as the owner at a desk's width and a phone's, nothing saved · the Android half of the walk on two real phones was taken off on the owner's word of 2026-11-25 and was never done on a real phone · what is left is the walk on a real iPhone and the owner's answer to call 11 · walked whole in an iPhone simulator 2026-11-25 as the dev, where it holds but for the start sheet's foot, which sits under Safari's bar · Dispatch Mode's home was given the Dashboard's top row the same day (v2.8587), not yet seen in the simulator · Dispatch Mode's home drew the Dashboard's top row in a simulator on 2026-11-26 for the sample leader and the sample assistant, nothing off the side; the row holds its five presses, as the Dashboard draws it
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
next: >
  The simulator looks at the start sheet once v2.8578 is live: it ends above Safari's bar and scrolls to both presses. The simulator looks at Dispatch Mode's home once v2.8587 is live: its first row reads Tally, Clock In, Job Report and Paint a map, with nothing off the side. Walk it on a real iPhone on the live app, with a made-up map: the Dashboard's press, the picker with Find the jobs near me, and Text it from my phone… under the Saved band. The owner answers call 11, the two short pages. Then delete this card.
size: L as a train of five (S · M · S · L · S), all built, with the changed jobs and Coming up after it (S with one index); left: a look at the start sheet's mend (XS), a look at the top row on Dispatch Mode's home, built as v2.8587 (XS), the walk on a real iPhone (XS) and call 11
blocker: >
  A real iPhone in a hand, and the owner's answer to call 11.
ver: v2.7859 · 7866 · 7868 · 7869 · 7915 · 7920 · 7933
opinion: built as carded, with two changes said on the card — the phone walk is left, and the picker should never open on an empty list
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

## The picker with nothing to offer, 2026-11-19

The mock-up is [picker-mockup.html](picker-mockup.html). It draws the window as it is and three
ways it could be, each at a phone's width and a desk's. **Dark** at its top flips every screen.
Add `?s=<state>` to see one alone: `now-phone`, `now-desk`, `a-phone`, `a-desk`, `b-phone`,
`b-phone-tech`, `b-phone-typed`, `b-phone-new`, `b-desk`, `c-phone` or `c-desk`. Add `&theme=dark`
or `&plain=1`. Every job and street on it is made up.

### The ask, in the owner's words

> when a user clicks on paint a map on their dashboard, I don't love this modal of sorts. I think
> we should show for a user the last jobs they were on In a section, if the other sections haven't
> populated.

He opened it as himself: nothing on his schedule, no clock in 45 days. The window said *No job on
your schedule today, and none you clocked onto lately. Search for the job.* over a gap, a link and
the search.

### What "the last jobs you were on" can mean

Read from the live rows on 2026-11-19 through the dev seat, for seventeen real people. Reads only.
Counts are jobs, each counted once.

| Where it is read from | Office (8 people) | Superintendent and lead | Field techs (7) |
|---|---|---|---|
| Clocked onto in the last 45 days, which is **Lately** today | 0 or 1 for all eight | 23 and 15 | 14 and 16 for two, 0 or 1 for five |
| Clocked onto, any age | the owner 4 (newest Sep 18), Trace 17, Bryan 4, three for two estimators | over 100 and over 68 | Micah 11, Darren 3, Kyle none ever |
| On their schedule on a past day, any age | the owner 6 (newest Nov 14), Trace 12, Bryan 7 | over 100 and over 72 | Kyle 26, Micah 9, Darren 2 |
| On the job's team | the owner 14, Trace 37, Bryan 12, Taunya 4, one each for four more | over 200 each | Kyle 35, Micah 10, Darren 3 |
| Changed in the app (the job's activity record) | Taunya 52 jobs in ten days, the owner 30, none for four | 68 and 20 | next to none |
| Wrote a report on | one or two, months old | 164 and 19 | none to 4 |
| Painted a map on before | the owner 1 | none | none |
| Account manager of | Trace 21, the owner 2 | 4 for the lead | none |

What the rows say:

- **A superintendent and a lead never meet the empty window.** Most of the office does. So do the
  field techs who are scheduled and do not clock: Kyle has 26 scheduled jobs and no clock, ever.
- **Three reads fill the list for nearly everyone**: older clocks, past days on the schedule, and
  the team. Each already has its index (`clock_sessions` by person and day,
  `job_schedule_blocks` by assignee and day, `jobs_ledger_team_members` by person).
- **Each can be painted on.** The office can open every job. A schedule block puts a person on the
  job's team, and the team is half of `on_site_can_touch_job`. A helper's old clock on a job they
  have since left fails the rule and is dropped, as it is today.
- **The office's truest list is the jobs they changed in the app.** `job_activity_events` has no
  index by person, and its read rule runs a function a row. Reading it by person needs one index,
  which is a migration. That is call 14.
- **Reports, painted maps and account manager add almost nobody** the first three miss. A job's
  master is every job for a lead, so it says nothing.
- **Two new helpers have nothing in any source.** They still need a sentence that names a press.
- Tally's Choose job sheet already lists Recent jobs from every clock with no 45-day wall, each
  row saying how it knows (#216). The picker is the stricter of the two today.
- A job numbered 000 that the office uses as a catch-all is in three people's lists. It is a real
  job to the database, so it is listed.

### The three ways

- **A, the owner's direction.** When Today and Lately are both empty, a third list takes the gap:
  **Your last jobs**. Clocked or scheduled at any age, newest first, then the team. Up to six.
  Nothing else in the window moves.
- **B, the pick.** The same list under one rule: **Your last jobs** replaces Lately and always
  holds up to six. Recent clocks lead it, older days and the team fill it. A tech with one clock
  this month gets six rows too, not one. The window is refitted: the search on top with
  **Near me** beside it, and at a desk a window near the top of the screen with the cursor in the
  search. Today still leads with its times.
- **C, skip the question.** The press opens the start sheet on the last job, with **Change the
  job**. One press fewer when the guess is right.

**The owner's pick, 2026-11-19:** *I like C and then if they click to change the job it should
show B.* **Built, v2.7915**, as one change. Two things differ from what was drawn:

- **The order.** The mock-up put the team after every job with a day. On the owner's own rows that
  put April's jobs above the ones he joined this month. A job is now placed by its newest sign,
  and a team's sign is the day the person joined it. A job is still named by its best sign, so a
  clock says its day and a team says *on the team*. The guess is unchanged: the newest clock or
  scheduled day, never the team.
- **The guess is made in the sheet, for every door.** The Dashboard's press, the header's search
  and the Documents tab all open the sheet with no job, so all three open on the last job. The
  sheet asks first only when a job is on today's schedule or the person has no clock and no
  scheduled day. Job Mode's wide press says *On your last job, or one you pick*.

### Is this the best we can do?

Asked after the render, at 375 by 812 and 1180 by 720, light and dark. Nothing ran off the side of
a screen and no window was taller than its screen.

What the look changed:

- The desk window hangs from near the top, not the middle. Six rows did not fit under a centred
  window on a short screen, and a window at one height stays put while typing shortens the list.
- A row says how it knows only when it is not a clock. A plain day means they clocked onto it.
  *scheduled Nov 14* means it was on their schedule, which does not prove they went.
- *on the team*, not *your team*.
- B is shorter than A on a phone, 603 tall against 696 with the same six rows. The link's two lines
  and the search's label go.

What was weighed and lost: one flat list with no headings (Today's times earn their heading). A
menu that drops from the press at a desk (the window opens from four doors and three have no press
to hang it from). Rows as one ruled list (the boxed row is shared with the search and Near you).
Cutting the first sentence (it is the owner's rule in words). C, since the Dashboard's square has
no line to say where the map lands, and a wrong guess is a map on the wrong job.

**The owner's word on calls 14 and 15, 2026-11-19:** *Yes, build it*, then *help me build* both.
**Built, v2.7920**, as one change. What the rows said before it was written, read the same way:

- **Changed jobs.** A person's newest 200 changes cover 20 jobs or more for everyone who works at a
  desk: Taunya 52 jobs in ten days, the owner 30. So the read is the newest 200 rows by who made
  them, with no function of its own, and one index.
- **Coming up.** The field's schedule runs days ahead, not weeks: a superintendent has five jobs in
  the next two days, a lead two, two helpers one each. So Coming up holds four and looks two weeks
  out.
- **The office job.** Every office person has a block on the company's office job each working
  day, 38 blocks in the next two weeks. Left alone it would be the one row under Coming up for
  the whole office. It was already under Today, where it stopped the sheet from opening on a last
  job, and the Dashboard's press landed on it. The app knows which job it is (People → Overhead).
  So no list offers it and no press lands on it, and the search still finds it. This takes back
  one line of the first read above, that the catch-all job is listed because it is a real job.

- **The guess, held to two weeks.** With the office job out of Today, the sheet would have opened
  for Taunya on a job she clocked onto on Aug 21, over six jobs she changed today. So the sheet
  opens on a last job only when the person was there in the last two weeks. An older one is asked
  about, with that job in the list. The owner's own guess, last Saturday's job, is unchanged.

Asked again of the real window after the build: a row under Coming up says only its day, with no
word over it, since the heading says how the app knows. *changed* is one word for every kind of
change, a payment taken as much as a field edited, because the row has room for one. The guess was
left as it was in v2.7920: a job a person only changed, or has coming up, was never opened with no
question. Call 16 then changed the second half.

What is still weak: a person on no job yet still meets
a sentence, though it now names the two presses above it. That the search belongs on top on a
phone rests on the belief that what is found today is drawn under the box, where the keyboard
sits, and that is not yet tried on a real phone.

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
   already placed. **Built last, v2.7869.**
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
12. **The picker's window: A, B or C** (2026-11-19, `picker-mockup.html`). B, built as two changes:
    the list first, since it is what was asked, then the refit. **The owner picked C, with B
    behind Change the job. Built, v2.7915.**
13. **What "was on" counts.** Clocked onto at any age, on the schedule on a past day, then on the
    team, in that order. A row that is not a clock says so. **Built as picked, v2.7915**, with the
    list's order by each job's newest sign.
14. **The jobs an office person changed in the app.** Yes, as a third step, since it is the
    truest list for the office: Taunya changed 52 jobs in ten days and is on the team of 4. Its
    cost is one index on `job_activity_events`, a migration. **The owner said yes. Built,
    v2.7920.**
15. **Jobs coming up on the schedule.** Not asked for and not drawn. Worth a line of their own
    under Today later, since a way-in map is most use the day before. Leave it out of this build.
    **The owner asked for it the same day. Built, v2.7920**, as **Coming up** under Today.
16. **Should the sheet open on tomorrow's job?** With nothing today, the sheet opens on the last
    job the person was at. A job on tomorrow's schedule may be the better guess, since the map is
    most use the day before. Leave it: a wrong guess is a map on the wrong job, and tomorrow's job
    is the first row behind **Change the job**. The other choice is to open on the soonest job
    coming up and say *The next job on your schedule, tomorrow.*
    **The owner picked the other choice: *Open on tomorrow's*. Built, v2.7933.** The sheet opens
    on the next job on the schedule inside a week, the first stop of its day, and on the last job
    only when none is coming up.

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
   is left of the old share step. The press is the Share sheet's own. It was built against the
   sheet's older press, the same day the sheet got its instant one (#394 step 3). #394's walk on an
   iPhone simulator found the band still making the link first, and saying *The link is ready.
   Press Open Messages.* after Messages had opened. The fix is #394's, in #8856: the phone
   picks the link's code, so Messages opens inside the press, and the band takes that note back
   once the page is left. The walk on a real iPhone and a real Android phone is still to do,
   together with #394's.
4. **The picker** (L). **Built, v2.7868.** **Which job is it for?** opens first when a map is started
   with no job: today's stops, the jobs clocked onto in the last 45 days, then a search of every
   job, with a job the person may not paint on listed grey with its reason. *For* leads the start
   sheet with **Change the job**. *Leave it on no job* is gone from every door. **Move it to another
   job…** joins *Rename this map*, and **Put it on a job…** opens the same picker. **Draw it by hand**
   and **Start with a place** are above the fold at 812: the sheet is 775 tall. That was measured in a desk browser, where the page box and what shows are the same. On an iPhone the foot sat under Safari's bar until v2.8578, which ends the sheet at the bar and lets it scroll: see the walk of 2026-11-25.
   One way onto no job is kept, and it is not in call 3: with no signal the lists cannot be read,
   and a person on site must still be able to paint. The picker then offers **Paint now and pick
   the job later**, and the map waits for **Put it on a job…**.
5. **Find the jobs near me** (S). **Built, v2.7869**, on the owner's word to build every step. A press in the
   picker reads the phone once and lists **Near you** the jobs at the placed addresses within about
   five miles, nearest first, up to six, each with how far. A job under Near you is not said again
   under Today or Lately. The list says it holds only jobs the app has placed.

6. **Your last jobs** (S). **Built, v2.7915.** The list's order, its names and its cap in
   `paintedMapJobPicker.ts` with tests. The three reads in `paintedMapJobPickerIo.ts` are made at
   once on every open, not only when the list is short: one rule, one order, and seven reads
   where there were five. The guide, the Glossary's lines, a release note and a fragment. No
   migration.
7. **The window refitted** (S). **Built, v2.7915**, with step 6: the search on top with **Near
   me** beside it, the desk's window for the picker and the start sheet, and no *phone* in the
   words at a desk. The sheet opens on the last job (`pickerGuess`).
8. **The office's changed jobs** (S, one migration), on call 14. **Built, v2.7920.** A fourth
   sign in `pickerLastOrder`, read from `job_activity_events` by who made the change over the new
   index `job_activity_events_actor_occurred_idx`. A row says *changed* over its day. The read
   fails soft, so the list is drawn without it.
9. **Coming up** (S), on call 15. **Built, v2.7920**, with step 8. The schedule's one read now
   runs from two weeks ahead back, and `pickerPlan` splits it at today. The office job is left
   out of every list and off the press.

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

## The walk on a real phone, taken off

**Taken off, 2026-11-25.** The Android half of the walk on two real phones (the Dashboard's press, the picker with Find the jobs near me, and Text it from my phone… under the Saved band, on a real Android phone) was taken off on the owner's word and was never done on a real phone. The walk on a real iPhone still stands, and so does the owner's answer to call 11.

## Walked in a simulator (2026-11-25)

Walked on 2026-11-25 in an iPhone simulator, in Safari at 402 by 874 points, in dark, as the dev, on the live site. It is a simulator and not a real phone, so the walk on a real iPhone still stands. One ZZ Test map was made on the test job and thrown away after. Nothing was sent.

**Holds.** The press is on the Dashboard with no clock-in and nothing on the schedule, in a top row that fits the screen. One press opens the start sheet with a job set, the line that says why, and **Change the job**. The picker has the search, **Near me** and *Your last jobs*. **Near me** lists the nearest jobs first, each with its distance, and a job listed there is not said again below. **Draw it by hand** opens the picture at the job's address, and the screen says the map is saved on **Save the map** and not before. The **Saved** band has its one blue press. **Text it from my phone…** opened Messages in that one press with the words and the link written. **Throw this map away** asks first.

**One fault found, read in the code the same day, mended in v2.8578 and not yet seen in the simulator: the start sheet's foot was under Safari's bar.** On a plain job **Start with a place** is cut, with only its top edge showing. On a job in a development, which adds a row of two chips, **Draw it by hand** sits at the fold and **Start with a place** is out of sight. The sheet is sized to the whole page box, which on an iPhone runs under Safari's bottom bar (`paintedSheetFrame.ts`), so a sheet shorter than that box has nothing to scroll. The plan's line that both presses are above the fold at 812 was measured in a desk browser, where the two are the same. The mend is the client alone, and the job picker shares the frame: on a phone the scrim is now the part of the page that shows, so the sheet ends at Safari's bar, and at the keyboard, and scrolls inside. The sheet itself is no shorter, so a plain job's last press may still take a short scroll.

**The sheet keeps its height: answered 2026-11-25 (UTC) in the managing session.** The mend ends the sheet at Safari's bar and lets it scroll. It does not make the sheet shorter, so **Start with a place** may still take a short scroll on an iPhone. Asked *"Do all the picks on round 2, rows 1 to 22, stand?"*, the answer was "Yes, all picks", quoted from that session's record of the user's answers. The row read: *#392: if **Start with a place** still takes a short scroll on an iPhone, that is fine*, and the pick was fine. So the simulator's look reads only that both presses can be reached above the bar.

**Seen, and it is as built or the phone's own.** **Near me** asks twice the first time, Safari's own question and then the site's. The short orange bar at the top of the **Paint a map** square is the painted line's own mark, the same bar that marks a painted map in every list.

**Not walked.** A tech's shape in Job Mode and the office's quiet link, which need View as. The two short pages of call 11. A text that is sent.

## As a leader, the office and a helper, in a simulator (2026-11-25)

Seen on 2026-11-25 in the same simulator through View as the sample leader, the sample assistant and the sample helper, looking only, on the owner's yes.

- **Holds on the Dashboard as the leader.** The row reads Tally, **Clock In**, **Job Report**, **Paint a map**, as call 10 drew it.
- **Holds on the office's phone.** **Clock In**, then three quiet links, **Paint a map** the third.
- **Holds in Job Mode.** The helper's row is four named squares, **Paint a map** among them. This card describes a wide press with a second line that says where the map will land. The square has no second line.
- **Holds for call 11.** The short page has no Paint a map. Behind **Everything else** it is one press away.
- **For the owner's word: a leader on Dispatch Mode meets no press on the page his bar calls Dashboard.** The bar's Dashboard tab opens Dispatch Mode's home, which starts with **Clock In**, My Schedule and the money cards. The press is on the Dashboard itself, which he reaches by the header's home press. The owner's first rule was a press that is always there. Read in the code the same day: Dispatch Mode's home draws the clock, My Schedule and the money cards, with no top row, as built. The Dashboard's own row can stand there. S, the client alone, once the owner says.
  - **Answered 2026-11-25 (UTC) in the managing session.** Asked *A leader on Dispatch Mode: should Dispatch Mode's home take the Dashboard's top row (Tally, Clock In, Job Report, Paint a map)?*, the answer was "Yes, add the row (Recommended)", quoted from that session's record of the user's answers. The other way was to leave it, since the header's home press reaches the row.
  - **What it frees.** The build: the row in place of the bare clock on Dispatch Mode's home, a render smoke as a leader, and the guide for Dispatch Mode. S, the client alone, with no migration and no function. **Built 2026-11-25 as v2.8587.** Dispatch Mode's home draws the Dashboard's own top row, `DashboardPinnedQuickRow`, with the clock in its slot, so the two pages cannot drift. The Dashboard's notices are not drawn there: they stay in the Inbox tab. Held by a render smoke as a leader. Not yet seen in the simulator.
  - **What it leaves open.** Call 11, the two short pages, and the walk on a real iPhone.
- **Seen, and it is as built.** A leader with no clock and no schedule, and one job that is only *changed*, got the picker first, with that job as its one row. The sheet opens with no question only on a job the person clocked onto or had on their schedule, never on one they only changed, which says nothing of when they were there (`paintedMapJobPicker.ts`).

## Dispatch Mode's home, in a simulator (2026-11-26)

Walked in an iPhone simulator at 402 wide, looking only. A simulator, never a real phone.

- **v2.8587 holds.** As the sample leader, the bar's Dashboard tab opened Dispatch Mode's home with the Dashboard's top row
  on it: the account's Dispatch Mode column was unset, and the code's default for a leader is on. As the sample assistant,
  the home opened by address (her bar has no Dashboard tab) and drew the row too. Nothing ran off the side.
- **The row holds five presses**, left to right: a tally press, **Clock In**, a clock-plus press, **Job Report** and **Paint
  a map**. The walk's recipe named four. Read the same day: the home draws the Dashboard's own quick row whole, so five is
  as built, and the recipe's words were short by one.
- **Not called:** the Paint a map sheet was opened and scrolled but not read closely enough. To redo.
