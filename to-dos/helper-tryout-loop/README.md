---
name: "Hiring: the helper try-out loop"
group: ready
status: designed 2026-09-18 · two mock-ups drawn (`mockup.html` the loop, `mockup-share.html` the column share) · not started
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
  PR 1 — the Try-out stage: `team_prospects.trial_user_id`, `users.trial_prospect_id`, status
  `trial`; *Try out* on a helper card creates the roster user (existing `create-user` hand-off)
  flagged trial; the stage strip gains Try-out. Then PR 2 the leader's verdict card (push at the helper's clock-out + the Dashboard My Team
  card) and `team_prospect_trial_verdicts`, PR 3 the tally + Hire / Pass / Keep trying, PR 4–6 the column
  share (table + policies, Share with…, the helper's tab).
size: S · S · S · S · S · M
blocker: >
  None. Owner calls, all taken as drawn: the verdict is asked of **the helper's leader for that
  day — a master or a sub — when the helper clocks out, once per helper per day, by name** (not
  anonymous — the point is who wants whom); Try out asks *who with?* and writes the leader link;
  a helper column skips the Interview call (Screen → Try out); the office presses Hire, the
  leaders never do.
opinion: build — PRs 1–3 are the purpose and ride the leader link and the clock-out push that already exist; the share (4–6) is what lets the assistant feed the column at all.
---

# Hiring: the helper try-out loop

Status: **designed 2026-09-18** · `mockup.html` (the loop) and `mockup-share.html` (the column
share, drawn first) beside this file · no code yet

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
   helper's **leader for that stint** — the `team_leader_assignments` row (leader → member) that
   *Try out* writes when it asks *who with?* (a master or a sub; Dispatch changes it when the
   helper moves). Three doors to the same card:
   - **Push**, the moment the helper clocks out — the existing `notify-team-lead-clock` webhook
     already pushes leaders on a member's clock-out; the trial variant's text is *Bryan clocked
     out of Oak St — take him again?* and opens the card.
   - **The Dashboard My Team section** (leaders already see their members' sessions there): the
     card sits at the top until answered, through the next morning.
   - **A leader's own clock-out prompt**, before the crew deck, for subs who clock — as first
     drawn.
   The card: *Bryan worked with you today at J258 · Oak St. Take him again?* **Yes · No · Not
   sure**, an optional one-line note, Skip. Stored in `team_prospect_trial_verdicts (prospect_id,
   leader_user_id, job_ledger_id, work_date, verdict, note)`, unique per (prospect, leader,
   work_date). **By name**, never anonymous: the point is that Mike wants Bryan and Jake does not.
   When no leader link exists for the day, the card falls back to anyone who clocked the same job
   that day (the crew deck's `crew_review_teammates` join) — that catches a sub without the link.
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
- `team_leader_assignments` (leader_user_id → member_user_id; People → Users → Team leads modal,
  dev-only; Dashboard **My Team** — `DashboardMyTeamSection.tsx` reads the members' sessions) and
  `team_leader_clock_notify_prefs` → the `notify-team-lead-clock` edge function (a database
  webhook on `clock_sessions` INSERT / UPDATE; Web Push to opted-in leaders). This is the channel
  to a master who never clocks.
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
  UPDATE own rows for the helper's leader that day (a `team_leader_assignments` row) or anyone
  who shares a clock session with the helper that day (checked in the policy), SELECT for
  `user_has_team_prospects_access()` or a column share; `public.trial_helpers_i_led_today()` RPC
  (SECURITY DEFINER: my members with `trial_prospect_id`, plus same-job clock-mates, whose session
  today is closed and has no verdict from me). The `notify-team-lead-clock` function gains the
  trial text and a deep link to the card when the member is a trial helper.
- `src/lib/hiring/trialTally.ts` (PR 3): the tally and the nudge from verdict rows + day counts;
  tests. `TrialVerdictCard.tsx` in `team-feedback/` (PR 2): rendered by the Dashboard My Team
  section while `trial_helpers_i_led_today()` returns rows, opened by the push's deep link, and
  dealt by the clock-out prompt before the deck for leaders who clock.
- Migration C (PR 4): `team_prospect_role_shares` + `user_hiring_shared_role_ids()` + the policy
  rewrite (as in `mockup-share.html`'s to-do text, now folded here).
- Guides: `team-prospects.md` gains *Trying a helper out* and *Sharing a column*; a new
  `see-if-a-helper-worked-out.md` (Field Work, roles: all) for the clock-out card.
  `ACCESS_CONTROL.md` § Hiring, `GLOSSARY.md` (*trial helper*, *try-out*, *helper of the board*).

## The plan

1. **Try-out stage** (S, migration A). *Try out* on helper-column Screen and Interview cards asks
   *who with?* (a leader picker: masters and subs) and writes the `team_leader_assignments` row;
   the stage; the roster hand-off with `trial`; the card ↔ user links; Hire clears the flag; Pass
   archives and removes the link. Verify: try out a test candidate → they appear on People → Users as a helper and in
   the crew pickers; the card sits in Try-out; Hire → regular helper; Pass → archived.
2. **The leader's card** (S, migration B). The RPC, the verdict table, the card on the Dashboard
   My Team section, the push text + deep link, the clock-out door for leaders who clock. Verify on
   the dev server: a trial helper (member) clocks in and out on a job; the leader's Dashboard shows
   the card and the push arrives; a sub leader who clocks out sees it in the prompt too.
3. **The tally and the nudge** (S). Kernel + tests; the Try-out card; Keep trying. Verify with
   seeded verdict rows.
4. **Column share — table and policies** (S, migration C). Dry-run with a helper's jwt claim in a
   rolled-back transaction (see `mockup-share.html`'s can / cannot table for the assertions).
5. **Share with…** (S). Column header ⋯ → checklist; Active accounts line; `ACCESS_CONTROL.md`.
6. **The assistant's tab** (M). Shared columns on Screen / Interview / Try-out; the trims; the
   Role picker limited; guide sections.

## How to verify (end to end, once 1–3 are in)

An assistant adds a helper to the Helper column and presses Try out, picking Mike as the leader.
Dispatch schedules the helper with Mike. The helper clocks in and out on the job. Mike gets the
push and the Dashboard card asks "Take Bryan again?" — Yes with a note. The Try-out card reads
*1 day · Mike ✓ "…" · needs another leader*. Two more days, one with a sub who clocks (the card in
the sub's clock-out prompt) → *3 leaders said yes — hire?* → the office presses Hire → the trial
flag clears and the card moves to Hire with the checklist.

## Where it stands

Designed and drawn 2026-09-18, after the column share was drawn first and the owner named the
purpose. Nothing built. The owner calls in the front matter are taken as drawn. The owner's note that
masters do not clock (2026-09-18) moved the trigger to the helper's clock-out and the card to the
leader's push + Dashboard, with the leader's own clock-out as a third door for subs.
