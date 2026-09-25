/**
 * The pipe wordmark (v2.3583): a word drawn as letters made of white pipe — the sign-in title's
 * "ClickPlumbing.com", picked by the owner on 2026-09-18 after six mock-up rounds
 * (`to-dos/login-pipe-lettering-before-after.html` is the spec).
 *
 * Geometry on a 100-unit cap height: baseline y = 100, x-height 42, cap 4, descender 124. Each
 * glyph is an advance width and square-cornered polylines (the pipe runs); the stroke is the
 * pipe's diameter. Every polyline end that no other run of the glyph touches is a FREE TIP and
 * gets a flat flange drawn across the pipe — or, where the glyph says so (the i, the period), a
 * short valve stem and a red handwheel. Pure: `buildPipeWord` returns numbers and one path
 * string; `PipeWordmark` draws them.
 */

export type PipePoint = readonly [number, number]
export type PipeGlyph = {
  /** Advance width in glyph units. */
  w: number
  /** Square-cornered pipe runs. */
  lines: readonly (readonly PipePoint[])[]
  /** The free tip that carries a handwheel instead of a flange. */
  wheel?: PipePoint
}

export const PIPE_STROKE = 16
export const PIPE_GAP = 8
/** The one accent: the handwheels. Saturated action color, literal by convention. */
export const PIPE_ACCENT = '#d21f1f'

export const PIPE_GLYPHS: Readonly<Record<string, PipeGlyph>> = {
  C: { w: 74, lines: [[[66, 14], [20, 14], [20, 86], [66, 86]]] },
  P: { w: 70, lines: [[[16, 100], [16, 8], [58, 8], [58, 50], [16, 50]]] },
  l: { w: 30, lines: [[[15, 4], [15, 100]]] },
  i: { w: 30, lines: [[[15, 46], [15, 100]]], wheel: [15, 46] },
  c: { w: 62, lines: [[[56, 44], [18, 44], [18, 92], [56, 92]]] },
  k: { w: 66, lines: [[[16, 4], [16, 100]], [[16, 70], [58, 70]], [[46, 70], [46, 44]], [[58, 70], [58, 100]]] },
  u: { w: 66, lines: [[[16, 42], [16, 92], [56, 92], [56, 42]]] },
  m: { w: 92, lines: [[[16, 100], [16, 44], [80, 44], [80, 100]], [[48, 44], [48, 100]]] },
  b: { w: 66, lines: [[[16, 4], [16, 100]], [[16, 44], [56, 44], [56, 92], [16, 92]]] },
  n: { w: 66, lines: [[[16, 100], [16, 44], [56, 44], [56, 100]]] },
  g: { w: 66, lines: [[[56, 44], [18, 44], [18, 92], [56, 92]], [[56, 42], [56, 120], [22, 120]]] },
  o: { w: 66, lines: [[[18, 44], [56, 44], [56, 92], [18, 92], [18, 44]]] },
  '.': { w: 30, lines: [[[15, 100], [15, 90]]], wheel: [15, 90] },
  ' ': { w: 26, lines: [] },
}

export type PipeTip = { x: number; y: number; /** outward direction, unit vector */ dx: number; dy: number }
export type PipeFlange = { cx: number; cy: number; /** degrees, the outward direction */ angle: number; across: number; thick: number }
export type PipeWheel = {
  stem: { x1: number; y1: number; x2: number; y2: number; width: number }
  cx: number
  cy: number
  r: number
  ring: number
  spoke: number
  hub: number
}
export type PipeWordGeometry = {
  word: string
  stroke: number
  viewBox: { x: number; y: number; w: number; h: number }
  /** Every pipe run, one path. */
  path: string
  flanges: PipeFlange[]
  wheels: PipeWheel[]
}

const sub = (a: PipePoint, b: PipePoint): PipePoint => [a[0] - b[0], a[1] - b[1]]
const len = (v: PipePoint) => Math.hypot(v[0], v[1])
const unit = (v: PipePoint): PipePoint => {
  const l = len(v) || 1
  return [v[0] / l, v[1] / l]
}
function distToSeg(p: PipePoint, a: PipePoint, b: PipePoint): number {
  const ab = sub(b, a)
  const ap = sub(p, a)
  const l2 = ab[0] * ab[0] + ab[1] * ab[1]
  const t = l2 ? Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1]) / l2)) : 0
  return len(sub(p, [a[0] + ab[0] * t, a[1] + ab[1] * t]))
}
const isClosed = (line: readonly PipePoint[]) =>
  line.length > 2 && line[0]![0] === line[line.length - 1]![0] && line[0]![1] === line[line.length - 1]![1]

