import { describe, expect, it } from 'vitest'
import { balanceWords, isLongLabel, postingLabel, shortDate, weekOfLabel, weekRangeLabel } from './partnerLedgerFormat'

describe('balanceWords', () => {
  it('speaks the direction in plain words, nothing for zero', () => {
    expect(balanceWords(546.39)).toBe('Click owes you')
    expect(balanceWords(-368.86)).toBe('you owe Click')
    expect(balanceWords(0)).toBe('')
  })
})

describe('shortDate / weekOfLabel / weekRangeLabel', () => {
  it('drops the year in the current year, keeps it otherwise, passes garbage through', () => {
    expect(shortDate('2026-08-15', 2026)).toBe('Aug 15')
    expect(shortDate('2025-12-28', 2026)).toBe('Dec 28, 2025')
    expect(shortDate('not-a-date', 2026)).toBe('not-a-date')
  })
  it('labels the week card and the print range', () => {
    expect(weekOfLabel('2026-05-03', 2026)).toBe('Week of May 3')
    expect(weekOfLabel('2025-05-04', 2026)).toBe('Week of May 4, 2025')
    expect(weekRangeLabel('2026-05-03', '2026-05-09')).toBe('May 3 – May 9, 2026')
    expect(weekRangeLabel('2026-08-16', null)).toBe('Aug 16, 2026 – in progress')
    expect(weekRangeLabel('garbage', null)).toBe('garbage')
  })
})

describe('isLongLabel / postingLabel', () => {
  it('flags pasted-transcript labels, not ordinary ones', () => {
    expect(isLongLabel('Car repairs, Bryan asked to be charged.')).toBe(false)
    expect(isLongLabel('"Robert Douglas: (10:02) I will take this as you are agreeing to the back charge. Let me get the unit over to you."')).toBe(true)
  })
  it('shortens labor rows to hours only and leaves other rows alone', () => {
    expect(postingLabel({ kind: 'labor', label: 'Labor — 12.86 h (week of 2026-08-09)', hours: 12.86 })).toBe('Labor · 12.86 h')
    expect(postingLabel({ kind: 'labor', label: 'Labor — 12.86 h (week of 2026-08-09)', hours: null })).toBe('Labor — 12.86 h (week of 2026-08-09)')
    expect(postingLabel({ kind: 'payout', label: 'Paid out', hours: null })).toBe('Paid out')
  })
})
