---
name: "A trip record: days at a site away from home, apart from the hours on its jobs"
number: 379
group: ready
status: built 2026-11-17 and 2026-11-18 in its own session, all of it on main · the rules (v2.7653), the tables (v2.7655), the Trips look (v2.7661), the dev seat (v2.7670), Looks like a trip (v2.7676), the Job window line with the clock tag and the By date lane (v2.7685), the phone's ground (v2.7700) and its screen (v2.7701), What it cost with the Scoreboard cut and the trip log (v2.7702), the trip's number (v2.7703) and the number and the link on screen (v2.7707) · every migration pushed and dev-mcp deployed, read 2026-11-18 · Put on a bill is built on its own card, #391
summary: >
  On a job out of state the clock's hours do not say what the owner needs to know. Some hours are a crew
  at the site, some are a truck on the road, some are a person at home loading what the trip needs. All of
  them may be billable to the job, and only some are a trip. Today the one way to set a trip apart is to
  make a second job for it. This card adds a trip as its own record on the development: the people, the
  days, each day one of three kinds, what it was for, who asked for it and how it went. The hours, card
  charges, photos and History inside its days read as the trip's by themselves, and a trip never changes a
  clock row, a bill or a cost.
next: The parts owed and in no PR yet: a setting for the 150 miles, Split in two, a combine that carries a trip's job link, and the trip's number in the dev seat's read. Put on a bill left this train for its own card, #391.
size: L as a train of nine (S · S · M · S · S · S · M · S · S), eight built and the ninth moved to #391; left: the four owed parts, not sized yet
blocker: None. The six calls each have a default.
opinion: build — the clock already stamps a place on a punch and the drive to a job, and the Development page already rolls a site's hours by person, so a trip is a reading laid over rows that exist
---

# A trip record (#379)

The mock-up is [mockup.html](mockup.html). Every screen on it is drawn by one script from one list of
made-up trips, so the band, the strip, a row and an open trip are counted from the same days. It was
rendered with Playwright at desk and phone width, in light and dark, before it was shown. Every site,
customer, person, job, date and figure on it is made up.

## The ask, in the owner's words

> Normally for a job I would look at time spent on job but because this job is out of state it seems
> more proper to be able to identify proper trips and not just hours we claim we spend because those
> hours may be us running around off the job prepping for a trip or getting stuff to bring to the job
> and while that does count as billable hours towards the job that is not a trip on site. For example,
> this trip is a part of the rough in but to isolate it we made a whole separate job.

He asked for a trip record, a plan and a mock-up, a second pass asking *is this the best we can do, is
it intuitive, does it leave the user in charge*, and every door to it drawn. He then said to build it.

## What was found first

- The app has no trip record. On the site that raised the ask, a trip was written in up to six places
  that share no key: a hand-built ledger kept as a document, prose lines in History, lines on jobs, clock
  rows, card charges by window, and sub labor sheets.
- One trip went by up to five names across those places.
- Most of one person's clock rows there were imported from pay or placed from a schedule. Such a row says
  the day was paid. It does not say where the person was.
- A trip that was part of one job had been given a job of its own so it could be seen alone.

## The decision

A trip is a record on the development. It is a reading over the clock, never a second copy of it.

- **What it holds.** People, days, a reason. Optional: who asked for it (us or them, a name, how), how it
  went, the jobs its work goes on, and billing (Inside the price · Extra · Ours).
- **Day kinds.** Each day of a trip, for each person, is one of three: **Getting ready**, **On the road**,
  **At the site**. A person can be off a day in the middle.
- **Where it stands** is read from the days and today: **Planned**, **Out now**, **Back**. Nobody types it.
- **How hours fall in.** A person's clock rows on a trip day take that day's kind. A punch that carries a
  place counts At the site only when the place is the site. A row with no place is shown as **No place on
  the punch**, its own figure, never added to At the site. Hours on the site's jobs outside every trip
  read **At home for the site**.
- **What the app may do by itself: nothing.** It may say **Looks like a trip** from a run of punches at
  the site that no trip covers. A person makes the trip, or says **Not a trip** once.
- **What a trip never does.** Changing or deleting a trip changes no clock row, bill or cost.
- **Where it shows.** The Trips look shows on a development that has a trip or that is far from the shop.
  A job with no development can hold a trip by itself.

Rejected: a job per trip (today's workaround, splits one piece of work in two); four typed dates (too
heavy, cannot show a day off); trips made by the app from the clock (the person cleans up what they never
made); counting every hour inside a trip as at the site (a paid row is not a sighting).

## The second pass

