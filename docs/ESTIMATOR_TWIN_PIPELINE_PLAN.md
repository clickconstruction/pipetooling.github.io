# Estimator twin pipeline: master build plan

---
file: docs/ESTIMATOR_TWIN_PIPELINE_PLAN.md
type: Engineering / Program plan
purpose: The umbrella plan for the plans-to-proposal estimator-twin pipeline — every build across PipeTooling, CountTooling, twin-mcp, and the agent harness, sequenced into waves that each end in a live test gate. Sub-plan for the RFI loop lives in RFI_LOOP_PLAN.md. Owner-facing narrative in the "Estimator Twin Pipeline" artifact (2026-08-28).
audience: Developers, AI Agents
last_updated: 2026-08-28
sections:
  - The thesis
  - The pipeline being built
  - Owner decisions (locked)
  - Defaults adopted (open to override)
  - Wave 1 — Read the plans
  - Wave 2 — RFI spine + agent reads
  - Wave 3 — The takeoff leg
  - Wave 4 — Close the chain
  - Wave 5 — Fleet polish
  - Cross-cutting rules & risks
  - Status log
---

## The thesis

Take a raw bid (a PlanHub listing + a 55-sheet plan set) to a drafted, auditable proposal with
an agent doing the legs and humans holding two gates: the CountTooling takeoff review (exists)
and the owner's price-and-send decision (never delegated). The program is sequenced so **every
wave ends with a live test on a real bid** (LIVSTE — the LiveWell Animal Hospital set — is the
standing test article: plans in hand, bid window open, human takeoff available to score
against), and so every tool built also serves human estimators — that's the test of whether a
piece is real.

The agent-facing design rule: **a stateless agent must reconstruct "where was I, what's next"
entirely from the app** — composite reads (`get_work_state`), statuses (review, RFI, questions),
and the bid-note audit ledger are the agent's memory. No business-logic tools in the MCP; work
happens in the app or through validated, human-reviewable imports.

## The pipeline being built

STG-0 open the bid (work order; **assignment is the mission trigger** — the fence's
assignment-is-the-grant makes Estimator=twin simultaneously the permission and the job) →
STG-1 file in Drive → STG-2 substrate + scope & risk read → STG-3 takeoff in CT (+ RFI drafts)
→ **GATE: takeoff review** → STG-5 counts into PT → STG-6 scope sheet, letter & pricing →
**GATE: owner prices & sends** → STG-8 log the send, enter the chase (existing follow-up
machinery — M1's proven ground). Loops: changes-requested re-enters STG-3; an addendum
re-enters STG-1–2 with a sheet diff; an RFI answer re-enters wherever it blocked. Every stage
stamps a method-less bid note (v2.2413: notes never move the chase clock) — the ledger is the
run's flight recorder.

## Owner decisions (locked, 2026-08-28)

- Bid opens the chain (STG-0); human-opened + twin-assigned is the default path.
- Two human gates, never delegated: takeoff review; price-and-send.
- Twin drafts only — no final pricing, no sending; to be made structural (Wave 4).
  **What "drafting" includes (clarified 2026-08-28):** working the full Takeoffs → Labor →
  Pricing chain on its own bid — applying takeoff books, mapping assemblies, filling
  **missing part prices on the bid's frozen book copy** (v2.2444: bid-scoped, so fenced and
  reviewable), building the labor estimate, and proposing per-section sale prices in the
  Workbench. The line the gate owns is the *final* number and the send. The **master price
  book is never twin-writable** — it isn't a bid child; book corrections are suggestions for
  a human, same doctrine as loss-reason suggestions.
- RFI loop: per-RFI GC pick (default all bidding GCs); estimator+ approve/send; twins
  draft-only structurally; RFIs non-blocking (open RFIs must surface as assumptions/exclusions
  at the letter). Full detail: `docs/RFI_LOOP_PLAN.md`.
- PlanHub stays manual (download, Q&A, submission).

## Defaults adopted (open to override)

- **Substrate home**: versioned JSON in a PT Supabase storage bucket keyed to the bid, plus a
  copy in the Drive job folder; served via twin-mcp `get_plan_brief`.
- **Placement engine v0 is counters-first** (fixtures from the schedule tags); line runs come
  after counters prove out — a counters-only takeoff is still a large human time-saver, and
  fixture placement is the higher-confidence vision task.
