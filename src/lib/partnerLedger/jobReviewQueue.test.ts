import { describe, expect, it } from 'vitest'
import {
  isConfirmedForPartner,
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
