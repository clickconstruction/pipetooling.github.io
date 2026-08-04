import { describe, expect, it } from 'vitest'
import {
  buildCustomerReviewDetail,
  contributorInitials,
  formatContributorShare,
  formatSessionDay,
  formatSessionTimeRange,
  parseCustomerReviewGroupKey,
  type CustomerReviewSessionRow,
} from './bidBoardCustomerReviewDetail'

function session(partial: Partial<CustomerReviewSessionRow> & { session_id: string }): CustomerReviewSessionRow {
  return {
    user_id: 'u1',
    user_name: 'Wendi',
    kind: 'bid',
    target_id: 't1',
    target_label: 'Some bid',
    bid_number: null,
    clocked_in_at: '2026-07-27T12:00:00Z',
    clocked_out_at: '2026-07-27T14:00:00Z',
    hours: 2,
    ...partial,
  }
}

describe('parseCustomerReviewGroupKey', () => {
  it('splits list-row keys into RPC params', () => {
    expect(parseCustomerReviewGroupKey('c:abc')).toEqual({ customerId: 'abc', gcBuilderId: null })
    expect(parseCustomerReviewGroupKey('g:xyz')).toEqual({ customerId: null, gcBuilderId: 'xyz' })
    expect(parseCustomerReviewGroupKey('none')).toEqual({ customerId: null, gcBuilderId: null })
  })
})

describe('buildCustomerReviewDetail', () => {
  it('splits totals into estimating vs job hours and counts people', () => {
    const detail = buildCustomerReviewDetail([
      session({ session_id: 's1', kind: 'bid', hours: 3 }),
      session({ session_id: 's2', kind: 'job', target_id: 'j1', target_label: 'Job A', hours: 5 }),
      session({ session_id: 's3', kind: 'job', target_id: 'j1', target_label: 'Job A', user_id: 'u2', user_name: 'Malachi', hours: 2 }),
    ])
    expect(detail.estimatingHours).toBe(3)
    expect(detail.jobHours).toBe(7)
    expect(detail.totalHours).toBe(10)
    expect(detail.peopleCount).toBe(2)
  })

  it('ranks contributors by total hours with per-person estimating/job split and share', () => {
    const detail = buildCustomerReviewDetail([
      session({ session_id: 's1', user_id: 'u1', user_name: 'Wendi', kind: 'bid', hours: 2 }),
      session({ session_id: 's2', user_id: 'u2', user_name: 'Malachi', kind: 'job', target_id: 'j1', hours: 6 }),
      session({ session_id: 's3', user_id: 'u2', user_name: 'Malachi', kind: 'bid', hours: 2 }),
    ])
    expect(detail.contributors.map((c) => c.name)).toEqual(['Malachi', 'Wendi'])
    expect(detail.contributors[0]).toMatchObject({ estimatingHours: 2, jobHours: 6, totalHours: 8, share: 0.8 })
    expect(detail.contributors[1]?.share).toBeCloseTo(0.2)
  })

  it('groups sessions per bid/job, sorted by hours, sessions newest first', () => {
    const detail = buildCustomerReviewDetail([
      session({ session_id: 's1', kind: 'bid', target_id: 'b1', target_label: 'Bid A', bid_number: 'b146', hours: 1, clocked_in_at: '2026-07-01T12:00:00Z' }),
      session({ session_id: 's2', kind: 'job', target_id: 'j1', target_label: 'Job B', hours: 4, clocked_in_at: '2026-07-02T12:00:00Z' }),
      session({ session_id: 's3', kind: 'job', target_id: 'j1', target_label: 'Job B', hours: 3, clocked_in_at: '2026-07-03T12:00:00Z' }),
    ])
    expect(detail.groups.map((g) => g.key)).toEqual(['job:j1', 'bid:b1'])
    expect(detail.groups[0]).toMatchObject({ kind: 'job', label: 'Job B', hours: 7, bidNumber: null })
    expect(detail.groups[0]?.sessions.map((s) => s.sessionId)).toEqual(['s3', 's2'])
    expect(detail.groups[1]?.bidNumber).toBe('b146')
  })

  it('treats null/negative/garbage hours as zero and null users as Unknown', () => {
    const detail = buildCustomerReviewDetail([
      session({ session_id: 's1', user_id: null, user_name: null, hours: null }),
      session({ session_id: 's2', user_id: null, user_name: '  ', hours: -3 }),
      session({ session_id: 's3', hours: '2.5' }),
    ])
    expect(detail.totalHours).toBe(2.5)
    expect(detail.contributors.find((c) => c.userId === 'unknown')?.name).toBe('Unknown')
  })

  it('returns zero share when there are no hours', () => {
    const detail = buildCustomerReviewDetail([session({ session_id: 's1', hours: 0 })])
    expect(detail.totalHours).toBe(0)
    expect(detail.contributors[0]?.share).toBe(0)
  })
})

describe('contributorInitials', () => {
  it('uses first+last word initials, or first two letters of a single name', () => {
    expect(contributorInitials('Wendi Smith')).toBe('WS')
    expect(contributorInitials('Malachi')).toBe('MA')
    expect(contributorInitials('Mary Jo Del Rio')).toBe('MR')
    expect(contributorInitials('  ')).toBe('?')
  })
})

describe('formatters', () => {
  it('formats session day as weekday M/D', () => {
    // Construct from local-time ISO so the expectation is timezone-stable.
    expect(formatSessionDay('2026-07-27T10:00:00')).toBe('Mon 7/27')
    expect(formatSessionDay('garbage')).toBe('—')
  })

  it('formats time ranges with open sessions', () => {
    expect(formatSessionTimeRange('2026-07-27T07:02:00', '2026-07-27T15:41:00')).toBe('7:02a – 3:41p')
    expect(formatSessionTimeRange('2026-07-27T12:05:00', null)).toBe('12:05p – open')
    expect(formatSessionTimeRange('2026-07-27T00:30:00', '2026-07-27T12:00:00')).toBe('12:30a – 12:00p')
    expect(formatSessionTimeRange('garbage', null)).toBe('—')
  })

  it('formats contributor share as whole percent with <1% floor', () => {
    expect(formatContributorShare(0.38)).toBe('38%')
    expect(formatContributorShare(0.001)).toBe('<1%')
    expect(formatContributorShare(0)).toBe('—')
  })
})
