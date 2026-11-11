import { describe, expect, it } from 'vitest'
import { LABEL_OUTPUTS, TAPE_COPIES_MAX, clampTapeCopies, repeatEach, TAPE_TEST_STRIP_LABEL, TAPE_WIDTH_DEFAULT, isTapeWidth, labelCountWords, sheetPressLabel, tapeLayout, tapePressLabel, tapePrintCss, tapeProgressWords, tapeReadyWords, tapeSentWords, tapeSetupSteps } from './tapeLabel'

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
  })

  it('names the two outputs, the first-time steps and the line once a computer has printed tape (punch list #304)', () => {
    expect(LABEL_OUTPUTS.sheet.name).toBe('Paper sheet')
    expect(LABEL_OUTPUTS.tape.name).toBe('Brother tape')
    expect(LABEL_OUTPUTS.tape.words).toContain('P-touch')
    const steps = tapeSetupSteps(18)
    expect(steps).toHaveLength(3)
    expect(steps[0]).toContain('USB cable')
    expect(steps[1]).toContain('driver')
    expect(steps[1]).toContain('no driver for a Mac')
    expect(steps[2]).toContain('18 mm paper')
    expect(TAPE_TEST_STRIP_LABEL).toBe('Print 1 test strip')
    expect(tapeReadyWords(24, 'Nov 10')).toEqual({ head: 'Brother tape \u00b7 24 mm.', tail: 'This computer printed tape last on Nov 10.' })
    expect(labelCountWords('tape', 6, false)).toBe('6 boxes, one strip each.')
    expect(labelCountWords('tape', 1, false)).toBe('1 box, one strip each.')
    expect(labelCountWords('tape', 1, true)).toBe('One strip: the QR, the stencil and the code.')
    expect(labelCountWords('sheet', 2, false)).toBe('2 labels, one a sheet. The camera opens the box from the code.')
  })

  it('names the steps for printing straight over USB, and the run as it goes (v2.6865)', () => {
    const direct = tapeSetupSteps(24, true)
    expect(direct).toHaveLength(3)
    expect(direct[1]).toContain('P-touch Editor')
    expect(direct[2]).toContain('Connect the P-touch')
    expect(direct.join(' ')).not.toContain('driver')
    expect(tapeProgressWords(0, 6)).toBe('Printing 1 of 6\u2026')
    expect(tapeProgressWords(6, 6)).toBe('Printing 6 of 6\u2026')
    expect(tapeSentWords(1, 1)).toBe('1 tape label printed.')
    expect(tapeSentWords(6, 6)).toBe('6 tape labels printed.')
    expect(tapeSentWords(2, 6, 'The printer\u2019s cover is open.')).toBe('2 of 6 printed, then the printer stopped: The printer\u2019s cover is open.')
  })

  it('copies of each keeps a box’s strips together and names the total (v2.6878)', () => {
    expect(repeatEach(['1', '2', '3'], 2)).toEqual(['1', '1', '2', '2', '3', '3'])
    expect(repeatEach(['1', '2'], 1)).toEqual(['1', '2'])
    expect(clampTapeCopies(0)).toBe(1)
    expect(clampTapeCopies('3')).toBe(3)
    expect(clampTapeCopies(99)).toBe(TAPE_COPIES_MAX)
    expect(clampTapeCopies('x')).toBe(1)
    expect(clampTapeCopies(null)).toBe(1)
    expect(labelCountWords('tape', 3, false, 2)).toBe('3 boxes, 2 strips each. 6 strips.')
    expect(labelCountWords('tape', 1, true, 4)).toBe('4 strips of this box: the QR, the stencil and the code.')
    expect(labelCountWords('tape', 3, false)).toBe('3 boxes, one strip each.')
    // a paper sheet has no copies
    expect(labelCountWords('sheet', 3, false, 2)).toBe(labelCountWords('sheet', 3, false))
  })
})
