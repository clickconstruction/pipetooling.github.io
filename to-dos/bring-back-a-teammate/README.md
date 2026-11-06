---
name: "Bring back a teammate who left: one press for the login and the roster row, a new stint, the stale rows"
number: 256
group: ready
status: PR 1, the kernel, v2.6480 · PR 2, the stints and `restore_roadmap`, v2.6481 · PR 3, the Bring back window, v2.6523 · PR 4, Hire finds them, v2.6525 · PR 5, the stints in view, v2.6526 · PR 6, the Away note's kernel, v2.6566 · PR 7, the seal, v2.6572 (the guard sweep across the 104 functions is PR 7b) · the walk of 2026-11-04 on the card with seven follow-ons · every call answered 2026-11-03 (tenure from the day back, roadmap 90 days, wage required, training mode off, the Away note behind a sealed login)
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
next: Micah pushes the seal's migration (`20261106120000_archived_seal`) in a quiet moment and runs the rolconfig check in its doc; then PR 7b, the guard sweep, ready to run from `scripts/codemods/` (row 7b); then PR 8 lets an archived account with a note sign in and draws the screen over PR 6's model.
size: L as a train of nine (S · M · M · S · S, then the Away note S · L · M · S)
blocker: None.
opinion: build draft 1 as drawn after the second pass, and the Away note behind a sealed login (call 5): the seal first, proven by its probe, then the note. Keep the account; never re-hire a returner as a new person, since the hours log, the logbook, the HR file and every job's history hang off the old account.
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
4. **Stints are kept.** A new table `employment_stints` (person, start, end; written only by a trigger on `people`'s dates, v2.6481) holds every stint.
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
   - **A live preview beside the switches** (the owner, 2026-11-03: *"I would like to see a preview of what they
     see"*). The window's right side is their screen, drawn by the same component the sealed sign-in draws, and it
     changes as the office types. A *Today · On the day* switch shows the screen the countdown ends on. On a phone
     the preview drops under the switches with a *Preview* link at the top.
   - Nothing else: no menu, no jobs, no pay. Bring back takes the note down.
   - **Reached by signing in** (call 5). They sign in as always and the note is the only page the app draws. The
     account stays archived, so every list, picker, payroll run, push and email keeps skipping them exactly as
     today; only the auth ban is skipped while a note is on. *Sealed* means: archived and able to sign in.
   - **The seal, in four locks**, because the app hiding screens locks nothing. A signed-in person holds a token
     that reaches the database, realtime, file storage and the edge functions directly.
     1. **One gate before every database request.** A PostgREST pre-request function (`pgrst.db_pre_request`) refuses
        every request from an archived caller except `rpc/my_away_note`. It covers tables, views (most run as
        their owner and skip row rules), every RPC including the security-definer ones, GraphQL, and edge functions
        that query as the caller. It is one lookup by primary key, the same shape as `is_read_only()`, but it runs on
        every request for everyone, so its cost is measured on the local bed before it ships.
     2. **A read fence on every table**, restrictive like training mode's (`apply_read_only_*`) but on reads:
        `apply_archived_read_blocks()`. It is what realtime obeys, and a second lock behind the gate. It becomes the
        fourth call every `CREATE TABLE` migration ends with (`CLAUDE.md` and its CI check updated).
     3. **File storage**: a restrictive policy on `storage.objects` from the same function.
     4. **Edge functions that switch to the service role** call `_shared/refuseArchivedCaller.ts` first; a CI check,
        like `check:edge-bundles`, fails a function that reads the caller and skips it.
   - **Proof before use.** A seal probe on the local full-schema bed signs in as an archived account and tries every
     table, view, RPC and bucket; only `my_away_note` answers. It runs in CI. Since archived accounts are banned
     today, the seal changes nothing for anyone until the first note is turned on.
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
5. **How an away person reaches the note.** Answered 2026-11-03: *"When she signs in on the app, it's the only page
   she can see."* That is A, with the four locks in decision 8. The choice as it was put: **A**, their login sealed: they sign in as always and land on the
   note, but the sign-in stays live for three years and reaches the database, realtime, file storage and the edge
   functions. Each needs its own lock, and every new table forever needs a fourth fence beside the three in
   `CLAUDE.md`, this one on reads. One missed lock shows a former employee pay, customers or the HR file.
   **B**, a private link: the account is archived and banned as today, and the note lives at a tokened public page
   like the customer portal (`/p/:slug`). The sign-in page, on a banned account, says *This account is resting* and
   offers *Email me my note*, which sends the link to the address on file and says the same words for every
   address. Draft 1 had picked B: the screen they see is the same, and there is nothing to lock.

## Alternatives weighed

- **Re-hire as a new person.** Lost: a new account starts with no hours log, no logbook, no HR file and no job
  history, and pay is keyed by name, so the pay row collides with the old one.
- **Dated lines in `people.notes`, as the sub bench does.** Lost for employees: notes cannot answer tenure or a
  date range, and an HR question about the first stint needs real dates. The bench keeps its notes.
- **Keep the login unarchived in training mode while they are away.** Lost: three years in every picker and roster,
  and training mode blocks writes only, so every read stays open.
- **A private link instead of the sign-in (call 5, B).** Lost to the owner's call: they want the app itself to be
  where the note lives. B stays the fallback if the seal probe cannot be made to pass.
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

The box at the foot of `away-note.html` does the same for the Away note: the live preview beside the switches
(draft 2, the owner's ask) with its *On the day* view and its empty state, the note above the countdown, no
seconds, the location prompt only after the press, *The team* as the signature, the day-of alert off by default,
equal columns in the A and B comparison, and the same words from *Email me my note* for every address.

## The PR train

| PR | What | Size |
|---|---|---|
| 1 | **Shipped v2.6480.** Kernel `src/lib/people/bringBack.ts` + tests: away words, the returner checklist rows and which can be left open, the HR line, the roadmap box default, the Hire match (name or email among archived) | S |
| 2 | **Shipped v2.6481.** Migration: `employment_stints` + backfill from `people` + RLS as `people`, the three fence calls; the trigger `people_stints_follow_dates` closes and opens stints for every path that writes the dates, End employment among them. `restore-user` takes `restore_roadmap` (edge deployed) | M |
| 3 | **Shipped v2.6523.** The Bring back window on the desk and on Users → Archived; restores both halves; the returner rows (the Leader row became the Team row: the app records no leader); End employment archives a no-login account too (the walk's follow-on 1); guides `bring-back-a-teammate`, `archive-user-accounts`, `open-a-persons-desk`. The stints on Pay & schedule moved to PR 5 | M |
| 4 | **Shipped v2.6525.** Hire stops on an archived match (name or email, as typed) and opens Bring back; an exact archived name is refused on the press either way | S |
| 5 | **Shipped v2.6526.** The desk's Employment row lists every stint with the away gaps; the HR tab and the Employment tab name the earlier stints after the tenure (every reader already counted from the current stint, call 1); the salary clamp pays a day inside any stint. The server-side sync's clamp is left for a migration | S |
| 6 | **Shipped v2.6566.** Kernel `src/lib/people/awayNote.ts` + tests: the countdown parts and bar, the day-of words, the miles and drive words from two points, the city from the office address, the call and text links, the signature, and `buildAwayScreen`, the one model the preview and the sealed page both draw | S |
| 7 | **Shipped v2.6572.** The seal, nothing visible: `caller_is_archived()`, the pre-request gate, `apply_archived_read_blocks()` on every table (the fourth fence call, CI-checked), the `storage.objects` policy, `refuseArchivedCaller` + `check:edge-archived-guard`, the `CLAUDE.md` rule, the seal probe in the SQL beds. Push and confirm the gate on prod's shape before PR 8 | L |
| 7b | **Ready to run.** The guard call swept into the 104 functions that read the caller and switch to the service role, the check wired into `ci.yml` after the link step, every one deployed. The sweep is proven on a copy of all 179 functions: `node scripts/codemods/archived-guard-sweep.mjs` guards 97 by machine (the two caller shapes, the client by name, by the key's variable or as a helper's parameter, a brace walk so the guard never lands out of scope, a helper that answers a boolean left alone) and `python3 scripts/codemods/archived-guard-hand-edits.py supabase/functions` applies the seven it leaves with anchors that assert once each; after both, `check:edge-archived-guard` is clean and every function links. A mechanical sweep: from fresh `main`, merged alone, the codemod re-run on a rebase conflict. Then `docs/EDGE_FUNCTIONS.md`'s Authentication paragraph, this row, a release note and fragment, and the deploy list with one loop line for Micah | S |
| 8 | Migration: `away_notes` (person, words, countdown date, show city, show call, alert on the day) + `my_away_note()`; `archive-user` skips the ban when a note is on and `restore-user` takes the note down; the app's away gate (a signed-in archived account draws only the Away page); the Leave a note window on the desk and in End employment, its preview rendering the one `AwayScreen` component the sealed sign-in renders; guide + release note | M |
| 9 | The Needs you item on the countdown's day, with Bring back… | S |

## How to verify

In a localhost preview, End employment for a ZZ Test tech with *Archive after* ticked and a roadmap task
assigned. Bring them back with a date a few days out: the login and the roster row are both active, the end date
is clear, the desk lists two stints, the HR file has both lines, and the roadmap task stays in Needs a person
unless the box was ticked. Then press + Hire with the same name and with the old email; each stops on the match.

For the Away note: leave one for the archived ZZ Test tech with a countdown a few minutes out and sign in as them.
The app draws only the Away page, and typing any other path lands back on it. With that session's token, a direct
REST call to `users`, `customers` and an RPC is refused, a storage download is refused, and a realtime subscription
gets nothing. The screen shows only the note, the countdown, the city and the call button; *Use my location* asks the
browser only after the press, and the network panel shows no request carrying a position. When the countdown ends
the screen reads *Today's the day*, and the office's Needs you item appears if it was switched on.

## Found in review, 2026-11-04 (for PR 3's author)

The trigger `people_stints_follow_dates` (`20261103203000_employment_stints.sql` ~62-64, 85-99) takes a return only when `NEW.end_date IS NULL`; two paths lose the earlier stint: a past stint recorded in one save with both dates (the Employment tab changing (2024-03-04 → 2026-11-03) to (2027-01-05 → 2027-06-30) overwrites the first stint), and both dates blanked (the early `RETURN NEW`) then a start set later (the closed stint is rewritten). Treat `OLD.end_date IS NOT NULL AND NEW.start_date IS DISTINCT FROM OLD.start_date AND NEW.start_date >= OLD.end_date` as a return whatever `NEW.end_date` is, and close the open stint when both dates are blanked; the bed covers neither case yet. Bring back clears the end and sets the start in ONE `UPDATE people` (v2.6523), and the salary clamp reads every stint since PR 5 (v2.6526); the two lost-stint paths above still stand in the trigger (no migration since `20261103203000`), with no bed scenario for either.

## The walk of 2026-11-04

Grace's ask, dictated: *"take a look at how we would have someone leave, and we have the expectation that she's going to
come back in three years. Make sure we have the right features and the right workflow to make this easy for a user to
follow and do."* Walked on the dev server as the dev with a roster person **ZZ Test Returner** (a Helper, made with no
login, since a session cannot delete a login it makes; where the login changes what the screen says, it is said below).
Every row was deleted after.

### Step by step, what the screen said

1. **People → Users → + Hire.** Name *ZZ Test Returner*, Kind *Helper*, *Send the invite* unticked, Starts *2024-03-04*,
   Pay *$24/h*. The form ran two steps: *1. Person · ZZ Test Returner as Helper, starting 2024-03-04 — on the roster with
   no login; a login can be attached later* and *2. Pay · $24.00/h*, then *ZZ Test Returner is on the roster* with
   **Open their desk**. The desk's Pay & schedule read *Employment · Mar 4, 2024 → present*.
2. **People → Paperwork → Licenses → ZZ Test Returner → + Add license.** *Journeyman Plumber #ZZ000*, expiry 2027-06-30.
   Saved; the desk's Field section listed it as *exp Jun 30, 2027*.
3. **Roadmap → Plan → a task in Needs a person → ＋ Assign someone.** The picker's *On this roadmap* and *Everyone* list
   login accounts only (`fetchActiveUsers` with `withLogin`, punch list #260), so a worker with no login cannot take a
   roadmap task. Skipped on this walk; the park-on-archive and give-back-on-restore are proven by PR 2's bed.
4. **People → Pay → Hours → the clock strip's + Add session.** ZZ Test Returner, Tue 11/3, 8:00 AM to 4:00 PM. Saved:
   the desk read *1 session waiting · 8h*.
5. **The desk → ⋯ → End employment….** *2 open · 0 done*. The rows: *On the clock · Not clocked in*; *Pending sessions ·
   1 session · 8h not yet in payroll* with **Open approvals**; *Final pay report · No pay report yet — one covers through
   2026-11-04* with **Generate report** and **Leave open…**; *Salary · Hourly*; *Vehicle · None held*; *Housing · None*.
   The footer: *End date*, *Archive after (account + roster row)* ticked, *Note to HR file* ticked.
6. **Open approvals.** The typed session read *typed by Robert · You typed these — waiting on a second person*, with
   **Reject** and **Edit** only. The office person who types the last day's hours cannot approve them, and End employment
   will not finish while a session waits, so the last day takes two office people. Rejected for the walk.
7. **Leave open…** on the final pay report with a reason; end date 2026-11-03; **End employment**. The confirm read
   *End ZZ Test Returner's employment on Nov 3, 2026? Then the roster row is archived.* The account was not named: the
   modal archives the account only when the row carries an email, so a person with no login keeps an active account.
   Toast: *ZZ Test Returner's employment ended Nov 3, 2026*.
8. **The desk after.** The header read *Helper · archived* with an *Archived* chip; *Employment · Mar 4, 2024 → Nov 3,
   2026 · Ended*; *HR file · 1 entry*; the license still listed; and the Status row still *Active* with **Archive…**,
   the account half untouched (with a login and an email it is archived and the sign-in banned, and the row reads
   *Archived* with **Restore**). Nothing on the desk says she plans to be back, or when.
9. **People → Users.** The person still sat in the Helper group as active (the account half) **and** under
   *Archived (29) → Roster rows* with **Restore**. Archived has two lists, *Logins* (restore-user) and *Roster rows*
   (`people.archived_at = null`), each with its own Restore.
10. **Restore on the roster row.** No confirm, no toast; the row left the list; the desk read *Helper* with no chip and
    *Employment · Mar 4, 2024 → Nov 3, 2026 · Ended*. Nothing asked for the day back, the wage, the leader or the
    license; the end date stayed, so the person looks active and ended at once. With a login, *Logins → Restore* brings
    back the login alone and the roster row stays archived: two presses on two lists, and the dates stay wrong on both.
11. **+ Hire with the same name.** The form took *ZZ Test Returner*; the name check runs on the Hire press against
    active rows only (`findNameCollision`, `.is('archived_at', null)`), so once both halves are archived a second person
    is made, and the pay row, keyed by name, lands on the old one. On this walk the account half was still active, so
    Hire would have refused with *An account with this exact name already exists*.

### A three-year leave and return, step by step: what is there, what is missing

| Step | Today | #256's list |
|---|---|---|
| The last day: close the clock, approve the hours, the final report, the truck, housing, the account and the roster row | End employment does it in one window | — (shipped) |
| The last day: a worker with no login | The account stays active and in every list | **Missing** → follow-on 1, folded into PR 3 |
| The last day: when she plans to be back | Nowhere to write it | **Missing** → follow-on 2 |
| While away: her login | Banned; the sign-in page says the account is banned | PR 7 + PR 8, the Away note |
| While away: her licenses' expiry | The Licenses tab's expired strip and the dispatch notice count her lapsed license for three years | **Missing** → follow-on 3 |
| While away: her open jobs and crew spot | Pickers skip an archived account; her team rows and job memberships stay as they are | **Missing** → follow-on 4 |
| While away: her open roadmap tasks | Parked on archive, in Needs a person | — (shipped) |
| The day back: one press | Two Restores on two lists, the end date left set, no questions | PR 3 |
| The day back: the first stint's dates | One pair, written over on edit | PR 2 (shipped) + PR 3 + PR 5 |
| The day back: wage, leader, licenses, paperwork, truck, housing | Nothing asks | PR 3 |
| The day back: old roadmap tasks | Come back by themselves, however old | PR 2 (shipped) + PR 3 |
| The day back: someone presses + Hire instead | A second account | PR 4 |
| Tenure | Reads the one pair | PR 5 |
| Her first sign-in back | Training mode as it was; push off until she turns it on; nothing says welcome back | call 4 in PR 3; follow-on 5 |
| The office on the day back, told | The owner remembers | PR 9 (the Needs-you item) |

The PR list covers the return itself. What it misses is the three years in between and the no-login shape, numbered
below so the owner has one list.

### Follow-ons found on the walk

1. **End employment archives the account of a person with no login.** The modal archives the account only when the row
   carries an email, so a #260 worker who leaves stays active in every list. Recommendation: archive by the row's id,
   email or not, as the desk's Archive… press does since v2.6519. **Folded into PR 3**, since Bring back restores both
   halves and the end must close both.
2. **A "plans to be back" date on the last day.** End employment takes an optional *Expects to be back* date, kept on
   the closed stint (`employment_stints.expected_back_on`), read on the archived desk (*Left Nov 3, 2026 · plans to be
   back Nov 2029*), by the Away note's countdown as its default (PR 8) and by the Needs-you item (PR 9). Recommendation:
   add the column to PR 8's migration and the row to PR 8's End employment change, one PR.
3. **License expiry notices for someone away.** `person_licenses` is name-keyed and knows nothing of the archive, so the
   expired strip lists her for three years and the dispatch notice fires on the day. Recommendation: the strip folds
   archived people under *away* and the notice skips them; Bring back's Licenses row already reads red on the day back.
   Size S, after PR 3.
4. **Open jobs and the crew spot.** `jobs_ledger_team_members` and `people_team_members` rows stay as they are, so a
   job's team still lists her and the Hours tab's team keeps her name until someone edits it (the teams view already
   hides archived members). Recommendation: End employment lists the jobs she is on with *Take off jobs*, the roadmap's
   precedent, and Bring back's Leader row offers the old team back. Size S, after PR 3.
5. **Her first sign-in back.** Nothing greets a returner. Recommendation: one dashboard line for her first week back,
   *Welcome back · your wage and leader were set on Nov 5*, read from the open stint. Size S, optional.
6. **The last day's typed hours need a second person.** By design (an approval the guard holds). Recommendation: keep
   the rule; the leaving guide says to have the leader approve the last day before End employment is pressed.
7. **Roadmap tasks for a worker with no login.** The picker lists logins only, so a #260 worker never holds one.
   Out of #256's scope; noted for #260's owner.
