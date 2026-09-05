import { describe, expect, it } from 'vitest'
import {
  countClosedPendingSessions,
  describePendingOutsideVisibleWeek,
  formatPayWeekLabel,
  payWeekContaining,
  payWeekForCloseWeek,
  payWeekStart,
  pendingOutsideVisibleWeek,
  previousCompletePayWeek,
} from './payWeekAnchor'

describe('payWeekAnchor — Sun–Sat is the one pay week', () => {
  it('payWeekStart is the Sunday on or before the date', () => {
    expect(payWeekStart('2026-08-26')).toBe('2026-08-23') // Wed → Sun
    expect(payWeekStart('2026-08-23')).toBe('2026-08-23') // Sunday stays
    expect(payWeekStart('2026-08-29')).toBe('2026-08-23') // Saturday → its Sunday
  })

  it('payWeekContaining spans Sunday through Saturday', () => {
    expect(payWeekContaining('2026-09-02')).toEqual({ start: '2026-08-30', end: '2026-09-05' })
  })

  it('previousCompletePayWeek is the prior Sun–Sat (Draft Payroll default)', () => {
    // Wed Sep 2 2026, mid-day Central
    expect(previousCompletePayWeek(new Date('2026-09-02T18:00:00-05:00'))).toEqual({ start: '2026-08-23', end: '2026-08-29' })
    // Sunday Sep 6 morning Central: the week that just ended is Aug 30 – Sep 5
    expect(previousCompletePayWeek(new Date('2026-09-06T08:00:00-05:00'))).toEqual({ start: '2026-08-30', end: '2026-09-05' })
  })

  it('payWeekForCloseWeek maps the Mon–Sun close week onto the pay week ending inside it', () => {
    // Moneyfill "Close out: Week of Aug 24 – 30" → pay week Aug 23–29 (what Draft Payroll opens to)
    expect(payWeekForCloseWeek('2026-08-24')).toEqual({ start: '2026-08-23', end: '2026-08-29' })
  })

  it('formats the pay week like the approvals queue', () => {
    expect(formatPayWeekLabel({ start: '2026-08-23', end: '2026-08-29' })).toBe('Aug 23–29')
    expect(formatPayWeekLabel({ start: '2026-08-30', end: '2026-09-05' })).toBe('Aug 30 – Sep 5')
  })
})

describe('pendingOutsideVisibleWeek — the "+N in earlier weeks" count', () => {
  it('is company-wide minus visible, floored at zero', () => {
    expect(pendingOutsideVisibleWeek(53, 37)).toBe(16)
    expect(pendingOutsideVisibleWeek(37, 37)).toBe(0)
    expect(pendingOutsideVisibleWeek(30, 37)).toBe(0)
  })

  it('is null when the company-wide count is unknown', () => {
    expect(pendingOutsideVisibleWeek(null, 12)).toBeNull()
    expect(pendingOutsideVisibleWeek(undefined, 12)).toBeNull()
  })

  it('countClosedPendingSessions uses the RPC inclusion rule (closed, not rejected, not revoked)', () => {
    expect(
      countClosedPendingSessions([
        { clocked_out_at: '2026-09-01T20:00:00Z' },
        { clocked_out_at: null },
        { clocked_out_at: '2026-09-01T20:00:00Z', rejected_at: '2026-09-02T00:00:00Z' },
        { clocked_out_at: '2026-09-01T20:00:00Z', revoked_at: '2026-09-02T00:00:00Z' },
        { clocked_out_at: '2026-09-01T21:00:00Z', rejected_at: null, revoked_at: null },
      ]),
    ).toBe(2)
  })

  it('describes the remainder as earlier weeks when the range reaches today, other weeks when paged back', () => {
    expect(describePendingOutsideVisibleWeek(16, '2026-09-05', '2026-09-02')).toBe('+16 sessions in earlier weeks')
    expect(describePendingOutsideVisibleWeek(1, '2026-09-05', '2026-09-05')).toBe('+1 session in earlier weeks')
    expect(describePendingOutsideVisibleWeek(4, '2026-08-22', '2026-09-02')).toBe('+4 sessions in other weeks')
    expect(describePendingOutsideVisibleWeek(0, '2026-09-05', '2026-09-02')).toBe('')
    expect(describePendingOutsideVisibleWeek(null, '2026-09-05', '2026-09-02')).toBe('')
  })
})
