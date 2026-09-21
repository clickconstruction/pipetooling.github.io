---
name: "Quick time add: a call or an email, without clocking in"
group: gated
status: designed 2026-09-20 · mock-up beside this file (live — tap it) · not started · five owner calls below, each with a proposed default
summary: >
  **Office staff get called off hours and nobody pauses a customer to clock in**, so the time is
  worked and never recorded. One small door on the clock, only while *not* clocked in: say how
  long in fives (up to 30 minutes), say what it was, save. It writes an ordinary finished
  `clock_sessions` row — ends when they said, starts that many minutes earlier, their sentence as
  the note, the Office job unless they pick another — so it flows into My Time, People → Hours,
  approval and pay with no new pipeline. It is marked (`quick_add_minutes`) so the approver sees
  a *quick add* chip, the sentence and a weekly total beside clocked hours. The database, not the
  screen, enforces the fives, the 30, the no-overlap, today-only and a daily ceiling.
next: >
  The owner's five calls (who, the daily ceiling, stepper vs chips, salaried people, a job pick) —
  each has a default that ships if nothing is said. Then PR 1: the kernel, the migration and the
  RPC.
size: S · S · S (three PRs; a fourth only if the owner wants the settings on a screen)
blocker: The owner's five calls — none blocks PR 1's kernel, all have defaults.
opinion: build — it is small, it rides rows and screens that already exist, and the time it records is real money the office is already owed or already eating.
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
2. **One validated entrypoint.** `public.add_quick_time(p_minutes, p_note, p_ended_at, p_job_ledger_id,
   p_bid_id)` — `SECURITY DEFINER`, as the caller. The insert policy is untouched, but a trigger
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
3. **The door is on the clock, and only off the clock.** Under *Clock In*, a quiet dashed row:
   *＋ Add a quick call or email · 5–30 min*. Hidden while clocked in, for field roles, for salaried
   people, in training mode. It opens a bottom sheet.
4. **The sheet** (mock-up §2): a big minute readout, **＋5 min** and **−5**, a six-segment meter to
   the 30 ceiling (the button goes quiet at 30 rather than erroring); *What was it?* with three
   starter chips (*Phone call — · Email — · Text —*); *For* (Office by default; the person's recent
   jobs and bids, then search — the same picker the clock uses); *Ended* (Just now · 15 · 30 min ·
   1 h ago · pick a time). A line under it spells the entry out before saving — *Adds 7:40–7:50 pm
   today · 10 min · Office* — so nobody is surprised by what lands on My Time.
5. **It is never hidden inside a punch.** Every surface that lists sessions shows a *quick add*
   chip and the sentence; the approver's list adds one line per person — *Grace's quick adds this
   week: 1 h 05 m across 8 entries · clocked 38.6 h*. That number is the whole control: it says at
   a glance whether the door is being used as intended.

**Why not just "make clocking in faster"?** Because the failure is not the taps, it is the
interruption: the call is already happening. Anything that must be started *before* the work
loses to a ringing phone; this is recorded *after*.

## The owner's five calls (defaults ship if nothing is said)

| # | The call | Proposed default | Changes |
|---|---|---|---|
| 1 | **Who gets the door?** | assistant · controller · estimator (and dev, to test). Not masters or primary unless you say so. | one role list in the kernel + the RPC |
| 2 | **The daily ceiling** | 120 minutes of quick adds per person per day; past it the sheet says *clock in instead*. | one `app_settings` number |
| 3 | **＋5 stepper (A) or six chips (B)?** | A — it is the gesture you described and harder to get wrong; B is one tap for long calls. Both are live in the mock-up. | the sheet only; the kernel is the same |
| 4 | **Salaried office people** | No door — their pay does not change with minutes. *If you want off-hours work visible anyway* (comp time, or just to know), that is a different record and its own to-do. | — |
| 5 | **Should they pick a job?** | Optional, Office by default. A required pick would slow the one thing this is for. | the sheet's *For* field |

## The mock-up

`mockup.html` — live: tap ＋5 twice, type a sentence, watch the entry line and the Save button.
The door on the clock row (today / after); the sheet two ways (A stepper, B chips) with the trade
between them; what it becomes on My Time and in the approver's list, with the weekly total; the
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

1. **The kernel, the migration, the RPC** (S). Everything in *New* above except the screens. Verify
   on a throwaway Postgres with stub tables, as the try-out and health migrations were: 10 min
   ending now lands as one row with the note and the Office job; 7 and 35 are refused; a window
   over an existing session is refused with that session's times; yesterday and the future are
   refused; the 25th entry past the ceiling is refused; a helper, a salaried person and a
   read-only user are refused; a direct `INSERT … quick_add_minutes = 10` is refused by the trigger.
   After merge: `db push` (quiet moment) → the types PR.
2. **The door and the sheet** (S). `ClockInOutButton` + `QuickTimeAddSheet`; the guide; release
   note. Verify on the dev server as an assistant: not clocked in → the door; ＋5 ＋5, a sentence,
   save → My Time shows 0.17 h with the chip; clock in → the door is gone; as a helper → never there.
3. **The approver's view** (S). The chip on the four session lists; the weekly line per person in
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
- **Field leads** who take after-hours calls from customers are the same problem with a different
  role list — call 1 can simply grow.
