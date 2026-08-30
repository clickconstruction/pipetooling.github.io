# Estimator twin pipeline: master build plan

---
file: docs/ESTIMATOR_TWIN_PIPELINE_PLAN.md
type: Engineering / Program plan
purpose: The umbrella plan for the plans-to-proposal estimator-twin pipeline — every build across PipeTooling, CountTooling, twin-mcp, and the agent harness, sequenced into waves that each end in a live test gate. Sub-plan for the RFI loop lives in RFI_LOOP_PLAN.md. Owner-facing narrative in the "Estimator Twin Pipeline" artifact (2026-08-28).
audience: Developers, AI Agents
last_updated: 2026-08-30
sections:
  - The thesis
  - The pipeline being built
  - Owner decisions (locked)
  - Defaults adopted (open to override)
  - Wave 0 — The walking-skeleton test bid
  - Wave 1 — Read the plans
  - Wave 2 — RFI spine + agent reads
  - Wave 3 — The takeoff leg
  - Wave 4 — Close the chain
  - Wave 5 — Fleet polish
  - The learning loop
  - Definition of stable
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
- **Scale calibration standard (owner rule, 2026-08-30): doorways are the ruler.** Stated
  scales lie on reduced prints and can change per page; door openings are always 3 feet
  and every sheet has several — measure 2–4 per traced page, median wins, >10% outliers
  get remeasured (kernel `calibrateFromDoors`; procedure in `docs/twins/PLACEMENT.md`).
  Dimension strings demote to the once-per-set cross-check.

## Wave 0 — The walking-skeleton test bid (no builds; run it first)

Before building anything, **run the entire chain once on LIVSTE with what exists today**, the
operator hand-carrying every gap a future tool will fill:

1. STG-0: human opens/confirms the bid, assigns the twin as estimator (assignment = grant).
2. STG-1: operator files the set in Drive by hand; links stamped on the bid.
3. STG-2: operator produces a **mini-substrate by hand** (the P001/P002 schedules typed into
   the schema shape, scope flags, one reconciliation pass) — this doubles as the schema v0
   fixture and the extractor's target output.
4. STG-3–gate: reuse the existing human CT takeoff for the set (or a human draws it); the
   review gate is walked for real.
5. STG-5–6: the twin, in-app at rung 2, imports counts, applies the takeoff book, drafts
   labor, Workbench pricing, and the letter — unsent.
6. Owner reviews at the gate exactly as they would for real.

**Test gate 0 (the point of the whole exercise):** the chain has been walked end to end
*before any tool exists*, producing **stumble list #0** — where the operator had to improvise,
where a stage boundary was wrong, where the twin got stuck in-app, what the owner needed at
the gate and didn't have. That list re-prioritizes Waves 1–4 while they are still cheap to
change; the mini-substrate becomes Wave 1's ground truth. Cost: operator hours only, zero
code, zero prod risk beyond one more ZZ-convention draft on a real bid.

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

## The learning loop

