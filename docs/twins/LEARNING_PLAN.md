# Learning plan — optimizing around one teacher

---
file: docs/twins/LEARNING_PLAN.md
type: Plan / Build list
purpose: The program's two scarce resources are Wendi's hours and Wendi's corpus (~130 usable references, growing only as fast as she bids). This is the build list for maximizing learning per hour and per reference, written 2026-09-06 after the first full regression cycle proved the audit→digest loop works (digested lessons land ±8%; undigested rules miss 30–400%).
audience: The owner, the twins operator, AI agents planning work
last_updated: 2026-09-06 (evening — statuses after the build-out began)
key_sections:
  - name: "The constraint"
  - name: "Lever 1 — spend her hours on rulings, not rows"
  - name: "Lever 2 — mine what she produces for free"
  - name: "Lever 3 — protect the small sample"
  - name: "Lever 4 — hedge the single-teacher risk"
  - name: "Build list & status"
---

## The constraint

Only Wendi's bids are detailed enough to score against, and only Wendi can judge
a robot's draft. Runs are now cheap (the 2026-09-05 batches: 11 full-pipeline
runs in a day, zero permission blocks after v1.3.6); counting has converged
(fixture parity on nearly every run). What remains scarce:

1. **Her hours** — ~25 audits pending is the standing backlog; every blocked
   axis and every open ruling waits on them.
2. **Her corpus** — ~130 grade-A/B references (survey 2026-08-31), growing only
   as she bids. Six of fourteen wave-B references are already NOT-blind because
   doctrine quotes them; every digested lesson contaminates its source.

Everything below optimizes one of those two.

## Lever 1 — spend her hours on rulings, not rows

An hour auditing one card yields a handful of verdicts; an hour answering
standing questions yields doctrine that moves every future bid.

- **Standing-rulings queue** (build): dedupe open `twin_questions` into one
  canonical question per doctrine issue (travel bands, small-TI absorption,
  package-boundary rule, …) and present them as a single "N rulings waiting,
  ~15 minutes" surface — the shape her productive 2026-09-04 pass actually
  took. Several agents have asked variants of the same question on different
  bids; the duplicates should collapse.
- **Audit queue triage by doctrine-at-stake** (build): sort her pending queue
  by what a verdict unblocks (an axis gate, an open ruling, a book price)
  instead of oldest-first.
- **Information density per tap** (shipped v2.2935): the rate-gap bucket +
  delta waterfall — her one tap on a `robot $7,705/u vs ours $3,350/u` row IS
  the multiplier ruling.

## Lever 2 — mine what she produces for free

She generates labeled data every day just by bidding; capture it at zero
marginal cost to her.

