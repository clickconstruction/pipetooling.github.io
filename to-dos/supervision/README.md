---
name: "Supervision: one switch instead of team leads"
group: ready
status: PRs 1–4 shipped (v2.3611 the switch · v2.3612 the Dispatch warning · v2.3613 My crew · v2.3614 Rate my crew) · PR 5 retire Team leads next · before / after in `before-after.html`
summary: >
  **A job-day is covered when someone on it does not need supervision.** That is the whole org
  chart for hourly, per-job work, and it replaces the Team leads list (leader → member links
  nobody maintains, three archived leaders still in it). One switch per helper and per sub —
  *needs supervision*, on by default, off when the office decides they can run a job — and
  everything else is read: the supervisor of a job-day is whoever is listed on it and does not
  need supervising; Dispatch warns when a block has nobody like that; Who's where marks
  *supervising* and *unsupervised*; the supervisors of the day own the reports, see (not approve)
  the crew's hours, and rate the crew monthly with the three sliders. The helper try-out loop asks
  them the verdict.
next: >
  PR 5 — retire Team leads: My Team's membership reads the supervised crew (no Approve there
  either — the office and pay-approved masters keep approval on Hours); the clock-out push
  resolves the supervisors listed on the member's block that day; the modal, the People → Users
  button and the Person Desk team section go; `team_leader_assignments` is dropped after a
  release once nothing reads it (the `is_team_lead_for_member` policy branches go with it).
size: S (done) · S (done) · M (done) · S (done) · S
blocker: >
  None. Owner calls taken as drawn (2026-09-19): two levels per helper and per sub — supervision
  required / not required; masters never need it; superintendents and office roles are not
  supervision; Dispatch warns, never refuses; ratings monthly; subs who do not need supervision
  count as coverage for their own helpers.
ver: v2.3611 · 3612 · 3613 · 3614
opinion: build — five small PRs that delete a maintained list and answer the question the owner actually asked ("does every job have someone competent on it").
---

# Supervision: one switch instead of team leads

Status: **PRs 1–4 shipped** (v2.3611 the switch · v2.3612 the Dispatch pill · v2.3613 My crew · v2.3614 Rate my crew) · PR 5 next · `before-after.html` beside this file

## The ask, in the owner's words

> "I think that leads should be responsible to make sure their jobs have reports, I think they
> should be able to see their teams hours but not necessary be able to approve them, and I think
> they should be able to rate those team members using the current three slider rating system."

> "What I am starting to notice is it does not matter what leader is on a job, so long as there
> is someone competent jobs can progress, and helpers can't go do most of anything without
> oversight."

> Levels: helper — 1) supervision required 2) supervision not required; subs — 1) supervision
> required 2) supervision not required.

Todd, 2026-09-19, after Who's where shipped (v2.3607, v2.3609) and the Team leads modal turned
out to be a standing hours-approval list with low use.

## The decision

**One fact per person, two values.** `users.needs_supervision` — true for every helper and sub
by default, false when the office decides they can run a job. Masters have no switch (they
supervise by definition). Office roles and superintendents have no switch and are not supervision
for field work. Set from the person's row (People → Users, Active accounts) by dev, masters and
assistants — the same hands that set the other per-person switches. No leader → member links,
no modal.

**The rule.** A job-day is **covered** when at least one person listed on its block (or clocked
on it) does not need supervision. Those people are the job-day's **supervisors**; everyone else
on the block is supervised by them. Two qualified people on one job are both supervisors. A
block with nobody qualified is **unsupervised** — a finding, shown wherever the block is shown.

**What a supervisor carries, for the job-days they supervised — all read, nothing assigned:**

1. **Reports.** A job-day they supervised with no report is theirs: a card on their Dashboard
   (*Oak St · Tue — no report yet*, one tap to write it) that stays until it is filed. The office
   sees the same list grouped by supervisor.
2. **The crew's hours, read-only.** The sessions of everyone they supervised, on the days they
   supervised them: in / out and totals, no wages, **no Approve**. Approval stays with the office
   and the pay-approved masters.
3. **Ratings, monthly.** *Rate my crew* on the Dashboard once a month, one card per person they
   supervised for two or more days that month, the three sliders + remarks, by name, written to
   `team_member_reviews` as one more reviewer — the Review stage already shows every reviewer's
   latest side by side.

**Where it shows.**

- **Dispatch** — a linked block with nobody who does not need supervision wears an
  *Unsupervised* mark while it is built and on the day. A warning, never a refusal: the office
  sometimes knows what the roster does not.
- **Who's where** — the crown becomes *supervising* and goes on every qualified head on a crew;
  a lead-less crew reads *unsupervised — nobody on this block can run it*; the week strip counts
  unsupervised job-days; the day view marks the island.
- **The helper try-out loop** (`../helper-tryout-loop/`) — the verdict card goes to the
  supervisors of the helper's job-day (`supervisorsOf` replaces `derivedLead`).
- **Team leads** — retired. Hours visibility re-derives from supervision; the clock-in / out push
  goes to the supervisors listed on the member's block that day; the modal and
  `team_leader_assignments` go once nothing reads them.

**Growth.** A helper joins with the switch on. Try-out verdicts and monthly sliders are the
evidence. When the office flips the switch, the person becomes coverage the next time Dispatch
lists them, and Who's where shows them supervising.

## The mock-up

