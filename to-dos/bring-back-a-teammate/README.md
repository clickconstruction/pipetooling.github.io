---
name: "Bring back a teammate who left: one press for the login and the roster row, a new stint, the stale rows"
number: 256
group: ready
status: card and mock-ups 2026-11-03 · nothing built · Bring back's four calls answered the same day (tenure from the day back, roadmap 90 days, wage required, training mode off) · the Away note asked the same day, call 5 (how they reach it) open
summary: >
  A tech finished their last day on 2026-11-03 and plans to come back in three years. End employment
  closes them out well, but the way back is a dev's undo, not a return. Restore brings back the login
  only; the roster row stays archived. The single start and end date pair gets written over, so the
  first stint's dates are lost. Open roadmap tasks from three years ago come back by themselves. And
  + Hire does not see archived people, so the office can make a second account with the same name,
  no hours, no logbook and a pay row that lands on the old one. Bring back is one window on the
  archived desk: a back-on date, both halves restored together, a new stint kept beside the old one,
  and the rows three years made stale (sign-in, wage, leader, licenses, paperwork). Hire finds the
  archived match and offers it. While they are away, an Away note the office writes person by person
  (a note, a countdown to the day back, how far they are from the shop) is the one screen they find.
next: PR 1, the kernel `src/lib/people/bringBack.ts`. The Away note's PRs wait on call 5.
size: L as a train of eight (S · M · M · S · S, then the Away note S · M · S)
blocker: None for Bring back. The Away note waits on call 5.
opinion: build draft 1 as drawn after the second pass, and the Away note reached by a private link (call 5, B). Keep the account; never re-hire a returner as a new person, since the hours log, the logbook, the HR file and every job's history hang off the old account.
mockup: to-dos/bring-back-a-teammate/mockup.html and to-dos/bring-back-a-teammate/away-note.html
---

# Bring back a teammate who left (#256)

## The ask

The owner, 2026-11-03:

> a user technician just finished her last day and plans to come back in three years. Can you look at how
> onboarding and offboarding work and let me know what my options are to archive her?

The answer was End employment with *Archive after* ticked. It named the gaps on the way back, and the owner
said *"Yes, scope it"* to a Bring back path. Then, the same day:

> What if she keeps her login, But while she is not there only sees one screen that we leave for her like a note,
> I would like to be able to set that note on a case-by-case basis and have extra features like the ability to show
> a timer, for example, if I wanted to count down three years, or the ability to Let her know we are in Texas,
> enable your location for us to tell you how far away that is

## What is already there

| Piece | Where | What it does today |
|---|---|---|
| End employment | `PersonDeskLifecycleModal.tsx` (mode `end`), `src/lib/people/lifecycleChecklist.ts`, `leaveWrites.ts` | Final pay report, clear salary, close possessions, writes `people.end_date`, archives the account (`archive-user`) and the roster row (`people.archived_at`), one HR line |
| Archive the login | `supabase/functions/archive-user` | `users.archived_at`, a 100-year auth ban, CountTooling seat off, customers optionally to the company owner |
| Restore the login | `supabase/functions/restore-user`; the desk's Restore (`PersonDeskAccessSection.tsx`) and Users → Archived (`PeopleUsersTab.tsx`) | `users.archived_at = null`, ban lifted, seat back on. **The roster row is not touched.** |
| Restore the roster row | `restorePerson` in `src/pages/People.tsx` | `people.archived_at = null` only. A separate press on another list. |
| Roadmap tasks | trigger `roadmap_assignees_follow_user_archive` (`20260826034043`) | Archive parks open assignments; restore gives back each one still open and unassigned, **however old** |
| Employment dates | `people.start_date` / `end_date` (`20260713120000`), edited on Pay & schedule and the Employment tab | One pair. Read by the salary clamp (`salary_sync_one_user_clock_sessions`, `salariedPayrollDays.ts`), `roster_people`, tenure (`list_team_member_start_dates`, the HR tab), the HR timeline (`personTimelineIo.ts`) |
| Start employment | the same modal, mode `start`; `buildStartEmploymentChecklist` | Start date, pay, packet, vehicle, housing. It counts the old start date as done, so a returner gets no prompt |
| Hire | `HirePersonModal.tsx`, `hireWrites.ts` | Refuses an exact name only among **active** users and roster rows (`.is('archived_at', null)`); the invite refuses an email that has a login |
| The sub bench | `src/lib/people/subBench.ts`, `PeopleSubsTab.tsx` | The precedent: *Reactivate* clears `end_date`, re-stamps `start_date` and keeps the history as a dated line in `people.notes` |

