# Takeoff calibration — what 205 human takeoffs look like

---
file: docs/twins/CALIBRATION.md
type: Reference / Calibration report
purpose: Wave 3.1 of ESTIMATOR_TWIN_PIPELINE_PLAN.md — expectation-setting stats from the human CountTooling fleet (205 finished takeoffs, twin/test accounts excluded), run 2026-08-30 BEFORE the placement engine's first mission. Score M4/M5 against these shapes, not intuition.
audience: Developers, AI Agents, mission scorers
last_updated: 2026-08-30
---

Source: CT `projects` joined to non-twin profiles, `counter_count > 0` (n=205), via
read-only SQL 2026-08-30. Re-run the queries (in the git history of this file's PR)
when the fleet grows; stamp a new date.

## The shape of a human takeoff

| Metric | p25 | p50 | p75 | max |
|---|---|---|---|---|
| Counter marks placed | 14 | 51 | 123 | 1,218 |
| Lines drawn | — | 57 | 186 | — |
| Counter types defined | — | 35 | — | — |
| PDF pages | — | 9 | — | — |

- A **median project is ~51 marks + ~57 lines on a ~9-page set** — LIVSTE (55 pages) is
  a large set, expect the upper band.
- ~35 counter types per project is mostly **template roster**, not 35 used tags — expect
  many defined-but-unplaced counters in references; diff on placed counts per NAME
  (`takeoff-eval.js` already does).

## The counter vocabulary (top of 205 projects)

GATE VALVE (149) · WC-1 (108) · WCO (102) · FCO (95) · SK-1 (87) · HB (86) · EWC-1 (85)
· LAV-1 (83) · BALL VALVE (82) · SK-2/SK-3 (81/80) · OB-1/OB-2 (77) · BUTTERFLY VALVE
(77) · WATER FILTER (77) · SCAVENGER/medical-gas outlets (77/76) · DCVA (76) · TRAP
PRIMER (76) · MBV (76) …

## The load-bearing finding

**Humans count far past the fixture schedule.** The most common counters are VALVES,
CLEANOUTS (WCO/FCO), hose bibbs, trap primers, med-gas outlets — plan symbols that never
appear in a fixture schedule. A counters-first engine driven by the schedule roster
(PLACEMENT.md v0) will therefore be structurally light against a human reference:

- **Score per-tag, never by total** — v0's claim is "every scheduled tag placed
  correctly", not "everything a human counts".
- The gap list (tags in the human takeoff absent from the engine's roster) is itself a
  deliverable of M4 — it is the v1 roster (valves/cleanouts from legend + riser reads).
- Expect the LIVSTE schedule (~15 tags, substrate v0.4) to cover well under half of a
  human reference's counter names.