| The first sketch | What was wrong with it | The second draft |
|---|---|---|
| Four typed dates | Four fields before anything saves, no day off in the middle | Painted days, one tap a day; one person and one day is a whole trip |
| Hours on the trip, hours off it | Hid the owner's own example: loading the trailer is for the trip and not at the site | Three day kinds, and At home for the site for the rest |
| Every hour in a trip is at the site | An imported or scheduled row does not say where | No place on the punch is its own figure |
| The app makes trips from the clock | The person finds trips they never made | Looks like a trip only offers; Not a trip is remembered |
| A Trips look on every development | A seventh chip on sites that never have a trip | The look shows where a trip exists or the site is far |
| A trip needs a development | One far job alone could not hold a trip | A job alone can hold one |
| The office makes every trip | The crew knows first | The phone offers Start a trip at the first clock-in; the office can change it |

## Where it plugs in

Exists today:

- `clock_sessions` carries a place on clock in, on arrival and on clock out, and the drive stamps
  `travel_started_at` and `arrived_at` from On my way and I'm here (`to-dos/on-my-way/`).
- `address_geocodes` holds a point for an address, which is how a punch is told to be at the site.
- The Development page (`src/pages/DevelopmentPage.tsx`, kernels in `src/lib/developments/`) with its
  looks, its History (`development_history_entries`), Plans by date with a lane for the crews' days, and
  the Scoreboard with its cuts by job, part and person (`scoreboardCuts.ts`) and its site labor read
  (`fetchSiteLabor.ts`, `siteLabor.ts`).
- The Job window's Job tab and its feed, where clock lines already draw.
- The dev seat (`supabase/functions/dev-mcp/`), plan then apply.

New:

- A pure kernel, `src/lib/trips/`: day kinds, where a trip stands, the hours split, the finder behind
  Looks like a trip.
- Tables for a trip, its people with their days, and its jobs.
- The Trips look, the open trip, the sheet, the Job window line and tag, the phone's Start a trip.

## The plan

Nine small pull requests, each alone, each with its release note, fragment and guide words.

| PR | What it brings | Touches | Owed after |
|---|---|---|---|
| 1 | The rules alone | The kernel and its tests, no screen | Nothing |
| 2 | The table | One migration with the four fences, its doc, the types | db push |
| 3 | The Trips look: band, strip, rows, open trip, the sheet, History lines | Development page, a guide, `docs/twins/APP_DIRECTORY.md` if a path is added | Nothing |
| 4 | The dev seat: `read_trips`, `plan_trip`, `apply_trip` | dev-mcp and its doc section | Function deploy |
| 5 | Looks like a trip, and What shows it | The look, the kernel | Nothing |
| 6 | The Job window line, the clock tag, the By date lane | Job window, Plans by date | Nothing |
| 7 | The phone: Start a trip, Join, Heading home, End the trip | Job Mode, the clock-in sheet | Nothing |
| 8 | Scoreboard cut by trip, and Print the trip log | Scoreboard cuts, a print page | Nothing |
| 9 | Put on a bill: an Extra trip becomes a line on a job, with who asked. Moved to its own card, [#391](../trip-on-a-job-line/README.md), once the owner picked a line over a bill of its own | See that card | See that card |

The first three give a working Trips look. PR 4 lets trips already known from a ledger be filed on the
owner's word, through the dev seat.

## The owner's calls

| # | The call | The default |
|---|---|---|
| 1 | How far is a site before the look shows and the phone asks? | 150 miles from the shop, one setting; a person can turn trips on for any site |
| 2 | Do Getting ready days belong to a trip? | Yes, as their own kind, never counted as days at the site |
| 3 | May a crew member start a trip from the phone? | Yes; the office and the leader can change or delete it |
| 4 | Who sees a trip's dollars? | A dev or a controller, as on the Scoreboard |
| 5 | Does a trip ever change the clock, a bill or a cost? | No; Put on a bill is its own press |
| 6 | Is the word Trip? | Yes |

## How to verify

- The kernel: unit tests on the hours split, with a punch at the site, a punch elsewhere, a row with no
  place, a day off in the middle and a trip across a month end.
- The look: a render smoke, then a live walk on a ZZ development with seeded trips (`docs/` live-walk
  recipe), at desk and phone width, light and dark, as a dev, a master and a crew member.
- No real site's names or figures go in a test, a comment or a PR.

## Where it stands

Built 2026-11-17 and 2026-11-18, in its own session. Read on 2026-11-18.

- **On main:** the rules, the tables, the Trips look, the dev seat's three verbs (PR 4, v2.7670), Looks like
  a trip, the Job window line with the clock tag and the By date lane (PR 6, v2.7685), the phone's ground and
  its screen (PR 7, v2.7701), What it cost with the Scoreboard cut and the printed trip log (PR 8, v2.7702),
  the trip's number (v2.7703) and the number and the link on screen (v2.7707).
- **Pushed and deployed:** the three migrations (the tables, the phone's ground, the numbers) and dev-mcp.
- **Moved out:** Put on a bill is [#391](../trip-on-a-job-line/README.md).
- **Added past the plan, on the owner's word:** every trip has a number on its site (*Trip 14*), and a link
  that opens it.
- **Owed, not in a PR yet:** a setting for the 150 miles, Split in two, a combine that carries a trip's job
  link, and the trip's number in the dev seat's read.
