import { describe, expect, it } from 'vitest'
// Deno edge module (supabase/functions/_shared), tested here.
import {
  USUAL_PAY_MIN_PAYMENTS,
  attachUsualPay,
  isUsualPayWeeks,
  payerGapDays,
  usualPayBySheet,
  usualPayDays,
  usualPaySheets,
  usualPayWeeks,
  type UsualPaySheetRow,
} from '../../../supabase/functions/_shared/subPortalCustomerPaid'
import { parsePaySpeedsRpc } from '../jobs/billedExpectedPay'
import { paySpeedSpread } from '../jobs/paymentReliability'

// Made-up payers, days and jobs throughout.

describe('the floor: five payments, or the page says nothing', () => {
  it('is five', () => {
    expect(USUAL_PAY_MIN_PAYMENTS).toBe(5)
  })

  it('says nothing below five, however steady the payer', () => {
    expect(usualPayWeeks([])).toBeNull()
    expect(usualPayWeeks([30])).toBeNull()
    expect(usualPayWeeks([30, 30, 30, 30])).toBeNull()
  })

  it('speaks at five', () => {
    expect(usualPayWeeks([30, 30, 30, 30, 30])).toEqual({ lo: 4, hi: 5 })
  })

  it('does not count a gap that is no number or runs backwards', () => {
    expect(usualPayWeeks([30, 30, 30, 30, Number.NaN])).toBeNull()
    expect(usualPayWeeks([30, 30, 30, 30, -2])).toBeNull()
    expect(usualPayWeeks([30, 30, 30, 30, Number.POSITIVE_INFINITY])).toBeNull()
  })
})

