import { describe, expect, it } from 'vitest'
import {
  allocatedInvoiceDollars,
  breakDollarsFromCombinedPct,
  breakOffPrefillAmountStringFromJob,
  clampTypedBreakOffAmount,
  combinedPctFromTrackRatio,
  snapBreakOffCombinedPctToStep,
  unallocatedBillableDollars,
} from './jobFormBreakOff'
import type { JobWithDetails } from '../../types/jobWithDetails'

describe('allocatedInvoiceDollars', () => {
  it('sums ready_to_bill + billed amounts and ignores other statuses', () => {
    const invoices = [
      { status: 'ready_to_bill', amount: 300 },
      { status: 'billed', amount: 200 },
      { status: 'void', amount: 999 }, // ignored
      { status: 'billed', amount: '50' }, // tolerates string amounts
    ]
    expect(allocatedInvoiceDollars(invoices)).toBe(550)
  })
  it('returns 0 for null/undefined/empty', () => {
    expect(allocatedInvoiceDollars(null)).toBe(0)
    expect(allocatedInvoiceDollars(undefined)).toBe(0)
    expect(allocatedInvoiceDollars([])).toBe(0)
  })
  it('excludes the elastic primary RTB remainder bundle (it equals whatever is unbilled)', () => {
    const invoices = [
      { status: 'ready_to_bill', amount: 1650, is_primary_rtb_bundle: true }, // the auto row
      { status: 'ready_to_bill', amount: 1980, is_primary_rtb_bundle: false },
      { status: 'billed', amount: 200, is_primary_rtb_bundle: null },
    ]
    expect(allocatedInvoiceDollars(invoices)).toBe(2180)
  })
  it('still counts a BILLED row even if it carries a stale primary flag', () => {
    expect(allocatedInvoiceDollars([{ status: 'billed', amount: 500, is_primary_rtb_bundle: true }])).toBe(500)
  })
})

describe('unallocatedBillableDollars', () => {
  it('is gross minus paid minus ready_to_bill + billed invoice amounts', () => {
    const invoices = [
      { status: 'ready_to_bill', amount: 300 },
      { status: 'billed', amount: 200 },
      { status: 'void', amount: 999 }, // ignored
    ]
    expect(unallocatedBillableDollars(1000, 100, invoices)).toBe(400) // 1000 − 100 − 500
  })
  it('floors at zero and tolerates null invoices', () => {
    expect(unallocatedBillableDollars(100, 250, null)).toBe(0)
    expect(unallocatedBillableDollars(500, 0, undefined)).toBe(500)
  })
  it('a Ready-to-Bill job with only the auto bundle has its full total left to bill', () => {
    // Taunya's job 978 start state: gross 3,630, auto draft 3,630 — the input
    // stack read "$0 left" and clamped typed amounts to zero.
    const invoices = [{ status: 'ready_to_bill', amount: 3630, is_primary_rtb_bundle: true }]
    expect(unallocatedBillableDollars(3630, 0, invoices)).toBe(3630)
  })
  it('mid-flow: one segment invoice carved, auto bundle resized — remainder is the second segment', () => {
    const invoices = [
      { status: 'ready_to_bill', amount: 1980, is_primary_rtb_bundle: false },
      { status: 'ready_to_bill', amount: 1650, is_primary_rtb_bundle: true },
    ]
    expect(unallocatedBillableDollars(3630, 0, invoices)).toBe(1650)
  })
})

describe('breakDollarsFromCombinedPct', () => {
  it('converts combined % to break-off dollars, clamped to remaining', () => {
    // 80% of 1000 = 800; minus 200 paid = 600 break; remaining 700 → 600
    expect(breakDollarsFromCombinedPct(80, 1000, 200, 700)).toBe(600)
    // clamps to remaining when break would exceed it
    expect(breakDollarsFromCombinedPct(100, 1000, 0, 400)).toBe(400)
    // floors at 0 when paid already exceeds the target %
    expect(breakDollarsFromCombinedPct(10, 1000, 200, 700)).toBe(0)
  })
})

