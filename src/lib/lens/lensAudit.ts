/**
 * The audits a sealed frame is held to (punch list #194), the same four `scripts/visual-qa.mjs`
 * runs from a terminal, run by the tab inside the frame's own document: text under the contrast
 * floor against its effective background (WCAG; elements on a background image are skipped, the
 * ratio there is unknowable), a page that scrolls sideways, a broken image, and the errors the
 * frame's console and window caught (`window.__lens.errors`, kept by the seal). Pure apart from the
 * window it is handed.
 */

export type Rgba = { r: number; g: number; b: number; a: number }

/** visual-qa's floor: under 3:1 is far below AA and always a defect, not taste. */
export const LENS_CONTRAST_FLOOR = 3

export type LowContrast = { ratio: number; text: string; color: string; bg: string; fontSize: string }

export type LensAudit = {
  sideways: { scrollWidth: number; clientWidth: number } | null
  lowContrast: LowContrast[]
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

/** Text the audit measures: two characters or more, or a lone letter or digit (a count's `0`). A lone mark or symbol (`×`, `▾`, `·`) is an icon's glyph, skipped. */
const measurable = (text: string) => text.length > 1 || /^[\p{L}\p{N}]$/u.test(text)

export function auditFrame(win: Window, opts: { floor?: number; measure?: boolean } = {}): LensAudit {
  const doc = win.document
  const floor = opts.floor ?? LENS_CONTRAST_FLOOR
  const measure = opts.measure ?? true
  const lowContrast: LowContrast[] = []
  const seen = new Set<string>()
  for (const el of Array.from(doc.querySelectorAll('body *'))) {
    if (el.closest('[data-lens-mark]')) continue
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && measurable((n.textContent ?? '').trim()))
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
    if (!fgRaw) continue
    const fg = over(fgRaw, bg)
    const ratio = contrastRatio(fg, bg)
    const text = own.map((n) => (n.textContent ?? '').trim()).join(' ').slice(0, 60)
    const key = `${text}|${cs.color}|${rgbText(bg)}`
    if (seen.has(key)) continue
    seen.add(key)
    if (ratio < floor) lowContrast.push({ ratio: Math.round(ratio * 100) / 100, text, color: cs.color, bg: rgbText(bg), fontSize: cs.fontSize })
  }
  const de = doc.documentElement
  const sideways = measure && de.scrollWidth > de.clientWidth + 2 ? { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth } : null
  const brokenImages = Array.from(doc.images)
    .filter((img) => img.complete && img.naturalWidth === 0 && img.getAttribute('src'))
    .map((img) => (img.getAttribute('src') ?? '').slice(0, 120))
  const errors = [...((win as Window & { __lens?: { errors?: string[] } }).__lens?.errors ?? [])]
  return { sideways, lowContrast, brokenImages, errors }
}

/** The audit as badges: what is wrong, or Clean. */
export function auditBadges(a: LensAudit): { tone: 'bad' | 'ok'; text: string }[] {
  const out: { tone: 'bad' | 'ok'; text: string }[] = []
  if (a.sideways) out.push({ tone: 'bad', text: `Scrolls sideways: ${a.sideways.scrollWidth} px in ${a.sideways.clientWidth}` })
  if (a.lowContrast.length > 0) out.push({ tone: 'bad', text: a.lowContrast.length === 1 ? `1 text under ${LENS_CONTRAST_FLOOR}:1` : `${a.lowContrast.length} texts under ${LENS_CONTRAST_FLOOR}:1` })
  if (a.brokenImages.length > 0) out.push({ tone: 'bad', text: a.brokenImages.length === 1 ? '1 broken image' : `${a.brokenImages.length} broken images` })
  if (a.errors.length > 0) out.push({ tone: 'bad', text: a.errors.length === 1 ? '1 error' : `${a.errors.length} errors` })
  if (out.length === 0) out.push({ tone: 'ok', text: 'Clean' })
  return out
}
