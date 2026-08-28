import { describe, expect, it } from 'vitest'
import { deriveBidDue, formatDueTime, gcDetailsSummary, normalizeItbLinks } from './bidGcDetails'

const row = (customer_id: string | null, due_date: string | null, due_time: string | null = null) => ({ customer_id, due_date, due_time })

describe('deriveBidDue', () => {
  it('earliest due among GCs with no send wins; sent packets stop counting', () => {
    const rows = [row(null, '2026-09-01'), row('c-b', '2026-09-04')]
    expect(deriveBidDue(rows, new Set())).toEqual({ dueDate: '2026-09-01', dueTime: null })
    expect(deriveBidDue(rows, new Set(['']))).toEqual({ dueDate: '2026-09-04', dueTime: null })
  })
  it('everything sent falls back to the earliest due overall', () => {
    expect(deriveBidDue([row(null, '2026-09-01'), row('c-b', '2026-09-04')], new Set(['', 'c-b']))).toEqual({
      dueDate: '2026-09-01',
      dueTime: null,
    })
  })
  it('same date ties break by earliest time, nulls last; carries the winning time', () => {
    expect(deriveBidDue([row(null, '2026-09-01', null), row('c-b', '2026-09-01', '14:00')], new Set())).toEqual({
      dueDate: '2026-09-01',
      dueTime: '14:00',
    })
  })
  it('no per-GC dues → null (the caller leaves hand-set bid dates alone)', () => {
    expect(deriveBidDue([], new Set())).toBeNull()
    expect(deriveBidDue([row(null, null)], new Set())).toBeNull()
  })
})

describe('gcDetailsSummary', () => {
  it('joins due · submitted-to · ITB count; null when the row holds nothing', () => {
    expect(
      gcDetailsSummary({ due_date: '2026-09-04', due_time: '14:00', submitted_to_name: 'John Arch', itb_links: ['a'] }),
    ).toBe('due 9/4 2:00 PM · submitted to John Arch · 1 ITB link')
    expect(gcDetailsSummary({ due_date: null, due_time: null, submitted_to_name: ' ', itb_links: [] })).toBeNull()
    expect(gcDetailsSummary(null)).toBeNull()
  })
})

describe('normalizeItbLinks', () => {
  it('keeps non-blank strings only', () => {
    expect(normalizeItbLinks(['a', '', 3, null, ' b '])).toEqual(['a', ' b '])
    expect(normalizeItbLinks('nope')).toEqual([])
  })
})

describe('formatDueTime', () => {
  it('renders 12-hour with AM/PM', () => {
    expect(formatDueTime('14:00')).toBe('2:00 PM')
    expect(formatDueTime('00:30:00')).toBe('12:30 AM')
    expect(formatDueTime('12:05')).toBe('12:05 PM')
    expect(formatDueTime('junk')).toBe('junk')
  })
})