- **M4 scorer**: the human estimator whose takeoff exists for the same set (Wendi for LIVSTE).

## Wave 1 — Read the plans (harness-heavy, zero prod risk)

| # | Build | Where | Size |
|---|---|---|---|
| 1.1 | **Substrate schema v0** — per-sheet records: index/classification, schedules-as-tables, notes with scope/exclusion flags, scale + calibration candidate (dimension string + endpoints), reconciliation (schedule vs plan vs riser per tag), confidence + crop provenance per fact | Spec (this repo, `docs/twins/`) | S |
| 1.2 | **Extractor skill** — rasterize → classify 55 sheets → extract per schema; rolled-up plan brief ends with the **scope & risk read** (trade fit, alternates invited, risk flags, go/no-go recommendation — recommendation only, sets nothing) | Harness | L |
| 1.3 | **Run on LIVSTE + quality report** — hand-score every extracted fact against the sheets | Harness | M |
| 1.4 | **`get_plan_brief`** MCP tool + storage bucket | PT edge fn + migration (bucket) | S |
| 1.5 | **Pipeline brief** — `docs/twins/` estimator brief gains the plans-to-proposal section (stages, audit-stamp rule, non-blocking-RFI rule, no-price/no-send line); `APP_DIRECTORY` rows for new surfaces; regenerate briefs + redeploy twin-mcp | Docs + deploy | S |

**Test gate 1:** the LIVSTE substrate quality report, reviewed by the owner. Its error profile
decides how fast Wave 3 trusts vision with mark placement.

## Wave 2 — RFI spine + agent reads (parallel with Wave 1 tail)

| # | Build | Where | Size |
|---|---|---|---|
| 2.1 | **RFI_LOOP_PLAN R1** — `bids_rfis` migration + RFI tab queue (twins draft-only via RLS; audit stamps as bid notes) | PT | M |
| 2.2 | **RFI_LOOP_PLAN R2** — CT `RFI:` note flags + Copy RFI flags; PT paste-import (the counts-seam pattern) | CT + PT | S+S |
| 2.3 | **`get_assignments`** — bids where estimator = the calling twin, with status | twin-mcp | S |
| 2.4 | **`get_work_state(bid)`** — one composite read: links present, substrate attached, takeoff/review status, counts imported, RFIs + statuses, open questions, letter/pricing state, audit ledger. The agent's resume; later the human agent-dashboard panel's data source | twin-mcp (+ PT view/RPC) | M |

**Test gate 2:** RFI_LOOP_PLAN R6 — a live RFI walk on the LIVSTE bid using real ambiguities
from the Wave-1 reconciliation; `get_work_state` must tell the whole story in one call.

## Wave 3 — The takeoff leg (the hard wave)

| # | Build | Where | Size |
|---|---|---|---|
| 3.1 | **Eval harness** — diff any CT project against a reference: counts per tag, feet per line type. Run against the ~100 finished human takeoffs to calibrate expectations BEFORE any engine exists | Harness (reads CT project JSON) | M |
| 3.2 | **`takeoff.json` format** — counters, polylines, line types, per-page scale in the RECONSTITUTE coordinate contract; rasterization recipe (page → crop → PDF-point mapping) documented in the harness kit so any vendor computes coordinates identically | Spec | S |
| 3.3 | **CT takeoff import** — server-validated: writes a normal twin-owned project, sets per-page scale programmatically (set-view-scale pattern), rejects with reasons; **agent-placed provenance** flag badged in review UI | CT (edge fn + small client) | M |
| 3.4 | **Placement engine v0 (counters-first)** — substrate tags → coordinates; emits takeoff.json; scored by 3.1 | Harness | L |
| 3.5 | **CT safety parity** — verify ownership confines twin writes; per-twin CT credentials (today CT trusts the PT-held secret) | CT | M |
| 3.6 | **Review loop closure** — changes-requested + note in CT review flow; `get_review_status`; `twin_questions` + `ask_question`/`get_answers` + fleet-console answer box with Promote-to-RFI (RFI_LOOP_PLAN R3) | CT + PT + twin-mcp | M |

**Test gate 3: Mission M4** — twin does the LIVSTE takeoff (counters), review lane, Wendi
scores against her own; eval-harness number recorded in the missions results table.

## Wave 4 — Close the chain

