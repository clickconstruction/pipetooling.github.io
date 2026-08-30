/**
 * Dash-aware line finder (placement engine, 2026-08-30): dashed and dash-dot pipe
 * styles defeat single-row scanlines — the probe lands in a gap and the line "isn't
 * there". This tool integrates ink ALONG the candidate run direction instead: for every
 * perpendicular coordinate in a window, it reports what fraction of the span carries
 * ink within ±1 px. A dash-dot line shows up as a 25–70% fill band at its exact
 * coordinate; solid pipe reads 90%+; background noise reads ~0–5%. Walls are usually
 * light gray and fall under the ink threshold entirely.
 *
 *   npx vite-node scripts/placement-engine/density.ts -- <plans.pdf> <page0> <dpi> \
 *       <h|v> <perpFrom> <perpTo> <alongFrom> <alongTo> [minFillPct=15]
 *
 *   h = hunting raw-HORIZONTAL lines: perp = y range, along = x range.
 *   v = hunting raw-VERTICAL lines:   perp = x range, along = y range.
 *
 * Prints one line per candidate coordinate (grouped into bands), with fill % and the
 * inked sub-span — anchors for follow.ts.
 */
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2).filter((a) => a !== '--')
const [pdfPath, pageArg, dpiArg, axis, pFromArg, pToArg, aFromArg, aToArg] = args
const minFill = Number(args[8] ?? 15)
if (!pdfPath || !axis || !/^[hv]$/.test(axis) || !aToArg) {
  console.error('usage: density.ts -- <plans.pdf> <page0> <dpi> <h|v> <perpFrom> <perpTo> <alongFrom> <alongTo> [minFillPct]')
  process.exit(2)
}
const page0 = Number(pageArg)
const dpi = Number(dpiArg)
const pFrom = Number(pFromArg)
const pTo = Number(pToArg)
const aFrom = Number(aFromArg)
const aTo = Number(aToArg)
const INK = 160

const dir = mkdtempSync(join(tmpdir(), 'density-'))
let img: { w: number; h: number; data: Buffer }
try {
  const res = spawnSync('pdftoppm', ['-gray', '-r', String(dpi), '-f', String(page0 + 1), '-l', String(page0 + 1), pdfPath, join(dir, 'p')])
  if (res.status !== 0) throw new Error(`pdftoppm failed: ${res.stderr}`)
  let buf: Buffer
  try {
    buf = readFileSync(join(dir, `p-${String(page0 + 1).padStart(2, '0')}.pgm`))
  } catch {
    buf = readFileSync(join(dir, `p-${page0 + 1}.pgm`))
  }
  const m = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(buf.subarray(0, 64).toString('ascii'))
  if (!m) throw new Error('not P5')
  img = { w: Number(m[1]), h: Number(m[2]), data: buf.subarray(m[0].length) }
} finally {
  rmSync(dir, { recursive: true, force: true })
}
const px = (x: number, y: number) => (x < 0 || y < 0 || x >= img.w || y >= img.h ? 255 : img.data[y * img.w + x]!)

type Cand = { perp: number; fillPct: number; inkFrom: number; inkTo: number }
const cands: Cand[] = []
for (let p = pFrom; p <= pTo; p++) {
  let inked = 0
  let first = -1
  let last = -1
  for (let a = aFrom; a <= aTo; a++) {
    const dark =
      axis === 'h'
        ? px(a, p - 1) < INK || px(a, p) < INK || px(a, p + 1) < INK
        : px(p - 1, a) < INK || px(p, a) < INK || px(p + 1, a) < INK
    if (dark) {
      inked++
      if (first < 0) first = a
      last = a
    }
  }
  const span = aTo - aFrom + 1
  const fillPct = Math.round((inked / span) * 1000) / 10
  if (fillPct >= minFill) cands.push({ perp: p, fillPct, inkFrom: first, inkTo: last })
}
// Group adjacent candidates into bands; report each band's best row.
let band: Cand[] = []
const flush = () => {
  if (!band.length) return
  const best = band.reduce((a, b) => (b.fillPct > a.fillPct ? b : a))
  console.log(`${axis === 'h' ? 'y' : 'x'}=${best.perp}  fill ${best.fillPct}%  inked ${axis === 'h' ? 'x' : 'y'} ${best.inkFrom}..${best.inkTo}  (band ${band[0]!.perp}..${band[band.length - 1]!.perp})`)
  band = []
}
for (const c of cands) {
  if (band.length && c.perp - band[band.length - 1]!.perp > 2) flush()
  band.push(c)
}
flush()
if (!cands.length) console.error(`no bands ≥ ${minFill}% fill in the window`)
