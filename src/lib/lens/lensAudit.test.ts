// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { auditBadges, auditFrame, composite, contrastRatio, over, parseRgb, svgGrounds, svgPaint, worstGround, type LensAudit, type Rgba, type SvgHit } from './lensAudit'

const rgb = (r: number, g: number, b: number, a = 1): Rgba => ({ r, g, b, a })
const CARD = rgb(31, 41, 55)
const TINT = rgb(191, 219, 254)
const WHITE = rgb(255, 255, 255)
const CLEAN: LensAudit = { sideways: null, lowContrast: [], overlaps: [], brokenImages: [], errors: [] }

describe('the lens audit · the contrast arithmetic', () => {
  it('reads rgb and rgba, and lays a translucent color over its background', () => {
    expect(parseRgb('rgb(17, 24, 39)')).toEqual({ r: 17, g: 24, b: 39, a: 1 })
    expect(parseRgb('rgba(0, 0, 0, 0.5)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 })
    expect(parseRgb('transparent')).toBeNull()
    expect(over({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 255, g: 255, b: 255, a: 1 })).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 })
  })

  it('gives the WCAG ratio: black on white is 21 to 1, the dark theme\'s faint grey on its card under 3', () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 })).toBeCloseTo(21, 5)
    expect(contrastRatio({ r: 75, g: 85, b: 99, a: 1 }, { r: 31, g: 41, b: 55, a: 1 })).toBeLessThan(3)
  })
})

describe('the lens audit · a frame\'s document', () => {
  it('finds text under the floor against the background it sits on, once each, and skips the lens mark', () => {
    document.body.innerHTML = `
      <div style="background-color: rgb(31, 41, 55)">
        <span style="color: rgb(75, 85, 99)">7 am</span>
        <span style="color: rgb(75, 85, 99)">7 am</span>
        <span style="color: rgb(243, 244, 246)">Calendar</span>
      </div>
      <div data-lens-mark style="color: rgb(200, 200, 200)">Lens · invented data</div>`
    const a = auditFrame(window, { measure: false })
    expect(a.lowContrast).toHaveLength(1)
    expect(a.lowContrast[0]).toMatchObject({ text: '7 am', bg: 'rgb(31, 41, 55)' })
    expect(a.sideways).toBeNull()
  })

  it('reads the errors the seal kept, and turns the audit into badges', () => {
    document.body.innerHTML = '<p style="color: rgb(0, 0, 0)">Fine</p>'
    ;(window as Window & { __lens?: unknown }).__lens = { config: { as: 'estimator', mood: 'error', theme: 'light' }, asks: [], errors: ['Unhandled: Failed to load team labor crew days'] }
    const a = auditFrame(window, { measure: false })
    expect(a.errors).toEqual(['Unhandled: Failed to load team labor crew days'])
    expect(auditBadges(a)).toEqual([{ tone: 'bad', text: '1 error' }])
    expect(auditBadges(CLEAN)).toEqual([{ tone: 'ok', text: 'Clean' }])
    expect(auditBadges({ ...CLEAN, sideways: { scrollWidth: 540, clientWidth: 375 } })).toEqual([{ tone: 'bad', text: 'Scrolls sideways: 540 px in 375' }])
    expect(auditBadges({ ...CLEAN, overlaps: [{ text: '6 in above the roof', by: 'line' }] })).toEqual([{ tone: 'bad', text: '1 text overlapped' }])
  })

  it('measures a lone character, a 0 or a ✓, as any other text', () => {
    ;(window as Window & { __lens?: unknown }).__lens = undefined
    document.body.innerHTML = `
      <div style="background-color: rgb(31, 41, 55)">
        <span style="color: rgb(21, 128, 61)">0</span>
        <span style="color: rgb(243, 244, 246)">✓</span>
      </div>`
    const a = auditFrame(window, { measure: false })
    expect(a.lowContrast.map((c) => c.text)).toEqual(['0'])
  })
})

