import { describe, expect, it } from 'vitest'
import { lienStepCardOver } from './lienStepCardPlace'

describe('lienStepCardOver · a To do row’s step card opens where it can be read (v2.7425)', () => {
  it('opens under its row whenever it fits there', () => {
    expect(lienStepCardOver({ height: 387, under: 420, over: 300 })).toBe(false)
    // Even with more room over: under is where it always was.
    expect(lienStepCardOver({ height: 387, under: 401, over: 900 })).toBe(false)
  })

  it('the walk’s find: a row at the foot of a 720 px screen opens its card over the row, not below the fold', () => {
    // Measured on 2026-11-15: the row's mark at y 712 of 720, the card 387 px tall. It opened at 718.
    expect(lienStepCardOver({ height: 387, under: 2, over: 560 })).toBe(true)
    // One pixel short of fitting under.
    expect(lienStepCardOver({ height: 387, under: 400, over: 560 })).toBe(true)
  })

  it('with room on neither side it keeps to the side with more, under on a tie', () => {
    expect(lienStepCardOver({ height: 387, under: 200, over: 150 })).toBe(false)
    expect(lienStepCardOver({ height: 387, under: 200, over: 200 })).toBe(false)
    expect(lienStepCardOver({ height: 387, under: 150, over: 200 })).toBe(true)
  })

  it('before the card is measured it stays under its row', () => {
    expect(lienStepCardOver({ height: 0, under: 0, over: 500 })).toBe(false)
  })
})