The plan's product is not the tools — it's a **stable environment agents can pass work
through**, and that is reached by iteration, not by finishing the wave tables. Every test gate
runs the same loop, which already has a proven track record (M1's stumble list → the v2.2430
lens fix; M3's fence probe → the v2.2454/v2.2461/v2.2466 silent-no-op family):

1. **Results row** — dated entry in the missions results table (`docs/twins/missions/`),
   scored by a human who never saw the verification section.
2. **Stumble triage** — every stumble is claimed by exactly one of: a fix PR (app bug),
   a brief/docs edit (the agent was mis-instructed), a plan amendment (the process was wrong),
   or a recorded won't-fix with reason. Untriaged stumbles are the definition of un-learned.
3. **Briefs regenerated + `twin-mcp` redeployed** whenever step 2 touched `docs/twins/` —
   otherwise the next run learns nothing.
4. **Status log entry here** — what the gate found, what changed because of it.
5. **Re-run** the failed portion before declaring the gate passed.

## Definition of stable

The exit criteria — when these hold, the environment is stable and Wave 5 (fleet) is earned:

- An agent takes an assigned bid from STG-0 to a drafted, unsent proposal with **human touches
  only at the two gates and in answering its questions** — no operator improvisation.
- **Kill/resume is clean**: a run killed at any stage resumes from `get_work_state` + the
  audit ledger alone, with no duplicated writes (M3's interrupted run proved resume-from-app
  works; the standard makes it a requirement, and every mission includes a deliberate
  mid-run kill).
- **Every refusal is loud**: no write path fails silently (the v2.2454/2461/2466 standard,
  held for all new surfaces).
- The bar is met on **two consecutive real bids** with different plan sets — one bid could be
  luck; two different sets is a process.

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
- **Idempotency on every agent write path**: re-running a stage must never duplicate — the
  takeoff import upserts (or refuses a re-import with a reason), the counts paste already
  merges duplicate rows, RFI drafts dedupe on (bid, question) — because a resumed agent WILL
  re-run its last step. This is a review checklist item for every pipeline PR, not a wave.

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
- 2026-08-28 (final pass) — Audited against the program's two goals (fast first test bid;
  learning loop toward a stable agent environment). Three gaps closed: **Wave 0** added (the
  walking-skeleton test bid — the full chain hand-carried on LIVSTE before any tool is built,
  producing stumble list #0 and the schema-v0 fixture); **The learning loop** formalized
  (results row → total stumble triage → briefs regen → re-run, with the M1/M3 precedents);
  **Definition of stable** added (gates-only human touch, clean kill/resume, loud refusals,
  two consecutive real bids on different sets) plus an idempotency rule for every agent write
  path. Wave 0 is now the recommended immediate start, ahead of Wave 1.
- 2026-08-29 — Wave 0/1 execution: b403 "ZZ Twin LIVSTE" opened + twin-assigned (STG-0 ✓);
  substrate schema v0 merged (SUBSTRATE.md + proven crop-pass parameters); LIVSTE substrate
  hand-built through v0.4 (full fixture schedule via 600 DPI crop pass, plan scales, P001
  notes incl. animal-gas/renovation-sprinkler/general — quantities pending plan counts).
  **Default overridden**: substrate home is the `bids_plan_substrates` jsonb table
  (migration 20260829021122), not a storage bucket — simpler, queryable in-app,
  fence-covered via bid_id. v2.2477 ships the table + twin-mcp `get_assignments` /
  `get_plan_brief` / `get_work_state` + estimator-brief §8 (Wave 1.4, 1.5, 2.3, 2.4).
  Wave 1 remaining: extractor skill automation (1.2) + quality gate review (1.3 — the
  hand-built substrate stands in as ground truth); calibration still open (no dimension
  strings found yet; letter-print discovery makes it mandatory).
- 2026-08-29 (build day 1 close) — v2.2477 deployed end to end: migration pushed,
  twin-mcp v7 live, LIVSTE substrate v0.4 attached to b403 and served; all three agent
  reads verified against prod (assignment fence refuses b396). Deploy stumble worth
  remembering: the CLI's bundler regex-scans `import(` inside generated briefs.ts string
  literals — the harness doc's operator snippet was replaced with the fleet-console
  instruction (PR #2189). Wave 2: **2.1 SHIPPED** (v2.2480 bids_rfis — see
  RFI_LOOP_PLAN status), **2.2 SHIPPED** (CT rfi-flags + PT paste), **2.3/2.4 SHIPPED**
  (in v2.2477). Wave 2 test gate PASSED: live RFI walk on b403 with substrate-born
  questions; twin draft-only refused loudly, ledger stamps complete. Next: Wave 1.2
  extractor automation (crop-pass recipe proven by hand), Wave 3 (takeoff leg), R3/R5.
- 2026-08-29 (build day 2 close) — Everything buildable without external unblocks is BUILT,
  deployed, and live-probed. Shipped: v2.2483 (conversation layer; twin-mcp v8),
  v2.2484 (no-send guard as trigger PHYSICS — live probe returned "digital twins draft
  only: sending and outcomes are human acts" — + R5 chip + scopeSheet kernel), the
  extractor kit (scripts/substrate-extractor + docs/twins/EXTRACTOR.md, PR #2197 —
  briefs.ts conflict resolved by regeneration per house rule), and the CT side of Wave 3:
  `takeoff-eval.js` kernel (+node tests) and the deployed `import-takeoff` edge function
  (twin-only, own-project, idempotent-by-name, canvas-only; contract TAKEOFF_IMPORT.md).
  get_work_state now carries middle coverage, RFI statuses, open questions, and the latest
  heartbeat. **Blocked externally, needs the owner**: 4.4 drive-intake (Google service
  account); CT DB-side items 3.5/3.6 (per-twin CT credentials, changes-requested status —
  CT migrations apply via the Supabase MCP, unauthenticated in build sessions); Wave-0
  human legs (Drive filing, review-gate walk). **Remaining engineering**: 3.4 placement
  engine v0 + its 3.1 fleet calibration run, then missions M4/M5. The environment now
  satisfies most of the Definition of stable's machinery: queue, brief, resume, questions,
  heartbeats, loud refusals at every fence.
- 2026-08-29 (Wave 4.4 CLOSED) — **drive-intake is live** (v2.2486 + the quota fix): Google
  project `pipetooling-drive`, service account `drive-intake@pipetooling-drive.iam.gserviceaccount.com`,
  Drive API enabled, org-policy `iam.disableServiceAccountKeyCreation` overridden to
  Not-enforced for that project (Robert self-granted Organization Policy Administrator via
  the console's Fix-access flow), key stored at `~/pipetooling-secrets/drive-intake-key.json`
  (600), both secrets set, jobs folder shared with the SA. **Live-verified**: the twin called
  `file_plans` on b403 → job folder created in the shared Drive, `drive_link` stamped on the
  bid, `[pipeline STG-1]` audit note written; a second call proved idempotency (folder
  "reused"). **Finding — the SA quota wall**: Google refuses file BYTES to service accounts
  ("Service Accounts do not have storage quota"); folders/metadata are fine. The upload leg
  now degrades gracefully (folder + stamp + honest `upload_note`) and gained optional
  `DRIVE_IMPERSONATE_USER` domain-wide delegation; a Shared Drive is the alternative. Both
  documented in `docs/DRIVE_INTAKE_SETUP.md`. NOTE: a Google password was pasted into chat
  during this work — it was never used (passwords are not a credential I will handle, and
  Google blocks password auth for APIs regardless); **that password should be rotated.**
- 2026-08-30 — **The SA quota wall is CLOSED: upload leg live via Shared Drive.** Owner
  created Shared Drive "PipeTooling Jobs" as bids@douglasmining.com and added the SA;
  everything else ran robotically through a temporary dev-gated `drive-admin-setup` edge
  function (deleted after use — the SA key never left Google/Supabase): drive discovered
  via `drives.list`, Jobs folder created, byte-upload probe PASSED, `DRIVE_JOBS_FOLDER_ID`
  flipped, `DRIVE_IMPERSONATE_USER` unset (delegation never granted; set-but-ungranted
  breaks uploads at token exchange), `drive-intake` redeployed. End-to-end verified on
  BP399 (folder + real PDF upload + both stamps + audit note) and b403 re-filed into the
  Shared Drive (drive_link re-pointed via the Edit Bid form). Found live: SAs cannot
  CREATE Shared Drives (`userCannotCreateTeamDrives`) — human creates + shares once, robot
  does the rest. A second Google password was pasted into chat this session (bids@) —
  refused per doctrine; **rotate it**. STG-1 is now fully robot-operable including plan
  PDFs (via `plans_url`); residue: BP399 carries a dummy test PDF, quota-probe.txt sits in
  the Jobs folder, and the old My Drive jobs folder + its LiveWell/LIVSTE folders are
  orphaned and deletable.
- 2026-08-30 (robot-ready CountTooling train, v2.2503) — **Waves 3.5 and 3.6 CLOSED**;
  the STG-3 seam is robot-operable end to end except the placement engine itself.
  Owner directive: "build the tools within CountTooling to make the upload and drawing
  of lines by other robots seamless before M5." Shipped + live-probed same day:
  **CT-1** plan-fetch (PT) + import-takeoff `pdf_url` (CT) — the twin's project arrives
  WITH the 55-page/36MB LIVSTE set under its marks in ONE call (E2E via a real twin
  token: mint → import → verify; re-import replaced, 1 storage object); **CT-2**
  review `changes` + `review_note` (twin `ready` ok, twin `changes` refused loudly);
  **CT-3** `get_work_state.ct_takeoff` over the bridge; **CT-4** per-twin CT
  credentials (sync-on-mint, independent revocation); **CT-5** `get_ct_guide` — the
  CountTooling completing-a-bid brief, served by twin-mcp (owner's ask, made structural).
  Also live: the Robot Board (v2.2500) keeps twin bids off the human board.
  Remaining before the robot army estimates alone: **3.4 placement engine v0** +
  its 3.1 calibration run, extractor automation (1.2), then M4/M5. Residue: CT project
  "ZZ Twin LIVSTE takeoff" sits in the review lane as `ready` (a probe — a reviewer
  can exercise Request changes on it).
- 2026-08-30 (placement train, v2.2504) — **Waves 3.4 (engine v0), 3.1 (calibration),
  and 1.2 (extractor automation) BUILT; every wave-table engineering item is now done.**
  Placement engine v0: coordinate kernel `src/lib/takeoffPlacement.ts` (tested — base
  frame, rotated-crop and overview hops, assembly, import-mirror validation,
  counts-vs-schedule self-check), assembler CLI + pagesize, and PLACEMENT.md (the
  vision model IS the engine; this is its manual). Proven on the REAL set: LIVSTE
  fetched via plan-fetch with the twin token, P201 fixture tags crisp at 300 DPI, a
  real placement round-tripped, self-check caught a planted miss. Calibration:
  205 human takeoffs → CALIBRATION.md (marks p50 = 51, lines p50 = 57; **finding:
  humans count valves/cleanouts/hose bibbs the schedule never lists — M4 scores
  per-tag over schedule tags; the gap list is the v1 roster**). Extractor automation:
  sweep.sh + tiles.sh. **M4 mission written** (twin draws the LIVSTE counters,
  Wendi's takeoff is the reference, deliberate mid-walk kill); briefs carry M1–M5,
  twin-mcp redeployed. What remains is RUNNING: M4, then M5, then the review-gate
  walks — operator/owner acts, not builds.
