/**
 * The audits a sealed frame is held to (punch list #194), the same four `scripts/visual-qa.mjs`
 * runs from a terminal, run by the tab inside the frame's own document: text under the contrast
 * floor against its effective background (WCAG; elements on a background image are skipped, the
 * ratio there is unknowable), a page that scrolls sideways, a broken image, and the errors the
 * frame's console and window caught (`window.__lens.errors`, kept by the seal). Pure apart from the
 * window it is handed, and self-contained: the headless sweep transpiles this file alone and runs it
 * in the page.
 *
 * Text is HTML text by its `color`, and an SVG drawing's words by their `fill` on the shapes drawn
 * under them (v2.6137): the training figures read 1.77 to 2.93:1 in dark while a sweep that read only
 * `color` called them clean. A drawing's word is read at six points across its box, against the
 * shapes there composited down to the page, and the worst point is kept. A line across the word is
 * an overlap, reported apart, never its ground.
 */

export type Rgba = { r: number; g: number; b: number; a: number }

/** visual-qa's floor: under 3:1 is far below AA and always a defect, not taste. */
export const LENS_CONTRAST_FLOOR = 3

export type LowContrast = { ratio: number; text: string; color: string; bg: string; fontSize: string }

/** A drawing's word with a line across it, or a shape drawn over part of it. */
export type LensOverlap = { text: string; by: 'line' | 'shape' }

export type LensAudit = {
  sideways: { scrollWidth: number; clientWidth: number } | null
  lowContrast: LowContrast[]
  overlaps: LensOverlap[]
  brokenImages: string[]
  errors: string[]
}

export function parseRgb(s: string | null | undefined): Rgba | null {
  const m = /rgba?\(([^)]+)\)/.exec(s ?? '')
  if (!m) return null
  const p = (m[1] ?? '').split(/[\s,/]+/).filter(Boolean).map((x) => parseFloat(x))
  if (p.length < 3 || p.some((x) => Number.isNaN(x))) return null
  return { r: p[0]!, g: p[1]!, b: p[2]!, a: p.length > 3 ? p[3]! : 1 }
}

export function luminance({ r, g, b }: Rgba): number {
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export function contrastRatio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

/** A translucent color laid over an opaque one. */
export function over(fg: Rgba, bg: Rgba): Rgba {
  if (fg.a >= 1) return fg
  const a = fg.a
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 }
}

/** Layers listed top first, each laid over the ones under it, down to the page. */
export function composite(layers: readonly Rgba[], page: Rgba): Rgba {
  let g = page
  for (let i = layers.length - 1; i >= 0; i--) g = over(layers[i]!, g)
  return g
}

/**
 * A computed SVG paint (`fill` or `stroke`) as a color, its alpha times `opacity`: 'none' when nothing
 * is painted (a transparent hit area counts as none), null for a gradient or a pattern, whose color
 * at a point is unknowable.
 */
export function svgPaint(value: string, opacity: number): Rgba | null | 'none' {
  const v = value.trim()
  if (v === '' || v === 'none') return 'none'
  if (v.startsWith('url(') || v.startsWith('context-')) return null
  const c = parseRgb(v)
  if (!c) return null
  const a = c.a * opacity
  return a > 0 ? { ...c, a } : 'none'
}

/**
 * A paint under one point of a drawing's word, listed top first: a shape's fill or its stroke, `over`
 * when the shape is drawn after the word, on top of it. `shape` tells the shapes apart, so a stroke
 * under every point of the word is known. `color` is null for a gradient or a pattern.
 */
export type SvgHit = { shape: number; color: Rgba | null; stroke: boolean; over: boolean }

/**
 * The ground under each point of a drawing's word: the fills under it, composited down to the page.
 * A stroke under every point of the word is the band the word sits in, a pipe's bore or a bar drawn
 * as a line, and counts as a fill. A stroke under only some of them crosses the word, however wide,
 * and anything drawn after the word covers it: both are overlaps, never the ground. A point on a
 * gradient or a pattern has no ground, unknowable as a background image is.
 */
export function svgGrounds(points: readonly (readonly SvgHit[])[], page: Rgba): { grounds: (Rgba | null)[]; crossed: LensOverlap['by'] | null } {
  const strokeUnder = new Map<number, number>()
  for (const hits of points) {
    for (const shape of new Set(hits.filter((h) => h.stroke).map((h) => h.shape))) strokeUnder.set(shape, (strokeUnder.get(shape) ?? 0) + 1)
  }
  let crossed: LensOverlap['by'] | null = null
  const grounds = points.map((hits) => {
    const layers: Rgba[] = []
    for (const h of hits) {
      const band = h.stroke && strokeUnder.get(h.shape) === points.length
      if (h.over || (h.stroke && !band)) {
        crossed ??= h.stroke && !band ? 'line' : 'shape'
        continue
      }
      if (!h.color) return null
      layers.push(h.color)
      if (h.color.a >= 1) break
    }
    return composite(layers, page)
  })
  return { grounds, crossed }
}

