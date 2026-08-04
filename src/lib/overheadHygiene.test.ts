import { describe, expect, it } from 'vitest'
import {
  buildOverheadHygieneSummary,
  formatOverheadHygienePersonNames,
  summarizeOverheadPendingApprovals,
  summarizeOverheadUnassignedSalary,
  summarizeOverheadUnpricedHours,
  type OverheadHygieneSessionInput,
  type OverheadHygieneWageLine,
} from './overheadHygiene'

function sess(
  p: Partial<OverheadHygieneSessionInput> & Pick<OverheadHygieneSessionInput, 'id'>,
): OverheadHygieneSessionInput {
  return {
    clocked_in_at: '2026-07-01T14:00:00.000Z',
    clocked_out_at: '2026-07-01T16:00:00.000Z',
    approved_at: '2026-07-01T20:00:00.000Z',
    rejected_at: null,
    revoked_at: null,
    users: { name: 'Alice' },
    ...p,
  }
}

function line(
  p: Partial<OverheadHygieneWageLine> & Pick<OverheadHygieneWageLine, 'sessionId' | 'userName'>,
): OverheadHygieneWageLine {
  return { hours: 1, missingWage: false, ...p }
}

describe('summarizeOverheadPendingApprovals', () => {
  it('counts only sessions with no approval, rejection, or revocation', () => {
    const result = summarizeOverheadPendingApprovals([
      [
        sess({ id: 'approved' }),
        sess({ id: 'rejected', approved_at: null, rejected_at: '2026-07-01T20:00:00.000Z' }),
        sess({ id: 'revoked', approved_at: null, revoked_at: '2026-07-01T20:00:00.000Z' }),
        sess({ id: 'pending-closed', approved_at: null }),
      ],
    ])
    expect(result).toEqual({ closedCount: 1, closedHours: 2, openCount: 0 })
  })

  it('splits closed (count + hours) from still-open (count only)', () => {
    const result = summarizeOverheadPendingApprovals([
      [
        sess({ id: 'p1', approved_at: null, clocked_out_at: '2026-07-01T16:30:00.000Z' }),
        sess({ id: 'p2', approved_at: null, clocked_out_at: null }),
      ],
    ])
    expect(result).toEqual({ closedCount: 1, closedHours: 2.5, openCount: 1 })
  })

  it('dedupes a session that appears in both fetch arrays (field job + bid overlap)', () => {
    const dup = sess({ id: 'both', approved_at: null })
    const result = summarizeOverheadPendingApprovals([[dup], [dup]])
    expect(result.closedCount).toBe(1)
    expect(result.closedHours).toBe(2)
  })

  it('counts a closed pending session even when its duration is invalid (hours 0)', () => {
    const result = summarizeOverheadPendingApprovals([
      [sess({ id: 'bad-times', approved_at: null, clocked_out_at: '2026-07-01T13:00:00.000Z' })],
    ])
    expect(result).toEqual({ closedCount: 1, closedHours: 0, openCount: 0 })
  })
})

describe('summarizeOverheadUnpricedHours', () => {
  it('aggregates only missing-wage lines with distinct sorted names', () => {
    const result = summarizeOverheadUnpricedHours([
      [
        line({ sessionId: 's1', userName: 'Zed', hours: 3, missingWage: true }),
        line({ sessionId: 's2', userName: 'Amy', hours: 2, missingWage: true }),
        line({ sessionId: 's3', userName: 'Bob', hours: 8, missingWage: false }),
      ],
      [line({ sessionId: 's4', userName: 'Zed', hours: 1.5, missingWage: true })],
    ])
    expect(result).toEqual({ personNames: ['Amy', 'Zed'], sessionCount: 3, hours: 6.5 })
  })

  it('dedupes by sessionId across line groups', () => {
    const l = line({ sessionId: 'dup', userName: 'Amy', hours: 4, missingWage: true })
    const result = summarizeOverheadUnpricedHours([[l], [l]])
    expect(result).toEqual({ personNames: ['Amy'], sessionCount: 1, hours: 4 })
  })

  it('returns an empty summary when every line is priced', () => {
    const result = summarizeOverheadUnpricedHours([[line({ sessionId: 's1', userName: 'Amy' })]])
    expect(result).toEqual({ personNames: [], sessionCount: 0, hours: 0 })
  })
})

