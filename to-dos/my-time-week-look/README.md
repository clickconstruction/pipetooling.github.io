---
name: "My Time: the week and the eight weeks, redrawn"
number: 427
group: close
status: asked 2026-11-23 · five options drawn, then one picture on the owner's word, no quota on this card · his go the same day, *build it all* · the picture in My Time v2.8338 and Job Mode's card v2.8347, with the old hours block retired, both live the same day · walked live 2026-11-24 through View as on a ZZ Test person with no hours, where it holds · left: a look with real hours through View as, as a salaried and an hourly person
summary: >
  On the Dashboard's My Time card, the asker did not like how two parts look: a row of eight small
  bars with a four-colour caption, and seven lines of text for the week's days. Reading them found
  that both also say things that are not true. A finished day reads On Shift with its hours
  hidden, and a week one hour over reads red. On his word, the card stops grading time against a
  quota. The second mock-up is one picture: the week's time as a big number, a column for each
  day, and a column for each of eight weeks that opens that week's days.
next: A walk as a salaried and an hourly person through View as, on the full Dashboard and in Job Mode, which step 3 of working hours' [`LIVE_TEST.md`](../working-hours/LIVE_TEST.md) covers for an hourly person. Then the card closes on the owner's word.
size: M as a train of two (M · S); left: a look with real hours (XS)
blocker: A look with real hours.
ver: v2.8338, v2.8347
opinion: your call — both PRs are built, and what is left is one look with real hours on the clock
---

# My Time: the week and the eight weeks, redrawn

The pick is [`mockup-time-added-up.html`](mockup-time-added-up.html), the second round. The first
round, five options, is [`mockup.html`](mockup.html). On both, a bar at the top switches the person,
the moment, the width and the theme: salaried or hourly, early Monday or Wednesday afternoon, 375
or 320 px, dark or light. Every person and every hour is made up. No pay is drawn.

This card is separate from [`working-hours`](../working-hours/README.md). It needs nothing from
that plan. *How it meets working hours* below says what it gains if that plan is built.

## The ask

Asked 2026-11-23, with a screenshot of a salaried leader's Dashboard on a phone, in dark:

> On the dashboard, under My Time, I don't like how these two sections look. How could we improve
> it visually for a user? Help me come up with some mock-ups.

Two things were circled. The first is a row of eight very small bars under the *Salaried: your week
is 40 h* words, with a caption in four colours. The second is the panel under it: seven lines of
plain text, one a day.

## What each part is for

**The eight bars** are the person's last eight pay weeks, the newest on the right. They are drawn
by `UtilizationWeekBars.tsx` inside `DashboardMyHoursBlock.tsx`, from `utilization.ts`.

| What is drawn | What it means in the code |
|---|---|
| A bar's height | The week's recorded hours against the person's week, cut at 150 percent. The bar is 30 px tall, so 5 percent is 1 px. |
| The dashed line | 100 percent. Nothing on the screen says so. |
| Red, *over* | Anything above 100 percent (`utilizationBand`). |
| Green, *full* | 85 to 100 percent. |
| Blue, *steady*. Amber, *light* | 60 to 84 percent, and under 60. |
| The striped stub | This week, still running, at 55 percent strength under a hatch. |
| The numbers | Only in each bar's hover title. A phone has no hover. |

**The seven lines** are this pay week, Sunday to Saturday, from `renderHoursByDay` in
`DashboardMyTimeSection.tsx`. An hourly person's line shows the day's hours, and is a press that
opens the day while it can still be edited. A salaried person's line shows *On Shift* in place of
the hours. A day with no time shows a dash.

## What the screen says that is not true

These come first. They are faults in the words and the rules, and a new look alone would keep them.

1. **A finished day reads *On Shift*.** The label is drawn for any salaried day with time on it
   (`useOnShiftDayLabel && sec > 0`). It does not ask whether the person is on the clock now. So a
   Sunday that ended hours ago reads *On Shift* while the tile above it reads *Today 0m*.