What is kept across an archive, by account id: clock sessions, jobs, the hours log and the logbook (v2.6472),
licenses, the HR file, paperwork. That is why a returner must come back on the same account.

## The decision (draft 1, after the second pass)

1. **Bring back… replaces Restore on an archived desk whose employment ended.** Same gate as archiving: a dev, a
   controller or a pay-approved leader. Restore stays for an account archived without an end date.
2. **One window.** The back-on date first, with how long they were away and the first stint's dates. A quiet link,
   *Ended by mistake? Undo the end instead*, clears the end date and reopens the old stint with no new one.
3. **Both halves come back in one press**: the login through `restore-user`, the roster row, the end date cleared,
   the start date set to the back-on day, a new stint opened, one HR line (*"Back on Nov 5, 2029 for …, after 3
   years away."*).
4. **Stints are kept.** A new table `employment_stints` (person, start, end, created by) holds every stint.
   `people.start_date` / `end_date` stay the current stint, so the salary clamp and every other reader keep working
   unchanged. End employment closes the open stint; Bring back opens one. A backfill writes one stint per roster
   row that has dates.
5. **The rows three years made stale**, built by a returner variant of the Start employment checklist:
   - **Sign-in email**, with Change… and Send sign-in email (dev only, as today). Cannot be left open.
   - **Wage**, with the date it was set. Keep or Change; Change is the main press. Cannot be left open (call 3).
   - **Leader**, offering the old leader by name only while that leader is active. Cannot be left open.
   - **Licenses**, red when one expired while they were away. Can be left open with a reason.
   - **Paperwork**: signed in the old stint does not count; assign the packet again. Can be left open.
   - Vehicle and housing, optional, as today.
6. **Old roadmap tasks** come back only when the box is ticked. Off by default after 90 days away (call 2). `restore-user`
   takes a flag that discards the parked rows before the flip, so the trigger has nothing to give back.
7. **Start in training mode**, as Hire offers it, unticked by default (call 4).
8. **The Away note** (`away-note.html`). While a person is away, the office can leave one screen for them, written
   person by person from their archived desk (*Leave a note…*) or as a row in End employment:
   - **The note**, in the office's words, signed *The team* and dated when it was last changed.
   - **A countdown** to a date the office picks: days, hours and minutes, no seconds, with a thin bar for how far
     along they are. On the day it reads *Today's the day* with Call the office.
   - **Where we are**: the city from Settings → Office address (`app_settings.office_address_v1`). *Use my
     location* asks the browser only after the press, works out the miles on the phone with `haversineMeters`
     (`src/lib/jobTravelEstimate.ts`) and never saves or sends the location.
   - **Call or text the office**, the office line.
   - **Tell me when the countdown ends**, off by default: a Needs you item on the day with Bring back… on it.
   - Nothing else: no menu, no jobs, no pay. Bring back takes the note down.
9. **Hire finds them.** A name or email that matches an archived person stops the form: *"… left on Nov 3, 2026.
   Their hours, logbook and HR file are on that account."* with Bring back and *This is someone else*.

## The calls

1. **Tenure.** Answered 2026-11-03: tenure counts from the day back. The desk still lists every stint, but every
   tenure reader (the Reflect card, the HR tab's *started … · tenure*, the Employment tab) counts from the current
   stint's start.
2. **Old roadmap tasks.** Answered 2026-11-03: yes, 90 days. Away 90 days or less, the box starts ticked; past 90
   days it starts unticked. The office can tick or untick it either way.
3. **Wage.** Answered 2026-11-03: yes, required. The wage row must be pressed, Keep or Change, before Bring back
   finishes. It has no Leave open.
4. **Training mode.** Answered 2026-11-03: off by default. A returner knows the app; the box is there to tick.
5. **How an away person reaches the note.** Open. **A**, their login sealed: they sign in as always and land on the
   note, but the sign-in stays live for three years and reaches the database, realtime, file storage and the edge
   functions. Each needs its own lock, and every new table forever needs a fourth fence beside the three in
   `CLAUDE.md`, this one on reads. One missed lock shows a former employee pay, customers or the HR file.
   **B**, a private link: the account is archived and banned as today, and the note lives at a tokened public page
   like the customer portal (`/p/:slug`). The sign-in page, on a banned account, says *This account is resting* and
   offers *Email me my note*, which sends the link to the address on file and says the same words for every
   address. Draft 1 picks B: the screen they see is the same, and there is nothing to lock.

## Alternatives weighed

- **Re-hire as a new person.** Lost: a new account starts with no hours log, no logbook, no HR file and no job
  history, and pay is keyed by name, so the pay row collides with the old one.
- **Dated lines in `people.notes`, as the sub bench does.** Lost for employees: notes cannot answer tenure or a
  date range, and an HR question about the first stint needs real dates. The bench keeps its notes.
- **Keep the login unarchived in training mode while they are away.** Lost: three years in every picker and roster,
  and training mode blocks writes only, so every read stays open.
- **The Away note on a live, sealed login (call 5, A).** Weighed against B above; the owner's call.
- **Their live location, sent to the office.** Lost: the question is how far they are, which the phone can answer
  alone. Nobody at the office needs to know where a former employee is.
- **Two equal cards, *Back after time away* and *Ended by mistake*, at the top.** Lost in the second pass: the
  mistake is rare and caught within days, so it is a link under the date.
- **Fix only Restore so it brings back the roster row too.** Kept as part of PR 3, but alone it leaves the dates
  overwritten, the stale rows unasked and old tasks coming back.

## Is this the best we can do? The second pass

The box at the foot of `mockup.html` says what the render showed and what changed: the question cards became a
link, the old leader is offered only while active, Change is the wage's main press, Hire matches the email as well
as the name, and the away line on the desk stays.

The box at the foot of `away-note.html` does the same for the Away note: the note sits above the countdown, no
seconds, the location prompt only after the press, *The team* as the signature, the day-of alert off by default,
equal columns in the A and B comparison, and the same words from *Email me my note* for every address.

## The PR train

| PR | What | Size |
|---|---|---|
| 1 | Kernel `src/lib/people/bringBack.ts` + tests: away words, the returner checklist rows and which can be left open, the HR line, the roadmap box default, the Hire match (name or email among archived) | S |
| 2 | Migration: `employment_stints` + backfill from `people` + RLS as `people`, the three fence calls; End employment closes the open stint. `restore-user` takes `restore_roadmap` (edge deploy) | M |
| 3 | The Bring back window on the desk and on Users → Archived; restores both halves; the returner rows; the stints on Pay & schedule; guides `archive-user-accounts` and `open-a-persons-desk`; release note | M |
| 4 | Hire stops on an archived match and opens Bring back | S |
| 5 | Tenure readers: the HR tab, the Employment tab and `list_team_member_start_dates` count from the current stint's start (call 1); the desk lists the earlier stints | S |
| 6 | Kernel `src/lib/people/awayNote.ts` + tests: the countdown parts and bar, the day-of words, the miles and drive words from two points, the sign-in's resting words | S |
| 7 | Migration: `away_notes` (person, words, countdown date, show city, show call, alert on the day, a link token); the Leave a note window on the desk and in End employment; the public page and the sign-in's Email me my note per call 5; guide + release note | M |
| 8 | The Needs you item on the countdown's day, with Bring back… | S |

## How to verify

In a localhost preview, End employment for a ZZ Test tech with *Archive after* ticked and a roadmap task
assigned. Bring them back with a date a few days out: the login and the roster row are both active, the end date
is clear, the desk lists two stints, the HR file has both lines, and the roadmap task stays in Needs a person
unless the box was ticked. Then press + Hire with the same name and with the old email; each stops on the match.

For the Away note: leave one for the archived ZZ Test tech with a countdown a few minutes out. Open it the way call 5
picked. The screen shows only the note, the countdown, the city and the call button; *Use my location* asks the
browser only after the press, and the network panel shows no request carrying a position. When the countdown ends
the screen reads *Today's the day*, and the office's Needs you item appears if it was switched on.
