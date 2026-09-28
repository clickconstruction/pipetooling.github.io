import { describe, expect, it } from 'vitest'
import { payPromiseLabel, payPromiseStatus } from './payPromise'

const TODAY = '2026-09-27'

describe('payPromiseStatus', () => {
  it('is late the day after the date, while money is open', () => {
    expect(payPromiseStatus('2026-09-20', TODAY, 81500)).toEqual({ payBy: '2026-09-20', late: true, daysLate: 7 })
    expect(payPromiseStatus('2026-09-26', TODAY, 100)).toEqual({ payBy: '2026-09-26', late: true, daysLate: 1 })
  })

  it('is not late on the day itself, nor before it', () => {
    expect(payPromiseStatus('2026-09-27', TODAY, 100)?.late).toBe(false)
    expect(payPromiseStatus('2026-10-10', TODAY, 100)).toEqual({ payBy: '2026-10-10', late: false, daysLate: 0 })
  })

  it('a paid GC kept its word', () => {
    expect(payPromiseStatus('2026-09-20', TODAY, 0)?.late).toBe(false)
  })

  it('no date, no promise', () => {
    expect(payPromiseStatus(null, TODAY, 100)).toBeNull()
    expect(payPromiseStatus('soon', TODAY, 100)).toBeNull()
  })

  it('reads as a sentence', () => {
    expect(payPromiseLabel({ payBy: '2026-09-20', late: true, daysLate: 7 })).toBe('promised Sep 20 — 7 days late')
    expect(payPromiseLabel({ payBy: '2026-09-26', late: true, daysLate: 1 })).toBe('promised Sep 26 — 1 day late')
    expect(payPromiseLabel({ payBy: '2026-10-10', late: false, daysLate: 0 })).toBe('pays by Oct 10')
  })
})