- **Auto-shadow every live bid** (shipped v2.2936 — this PR): `next_shadow`
  dispatcher claims the next unshadowed live bid (human requests first, then
  oldest eligible), so full coverage is "run N generic shadow agents" instead
  of hand-pasted kickoffs; `get_shadow_queue` now reports coverage
  (live-eligible vs shadowed). A shadow costs her zero minutes, locks blind
  before her number exists, auto-scores when she sends, and produces a fresh
  grade-A reference — the sample-size ceiling becomes her future output, not
  her past. **Follow-up (build)**: a scheduled shadow-agent batch (operator
  cron or owner-machine routine) so coverage doesn't depend on anyone
  remembering to run agents; a Scoreboard coverage pill. **Two lessons from
  the first shadow batch (2026-09-06)**: (a) a shadow scores against whichever
  estimator sends the reference — record WHOSE number it was (b481 scored
  against Grace's bid, which is practice, not the calibration standard); gate
  math should weight teachers accordingly. (b) A live bid whose plans link the
  Drive service account cannot read is invisible to the shadow program (b480
  blocked on exactly this) — a "plans readable by robots" indicator on live
  bids belongs on the board. (c) **Discipline**: b480 shadowed b378, an
  Electrical-division bid, and locked a $907k plumbing number against it —
  the dispatcher had no service-type filter. Fixed v2.3032 (plumbing-only
  claims at every door + `void_shadow`); the run was voided and the entries
  it mirrored into the electrical book removed. Coverage now counts plumbing
  bids only.
- **Record repair as office work** (process, tickets exist): 98 historical
  bids lack plans links; b216 and b323 are X/void on bad links alone. Every
  repaired record is +1 reference with zero estimating cost. The
  `reference_quality` repair-task loop already files the tickets.
- **Loss categorization push** (process + small UI nudge): an uncategorized
  loss flags the reference out of gate denominators (b339 flipped R2-BT-3 to
  VOID). One dropdown at outcome time keeps the reference usable.
- **Classify the 108 backtest candidates** (`bids.backtest_axis`, Queue lens)
  so slates draw from demand instead of judgment.

## Lever 3 — protect the small sample

With ~130 references, the fleet could become excellent at reproducing Wendi's
existing bids and untested on the 131st.

- **Holdout set** (owner decision + small build): designate ~20–25 clean A/B
  references across axes that are never run, never quoted in doctrine, never
  named in audits — reserved for gate measurement only. Gates measured on
  practiced references overstate readiness. Build: a flag on bids + gate
  denominators (`confidenceBoard.ts`) restricted to holdout runs; blindness
  redaction already generalizes.
- **Doctrine-promotion regression gate** (process, cheap now): a digested rule
  is *proposed*, measured against 2–3 other references, then banked. The ×2.2
  institutional multiplier went to doctrine from one bid and cost two +100%
  runs before its own source refuted it.
- **Out of the learning objective entirely**: market band (Hunter Rd — her own
  number lost by 2×) and the letter's margin over rowed money (the owner's
  call; the waterfall's "everything else" chip now shows the boundary). No
  sample size fixes these; don't let them pollute doctrine.

## Lever 4 — hedge the single-teacher risk

"Only Wendi's bids are detailed enough" is a bus-factor statement about the
company, not just the program.

- **Raise other estimators' record quality** (build, later): the STG-5 hygiene
  now enforced on robots (counts pasted, rows book-assigned, total equals the
  number) nudged onto human bids — Grace's and Malachi's bids become tomorrow's
  corpus.
- **PLACEMENT.md is the durable artifact**: every digested ruling is her
  knowledge made permanent. Treat the doctrine ledger as a company asset with
  the same care as the price book.

## Build list & status

| # | Item | Kind | Status |
|---|------|------|--------|
| 1 | Rate-gap bucket + delta waterfall on audit cards | app | shipped v2.2935 |
| 2 | `next_shadow` dispatcher + shadow coverage stat | harness | **this PR (v2.2936)** |
| 3 | Scheduled shadow-agent batches (full auto-coverage) | ops/harness | scheduled task live 2026-09-06 (weekday batch on the operator machine) |
| 4 | Standing-rulings queue (dedupe `twin_questions` into canonical rulings) | app | shipped v2.2939 (topics) + v2.2941 (panel + answer-all) |
| 5 | Audit queue triage by doctrine-at-stake | app | shipped v2.2941 (`auditTriage.ts`) |
| 6 | Holdout set flag + holdout-only gate denominators | app + owner decision | mechanism shipped v2.2942 + harness enforcement v2.2952 (open_backtest refuses; next_backtest skips; gate_run override); WHICH references still needs the owner (Queue lens toggle, target 20–25) |
| 7 | Doctrine-promotion regression gate (propose → measure → bank) | process (FEEDBACK_LOOP.md) | shipped v2.2940 |
| 8 | Scoreboard shadow-coverage pill | app | shipped v2.2943 |
| 9 | Record repair sweep (98 missing plans links; b216, b323) | office work | worklist generated 2026-09-06; the Drive shares need a human |
| 10 | Loss-categorization nudge at outcome time | app (small) | shipped v2.2943 |
| 11 | Classify 108 `backtest_axis` candidates | data (Queue lens) | 26 unambiguous written 2026-09-06 (11 proto, 6 institutional, 5 vet, 4 fitness); 67 ambiguous left for dev judgment |
| 12 | STG-5 hygiene nudges on human bids (corpus beyond Wendi) | app | shipped v2.2943 (record-grade chip on Counts) |
| 13 | `submit_report` label parameter (reports file "unlabeled") | harness (tiny) | shipped v2.2939 (with question topics + pairing visibility) |
