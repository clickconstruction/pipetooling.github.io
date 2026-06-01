import { describe, expect, it } from 'vitest'
import { buildInvoiceAmountMap, collectInvoiceJobIds } from './partsLedger'

describe('collectInvoiceJobIds', () => {
  it('returns an empty array when both inputs are empty', () => {
    expect(collectInvoiceJobIds([], [])).toEqual([])
  })
  it('unions part job_ids with allocation job_ids', () => {
    const ids = collectInvoiceJobIds([{ job_id: 'a' }, { job_id: 'b' }], [{ job_id: 'c' }])
    expect(new Set(ids)).toEqual(new Set(['a', 'b', 'c']))
  })
  it('dedupes job_ids that appear in both sources and within a source', () => {
    const ids = collectInvoiceJobIds([{ job_id: 'a' }, { job_id: 'a' }], [{ job_id: 'a' }, { job_id: 'b' }])
    expect(new Set(ids)).toEqual(new Set(['a', 'b']))
    expect(ids.length).toBe(2)
  })
})

describe('buildInvoiceAmountMap', () => {
  it('returns an empty map for no rows', () => {
    expect(buildInvoiceAmountMap([])).toEqual({})
  })
  it('maps job_id to a numeric amount', () => {
    expect(buildInvoiceAmountMap([{ job_id: 'a', invoice_amount: 12.5 }])).toEqual({ a: 12.5 })
  })
  it('coerces null amounts to 0', () => {
    expect(buildInvoiceAmountMap([{ job_id: 'a', invoice_amount: null }])).toEqual({ a: 0 })
  })
  it('last write wins for duplicate job_ids', () => {
    expect(
      buildInvoiceAmountMap([
        { job_id: 'a', invoice_amount: 1 },
        { job_id: 'a', invoice_amount: 2 },
      ]),
    ).toEqual({ a: 2 })
  })
})
