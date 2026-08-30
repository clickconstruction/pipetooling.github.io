/**
 * Placement engine assembler CLI (Wave 3.4 v0 — docs/twins/PLACEMENT.md).
 * Turns a placements manifest (what the vision pass recorded, raw px at render DPI)
 * into a validated takeoff.json ready for CT import-takeoff, and prints the
 * counts-vs-schedule self-check when a schedule is given.
 *
 *   npx vite-node scripts/placement-engine/assemble.ts -- <manifest.json> [out.json]
 *
 * Manifest shape (all coordinates RAW page px at `dpi`, pre-rotation):
 * {
 *   "counters":  [{ "id": "c-wc1", "name": "WC-1", "color": "#e8c547" }],
 *   "lineTypes": [],
 *   "marks":  [{ "counterId": "c-wc1", "pageIndex": 12, "raw": { "x": 1, "y": 2 }, "dpi": 600 }],
 *   "notes":  [{ "pageIndex": 12, "raw": { "x": 1, "y": 2 }, "dpi": 600, "text": "RFI: …" }],
 *   "pageLabels": { "12": "P200" },
 *   "pageScales": { "12": { "pixelsPerUnit": 12.34, "unit": "ft" } },
 *   "pdfPageCount": 55,
 *   "schedule": [{ "tag": "WC-1", "qty": 4 }]
 * }
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { assembleTakeoff, validateTakeoff, countsVsSchedule, calibrateFromDoors, feetByLineType, marksFarFromLines, deriveFittings, fittingSummary, materializeFittings, applyDefaultCanvases } from '../../src/lib/takeoffPlacement'

const args = process.argv.slice(2).filter((a) => a !== '--')
const manifestPath = args[0]
if (!manifestPath) {
  console.error('usage: npx vite-node scripts/placement-engine/assemble.ts -- <manifest.json> [out.json]')
  process.exit(2)
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
let takeoff = assembleTakeoff(manifest)
// Door calibration report (doors are 3 ft — owner rule): per page, median + outliers.
for (const [page, ds] of Object.entries(manifest.doorSamples ?? {}) as Array<[string, { dpi: number; doors: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> }]>) {
  const cal = calibrateFromDoors(ds.doors, ds.dpi)
  console.error(`page ${page} scale from ${ds.doors.length} door(s): ${cal.pixelsPerUnit.toFixed(3)} px/ft` +
    (cal.outliers.length ? `  ⚠ outlier sample index(es) ${cal.outliers.join(',')} — remeasure or drop` : ''))
}
const problems = validateTakeoff(takeoff, manifest.pdfPageCount)
if (problems.length) {
  console.error('REJECTED (import-takeoff would refuse these by the same names):')
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
if (Array.isArray(manifest.schedule) && manifest.schedule.length) {
  const rows = countsVsSchedule(takeoff, manifest.schedule)
  const bad = rows.filter((r) => !r.ok)
  console.error('counts vs schedule:')
  for (const r of rows) {
    console.error(`  ${r.ok ? '✓' : '✗'} ${r.tag}: placed ${r.placed}` + (r.scheduled != null ? ` / scheduled ${r.scheduled}` : ' (presence-only)'))
  }
  if (bad.length) console.error(`  ${bad.length} tag(s) off — fix or explain each in the import note before shipping.`)
}
const feet = feetByLineType(takeoff)
if (feet.length) {
  console.error('feet by line type:')
  for (const f of feet) console.error(`  ${f.lineType}: ${f.feet} ft over ${f.runs} run(s)`)
  const conn = marksFarFromLines(takeoff)
  if (conn.far.length) {
    console.error(`connectivity: ${conn.far.length} fixture(s) > 6 ft from any run — trace or explain:`)
    for (const c of conn.far) console.error(`  ✗ ${c.counter} on page ${c.page} (${c.feet} ft away)`)
  } else {
    console.error('connectivity: every fixture has a run within 6 ft ✓')
  }
  if (conn.skippedUnscaled) console.error(`  (${conn.skippedUnscaled} mark(s) on unscaled pages skipped)`)
}
// Fittings fall out of the traced geometry (owner ask 2026-08-30): turns = elbows,
// branches = tees/wyes; odd angles flagged. `"materializeFittings": true` in the
// manifest bakes them in as visible counters ("CW · Tee") for review in the app.
const { fittings, skippedUnscaledPages } = deriveFittings(takeoff)
if (fittings.length) {
  console.error('fittings derived from geometry:')
  for (const s of fittingSummary(fittings)) console.error(`  ${s.lineType} · ${s.kind}: ${s.count}`)
  const odd = fittings.filter((f) => f.kind.startsWith('odd'))
  for (const f of odd) console.error(`  ⚠ ${f.lineType} ${f.kind} at (${Math.round(f.at.x)},${Math.round(f.at.y)}) page ${f.page} — ${f.angle}°, name it or fix the trace`)
  if (manifest.materializeFittings === true) {
    takeoff = materializeFittings(takeoff, fittings)
    console.error(`  materialized ${fittings.length} fitting marker(s) as counters`)
  }
}
if (skippedUnscaledPages.length) console.error(`fittings: skipped unscaled page(s) ${skippedUnscaledPages.join(',')}`)
// Per-layer review toggling: Fixtures / one canvas per system / Fittings (CT's canvas
// switcher + show-all + hide-marks give the toggles; import-takeoff builds the layers).
takeoff = applyDefaultCanvases(takeoff)
const out = args[1]
const json = JSON.stringify(takeoff, null, 2)
if (out) {
  writeFileSync(out, json)
  console.error(`wrote ${out}`)
} else {
  console.log(json)
}
