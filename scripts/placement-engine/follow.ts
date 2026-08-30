/**
 * Ink follower (placement engine v1 tracer core, 2026-08-30): walks a drawn line in the
 * rendered page from an anchor point, emitting the ACTUAL path — jogs included — as a
 * compressed vertex list ready for the manifest. The cure for hand-traced straight
 * spines that float off the drawing (registration.ts finds them; this replaces them).
 *
 *   npx vite-node scripts/placement-engine/follow.ts -- <plans.pdf> <page0> <dpi> <x> <y> <h+|h-|v+|v-> [maxSteps=200]
 *
 * Walks in `axis` direction in steps of 4px, at each step searching ±14px
 * perpendicular for ink nearest the previous offset (so it tracks through jogs).
 * Stops after 4 consecutive ink-less steps (run ended or turned hard — restart there
 * with the perpendicular axis). Prints the vertex list (turn points only) as JSON.
 */
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2).filter((a) => a !== '--')
const [pdfPath, pageArg, dpiArg, xArg, yArg, dir] = args
const maxSteps = Number(args[6] ?? 200)
if (!pdfPath || !dir || !/^[hv][+-]$/.test(dir)) {
  console.error('usage: follow.ts -- <plans.pdf> <page0> <dpi> <x> <y> <h+|h-|v+|v-> [maxSteps]')
  process.exit(2)
}
const page0 = Number(pageArg)
const dpi = Number(dpiArg)
const STEP = 4
const PERP = 14
const INK = 160

const dirTmp = mkdtempSync(join(tmpdir(), 'follow-'))
let img: { w: number; h: number; data: Buffer }
try {
  const res = spawnSync('pdftoppm', ['-gray', '-r', String(dpi), '-f', String(page0 + 1), '-l', String(page0 + 1), pdfPath, join(dirTmp, 'p')])
  if (res.status !== 0) throw new Error(`pdftoppm failed: ${res.stderr}`)
  let buf: Buffer
  try {
    buf = readFileSync(join(dirTmp, `p-${String(page0 + 1).padStart(2, '0')}.pgm`))
  } catch {
    buf = readFileSync(join(dirTmp, `p-${page0 + 1}.pgm`))
  }
  const m = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(buf.subarray(0, 64).toString('ascii'))
  if (!m) throw new Error('not P5')
  img = { w: Number(m[1]), h: Number(m[2]), data: buf.subarray(m[0].length) }
} finally {
  rmSync(dirTmp, { recursive: true, force: true })
}
const px = (x: number, y: number) => (x < 0 || y < 0 || x >= img.w || y >= img.h ? 255 : img.data[y * img.w + x]!)

const horizontal = dir[0] === 'h'
const sign = dir[1] === '+' ? 1 : -1
let along = horizontal ? Number(xArg) : Number(yArg)
let perp = horizontal ? Number(yArg) : Number(xArg)

// Seed: snap perp onto ink at the anchor.
{
  let best: number | null = null
  for (let d = 0; d <= PERP; d++) {
    for (const s of d === 0 ? [0] : [-d, d]) {
      const p = perp + s
      const v = horizontal ? px(Math.round(along), Math.round(p)) : px(Math.round(p), Math.round(along))
      if (v < INK) {
        best = p
        break
      }
    }
    if (best !== null) break
  }
  if (best === null) {
    console.error(`no ink at anchor (${xArg},${yArg}) within ${PERP}px`)
    process.exit(1)
  }
  perp = best
}

const path: Array<{ along: number; perp: number }> = [{ along, perp }]
let misses = 0
for (let i = 0; i < maxSteps; i++) {
  const nextAlong = along + sign * STEP
  let found: number | null = null
  for (let d = 0; d <= PERP; d++) {
    for (const s of d === 0 ? [0] : [-d, d]) {
      const p = perp + s
      const v = horizontal ? px(Math.round(nextAlong), Math.round(p)) : px(Math.round(p), Math.round(nextAlong))
      if (v < INK) {
        found = p
        break
      }
    }
    if (found !== null) break
  }
  along = nextAlong
  if (found === null) {
    misses++
    if (misses >= 8) break
    continue
  }
  misses = 0
  perp = found
  path.push({ along, perp })
}

// Compress to turn points: keep vertices where perp shifts (>2px) or at the ends.
const verts: Array<{ x: number; y: number }> = []
const toPt = (e: { along: number; perp: number }) => (horizontal ? { x: e.along, y: e.perp } : { x: e.perp, y: e.along })
for (let i = 0; i < path.length; i++) {
  const e = path[i]!
  const prev = path[i - 1]
  const next = path[i + 1]
  if (!prev || !next || Math.abs(e.perp - prev.perp) > 2 || Math.abs(next.perp - e.perp) > 2) verts.push(toPt(e))
}
if (verts.length < 2) verts.push(toPt(path[path.length - 1]!))
console.log(JSON.stringify(verts))
console.error(`followed ${path.length * STEP}px along ${dir}; ${verts.length} vertices (ended at (${toPt(path[path.length - 1]!).x},${toPt(path[path.length - 1]!).y}))`)