/** The worst of a word's points: its ink laid over each ground, the lowest ratio kept; null when no point had a ground. */
export function worstGround(ink: Rgba, grounds: readonly (Rgba | null)[]): { ratio: number; ground: Rgba } | null {
  let worst: { ratio: number; ground: Rgba } | null = null
  for (const g of grounds) {
    if (!g) continue
    const ratio = contrastRatio(over(ink, g), g)
    if (!worst || ratio < worst.ratio) worst = { ratio, ground: g }
  }
  return worst
}

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 }

/** The first opaque-enough ancestor's color, or null when an image sits behind the text. */
function effectiveBg(win: Window, el: Element): Rgba | null {
  let node: Element | null = el
  let acc: Rgba | null = null
  while (node) {
    const cs = win.getComputedStyle(node)
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return null
    const c = parseRgb(cs.backgroundColor)
    if (c && c.a > 0) {
      acc = acc ? over(acc, c) : c
      if (c.a >= 1) return acc
    }
    node = node.parentElement
  }
  return acc && acc.a >= 1 ? acc : WHITE
}

const rgbText = (c: Rgba) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`

const ownText = (el: Element) => Array.from(el.childNodes).filter((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0)

const SVG_NS = 'http://www.w3.org/2000/svg'
const SVG_SHAPES = new Set(['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path'])
const SVG_WORDS = new Set(['text', 'tspan', 'textPath'])
/** Drawn as a box whose colors the lens cannot read: a word over one is not measured there. */
const SVG_OPAQUE_BOXES = new Set(['image', 'use', 'foreignObject'])
/** Never drawn where they sit: not walked. */
const SVG_UNWALKED = new Set(['defs', 'clipPath', 'mask', 'pattern', 'marker', 'symbol', 'linearGradient', 'radialGradient', 'filter', 'title', 'desc', 'metadata', 'style', 'script'])
/** Where a drawing's word is read: three points across its box, at two heights. */
const SVG_POINTS: readonly (readonly [number, number])[] = [[0.15, 0.3], [0.5, 0.3], [0.85, 0.3], [0.15, 0.6], [0.5, 0.6], [0.85, 0.6]]

type Matrix = { a: number; b: number; c: number; d: number; e: number; f: number }
type Point = { x: number; y: number }
const applyMatrix = (m: Matrix, x: number, y: number): Point => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f })
const matrixScale = (m: Matrix) => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c))
const numberOr1 = (s: string) => (Number.isFinite(parseFloat(s)) ? parseFloat(s) : 1)

/** A drawn element of one drawing, in paint order, as the walk reads it once. */
type SvgShape = {
  el: SVGGeometryElement
  at: number
  inv: Matrix
  box: { l: number; t: number; r: number; b: number }
  fill: Rgba | null | 'none'
  stroke: Rgba | null | 'none'
  width: number
  /** An image, a `<use>` or a foreignObject: any point in its box has an unknowable color. */
  opaqueBox: boolean
}

/** A word's box on the page: a point at a fraction of its width and height, its size in px, and the drawing's scale. */
function wordBox(el: Element): { at: (fx: number, fy: number) => Point; width: number; height: number; scale: number } | null {
  try {
    const g = el as SVGGraphicsElement
    const b = g.getBBox()
    const m = g.getScreenCTM()
    if (m && b.width > 0 && b.height > 0) {
      const s = matrixScale(m)
      return { at: (fx, fy) => applyMatrix(m, b.x + fx * b.width, b.y + fy * b.height), width: b.width * s, height: b.height * s, scale: s }
    }
  } catch {
    /* an engine that cannot box this word: its client rect below */
  }
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return null
  return { at: (fx, fy) => ({ x: r.left + fx * r.width, y: r.top + fy * r.height }), width: r.width, height: r.height, scale: 1 }
}

/** A drawing's word as the lens reads it: its ink, its worst point and what crosses it. */
export type SvgWordRead = { el: Element; text: string; color: string; fontSize: string; worst: { ratio: number; ground: Rgba } | null; crossed: LensOverlap['by'] | null }

/**
 * Each word of one drawing, read against the shapes under it; `root` is an outermost `<svg>`. Empty
 * when the drawing sits on a background image. Exported for a sweep that wants every word, not only
 * the ones under the floor.
 */
export function readSvgWords(win: Window, root: Element, measure = true): SvgWordRead[] {
  const page = effectiveBg(win, root)
  if (!page) return []
  const drawn: Element[] = []
  const walk = (el: Element) => {
    for (const c of Array.from(el.children)) {
      if (SVG_OPAQUE_BOXES.has(c.localName)) drawn.push(c)
      else if (!SVG_UNWALKED.has(c.localName)) {
        drawn.push(c)
        walk(c)
      }
    }
  }
  walk(root)
  const opacities = new Map<Element, number>()
  const opacityOf = (el: Element): number => {
    const known = opacities.get(el)
    if (known !== undefined) return known
    const own = numberOr1(win.getComputedStyle(el).opacity)
    const o = el === root || !el.parentElement ? own : own * opacityOf(el.parentElement)
    opacities.set(el, o)
    return o
  }
  const shapes: SvgShape[] = []
  drawn.forEach((el, at) => {
    const opaqueBox = SVG_OPAQUE_BOXES.has(el.localName)
    if (!opaqueBox && !SVG_SHAPES.has(el.localName)) return
    const cs = win.getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') return
    const o = opacityOf(el)
    if (o <= 0) return
    let b: DOMRect
    let ctm: DOMMatrix | null
    try {
      b = (el as SVGGraphicsElement).getBBox()
      ctm = (el as SVGGraphicsElement).getScreenCTM()
    } catch {
      return
    }
    // A shape inside a hidden group boxes to nothing.
    if (!ctm || (b.width === 0 && b.height === 0)) return
    const fill = opaqueBox ? null : svgPaint(cs.fill, numberOr1(cs.fillOpacity) * o)
    const stroke = opaqueBox ? 'none' : svgPaint(cs.stroke, numberOr1(cs.strokeOpacity) * o)
    const width = stroke === 'none' ? 0 : (parseFloat(cs.strokeWidth) || 0) * matrixScale(ctm)
    const pad = width / 2 + 1
    const corners = [applyMatrix(ctm, b.x, b.y), applyMatrix(ctm, b.x + b.width, b.y), applyMatrix(ctm, b.x, b.y + b.height), applyMatrix(ctm, b.x + b.width, b.y + b.height)]
    const xs = corners.map((p) => p.x)
    const ys = corners.map((p) => p.y)
    const box = { l: Math.min(...xs) - pad, t: Math.min(...ys) - pad, r: Math.max(...xs) + pad, b: Math.max(...ys) + pad }
    shapes.push({ el: el as SVGGeometryElement, at, inv: ctm.inverse(), box, fill, stroke, width, opaqueBox })
  })
  const hitsAt = (p: Point, wordAt: number): SvgHit[] => {
    const hits: SvgHit[] = []
    for (let k = shapes.length - 1; k >= 0; k--) {
      const s = shapes[k]!
      if (p.x < s.box.l || p.x > s.box.r || p.y < s.box.t || p.y > s.box.b) continue
      const over = s.at > wordAt
      if (s.opaqueBox) {
        hits.push({ shape: s.at, color: null, stroke: false, over })
        continue
      }
      const local = applyMatrix(s.inv, p.x, p.y)
      if (s.stroke !== 'none' && s.width > 0 && s.el.isPointInStroke(local)) hits.push({ shape: s.at, color: s.stroke, stroke: true, over })
      if (s.fill !== 'none' && s.el.isPointInFill(local)) hits.push({ shape: s.at, color: s.fill, stroke: false, over })
    }
    return hits
  }
  const reads: SvgWordRead[] = []
  drawn.forEach((el, at) => {
    if (!SVG_WORDS.has(el.localName)) return
    const own = ownText(el)
    if (own.length === 0) return
    const cs = win.getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') return
    const ink = svgPaint(cs.fill, numberOr1(cs.fillOpacity) * opacityOf(el))
    if (ink === null || ink === 'none' || ink.a < 0.15) return
    const box = wordBox(el)
    if (!box || (measure && (box.width < 4 || box.height < 4))) return
    const { grounds, crossed } = svgGrounds(SVG_POINTS.map(([fx, fy]) => hitsAt(box.at(fx, fy), at)), page)
    // The size it draws at: the drawing's own units times its scale on the page.
    const size = Math.round((parseFloat(cs.fontSize) || 0) * box.scale * 10) / 10
    reads.push({ el, text: own.map((n) => (n.textContent ?? '').trim()).join(' ').slice(0, 60), color: cs.fill, fontSize: `${size}px`, worst: worstGround(ink, grounds), crossed })
  })
  return reads
}

export function auditFrame(win: Window, opts: { floor?: number; measure?: boolean } = {}): LensAudit {
  const doc = win.document
  const floor = opts.floor ?? LENS_CONTRAST_FLOOR
  const measure = opts.measure ?? true
  const lowContrast: LowContrast[] = []
  const overlaps: LensOverlap[] = []
  const seen = new Set<string>()
  for (const el of Array.from(doc.querySelectorAll('body *'))) {
    // A drawing's words paint by `fill`, not `color`: the SVG walk below reads them.
    if (el.namespaceURI === SVG_NS) continue
    if (el.closest('[data-lens-mark]')) continue
    const own = ownText(el)
    if (own.length === 0) continue
    if (measure) {
      const rect = el.getBoundingClientRect()
      if (rect.width < 4 || rect.height < 4) continue
    }
    const cs = win.getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity || '1') < 0.15) continue
    const bg = effectiveBg(win, el)
    if (!bg) continue
    const fgRaw = parseRgb(cs.color)
    // Words in a transparent ink are a spacer nobody sees, a sort arrow holding its width or a future day's
    // number: not text to read, as a drawing's word in a faint fill is not.
    if (!fgRaw || fgRaw.a < 0.15) continue
    const fg = over(fgRaw, bg)
    const ratio = contrastRatio(fg, bg)
    const text = own.map((n) => (n.textContent ?? '').trim()).join(' ').slice(0, 60)
    const key = `${text}|${cs.color}|${rgbText(bg)}`
    if (seen.has(key)) continue
    seen.add(key)
    if (ratio < floor) lowContrast.push({ ratio: Math.round(ratio * 100) / 100, text, color: cs.color, bg: rgbText(bg), fontSize: cs.fontSize })
  }
  for (const svg of Array.from(doc.querySelectorAll('svg'))) {
    // An outermost drawing only (a nested <svg> is walked with the one around it), and only one with words.
    if (svg.parentElement?.namespaceURI === SVG_NS || svg.closest('[data-lens-mark]') || !svg.querySelector('text')) continue
    for (const w of readSvgWords(win, svg, measure)) {
      if (w.crossed && !seen.has(`overlap|${w.text}`)) {
        seen.add(`overlap|${w.text}`)
        overlaps.push({ text: w.text, by: w.crossed })
      }
      if (!w.worst) continue
      const key = `${w.text}|${w.color}|${rgbText(w.worst.ground)}`
      if (seen.has(key)) continue
      seen.add(key)
      if (w.worst.ratio < floor) lowContrast.push({ ratio: Math.round(w.worst.ratio * 100) / 100, text: w.text, color: w.color, bg: rgbText(w.worst.ground), fontSize: w.fontSize })
    }
  }
  const de = doc.documentElement
  const sideways = measure && de.scrollWidth > de.clientWidth + 2 ? { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth } : null
  const brokenImages = Array.from(doc.images)
    .filter((img) => img.complete && img.naturalWidth === 0 && img.getAttribute('src'))
    .map((img) => (img.getAttribute('src') ?? '').slice(0, 120))
  const errors = [...((win as Window & { __lens?: { errors?: string[] } }).__lens?.errors ?? [])]
  return { sideways, lowContrast, overlaps, brokenImages, errors }
}

/** The audit as badges: what is wrong, or Clean. */
export function auditBadges(a: LensAudit): { tone: 'bad' | 'ok'; text: string }[] {
  const out: { tone: 'bad' | 'ok'; text: string }[] = []
  if (a.sideways) out.push({ tone: 'bad', text: `Scrolls sideways: ${a.sideways.scrollWidth} px in ${a.sideways.clientWidth}` })
  if (a.lowContrast.length > 0) out.push({ tone: 'bad', text: a.lowContrast.length === 1 ? `1 text under ${LENS_CONTRAST_FLOOR}:1` : `${a.lowContrast.length} texts under ${LENS_CONTRAST_FLOOR}:1` })
  if (a.overlaps.length > 0) out.push({ tone: 'bad', text: a.overlaps.length === 1 ? '1 text overlapped' : `${a.overlaps.length} texts overlapped` })
  if (a.brokenImages.length > 0) out.push({ tone: 'bad', text: a.brokenImages.length === 1 ? '1 broken image' : `${a.brokenImages.length} broken images` })
  if (a.errors.length > 0) out.push({ tone: 'bad', text: a.errors.length === 1 ? '1 error' : `${a.errors.length} errors` })
  if (out.length === 0) out.push({ tone: 'ok', text: 'Clean' })
  return out
}