describe('snapBreakOffCombinedPctToStep', () => {
  it('snaps to the nearest step and clamps to [min,max]', () => {
    expect(snapBreakOffCombinedPctToStep(52, 0, 100)).toBe(50)
    expect(snapBreakOffCombinedPctToStep(53, 0, 100)).toBe(55)
    expect(snapBreakOffCombinedPctToStep(3, 20, 100)).toBe(20) // below min
    expect(snapBreakOffCombinedPctToStep(97, 0, 90)).toBe(90) // above max
  })
})

describe('clampTypedBreakOffAmount', () => {
  it('keeps an exact typed amount that fits within the remaining dollars (no 5% snap)', () => {
    // The Job 523 repro: 81,916.60 typed on a $123,600 job with $123,600
    // remaining used to snap to 80,340 (the nearest 5% step). It must survive.
    expect(clampTypedBreakOffAmount(81916.6, 123600)).toBe(81916.6)
    expect(clampTypedBreakOffAmount(0.01, 1000)).toBe(0.01)
  })
  it('clamps to the remaining unallocated dollars', () => {
    expect(clampTypedBreakOffAmount(1500, 1000)).toBe(1000)
    expect(clampTypedBreakOffAmount(700.005, 700)).toBe(700)
  })
  it('rounds to cents and floors at zero', () => {
    expect(clampTypedBreakOffAmount(12.345, 1000)).toBe(12.35)
    expect(clampTypedBreakOffAmount(-5, 1000)).toBe(0)
    expect(clampTypedBreakOffAmount(5, 0)).toBe(0)
  })
})

describe('breakOffPrefillAmountStringFromJob', () => {
  const job = (over: Partial<JobWithDetails>) => ({ revenue: 0, payments: [], invoices: [], ...over }) as unknown as JobWithDetails
  it('prefills 80% of gross when little is paid', () => {
    expect(breakOffPrefillAmountStringFromJob(job({ revenue: 1000 }))).toBe('800.00')
  })
  it('prefills 95% once more than 80% is already paid', () => {
    expect(breakOffPrefillAmountStringFromJob(job({ revenue: 1000, payments: [{ amount: 850 } as never] }))).toBe('150.00')
    // 95% target = 950, but remaining = 1000−850 = 150 → clamped to 150
  })
  it('is empty when nothing is left to bill', () => {
    expect(breakOffPrefillAmountStringFromJob(job({ revenue: 0 }))).toBe('')
    expect(breakOffPrefillAmountStringFromJob(job({ revenue: 1000, invoices: [{ status: 'billed', amount: 1000 } as never] }))).toBe('')
  })
})

describe('combinedPctFromTrackRatio', () => {
  it('maps the track ratio straight onto the 0-100 axis (ticks line up with clicks)', () => {
    expect(combinedPctFromTrackRatio(0.4, 0, 100)).toBe(40)
    expect(combinedPctFromTrackRatio(0.8, 0, 100)).toBe(80)
  })
  it('bounds clamp but never compress the axis (v2.776 slider-jump bug)', () => {
    // Summit repro: $13,040 of $32,600 already billed -> max 60%. A click at
    // the 40% tick must read 40%, not 0 + 0.4*(60-0) = 24%.
    expect(combinedPctFromTrackRatio(0.4, 0, 60)).toBe(40)
    // Past max clamps to max instead of stretching the scale.
    expect(combinedPctFromTrackRatio(0.8, 0, 60)).toBe(60)
    // Below min (paid floor) clamps up.
    expect(combinedPctFromTrackRatio(0.1, 30, 100)).toBe(30)
  })
  it('tolerates out-of-range ratios from pointer capture', () => {
    expect(combinedPctFromTrackRatio(-0.5, 0, 100)).toBe(0)
    expect(combinedPctFromTrackRatio(1.5, 0, 90)).toBe(90)
  })
})