describe('summarizeOverheadUnassignedSalary', () => {
  it('sums count, closed hours, and distinct people; ignores approval status', () => {
    const result = summarizeOverheadUnassignedSalary([
      sess({ id: 's1', users: { name: 'Carol' } }),
      sess({ id: 's2', approved_at: null, users: { name: 'Carol' }, clocked_out_at: '2026-07-01T17:00:00.000Z' }),
      sess({ id: 's3', approved_at: null, users: { name: 'Dan' }, clocked_out_at: null }),
    ])
    expect(result).toEqual({ sessionCount: 3, hours: 5, personNames: ['Carol', 'Dan'] })
  })

  it('drops rejected and revoked sessions', () => {
    const result = summarizeOverheadUnassignedSalary([
      sess({ id: 'r1', rejected_at: '2026-07-01T20:00:00.000Z' }),
      sess({ id: 'r2', revoked_at: '2026-07-01T20:00:00.000Z' }),
    ])
    expect(result).toEqual({ sessionCount: 0, hours: 0, personNames: [] })
  })

  it('falls back to "Unknown" for blank names', () => {
    const result = summarizeOverheadUnassignedSalary([sess({ id: 's1', users: null })])
    expect(result.personNames).toEqual(['Unknown'])
  })
})

describe('buildOverheadHygieneSummary', () => {
  it('is clean (anyAttention false) when everything is approved, priced, and assigned', () => {
    const result = buildOverheadHygieneSummary({
      officeAndBidSessions: [sess({ id: 'a' })],
      fieldSessions: [sess({ id: 'b' })],
      unassignedSalarySessions: [],
      overheadDetailLines: [line({ sessionId: 'a', userName: 'Alice' })],
      otherJobsDetailLines: [line({ sessionId: 'b', userName: 'Alice' })],
    })
    expect(result.anyAttention).toBe(false)
    expect(result.unassignedSalary).toEqual({ sessionCount: 0, hours: 0, personNames: [] })
  })

  it('flags attention from any single indicator', () => {
    const pendingOnly = buildOverheadHygieneSummary({
      officeAndBidSessions: [sess({ id: 'p', approved_at: null })],
      fieldSessions: [],
      unassignedSalarySessions: [],
      overheadDetailLines: [],
      otherJobsDetailLines: [],
    })
    expect(pendingOnly.anyAttention).toBe(true)

    const salaryOnly = buildOverheadHygieneSummary({
      officeAndBidSessions: [],
      fieldSessions: [],
      unassignedSalarySessions: [sess({ id: 's' })],
      overheadDetailLines: [],
      otherJobsDetailLines: [],
    })
    expect(salaryOnly.anyAttention).toBe(true)
  })

  it('keeps unassignedSalary null (fetch failed) without flagging attention for it', () => {
    const result = buildOverheadHygieneSummary({
      officeAndBidSessions: [],
      fieldSessions: [],
      unassignedSalarySessions: null,
      overheadDetailLines: [],
      otherJobsDetailLines: [],
    })
    expect(result.unassignedSalary).toBe(null)
    expect(result.anyAttention).toBe(false)
  })
})

describe('formatOverheadHygienePersonNames', () => {
  it('joins up to the cap and summarizes the rest', () => {
    expect(formatOverheadHygienePersonNames([])).toBe('')
    expect(formatOverheadHygienePersonNames(['A'])).toBe('A')
    expect(formatOverheadHygienePersonNames(['A', 'B', 'C'])).toBe('A, B, C')
    expect(formatOverheadHygienePersonNames(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C and 2 more')
  })
})
