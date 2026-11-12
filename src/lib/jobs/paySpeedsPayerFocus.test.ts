import { describe, expect, it } from 'vitest'
import type { PayReceipt, PaySpeedData } from './billedExpectedPay'
import type { StageRow } from '../jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { buildPaySpeedsPayerFocus, payerRangeSentence } from './paySpeedsPayerFocus'
import { paySpeedSpread } from './paymentReliability'

const receipt = (gapDays: number, i: number): PayReceipt => ({ billedYmd: `2026-0${(i % 8) + 1}-01`, paidYmd: `2026-0${(i % 8) + 1}-20`, gapDays, jobId: `job-${i}`, jobName: `Made-up job ${i}`, address: null })
const receipts = (gaps: number[]) => gaps.map(receipt)

function billedRow(customerId: string, name: string, amount: number, jobName: string): StageRow {
  const job = { id: `j-${jobName}`, customer_id: customerId, customer_name: name, job_name: jobName, job_address: '1 Example St', payments: [], invoices: [] } as unknown as JobWithDetails
  return { kind: 'invoice', job, inv: { id: `inv-${jobName}`, job_id: job.id, amount, status: 'billed', sequence_order: 1, billed_at: '2026-08-01T15:00:00Z' } } as unknown as StageRow
}

const speeds = (over: Partial<PaySpeedData> = {}): PaySpeedData => ({
  company: { medianDays: 11, samples: 40 },
  customers: { diner: { medianDays: 21, samples: 9 } },
  segments: { residential: null, commercial: { medianDays: 18, samples: 30 } },
  customerTypes: { diner: 'commercial' },
  receipts: { diner: receipts([2, 3, 3, 9, 21, 40, 67, 67, 90]) },
  quality: null,
  ...over,
})

describe('payerRangeSentence', () => {
  it('says the middle half and the middle one from four payments up', () => {
    const spread = paySpeedSpread(receipts([2, 3, 3, 9, 21, 40, 67, 67, 90]))!
    expect([spread.loDays, spread.hiDays, spread.medianDays]).toEqual([3, 67, 21])
    expect(payerRangeSentence(spread)).toBe('The middle half of their last 9 measured payments came 3 to 67 days after the bill. The middle one took 21 days.')
  })

  it('says every payment when there are two or three, and the one when there is one', () => {
    expect(payerRangeSentence(paySpeedSpread(receipts([5, 30])))).toBe('Their 2 measured payments came 5 to 30 days after the bill.')
    expect(payerRangeSentence(paySpeedSpread(receipts([1])))).toBe('Their one measured payment came 1 day after the bill.')
  })

  it('says what the forecast uses when nothing can be measured', () => {
    expect(payerRangeSentence(null)).toBe('No payment of theirs can be measured yet. Their expected day borrows a pace from payers like them.')
  })
})

describe('buildPaySpeedsPayerFocus', () => {
  const rows = [billedRow('diner', 'Made Up Diner', 1070, 'Sink drain'), billedRow('diner', 'Made Up Diner', 250, 'Pretest'), billedRow('other', 'Someone Else', 900, 'Other job')]

  it('carries the row’s own words, the payments behind them and what the payer owes now', () => {
    const f = buildPaySpeedsPayerFocus({ id: 'diner', name: 'Made Up Diner' }, rows, speeds(), '2026-08-26')
    expect(f.name).toBe('Made Up Diner')
    expect(f.paysIn).toBe('Pays in 3–67d')
    expect(f.medianDays).toBe(21)
    expect(f.samples).toBe(9)
    expect(f.segment).toBe('commercial')
    expect(f.receipts).toHaveLength(9)
    expect(f.bills.map((b) => b.jobName).sort()).toEqual(['Pretest', 'Sink drain'])
    expect(f.open).toBe(1320)
  })

  it('a payer with no measurable payment gets no range, the borrowed-pace sentence, and still their open bills', () => {
    const f = buildPaySpeedsPayerFocus({ id: 'other', name: 'Someone Else' }, rows, speeds(), '2026-08-26')
    expect(f.paysIn).toBeNull()
    expect(f.medianDays).toBeNull()
    expect(f.samples).toBe(0)
    expect(f.sentence).toMatch(/^No payment of theirs can be measured yet\./)
    expect(f.bills).toHaveLength(1)
  })

  it('falls back to a plain name and survives pay speeds that have not loaded', () => {
    const f = buildPaySpeedsPayerFocus({ id: 'diner', name: '  ' }, rows, null, '2026-08-26')
    expect(f.name).toBe('This customer')
    expect(f.paysIn).toBeNull()
    expect(f.receipts).toEqual([])
    expect(f.open).toBe(1320)
  })
})
