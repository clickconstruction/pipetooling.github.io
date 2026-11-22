import { describe, expect, it } from 'vitest'
import type { ProfileJobRowMoney } from './customerProfileStats'
import { PROFILE_JOB_ROW_TONE_COLOR, profileJobRowMeta } from './profileJobRowWords'

function money(p: Partial<ProfileJobRowMoney>): ProfileJobRowMoney {
  return { openBilled: 0, unbilled: 0, ageDays: null, oldestOpenBillYmd: null, noBillDate: false, scheduledInKind: false, ...p }
}

describe('profileJobRowMeta', () => {
  it('a bill an in-kind deal pays reads scheduled: no day, no age, no red', () => {
    expect(profileJobRowMeta(money({ openBilled: 1000, scheduledInKind: true }), 'Billed')).toEqual({ text: 'billed · scheduled in kind', tone: 'quiet', strong: false })
  })

  it('an ordinary late bill says its day and its age, in red past 90 days', () => {
    expect(profileJobRowMeta(money({ openBilled: 1000, oldestOpenBillYmd: '2026-01-05', ageDays: 210 }), 'Billed')).toEqual({ text: 'billed Jan 5 · 210d', tone: 'late', strong: true })
    expect(profileJobRowMeta(money({ openBilled: 1000, oldestOpenBillYmd: '2026-07-20', ageDays: 14 }), 'Billed')).toEqual({ text: 'billed Jul 20 · 14d', tone: 'quiet', strong: false })
  })

  it('a bill with no date is amber', () => {
    expect(profileJobRowMeta(money({ openBilled: 700, noBillDate: true }), 'Billed')).toEqual({ text: 'billed · no date', tone: 'undated', strong: false })
  })

  it('with no bill open the row says its stage, and its unbilled work', () => {
    expect(profileJobRowMeta(money({ unbilled: 800 }), 'Working').text).toBe('Working · unbilled')
    expect(profileJobRowMeta(money({}), 'Paid').text).toBe('Paid')
  })

  it('each tone has a theme colour', () => {
    expect(PROFILE_JOB_ROW_TONE_COLOR.late).toBe('var(--text-red-600)')
    expect(PROFILE_JOB_ROW_TONE_COLOR.quiet).toBe('var(--text-muted)')
  })
})
