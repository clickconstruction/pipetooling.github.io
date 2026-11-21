---
name: "Job Mode's top row: named squares that follow the day"
number: 409
group: close
status: asked 2026-11-20 on the owner's phone walk · assessed and drawn three ways the same day · the owner picked C, the day's row · built as v2.8047, merged and live · the hours square seen with real hours the same day, read only, and one fault found and fixed in a PR of its own (#9127) · the Short view of Job Mode drawn with and without the row · carded after the build, so the mock-up has a home · left: one call for the owner, and a look on a crew's phone
summary: >
  In Job Mode on a phone the row under the header was a blue square with no name and a Paint a map
  card as wide as the screen. The owner asked what better use the row could have. Three ways were
  drawn beside it, and he picked the third. The row is now equal named squares. Two belong to the
  job the day points at and change with the day. Two are the person's own and never move. A fifth
  shows only on a site that holds boxes. The Short view of Job Mode still draws no row, and whether
  it should is the one call left.
next: The owner answers the call on the Short view. Then somebody looks at the row on a crew's phone at the end of a day, and the card is deleted.
size: S, built as one client-only PR, with an XS fix after it
blocker: The owner's answer on the Short view.
ver: v2.8047
opinion: your call — the row is built as picked, and my pick for the Short view is no row
---

# Job Mode's top row: named squares that follow the day (#409)

The mock-up is [`mockup.html`](mockup.html). Its names, job numbers and addresses are made up. The repo is
public, so nothing on it or below is a real name. The page the owner saw held two tables of counts from the
app's press record. They are written here as words on his word of 2026-11-20, *Yes, counts as words*.
The page as he saw it is a private artifact: *Job Mode top row* — https://claude.ai/artifact/V27DkNqo3ThWrtxoajjkYM

This card was written after the build. The session that built the row made no card, so the mock-up sat
untracked in its worktree. It is here so the three options and the reasons do not live on a chat link alone.

## The ask

The owner, 2026-11-20, from a walk of the app on his phone, with the row circled on a screenshot:

> in Job mode I don't think that paint a map should be this big on the screen, is there more things that we
> can offer in the header on mobile that would be useful?

## What the assessment found

The row was the full Dashboard's row with the clock and the report taken out. It was never drawn for Job
Mode. It held a blue square with no name, the door to My spend, and a Paint a map card as wide as the screen.

The app's press record for helpers, subs and the superintendent over 31 days said this, in words:

- About one field account in five opened the app, and nearly all of their time in it was on the Dashboard.
- The job's window was the door opened most. It sat a scroll down the card.
- My spend and Paint a map, the two things the row held, were the two opened least.
- Nobody in the field added a photo or answered a checklist in that month.
- Nearly every working job holds no boxes, so Materials on site does not earn a fixed square.

## The three options

Each is drawn on the mock-up beside the old row, for a day with jobs and a day with none.

- **A · A quiet line.** The row goes and the job card rises. Three named links sit under the card.
- **B · Four named squares**, the same every day: My spend, This week's hours as a number, Photo and Paint a map.
- **C · The day's row.** Two squares for the job that change with the day, and two of the person's own that
  never move. **The owner picked C.**

Weighed and left out: the person's own quick buttons, since only a leader, an assistant or a dev has any.
Calls to the office and to dispatch, which the header already holds. The customer's number, which the card
holds once the person is clocked in. Turnaway, Leave report and Clock In, which are on the press bar.

## What shipped

Built as v2.8047 (PR #9051). The fragment `docs/recent-features/v2.8047.md` is the full record.

- **A stop still owed, or on the way to it:** Directions, Job details.
- **On the job:** Photo, Job details, and On site with the site's box count when the site holds boxes.
- **No job left today:** This week with the hours so far, Tomorrow with the count of jobs.
- **Always, at the right end:** Paint a map, My spend.

Each square records its press as `job-mode-row`, so the next look at this row has counts of its own.

## The look that followed

The build closed with a note that the hours square had never been seen with a number. It was seen the same
day on the dev server against the live data, as people who had hours on the clock that week, through the
app's own View as. Nothing was written as them. It was looked at 390 and 320 px wide, in light and in dark.

- The square's number was the number in the hours card's line in every case: part way through a week, over
  the hours, salaried on the default week and on a set week, an answer with nothing on the clock, and no
  answer at all.
- A very long number did not clip at 320 px wide.
- The press brought the hours card into view above the pinned bar.
- **One fault.** The hours card read its week once, when the page opened. A person who clocked in and out
  on the same page saw the square read a day short. PR #9127 makes the card read again when the clock
  changes, with three tests for a hand-off that had none.

Not fixed, and small: while a person is clocked in, the number is the hours up to the last read. The square
says *jobs* for tomorrow and the Short view's own line says *stops*.

## The call for the owner

**Should the Short view of Job Mode get the row, some of it, or none?**

The Short view is what a superintendent on the Short Dashboard view sees with Job Mode on (#384, closed). It
was built as one screen for a man who said the page overwhelmed him: the job card's top, what waits on him,
tomorrow in one line and one door, **Everything else**. It draws no row, by design. Nobody is on Short yet.

The Short view was drawn with the row and without it, on a morning with five stops, read only.

- The row costs about 80 px and four presses. On the bigger phone that pushes **Tomorrow** and
  **Everything else** off the first screen. On a small phone the row alone is over a quarter of what shows
  between the header and the pinned bar.
- With no job left, the row is wrong for this page. **This week** has no number, because the Short view
  never reads the hours, and its press has nowhere to land. **Tomorrow** is said twice.
- What the Short view lacks today is narrow: Directions and the job's window before a job is on the clock.
  Everything else the row holds is one press away, in **Open this job** or behind **Everything else**.

**The pick: no row.** The page was made to take things away, and nobody has used it yet. The first
superintendent on Short should be asked what he looks for first, as #384 left it. If something is wanted
before then, the smallest honest piece is the job's two squares alone, shown only while the day names a job.
Paint a map on the short pages is the same question as call 11 of #392, and one answer can settle both.

## Where it plugs in

- The rule and every word: `src/lib/jobMode/topRow.ts`. The reads: `src/lib/jobMode/topRowIo.ts`.
- The row: `src/components/jobMode/JobModeTopRow.tsx`, mounted by `DashboardPinnedQuickRow` in the Job Mode
  return of `src/pages/Dashboard.tsx`, which hands it `jobModeDay`.
- The hours come from `DashboardMyHoursBlock` through `onWeek`. The square has no read of its own, so a page
  that does not mount that card shows the square with no number.
- The Short view: `src/lib/jobMode/jobModeShort.ts`, `src/components/jobMode/JobModeShortPage.tsx` and
  `shortPageFor` in `src/lib/dashboard/shortDashboard.ts`.

## How to verify

Start the dev server and sign in with the dev-login. Use the app's own View as for a field person, and
refuse every write to a table in the browser so nothing is saved as them. Turn Job Mode on. The square
shows only on a day with no job left. A day's states can be drawn with no write by answering the page's own
reads: today's schedule blocks left out, and the open clock read as closed. For the Short view, answer the
read of the person's Dashboard view with Short.
