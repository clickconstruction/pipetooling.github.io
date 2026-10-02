import { describe, expect, it } from 'vitest'
import { stagesBillRowLine } from './stagesBillRowLine'

describe('stagesBillRowLine (the This bill line on a Pipeline bill row)', () => {
  it('a part-paid bill says what is paid and what is left (Springtown, the Sep 1 bill)', () => {
    const l = stagesBillRowLine({ amount: 11770.3, applied: 11181.78, billedYmd: '2026-09-01' })
    expect(l.paid).toBe('$11,182 paid')
    expect(l.left).toBe('$589 left')
    expect(l.openUsd).toBeCloseTo(588.52, 2)
    expect(l.title).toBe("This row's bill: $11,770 sent Sep 1. $11,182 is paid on it, and $589 is left.")
  })

  it('a bill with nothing paid says nothing paid, and the whole bill is left (Springtown, the Sep 23 bill)', () => {
    const l = stagesBillRowLine({ amount: '3635.92', applied: 0, billedYmd: '2026-09-23' })
    expect(l.paid).toBe('nothing paid')
    expect(l.left).toBe('$3,636 left')
    expect(l.title).toBe("This row's bill: $3,636 sent Sep 23. Nothing is paid on it yet, and $3,636 is left.")
  })

  it('a bill paid to the cent but still marked sent says nothing left', () => {
    const l = stagesBillRowLine({ amount: 1980, applied: 1980 })
    expect(l.paid).toBe('$1,980 paid')
    expect(l.left).toBe('nothing left')
    expect(l.openUsd).toBe(0)
    expect(l.title).toBe("This row's bill: $1,980. $1,980 is paid on it, and nothing is left.")
  })

  it('an overpaid bill never reads a negative remainder', () => {
    const l = stagesBillRowLine({ amount: 500, applied: 650 })
    expect(l.left).toBe('nothing left')
    expect(l.openUsd).toBe(0)
  })

  it('a missing amount reads as zero, not NaN', () => {
    const l = stagesBillRowLine({ amount: null, applied: 0 })
    expect(l.paid).toBe('nothing paid')
    expect(l.left).toBe('nothing left')
  })
})
