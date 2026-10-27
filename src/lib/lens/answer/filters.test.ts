import { describe, expect, it } from 'vitest'
import { judge, keeps, parseLogical, parseParamFilter } from './filters'

const row = { status: null as string | null, amount: 120, tags: ['a', 'b'], meta: { kind: 'x' }, at: '2026-10-26T15:00:00+00:00' }

describe('filters, judged as Postgres judges them', () => {
  it('treats a comparison with null as unknown, so not and neq keep nothing', () => {
    expect(judge(parseParamFilter('status', 'eq.paid'), row)).toBeNull()
    expect(judge(parseParamFilter('status', 'neq.paid'), row)).toBeNull()
    expect(judge(parseParamFilter('status', 'not.eq.paid'), row)).toBeNull()
    expect(keeps([parseParamFilter('status', 'neq.paid')], row)).toBe(false)
    expect(judge(parseParamFilter('status', 'is.null'), row)).toBe(true)
    expect(judge(parseParamFilter('status', 'not.is.null'), row)).toBe(false)
  })

  it('compares numbers as numbers and timestamps as instants', () => {
    expect(judge(parseParamFilter('amount', 'gt.99'), row)).toBe(true)
    expect(judge(parseParamFilter('amount', 'lt.99'), row)).toBe(false)
    expect(judge(parseParamFilter('at', 'gte.2026-10-26T10:00:00-05:00'), row)).toBe(true)
    expect(judge(parseParamFilter('at', 'lt.2026-10-26'), row)).toBe(false)
  })

  it('reads lists, containment and JSON paths', () => {
    expect(judge(parseParamFilter('amount', 'in.(1,120)'), row)).toBe(true)
    expect(judge(parseParamFilter('tags', 'cs.{a}'), row)).toBe(true)
    expect(judge(parseParamFilter('tags', 'cd.{a,b,c}'), row)).toBe(true)
    expect(judge(parseParamFilter('tags', 'ov.{z,b}'), row)).toBe(true)
    expect(judge(parseParamFilter('meta', 'cs.{"kind":"x"}'), row)).toBe(true)
    expect(judge(parseParamFilter('meta->>kind', 'eq.x'), row)).toBe(true)
  })

  it('reads nested logic, where an unknown inside an or does not win', () => {
    const c = parseLogical('or', false, '(status.eq.paid,and(amount.gt.100,tags.cs.{a}))')
    expect(judge(c, row)).toBe(true)
    const u = parseLogical('or', false, '(status.eq.paid,amount.lt.0)')
    expect(judge(u, row)).toBeNull()
  })

  it('names a filter it cannot read yet', () => {
    expect(() => parseParamFilter('amount', 'eq(any).{1,2}')).toThrow(/filter modifier/)
    expect(() => parseParamFilter('span', 'adj.[1,2]')).toThrow(/the "adj" filter/)
  })
})
