# Job Mode in three bands: the spike (2026-11-20)

The owner picked shape B of `ASSESSMENT.md` and asked for a spike on the data that is there today, so the
before and the after can be read side by side. His rule: lose no information, put it where it is easier to
find, and keep it close to him.

Nothing is claimed or shipped. The code is on the branch `spike/crew-lead-bands`, not on `main`. No test is written
yet. `SPIKE_HANDOFF.md` beside this file says where it stands and what is left.

## How to see it

- The dev server, Job Mode on, a phone width. A dashed strip on top reads **Spike: Job Mode** with **Before**
  and **After**. It draws on the dev server only.
- Or the address: `/dashboard?bands=1` switches a device to the bands page and `?bands=0` switches it back.
- The screenshots show real names, so they are not in the repo. They stay on the computer that built the spike.
  `SPIKE_HANDOFF.md` says how to make new ones.

## What the page is

Four bands, top to bottom. Every piece is the component the page has today.

1. **My job.** The job card. It names the job, the place and the crew before the clock is on the job. The
   day's row of squares sits inside it, under the job's name. Its lower half is one press away, behind
   **Open this job**.
2. **Around me.** Who is on the job with him and when they clocked in. The two newest lines written on the job,
   with the clock punches left out. His next seven days as a strip. **The company today**, which is Crew Day
   behind one line.
3. **Waiting on me**, with one count. One row for each thing asked of him: the days he led with no report, his
   crew to rate, card charges with no job, his truck's mileage, a course to do. Your record's other rows join
   the same list.
4. **Everything else.** Each remaining piece of the page is one line that says what is inside and opens in
   place: My crew, My Schedule, My hours, Training, Quick buttons and pins, My truck. Then **Show full
   dashboard**.

A closed line stays mounted, so its reads run and its presses land where they landed.

## Nothing lost

Every piece of today's Job Mode page, and where it is on the bands page.

| Today's page | The bands page | Presses away |
|---|---|---|
| The day's row of squares | Inside My job, under the job's name | 0 |
| Quick buttons and pins | Everything else, **Quick buttons and pins** | 1 |
| The job card's head | My job. It names the day's job where it said *No job or bid linked yet* | 0 |
| Job calendar, Materials on site | Where they were | 0 |
| Today's list | Where it was | 0 |
| Hand the phone to the customer | Where it was | 0 |
| Paint a map, Place on this job, Photos, Ticket, Customer, Job detail | **Open this job** | 1 |
| Job updates and its note box | **Open this job**. The two newest lines also show in Around me | 1, and 0 |
| The trip question and banner | Where they were | 0 |
| Your record | Waiting on me, as rows | 0 |
| Your week | Under Around me, when the office set one | 0 |
| The hours card and the missed day door | Everything else, **My hours**. The line says the week's hours | 1 |
| My Schedule, today and tomorrow | Everything else, **My Schedule**. The week is a strip in Around me | 1, and 0 |
| Training | A row in Waiting on me, and Everything else, **Training** | 0, and 1 |
| Show full dashboard | The foot | 0 |
| The press bar and the tabs | Unchanged | 0 |

Checked by its words, not only by eye: the old page drew 64 distinct lines of text that day. With every line
of the bands page opened, 57 of them are on it word for word. The other seven:

- *Clocked in* and *No job or bid linked yet* are now the job's own name under **Clocked in · today's job**.
- *Your record* and *one thing only you can fix* are now **Waiting on me** and its count.
- The two lines of the report ask are now the first row of Waiting on me. It counts days, names who he was
  with, and keeps the hours he worked the job that week.
- One line differed only because the hours ticked up between the two shots.

What takes a press more than it did: the quick buttons, My Schedule's cards with their **Leave Report**,
**+ Add job** and **Calendar**, the hours card and its bars, and the job's full feed with its note box. Training's
**Start** is two presses where it was one. A note half typed in the job's feed is dropped if **Open this job**
is folded shut, as on the short page today.

The full Dashboard is untouched behind **Show full dashboard**.

Brought forward from the foot of the full Dashboard, 13 to 15 screens down today:

