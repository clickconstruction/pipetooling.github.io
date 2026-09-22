import { describe, expect, it } from 'vitest'
import { contractAmountDoorLabel, contractAmountDrift, contractAmountSource, contractAmountSourceLabel } from './contractAmountSource'

const fmt = (iso: string) => `on ${iso.slice(0, 10)}`
const fixtures = [{ name: 'Water closet' }, { name: 'Lavatory' }, { name: '  ' }]

describe('contractAmountSource', () => {
  it('the estimate the customer accepted wins over the line items', () => {
    const src = contractAmountSource({ job: { revenue: 123600, fixtures }, acceptedTotalCents: 3140000, acceptedOn: '2026-09-12T15:00:00Z' })
    expect(src).toEqual({ source: 'estimate', cents: 3140000, acceptedOn: '2026-09-12T15:00:00Z' })
    expect(contractAmountSourceLabel(src, fmt)).toBe('from the estimate the customer accepted on 2026-09-12')
    expect(contractAmountDoorLabel(src)).toBe('Open the job ›')
  })

  it('else the line items — the revenue the Job form computes from them — with their count', () => {
    const src = contractAmountSource({ job: { revenue: 123600, fixtures }, acceptedTotalCents: null })
    expect(src).toEqual({ source: 'line_items', cents: 12360000, lineCount: 2 })
    expect(contractAmountSourceLabel(src, fmt)).toBe("from the job's 2 line items")
    expect(contractAmountDoorLabel(src)).toBe('Adjust line items ›')
    // A job with a number but no fixture rows (an import): still the job's, worded without a count.
    expect(contractAmountSourceLabel(contractAmountSource({ job: { revenue: 2400 }, acceptedTotalCents: 0 }), fmt)).toBe("from the job's amount")
    expect(contractAmountSourceLabel(contractAmountSource({ job: { revenue: 500, fixtures: [{ name: 'Valve' }] }, acceptedTotalCents: null }), fmt)).toBe("from the job's 1 line item")
  })

  it('nothing on the job: no amount, and the agreement reads as time and materials', () => {
    for (const revenue of [null, 0, -5, Number.NaN]) {
      const src = contractAmountSource({ job: { revenue }, acceptedTotalCents: null })
      expect(src).toEqual({ source: 'none', cents: null })
      expect(contractAmountSourceLabel(src, fmt)).toBe('the agreement says time and materials, billed at completion')
      expect(contractAmountDoorLabel(src)).toBe('Add line items ›')
    }
  })
})

describe('contractAmountDrift', () => {
  const src = contractAmountSource({ job: { revenue: 123600, fixtures }, acceptedTotalCents: null })
  it('names a draft that carries a different number, or none where the job has one', () => {
    expect(contractAmountDrift(src, 12000000)).toEqual({ draftCents: 12000000 })
    expect(contractAmountDrift(src, null)).toEqual({ draftCents: null })
  })
  it('is quiet when the draft agrees, or when there is no draft at all', () => {
    expect(contractAmountDrift(src, 12360000)).toBeNull()
    expect(contractAmountDrift(src, undefined)).toBeNull()
    const none = contractAmountSource({ job: { revenue: null }, acceptedTotalCents: null })
    expect(contractAmountDrift(none, null)).toBeNull()
    expect(contractAmountDrift(none, 500)).toEqual({ draftCents: 500 })
  })
})
