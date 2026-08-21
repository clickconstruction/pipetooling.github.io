import { describe, expect, it } from 'vitest'
import { sessionHours, shapeReviewSessions, statementWeekFor, summarizeSelection, type ReviewSessionRow } from './partnerSessionReview'

const base: Omit<ReviewSessionRow, 'id' | 'work_date' | 'clocked_in_at' | 'clocked_out_at'> = {
  notes: '',
  approved_at: null,
  rejected_at: null,
  revoked_at: null,
}

const weeks = [
  { period_start: '2026-08-09', period_end: '2026-08-15' },
  { period_start: '2026-08-02', period_end: '2026-08-08' },
]

describe('sessionHours', () => {
  it('rounds the in→out span to tenths and nulls open sessions', () => {
    expect(sessionHours({ clocked_in_at: '2026-08-17T13:04:00Z', clocked_out_at: '2026-08-17T21:22:00Z' })).toBe(8.3)
    expect(sessionHours({ clocked_in_at: '2026-08-17T13:04:00Z', clocked_out_at: null })).toBeNull()
    expect(sessionHours({ clocked_in_at: '2026-08-17T13:04:00Z', clocked_out_at: '2026-08-17T12:00:00Z' })).toBeNull()
  })
})

describe('statementWeekFor', () => {
  it('finds the covering generated week inclusively, else null', () => {
    expect(statementWeekFor('2026-08-09', weeks)).toBe('2026-08-09')
    expect(statementWeekFor('2026-08-15', weeks)).toBe('2026-08-09')
    expect(statementWeekFor('2026-08-17', weeks)).toBeNull()
  })
})

describe('shapeReviewSessions', () => {
  it('drops rejected/revoked, stamps status + statement week, sorts newest first', () => {
    const shaped = shapeReviewSessions(
      [
        { ...base, id: 'a', work_date: '2026-08-14', clocked_in_at: '2026-08-14T12:00:00Z', clocked_out_at: '2026-08-14T20:00:00Z' },
        { ...base, id: 'b', work_date: '2026-08-17', clocked_in_at: '2026-08-17T12:00:00Z', clocked_out_at: '2026-08-17T20:00:00Z', approved_at: '2026-08-18T00:00:00Z', notes: ' trim set ' },
        { ...base, id: 'c', work_date: '2026-08-16', clocked_in_at: '2026-08-16T12:00:00Z', clocked_out_at: null },
        { ...base, id: 'd', work_date: '2026-08-15', clocked_in_at: '2026-08-15T12:00:00Z', clocked_out_at: '2026-08-15T20:00:00Z', rejected_at: '2026-08-16T00:00:00Z' },
      ],
      weeks,
    )
    expect(shaped.map((s) => s.id)).toEqual(['b', 'c', 'a'])
    expect(shaped[0]).toMatchObject({ status: 'approved', note: 'trim set', statement_week: null, hours: 8 })
    expect(shaped[1]).toMatchObject({ status: 'open', hours: null })
    expect(shaped[2]).toMatchObject({ status: 'pending', statement_week: '2026-08-09' })
  })
})

describe('summarizeSelection', () => {
  it('totals only selected rows; open sessions add 0 h; counts statement-covered', () => {
    const shaped = shapeReviewSessions(
      [
        { ...base, id: 'a', work_date: '2026-08-14', clocked_in_at: '2026-08-14T12:00:00Z', clocked_out_at: '2026-08-14T18:48:00Z' },
        { ...base, id: 'b', work_date: '2026-08-17', clocked_in_at: '2026-08-17T12:00:00Z', clocked_out_at: '2026-08-17T20:18:00Z' },
        { ...base, id: 'c', work_date: '2026-08-16', clocked_in_at: '2026-08-16T12:00:00Z', clocked_out_at: null },
      ],
      weeks,
    )
    expect(summarizeSelection(shaped, new Set(['a', 'b', 'c']))).toEqual({ count: 3, hours: 15.1, onStatementCount: 1 })
    expect(summarizeSelection(shaped, new Set())).toEqual({ count: 0, hours: 0, onStatementCount: 0 })
  })
})
