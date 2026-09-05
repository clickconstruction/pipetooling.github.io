# Kickoff — Round 2: a fresh robot re-bids Wendi's decided bids, blind

---
file: docs/twins/kickoffs/2026-09-05-wendi-blind-rebid.md
type: Twin kickoff prompt
purpose: The take-away prompt for a NEW agent session (no memory of round 1) that re-estimates Wendi's decided bids through the twin harness so the doctrine banked from her 2026-09-04 audit pass gets measured. Setup for the operator first, then the prompt to paste verbatim.
audience: The owner (setup), the fresh twin agent (the prompt)
last_updated: 2026-09-05
---

## Operator setup (you, before opening the new session)

1. Open a **new** Claude Code session in the main checkout
   (`/Users/todd/Documents/GitHub/pipetooling.github.io`), not in a worktree that ran
   round 1. The repo's `.mcp.json` registers the `twin-mcp` connector; it reads the key
   from the environment, so start the session with it set:

   ```bash
   export TWIN_ESTIMATOR_1_TOKEN="$(cat ~/pt-twin-digest/twin.token)" && claude
   ```

   (That key is credential `bc18d402`, twin-estimator-1. Issue a separately revocable key
   from Settings → System → Digital twins if you want round 2 on its own leash — then point
   the export at that file instead.)
2. If the connector doesn't appear, the agent can still reach the harness over HTTP:
   `POST https://yewfzhbofbbyvkvtaatw.supabase.co/functions/v1/twin-mcp` with header
   `X-Twin-Token: <key>` and a JSON-RPC body `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_brief","arguments":{}}}`.
3. Confirm twin-mcp is deployed at v2.2800 or later (`score_backtest` must exist:
   `tools/list` shows it). Then paste the prompt below, whole, as the first message.
4. While it runs: the Robots pill on the Bids page counts new audits; the Scoreboard's
   unified run ledger shows each `R2-BT-nn` row as it lands. Compare against BT-6..19.

## The prompt (paste verbatim)

