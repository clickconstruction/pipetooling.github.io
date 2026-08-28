# Digital twins: role briefs, app directory, twin identity

---
file: docs/DIGITAL_TWINS_PLAN.md
type: Engineering / Product plan
purpose: Staged plan for role-impersonating agent accounts ("digital twins") that test, validate, and eventually perform real work in PipeTooling — per-role briefs, an app directory, first-class twin identity in the schema, and a mission harness.
audience: Developers, AI Agents, Digital Twins
last_updated: 2026-08-28
sections:
  - The idea
  - Owner decisions (locked)
  - Deliverables
  - Phase 0 — App directory
  - Phase T — Twin identity (build)
  - Phase 1 — Estimator pilot
  - Phase 2 — The rest of the roles
  - Phase 3 — Mission library & harness
  - Phase 4 — Upkeep
  - Status log
---

## The idea

An agent with a **limited context window** signs into the app as a role-scoped account and
does real work: an estimator twin chases bids, an assistant twin cleans up hours, a
subcontractor twin reports work. Short-term this validates the app (do the flows actually
work end-to-end for each role?); long-term twins fulfill real roles on real records.

The design bet: PipeTooling already has the raw material — a 9-role permission matrix
(`docs/ACCESS_CONTROL.md`), 300+ role-scoped task recipes (`src/content/help/*`, `roles:`
frontmatter, CI-validated), `/dev-login` role impersonation, and training-mode
(`users.read_only`) write blocking at RLS. Twins are a **distillation + identity** project,
not a greenfield one.

## Owner decisions (locked, 2026-08-28)

- **Role order**: estimator → assistant → subcontractor, then the rest (dev/master last —
  they diff against the others).
- **Safety ladder**: read-only → ZZ-fenced writable → production-writable; per-twin,
  owner-flipped, never by drift. Phase 1 missions run read-only.
- **Twins drive the browser** (what users touch). API/RPC twin docs are a later phase.
- **Twins are a fleet, not singletons**: each twin is its own flagged user account
  (own name, own `created_by` attribution). Multiple twin estimators may work real bids
  concurrently; the app's existing per-estimator analytics become per-twin scorecards.
- **Twins impersonate roles, not people** — no twin-only UI paths beyond the banner.

## Deliverables

| File | What it is |
|---|---|
| `docs/twins/APP_DIRECTORY.md` | Route-level directory of the whole app + "go here when…" task index + per-role nav skeletons. Shared by every brief. |
| `docs/twins/<role>.md` | One brief per role, second-person, ~3.5k-token core: identity → map (slice of the directory) → can/cannot → core loops (pointing into help guides via `/help?g=<slug>`) → vocabulary → guardrails + self-verification. |
| `docs/twins/missions/<role>.md` | Scored missions: task + the DB/UI condition proving success. |
| Twin identity (schema + client) | `users.is_digital_twin`, `twin_runs` ledger, twin banner, dev-login twin alias, Active Accounts chip + "＋ Add twin". |

## Phase 0 — App directory

Build `docs/twins/APP_DIRECTORY.md` from the router (`App.tsx`), the per-role allowed-path
lists (`src/lib/layoutRouteAccess.ts` — single source of truth since v2.2325), and
ACCESS_CONTROL's Page Access Matrix; spot-verify by dev-logging in per role. Entry shape:
route (real deep link incl. query params), two-line purpose, roles, 3–5 key actions.
The "go here when…" index is the piece a twin reads first: ~40 task-phrased triggers → URL.

## Phase T — Twin identity (build)

**T1 (one PR: migration + client):**
- `users.is_digital_twin boolean not null default false` (additive).
- `twin_runs` table (id, twin_user_id, mission text, started_at, ended_at, notes; RLS
  dev-only; BOTH read-only blocks — house rule).
- Chrome banner "🤖 DIGITAL TWIN — <name>" whenever the signed-in user is flagged
  (theme tokens; humans and the twin itself can always tell).
- Active Accounts: twin chip on flagged rows.
- Deploy order: client first (reads the column defensively), `supabase db push` after merge.

**T2:**
- Dev-login twin alias: `/dev-login?as=twin:<role>` (first twin of that role) and
  `as=twin:<role>:<n>` (explicit instance); optional `&run=<label>` writes a `twin_runs`
  row on session start. Email convention `twin-<role>-<n>@…`.
- "＋ Add twin" (dev-only, Active Accounts) riding the `create-user` edge function.
- Pooled allocation (`twin:<role>:any` claims a free instance via `twin_runs`) waits until
  concurrent fleets are real.

**T3 (graduation ladder):** twin accounts start `read_only = true`. A write mission flips
the flag deliberately and confines itself to ZZ-prefixed records. Production-writable is an
explicit per-twin owner decision, reviewed like a junior estimator's output — attribution
(`created_by` + the banner) is what makes that review possible.

**Metrics exclusions**: add `AND NOT is_digital_twin` to human-metric surfaces as twins
actually touch them (precedent: `hide_dev_tally_transactions`'s `role <> 'dev'` predicate).
Not blanket-applied — twin activity IS the signal on twin scorecards.

## Phase 1 — Estimator pilot

Hand-write `docs/twins/estimator.md` to the budget. Then run it for real: fresh agent +
brief + directory, `/dev-login?as=twin:estimator`, three scored smoke missions (find the
stalest waiting-to-hear bid and name it; read ZZ Test's packet prices and margins; walk a
mark-sent flow on BP398 [write rung]). Every stumble is a bug in the brief — refine until
3/3, then freeze the template.

## Phase 2 — The rest of the roles

assistant → subcontractor → controller, primary, superintendent, helpers → master, dev.
Same template, same run-and-refine loop. helpers largely diffs subcontractor (route/RLS
parity per ACCESS_CONTROL); controller diffs assistant (+ financial visibility).

## Phase 3 — Mission library & harness

`docs/twins/missions/<role>.md` — each mission states its verification ("the bid's Last
Contact clock shows today", "a bids_submission_entries row exists with your created_by").
Runbook: mint twin → set read_only per rung → dev-login URL → run → score → reset ZZ state.

## Phase 4 — Upkeep

- CI check (pattern: `helpGuideContent.test.ts`) validating directory/brief structure and
  that referenced routes + `/help?g=` slugs exist.
- CLAUDE.md convention line: a PR that adds/renames a page, tab, or role-visible flow
  touches `APP_DIRECTORY.md` (same muscle as help guides shipping with features).

## Status log

- 2026-08-28 — Plan written (owner locked decisions in-session). Phase 0 directory +
  estimator brief drafted alongside this plan; Phase T not yet built.
