import { describe, expect, it } from 'vitest'
import { quickfillOutstandingLabel } from './outstandingLabel'

describe('quickfillOutstandingLabel', () => {
  it('a reported count reads "N open" — zero included; only an unreported metric reads "—"', () => {
    expect(quickfillOutstandingLabel({ count: 5, loading: false })).toBe('5 open')
    expect(quickfillOutstandingLabel({ count: 0, loading: false })).toBe('0 open')
    expect(quickfillOutstandingLabel({ count: null, loading: true })).toBe('…')
    expect(quickfillOutstandingLabel({ count: null, loading: false })).toBe('—')
  })

  it('the Dispatch tile reports the same "open" filter the expanded inbox lists (J19-F4)', () => {
    const requests = [{ status: 'open' }, { status: 'open' }, { status: 'dismissed' }, { status: 'done' }]
    const reported = requests.filter((r) => r.status === 'open').length
    expect(quickfillOutstandingLabel({ count: reported, loading: false })).toBe('2 open')
  })
})
