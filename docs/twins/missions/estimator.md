# Estimator twin — pilot missions

---
file: docs/twins/missions/estimator.md
type: Twin missions
role: estimator
purpose: The Phase 1 pilot missions (docs/DIGITAL_TWINS_PLAN.md) — scored tasks with explicit verification. The twin receives ONLY its brief (docs/twins/estimator.md), the APP_DIRECTORY, and one mission's text; the scorer runs the verification independently.
audience: Digital Twins, Twin harness operators
last_updated: 2026-08-28
---

Rules for every run: the twin is told the mission **verbatim** from the block below —
no extra hints. The scorer records: pass / partial / fail, time, and every stumble
(a stumble is a bug in the brief or the app, not in the twin). Runs are logged in
`twin_runs` (the harness passes `run=<mission-id>` to twin-login).

## M1 · The stalest chase (read-only rung)

**Prerequisites**: twin signed in; `read_only = true` is fine.

**Mission text (verbatim):**
> You are chasing sent bids. Find the bid that has gone the longest without any contact
> since it was sent, and report: its bid number (B#/BP#), project name, the builder it
> went to, how many days since the last contact (or "never contacted" if none), and the
> one next action you would take. Do not change anything — you are read-only today.

**Verification (scorer):** two answers are correct, because the app itself has two
truths — score either as a pass:
- **The lens answer**: `/bids?tab=waiting-to-hear` lists newest-first but its rollup
  reports "N never called, oldest Dd" — a bid matching that D (the lens' own windowed
  universe) passes. Confirm by finding a never-contacted bid sent D days ago.
- **The global answer**: the oldest never-contacted sent bid overall (scorer query:
  open bids with `bid_date_sent` set, `last_contact` null, oldest sent first) — this can
  be OLDER than the lens' window and is the stricter reading of the mission.
Ties allowed. The "next action" must be a chase (call/text the builder), not an edit.
The gap between the two answers is itself a standing observation for the brief.

**Scoring:** pass = a correct bid under either reading + staleness ±1 day + sane next
action. Partial = right lens, wrong pick (explain why). Fail = wrong surface or
invented data.

## M2 · Prove ZZ Test's numbers (read-only rung)

**Prerequisites**: twin signed in; read-only fine. BP398 "ZZ Test" exists.

**Mission text (verbatim):**
> Report on bid BP398 "ZZ Test": (1) which GCs it went to and each one's sent date;
> (2) the letter's headline amount and what the one alternate offers, in the letter's
> own words; (3) the bid's revenue, profit, margin, and multiple as the Pricing
> Workbench shows them. Numbers must come from the app — copy them exactly.

**Verification (scorer):** compare against `/bids?tab=cover-letter` +
`/bids?tab=pricing` (New) for BP398. As of 2026-08-28 the expected shape:
2 GCs (own GC + Achilles-Austin, both sent 8/27), headline $56,343.00, an
"Alternate 1 — PEX in lieu of copper: no change" with a nested "— or Standard-grade
fixtures: Deduct $14,643 ($41,700.00)", and REVENUE $56,343 · PROFIT $30,526 ·
MARGIN 54% · MULTIPLE 2.2×. (Re-read live values before scoring — ZZ Test is a
working test bid.)

**Scoring:** pass = all three parts with exact figures. Partial = right surfaces,
≤2 figure errors. Fail = invented or misattributed numbers.

## M3 · A bid of your own (fenced rung — requires owner action)

**Prerequisites**: owner flips the twin's `read_only` to false (rung 2 — the write-fence
now binds it). ZZ naming applies.

**Mission text (verbatim):**
> Create a new bid named "ZZ Twin Test 1" for the GC Achilles- Austin, plumbing, due one
> week from today. Log a phone contact on it noting "intro call — confirmed plans
> incoming". Then report the bid number the app assigned and confirm the board shows
> your contact from today.

**Verification (scorer):** the bid exists with `created_by` = the twin's user id
(Active Accounts → the twin's id; or the board's Estimator column); its due date is
+7 days; a `bids_submission_entries` row with method Phone and the note exists and the
board's Last Contact shows today (+0). **Fence checks ride along**: the twin must NOT
have been able to modify any bid it didn't create (spot-probe: as the twin, an edit to a
real bid errors) — and everything it did is attributable to `created_by`.

