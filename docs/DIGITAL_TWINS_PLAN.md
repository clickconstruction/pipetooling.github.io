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
- **Estimator-only program first (2026-08-28)**: the fleet is restricted to the estimator
  role until trust is earned — it is the lowest-blast-radius creative role (nothing leaves
  the app without a human: letters are copy/print; no money moves; work is inherently
  reviewable and already has per-estimator analytics). Twin-login mints estimator twins
  only; other roles come later by explicit owner decision.
- **Twin work is visible, humans are never fenced**: twin bids sit on the shared board
  with the twin's name in the Estimator column; real estimators can read AND edit twin
  work (the review workflow). The write-fence is one-directional — it binds twins only.
- **Assignment is the grant**: setting a real bid's estimator to a twin admits that bid to
  the twin's write-fence; un-assigning revokes it. Giving a twin real work is one
  deliberate, visible, reversible act in the normal UI.

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

## Phase E — Cloud twins & the estimator sandbox (build)

Cloud-hosted twins sign into the DEPLOYED apps, so the mechanism is the magic-link edge
function, not the dev-only client route: harness POSTs to `twin-login` with a secret
header → gets an `action_link` → navigates a headless browser to it → signed-in session
on the production origin. No passwords stored anywhere; sessions are short-lived and
re-minted on expiry (a normal re-login, not an error). Rotating the secret is the
fleet-wide kill switch.

**E1 — `twin-login` edge functions (both apps)**, four server-side guards each:
1. Own secret (`TWIN_LOGIN_SECRET`, distinct from `DEV_LOGIN_SECRET`, rotatable alone).
2. Email must match the fleet pattern (`twin-<role>-<n>@twins.<app>.local`).
3. The account must be flagged `is_digital_twin` (PipeTooling now; CountTooling once its
   flag lands in E2) — a leaked secret can never mint a session as a real person.
4. Role must be `estimator` (the estimator-only program).
Every mint is logged (function logs from day one; the `twin_runs` ledger once E2 lands).
`dev-login` is untouched — local convenience, its secret never leaves the owner's machines.

**E2 — the write-fence + CountTooling identity**:
- PipeTooling migration: `public.is_digital_twin(uid)` helper + `apply_digital_twin_write_blocks()`
  — the training-mode applier's sibling. RESTRICTIVE per-table policies of the shape
  `NOT is_digital_twin(auth.uid()) OR <per-table allowance>`: a no-op for every real user;
  for twins, writes are allowed only on the bid family where the twin **created the bid or
  is its assigned estimator** (bids + their child tables via bid_id), plus the `/help`
  feedback channel (the bug-report inbox). Everything else is read-only for twins.
  Template/catalog data (price/labor/takeoff books without a bid_id) is never writable.
- `twin_runs` ledger table (mint + mission log; RLS dev-read, service-role write; BOTH
  read-only blocks per house rule).
- CountTooling: `is_digital_twin` flag on its users + the 🤖 banner (its collaboration
  surfaces — checkout, view links — should always show a twin as a twin).

**E3 — first cloud runs**: mint `twin-estimator-1` in both apps (read-only rung),
run the Phase 1 pilot missions from a remote harness, verify assignment-as-grant
end-to-end on a ZZ bid, and wire mission summaries + bug reports (help feedback) into the
review loop.

**The three safety rungs (DB-enforced, per twin)**:
1. **Tester** — `read_only = true` (training mode blocks every write today).
2. **Fenced estimator** — read_only off; the twin write-fence binds writes to own-created
   bids + assigned bids. ZZ naming stays as etiquette; the fence is what holds.
3. **Working estimator** — same fence; real bids enter it by assignment. Review = the
  normal board (twin-named Estimator column, per-twin win/margin analytics for free).

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
