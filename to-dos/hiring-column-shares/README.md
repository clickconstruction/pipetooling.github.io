---
name: "Hiring: share a column with a helper"
group: ready
status: designed 2026-09-18 · mock-up drawn (`mockup.html`) · not started
summary: >
  **Share one Hiring column with one assistant** so they can work the calls for a role that is no
  threat to their own job — Plumber, HVAC Tech — without seeing the Office Manager column, the
  Review stage (monthly ratings of their teammates and themselves) or the rest of the board. Today
  the Hiring board is one switch per user (`users.team_prospects_access`) that opens all four
  stages. This adds a share list per column, written only by a full holder, enforced in RLS on the
  four hiring tables, and a smaller Hiring tab for a helper: the shared columns on Screen and
  Interview, add / edit / Talked today / drag-rank / Advance, no Hire, no Passed, no Review, and the
  cross-column tells (also-in badges, duplicate merge, the Sources table, the Review head count)
  trimmed.
next: >
  PR 1 — the `team_prospect_role_shares` table and the policy rewrite on `team_prospects`,
  `team_prospect_roles`, `team_prospect_reviews`, `team_prospect_onboarding_statuses` (dry-run in a
  rolled-back transaction with a helper's jwt claim first). Then PR 2 the Share control on the
  column header, PR 3 the helper's tab.
size: S · S · M
blocker: >
  None. Two defaults to confirm with the owner before PR 3 (both taken as drawn): a helper may
  **Advance** to Interview; a helper sees the shared candidates on **Interview** too, not only
  Screen.
opinion: build — the grant is one row per column and helper, the policies already funnel through one function, and the exposure it closes (Review) is real today.
---

# Hiring: share a column with a helper

Status: **designed 2026-09-18** · mock-up in `mockup.html` beside this file · no code yet

## The ask, in the owner's words

> "I would like be able to selectively share colums with the assistants so they can help call and
> bring on helpers that are not risks to their job."

Todd, 2026-09-18, right after the card layout fix (v2.3601) on the same board.

## The decision

**A share list per column, not a flag on the column.** One row per (column, helper) in a new
`team_prospect_role_shares` table, written only by a full Hiring holder. The default is private:
a new column is shared with nobody until someone shares it, so an Office column added in a hurry
cannot leak. (A *hide from assistants* flag was the cheaper build and was rejected for failing
open.)

**What the helper sees.** The Hiring tab, but smaller:

- Only the shared columns, on **Screen** and **Interview**. No Hire stage, no Review stage — Review
  holds the monthly ratings of current teammates, the helper included, and is the real exposure,
  more than the column names.
- The stage strip shows Screen and Interview only. No Review count (it is the active head count).
- Cards lose the *also in: Office Manager* badge when the other column is not shared, the duplicate
  → *Merge* affordance when the twin is not visible, and the **Passed** button. The Sources table
  at the bottom of Screen is not rendered for a helper (it sums every column).

**What the helper can do** in a shared column: add a candidate, edit contact details and notes,
press **Talked today**, drag-rank, and **Advance** to Interview; leave their own interview review
like any staff. **Hire** and **Passed** stay with a full holder — those are the decisions.

**Who shares.** Any full holder (dev or master with `team_prospects_access`), from the column
header: ⋯ → *Share with…* → a checklist of assistants. The helper needs prospects staff access
(`user_has_prospects_staff_access()`) but **not** `team_prospects_access`; a share never grants the
switch. Self-sharing is blocked the way the privileged `users` columns are (the insert policy
requires the writer to be a full holder).

**The database does the filtering.** Every table's SELECT policy admits a row when the viewer is a
full holder *or* the row's column is shared with them. The client hides only what the database
already withheld, so a helper with the network tab open still reads nothing outside their columns.

**Two defaults the owner may want to change** (both drawn in the mock-up):
1. A helper may **Advance**. The alternative is call-and-note only, with a full holder advancing.
2. A helper sees **Interview** for the shared columns. The alternative is Screen only.

## The mock-up

`mockup.html` beside this file — four panels: the board as it is (one switch, four stages), the
Share control on a column header as a full holder sees it, the helper's Hiring tab with two shared
columns and two stages, and the Active accounts row with its new *shares* line.

## Where it plugs in

Exists today:

- `team_prospect_roles` (id, name, position, master_user_id) — the columns; `team_prospects`
  (role_id, status `active | hired | passed`, rank_order, the three ratings, notes, links);
  `team_prospect_reviews` (interview reviews, one per reviewer per candidate);
  `team_prospect_onboarding_statuses` (per hire).
- `public.user_has_team_prospects_access()` — `user_has_prospects_staff_access() AND
  users.team_prospects_access`; every policy on the four tables calls it ("Prospects staff can …"
  policies, last rewritten in `20260906200000_one_company_policy_sweep.sql`).
- `users.team_prospects_access` — dev-set in Settings → Active accounts; the
  `users_guard_privileged_columns` trigger blocks anyone else from changing it.
- `useAuth().teamProspectsAccess` → `Prospects.tsx` shows the Hiring pill and mounts
  `TeamProspectsTab` only when true; `resolveProspectsLanding` (`src/lib/prospects/prospectsLanding.ts`)
  lands a Hiring-only holder on the board.
- `TeamProspectsTab.tsx`: loads all four tables plus the active `users` count (the Review tab's
  number); `SortableCandidateCard` carries `alsoInRoles`, `duplicate` (with Merge) and the action
  row; `RoleColumn` has the header the Share control joins; the Sources table
  (`summarizeTeamProspectSources`) sits under Screen; `TeamReviewSection` is the Review stage.
- `docs/ACCESS_CONTROL.md` § Hiring — the paragraph that has to change.

New:

- `team_prospect_role_shares (role_id → team_prospect_roles ON DELETE CASCADE, user_id → users
  ON DELETE CASCADE, granted_by, created_at, PRIMARY KEY (role_id, user_id))`, RLS: SELECT for the
  helper's own rows and for full holders; INSERT / DELETE for full holders only. Both read-only
  blocks (`apply_read_only_write_blocks`, `apply_read_only_stmt_blocks`), `SET lock_timeout = '3s'`.
- `public.user_hiring_shared_role_ids()` — `SELECT role_id FROM team_prospect_role_shares WHERE
  user_id = auth.uid()` (STABLE, SECURITY DEFINER), so the policies read as one clause.
- Policy rewrite on the four tables: SELECT `user_has_team_prospects_access() OR role_id IN
  (SELECT user_hiring_shared_role_ids())` (reviews and onboarding statuses join through their
  candidate's `role_id`); INSERT / UPDATE for a helper WITH CHECK `role_id` shared **and**
  `status = 'active'` (no Hire, no Passed, no moving a card into an unshared column); DELETE stays
  full-holder only. Roles: SELECT `id IN (…shared…)`; writes full-holder only.
- `useAuth().hiringSharedRoleIds` (or a `hiringAccess: 'full' | 'helper' | 'none'` reading) so the
  Hiring pill, the landing kernel and the tab all agree.
- A `helper` mode in `TeamProspectsTab`: stage strip of two, no Passed, no Hire, no Sources table,
  badges and Merge trimmed to visible columns, the Add-candidate form's *Role column* picker
  limited to shared columns.

## The plan

1. **PR 1 — the table and the policies** (S, one migration + `docs/migrations/<version>_hiring_column_shares.md`).
   No screen changes; a full holder's board is byte-identical. Dry-run against prod inside
   `BEGIN; … ROLLBACK;` with `set_config('request.jwt.claims', …)` as a helper uuid and assert the
   four SELECTs return only the shared column's rows.
2. **PR 2 — Share with…** (S). The ⋯ on the column header for full holders → a checklist of
   assistants (users with prospects staff access, minus full holders) with who shared and when; the
   header shows a small *shared with 1* chip. Settings → Active accounts gains a read-only *shares*
   line under the Hiring switch. `ACCESS_CONTROL.md` § Hiring updated.
3. **PR 3 — the helper's tab** (M). `useAuth` reads the shares; the Hiring pill and landing work for
   a helper; `TeamProspectsTab` in helper mode; guide `team-prospects.md` gains a *Sharing a column
   with a helper* section; `GLOSSARY.md` gets *helper (Hiring)*.

## How to verify

- PR 1: the psql dry run above; then `npm run check:migration-drift` after `supabase db push`.
- PR 2–3: a **test assistant account** (Settings → Active accounts, role assistant, prospects staff
  access on, Hiring switch **off**). As dev: share Plumber with it. Log in as it (a real login —
  `/dev-login` always signs in as the dev account): the Prospects nav shows Hiring; the board shows
  Plumber only; Screen and Interview only; a Plumber card has Talked today and Advance, no Passed;
  a Plumber candidate who is also in Office Manager shows no *also in* badge; the Add form's Role
  picker lists Plumber only; `PATCH team_prospects` with `status: 'hired'` from the console is
  refused by RLS. Unshare: the Hiring pill disappears on the next load.
- Regression as a full holder: nothing on the board changed from v2.3601.

## Where it stands

Designed and drawn 2026-09-18. Nothing built. The two defaults in *The decision* are the only open
questions; both can be flipped in PR 3 without touching PR 1's schema.
