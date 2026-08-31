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
import { assembleTakeoff, validateTakeoff, countsVsSchedule, calibrateFromDoors, feetByLineType, marksFarFromLines, deriveFittings, fittingSummary, materializeFittings, applyDefaultCanvases, expandVerticalAllowances, buildToolingRows, dedupeSeamMarks, developedFeetBySystem, type VerticalAllowance, type DevelopedLengthFactor } from '../../src/lib/takeoffPlacement'

const args = process.argv.slice(2).filter((a) => a !== '--')
const manifestPath = args[0]
if (!manifestPath) {
  console.error('usage: npx vite-node scripts/placement-engine/assemble.ts -- <manifest.json> [out.json]')
  process.exit(2)
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
// Size attribution (BT-1 doctrine): a manifest line may carry `size` ('3"').
// Sized lines get a size-variant lineType — id `<base>@<size>`, name '3" Sanitary
// Waste', SAME canvas (=system) so CT layers stay per-system and fitting joins
// group across sizes. Unsized lines keep their base type.
const systemById = new Map<string, string>()
{
  const baseTypes: Array<{ id: string; name: string; color?: string; canvas?: string }> = manifest.lineTypes ?? []
  const byId = new Map(baseTypes.map((lt) => [lt.id, lt]))
  const extraTypes = new Map<string, { id: string; name: string; color?: string; canvas?: string }>()
  for (const lt of baseTypes) systemById.set(lt.id, lt.canvas ?? lt.name)
  for (const l of manifest.lines ?? []) {
    if (!l.size) continue
    const base = byId.get(l.lineTypeId)
    if (!base) continue
    const vid = `${base.id}@${String(l.size).replace(/[^0-9a-z/]+/gi, '')}`
    if (!extraTypes.has(vid)) {
      extraTypes.set(vid, { id: vid, name: `${l.size} ${base.name}`, color: base.color, canvas: base.canvas ?? base.name })
      systemById.set(vid, base.canvas ?? base.name)
    }
    l.lineTypeId = vid
  }
  if (extraTypes.size) {
    // Keep every type something still references (a base type survives only if an
    // unsized line still uses it).
    const used = new Set((manifest.lines ?? []).map((l: { lineTypeId: string }) => l.lineTypeId))
    manifest.lineTypes = [...baseTypes, ...extraTypes.values()].filter((lt) => used.has(lt.id))
  }
}
// Tile-seam dedup (BT-2: FD-2 12v11 off a ~22 px overlap pair). Default 24 raw px at
// each mark's dpi; `"seamDedupePx": 0` in the manifest disables, a number overrides.
{
  const seamPx = typeof manifest.seamDedupePx === 'number' ? manifest.seamDedupePx : 24
  if (seamPx > 0 && Array.isArray(manifest.marks) && manifest.marks.length) {
    const { kept, dropped } = dedupeSeamMarks(manifest.marks, seamPx)
    if (dropped.length) {
      console.error(`tile-seam dedup: dropped ${dropped.length} duplicate mark(s) within ${seamPx} px:`)
      for (const d of dropped) console.error(`  ${d.counterId} page ${d.pageIndex} at raw (${Math.round(d.raw.x)},${Math.round(d.raw.y)}) — ${d.distPt} pt from its keeper`)
      manifest.marks = kept
    }
  }
}
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
const { fittings, skippedUnscaledPages } = deriveFittings(takeoff, 2, (id) => systemById.get(id) ?? id)
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
// The third dimension: manifest.verticals (VerticalAllowance[]) — explicit vertical
// footage + fitting allowances with named sources. Reported here and folded into the
// tooling paste block; never drawn in CT (nothing on-plan to register them against).
const allowances: VerticalAllowance[] = manifest.verticals ?? []
if (allowances.length) {
  const ex = expandVerticalAllowances(allowances)
  console.error(`vertical allowances: ${ex.totalFeet} ft over ${allowances.length} entr(y/ies):`)
  for (const va of allowances) console.error(`  ${va.label}: ${va.count} × ${va.feetEach} ft ${va.size ?? ''} ${va.system} — ${va.source}`)
  for (const fr of ex.fittingRows) console.error(`  fittings allowance: ${fr.size ?? ''} ${fr.system} ${fr.kind} × ${fr.count}`)
}
// Developed length (BT-2 doctrine): drawn plan feet are projected feet; estimators
// price developed feet. manifest.developedLength = [{ system, factor, source }] —
// factors scale drawn feet inside the tooling rows; the itemization prints here so
// the reviewer sees exactly what was scaled and why. Systems without a factor are
// carried as-is and say so.
const developedLength: DevelopedLengthFactor[] = manifest.developedLength ?? []
if (developedLength.length) {
  console.error('developed-length factors (drawn → developed, allowances ride unscaled):')
  for (const r of developedFeetBySystem(takeoff, developedLength)) {
    console.error(`  ${r.system}: ${r.drawnFeet} ft × ${r.factor} = ${r.developedFeet} ft — ${r.source}`)
  }
}
// The paste-ready /Tooling block (estimate view: drawn + allowances, size-split).
const toolingRows = buildToolingRows(takeoff, { fittings, allowances, developedLength })
const out = args[1]
const json = JSON.stringify(takeoff, null, 2)
if (out) {
  writeFileSync(out, json)
  console.error(`wrote ${out}`)
  const planPage = manifest.toolingPlanPage != null ? `\t${manifest.toolingPlanPage}` : ''
  const toolingText = toolingRows.map((r) => `${r.fixture}\t${r.count}${planPage}`).join('\n')
  writeFileSync(out.replace(/\.json$/, '') + '.tooling.txt', toolingText + '\n')
  console.error(`wrote ${out.replace(/\.json$/, '')}.tooling.txt (${toolingRows.length} paste rows — drawn + allowances)`)
} else {
  console.log(json)
}