| What | Where it is now |
|---|---|
| Reports owed for each day he led | The first row of Waiting on me, and **My crew** |
| His crew to rate | A row of Waiting on me. **Rate** opens the deck |
| His crew's hours | **My crew** |
| His truck: mileage, oil, problems | A row of Waiting on me, and **My truck** |
| Crew Day | **The company today**, in Around me |

New on the page: who is with him today, when they clocked in, the latest on the job without the punches, and
his week as a strip. The card charges are a sentence where they were a badge.

## What it measured

The dev server on fresh `main`, signed in as him through the app's View as, every table write refused.

| | Before | After |
|---|---|---|
| A job ahead, 390 px | 2.6 screens | 2.6 screens |
| On site, 390 px | 3.8 screens | 2.7 screens |
| A job ahead, 320 px | 4.1 screens | 4.1 screens |
| With every line opened, 390 px | | 8.7 screens |

The page is no longer and holds his crew, his week, the company's day and five asks that were not on it.

Pressed on his page, nothing saved: **Write it** opens the report window on the day owed, **Rate** opens the
rating deck, the training and truck rows open their lines, **Open this job** shows the photos, the customer
and the job's updates. The only write the page tried was its own press count, which the walk refused.

## What the spike did not change

- **The press bar.** It still leads with On my way and still shows a dead press. On 2026-11-21 the owner
  picked *follow his day* for a day with one job. It is not built yet; `SPIKE_HANDOFF.md` says what it is.
- **The header, the install banner and the trip question.**
- **Two things said twice.** On site, Materials on site and the On site square are one door. The My spend
  square carries its badge beside the card charges row.
- **The report count's two rules.** Waiting on me counts days, as My crew does. Your record's own report row
  is left out for a job a led day already asks about, and stays for any other job.
- **A lead still cannot set the job's percent** from Job Mode.

## Who would get it

Nobody, yet. The switch is a device's own.

Counted on 2026-11-20, real accounts that are not archived (41 in all):

- **The Leader role** (`master_technician`) holds one real person, and he runs Job Mode. Given to that role,
  the page reaches one phone.
- **Everyone who ran Job Mode in the last 32 days** is nine people: five helpers, one subcontractor, one
  superintendent, the one leader and one dev. Job Mode is on by default for all 28 helper and subcontractor
  accounts, and six of them opened it.
- The page was walked as the leader alone. A helper or a sub would see a shorter page: My crew and the rating
  row show only for somebody who led a job-day, The company today only for the roles that have Crew Day, My
  truck only for somebody holding a vehicle. A superintendent on Short has his own short page today.

The assessment proposed a rule by the day: a day with one job gets this page. On 2026-11-21 the owner picked
the Leader role alone, first, instead. That rule is not built yet: the switch is still the device's own.

## The code

New, all under the spike:

- `src/lib/jobMode/bands.ts`: the rule and every word of Around me and Waiting on me. Pure.
- `src/lib/jobMode/bandsSpike.ts`: the device switch.
- `src/components/jobMode/bands/JobModeBandsPage.tsx`: the page, its bands and its lines.
- `src/components/jobMode/bands/useBandsReads.ts`: four reads other screens already make.

Touched, each by a prop that changes nothing while it is unset:

- `DashboardJobModeCard.tsx`: `bands`, `onDayJob`, `underHead`.
- `JobModeTopRow.tsx`: `onHours`.
- `DashboardPinnedQuickRow.tsx`: `jobModeRowElsewhere`.
- `DashboardYourRecordCard.tsx`: `bare`, `omitReportJobs`, `onCount`, `onReportHours`.
- `DashboardMyVehicleCard.tsx`: `onReadingAsked`.
- `Dashboard.tsx`: the switch, the strip, and the bands return ahead of the Job Mode return.

No database change. No new table read: his crew and their clock come from `get_supervised_days_payload`, the
rating from `get_supervisor_review_deck`, his week from his own `job_schedule_blocks`, the job's lines from
`list_job_activity_events`.

## Owed before it could ship

- Tests: the kernel, a render smoke of the page, and the props added to five components.
- The page reads My crew's week twice, once for the bands and once inside the My crew line. One read should
  feed both.
- A role with no crew days and no vehicle gets a shorter page. It was walked as one person only.
- A help guide, a release note and the developer fragment.
