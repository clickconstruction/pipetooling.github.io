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
import { assembleTakeoff, validateTakeoff, countsVsSchedule } from '../../src/lib/takeoffPlacement'

const args = process.argv.slice(2).filter((a) => a !== '--')
const manifestPath = args[0]
if (!manifestPath) {
  console.error('usage: npx vite-node scripts/placement-engine/assemble.ts -- <manifest.json> [out.json]')
  process.exit(2)
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const takeoff = assembleTakeoff(manifest)
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
const out = args[1]
const json = JSON.stringify(takeoff, null, 2)
if (out) {
  writeFileSync(out, json)
  console.error(`wrote ${out}`)
} else {
  console.log(json)
}
