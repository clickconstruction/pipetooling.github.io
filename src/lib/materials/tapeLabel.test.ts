import { describe, expect, it } from 'vitest'
import { TAPE_WIDTH_DEFAULT, isTapeWidth, sheetPressLabel, tapeHintWords, tapeLayout, tapePressLabel, tapePrintCss } from './tapeLabel'

describe('the tape label (v2.6801)', () => {
  it('lays the strip out inside the tape with a QR that leaves its quiet zone', () => {
    for (const w of [18, 24] as const) {
      const l = tapeLayout(w)
      expect(l.qrMm + 2 * l.padMm).toBeLessThanOrEqual(w)
      expect(l.stencilMm + l.codeMm + l.wordsMm + 2 * l.padMm).toBeLessThanOrEqual(w)
      expect(l.lengthMm).toBeGreaterThan(l.qrMm * 2)
    }
    expect(tapeLayout(24).lengthMm).toBe(72)
    expect(TAPE_WIDTH_DEFAULT).toBe(24)
    expect(isTapeWidth(24)).toBe(true)
    expect(isTapeWidth(36)).toBe(false)
  })

  it('writes the page rule at the tape size with no margin, and breaks each strip to its own page', () => {
    const css = tapePrintCss(24, 'on-site-tape')
    expect(css).toContain('@page { size: 72mm 24mm; margin: 0; }')
    expect(css).toContain('.on-site-tape { width: 72mm !important; height: 24mm !important;')
    expect(css).toContain('.on-site-tape + .on-site-tape { break-before: page;')
    expect(tapePrintCss(18, 'x')).toContain('size: 60mm 18mm')
  })

  it('names the press with its count, dead at zero', () => {
    expect(tapePressLabel(3)).toBe('Print 3 tape labels')
    expect(tapePressLabel(1)).toBe('Print 1 tape label')
    expect(tapePressLabel(0)).toBe('Print tape labels')
    expect(sheetPressLabel(2)).toBe('Print 2 labels')
    expect(tapeHintWords(24)).toContain('24 mm wide')
  })
})
