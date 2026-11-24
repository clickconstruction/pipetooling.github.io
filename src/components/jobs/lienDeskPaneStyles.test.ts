import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LIEN_STRIP_PHONE_H, lienStripChipFit, lienStripLabelStyle, lienStripStyle } from './lienDeskPaneStyles'

/**
 * The pinned strip of a notice pane (punch list #415, loose ends 4 and 6). A layout is a browser's to measure, so this
 * holds the rules the measure rests on: the strip's two shapes, how a chip fits each, and the phone's touch area in
 * `index.css`. Measured on a harness of the real pane: 18 px chips under 44 px touch areas on a 45 px line at 380 px,
 * and at a desk a chip of 560 px wrapped inside a 410 px pane with nothing sliding sideways.
 */
describe('the notice pane\u2019s pinned strip (punch list #415)', () => {
  it('wraps at a desk, and a chip too long for it wraps inside its own shape', () => {
    const desk = lienStripStyle(false)
    expect(desk).toMatchObject({ position: 'sticky', display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.7rem', padding: '0.45rem 1.1rem' })
    expect(desk.overflowX).toBeUndefined()
    expect(desk.height).toBeUndefined()
    // No longer than the strip, and its words break: the path\u2019s next step on a missed notice is a whole sentence.
    expect(lienStripChipFit(false)).toEqual({ whiteSpace: 'normal', maxWidth: '100%', minWidth: 0, textAlign: 'left' })
    expect(lienStripLabelStyle(false)).toEqual({})
  })

  it('is one line that slides sideways on a phone, 44 px over its rule, with nothing wrapping', () => {
    const phone = lienStripStyle(true)
    expect(LIEN_STRIP_PHONE_H).toBe(44)
    expect(phone).toMatchObject({ position: 'sticky', display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', overflowY: 'hidden', whiteSpace: 'nowrap', boxSizing: 'border-box', height: 45 })
    // A chip keeps its one line and its width on the sliding line.
    expect(lienStripChipFit(true)).toEqual({ flex: 'none' })
    // The job\u2019s name is cut, so the first chip is on the screen whatever the job is called.
    expect(lienStripLabelStyle(true)).toMatchObject({ flex: 'none', maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
  })

  it('gives every press on a phone\u2019s strip a 44 px touch area: 13 px over and under its 18 px', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    expect(css).toMatch(/\.lienDeskStrip\[data-phone='yes'\] > button \{ position: relative; \}/)
    expect(css).toMatch(/\.lienDeskStrip\[data-phone='yes'\] > button::after \{ content: ''; position: absolute; left: -4px; right: -4px; top: -13px; bottom: -13px; \}/)
    expect(css).toMatch(/\.lienDeskStrip\[data-phone='yes'\]::-webkit-scrollbar \{ display: none; \}/)
    // A desk has none of it: the rules name the phone.
    expect(css).not.toMatch(/\.lienDeskStrip > button::after/)
  })
})