describe('the lens audit · a drawing\'s words, the arithmetic', () => {
  it('reads a computed paint: none and a transparent hit area paint nothing, a gradient or a pattern is unknowable', () => {
    expect(svgPaint('none', 1)).toBe('none')
    expect(svgPaint('rgba(0, 0, 0, 0)', 1)).toBe('none')
    expect(svgPaint('rgb(255, 0, 0)', 0)).toBe('none')
    expect(svgPaint('rgb(255, 0, 0)', 0.5)).toEqual(rgb(255, 0, 0, 0.5))
    expect(svgPaint('rgba(0, 0, 0, 0.5)', 0.5)).toEqual(rgb(0, 0, 0, 0.25))
    expect(svgPaint('url("#hatch")', 1)).toBeNull()
    expect(svgPaint('url("#fade") rgb(1, 2, 3)', 1)).toBeNull()
  })

  it('composites layers listed top first down to the page, an opaque one hiding all under it', () => {
    expect(composite([], CARD)).toEqual(CARD)
    expect(composite([rgb(0, 0, 0, 0.5)], WHITE)).toEqual(rgb(127.5, 127.5, 127.5))
    expect(composite([rgb(0, 0, 0, 0.5), TINT, WHITE], CARD)).toEqual(over(rgb(0, 0, 0, 0.5), TINT))
  })

  const fill = (shape: number, color: Rgba | null, isOver = false): SvgHit => ({ shape, color, stroke: false, over: isOver })
  const stroke = (shape: number, color: Rgba | null, isOver = false): SvgHit => ({ shape, color, stroke: true, over: isOver })
  const INK = rgb(26, 26, 26)

  it('takes the fills under each point as its ground, down to the page', () => {
    expect(svgGrounds([[], [fill(1, TINT)]], CARD)).toEqual({ grounds: [CARD, TINT], crossed: null })
    expect(svgGrounds([[fill(2, rgb(0, 0, 0, 0.55)), fill(1, TINT)]], CARD).grounds).toEqual([over(rgb(0, 0, 0, 0.55), TINT)])
  })

  it('takes a stroke under every point of the word as the band it sits in: a pipe\'s bore is its ground', () => {
    const bore = [stroke(3, TINT), stroke(2, INK), fill(1, WHITE)]
    expect(svgGrounds([bore, bore, bore], CARD)).toEqual({ grounds: [TINT, TINT, TINT], crossed: null })
  })

  it('calls a stroke under only some points a line across the word, however wide: an overlap, never the ground', () => {
    // A pipe up through the middle of a word: its bore and its dark wall are under the middle points alone.
    const paper = [fill(1, WHITE)]
    const pipe = [stroke(3, TINT), stroke(2, INK), fill(1, WHITE)]
    expect(svgGrounds([paper, pipe, paper], CARD)).toEqual({ grounds: [WHITE, WHITE, WHITE], crossed: 'line' })
  })

  it('calls a shape drawn after the word an overlap, and reads what is under the word', () => {
    expect(svgGrounds([[fill(9, WHITE, true), fill(1, TINT)], [fill(1, TINT)]], CARD)).toEqual({ grounds: [TINT, TINT], crossed: 'shape' })
    expect(svgGrounds([[stroke(9, WHITE, true)], []], CARD)).toEqual({ grounds: [CARD, CARD], crossed: 'line' })
    expect(svgGrounds([[stroke(9, WHITE, true)], [stroke(9, WHITE, true)]], CARD).crossed).toBe('shape')
  })

  it('leaves a point on a gradient or a pattern unread, as a background image is', () => {
    const hatch = [stroke(6, null), fill(1, TINT)]
    expect(svgGrounds([hatch, hatch], CARD)).toEqual({ grounds: [null, null], crossed: null })
    expect(svgGrounds([[fill(1, TINT), fill(0, null)]], CARD).grounds).toEqual([TINT])
  })

  it('keeps the worst point of a word, skipping the points it could not read', () => {
    const ink = WHITE
    const worst = worstGround(ink, [CARD, null, TINT, CARD])
    expect(worst?.ground).toEqual(TINT)
    expect(worst?.ratio).toBeCloseTo(contrastRatio(WHITE, TINT), 5)
    expect(worstGround(rgb(255, 255, 255, 0.5), [CARD])?.ratio).toBeCloseTo(contrastRatio(over(rgb(255, 255, 255, 0.5), CARD), CARD), 5)
    expect(worstGround(ink, [null, null])).toBeNull()
  })
})

