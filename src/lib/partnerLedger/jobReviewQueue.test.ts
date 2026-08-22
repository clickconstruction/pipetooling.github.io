import { describe, expect, it } from 'vitest'
import {
  isConfirmedForPartner,
  isValidThreshold,
  jobsToAutoConfirm,
  parseReviewQueue,
  shareOfHours,
  sortReviewRows,
  type PartnerJobReviewRow,
} from './jobReviewQueue'

const row = (over: Partial<PartnerJobReviewRow>): PartnerJobReviewRow => ({
  job_id: 'j1',
  label: '781',
  job_name: 'Kingsbury 200A',
  partner_hours: 34,
  total_hours: 48,
  partner_person_id: null,
  confirmed_at: null,
  confirmed_by_name: null,
  confirmed_auto_pct: null,
  auto_exempt: false,
  ...over,
})

describe('shareOfHours', () => {
  it('computes a rounded percentage', () => {
    expect(shareOfHours(34, 48)).toBe(71)
    expect(shareOfHours(19, 33)).toBe(58)
  })
  it('clamps and survives zero/garbage totals', () => {
    expect(shareOfHours(10, 0)).toBe(0)
    expect(shareOfHours(10, -5)).toBe(0)
    expect(shareOfHours(Number.NaN, 10)).toBe(0)
    expect(shareOfHours(50, 10)).toBe(100)
  })
})

describe('isConfirmedForPartner', () => {
  it('true only when confirmed for THIS partner person', () => {
    expect(isConfirmedForPartner(row({ partner_person_id: 'p1' }), 'p1')).toBe(true)
    expect(isConfirmedForPartner(row({ partner_person_id: 'other' }), 'p1')).toBe(false)
    expect(isConfirmedForPartner(row({}), 'p1')).toBe(false)
    expect(isConfirmedForPartner(row({ partner_person_id: 'p1' }), null)).toBe(false)
  })
})

describe('parseReviewQueue', () => {
  it('parses a well-formed payload', () => {
    const q = parseReviewQueue({
      linked: true,
      partner_person_id: 'p1',
      rows: [
        { job_id: 'a', label: '774', job_name: 'Repipe', partner_hours: 19, total_hours: 33, partner_person_id: 'p1', confirmed_at: '2026-08-11', confirmed_by_name: 'Robert' },
      ],
    })
    expect(q.linked).toBe(true)
    expect(q.rows).toHaveLength(1)
    expect(q.rows[0]?.label).toBe('774')
    expect(q.rows[0]?.confirmed_by_name).toBe('Robert')
  })

  it('degrades garbage to an empty unlinked queue', () => {
    expect(parseReviewQueue(null)).toEqual({ linked: false, partner_person_id: null, rows: [] })
    expect(parseReviewQueue('x')).toEqual({ linked: false, partner_person_id: null, rows: [] })
    expect(parseReviewQueue([1, 2])).toEqual({ linked: false, partner_person_id: null, rows: [] })
  })

  it('skips malformed rows, defaults label, coerces numbers', () => {
    const q = parseReviewQueue({
      linked: true,
      partner_person_id: null,
      rows: [{ nope: true }, { job_id: 'a', label: '', partner_hours: '12.5', total_hours: undefined }],
    })
    expect(q.rows).toHaveLength(1)
    expect(q.rows[0]?.label).toBe('a')
    expect(q.rows[0]?.partner_hours).toBe(12.5)
    expect(q.rows[0]?.total_hours).toBe(0)
  })
})

describe('parseReviewQueue auto fields', () => {
  it('reads the auto stamp and exemption flag, defaulting when absent', () => {
    const q = parseReviewQueue({
      linked: true,
      partner_person_id: 'p1',
      rows: [
        { job_id: 'a', label: '813', partner_hours: 28.2, total_hours: 44.8, confirmed_auto_pct: 60, auto_exempt: false },
        { job_id: 'b', label: '764', partner_hours: 14.1, total_hours: 16.3, auto_exempt: true },
        { job_id: 'c', label: '789', partner_hours: 99.3, total_hours: 307.9 },
      ],
    })
    expect(q.rows[0]?.confirmed_auto_pct).toBe(60)
    expect(q.rows[0]?.auto_exempt).toBe(false)
    expect(q.rows[1]?.auto_exempt).toBe(true)
    expect(q.rows[2]?.confirmed_auto_pct).toBeNull()
    expect(q.rows[2]?.auto_exempt).toBe(false)
  })
})

describe('isValidThreshold', () => {
  it('accepts integers 1-100 only', () => {
    expect(isValidThreshold(60)).toBe(true)
    expect(isValidThreshold(1)).toBe(true)
    expect(isValidThreshold(100)).toBe(true)
    expect(isValidThreshold(0)).toBe(false)
    expect(isValidThreshold(101)).toBe(false)
    expect(isValidThreshold(60.5)).toBe(false)
    expect(isValidThreshold(null)).toBe(false)
    expect(isValidThreshold('60')).toBe(false)
  })
})

describe('jobsToAutoConfirm', () => {
  const queue = [
    row({ job_id: 'qualifies', partner_hours: 28.2, total_hours: 44.8 }), // 63%
    row({ job_id: 'below', partner_hours: 99.3, total_hours: 307.9 }), // 32%
    row({ job_id: 'exempt', partner_hours: 14.1, total_hours: 16.3, auto_exempt: true }), // 87% but human-cleared
    row({ job_id: 'confirmed', partner_hours: 26.5, total_hours: 36.7, partner_person_id: 'p1' }), // 72% already on
    row({ job_id: 'other-partner', partner_hours: 30, total_hours: 30, partner_person_id: 'p2' }),
  ]

  it('picks unconfirmed, non-exempt rows at/above the threshold', () => {
    expect(jobsToAutoConfirm(queue, 60).map((r) => r.job_id)).toEqual(['qualifies'])
  })

  it('exact threshold qualifies; a lower threshold picks up more jobs', () => {
    expect(jobsToAutoConfirm(queue, 63).map((r) => r.job_id)).toEqual(['qualifies'])
    expect(jobsToAutoConfirm(queue, 32).map((r) => r.job_id)).toEqual(['qualifies', 'below'])
  })

  it('returns nothing when the rule is off or the threshold is junk', () => {
    expect(jobsToAutoConfirm(queue, null)).toEqual([])
    expect(jobsToAutoConfirm(queue, 0)).toEqual([])
    expect(jobsToAutoConfirm(queue, 150)).toEqual([])
  })
})

describe('sortReviewRows', () => {
  it('unreviewed first by partner hours desc, confirmed last', () => {
    const rows = [
      row({ job_id: 'confirmed', partner_person_id: 'p1', partner_hours: 99 }),
      row({ job_id: 'small', partner_hours: 5 }),
      row({ job_id: 'big', partner_hours: 40 }),
      row({ job_id: 'other-partner', partner_person_id: 'p2', partner_hours: 60 }),
    ]
    const sorted = sortReviewRows(rows, 'p1').map((r) => r.job_id)
    // other-partner is NOT confirmed for p1 → sorts with unreviewed by hours
    expect(sorted).toEqual(['other-partner', 'big', 'small', 'confirmed'])
  })
})
