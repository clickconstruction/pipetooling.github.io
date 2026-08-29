# Plan substrate — schema v0

---
file: docs/twins/SUBSTRATE.md
type: Data contract / Spec
purpose: The informational-substrate schema (ESTIMATOR_TWIN_PIPELINE_PLAN.md Wave 1 item 1.1) — the per-sheet JSON an extractor produces from a plan set and every downstream pipeline stage consumes (placement engine, scope sheet, RFI candidates, get_plan_brief). Written 2026-08-28 against the LIVSTE set, alongside the hand-built mini-substrate that is its first fixture.
audience: Developers, AI Agents, extractor harnesses
last_updated: 2026-08-28
key_sections:
  - Why this shape
  - Storage contract
  - The envelope
  - Per-sheet record
  - The fact envelope (confidence + provenance)
  - Schedules as tables
  - Notes and flags
  - Reconciliation
  - The rollup (plan brief)
  - Extractor design notes from the walking skeleton
  - Versioning
---

## Why this shape

A plan set is mostly noise for any one trade (LIVSTE: 9 plumbing sheets of 55). The substrate
is the machine-readable residue of reading the whole set once: what each sheet is, what the
schedules say, what the notes commit us to, how each plan sheet is scaled, and where the set
disagrees with itself. Three consumers, one contract:

1. **The placement engine** (Wave 3) — fixture tags + calibrations are its shopping list.
2. **The scope sheet / letter draft** (Wave 4) — note flags become suggested exclusions and
   assumptions; reconciliation mismatches become RFI candidates.
3. **Humans** — the same brief rendered in the bid window; if an estimator wouldn't use it,
   the twin shouldn't trust it.

Design rule carried through every field: **no naked facts.** Every extracted value carries
confidence and a crop reference back to the ink it came from, so a reviewer can jump from any
number to the sheet region that produced it, and a low-confidence value is visibly low-
confidence instead of silently wrong.

## Storage contract

- **Home**: PT Supabase storage bucket, keyed to the bid
  (`plan-substrates/<bid_id>/substrate-v<NNN>.json`), plus a copy in the Drive job folder.
  Served to agents via twin-mcp `get_plan_brief` (Wave 1 item 1.4).
- **Never in this repo.** This repo is public (GitHub Pages). A substrate for a real bid is
  business data — fixtures for tests must be synthetic or scrubbed.
- Substrates are **immutable once written**; a re-extract (or an addendum) writes the next
  `substrate-vNNN` and records `supersedes`. The addenda diff (Wave 4) compares two versions
  and names the changed sheets.

## The envelope

```json
{
  "substrate_version": "0.1.0",
  "generated_at": "2026-08-28T22:00:00Z",
  "generator": { "kind": "hand|skill", "name": "...", "run_id": "..." },
  "supersedes": null,
  "source": {
    "file_name": "MPH LIVSTE San Antonio Full Set.pdf",
    "sha256": "…",
    "page_count": 55,
    "drive_file_url": null
  },
  "bid": { "pt_bid_id": "…", "project_name": "…", "trade": "plumbing" },
  "sheets": [ /* per-sheet records, one per PDF page, all 55 */ ],
  "rollup": { /* the plan brief — see below */ }
}
```

