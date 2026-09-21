---
name: "Quick time add: a call or an email, without clocking in"
group: close
status: designed 2026-09-20 · the owner took all five defaults the same day · PR 1 shipped v2.3655 (the kernel, the migration, `add_quick_time`) — Office-only, see *What PR 1 changed* · PR 2 shipped v2.3659 (the door and the composer, redrawn first — *one control per idea*) · PR 3 shipped v2.3663 (the approver's chip, the sentence, the weekly line) — all three built · left: a week of real use, then the two follow-ups if wanted · mock-up beside this file (live — tap it)
summary: >
  **Office staff get called off hours and nobody pauses a customer to clock in**, so the time is
  worked and never recorded. One small door on the clock, only while *not* clocked in: say how
  long in fives (up to 30 minutes), say what it was, save. It writes an ordinary finished
  `clock_sessions` row — ends when they said, starts that many minutes earlier, their sentence as
  the note, on the Office job — so it flows into My Time, People → Hours,
  approval and pay with no new pipeline. It is marked (`quick_add_minutes`) so the approver sees
  a *quick add* chip, the sentence and a weekly total beside clocked hours. The database, not the
  screen, enforces the fives, the 30, the no-overlap, today-only and a daily ceiling.
next: >
  Use it for a couple of weeks. Then, only if wanted: the chip on My Time's own timeline and the
  Day book line; who-gets-it and the daily ceiling on a Settings screen; pinning a quick add to a
  job (four triggers must learn to skip quick adds first — *What PR 1 changed*). Delete the folder
  when none is wanted.
size: S each (follow-ups only)
blocker: A couple of weeks of use. One owner call stays open — whether a quick add may ever be pinned to a job (*What PR 1 changed*).
opinion: later — all three PRs are built and live-checked; what is left is watching the weekly number. It was small, it rides rows and screens that already exist, and the time it records is real money the office is already owed or already eating.
---

# Quick time add

## The ask

The owner, 2026-09-20:

> "I have a unique situation where sometimes office staff will be called off hours and they
> don't want to pause the call to clock in and clock out. I was thinking we offered buttons to a
> user who is office staff on the clock in clock out to be able to hit a button to add a specific
> amount of time, up to thirty minutes, for things like phone calls and responding to emails that
> is denominated in five minute sections. The idea being a user can really quickly and easily hit
> plus five minute plus five minute and then type in what they did for a ten minute quick call."

## What is true today (checked 2026-09-20)

- **A person can already add a finished session for themselves.** The `clock_sessions` insert
  policy allows `user_id = auth.uid() AND origin = 'user_punch'` with any `clocked_in_at` /
  `clocked_out_at`; the My Time day editor does exactly this for a past block
  (`DashboardMyTimeDayEditorModal.tsx`, the draft-session insert). So a quick add is a *shortcut
  to a row the app already knows*, not a new kind of time. Nothing new is needed for it to reach
  hours, approval or pay.
- That path is five or six taps deep and asks for start and end times — nobody does it for a
  four-minute email. The clock button itself only knows *in* and *out*.
- `clock_sessions.origin` is `'user_punch' | 'salary_schedule'` (a CHECK), and **11 client files
  and several SQL functions branch on it** (`myTimeDaySavePlan.ts`, `myTimeDayTimeline.ts`, the
  approve / split / merge RPCs in the baseline). A third origin value would have to be taught to
  every one of them.
- Salaried people do not clock: `ClockInOutButton` hides its punch UI (`salaryUiActive`) and their
  sessions are materialized from the schedule (`docs/SALARY_CLOCK_SESSIONS.md`).
- "Office roles" already has one definition: `ORG_DEFAULT_ROLE_GROUPS.office` in
  `src/lib/orgDefaults.ts` — dev, master_technician, assistant, controller, estimator, primary.
- The Office overhead job is resolved by `fetchOverheadOfficeJobLedgerIdFromAppSettings()`
  (`src/lib/overheadOfficeJobSettings.ts`); Who's where, Review and the Bridge already treat it as
  overhead.
- Approval is `canApproveHours` on the Dashboard (dev, assistant-like, a pay-approved master) over
  `approve_clock_sessions`; pending rows list in `PeopleHoursDayAuditModal`,
  `UpcomingWeekSessionsModal` and Moneyfill's time queues.

## The decision

1. **It is a normal session, marked — not a new origin.** One nullable column,
   `clock_sessions.quick_add_minutes smallint` (`NULL` = a punch; `5…30` = a quick add), and
   `origin` stays `'user_punch'`. Every existing reader keeps treating it as ordinary clocked time
   (so hours, approval, pay, Who's where and costing need no change), and only the new surfaces
   read the column. Rejected: `origin = 'quick_add'` — correct in spirit, but it touches 11 client
   files and the split / merge / approve RPCs for no behaviour anyone wants.
2. **One validated entrypoint.** `public.add_quick_time(p_minutes, p_note, p_ended_at)` —
   `SECURITY DEFINER`, as the caller (no job argument: *What PR 1 changed*). The insert policy is untouched, but a trigger
   refuses a direct insert or update that sets `quick_add_minutes` outside the RPC, so the rules
   below cannot be skipped from a console. The rules, all in the database:
   - `p_minutes` in 5, 10, … 30;
   - a note of at least 3 letters (trimmed, capped at 200);
   - the caller is in an office role, not salaried, not read-only, not a twin;
   - the caller has **no open session** (if they are clocked in, the time is already counting);
   - `p_ended_at` is today on the company calendar (`app_today()`) and not in the future;
   - the window `[ended − minutes, ended]` **overlaps none** of the caller's live sessions
     (not rejected, not revoked) — refused with the clashing window named, never silently shifted;
   - the day's quick adds, this one included, stay under the **daily ceiling** (proposed 120 min).
3. **The door is a quiet link, and only off the clock.** Under the clock row, right-aligned, one
   small text link — *＋ quick call or email*. Not a second button beside *Clock In*, and not a
   box that is on screen all day for something used now and then (the first draft's dashed row
   also stretched the Tally and Job Report squares beside it). Hidden while clocked in, for field
   roles, for people whose hours come from a salary schedule, in training mode.
4. **The composer — one control per idea** (mock-up §2, redrawn 2026-09-20 after the owner asked
   "is this the best we can do?"; the first draft's six faults are listed in the mock-up):
   - **How long** is one bar: six cells (5 … 30) and a **＋5** at its end. ＋5 accumulates — the
     owner's gesture — and tapping a cell jumps there (tapping the lit last cell steps back, so
     there is no −5). The bar *is* the meter; the ceiling is where it ends, and ＋5 goes quiet at 30.
   - **What it was** is a three-way kind — *Call · Email · Text* — and a few words (*Who, and what
     about*). The note is written `Call — Acme, the Oak St invoice`.
   - **When** is one line that is right by default — ***7:40 – 7:50 pm** today · Office · ended
     just now* — and *just now* opens five choices (just now · 15 · 30 min · 1 h · 2 h ago) only
     when tapped.
   - **The button says the number**: *Add 10 min* (disabled: *Add 10 min — say what it was*). That
     is the confirmation, so a mis-tap is never silent.
   - **It fits above the keyboard.** The words are typed with the keyboard up, which takes the
     bottom half of a phone; all four things fit in the half that is left. Build it as a compact
     sheet anchored to the top of the viewport, never one the person scrolls to find the button.
5. **It is never hidden inside a punch.** Every surface that lists sessions shows a *quick add*
   chip and the sentence; the approver's list adds one line per person — *Grace's quick adds this
   week: 1 h 05 m across 8 entries · clocked 38.6 h*. That number is the whole control: it says at
   a glance whether the door is being used as intended.

**Why not just "make clocking in faster"?** Because the failure is not the taps, it is the
interruption: the call is already happening. Anything that must be started *before* the work
loses to a ringing phone; this is recorded *after*.

## What PR 1 changed (2026-09-20)

Two things the build found, both now in the code:

- **Quick adds are Office-only; the job pick is deferred.** A finished session on a real job is
  not neutral: `clock_sessions_promote_job_waiting_to_working` flips the job *waiting → working*,
  the `touch_jobs_ledger_last_work_date` triggers move its **last work date** (which lien
  deadlines read), `clock_session_fills_customer_date_met` fills the customer's date met, and the
  crew-sync triggers put the office person on the job's crew (and so on Who's where and the
  supervision rule). None of that is right for a phone call. So `add_quick_time` takes no job and
  pins the Office job; the mock-up's *For* field is not built. **New owner call**: if a quick add
  should ever carry a job — for costing the call to it — each of those four triggers needs an
  `AND NEW.quick_add_minutes IS NULL` and a test, as its own PR. Until then the sentence says
  which job it was about.
- **The CHECK is added `NOT VALID` and validated after.** `ADD COLUMN` (nullable, no default) is
  metadata-only, but a CHECK in the same statement would scan `clock_sessions` under ACCESS
  EXCLUSIVE. `VALIDATE CONSTRAINT` scans under a lock that blocks nobody.

Also decided in the build: a **trainee (read-only) is refused**, unlike their ordinary punches; a
**salaried person who still records hours** (`record_hours_but_salary`) gets the door; the owner
of a quick add may fix its note or slide it, but not stretch it or clear the mark — the office may,
on someone else's entry only (an assistant both uses the door and approves hours).

## The owner's five calls (all five defaults taken, 2026-09-20)

| # | The call | Proposed default | Changes |
|---|---|---|---|
| 1 | **Who gets the door?** | assistant · controller · estimator (and dev, to test). Not masters or primary unless you say so. | one role list in the kernel + the RPC |
| 2 | **The daily ceiling** | 120 minutes of quick adds per person per day; past it the sheet says *clock in instead*. | one `app_settings` number |
| 3 | **＋5 stepper (A) or six chips (B)?** | A was taken — then **overtaken by the redraw: one bar that is both** (＋5 accumulates, a cell jumps), because a button that reads *Add 10 min* removes the slip that argued for the slower stepper. | the composer only; the kernel is the same |
| 4 | **Salaried office people** | No door — their pay does not change with minutes. *If you want off-hours work visible anyway* (comp time, or just to know), that is a different record and its own to-do. | — |
| 5 | **Should they pick a job?** | Optional, Office by default — **overtaken by PR 1: Office-only until the four job triggers skip quick adds** (*What PR 1 changed*). | the sheet's *For* field, four triggers |

## The mock-up

`mockup.html` — live: tap ＋5 twice (or the *10* cell), type a few words, watch the line and the
button become *Add 10 min*. The door on the clock row (today / after); the composer, live, beside
the same composer with the keyboard up; the first draft's faults, collapsed; what it becomes on My Time and in the approver's list, with the weekly total; the
table of what it refuses and the sentence it says; what changes and what stays.

## Where it plugs in

Exists:

- `src/components/ClockInOutButton.tsx` — the door goes under the idle Clock In row (the file
  already knows `openSession`, `role`, `salaryUiActive`, and owns the job / bid picker the *For*
  field reuses).
- `src/lib/orgDefaults.ts` (`ORG_DEFAULT_ROLE_GROUPS.office`), `src/lib/overheadOfficeJobSettings.ts`.
- `clock_sessions` + its policies; `app_today()`; `users.read_only`, `users.is_digital_twin`;
  `people_pay_config` for salaried (the join rule is in `docs/SALARY_CLOCK_SESSIONS.md`).
- Session lists that gain the chip: `DashboardMyTimeDayEditorModal` (My Time),
  `PeopleHoursDayAuditModal`, `UpcomingWeekSessionsModal`, Moneyfill's time queues
  (`MoneyfillTimeQueuesSections`).

New:

- **Kernel `src/lib/clock/quickTimeAdd.ts`** (pure, tests): `QUICK_ADD_STEP` / `QUICK_ADD_MAX`,
  `stepMinutes(current, ±1)`, `quickAddWindow(endedAt, minutes)`, `overlapWith(window, sessions)`
  → the clashing window or null, `quickAddRefusal({ minutes, note, window, sessions, dayTotal,
  ceiling, now })` → the sentence or null (the same sentences the RPC raises — one test pins the
  two together), `canUseQuickAdd({ role, isSalary, readOnly, clockedIn })`, `weeklyQuickAddLine(rows)`.
- **Migration**: `quick_add_minutes smallint NULL CHECK (quick_add_minutes IN (5,10,15,20,25,30))`
  + a partial index `(user_id, work_date) WHERE quick_add_minutes IS NOT NULL`; the guard trigger;
  `add_quick_time(...)`; `app_settings` key `quick_add_daily_ceiling_minutes`. Starts with
  `SET lock_timeout = '3s';` — `ADD COLUMN … NULL` with a CHECK is metadata-only on Postgres 17
  but takes a brief `ACCESS EXCLUSIVE` on the busiest table in the app: **push it in a quiet
  moment**, and let the timeout fail it fast rather than queue the office behind it. No CREATE
  TABLE, so no fence appliers.
- **`QuickTimeAddSheet.tsx`** (in `src/components/clock/`), render test.
- Guide `add-a-quick-call-or-email-to-my-hours.md` (Office; the roles from call 1); a line in
  `approve-my-teams-hours.md` for the chip and the weekly total. `GLOSSARY.md` (*quick add*),
  `ACCESS_CONTROL.md` (the RPC's gate), `PROJECT_DOCUMENTATION.md` (the column).

## The plan

1. **The kernel, the migration, the RPC — SHIPPED v2.3655** (`docs/recent-features/v2.3655.md`; the pre-merge run is in `docs/migrations/20260921042405_clock_sessions_quick_add.md`). As planned: (S). Everything in *New* above except the screens. Verify
   on a throwaway Postgres with stub tables, as the try-out and health migrations were: 10 min
   ending now lands as one row with the note and the Office job; 7 and 35 are refused; a window
   over an existing session is refused with that session's times; yesterday and the future are
   refused; the 25th entry past the ceiling is refused; a helper, a salaried person and a
   read-only user are refused; a direct `INSERT … quick_add_minutes = 10` is refused by the trigger.
   After merge: `db push` (quiet moment) → the types PR.
2. **The door and the composer — SHIPPED v2.3659** (`docs/recent-features/v2.3659.md`). The door portals into a slot under the clock row (the squares beside the clock stretch with its slot). As planned: (S). `ClockInOutButton` + `QuickTimeAddSheet` (the composer of decision 4); the guide; release
   note. Verify on the dev server as an assistant: not clocked in → the door; ＋5 ＋5, a sentence,
   save → My Time shows 0.17 h with the chip; clock in → the door is gone; as a helper → never there.
3. **The approver's view — SHIPPED v2.3663** (`docs/recent-features/v2.3663.md`). Built on the two places hours are approved (a person's pay week; a pending cell on People → Hours) rather than all four lists, and with one correction: those rows show the **sentence**, not the job, because every quick add is on the Office job. As planned: (S). The chip on the four session lists; the weekly line per person in
   the approval list; Day book picks it up as a line when that ships (`to-dos/day-book`). Verify
   with two seeded quick adds: both chips, the sentence, *0 h 15 m across 2 entries*.
4. *(only if wanted)* **Settings** — who gets the door and the ceiling on Settings → People & teams,
   instead of a role list in code and a number in `app_settings`.

## How to verify (end to end, once 1–3 are in)

As an assistant, off the clock at 7:50 pm: the door is under Clock In. ＋5, ＋5 → *10 min*; type
*Call with Acme about the Oak St invoice*; *For* J258; *Ended* Just now → the line reads *Adds
7:40–7:50 pm today · 10 min · J258*; save. My Time shows the entry with the chip; People → Hours
shows it pending. As a pay-approved master: the pending row carries the chip and the sentence, and
the weekly line counts it; Approve → it is paid like any other ten minutes. Try to add another ten
ending 7:45 pm → refused, naming 7:40–7:50 pm.

## Open questions beyond the five calls

- **Overtime.** Quick adds are clocked time, so a 38-hour week plus 2.5 hours of quick adds is 40.5
  — correct, and worth the owner knowing before the first pay run that includes them.
- **Minimum-increment rules.** Some employers round after-hours contact up to a minimum (15 min).
  Not modelled; if wanted it is a line in the kernel and the RPC, and a question for whoever
  advises on pay practice.
- **The half hour after midnight.** *Today only* means a call that ran 11:54 pm – 12:04 am cannot be
  added at 12:05 (its window starts yesterday), nor can one that ended before midnight — the
  sentence sends them to My Time. Found when a local test run crossed midnight Central. If the
  office really takes calls then, the rule could become "ends today, or within the last two hours".
- **Field leads** who take after-hours calls from customers are the same problem with a different
  role list — call 1 can simply grow.
