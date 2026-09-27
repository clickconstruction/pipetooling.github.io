import { describe, expect, it } from 'vitest'
import { jobOpenBalance, showJobHistoryLienTimeline } from './jobHistoryLienTimeline'

describe('the History tab’s lien timeline gate (v2.3879)', () => {
  it('shows for money owed or paper out, hides for a paid job with neither', () => {
    expect(showJobHistoryLienTimeline({ openBalance: 8940, hasPaper: false })).toBe(true)
    expect(showJobHistoryLienTimeline({ openBalance: 0, hasPaper: true })).toBe(true)
    expect(showJobHistoryLienTimeline({ openBalance: 0, hasPaper: false })).toBe(false)
  })
  it('reads the open balance as the Lien window does', () => {
    expect(jobOpenBalance({ revenue: 10000, payments_made: 1060 })).toBe(8940)
    expect(jobOpenBalance({ revenue: 500, payments_made: 800 })).toBe(0)
    expect(jobOpenBalance({ revenue: null, payments_made: null })).toBe(0)
  })
})
