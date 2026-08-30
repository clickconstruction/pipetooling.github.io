/**
 * Registration gate (owner rule, 2026-08-30): the trace must sit ON the drawing.
 * Renders each traced page to grayscale (pdftoppm PGM) at the lines' own DPI and scores
 * every run's samples against the ink (src/lib/takeoffPlacement registrationScore).
 * A run under the threshold fails loudly with its worst floating gap located in RAW px
 * — recrop there, fix the vertices, run again.
 *
 *   npx vite-node scripts/placement-engine/registration.ts -- <manifest.json> <plans.pdf> [minPct=85]
 *
 * Lines only: fixture marks aim at symbol CENTERS (often blank inside an outline), so
 * mark registration would false-flag — placements are covered by the visual re-crop
 * rule in PLACEMENT.md instead.
 */
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { registrationScore } from '../../src/lib/takeoffPlacement'

const args = process.argv.slice(2).filter((a) => a !== '--')
const [manifestPath, pdfPath] = args
const minPct = Number(args[2] ?? 85)
if (!manifestPath || !pdfPath) {
  console.error('usage: npx vite-node scripts/placement-engine/registration.ts -- <manifest.json> <plans.pdf> [minPct=85]')
  process.exit(2)
}

type Line = { lineTypeId: string; pageIndex: number; dpi: number; points: Array<{ x: number; y: number }>; minPct?: number }
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { lines?: Line[]; lineTypes?: Array<{ id: string; name: string }> }
const lines = manifest.lines ?? []
if (!lines.length) {
  console.error('manifest has no lines — nothing to register')
  process.exit(0)
}
const nameById = new Map((manifest.lineTypes ?? []).map((lt) => [lt.id, lt.name]))

function loadPgm(page: number, dpi: number): { w: number; h: number; data: Buffer } {
  const dir = mkdtempSync(join(tmpdir(), 'reg-'))
  try {
    const res = spawnSync('pdftoppm', ['-gray', '-r', String(dpi), '-f', String(page), '-l', String(page), pdfPath, join(dir, 'p')])
    if (res.status !== 0) throw new Error(`pdftoppm failed: ${res.stderr}`)
    const file = join(dir, `p-${String(page).padStart(2, '0')}.pgm`)
    let buf: Buffer
    try {
      buf = readFileSync(file)
    } catch {
      buf = readFileSync(join(dir, `p-${page}.pgm`))
    }
    // P5 header: magic, width height, maxval, then raw bytes. pdftoppm emits no comments.
    const header = buf.subarray(0, 64).toString('ascii')
    const m = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(header)
    if (!m) throw new Error('not a P5 PGM')
    const offset = m[0]!.length
    return { w: Number(m[1]), h: Number(m[2]), data: buf.subarray(offset) }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const INK = 160 // gray value below this counts as ink (plan linework is near-black; walls are light gray)
const TOL = 3 // window radius in px at the line's DPI

const byPage = new Map<string, Line[]>()
for (const l of lines) {
  const key = `${l.pageIndex}:${l.dpi}`
  const list = byPage.get(key) ?? []
  list.push(l)
  byPage.set(key, list)
}

let failures = 0
for (const [key, group] of byPage) {
  const [pageIndex, dpi] = key.split(':').map(Number) as [number, number]
  const img = loadPgm(pageIndex + 1, dpi) // manifest pageIndex is 0-based; pdftoppm is 1-based
  const isInk = (p: { x: number; y: number }): boolean => {
    const cx = Math.round(p.x)
    const cy = Math.round(p.y)
    for (let dy = -TOL; dy <= TOL; dy++) {
      const y = cy + dy
      if (y < 0 || y >= img.h) continue
      for (let dx = -TOL; dx <= TOL; dx++) {
        const x = cx + dx
        if (x < 0 || x >= img.w) continue
        if (img.data[y * img.w + x]! < INK) return true
      }
    }
    return false
  }
  console.error(`page ${pageIndex} @${dpi}dpi (±${TOL}px window):`)
  for (const l of group) {
    const r = registrationScore(l.points, isInk, 4)
    const name = nameById.get(l.lineTypeId) ?? l.lineTypeId
    // Dash-broken styles cap below solid duty — a run may carry its own honest bar
    // (e.g. 30 for a 42%-duty dash-dot), declared in the manifest, visible here.
    const bar = l.minPct ?? minPct
    const ok = r.pct >= bar
    if (!ok) failures++
    const gap = r.worstGap
      ? ` worst gap ${r.worstGap.samples} samples from (${Math.round(r.worstGap.from.x)},${Math.round(r.worstGap.from.y)}) to (${Math.round(r.worstGap.to.x)},${Math.round(r.worstGap.to.y)})`
      : ''
    console.error(`  ${ok ? '✓' : '✗'} ${name}${l.minPct != null ? ` [bar ${l.minPct}%]` : ''} [${l.points.map((p) => `(${Math.round(p.x)},${Math.round(p.y)})`).join('→')}]: ${r.pct}% on-ink (${r.onInk}/${r.samples})${ok ? '' : gap}`)
  }
}
if (failures) {
  console.error(`${failures} run(s) under ${minPct}% — the trace is floating off the drawing. Recrop the worst gaps, fix vertices, rerun.`)
  process.exit(1)
}
console.error(`registration clean: every run ≥ ${minPct}% on-ink ✓`)
