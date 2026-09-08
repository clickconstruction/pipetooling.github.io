# Costing an electrical bid in TakeoffTooling — twin guide

---
file: docs/twins/TAKEOFFTOOLING_BID_GUIDE.md
type: Twin brief (TakeoffTooling)
purpose: Everything an estimator twin needs to take an ELECTRICAL bid through TakeoffTooling — the explode-and-cost stage between the CountTooling takeoff and the PipeTooling counts — your access, the loop, and the exact contracts. Served by twin-mcp as get_tt_guide.
audience: Digital Twins
last_updated: 2026-09-07
---

TakeoffTooling (takeofftooling.com) is where an electrical takeoff becomes priced,
labored material: a manifest of devices, fixtures, gear, conduit and wire, each row
exploded into its assembly (box, ring, plate, connectors; couplings and straps per ten
feet) and priced from a Labor & Price Book built on the MC labor units. It is the
electrical trade's STG-4. Plumbing bids skip it — PipeTooling's own takeoff books do that
work for plumbing. You use TakeoffTooling only when the bid's trade is Electrical.

## What you have access to

- **Your own TT seat**: `twin-estimator-<n>@twins.takeofftooling.local`, minted with
  `mint_session` (`app: 'takeofftooling'`) — the same per-twin token as everything else.
  A flagged account wears the 🤖 banner; own projects only, always.
- **The agent door**: `POST /functions/v1/import-manifest` on TakeoffTooling with your TT
  session JWT (twin accounts only). You do NOT drive the device / conduit / wire flows —
  you POST the counts you already have and the door explodes and prices them with the
  same kernel the human's ⚡ Explode button runs. `tt_finish_costing` does the whole
  stage in one call; use the door directly only when you need finer control.
- **The review lane**: your project carries `review_status` — `tt_finish_costing` marks
  it `ready`; a human reviews (the bridge gives them a share link that opens your
  manifest in their own app); `changes` + a note sends it back, `reviewed` clears you.
- **The way out**: `get_work_state(bid).tt_manifest` returns the priced rows (unit cost
  + labor hours per row) and a `counts_text` in PipeTooling's Counts-import format.

## The loop (electrical bids only)

1. **Finish the CountTooling takeoff first** (`get_ct_guide`). Your counts arrive as
   typed rows: `unit` ea / ft / px, `type` (devices, lighting, gear, conduit, wire,
   specialSystems), `group` (the circuit or panel, e.g. `LP-1 / 7`), `pages`, and
   `children` (CountTooling child counts). Use CountTooling's structured payload
   (`getTakeoffToolingPayload`) or build the same shape from your own tally.
2. **One call lands the costing**: `tt_finish_costing(bid, name, items, note?)` — the
   server mints your TT session, POSTs `import-manifest` with `external_ref = b<bid>`
   and the bid's CountTooling plans link, and marks the project `ready`. Re-running with
   the same bid REPLACES the project (your fix-and-retry loop, never a duplicate).
   Rejections are 400s that name the exact field; fix what they name.
3. **Read the result**: `exploded` = parents that received an assembly; `unpriced` =
   assembly rows no book row priced (they carry `meta.needsPricing`). An unpriced row is
   a book gap, not a guess: extend your book (the app's Labor & Price Book, synced to
   your seat) or pass `labor` / `price` on those children and re-run. Never invent a
   price on the row itself without a mirror note.
4. **Carry it to PipeTooling**: `paste_counts(bid, rows, …)` — take `tt_manifest.rows`,
   name each row's robot-book entry as usual, and pass `unit_cost` (materials, per unit)
   and `labor_hours` (per unit) from TakeoffTooling so the Workbench opens costed. The
   step-0 invariant still holds: priced rows must equal your LOCK.
5. **Flag, don't stall**: a scope question is an `RFI:` note in CountTooling or
   `ask_question` here; a book gap is a `needsPricing` row you can name in your audit
   confession. Plain trade words, one ask each.

## Contracts (exact)

**Item** (what `import-manifest` and `tt_finish_costing` take):
```
{ description, quantity, unit?: 'ea'|'ft'|'px', type?, pages?, group?, meta?,
  children?: [{ description, quantity, unit?, type?, labor?, price? }] }
```
Nothing you omit is inferred: a row with no `type` stays untyped, and untyped rows get
no assembly. `px` rows import flagged and are never priced (rescale in CountTooling).

**Result** (`tt_finish_costing` / `get_work_state.tt_manifest`):
```
{ project_id, external_ref, review_status, rows, counts, line_types, unscaled,
  exploded, unpriced, book: 'twin book' | 'defaults', share_url,
  rows: [{ fixture, description, count, unit, page, group, is_child, parent, type,
           unit_cost, labor_hours, extended_cost, extended_hours }] }
```

## Guardrails

- **Electrical only.** Plumbing bids never touch TakeoffTooling; if a plumbing bid's
  work state shows `tt_manifest`, something upstream mis-tagged the trade — report it.
- **No robot-mousing the flows.** The door and the ⚡ button are the same code; the flows
  are the human's.
- **Book discipline** is the robot-book doctrine: every price has a named source. The
  door tells you where it priced from (`book: 'twin book'` or `'defaults'`); defaults
  are MC-book labor units and catalog prices, good enough to draft, not to lock.
- **ZZ names, same as everywhere.** Write missions use `ZZ`-prefixed project names.
