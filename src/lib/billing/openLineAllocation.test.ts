import { describe, expect, it } from 'vitest'
import { allocatedOpenCents, appliedCentsByInvoiceId, isRtbPrimaryBundle, moneyCents, openLineCents } from './openLineAllocation'

describe('moneyCents', () => {
  it('rounds dollars to cents and treats blanks / junk as zero', () => {
    expect(moneyCents(1072.5)).toBe(107250)
    expect(moneyCents('53.63')).toBe(5363)
    expect(moneyCents(0.1 + 0.2)).toBe(30)
    expect(moneyCents(null)).toBe(0)
    expect(moneyCents(undefined)).toBe(0)
    expect(moneyCents('abc')).toBe(0)
  })
})

describe('appliedCentsByInvoiceId', () => {
  it('sums linked payments per invoice and skips unlinked ones', () => {
    const m = appliedCentsByInvoiceId([
      { invoice_id: 'a', amount: 1000 },
      { invoice_id: 'a', amount: 18.87 },
      { invoice_id: null, amount: 1980.13 },
      { amount: 5 },
    ])
    expect(m.get('a')).toBe(101887)
    expect(m.size).toBe(1)
  })
  it('is empty for nothing', () => {
    expect(appliedCentsByInvoiceId(null).size).toBe(0)
    expect(appliedCentsByInvoiceId(undefined).size).toBe(0)
  })
})

describe('openLineCents', () => {
  it('is the amount net of what was applied, floored at zero', () => {
    expect(openLineCents(1072.5, 101887)).toBe(5363)
    expect(openLineCents(1072.5, 0)).toBe(107250)
    expect(openLineCents(100, 12000)).toBe(0)
  })
})

describe('isRtbPrimaryBundle', () => {
  it('is only the ready_to_bill row flagged primary', () => {
    expect(isRtbPrimaryBundle({ status: 'ready_to_bill', is_primary_rtb_bundle: true })).toBe(true)
    expect(isRtbPrimaryBundle({ status: 'ready_to_bill', is_primary_rtb_bundle: false })).toBe(false)
    expect(isRtbPrimaryBundle({ status: 'billed', is_primary_rtb_bundle: true })).toBe(false)
  })
})

describe('allocatedOpenCents — what the open lines still put against the remainder', () => {
  const job978 = [
    { id: 'billed', status: 'billed', amount: 1072.5, is_primary_rtb_bundle: false },
  ]
  const payments978 = [
    { invoice_id: 'billed', amount: 1018.87 },
    { invoice_id: null, amount: 1980.13 },
  ]

  it('job 978: a partly paid billed line counts for its unpaid part only', () => {
    expect(allocatedOpenCents(job978, payments978, { excludeRtbPrimary: true })).toBe(5363)
    // Face-amount math (the bug) would have said 107250 here.
  })

  it('with no payments a line counts for its face amount', () => {
    expect(allocatedOpenCents(job978, [], { excludeRtbPrimary: true })).toBe(107250)
    expect(allocatedOpenCents(job978, null, { excludeRtbPrimary: true })).toBe(107250)
  })

  it('an over-applied line stands for nothing, never a negative', () => {
    expect(
      allocatedOpenCents([{ id: 'b', status: 'billed', amount: 100 }], [{ invoice_id: 'b', amount: 150 }], {
        excludeRtbPrimary: true,
      }),
    ).toBe(0)
  })

  it('counts RTB partials and billed rows; never paid or void rows', () => {
    const rows = [
      { id: 'partial', status: 'ready_to_bill', amount: 500 },
      { id: 'billed', status: 'billed', amount: 200 },
      { id: 'paid', status: 'paid', amount: 999 },
      { id: 'void', status: 'void', amount: 999 },
    ]
    expect(allocatedOpenCents(rows, [], { excludeRtbPrimary: true })).toBe(70000)
  })

  it('excludeRtbPrimary drops the elastic bundle; a billed row with a stale primary flag still counts', () => {
    const rows = [
      { id: 'auto', status: 'ready_to_bill', amount: 3000, is_primary_rtb_bundle: true },
      { id: 'billed-primary', status: 'billed', amount: 100, is_primary_rtb_bundle: true },
      { id: 'partial', status: 'ready_to_bill', amount: 500 },
    ]
    expect(allocatedOpenCents(rows, [], { excludeRtbPrimary: true })).toBe(60000)
    expect(allocatedOpenCents(rows, [], { excludeRtbPrimary: false })).toBe(360000)
  })

  it('payments on a line without an id cannot be matched, so the line counts in full', () => {
    expect(allocatedOpenCents([{ status: 'billed', amount: 100 }], [{ invoice_id: 'x', amount: 100 }], { excludeRtbPrimary: true })).toBe(
      10000,
    )
  })
})
