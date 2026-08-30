/**
 * Vertex snap pass (registration's partner, 2026-08-30): pulls every traced line vertex
 * onto the nearest plan ink within a search radius — the mechanical half of "the trace
 * must sit ON the drawing". A vertex with no ink in reach is left alone and reported
 * (that's a missing-jog or wrong-path problem snapping can't fix — recrop there).
 *
 *   npx vite-node scripts/placement-engine/snap.ts -- <manifest.json> [radiusPx=12]
 *
 * Rewrites the manifest's line points in place (backs up nothing — manifests live in
 * scratch and regenerate). Run registration.ts after; iterate until clean.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2).filter((a) => a !== '--')
const [manifestPath, pdfPath] = args
const RADIUS = Number(args[2] ?? 12)
if (!manifestPath || !pdfPath) {
  console.error('usage: npx vite-node scripts/placement-engine/snap.ts -- <manifest.json> <plans.pdf> [radiusPx=12]')
  process.exit(2)
}

type Pt = { x: number; y: number }
type Line = { lineTypeId: string; pageIndex: number; dpi: number; points: Pt[] }
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { lines?: Line[] }
const lines = manifest.lines ?? []
if (!lines.length) {
  console.error('no lines to snap')
  process.exit(0)
}

const INK = 160

function loadPgm(page: number, dpi: number): { w: number; h: number; data: Buffer } {
  const dir = mkdtempSync(join(tmpdir(), 'snap-'))
  try {
    const res = spawnSync('pdftoppm', ['-gray', '-r', String(dpi), '-f', String(page), '-l', String(page), pdfPath, join(dir, 'p')])
    if (res.status !== 0) throw new Error(`pdftoppm failed: ${res.stderr}`)
    let buf: Buffer
    try {
      buf = readFileSync(join(dir, `p-${String(page).padStart(2, '0')}.pgm`))
    } catch {
      buf = readFileSync(join(dir, `p-${page}.pgm`))
    }
    const m = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(buf.subarray(0, 64).toString('ascii'))
    if (!m) throw new Error('not a P5 PGM')
    return { w: Number(m[1]), h: Number(m[2]), data: buf.subarray(m[0].length) }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const byPage = new Map<string, Line[]>()
for (const l of lines) {
  const key = `${l.pageIndex}:${l.dpi}`
  ;(byPage.get(key) ?? byPage.set(key, []).get(key)!).push(l)
}

let moved = 0
let stuck = 0
for (const [key, group] of byPage) {
  const [pageIndex, dpi] = key.split(':').map(Number) as [number, number]
  const img = loadPgm(pageIndex + 1, dpi)
  const nearestInk = (p: Pt): Pt | null => {
    const cx = Math.round(p.x)
    const cy = Math.round(p.y)
    let best: { d: number; x: number; y: number } | null = null
    for (let dy = -RADIUS; dy <= RADIUS; dy++) {
      const y = cy + dy
      if (y < 0 || y >= img.h) continue
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        const x = cx + dx
        if (x < 0 || x >= img.w) continue
        if (img.data[y * img.w + x]! < INK) {
          const d = dx * dx + dy * dy
          if (!best || d < best.d) best = { d, x, y }
        }
      }
    }
    return best ? { x: best.x, y: best.y } : null
  }
  for (const l of group) {
    for (let i = 0; i < l.points.length; i++) {
      const p = l.points[i]!
      const snapped = nearestInk(p)
      if (!snapped) {
        stuck++
        console.error(`  ⚠ page ${pageIndex}: no ink within ${RADIUS}px of (${Math.round(p.x)},${Math.round(p.y)}) — recrop; snapping can't invent a path`)
        continue
      }
      if (snapped.x !== Math.round(p.x) || snapped.y !== Math.round(p.y)) moved++
      l.points[i] = snapped
    }
  }
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1))
console.error(`snapped ${moved} vertex(es); ${stuck} had no ink in reach. Manifest updated — run registration.ts next.`)
