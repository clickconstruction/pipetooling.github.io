# Digital twins & MCP — operator handoff

---
file: HANDOFF.md
type: Handoff / State of the program
purpose: Everything a new operator needs to take over the digital-twins program — what is live, the fleet roadmap and its gates, how to run it day-to-day, where the secrets live, and the prioritized open threads
audience: The incoming twins operator (a dev), AI agents
last_updated: 2026-09-05
key_sections:
  - name: "What is live today"
  - name: "The fleet roadmap & gates"
  - name: "Where the program stands (2026-09-01)"
  - name: "Day-to-day operation"
  - name: "Secrets & access"
  - name: "Open threads, prioritized"
  - name: "Gotchas that will bite"
---

Read `DIGITAL_TWINS_PLAN.md` first for the locked owner decisions (estimator-only,
one-directional fence, assignment-is-the-grant) and `ESTIMATOR_TWIN_PIPELINE_PLAN.md`
for the plans-to-proposal build (every wave-table engineering item is BUILT as of
2026-08-30); this doc is the *current state* on top of both.

## What is live today (all in prod)

- **Twin identity & fence**: `users.is_digital_twin` (PT) / `profiles.is_digital_twin`
  (CT); 🤖 banner; RESTRICTIVE write-fence policies (a twin writes only bids it created
  or is assigned — assignment IS the grant), the no-send trigger ("digital twins draft
  only: sending and outcomes are human acts"), per-twin revocable credentials
  (`twin_credentials`), `?as=twin:<role>[:n]` dev-login alias.
- **twin-mcp** (`…/functions/v1/twin-mcp`) — ~22 tools now, in four families:
  *session/docs* (`mint_session` — PT or CT, `get_brief`, `get_directory`,
  `get_harness_guide`, `get_ct_guide`, `get_placement_guide`, `get_mission`,
  `submit_report`); *work-state reads* (`get_assignments`, `get_work_state`,
  `get_plan_brief`, `get_answers`); *pipeline writes inside the fence* (`file_plans`,
  `add_bid_note`, `ask_question`, `heartbeat`, `ct_finish_takeoff`); *confidence runs*
  (`open_backtest`, `get_shadow_queue`, `open_shadow`, `lock_shadow`, `score_shadows`).
  Blindness is structural: `open_backtest`/`open_shadow` copy logistics only — counts,
  pricing, `bid_value`, `outcome` are never selected. `docs/EDGE_FUNCTIONS.md` → twin-mcp
  is the authoritative verb reference.
- **The Bids robot lens group** (🤖, between Bid Board and Followup):
  **Robot Board** (v2.2500, staff — twin bids live here, off the human board),
  **Audits** (v2.2516–19, staff — the audit cockpit: name-matched diff, one-tap
  verdicts, sealed-shadow hold), **Shadows** (v2.2544, staff — sealed-envelope
  stepper per run), **Queue** (v2.2542, dev — requested/ready robot-able bids +
  backtest candidates by axis, v2.2594), **Scoreboard** (v2.2560, dev — per-axis
  Gate-B cards, pipeline pills, unified run ledger). Dashboard: the Needs-you card
  carries a "robot bids waiting on your audit" item for dev+estimator (v2.2573).
- **The audit loop** (`FEEDBACK_LOOP.md`): twin opens an audit at pipeline end →
  human judges each difference with verdict tags (`[verdict:teach|record|ok]`) →
  twin digests every note into doctrine/books/code/bid_only/**reference_quality**
  (the robots file repair tasks on OUR bad records) and posts "Learned: …" receipts.
- **Reference grading** (v2.2545, `referenceGrade.ts`): A/B/C/D/X by field presence
  (blind-safe); quality flags (round value, weak loss, uncategorized, stale) computed
  at unseal; only clean A/B references count in gate denominators.
- **Census/placement toolkit** (harness-side): `scripts/twin-census/` T1 vector census +
  T2 path census + T3 template matcher + T4 auto-scorecard kernel; `takeoffPlacement.ts`
  coordinate kernel; PLACEMENT.md is the vision-model manual and the doctrine ledger
  (BT-17..19 slate banked 2026-09-01).
- **Drive intake**: `file_plans` → Shared Drive "PipeTooling Jobs" folder + plan PDF
  upload + bid stamps (see `DRIVE_INTAKE_SETUP.md`).
- **Fleet console**: Settings → System → Digital twins (dev-only) — mint, tokens,
  rungs, CT-seat status, runs ledger.

## The fleet roadmap & gates

The trust ladder for letting robots estimate for real (previously recorded only in
session artifacts; this is its doc home):

- **Gate A — backtests** (MET 2026-08-31): re-estimate decided historical bids blind;
  three consecutive within ±5% on distinct sets (BT-12 −2.6% / BT-13 +4.6% /
  BT-14 +3.5%). Backtest slates keep running as doctrine reps (BT-6..BT-19 so far;
  structured scores in `twin_run_scores`, v2.2560).
- **Phase 1 — Shadow (current)**: live bids become the test stream. A shadow opens
  before the human number exists, locks a sealed blind total, and auto-scores when
  the reference sends (`twin_shadow_runs`, v2.2539). The seal is API-enforced —
  staff cannot read a sealed total (anchoring risk).
- **Gate B — per axis**: 5 consecutive scored runs within ±8% on a project-type axis
  (kitchen/occupied, small TI, institutional, …). Kernel `confidenceBoard.ts`;
  denominators take only clean grade-A/B references.
- **After Gate B** (per axis, owner decision): the twin's number graduates from
  practice to a draft the owner prices from — the two human gates (takeoff review;
  price-and-send) never delegate.

## Where the program stands (2026-09-04)

- **The audit loop closed for the first time.** Wendi finished seven audits on
  2026-09-04 (b405–b409, b411, b418): 16 answers, 6 row notes, 4 one-tap teach
  verdicts. Every lesson is banked in `PLACEMENT.md` (scope-call standards, "Ask like
  a junior estimator", pricing model, footage, reference protocol); the receipts and
  the interceptor book re-mirrors landed the same evening as the twin (`FEEDBACK_LOOP.md`
  → Current state). Three of her answers were "idk" — to questions written in twin
  vocabulary.
- **Seven audits were unpriceable**: the BT-16..19 slate (b422, b424–b429) opened
  audits with no PipeTooling count rows, so the tab showed draft $0 / −100% and drew
  a "we will not do this for free" note. STG-5 is now a pre-flight gate
  (`FEEDBACK_LOOP.md` step 0); those seven still owe their paste.
- **A shadow was audited unsealed**: b418 and b419 were opened before v2.2543 stamped
  `twin_source_bid_id`, so the tab could not hold them; Wendi audited b418 (live, unsent
  Take 5 Brownsville) in the open. The six unstamped bids were paired by hand the
  same day (SQL in the v2.2795 fragment); b418's scorecard is auditor-exposed.

### As of 2026-09-01

- Fleet: `twin-estimator-1` at **rung 2** (fenced writer), CT seat linked. Missions
  M1–M3 PASS, M4/M6 series through M6-v8 + M5/M5b run (see `missions/estimator.md`
  results table — the M-series found real bugs every run).
- **Phase 1 · Shadow, Gate B 0/8 axes.** Scoreboard pills: **24 audits pending (the
  bottleneck)**, 4 shadows awaiting score, 8 scored runs. Axis states: kitchen/occupied,
  mid-size TI, small TI at 1/5; institutional BLOCKED (district wage-tier multiplier —
  question on the b422 audit); proto/auto-service BLOCKED (untraced-footage regression);
  bank-branch, franchise-oil-change, vet-clinic awaiting score.
- **Backtest supply** (v2.2594 Queue section): 108 gate-eligible A/B references exist
  (54 more flagged), **all unclassified** — assigning `bids.backtest_axis` is how they
  surface under the axes that need them. (Reference survey 2026-08-31: 132 Tier-A
  of 344 decided bids.)
- Pending owner ruling: question 836b6c22 (small-TI residual + Take 5 proto package —
  recorded, deliberately not applied).

## Day-to-day operation

Everything routine happens in **Settings → System → Digital twins** (dev role): mint a
twin, issue a token (shown once), hand token + endpoints + `TWIN_HARNESS.md` to whoever
runs the agent. Revoke a token to cut one partner off; the runs ledger shows sign-ins,
reports, and heartbeats.

The working loops, in the order a day usually runs:
1. **Audits first** — the Dashboard card / Audits tab; verdicts + answers unblock
   everything downstream. Finished audits get digested by the twin next session.
2. **Score shadows** — `score_shadows` (any twin session) whenever reference bids have
   gone out; the Scoreboard shows what moved.
3. **Feed the queue** — Queue lens: paste kickoff prompts for requested/ready live bids
   (shadows) and for backtest candidates on hungry axes; classify unclassified
   references while you're there.
4. **Missions** — "run M<N>": the agent fetches the mission via `get_mission` and files
   `submit_report`; score against `missions/estimator.md` (the MCP bundle deliberately
   excludes verification sections).

## Secrets & access

Unchanged since 2026-08-28: per-twin tokens minted in the panel are the day-to-day
path; the master `TWIN_LOGIN_SECRET` (fleet kill switch) and CT bridge secret live as
function secrets with readable copies only in the owner's main-checkout
`.env.twin.local`. CT ref `hrqxvfydmvtvwhvefmqc` (migrations via Supabase MCP); PT
`yewfzhbofbbyvkvtaatw` (migrations only via `db push` after merge — CLAUDE.md).
Google Drive service account: `DRIVE_INTAKE_SETUP.md`.

## Open threads, prioritized

0. **Round 2 — the fresh-robot re-bid of Wendi's decided bids** (kickoff:
   `docs/twins/kickoffs/2026-09-05-wendi-blind-rebid.md`): wave A = 18 references no
   robot has seen (blind), wave B = the 14 already backtested, via `open_backtest(round: 2)`
   (six of them are no longer blind — the doctrine docs quote their values; scored as
   regression, not gate). Scores land through `score_backtest`; audits open with STG-5
   pasted. Compare on the Scoreboard against the BT-6..19 rows.
1. **Paste STG-5 counts on the seven $0 audits** (b422, b424–b429) so the next audit
   pass can judge them — a real twin pipeline session (CT takeoff → Counts tab →
   book assignment); the 2026-09-04 digest itself is done.
2. **Audit throughput** — 15 pending after the pass; every blocked axis and undigested
   note waits on it. (The cockpit's one-tap verdicts exist; the backlog is human hours.)
3. **Unblock the two blocked axes** — answer the b422 wage-tier multiplier question
   (institutional); resolve the proto/auto-service site-scope question.
4. **Classify the 108 backtest candidates** (Queue lens, after the v2.2594 migration
   is pushed) so backtest slates draw from demand instead of judgment.
5. **Owner ruling on 836b6c22** (small-TI residual + Take 5 package doctrine).
6. **Wendi's LIVSTE takeoff to CT cloud** — M4/M6's reference diff has been blocked on
   it since 08-30; the review-gate walk needs it too.
7. **Standing earlier threads**: metrics hygiene (`AND NOT is_digital_twin` as twins
   touch more surfaces), pooled seats if the fleet grows, other roles (Phase 2) only
   by explicit owner decision.

## Gotchas that will bite

- **`briefs.ts` is generated.** After editing anything in `docs/twins/`, run
  `node scripts/build-twin-mcp-briefs.mjs` and redeploy `twin-mcp`, or agents keep
  reading the old docs. Missions bundle only the verbatim mission text — scorer
  sections stay out.
- **Function secrets apply on cold start** — redeploy after `supabase secrets set`.
- **Re-run the fence after bid-family DDL**: CREATE TABLE migrations in the bid family
  end with `SELECT public.apply_digital_twin_write_blocks();` plus the two read-only
  appliers. Fence spot-probe via `?as=twin:estimator:1` after every push. Known gap
  (M5, question 5170bb88): `cost_estimate_labor_rows` has no `bid_id` column, so the
  fence denies twin labor writes and the Labor tab swallows the 403 — open pipeline
  work.
- **twin_runs note formats are parsed** by `twinConsoleDisplay.ts` — change what
  twin-login/twin-mcp write and you update the kernel + tests.
- **Scoring stays outside the MCP** — never hand a twin the verification sections;
  and the shadow seal is the same doctrine for humans: a sealed robot number visible
  pre-send could anchor the estimate.
- **The blind rule is structural but also behavioral**: kickoff prompts carry bid
  number + axis only. Never paste a reference's value/outcome into a twin session
  that will run it.
