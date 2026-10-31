/**
 * The costs on a site's jobs (v2.6215): grouped by job from one batched read, totalled with the shared
 * kernels. Harlow Ranch's made-up rows; nothing is real.
 */
import { describe, expect, it } from 'vitest'
import { EMPTY_CARD_CHARGE_EXCLUSIONS } from '../../../supabase/functions/_shared/cardChargeAllocationFilter'
import { canSeeSiteCosts, costBreakdownWords, jobCostsFromRows, type SiteCostRows } from './siteCosts'

const money = (n: number) => `$${n.toLocaleString('en-US')}`

const ROWS: SiteCostRows = {
  jobIds: ['j1', 'j2', 'j3'],
  invoiceAmounts: [
    { job_id: 'j1', invoice_amount: '1500.50' },
    { job_id: 'j2', invoice_amount: 80 },
  ],
  // The bank's sign: a purchase is negative; cost is money out.
  cardAlloc: [{ job_id: 'j1', id: 'a1', mercury_transaction_id: 'tx1', amount: -150, note: null, mercury_transactions: { posted_at: '2026-10-01', counterparty_name: 'Ferguson', amount: -150, raw: null } }],
  cardExclusions: EMPTY_CARD_CHARGE_EXCLUSIONS,
  tally: [{ job_ledger_id: 'j1', quantity: 2, unit_cost: 25 } as unknown as SiteCostRows['tally'][number]],
  otherCharges: [{ job_id: 'j1', amount: 40 }, { job_id: 'j2', amount: null }],
  sheets: [{ id: 's1', job_ledger_id: 'j1', labor_rate: 50, distance_miles: 0 }],
  items: [{ job_id: 's1', count: 2, hrs_per_unit: 3, is_fixed: false, labor_rate: 50, direct_labor_amount: null }],
  settings: [],
}

describe('jobCostsFromRows', () => {
  it('groups every bucket by job and totals parts and sub labor; a job with nothing reads zero', () => {
    const m = jobCostsFromRows(ROWS)
    const j1 = m.get('j1')!
    expect(j1.parts.supplyInvoices).toBe(1500.5)
    expect(j1.parts.cardCharges).toBe(150)
    expect(j1.parts.otherCharges).toBe(40)
    expect(j1.subLabor).toBe(300)
    expect(j1.total).toBe(1500.5 + 150 + j1.parts.tallyParts + 40 + 300)
    expect(m.get('j2')!.total).toBe(80)
    expect(m.get('j3')!.total).toBe(0)
  })
  it('the breakdown names the buckets that carry money, or says none is on the job', () => {
    const m = jobCostsFromRows(ROWS)
    expect(costBreakdownWords(m.get('j2')!, money)).toBe('supply houses $80')
    expect(costBreakdownWords(m.get('j3')!, money)).toBe('No cost is on this job yet.')
    expect(costBreakdownWords(m.get('j1')!, money)).toContain('sub labor $300')
  })
})

describe('canSeeSiteCosts', () => {
  it('dev and controller only', () => {
    expect(['dev', 'controller'].every(canSeeSiteCosts)).toBe(true)
    expect(['master_technician', 'assistant', 'estimator', 'primary', null, undefined].some(canSeeSiteCosts)).toBe(false)
  })
})