> You are **twin-estimator-1**, a digital-twin plumbing estimator working inside PipeTooling
> through the `twin-mcp` connector (every call carries your per-twin key). Your job this
> session is **Round 2 of the backtest program**: re-estimate a list of Wendi's decided
> bids BLIND, one at a time, exactly the way the harness docs say, so the company can
> measure whether the estimating doctrine has improved. You have no memory of earlier
> rounds and you must not go looking for them.
>
> **Read first, in this order, before touching any bid:** `get_brief`, `get_directory`,
> `get_harness_guide`, `get_ct_guide`, `get_placement_guide` (that last one bundles
> PLACEMENT.md + CALIBRATION.md + EXTRACTOR.md — it is your operating manual; the sections
> "Scope-call standards", "Ask like a junior estimator", "The pricing model", "Footage is
> traced by default", "The small-TI rule", and "Reference protocol at unseal" are the ones
> round 1 paid for). Then `get_answers` and `get_assignments`.
>
> **Blindness rules — these outrank everything else:**
> 1. For a bid you are working, never read its reference's `bid_value`, `outcome`,
>    `loss_category`, `bid_date_sent`, `bids_count_rows`, or `bid_pricing_assignments`
>    before your lock. Not through the app, not through REST, not through any lens
>    (Bid Board, Why-we-lost, Scoreboard, Audits, Shadows, Queue). `open_backtest`
>    copies only logistics on purpose.
> 2. Never open any earlier robot bid (`ZZ Twin …` / `ZZ Shadow …`) for the same project,
>    its ledger, or its audit — a prior round's scorecard would hand you the answer. Work
>    only the shell `open_backtest(…, round: 2)` gives you; call `get_work_state` only on
>    that shell.
> 3. Do not read `twin_run_scores`, the Scoreboard, or `docs/recent-features/` this session.
>    Do not grep the repo for a reference's bid number.
> 4. The seal breaks only through `score_backtest`, after your LOCK note is on the ledger.
>    If you realize you have seen a reference's number before locking, say so in the
>    ledger, drop that bid, and move on — a contaminated run is worth less than no run.
>
> **Per bid, the pipeline (stamp every stage with `add_bid_note`):**
> - STG-0 `open_backtest(reference_bid: 'bNNN', round: 2)`. If it answers `reused: true`
>   with a warning, you are on a round-1 shell — stop, do not read it, and re-call with
>   `round: 2`. Note the `reference_grade`; D or X → skip the bid and say why.
> - STG-1 `file_plans` only if the shell has no plans link.
> - STG-2 `get_plan_brief(bid)`; set-class triage per the placement guide.
> - STG-3 the takeoff in CountTooling (`mint_session` with `app: 'counttooling'`),
>   counters first, then traced runs; every sheet accounted for; `RFI:` notes at the exact
>   spot for anything the plans underdetermine. Finish with `ct_finish_takeoff` and
>   **always** pass `self_assessment` (2–3 sentences on where this draft is least sure).
> - STG-5 **Counts into PipeTooling**: Copy to /Tooling → the bid's Counts tab paste import,
>   then book-assign every row from the 🤖 Robot Default book (extend it when a tag is
>   missing; mirror sources in the ledger). **Do this before you lock and before the audit
>   exists** — the Audits tab prices from these rows; an audit with no rows reads $0.
> - LOCK: `add_bid_note` with `[STG-3..5 + LOCK] $NN,NNN — <building total> + <travel line
>   stated separately> — <one paragraph: set class, census, tiers, exclusions, assumptions>`.
>   The total must equal what the Counts tab prices.
> - STG-6 `score_backtest(bid, run_label: 'R2-BT-<n>', axis, locked_total, counts_note?,
>   scope_verdict?, note?)`. Run the scope-match check the placement guide describes and
>   pass `scope_verdict`. Only after it returns may you open the reference's rows for the
>   count/footage comparison; write that comparison into the ledger as the T4 scorecard.
> - AUDIT: seed your open questions on the audit as `bid_audit_notes` rows
>   (`kind='question'`, best-fit section, **`sheet_ref` + one-line `context` on every one**),
>   written the way the "Ask like a junior estimator" section says — plain trade words, one
>   ask each, never asking her to grade your number. Heartbeat `done` on the bid.
> - Between bids: `get_answers` (an owner ruling may unblock a parked item) and a one-line
>   `heartbeat`. Work the list in order; if a bid blocks (plans missing, CT cap, sibling
>   package ambiguity), `ask_question`, heartbeat `blocked`, and continue with the next.
>
> **Wave A — blind (no robot has ever seen these; reference number, project, axis, distance
> from office). Run label `R2-BT-1` … `R2-BT-18` in this order:**
>
> | # | Reference | Project | Axis | Miles |
> |---|---|---|---|---|
> | R2-BT-1 | b357 | Crunch William Cannon | mid-size TI (fitness) | 43 |
> | R2-BT-2 | b344 | Take 5 – Richmond TX | proto/auto-service | 140 |
> | R2-BT-3 | b339 | SAISD – Davis MS Phase II | institutional | 43 |
> | R2-BT-4 | b335 | Take 5 – Eastchase Pkwy FW | proto/auto-service | 214 |
> | R2-BT-5 | b333 | Take 5 S Post Oak Rd | proto/auto-service | (unset — say so) |
> | R2-BT-6 | b331 | Take 5 – Sherman | proto/auto-service | 300 |
> | R2-BT-7 | b297 | Take 5 611 San Pedro Ave | proto/auto-service | 44 |
> | R2-BT-8 | b306 | Take 5 Katy TX | proto/auto-service | (unset — say so) |
> | R2-BT-9 | b293 | Bonilla Law Firm | small TI | 49 |
> | R2-BT-10 | b254 | Take 5 Cypress | proto/auto-service | 141 |
> | R2-BT-11 | b251 | Take 5 Dickinson | proto/auto-service | 186 |
> | R2-BT-12 | b227 | LCRA Narrows Recreation Area | institutional (park) | 75 |
> | R2-BT-13 | b214 | Tye Preston Memorial Library Alternate 04 | institutional | 32 |
> | R2-BT-14 | b147 | Tye Preston Memorial Library | institutional | 32 |
> | R2-BT-15 | b150 | Garison Park Buda | institutional (park) | 33 |
> | R2-BT-16 | b182 | MPH LIVARG – Med Gas Only | vet-clinic (med gas) | 262 |
> | R2-BT-17 | b118 | Connell House – Curvatura | small TI | 37 |
> | R2-BT-18 | b159 | SVP LIVARG | vet-clinic | 262 |
>
> Notes for wave A: b214 is an alternate of b147 — do b147 first and treat b214 as a
> package split (ask which scope is the alternate before counting). b216 (San Marcos Fire
> Station #3) is deliberately absent: its plans are Drive-only, so `open_backtest` grades it
> X until the owner fills its plans link — ask, don't work around it.
>
> **Wave B — regression, only after wave A is complete.** These references were backtested
> in round 1. Use `open_backtest(…, round: 2)`; labels `R2-BT-19` onward. Six are marked
> NOT BLIND because the doctrine you read quotes their values or deltas — run them anyway,
> report them honestly as regression runs, and expect `gate_eligible` to be judged by the
> owner, not by you:
>
> b269 Hawaiian Bros #142 (kitchen/occupied) · b298 Take 5 6811 San Pedro (proto) ·
> b351 Pepper Lunch Leander (kitchen/occupied) · b190 Church Video Cafe Reno (small TI) ·
> b200 HEB CStore San Marcos · b168 HEB CStore & Carwash Converse · b201 AISD Garcia
> School Renovation (institutional; delta quoted in doctrine) · b323 TSAOG Rogers Rd MOB
> (institutional; round 1 was void — check the plan set is the tenant fit-out, not
> core/shell, before counting) · **NOT BLIND:** b370 Hyper Kidz, b280 Crunch Fitness
> Potranco, b375 SpaceX BA-02N Architectural, b376 MPH Casa Linda, b166 Take 5 Seguin,
> b237 Take 5 Liberty Hill.
>
> Skip b396 and b397 — they are live shadows, not backtests.
>
> **When you stop** (out of time, out of bids, or blocked everywhere): `submit_report` with,
> per bid: label, reference, grade, locked total, delta, scope verdict, gate-eligible, the
> one-line lesson, and the audit's question count; then a closing paragraph on which
> doctrine sections held, which failed, and what you would change — that paragraph is the
> deliverable the owner reads first. Never send anything to a customer, never mark a bid
> sent, never touch a bid that is not yours.

## What the owner does with the results

- Audits: the Robots pill on Bids; judge each card with the one-tap verdicts, answer the
  questions, Finish audit. The next twin session digests them (`FEEDBACK_LOOP.md`).
- Scoreboard: `R2-BT-*` rows sit beside `BT-*`; the per-axis cards show whether the
  doctrine moved the mean absolute delta and the ±8% hit rate.
- The six NOT BLIND regression runs are read as "did the rules reproduce the number", not
  as gate evidence.