Every page gets a sheet record even when `discipline` is out-of-trade — classification of the
whole set is itself a deliverable (it's how the 84% noise is proven noise) — but only
in-trade sheets carry full extraction.

## Per-sheet record

```json
{
  "page": 30,
  "sheet_no": { "value": "P002", "confidence": "high", "crop": { "region": "title_block" } },
  "title": { "value": "PLUMBING SCHEDULES", "confidence": "high" },
  "discipline": "plumbing",
  "series": "P",
  "revision": { "value": null, "confidence": "low", "needs_crop": true },
  "orientation": "landscape_rotated_90ccw",
  "scale": {
    "stated": { "value": "1/4\" = 1'-0\"", "confidence": "medium" },
    "calibration": {
      "dim_text": "22'-6\"",
      "p1_pdf_pts": [x, y], "p2_pdf_pts": [x, y],
      "computed_px_per_ft": 12.34,
      "confidence": "medium"
    }
  },
  "schedules": [ /* see Schedules */ ],
  "notes": [ /* see Notes */ ],
  "legend": [ { "symbol_desc": "…", "maps_to": "cold water", "confidence": "…" } ],
  "extraction_status": "complete|partial|structure_only|skipped"
}
```

`extraction_status: "structure_only"` is a first-class honest state: the extractor saw a
schedule exists and read its shape but could not resolve cell text at available resolution —
the signal that a targeted high-DPI crop pass is owed (see Design notes).

## The fact envelope (confidence + provenance)

Any leaf value may be a bare scalar **only** when confidence is high and provenance is the
sheet's title block. Everything else uses:

```json
{ "value": "WC-1", "confidence": "high|medium|low|illegible",
  "crop": { "page": 30, "bbox_pdf_pts": [x0, y0, x1, y1], "render_dpi": 300 },
  "needs_crop": false, "notes": "…" }
```

`illegible` + `needs_crop: true` is the extractor saying "I know something is here and I
could not read it" — categorically different from omitting the fact, and the thing the
quality report (Wave 1 gate) counts.

## Schedules as tables

```json
{
  "schedule_type": "plumbing_fixture|water_heater|circulation_pump|animal_gas|evac_fan|other",
  "title": "PLUMBING FIXTURE SCHEDULE",
  "columns_seen": ["MARK", "DESCRIPTION", "WASTE", "VENT", "CW", "HW", "REMARKS"],
  "row_count_estimate": 14,
  "rows": [
    {
      "tag": { "value": "WC-1", "confidence": "…" },
      "description": { "value": "…", "confidence": "…" },
      "connections": { "waste": "3\"", "vent": "2\"", "cw": "1\"", "hw": null },
      "qty_scheduled": { "value": 5, "confidence": "…" },
      "remarks": { "value": "…", "confidence": "…" }
    }
  ]
}
```

The fixture schedule's `tag` column is the pipeline's primary key: counts, reconciliation,
takeoff-book application, and the letter's inclusions all join on it.

## Notes and flags

```json
{
  "category": "general|gas|animal_gas|renovation|sprinkler|specification",
  "text": { "value": "…", "confidence": "…" },
  "flags": ["exclusion_candidate", "scope_commitment", "certification_required",
            "coordination", "alternate_invited", "rfi_candidate"]
}
```

Flags are the seam to the scope sheet: `exclusion_candidate` notes surface as *suggested*
letter exclusions (never auto-applied — the loss-reason doctrine), `alternate_invited` feeds
the alternates decision, `certification_required` feeds the risk read.

## Reconciliation

The estimator's own QA, made explicit — per fixture tag, do the set's three voices agree?

```json
{ "tag": "WC-1",
  "qty_schedule": 5, "qty_plan_symbols": 5, "qty_riser": 5,
  "agreement": "full|partial|conflict|unverifiable",
  "detail": "…", "rfi_candidate": false }
```

`conflict` rows are born RFI candidates; `unverifiable` (a voice was illegible) rows are
born crop-pass work items. A takeoff whose counts disagree with a `full`-agreement row is
the first thing the review gate should question.

## The rollup (plan brief)

What `get_plan_brief` serves by default; the per-sheet records are the drill-down.

```json
{
  "sheet_inventory": { "total": 55, "in_trade": ["P001","P002","P200","P201","P301","P401","P601","P701","P702"] },
  "fixture_tags": [ { "tag": "WC-1", "qty": 5, "reconciliation": "full" } ],
  "scope_flags": [ { "flag": "…", "source_sheet": "P001", "note_ref": "…" } ],
  "alternates_invited": [ "…" ],
  "risks": [ { "risk": "animal/medical gas certification", "source_sheet": "P301" } ],
  "open_questions": [ /* reconciliation conflicts + illegible load-bearing facts */ ],
  "scope_and_risk_read": {
    "trade_fit": "…", "go_no_go_recommendation": "go|no_go|conditional",
    "reasons": ["…"],
    "recommendation_only": true
  }
}
```

The `scope_and_risk_read` is stamped on the bid as an audit note at the end of STG-2; it
**sets nothing** — the Go/no-go control stays human (owner decision, plan doc).

## Extractor design notes from the walking skeleton (2026-08-28)

Hand-building the LIVSTE mini-substrate surfaced the constraints the Wave-1 extractor must
be designed around — recorded here so they don't get re-learned:

1. **Page-level rendering cannot read schedules.** At whole-page render resolution the P002
   fixture schedule's structure is visible but its cell text is not. The extractor MUST work
   in two passes: a structure pass (classify sheets, locate schedule/note/title-block
   regions) and a **crop pass** (re-render located regions at ≥300 DPI) — `structure_only` +
   `needs_crop` is the state between the passes.
2. **E-size sheets arrive rotated.** LIVSTE renders landscape-rotated; OCR and bbox math must
   normalize orientation first and record it (`orientation`) so crop bboxes stay meaningful.
3. **The set self-indexes twice.** GI-000's drawing list covers the set; P001 carries its own
   plumbing sheet index. Extract both and reconcile — a sheet in one index but not the other
   is a question worth flagging.
4. **Vet-specific systems live on their own sheets** (P301 animal gas; scavenger fan on
   P002). A fixtures-only extraction would miss real scope — schedules of every type get
   rows, not just the fixture schedule.
5. **Title blocks are the cheap, reliable skeleton.** Sheet number/title/discipline read
   accurately even at low resolution; build the inventory first, spend the DPI budget on the
   located regions.

## Versioning

`substrate_version` is semver. v0.x may change shape freely; consumers must tolerate unknown
fields (additive evolution). The first schema-stable release (1.0.0) waits for the Wave-1
quality gate on LIVSTE — the fixture and the extractor argue the schema into shape first.
