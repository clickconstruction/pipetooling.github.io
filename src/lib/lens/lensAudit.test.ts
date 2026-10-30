// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { auditBadges, auditFrame, contrastRatio, over, parseRgb } from './lensAudit'

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

  it('measures a lone digit or letter: a count\'s 0 in green on the dark card is under the floor, and so is a faint initial', () => {
    document.body.innerHTML = `
      <div style="background-color: rgb(31, 41, 55)">
        <span style="color: rgb(21, 128, 61)">0</span>
        <span style="color: rgb(75, 85, 99)"> T </span>
        <span style="color: rgb(243, 244, 246)">4</span>
      </div>`
    const a = auditFrame(window, { measure: false })
    expect(a.lowContrast.map((c) => c.text)).toEqual(['0', 'T'])
    expect(a.lowContrast[0]).toMatchObject({ ratio: 2.93, color: 'rgb(21, 128, 61)', bg: 'rgb(31, 41, 55)' })
  })

  it('skips a lone mark or symbol, an icon\'s glyph, however faint it reads', () => {
    document.body.innerHTML = `
      <div style="background-color: rgb(31, 41, 55)">
        ${['×', '▾', '·', '✓', '+', '?', '—'].map((g) => `<span style="color: rgb(75, 85, 99)">${g}</span>`).join('')}
        <span style="color: rgb(75, 85, 99)">× 2</span>
      </div>`
    const a = auditFrame(window, { measure: false })
    expect(a.lowContrast.map((c) => c.text)).toEqual(['× 2'])
  })

  it('reads the errors the seal kept, and turns the audit into badges', () => {
    document.body.innerHTML = '<p style="color: rgb(0, 0, 0)">Fine</p>'
    ;(window as Window & { __lens?: unknown }).__lens = { config: { as: 'estimator', mood: 'error', theme: 'light' }, asks: [], errors: ['Unhandled: Failed to load team labor crew days'] }
    const a = auditFrame(window, { measure: false })
    expect(a.errors).toEqual(['Unhandled: Failed to load team labor crew days'])
    expect(auditBadges(a)).toEqual([{ tone: 'bad', text: '1 error' }])
    expect(auditBadges({ sideways: null, lowContrast: [], brokenImages: [], errors: [] })).toEqual([{ tone: 'ok', text: 'Clean' }])
    expect(auditBadges({ sideways: { scrollWidth: 540, clientWidth: 375 }, lowContrast: [], brokenImages: [], errors: [] })).toEqual([{ tone: 'bad', text: 'Scrolls sideways: 540 px in 375' }])
  })
})