describe('the weeks hold the days', () => {
  it('rounds the fast end down and the slow end up', () => {
    // Sorted: 9 20 30 41 60. The 25th percentile is 20 and the 75th is 41.
    expect(usualPayDays([41, 9, 60, 20, 30])).toEqual({ loDays: 20, hiDays: 41, samples: 5 })
    expect(usualPayWeeks([41, 9, 60, 20, 30])).toEqual({ lo: 2, hi: 6 })
  })

  it('reads a range that sits on whole weeks as those weeks', () => {
    expect(usualPayWeeks([28, 28, 35, 42, 42])).toEqual({ lo: 4, hi: 6 })
  })

  it('reads one figure when both ends land on the same whole week', () => {
    expect(usualPayWeeks([14, 14, 14, 14, 14])).toEqual({ lo: 2, hi: 2 })
    expect(usualPayWeeks([28, 28, 28, 28, 28, 28])).toEqual({ lo: 4, hi: 4 })
  })

  it('reads within a week when the slow end is a week or less', () => {
    expect(usualPayWeeks([0, 1, 2, 3, 4])).toEqual({ lo: 0, hi: 1 })
    expect(usualPayWeeks([7, 7, 7, 7, 7])).toEqual({ lo: 0, hi: 1 })
    expect(usualPayWeeks([0, 0, 0, 0, 0])).toEqual({ lo: 0, hi: 1 })
  })

  it('never says zero weeks at the fast end of a range', () => {
    // 25th percentile 2 days, 75th 10 days.
    expect(usualPayDays([1, 2, 5, 10, 30])).toEqual({ loDays: 2, hiDays: 10, samples: 5 })
    expect(usualPayWeeks([1, 2, 5, 10, 30])).toEqual({ lo: 1, hi: 2 })
  })

  it('never reads about one week: one week and under is within a week', () => {
    for (let lo = 0; lo <= 80; lo++) {
      for (let hi = lo; hi <= 80; hi += 3) {
        const w = usualPayWeeks([lo, lo, lo, hi, hi, hi, hi, lo])
        expect(w).not.toBeNull()
        expect(isUsualPayWeeks(w)).toBe(true)
        if (w!.lo === w!.hi) expect(w!.lo).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('always holds the office’s days inside its weeks', () => {
    const sets = [
      [3, 9, 12, 19, 33, 47, 51],
      [8, 8, 9, 9, 10],
      [29, 31, 34, 36, 38, 90],
      [60, 61, 75, 80, 120, 14, 2],
    ]
    for (const gaps of sets) {
      const days = usualPayDays(gaps)!
      const w = usualPayWeeks(gaps)!
      expect(w.hi * 7).toBeGreaterThanOrEqual(days.hiDays)
      if (w.lo > 0) expect(w.lo * 7 <= days.loDays || w.lo === 1).toBe(true)
    }
  })
})

describe('the same figures as the office’s row', () => {
  const receipt = (gapDays: number, i: number) => ({ billedYmd: '2026-05-01', paidYmd: `2026-06-${String(10 + i).padStart(2, '0')}`, gapDays, jobId: `job-${i}`, jobName: 'Made-up job', address: null })
  const raw = {
    company: { medianDays: 30, samples: 40 },
    customers: {},
    receipts: {
      'payer-a': [41, 9, 60, 20, 30, 33, 12].map(receipt),
      'payer-b': [14, 15, 16, 22, 28, 31, 35, 44, 51, 63, 70, 90].map(receipt),
      'payer-thin': [10, 12, 14, 16].map(receipt),
      'payer-bad': [{ billedYmd: 'soon', paidYmd: '2026-06-01', gapDays: 12 }, { billedYmd: '2026-05-01', paidYmd: '2026-06-01', gapDays: -3 }, { billedYmd: '2026-05-01', paidYmd: '2026-06-01', gapDays: '12' }, null],
      'payer-odd': 'not a list',
    },
  }

  it('reads the receipts as the office’s own parser does', () => {
    const office = parsePaySpeedsRpc(raw)!
    const mine = payerGapDays(raw)
    expect([...mine.keys()].sort()).toEqual(Object.keys(office.receipts).sort())
    for (const [id, list] of Object.entries(office.receipts)) expect(mine.get(id)).toEqual(list.map((r) => r.gapDays))
    expect(mine.has('payer-bad')).toBe(false)
    expect(mine.has('payer-odd')).toBe(false)
  })

  it('gives the days the office’s spread gives, for every payer at the floor', () => {
    const office = parsePaySpeedsRpc(raw)!
    const mine = payerGapDays(raw)
    for (const id of ['payer-a', 'payer-b']) {
      const spread = paySpeedSpread(office.receipts[id])!
      expect(usualPayDays(mine.get(id)!)).toEqual({ loDays: spread.loDays, hiDays: spread.hiDays, samples: spread.samples })
    }
    // The office shows a thin payer; the sub's page does not.
    expect(paySpeedSpread(office.receipts['payer-thin'])).not.toBeNull()
    expect(usualPayDays(mine.get('payer-thin')!)).toBeNull()
  })

  it('answers nothing for a refused or malformed answer', () => {
    expect(payerGapDays(null).size).toBe(0)
    expect(payerGapDays('no').size).toBe(0)
    expect(payerGapDays({}).size).toBe(0)
    expect(payerGapDays({ receipts: [] }).size).toBe(0)
  })
})

describe('which sheets the line may show on', () => {
  const sheet = (id: string, over: Partial<UsualPaySheetRow> = {}): UsualPaySheetRow => ({ id, stage: 'customer_pay', job_ledger_id: 'job-1', draw_invoice_id: null, payable_after: null, ...over })
  const jobs = [
    { id: 'job-1', bill_to_party: 'customer', customer_id: 'payer-steady', gc_customer_id: 'payer-builder' },
    { id: 'job-gc', bill_to_party: 'gc', customer_id: 'payer-steady', gc_customer_id: 'payer-builder' },
    { id: 'job-thin', bill_to_party: 'customer', customer_id: 'payer-thin', gc_customer_id: null },
    { id: 'job-nobody', bill_to_party: 'customer', customer_id: null, gc_customer_id: null },
  ]
  const bills = [
    { id: 'bill-plain', bill_to_party: null, bill_to_email: null },
    { id: 'bill-gc', bill_to_party: 'gc', bill_to_email: null },
    { id: 'bill-typed', bill_to_party: null, bill_to_email: 'someone@example.com' },
  ]
  const gapsByPayer = new Map<string, number[]>([
    ['payer-steady', [28, 28, 35, 42, 42]],
    ['payer-builder', [60, 61, 62, 63, 64, 65]],
    ['payer-thin', [10, 12, 14, 16]],
  ])
  const run = (sheets: UsualPaySheetRow[], paidDays = new Map<string, string>()) => usualPayBySheet({ sheets, paidDays, jobs, bills, gapsByPayer })

  it('shows on a sheet waiting on the customer, from the job’s own payer', () => {
    expect(run([sheet('s1')]).get('s1')).toEqual({ lo: 4, hi: 6 })
  })

  it('reads the builder’s pace on a bill that goes to the builder', () => {
    expect(run([sheet('s1', { draw_invoice_id: 'bill-gc' })]).get('s1')).toEqual({ lo: 8, hi: 10 })
    expect(run([sheet('s2', { job_ledger_id: 'job-gc' })]).get('s2')).toEqual({ lo: 8, hi: 10 })
    expect(run([sheet('s3', { draw_invoice_id: 'bill-plain' })]).get('s3')).toEqual({ lo: 4, hi: 6 })
  })

  it('says nothing for a bill typed to someone else: there is no payer of record', () => {
    expect(run([sheet('s1', { draw_invoice_id: 'bill-typed' })]).size).toBe(0)
  })

  it('says nothing for a payer below the floor, a job that names nobody, or a sheet on no job', () => {
    expect(run([sheet('s1', { job_ledger_id: 'job-thin' })]).size).toBe(0)
    expect(run([sheet('s2', { job_ledger_id: 'job-nobody' })]).size).toBe(0)
    expect(run([sheet('s3', { job_ledger_id: null })]).size).toBe(0)
    expect(run([sheet('s4', { job_ledger_id: 'job-unknown' })]).size).toBe(0)
  })

  it('goes away once the customer paid, once the sheet has a pay day, and off the stage', () => {
    expect(run([sheet('s1')], new Map([['s1', '2026-11-12']])).size).toBe(0)
    expect(run([sheet('s2', { payable_after: '2026-11-27' })]).size).toBe(0)
    expect(run([sheet('s3', { stage: 'walkthrough' })]).size).toBe(0)
    expect(run([sheet('s4', { stage: 'working' })]).size).toBe(0)
    expect(usualPaySheets([sheet('a'), sheet('b', { payable_after: ' ' })], new Map()).map((s) => s.id)).toEqual(['a', 'b'])
  })

  it('puts the weeks on the payload’s sheet and leaves the others as they came', () => {
    const a = { id: 's1', agreed: 900 }
    const b = { id: 's2', agreed: 400 }
    const out = attachUsualPay([a, b], new Map([['s1', { lo: 4, hi: 6 }]]))
    expect(out[0]).toEqual({ id: 's1', agreed: 900, usualPayWeeks: { lo: 4, hi: 6 } })
    expect(out[1]).toBe(b)
  })
})

describe('what the page will draw off the wire', () => {
  it('takes the three shapes', () => {
    expect(isUsualPayWeeks({ lo: 0, hi: 1 })).toBe(true)
    expect(isUsualPayWeeks({ lo: 4, hi: 4 })).toBe(true)
    expect(isUsualPayWeeks({ lo: 4, hi: 6 })).toBe(true)
    expect(isUsualPayWeeks({ lo: 1, hi: 2 })).toBe(true)
  })

  it('drops anything else', () => {
    for (const bad of [null, undefined, 'soon', 4, {}, { lo: 4 }, { lo: 6, hi: 4 }, { lo: 0, hi: 2 }, { lo: 1, hi: 1 }, { lo: 0, hi: 0 }, { lo: 4.5, hi: 6 }, { lo: '4', hi: '6' }, { lo: -1, hi: 3 }, { lo: 4, hi: 500 }]) {
      expect(isUsualPayWeeks(bad)).toBe(false)
    }
  })
})