2. **The hours that matter are hidden.** A salaried day never shows its hours. In the case that was
   circled, the day's time was a hand punch on a day off that nobody closed, and the end-of-day
   stop closed it at 11:59 PM. The one line that should have stood out read the same as a normal
   day. The office's approval screens already name this case (`MIDNIGHT_CAPPED_CHIP` in
   `approvalsSessionChips.ts`). The person's own card does not.
3. **That time is counted as the week.** *This week N of 40 h so far*, the *This week* tile and the
   last bar all count it, with nothing to say it is one stray punch.
4. **One hour over is red.** *Over* starts at anything above 100 percent. A salaried person who
   clocks in a few minutes before their start twice in a week lands an hour over 40, and the week
   turns red. A week at exactly 40 is green. On the account read for this card, every red week was
   within a few hours of the person's week, from short punches outside their day.
5. **The colour flips while the height does not move.** One hour over 40 is under half a pixel of
   height. So two bars that look the same height are red and green.
6. **This week is judged against a whole week.** Its percent is the hours so far over the full
   week, so the stub reads *light* in amber every Monday to Wednesday, for everyone.
7. **A dash means four things.** A day off, a day still to come, today before the start, and a
   working day with nothing on it. For a person whose week is *8 h Mon to Fri*, Monday's dash and
   Saturday's dash are not the same fact.
8. **Found in passing.** *Today* is taken from the phone's own date (`toLocalDateString(new Date())`),
   while each session's day is the company's. `docs/TIME_AND_ZONES.md` asks for `todayYmdInAppTz()`.

## What is only a visual fault

- The bars are 10 px wide and 30 px tall. On a phone they wrap under the words and sit at the right
  end of a box as wide as their caption, so they float off-centre with empty space to their left.
- No week is named. Nothing marks which bar is this week except the hatch.
- The key is four coloured words. Colour is the only carrier, and the key names colours that may
  not be on the strip at all.
- The seven lines have no column for their values, no mark on today, and a 24 px pitch.
- The same number is said twice in two forms: the *This week* tile and *This week N of 40 h*.

## What a person wants from the card

The asker, 2026-11-23, after the first round:

> I don't think a user cares if they are above or below their quota. I think a user wants to see
> how much time they're accumulating and what days they accumulated what.

He means the Dashboard. People, **Utilization** is the office's screen and keeps its hours and its
bands. So the first round asked the wrong question. It drew *am I on track*, which is a grade. The
card's job is to count: **how much time have I added up, and on which days**.

## The pick: one picture

[`mockup-time-added-up.html`](mockup-time-added-up.html) draws it beside the card as it is today.

- **One big number**, the time added up this week, with today's time beside it. The two tiles and
  the sentence that said the same thing are gone.
- **Seven columns**, one a day, each with its time under it in hours and minutes. Today is boxed.
  A day to come is faint and empty. A finished day with nothing reads *0h*.
- ***On the clock since 8:00 AM***, one line, only while a session is open.
- **A day with trouble** is marked, and one line says what happened and who fixes it.
- **Eight weeks**, one colour, each with its time on top and its Sunday under it. A press on a
  week, or on the arrows above the days, changes the days to that week. So **Last week** is no
  longer a press of its own, and any of the eight weeks can be opened.
- **No quota.** No *your week is 40 h*, no *N of 40 h*, no percent, no target line, no over or
  under, no colour bands.
- **An hourly person's Change** stays as one quiet line at the foot, since the office needs the
  answer for Utilization.

Columns scale to the tallest one shown, never to a quota. Measured in the browser in 48 states,
both people, both moments, both widths, both themes and three weeks chosen: nothing is clipped and
every press is 44 px tall.

## The first round's options

Kept for the record. All five compare time with the person's hours, which the asker set aside.

**The eight weeks**

- **A. Eight weeks, labelled.** Full width. Each week has its hours on top and its Sunday under it.
  A dashed line is the person's week, and one line under the strip says so. A week more than an
  hour off says by how much. This week is boxed and drawn hollow, so it is not judged yet. One
  colour.
- **B. A count, then the weeks.** No chart to decode. Three counts: at your hours, over, under.
  Then one line a week with its hours and the difference in words.

**The seven days**