`before-after.html` — six pairs, drawn from the live screens: the Team leads modal → the switch
on the row; Who's where's crown → *supervising* / *unsupervised*; a Dispatch block → the same
block with the warning; the leader's Dashboard (approve) → the supervisor's Dashboard (reports
owed, hours read-only, rate my crew); the Review stage → the supervisor's review among the
others; the try-out verdict card → addressed to the supervisors of the day.

## Where it plugs in

Exists today:

- `users` (role, the per-person switches: `team_prospects_access`, `estimator_prospects_access`,
  `read_only`; the `users_guard_privileged_columns` trigger pattern), People → Users rows
  (`UsersTabRow.tsx`, `UsersTabPhoneRow.tsx`), Settings → Active accounts (`ActiveAccountsPanel`).
- Who's where: `src/lib/people/whosWhere.ts` (`derivedLead`, `weekCrews`, `islandsAt`),
  `WhosWhereWeek.tsx`, `PeopleWhosWhereTab.tsx`.
- Dispatch linked blocks: `job_schedule_blocks.shared_block_group_id`, `ScheduleDispatchHub.tsx`,
  `scheduleDispatchAddBlockSave.ts`, `dispatchManagePersonDay.ts` (group → teammates).
- Reports per job-day: `crewDay.ts` (`CrewDayFlag 'no_report'`), `list_reports_for_job_ledger`,
  the crew day email.
- Hours: `DashboardMyTeamSection.tsx` / `useDashboardMyTeamSectionState.ts` (the Full / Strip
  view, the approve controls to leave out), `clock_sessions` RLS (own rows + roster roles).
- Ratings: `team_member_reviews` (reviewer_user_id, the three ratings + comments, one per
  reviewer per person per month), `TeamReviewSection.tsx`, `ratingDimensions.tsx` (the sliders).
- Team leads: `team_leader_assignments`, `TeamLeadsModal` / `TeamLeadsManager`,
  `team_leader_clock_notify_prefs`, `notify-team-lead-clock`.

New:

- Migration A (PR 1): `users.needs_supervision boolean NOT NULL DEFAULT true`; a backfill
  `UPDATE users SET needs_supervision = false WHERE role NOT IN ('helpers','subcontractor')`
  (the column is meaningful only for those two roles; everyone else false so the rule is one
  line); guard: dev / master / assistant may change it (extend the privileged-columns trigger's
  allow-list rather than adding a trigger). `docs/migrations/<version>_needs_supervision.md`.
- Kernel `src/lib/people/supervision.ts`: `isSupervisor(person)` (master, or helper/sub with
  the switch off), `supervisorsOf(people)`, `coverage(block people) → 'covered' | 'unsupervised'`;
  tests. `whosWhere.ts` reads it (`derivedLead` → `supervisorsOf`, kept as an alias one release).
- PR 2: Dispatch — the mark on a linked block group and on the Add / Edit block modal.
- PR 3: `DashboardSupervisorSection.tsx` — reports owed (from the supervised job-days with no
  report), the crew's hours read-only (sessions of the supervised people on the supervised days;
  RLS already admits roster reads for masters and subs see own rows — a SECURITY DEFINER RPC
  `supervised_sessions(p_from, p_to)` scoped to job-days the caller supervised keeps subs from
  reading beyond their crew).
- PR 4: `RateMyCrewDeck.tsx` — monthly, from the supervised people (≥ 2 days), writing
  `team_member_reviews`; the Review stage gains the *supervisor* reviewer chip.
- PR 5: retire Team leads — Dashboard My Team reads supervision; the push resolves supervisors;
  the modal is removed; `team_leader_assignments` dropped after a release.
- Guides: `supervise-a-crew.md` (Field Work: what a supervisor sees and owes),
  `see-who-was-on-which-job.md` re-worded; `ACCESS_CONTROL.md` (the switch, who sets it, the
  retired list), `GLOSSARY.md` (*needs supervision*, *supervisor*, *unsupervised job-day*),
  `PROJECT_DOCUMENTATION.md`.

## The plan

1. **The switch + Who's where wording** (S, migration A). Verify: flip a helper's switch on
   Active accounts; Who's where's week now crowns them *supervising* on their crews; a crew of
   switched-on helpers reads *unsupervised*; the day island marks it. Guard: an estimator's
   PATCH of the column is refused.
2. **The Dispatch warning** (S). Verify: build a linked block with two helpers → the mark; add a
   master → it clears; save is never blocked.
3. **The supervisor's Dashboard** (M, one RPC). Verify as a master and as a switched-off sub:
   reports owed for their job-days, hours of their crew read-only, nothing of anyone else's.
4. **Rate my crew** (S). Verify: a supervisor's monthly deck lists the right people; the Review
   stage shows their row beside the office's.
5. **Retire Team leads** (S). Verify: the leader Dashboard for a former leader now shows their
   supervised crew; the push arrives for a supervised member's clock-out; the modal is gone.

## How to verify (end to end)

Dispatch lists Bryan (switch on) with Mike on Oak St Tuesday. Who's where crowns Mike
*supervising*; Bryan's head is plain. Bryan clocks in and out; Mike's Dashboard shows *Oak St ·
Tue — no report yet* until Mike files it, and Bryan's hours in the crew list with no Approve. At
month end Mike's *Rate my crew* deals Bryan's card; the Review stage shows Mike's sliders beside
the office's. Dispatch lists two switched-on helpers alone on Elm Ct → the block wears
*Unsupervised* and Who's where counts it.

## Where it stands

Designed and drawn 2026-09-19 after the team-leads conversation. Nothing built. The helper
try-out loop (`../helper-tryout-loop/`) follows this: its verdict card reads `supervisorsOf`.