describe('the lens audit · a drawing\'s words in a frame', () => {
  type Box = { x: number; y: number; width: number; height: number }
  const identity = (): DOMMatrix => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse: identity }) as unknown as DOMMatrix
  const inside = (b: Box) => (p?: DOMPointInit) => !!p && p.x! >= b.x && p.x! <= b.x + b.width && p.y! >= b.y && p.y! <= b.y + b.height
  /** jsdom draws nothing, so each element is given its box and its hit tests, one user unit to the px. */
  const place = (el: Element | null, box: Box, hit: { fill?: (p?: DOMPointInit) => boolean; stroke?: (p?: DOMPointInit) => boolean } = {}) =>
    Object.assign(el!, { getBBox: () => box, getScreenCTM: identity, isPointInFill: hit.fill ?? inside(box), isPointInStroke: hit.stroke ?? (() => false) })
  const DEFAULTS = { fill: 'rgb(0, 0, 0)', fillOpacity: '1', stroke: 'none', strokeOpacity: '1', strokeWidth: '1px', opacity: '1', visibility: 'visible', display: 'inline', fontSize: '10px', backgroundImage: 'none', backgroundColor: 'rgba(0, 0, 0, 0)', color: 'rgb(0, 0, 0)' }

  it('reads each word by its fill on the shapes under it, reports a line across a word apart, and never reads a drawing by its color', () => {
    ;(window as Window & { __lens?: unknown }).__lens = undefined
    document.body.innerHTML = `
      <div style="background-color: rgb(31, 41, 55)">
        <svg viewBox="0 0 300 200">
          <rect id="tint" />
          <text id="cold">cold</text>
          <text id="ground">ground</text>
          <line id="roof" />
          <text id="roofWords">6 in above the roof</text>
          <path id="bore" />
          <text id="hot">hot</text>
          <text id="under">under</text>
          <rect id="cover" />
          <text id="byColor">by color</text>
          <rect id="paper" />
          <path id="wall" />
          <path id="riser" />
          <text id="psi">50 psi</text>
        </svg>
      </div>`
    const $ = (id: string) => document.getElementById(id)
    const styles = new Map<Element, Partial<typeof DEFAULTS>>([[document.querySelector('svg')!, {}]])
    const style = (id: string, s: Partial<typeof DEFAULTS>) => styles.set($(id)!, s)
    // A light tint, and a white word on it: 1.4:1 on the tint, 14.7:1 on the card around the drawing.
    place($('tint'), { x: 0, y: 0, width: 100, height: 50 })
    style('tint', { fill: 'rgb(191, 219, 254)' })
    place($('cold'), { x: 10, y: 10, width: 40, height: 10 })
    style('cold', { fill: 'rgb(255, 255, 255)' })
    // A grey word on the bare card.
    place($('ground'), { x: 10, y: 60, width: 60, height: 10 })
    style('ground', { fill: 'rgb(75, 85, 99)' })
    // A white line through a white word's 30% height: not its ground, an overlap.
    place($('roof'), { x: 100, y: 113, width: 120, height: 0 }, { fill: () => false, stroke: (p) => !!p && Math.abs(p.y! - 113) <= 0.75 && p.x! >= 100 && p.x! <= 220 })
    style('roof', { fill: 'none', stroke: 'rgb(255, 255, 255)', strokeWidth: '1.5px' })
    place($('roofWords'), { x: 110, y: 110, width: 100, height: 10 })
    style('roofWords', { fill: 'rgb(255, 255, 255)' })
    // A pipe's bore, a stroke 14 wide, under a white word: the bore is the ground.
    place($('bore'), { x: 0, y: 150, width: 100, height: 0 }, { fill: () => false, stroke: (p) => !!p && Math.abs(p.y! - 150) <= 7 })
    style('bore', { fill: 'none', stroke: 'rgb(191, 219, 254)', strokeWidth: '14px' })
    place($('hot'), { x: 20, y: 145, width: 20, height: 10 })
    style('hot', { fill: 'rgb(255, 255, 255)' })
    // A rect drawn after a word, over its right end.
    place($('under'), { x: 150, y: 60, width: 50, height: 10 })
    style('under', { fill: 'rgb(255, 255, 255)' })
    place($('cover'), { x: 185, y: 55, width: 30, height: 20 })
    style('cover', { fill: 'rgb(31, 41, 55)' })
    // A word whose color would fail on the card and whose fill does not.
    place($('byColor'), { x: 150, y: 160, width: 50, height: 10 })
    style('byColor', { fill: 'rgb(243, 244, 246)', color: 'rgb(31, 41, 55)' })
    // A pipe up through the middle of an ink word on white paper: its 9 px dark wall is under the
    // middle points only, so it crosses the word and is never read as the word's ground.
    place($('paper'), { x: 220, y: 50, width: 80, height: 30 })
    style('paper', { fill: 'rgb(255, 255, 255)' })
    place($('wall'), { x: 246, y: 50, width: 0, height: 30 }, { fill: () => false, stroke: (p) => !!p && Math.abs(p.x! - 246) <= 4.5 })
    style('wall', { fill: 'none', stroke: 'rgb(26, 26, 26)', strokeWidth: '9px' })
    place($('riser'), { x: 246, y: 50, width: 0, height: 30 }, { fill: () => false, stroke: (p) => !!p && Math.abs(p.x! - 246) <= 2.8 })
    style('riser', { fill: 'none', stroke: 'rgb(219, 234, 254)', strokeWidth: '5.6px' })
    place($('psi'), { x: 230, y: 60, width: 32, height: 10 })
    style('psi', { fill: 'rgb(26, 26, 26)' })
    const win = { document, getComputedStyle: (el: Element) => (styles.has(el) ? { ...DEFAULTS, ...styles.get(el) } : window.getComputedStyle(el)) } as unknown as Window

    const a = auditFrame(win)
    expect(a.lowContrast).toEqual([
      { ratio: Math.round(contrastRatio(WHITE, TINT) * 100) / 100, text: 'cold', color: 'rgb(255, 255, 255)', bg: 'rgb(191, 219, 254)', fontSize: '10px' },
      { ratio: Math.round(contrastRatio(rgb(75, 85, 99), CARD) * 100) / 100, text: 'ground', color: 'rgb(75, 85, 99)', bg: 'rgb(31, 41, 55)', fontSize: '10px' },
      { ratio: Math.round(contrastRatio(WHITE, TINT) * 100) / 100, text: 'hot', color: 'rgb(255, 255, 255)', bg: 'rgb(191, 219, 254)', fontSize: '10px' },
    ])
    expect(a.overlaps).toEqual([
      { text: '6 in above the roof', by: 'line' },
      { text: 'under', by: 'shape' },
      { text: '50 psi', by: 'line' },
    ])
    expect(auditBadges(a)).toEqual([
      { tone: 'bad', text: '3 texts under 3:1' },
      { tone: 'bad', text: '3 texts overlapped' },
    ])
  })
})