| # | Build | Where | Size |
|---|---|---|---|
| 4.1 | **Counts to PT** — drive the existing Copy-to-/Tooling → Counts paste in-app; optional `get_takeoff_export`; variance-vs-schedule audit stamp | Existing + S | S |
| 4.2 | **Scope sheet + coverage report** — exclusion/assumption suggestion kernel from substrate flags (+ open RFIs; suggested, never auto-applied); pricing coverage read (Workbench assignment coverage, $/SF vs pricing history) | PT kernels + harness | M |
| 4.3 | **No-send fence** — structural RLS block on twin writes to `bid_date_sent`/send surfaces (replaces mission-text policy) | PT migration | S |
| 4.4 | **`drive-intake`** — service-account edge fn: create job folder, upload set + substrate, return links; `file_plans` MCP wrapper; links stamp onto the STG-0 bid | PT edge fn | M |
| 4.5 | **Heartbeat on `twin_runs`** — current bid/stage/working-blocked-done; formalize the per-stage audit-stamp convention in the pipeline brief | PT + docs | S |
| 4.6 | **Materials → Labor → draft-pricing enablement** — the middle of the bid workflow, which exists today as human tools on bid-child tables (twin-drivable at rung 2 with no schema work): (a) pipeline-brief section documenting the three-tab workflow with **takeoff books as the counts→assemblies→materials lever** (`applyTakeoffBookTemplates` first, gap-fill second), the exact-vs-rough materials-model choice, the frozen-book-copy price rule, and the Labor tab's sections/direct-costs/per-diem shape; (b) `get_work_state` gains materials/labor/pricing coverage (mappings present? unpriced parts? labor rows? Workbench assignment coverage) so a resumed agent knows where the middle stands; (c) APP_DIRECTORY rows for all three tabs | Docs + PT reads | M |

**Test gate 4: Mission M5** — approved takeoff → counts imported → takeoff book applied and
materials mapped → labor built → per-section draft prices with a coverage report → letter
drafted, bid **unsent**; owner reviews from the scope sheet + coverage report alone and
compares the draft pricing to what they would have priced. Then the full chain has run once,
end to end.

## Wave 5 — Fleet polish (as learnings dictate)

Addenda diff in the extractor (re-entry loop); ct-bridge RFI auto-pull (RFI_LOOP_PLAN R4);
letter assumptions chip (R5); agent dashboard surface fed by `get_work_state`; metrics hygiene
(`AND NOT is_digital_twin` on company stats); pooled seats if the fleet grows; line runs in the
placement engine.

## Cross-cutting rules & risks

- **Every wave ends on LIVSTE.** No wave is done because its PRs merged; it's done when the
  live test gate passed and its stumbles are recorded (missions-results discipline — M1–M3
  each caught real bugs).
- **Migrations**: house rules apply in full (lock_timeout, both read-only appliers,
  `apply_digital_twin_write_blocks()` on bid-family DDL, fence spot-probe via
  `?as=twin:estimator:1` after every push). CT migrations apply via Supabase MCP (its
  `db push` refuses) — opposite of PT.
- **Briefs are generated**: any `docs/twins/` edit → `node scripts/build-twin-mcp-briefs.mjs`
  + redeploy `twin-mcp`, or agents keep reading stale process.
- **The two hard items are 1.2 and 3.4** (extractor, placement engine — both harness-side AI
  work). Everything app-side is deliberately small; if either hard item under-delivers, the
  app tools still serve humans (persisted RFIs, plan brief panel, drive-intake, review
  changes-requested) — the program degrades gracefully instead of stranding half-built
  surfaces.
- **Parallel sessions**: one wave item = one session card + one PR; claim versions per house
  rules; the CT repo follows CT conventions (vanilla JS feature files + Playwright specs).

## Status log

- 2026-08-28 — Plan written. Fleet state: twin-estimator-1 at rung 2, M1–M3 all PASS, write
  fence live-probed, RFI_LOOP_PLAN merged same day. Nothing in this plan built yet; Wave 1
  items 1.1–1.3 are the recommended immediate start.
- 2026-08-28 (later) — Owner walked the seven-step chain (plans → reference docs → counts →
  materials+prices → labor → section pricing → letter) and the middle steps were
  under-planned: added Wave 4 item 4.6 (materials/labor/draft-pricing enablement — takeoff
  books as the lever, frozen-book-copy price rule, `get_work_state` middle-coverage), widened
  M5's test gate to score the full middle, and clarified the drafting-vs-final-pricing line
  in Owner decisions.
