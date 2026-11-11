/**
 * Cards and footers (punch list #313) — the parts, and one drawing from a layout and a person.
 *
 * `drawKit(layout, person, opts)` returns one SVG string. Shapes are vectors and words are live
 * type in the brand's font. Pure: no DOM. The caller hands in the pictures (the mark, the pipe
 * photo behind the card front, the person's photo) as addresses, and may hand in `measure`, a
 * function that says how wide a line of words is in the real font, so a long name shrinks to
 * fit. Without it a per-letter guess stands in, which is what the tests use.
 */
import { BRAND, CAP_HEIGHT, CARD, type KitAsset, type KitPoint, type KitColour, type KitIcon, type KitLayout, type KitPipe, type KitRow, type KitWords } from './layouts'

/** The photo in its ring: `fx` and `fy` name the point of the picture that sits in the middle of the ring (0 to 1); zoom 1 just covers the ring. */
export type KitPhoto = { href: string; w: number; h: number; fx: number; fy: number; zoom: number }

export type KitPerson = {
  name?: string | null
  title?: string | null
  email?: string | null
  mobile?: string | null
  office?: string | null
  license?: string | null
  photo?: KitPhoto | null
}

export type KitDrawOptions = {
  /** Where each picture lives: an address or a data URI. */
  assets?: Partial<Record<KitAsset, string>>
  /** The width of a line in the brand's font, in the units of `size`. */
  measure?: (text: string, weight: number, size: number) => number
  /** The cut line and the safe margin, drawn over a card. */
  guides?: boolean
  width?: number
  /** Keeps two drawings on one page from sharing a clip id. */
  id?: string
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function num(n: number): number {
  return +n.toFixed(2)
}

function colourOf(name: KitColour, layout?: KitLayout): string {
  return name === 'orange' ? (layout?.orange ?? BRAND.orange) : BRAND.white
}

/** A per-letter guess at a line's width, for when no real measure is on hand. */
export function guessTextWidth(text: string, weight: number, size: number): number {
  return text.length * size * (weight >= 600 ? 0.62 : 0.56)
}

/** The size a line is set at: its own, or smaller when it would run past `maxWidth`. Never under 55% of its own. */
export function fitSize(text: string, weight: number, size: number, maxWidth: number, measure = guessTextWidth): number {
  const w = measure(text, weight, size)
  return w <= maxWidth ? size : Math.max(size * 0.55, (size * maxWidth) / w)
}

type LineStyle = Pick<KitRow, 'weight' | 'size' | 'tracking' | 'colour' | 'opacity' | 'fit'>

function textLine(text: string, x: number, y: number, row: LineStyle, layout: KitLayout | undefined, opts: KitDrawOptions): string {
  const weight = BRAND.weights[row.weight]
  const tracking = row.tracking ?? 0
  const size = row.fit ? fitSize(text, weight, row.size, row.fit - tracking * text.length, opts.measure).toFixed(1) : String(row.size)
  return (
    `<text x="${num(x)}" y="${num(y)}" font-family="${BRAND.font}" font-weight="${weight}" font-size="${size}"` +
    (tracking ? ` letter-spacing="${tracking}"` : '') +
    (row.opacity ? ` opacity="${row.opacity}"` : '') +
    ` fill="${colourOf(row.colour, layout)}">${esc(text)}</text>`
  )
}

function unit(from: KitPoint, to: KitPoint): KitPoint {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  return [dx / len, dy / len]
}

/** The path of a pipe run: straights joined by a bend at each inner point. */
export function pipePath(p: KitPipe): string {
  const pts = p.points
  const first = pts[0]!
  let d = `M${first[0]} ${first[1]}`
  for (let i = 1; i < pts.length; i++) {
    const bend = i < pts.length - 1 ? p.bends?.[i - 1] : undefined
    const c = pts[i]!
    if (!bend) {
      d += ` L${c[0]} ${c[1]}`
      continue
    }
    const a = unit(pts[i - 1]!, c)
    const b = unit(c, pts[i + 1]!)
    d +=
      ` L${num(c[0] - a[0] * bend.from)} ${num(c[1] - a[1] * bend.from)}` +
      ` C${num(c[0] - a[0] * bend.ease[0])} ${num(c[1] - a[1] * bend.ease[0])}` +
      ` ${num(c[0] + b[0] * bend.ease[1])} ${num(c[1] + b[1] * bend.ease[1])}` +
      ` ${num(c[0] + b[0] * bend.to)} ${num(c[1] + b[1] * bend.to)}`
  }
  return d
}

function pipe(p: KitPipe, layout: KitLayout): string {
  const o = colourOf('orange', layout)
  let out = `<path d="${pipePath(p)}" fill="none" stroke="${o}" stroke-width="${p.width}"/>`
  for (const k of p.couplings ?? []) {
    out += `<rect x="${k[0] - k[2] / 2}" y="${k[1] - k[3] / 2}" width="${k[2]}" height="${k[3]}" rx="${Math.min(k[2], k[3]) / 2}" fill="${o}"/>`
  }
  return out
}

function logo(at: { x: number; y: number; scale: number }, opts: KitDrawOptions): string {
  const m = BRAND.mark
  let out = `<g transform="translate(${at.x} ${at.y}) scale(${at.scale})">`
  const href = opts.assets?.mark
  if (href) out += `<image href="${esc(href)}" width="${m.width}" height="${m.height}" preserveAspectRatio="none"/>`
  for (const w of BRAND.wordmark) {
    out += textLine(w.text, w.x, w.y, { weight: w.weight, size: w.size, tracking: w.tracking, colour: 'white' }, undefined, opts)
  }
  return out + '</g>'
}

/** Where a photo sits so the ring is covered: the picture's left, top, width and height, with the focus point as near the ring's middle as the picture's edges allow. */
export function placePhoto(photo: Pick<KitPhoto, 'w' | 'h' | 'fx' | 'fy' | 'zoom'>, cx: number, cy: number, r: number): { x: number; y: number; w: number; h: number } {
  const zoom = Math.max(1, photo.zoom || 1)
  const s = ((2 * r) / Math.min(photo.w, photo.h)) * zoom
  const w = photo.w * s
  const h = photo.h * s
  const x = Math.min(cx - r, Math.max(cx + r - w, cx - photo.fx * w))
  const y = Math.min(cy - r, Math.max(cy + r - h, cy - photo.fy * h))
  return { x, y, w, h }
}

function ringPhoto(photo: KitPhoto | null | undefined, r: NonNullable<KitLayout['ring']>, layout: KitLayout, id: string): string {
  const { cx, cy } = r
  let out = `<circle cx="${cx}" cy="${cy}" r="${r.ring}" fill="${colourOf('orange', layout)}"/>`
  if (!photo?.href) {
    return (
      out +
      `<circle cx="${cx}" cy="${cy}" r="${r.photo}" fill="#2b2f33"/>` +
      `<text x="${cx}" y="${num(cy + r.photo * 0.12)}" text-anchor="middle" font-family="${BRAND.font}" font-weight="300" font-size="${num(r.photo * 0.3)}" fill="#9aa0a6">No photo yet</text>`
    )
  }
  const at = placePhoto(photo, cx, cy, r.photo)
  out += `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r.photo}"/></clipPath>`
  out += `<image href="${esc(photo.href)}" x="${at.x.toFixed(1)}" y="${at.y.toFixed(1)}" width="${at.w.toFixed(1)}" height="${at.h.toFixed(1)}" preserveAspectRatio="none" clip-path="url(#${id})"/>`
  return out
}

/** The small marks beside a contact line, each in a 48 x 48 box. Drawn by hand in the designer's manner; the badge is for a line the designer never drew. */
const ICONS: Record<KitIcon, string> = {
  email: '<path d="M4 12h40v24H4z" fill="currentColor"/><path d="M4 12l20 14 20-14" fill="none" stroke="#050708" stroke-width="3.2" stroke-linejoin="round"/>',
  mobile: '<rect x="13.5" y="4" width="21" height="40" rx="3" fill="none" stroke="currentColor" stroke-width="3.8"/><path d="M8.5 17.5q-3 6.5 0 13M3.5 15.5q-4 8.5 0 17M39.5 17.5q3 6.5 0 13M44.5 15.5q4 8.5 0 17" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  license: '<path d="M24 4l15 6v11c0 10-6.500 17.500-15 22-8.500-4.500-15-12-15-22V10z" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linejoin="round"/><path d="M17 23l5 5 9-10" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>',
  office: '<g transform="translate(-1 3) scale(1.08)"><path d="M10 6c-3 1-5 4-4 9 2 12 10 22 21 27 4 2 8 1 10-2l2-4c1-2 0-3-1-4l-7-4c-1-1-3 0-4 1l-2 2c-4-2-8-6-10-11l2-2c1-1 2-3 1-4L14 7c-1-1-3-2-4-1z" fill="currentColor"/></g><path d="M27 20q4.500 1 5.500 6M29 13.500q8.500 2 10.500 11.500M31 7q12.500 3 15.500 17.500" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
}

function icon(kind: KitIcon, x: number, y: number, size: number, colour: string): string {
  return `<svg x="${x}" y="${num(y)}" width="${size}" height="${size}" viewBox="0 0 48 48" color="${colour}">${ICONS[kind]}</svg>`
}

/** Where each row of the stack sits: the rows a person has, top down, with the baseline of each. */
export function placeRows(block: KitWords, person: KitPerson): { row: KitRow; text: string; y: number }[] {
  const placed: { row: KitRow; text: string; y: number }[] = []
  let y = block.start ?? 0
  let last: string | null = null
  let lines = 0
  for (const row of block.rows) {
    const text = (person[row.fact] || (row.or ? person[row.or] : '') || '').trim()
    if (!text) continue
    if (last) {
      if (row.icon) {
        const steps = block.lineSteps ?? [0]
        y += lines === 0 ? (last === 'title' ? (block.firstLine?.afterTitle ?? 0) : (block.firstLine?.afterName ?? 0)) : (steps[Math.min(lines - 1, steps.length - 1)] ?? 0)
      } else {
        y += row.advanceAfter?.[last as keyof typeof row.advanceAfter] ?? row.advance ?? 0
      }
    }
    if (row.icon) lines++
    placed.push({ row, text, y })
    last = row.fact
  }
  if (block.centre != null && placed.length) {
    // from the top of the first row's capitals to the last row's baseline
    const first = placed[0]!
    const top = first.y - CAP_HEIGHT * first.row.size
    const bottom = placed[placed.length - 1]!.y
    let shift = block.centre - (top + bottom) / 2
    if (block.floor != null && bottom + shift > block.floor) shift = block.floor - bottom
    for (const q of placed) q.y += shift
  }
  return placed
}

function words(block: KitWords, person: KitPerson, layout: KitLayout, opts: KitDrawOptions): string {
  let out = ''
  for (const q of placeRows(block, person)) {
    if (q.row.icon && block.icons) {
      const ic = block.icons
      out += icon(q.row.icon, ic.x, q.y - (q.row.rise ?? ic.rise), ic.size, colourOf('orange', layout))
      out += textLine(q.text, ic.textX + (q.row.dx ?? 0), q.y, q.row, layout, opts)
    } else {
      out += textLine(q.text, q.row.x ?? block.x, q.y, q.row, layout, opts)
    }
  }
  return out
}

/** Trim (where the knife cuts) and safe (nothing that matters goes outside it). */
function guides(): string {
  const b = CARD.bleed
  const s = CARD.bleed + CARD.safe
  return (
    `<rect x="${b}" y="${b}" width="${CARD.w - 2 * b}" height="${CARD.h - 2 * b}" fill="none" stroke="#22d3ee" stroke-width="2" stroke-dasharray="10 8"/>` +
    `<rect x="${s}" y="${s}" width="${CARD.w - 2 * s}" height="${CARD.h - 2 * s}" fill="none" stroke="#a3e635" stroke-width="2" stroke-dasharray="4 8"/>`
  )
}

let clipSeq = 0

/** One drawing from a layout and a person, as an SVG string. */
export function drawKit(layout: KitLayout, person: KitPerson | null, opts: KitDrawOptions = {}): string {
  const who = person ?? {}
  const [W, H] = layout.size
  let body = `<rect width="${W}" height="${H}" fill="${layout.ground}"/>`
  const under = layout.photo ? opts.assets?.[layout.photo] : undefined
  if (under) body += `<image href="${esc(under)}" width="${W}" height="${H}" preserveAspectRatio="none"/>`
  for (const p of layout.panels ?? []) body += `<polygon points="${p.points.map((q) => `${q[0]},${q[1]}`).join(' ')}" fill="${colourOf(p.colour, layout)}"/>`
  for (const p of layout.pipes ?? []) body += pipe(p, layout)
  if (layout.logo) body += logo(layout.logo, opts)
  if (layout.ring) body += ringPhoto(who.photo, layout.ring, layout, opts.id ?? `kit-ring-${++clipSeq}`)
  if (layout.words) body += words(layout.words, who, layout, opts)
  if (opts.guides) body += guides()
  const label = who.name ? `${esc(who.name)}, Click Plumbing` : 'Click Plumbing'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${opts.width ?? W}" role="img" aria-label="${label}">${body}</svg>`
}

function inner(svg: string): string {
  return svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
}

/** One card side on its own page with crop marks: what a print shop takes. The page is the bleed box plus a quarter inch for the marks, 4.25 x 2.75 in. */
export function printPage(cardSvg: string): string {
  const m = 75
  const W = CARD.w + 2 * m
  const H = CARD.h + 2 * m
  const b = CARD.bleed
  const len = 45
  const gap = 12
  const x0 = m + b
  const x1 = m + CARD.w - b
  const y0 = m + b
  const y1 = m + CARD.h - b
  let marks = ''
  const corners: [number, number, number, number][] = [[x0, y0, -1, -1], [x1, y0, 1, -1], [x0, y1, -1, 1], [x1, y1, 1, 1]]
  for (const [x, y, dx, dy] of corners) {
    marks += `<path d="M${x} ${y + dy * (b + gap)}v${dy * len}M${x + dx * (b + gap)} ${y}h${dx * len}" stroke="#000" stroke-width="1.5" fill="none"/>`
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Card with crop marks">` +
    `<rect width="${W}" height="${H}" fill="#ffffff"/>` +
    `<svg x="${m}" y="${m}" width="${CARD.w}" height="${CARD.h}" viewBox="0 0 ${CARD.w} ${CARD.h}">${inner(cardSvg)}</svg>${marks}</svg>`
  )
}

/** Ten to a letter page for the office printer: two across, five down, each 3.5 x 2 in, the way card stock is scored. The bleed is cropped off. */
export function sheetOfTen(cardSvg: string): string {
  const W = 2550
  const H = 3300
  const cw = 1050
  const ch = 600
  const left = 225
  const top = 150
  const core = inner(cardSvg)
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ten cards on a letter page"><rect width="${W}" height="${H}" fill="#ffffff"/>`
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 2; c++) {
      out += `<svg x="${left + c * cw}" y="${top + r * ch}" width="${cw}" height="${ch}" viewBox="${CARD.bleed} ${CARD.bleed} ${cw} ${ch}">${core}</svg>`
    }
  }
  for (let i = 0; i <= 5; i++) out += `<path d="M150 ${top + i * ch}h50M2350 ${top + i * ch}h50" stroke="#000" stroke-width="1.5"/>`
  for (let j = 0; j <= 2; j++) out += `<path d="M${left + j * cw} 75v50M${left + j * cw} 3175v50" stroke="#000" stroke-width="1.5"/>`
  return out + '</svg>'
}
