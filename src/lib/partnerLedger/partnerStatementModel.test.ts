import { describe, expect, it } from 'vitest'
import { awaitingStatementCard, balanceHeadline, longDate, partnerSinceLabel, todayLongDate } from './partnerStatementModel'
import type { WeekCard } from './partnerWeeks'

const card = (over: Partial<WeekCard>): WeekCard => ({
  open: false,
  weekStart: '2026-08-09',
  weekEnd: '2026-08-15',
  stubId: 'stub-1',
  lines: [],
  opening: 0,
  closing: 0,
  partnerAckAt: null,
  companyAckAt: null,
  crossings: [],
  ...over,
})

describe('balanceHeadline', () => {
  it('reads the sign in words', () => {
    expect(balanceHeadline(60.25)).toBe('Click owes you')
    expect(balanceHeadline(-1008.13)).toBe('You owe Click')
    expect(balanceHeadline(0)).toBe('Even')
  })
})

describe('awaitingStatementCard', () => {
  it('returns the newest closed statement while unacknowledged', () => {
    const live = card({ open: true, weekStart: '2026-08-23', weekEnd: null, stubId: null })
    const last = card({ weekStart: '2026-08-16', weekEnd: '2026-08-22', stubId: 's2' })
    const older = card({ weekStart: '2026-08-09', stubId: 's1', partnerAckAt: '2026-08-17T10:00:00Z' })
    expect(awaitingStatementCard([live, last, older])?.stubId).toBe('s2')
  })
  it('returns null once the last statement is acknowledged — even if older ones are not', () => {
    const live = card({ open: true, stubId: null })
    const last = card({ weekStart: '2026-08-16', stubId: 's2', partnerAckAt: '2026-08-24T10:00:00Z' })
    const older = card({ weekStart: '2026-08-09', stubId: 's1' })
    expect(awaitingStatementCard([live, last, older])).toBeNull()
  })
  it('skips charge-only weeks (no statement to sign) when finding the last statement', () => {
    const live = card({ open: true, stubId: null })
    const chargesOnly = card({ weekStart: '2026-08-16', stubId: null })
    const last = card({ weekStart: '2026-08-09', stubId: 's1' })
    expect(awaitingStatementCard([live, chargesOnly, last])?.stubId).toBe('s1')
  })
  it('returns null with no closed statements at all', () => {
    expect(awaitingStatementCard([card({ open: true, stubId: null })])).toBeNull()
    expect(awaitingStatementCard([])).toBeNull()
  })
})

describe('dates', () => {
  it('longDate formats YYYY-MM-DD and passes garbage through', () => {
    expect(longDate('2026-08-23')).toBe('Aug 23, 2026')
    expect(longDate('2026-03-02')).toBe('Mar 2, 2026')
    expect(longDate('not a date')).toBe('not a date')
  })
  it('partnerSinceLabel uses the oldest card', () => {
    const cards = [card({ open: true, weekStart: '2026-08-23' }), card({ weekStart: '2026-03-22' })]
    expect(partnerSinceLabel(cards)).toBe('partner since Mar 22, 2026')
    expect(partnerSinceLabel([])).toBeNull()
  })
  it('todayLongDate uses the local calendar date', () => {
    expect(todayLongDate(new Date(2026, 7, 23, 9, 4))).toBe('Aug 23, 2026')
  })
})
