---
name: "Hiring: the helper try-out loop"
group: ready
status: PR 1 shipped v2.3627 (the Try-out stage; Try out makes the helper's login in one press) · PR 2 shipped v2.3650 (the leader's verdict card — Dashboard, push, the leader's own clock-out) · PRs 3–6 not started · two mock-ups beside this file
summary: >
  **An assistant feeds helpers to the master plumbers; the masters (or the subs the helper is
  placed with) try them on jobs and say, by name and the same day, which ones they want back; the
  office hires the ones the leaders keep asking for.** The Hiring board does the feeding half (Screen) and the paperwork half (Hire) and
  nothing in between: a helper has to be hired to be scheduled, the only field feedback is the
  anonymous fortnightly crew deck, and nothing on a card says how the try-out went. This adds a
  **Try-out** stage (on the roster as a trial helper, card still linked), a **one-tap verdict card for
  whoever led the helper that day** — dealt when the *helper* clocks out, since masters do not
  clock (take them again: yes / no / not sure + a word), a **tally on the
  card** (days, which master said what), a nudge to Hire or Pass — and, so the assistant can feed
  without seeing the rest of the board, a **share list per column** enforced in RLS.
next: >
  Push the PR 2 migration and deploy `notify-team-lead-clock`, then one live pass: Try out a test
  card, put the helper on a master's block, clock them in and out, answer the card. Then PR 3 the
  tally + the nudge + Keep trying (and the *no lead listed* line) on the Try-out card, PR 4–6 the
  column share (table + policies, Share with…, the helper's tab).
size: S · S · S · M (four left)
ver: v2.3627 · v2.3650
blocker: >
  None — Who's where shipped (v2.3607 the day, v2.3609 the week by crew), so `derivedLead` exists to
  read. Owner calls taken as drawn: the verdict is asked of the helper's lead for the day — a
  master or a sub — when the helper clocks out, once per helper per day, by name; *Try out* writes
  no leader link; a helper column skips the Interview call; the office presses Hire, the leaders
  never do.
opinion: build — PRs 1–3 are the purpose and ride the derived lead and the clock-out webhook that already exist; the share (4–6) is what lets the assistant feed the column at all.
---

# Hiring: the helper try-out loop

Status: **PR 1 shipped v2.3627** (2026-09-19) · designed 2026-09-18 · `mockup.html` (the loop) and
`mockup-share.html` (the column share, drawn first) beside this file

## The ask, in the owner's words

> "I would like be able to selectively share columns with the assistants so they can help call
> and bring on helpers that are not risks to their job."

> "The purpose of this is for the assistant to be able to feed master plumbers helpers while the
> master plumbers figure out which they like and which they don't like."

> "Masters are probably not going to clock out, but subcontractors would and sometimes we do
> want to put these people with subcontractors."

Todd, 2026-09-18. The first ask produced the column share (`mockup-share.html`). The second is
the purpose, and the board does not serve it today. The third moved the verdict's trigger off the
master's clock-out (see *The decision*, 2).

## What the board does today, against that purpose

- **Feeding — good.** Screen: columns per role, drag-rank, Talked today, call-next, sources. With
  the column share an assistant works the Helper column and sees nothing else.
- **Screening — office-shaped.** Interview: a phone review with three 0–100 sliders and remarks,
  then Advance / Passed / Back to Screen. Right for an office hire; not what a master thinks after
  a day in a trench.
- **The try-out — invisible.** A helper has to be on the roster to be scheduled, so the pipeline
  ends (Hire → *Add to roster*) exactly where the master's evaluation begins, and the roster person
  is not linked back to the card. Nothing records "Mike worked with Bryan Tuesday and would take
  him again".
- **Field feedback — anonymous and slow.** The clock-out crew deck (v2.2824, `CrewReviewDeck`)
  runs every couple of weeks, hides who said what, and shows nothing until two people have rated.
  This loop needs the opposite: *Mike yes, Jake no*, by name, that day.
- **No loop back.** When a master says no, nobody tells the assistant to feed the next one; when
  three say yes, nobody says hire.

## The decision

Five pieces, in the order they pay off:

1. **Try-out is a stage.** Screen → Interview → **Try-out** → Hire → Review. For a helper column,
   *Try out* sits on the Screen card where Advance is (the Interview call is optional for helpers —
   Advance is still there). Pressing it runs the existing Hire → roster hand-off (`create-user`,
   role `helpers`, service types from the column) but with **status `trial`**: the person is on
   the roster and schedulable like any helper, `users.trial_prospect_id` points back at the card,
   `team_prospects.trial_user_id` points forward. The card moves to Try-out.
2. **The leader's verdict, one tap, when the helper clocks out.** Masters do not clock; subs do;
   trial helpers always do. So the trigger is the **helper's** clock-out, and the card goes to the
   helper's **lead for that day, read from the schedule and the clock** — Who's where's (v2.3609)
   `derivedLead`: the master or sub on the helper's linked crew block that day, else the master or
   sub who clocked the same job. Nothing is written to Team leads; *Try out* asks nothing. If the
   day has no lead by that rule, the card goes to the office (the Try-out card shows *no lead
   listed — ask Dispatch to put the master on the block*). Three doors to the same card:
   - **Push**, the moment the helper clocks out — the `notify-team-lead-clock` webhook (a
     database webhook on `clock_sessions`) gains a branch: when the member is a trial helper,
     resolve the derived lead and push them *Bryan clocked out of Oak St — take him again?*, which
     opens the card. (Its existing branch, leader-assignment prefs, is untouched.)
   - **A Dashboard card** for anyone who is a trial helper's derived lead today: it sits at the top
     until answered, through the next morning.
   - **A leader's own clock-out prompt**, before the crew deck, for subs who clock — as first
     drawn.
   The card: *Bryan worked with you today at J258 · Oak St. Take him again?* **Yes · No · Not
   sure**, an optional one-line note, Skip. Stored in `team_prospect_trial_verdicts (prospect_id,
   leader_user_id, job_ledger_id, work_date, verdict, note)`, unique per (prospect, leader,
   work_date). **By name**, never anonymous: the point is that Mike wants Bryan and Jake does not.
   The same-job clock join (the crew deck's `crew_review_teammates`) is the fallback inside
   `derivedLead`, so a sub Dispatch paired ad hoc still gets asked.
3. **The tally on the card.** The Try-out card shows days worked (from the helper's
   `clock_sessions`), and each leader's latest verdict with their note — masters and subs alike:
   *Mike ✓ "careful, a bit slow" · Jake (sub) ✓ · Luis ✗ "late twice"*. Three buttons: **Hire** (clears the trial flag — a regular helper; the card
   moves to Hire with the onboarding checklist), **Pass** (archives the roster user through the
   existing archive-user flow; the card moves to Passed, notes and verdicts kept), **Keep trying**
   (nothing changes; the card notes the decision was deferred and by whom).
4. **The nudge.** A kernel reads the tally and writes one line on the card: *3 leaders said yes —
   hire?* · *2 said no — pass?* · *1 day, 1 yes — needs another leader*. Thresholds in the kernel
   (defaults: hire at 3 yes and 0 no; pass at 2 no; otherwise "needs another master"), unit-tested,
   no automation — the office presses the button.
5. **The column share** (`mockup-share.html`, unchanged): `team_prospect_role_shares`, one row per
   column and helper-of-the-board, written by a full holder; RLS on the four hiring tables; the
   assistant's tab shows the shared columns on **Screen, Interview and Try-out** (they need the
   tally to know whether to keep feeding), never Hire, Review, the Sources table, or the
   cross-column tells. In a shared column an assistant may add, edit, Talked today, drag-rank,
   Advance and **Try out**; Hire, Pass and Keep trying are the office's.

**What the leader sees:** only the card — as a push and on their Dashboard, or in their own
clock-out prompt if they clock. No board, no switch, no sliders. A master who holds the Hiring
switch sees the board as before.

**Why the helper's clock-out and not the crew deck's cadence:** the deck answers "how is the
crew" every fortnight, anonymously, from everyone who clocks. The try-out answers "do you want this
one back" the same day, from the person who led the helper, by name — and that person may never
clock. Same tables the deck reads (`clock_sessions`, the leader links), different question,
separate table; the crew deck is untouched.

## The mock-ups

- `mockup.html` — the loop: the five-stage strip with Try-out; a Try-out card with the tally, the
  nudge and the three buttons; the leader's card (the push, the Dashboard, a sub's clock-out); the
  assistant's shared column
  with Try out on a Screen card and a Try-out card they can read; a what-changes table.
- `mockup-share.html` — the column share as first drawn: the Share with… control on a column
  header, the helper's trimmed tab, the Active accounts line, the can / cannot table.

## Where it plugs in

Exists today:

- `TeamProspectsTab.tsx`: the stage strip (`stage` state, `stageTabs`), `SortableCandidateCard`
  (Screen), the Interview rows with `My review`, the Hire → roster hand-off (`hireTarget`,
  `create-user`, *Add to roster*, v2.2910), `team_onboarding_items` / `…_statuses`.
- `team_prospects.status` (`active | hired | passed`), `team_prospect_roles`,
  `team_prospect_reviews`, `user_has_team_prospects_access()` and the "Prospects staff can …"
  policies (`20260906200000_one_company_policy_sweep.sql`).
- `ClockInOutButton.tsx` → the clock-out prompt → `CrewReviewDeck` (`source="clock_out_prompt"`,
  `getTeamFeedbackEligibility`); `public.crew_review_teammates(p_lookback_days)` — who shared a
  `job_ledger_id` + `work_date` with me in `clock_sessions` (pending sessions count).
- `notify-team-lead-clock` edge function — a database webhook on `clock_sessions` INSERT /
  UPDATE that Web Pushes leaders; the trial branch reuses its webhook and push plumbing. The
  channel to a master who never clocks. (`team_leader_assignments` and the Team leads modal are
  **not** used — owner, 2026-09-18.)
- `src/lib/people/whosWhere.ts` → `derivedLead(people)` (Who's where v2.3609, `docs/recent-features/v2.3609.md`) — whom the card asks.
- `create-user` (dev-only caller today — the Try out press runs through the same office account
  path the Hire hand-off uses) and `archive-user` (`archiveUserDialog.ts`); `users.role = 'helpers'`
  with `helpers_service_type_ids`.
- `users.is_digital_twin` hiding (`isActiveRosterPerson`) — the pattern **not** to copy: a trial
  helper is on every roster on purpose; they are being scheduled.

New:

- Migration A (PR 1): `team_prospects.trial_user_id uuid → users`, `users.trial_prospect_id uuid →
  team_prospects`, status value `trial`; `COMMENT`s; both read-only blocks are already on these
  tables. `docs/migrations/<version>_helper_trial.md`.
- Migration B (PR 2): `team_prospect_trial_verdicts` (+ both read-only appliers); RLS — INSERT /
  UPDATE own rows for the helper's derived lead that day (the SQL twin of `derivedLead`: a master
  or sub sharing the helper's `shared_block_group_id` on `work_date`, else one sharing the job in
  `clock_sessions`), SELECT for `user_has_team_prospects_access()` or a column share;
  `public.trial_helpers_i_led_today()` RPC (SECURITY DEFINER, the same rule from my side: trial
  helpers whose crew I led today, whose session is closed and has no verdict from me). The `notify-team-lead-clock` function gains the
  trial text and a deep link to the card when the member is a trial helper.
- `src/lib/hiring/trialTally.ts` (PR 3): the tally and the nudge from verdict rows + day counts;
  tests. `TrialVerdictCard.tsx` in `team-feedback/` (PR 2): rendered on the Dashboard while
  `trial_helpers_i_led_today()` returns rows, opened by the push's deep link, and dealt by the
  clock-out prompt before the deck for leaders who clock.
- Migration C (PR 4): `team_prospect_role_shares` + `user_hiring_shared_role_ids()` + the policy
  rewrite (as in `mockup-share.html`'s to-do text, now folded here).
- Guides: `team-prospects.md` gains *Trying a helper out* and *Sharing a column*; a new
  `see-if-a-helper-worked-out.md` (Field Work, roles: all) for the clock-out card.
  `ACCESS_CONTROL.md` § Hiring, `GLOSSARY.md` (*trial helper*, *try-out*, *helper of the board*).

## The plan

1. **Try-out stage — SHIPPED v2.3627** (`docs/recent-features/v2.3627.md`). Built with one
   correction: the Hire hand-off writes a `people` row and `create-user` was dev-only, so they
   were never one path. The owner chose *one press makes the login too* (2026-09-19):
   `create-user` has a `trial_prospect_id` door for Hiring-board holders that builds a `helpers`
   login from the card and nothing from the caller. Pass does not archive the login — `archive-user`
   keeps its own gate — and the card says so. As planned: *Try out* on helper-column Screen and Interview cards; the
   stage; the roster hand-off with `trial`; the card ↔ user links; Hire clears the flag; Pass
   archives. Who the helper works with is Dispatch's business, as today. Verify: try out a test candidate → they appear on People → Users as a helper and in
   the crew pickers; the card sits in Try-out; Hire → regular helper; Pass → archived.
2. **The leader's card — SHIPPED v2.3650** (`docs/recent-features/v2.3650.md`). Built with one
   correction: *who is asked* is the Supervision rule (v2.3611), which replaced `derivedLead` after
   this was written — **everyone** who could run a job the helper worked that day (a master, or a
   helper / sub with *needs supervision* off), listed or clocked on the same job, each asked
   separately; a qualified helper can therefore be asked, an unqualified one never. The *no lead
   listed — ask Dispatch* line on the Try-out card moved to PR 3 with the rest of the card. As
   planned: (S, migration B; needs Who's where PR 2). The RPC, the verdict table,
   the Dashboard card, the webhook's trial branch + deep link, the clock-out door for leaders who
   clock. Verify on the dev server: a master is on a linked block with a trial helper; the helper
   clocks in and out; the master's Dashboard shows the card and the push arrives; a sub who led
   another day and clocks out sees it in the prompt too; a day with no master or sub on the block
   sends the card to the office.
3. **The tally and the nudge** (S). Kernel + tests; the Try-out card; Keep trying. Verify with
   seeded verdict rows.
4. **Column share — table and policies** (S, migration C). Dry-run with a helper's jwt claim in a
   rolled-back transaction (see `mockup-share.html`'s can / cannot table for the assertions).
5. **Share with…** (S). Column header ⋯ → checklist; Active accounts line; `ACCESS_CONTROL.md`.
6. **The assistant's tab** (M). Shared columns on Screen / Interview / Try-out; the trims; the
   Role picker limited; guide sections.

## How to verify (end to end, once 1–3 are in)

An assistant adds a helper to the Helper column and presses Try out. Dispatch puts the helper on
Mike's linked block. The helper clocks in and out on the job. Mike gets the push and the Dashboard
card asks "Take Bryan again?" — Yes with a note. The Try-out card reads
*1 day · Mike ✓ "…" · needs another leader*. Two more days, one with a sub who clocks (the card in
the sub's clock-out prompt) → *3 leaders said yes — hire?* → the office presses Hire → the trial
flag clears and the card moves to Hire with the checklist.

## Where it stands

Designed and drawn 2026-09-18, after the column share was drawn first and the owner named the
purpose. PR 1 built 2026-09-19 (v2.3627); its migration is applied (the ledger read 622 / 622 on
2026-09-20) — a live Try out on a test card is still owed. PR 2 built 2026-09-20 (v2.3650); its
migration push, the `notify-team-lead-clock` deploy and the live pass in *next* are owed. For PR 4: an assistant holding only a column share does not pass
`user_has_team_prospects_access()`, so the `create-user` door and `end_team_prospect_trial()` both
need the share rule added when the share exists. The owner calls in the front matter are taken as drawn. The owner's note that
masters do not clock (2026-09-18) moved the trigger to the helper's clock-out; the second pass the
same day removed every dependency on the Team leads list — the lead is read from the schedule and
the clock (Who's where, v2.3609), which has since shipped.