- **C. Seven cells in a row.** One glance across the week. Each cell has the day, the date, a
  column that fills, and the hours over the day's own hours. Today is boxed. A day to come is a
  dashed box with its hours. A day off is hatched. A day with trouble is marked and named in words.
- **D. A line a day.** The same facts as words, with the values in a column. Taller, the easiest
  to read aloud, and each line is 44 px.
- **E. One bar for the week.** The whole week as one bar, a piece for each working day, with a mark
  where the hours should be by tonight.

Every day option opens with a sentence that answers the question: *On track*, *2 h behind*,
*Your week starts today*, or *Nothing on the clock yet this week*. A day with trouble gets its own
line in words under it.

## What changes under the look

The pick needs these, and no migration:

1. A pure kernel, `src/lib/dashboard/myTimeWeeks.ts`: eight weeks of seven days, each day's time,
   which day is today, which are still to come, and which hold a session the end-of-day stop
   closed. That last rule is already in `approvalsSessionChips.ts`.
2. One read. `fetchMyUtilization` already reads the person's sessions for eight weeks, and
   `DashboardMyTimeSection` reads this week and last week again. The picture needs the eight weeks
   once.
3. *On Shift* goes. *On the clock since* shows only for a session that is open now.
4. A salaried day shows its time, like anyone's.
5. *Today* comes from the company clock.
6. The job-by-job fold, **This week detail**, follows the week chosen for this week and last week,
   as today. An older week shows its days only.

Nothing here needs a person's set week, their answer or a quota, so the picture is the same for a
salaried person, an hourly person and a person who never answered.

## How it meets working hours

It does not depend on that plan, and that plan does not change this picture. If working hours are
built, the person's start and end belong on one quiet line at the foot, where an hourly person's
**Change** sits today: *Your hours are 6:00 AM to 12:00 PM, Mon to Fri*. They are a fact to read,
not something the columns are measured against.

## Who sees what

The card is each person's own time, as today. No wage and no pay is on it. A salaried person's
time on a day becomes visible to that person, which it is not today.

## The build

Two PRs. The kernel went in with the picture, since a kernel nobody reads changes no screen.

1. **The picture in My Time (M).** `myTimeWeeks.ts` and `myTimeCanWork.ts` with their tests,
   `DashboardMyTimePicture.tsx`, `MyTimeCanWorkLine.tsx`, the section on one read, the `.myTime…`
   styles, and the guide *see the time I have added up*.
2. **Job Mode's card (S).** The hours card under Your record takes the same picture, which still
   feeds the *This week* square. `DashboardMyHoursBlock.tsx` goes.

## The asker's calls

His go of 2026-11-23, *build it all*, kept every pick.

1. **The two tiles go into the picture.** They were not circled. Pick: yes, since the big number
   and *Today* are the same two facts.
2. **Last week.** The press goes, and any of eight weeks opens from the picture. Pick: yes.
3. **An hourly person's Change.** One quiet line at the foot, or off the Dashboard and onto My
   Time's own page. Pick: the quiet line.
4. **A salaried person sees their own time a day.** Pick: yes. It is their own time, and hiding it
   is what hid the stray punch.

## How to verify

- Both mock-ups: no value clipped and nothing outside its frame, measured in the browser on
  2026-11-23, the first in sixteen states and the pick in 48.
- After the build: View as a salaried person with a workday schedule, and as an hourly person who
  drew a week. Read the panel on a Monday before the start, mid-week, and on a day after a punch
  was left running. Nothing is written by the walk.
- **Walked 2026-11-24** on clicktooling.com at 730 px, through **View as** on a ZZ Test person who has no
  hours: one large number, seven day columns, eight week columns, a week's press opens its days with
  **Back to this week**, no over or under colours, and no sideways scroll.
- **Still to walk: the look with real hours.** A salaried person, an hourly person who drew a week, and a
  day after a punch was left running. No ZZ Test person has hours. Two ways to get there, and the pick is
  the owner's: **View as** two real people, which writes nothing, as this card's own step has it, or hours
  put on a ZZ Test person through the dev seat first.
