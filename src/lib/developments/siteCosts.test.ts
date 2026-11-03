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

describe('the breakdown under a job (v2.6457)', () => {
  const rows: SiteCostRows = {
    ...ROWS,
    cardAlloc: [
      { job_id: 'j1', id: 'a1', mercury_transaction_id: 'tx1', amount: -150, note: null, mercury_transactions: { posted_at: '2026-10-01', counterparty_name: 'Ferguson', amount: -150, raw: null } },
      { job_id: 'j1', id: 'a2', mercury_transaction_id: 'tx2', amount: -60, note: null, mercury_transactions: { posted_at: '2026-10-02', counterparty_name: 'Lowes', amount: -60, raw: null } },
    ],
    // tx2 sits on a supply invoice too: the total counts it once, under the invoice, so the card lines leave it out.
    cardExclusions: { bucketByTxId: new Map(), invoiceLinkedTxIds: new Set(['tx2']) },
    sheets: [
      { id: 's1', job_ledger_id: 'j1', labor_rate: 50, distance_miles: 0, assigned_to_name: 'Reyes Excavating' },
      { id: 's2', job_ledger_id: 'j1', labor_rate: 50, distance_miles: 10, assigned_to_name: ' Reyes Excavating ' },
      { id: 's3', job_ledger_id: 'j1', labor_rate: 40, distance_miles: 0, assigned_to_name: 'Behar | Malachi' },
    ],
    items: [
      { job_id: 's1', count: 2, hrs_per_unit: 3, is_fixed: false, labor_rate: 50, direct_labor_amount: null },
      { job_id: 's2', count: 1, hrs_per_unit: 2, is_fixed: false, labor_rate: 50, direct_labor_amount: null },
      { job_id: 's3', count: 1, hrs_per_unit: 5, is_fixed: false, labor_rate: 40, direct_labor_amount: null },
    ],
    supplyAlloc: [
      { job_id: 'j1', pct: 100, supply_house_invoices: { invoice_number: '1', invoice_date: '2026-10-01', amount: 1000, is_paid: true, on_job_account: false, supply_houses: { name: 'Ferguson' } } },
      { job_id: 'j1', pct: 50, supply_house_invoices: { invoice_number: '2', invoice_date: '2026-10-02', amount: 601, is_paid: false, on_job_account: false, supply_houses: { name: 'Moore Supply' } } },
      { job_id: 'j2', pct: 100, supply_house_invoices: { invoice_number: '3', invoice_date: '2026-10-03', amount: 80, is_paid: true, on_job_account: false, supply_houses: [{ name: 'Ferguson' }] } },
    ],
  }
  const m = jobCostsFromRows(rows)
  const j1 = m.get('j1')!

  it('the sheets group by the names on them and add up to the sub labor', () => {
    expect(j1.breakdown.subs.map((s) => [s.name, s.sheets])).toEqual([
      ['Reyes Excavating', 2],
      ['Behar, Malachi', 1],
    ])
    expect(j1.breakdown.subs.reduce((t, s) => t + s.usd, 0)).toBeCloseTo(j1.subLabor, 6)
  })

  it('the supply invoices group by house, each invoice at its share of the job', () => {
    expect(j1.breakdown.suppliers).toEqual([
      { name: 'Ferguson', usd: 1000, invoices: 1 },
      { name: 'Moore Supply', usd: 300.5, invoices: 1 },
    ])
    expect(j1.breakdown.suppliers.reduce((t, s) => t + s.usd, 0)).toBe(1300.5)
    expect(m.get('j2')!.breakdown.suppliers).toEqual([{ name: 'Ferguson', usd: 80, invoices: 1 }])
  })

  it('the card lines are the ones the total counts, as costs', () => {
    expect(j1.breakdown.cardLines).toEqual([{ txId: 'tx1', usd: 150 }])
    expect(j1.parts.cardCharges).toBe(150)
  })

  it('the tally and other charges are counted as lines; a job with nothing has an empty breakdown', () => {
    expect(j1.breakdown.otherLines).toBe(1)
    expect(m.get('j3')!.breakdown).toEqual({ subs: [], suppliers: [], cardLines: [], tallyLines: 0, otherLines: 0 })
  })
})