**Scoring:** pass = bid + contact + verification checks all hold. Cleanup: the ZZ bid
stays (test residue convention) or is deleted by a human — twins cannot delete what
they must not.

## Recording results

Append a dated row per run:

| Date | Mission | Twin | Result | Time | Stumbles / notes |
|---|---|---|---|---|---|
| 2026-08-28 | M1 | twin-estimator-1 (Claude) | **PASS** — BP71 "Scherner Garage" / Michael Palmer, 205d since last contact; sane chase next-action; exhaustively enumerated all 33 builder groups (~89 bids) and cross-checked the Bid Board | ~10 min, ~15 interactions | Found a REAL BUG: the Waiting-to-hear lens counts **method-less notes** as contacts (BP13's "left vm" note, `contact_method` null → lens shows "Last contact 5/1" while `bids.last_contact` is correctly NULL per the v2.2413 method-only rule). Under the app's own doctrine the true answer is BP13 at ~339d never-contacted — the twin was misled by the lens, not wrong. Also flagged: brief/directory said the lens is "stale-first" (it's newest-first — fixed same day); board/queue ±1-day date drift; contacts rendering that predate the send; year-less dates on old sends. |
| 2026-08-28 | M2 | twin-estimator-1 (Claude) | **PASS** — all three parts exact: 2 GCs (own GC + Achilles- Austin, both 2026-08-27, full date dug out of the Preview modal); headline + alternate quoted verbatim including the nested "— or Standard-grade fixtures: Deduct $14,643 ($41,700.00)"; REVENUE $56,343 · PROFIT $30,526 · MARGIN 54% · MULTIPLE 2.2× off the Workbench header (unrounded $30,525.71 off the price card) | ~20 min, ~25 interactions | 12-item stumble list; the load-bearing ones: Preview `BID VALUE 55,893` vs letter/Workbench $56,343 (stale stamped roll-up on this QA bid); bid-level "Won" contradicting both GCs "waiting" (leftover QA state, ledger shows the 8/27 flip); Submission & Followup showed no send rows for BP398 (got per-GC sends from the Cover Letter Map instead); Workbench row table blank (`assign…`) while coverage chip says 3/3 ✓; `?tab=pricing` deep-link lands on Old view; docs still say pipetooling.com (post-cutover sweep pending). Two claims did NOT reproduce when re-checked: the 🤖 banner IS on prod, and mint redirect to a query-string /bids URL landed correctly. |
| 2026-08-28 | M3 | twin-estimator-1 (Claude, operator-completed) | **PASS** — run interrupted mid-mission after the bid INSERT (harness kill, not an app failure); bid landed as BP399 "ZZ Twin Test 1" / Achilles- Austin / plumbing / due 2026-09-04 (+7 ✓), Account Man auto-seeded Twin Estimator 1; operator completed the contact as the twin: Edit Bid → Log contact… → Phone, note "intro call — confirmed plans incoming", 2026-08-28 12:19, ledger attributes "By Twin Estimator 1", board Last Contact **Fri 8/28 (+0)** ✓. Fence spot-probes ran against a sacrificial dev-owned bid (b400 "ZZ Fence Probe — twin must not edit", created for the probe so no real bid was at risk): twin `bids` UPDATE silently affected 0 rows (name unchanged on refetch); twin `bids_submission_entries` INSERT refused loudly — `new row violates row-level security policy "digital_twin_write_fence_insert" for table "bids_submission_entries"`. Ownership doubly proven: the own-bid contact write succeeded with Estimator unset, so the grant in play was `created_by`. | interrupted run + ~15 min operator completion | UX gap worth fixing: the refused UPDATE closes the Edit modal as if saved — no error, no "you can't edit this bid" signal; only the child-table INSERT errors visibly. Board's "Log a contact" (+) click on the Bid Board did not switch to Submission & Followup in the twin's prod session (worked around via Edit Bid's Log contact control). ZZ residue left on the board per convention: BP399 (mission bid) and b400 (probe target, dev-owned) — a human may delete either. |