/** The polyline ends of a glyph that no other run touches (within 0.6 of the stroke). */
export function pipeFreeTips(glyph: PipeGlyph, stroke = PIPE_STROKE): PipeTip[] {
  const tips: PipeTip[] = []
  glyph.lines.forEach((line, li) => {
    if (line.length < 2 || isClosed(line)) return
    // [the end point, its neighbour, the index of the segment that owns the end]
    const ends: Array<[PipePoint, PipePoint, number]> = [
      [line[0]!, line[1]!, 0],
      [line[line.length - 1]!, line[line.length - 2]!, line.length - 2],
    ]
    for (const [pt, nb, own] of ends) {
      // another run, or a non-adjacent segment of the same run (the P's bowl returns onto its own stem)
      const touched = glyph.lines.some((other, oi) => {
        for (let i = 0; i < other.length - 1; i++) {
          if (oi === li && Math.abs(i - own) <= 1) continue
          if (distToSeg(pt, other[i]!, other[i + 1]!) <= stroke * 0.6) return true
        }
        return false
      })
      if (!touched) {
        const d = unit(sub(pt, nb))
        tips.push({ x: pt[0], y: pt[1], dx: d[0], dy: d[1] })
      }
    }
  })
  return tips
}

/** Whether every character of the word has a glyph. */
export function canRenderPipeWord(word: string): boolean {
  return word.length > 0 && [...word].every((ch) => ch in PIPE_GLYPHS)
}

/** The word's geometry, or null when a character has no glyph (the caller falls back to text). */
export function buildPipeWord(word: string, opts: { stroke?: number } = {}): PipeWordGeometry | null {
  if (!canRenderPipeWord(word)) return null
  const S = opts.stroke ?? PIPE_STROKE
  const glyphs = [...word].map((ch) => PIPE_GLYPHS[ch]!)
  const totalW = glyphs.reduce((a, g) => a + g.w + PIPE_GAP, 0) - PIPE_GAP + 28
  const flanges: PipeFlange[] = []
  const wheels: PipeWheel[] = []
  const parts: string[] = []
  let x = 14
  for (const g of glyphs) {
    for (const line of g.lines) parts.push(line.map((p, i) => `${i ? 'L' : 'M'}${p[0] + x} ${p[1]}`).join(' '))
    for (const t of pipeFreeTips(g, S)) {
      const px = t.x + x
      const isWheel = !!g.wheel && g.wheel[0] === t.x && g.wheel[1] === t.y
      if (isWheel) {
        const r = S * 0.95
        const stem = S * 0.85
        const ring = S * 0.42
        const cx = px + t.dx * stem
        const cy = t.y + t.dy * stem
        wheels.push({ stem: { x1: px, y1: t.y, x2: cx, y2: cy, width: S * 0.3 }, cx, cy, r, ring, spoke: ring * 0.7, hub: ring * 0.9 })
      } else {
        const thick = S * 0.45
        flanges.push({
          cx: px - t.dx * thick * 0.5,
          cy: t.y - t.dy * thick * 0.5,
          angle: (Math.atan2(t.dy, t.dx) * 180) / Math.PI,
          across: S * 1.9,
          thick,
        })
      }
    }
    x += g.w + PIPE_GAP
  }
  return { word, stroke: S, viewBox: { x: 0, y: -22, w: totalW, h: 158 }, path: parts.join(' '), flanges, wheels }
}

const fmt = (n: number) => String(Math.round(n * 1000) / 1000)

/**
 * The word as a standalone SVG document (v2.3814) — the same path, flanges and wheels the
 * component draws, in a fixed color instead of `currentColor`, for files under `public/brand/`.
 * Null when a character has no glyph.
 */
export function pipeWordSvg(word: string, opts: { color?: string; accent?: string; width?: number } = {}): string | null {
  const g = buildPipeWord(word)
  if (!g) return null
  const color = opts.color ?? '#ffffff'
  const accent = opts.accent ?? PIPE_ACCENT
  const vb = g.viewBox
  const width = opts.width ?? 1200
  const height = Math.round((width * vb.h) / vb.w)
  const flanges = g.flanges
    .map(
      (f) =>
        `<rect x="${fmt(-f.thick / 2)}" y="${fmt(-f.across / 2)}" width="${fmt(f.thick)}" height="${fmt(f.across)}" rx="2" fill="${color}" transform="translate(${fmt(f.cx)} ${fmt(f.cy)}) rotate(${fmt(f.angle)})"/>`,
    )
    .join('')
  const wheels = g.wheels
    .map(
      (w) =>
        `<g><line x1="${fmt(w.stem.x1)}" y1="${fmt(w.stem.y1)}" x2="${fmt(w.stem.x2)}" y2="${fmt(w.stem.y2)}" stroke="${color}" stroke-width="${fmt(w.stem.width)}"/>` +
        `<circle cx="${fmt(w.cx)}" cy="${fmt(w.cy)}" r="${fmt(w.r)}" fill="none" stroke="${accent}" stroke-width="${fmt(w.ring)}"/>` +
        `<path d="M${fmt(w.cx - w.r)} ${fmt(w.cy)}H${fmt(w.cx + w.r)}M${fmt(w.cx)} ${fmt(w.cy - w.r)}V${fmt(w.cy + w.r)}" stroke="${accent}" stroke-width="${fmt(w.spoke)}"/>` +
        `<circle cx="${fmt(w.cx)}" cy="${fmt(w.cy)}" r="${fmt(w.hub)}" fill="${accent}"/></g>`,
    )
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="${width}" height="${height}" role="img" aria-labelledby="t">` +
    `<title id="t">${word}</title>` +
    `<path d="${g.path}" fill="none" stroke="${color}" stroke-width="${g.stroke}" stroke-linecap="butt" stroke-linejoin="round"/>` +
    flanges +
    wheels +
    `</svg>`
  )
}
