/**
 * The cost summary print: the board's figures on paper, the parts by bucket and by payee under the one card
 * rule, the estimates marked, what the total leaves out, the notes for a read that is not in, and the page.
 * Harlow Ranch's made-up rows; nothing is real.
 */
import { describe, expect, it } from 'vitest'
import type { CardChargeExclusions } from '../../../supabase/functions/_shared/cardChargeAllocationFilter'
import type { MemberJob } from './overview'
import { buildScoreboard, type SiteOverheadRead } from './scoreboard'
import { jobCostsFromRows, type SiteCostRows, type SiteCostsRead } from './siteCosts'
import type { SiteLabor, SiteLaborRead } from './siteLabor'
import { buildCostSummary, COST_SUMMARY_PAYEE_LINES, costSummaryPayees, costSummaryPrintHtml, costSummaryStateWords, type CostSummaryInput } from './costSummaryPrint'

function job(over: Partial<MemberJob> & { id: string; click_number: string }): MemberJob {
  return {
    hcp_number: null, job_name: `Job ${over.click_number}`, job_address: null, customer_id: null, customer_name: null, gc_customer_id: null, development_id: 'd1', bid_id: null,
    status: 'working', revenue: 0, payments_made: 0, pct_complete: null, last_work_date: null, last_bill_date: null, job_plans_link: null, created_at: null, updated_at: null, ...over,
  } as MemberJob
}
const JOBS = [
  job({ id: 'j1', click_number: '612', job_name: 'Rough in: main house', status: 'paid', revenue: 24000 }),
  job({ id: 'j2', click_number: '583', job_name: 'Gas line trenching', status: 'working', revenue: 16000, pct_complete: 20 }),
  job({ id: 'j3', click_number: '953', job_name: 'Fire risers, unbilled', status: 'waiting', revenue: 0 }),
]
const LABEL: Record<string, string> = { j1: 'JP612', j2: 'JP583', j3: 'JP953' }
const jobLabel = (j: MemberJob) => LABEL[j.id] ?? j.id

const exclusions: CardChargeExclusions = { bucketByTxId: new Map([['tx-transfer', 'internal_transfer']]), invoiceLinkedTxIds: new Set(['tx-linked']) }

const ROWS: SiteCostRows = {
  jobIds: ['j1', 'j2', 'j3'],
  invoiceAmounts: [
    { job_id: 'j1', invoice_amount: 1200 },
    { job_id: 'j2', invoice_amount: 300 },
  ],
  cardAlloc: [
    { job_id: 'j1', id: 'a1', mercury_transaction_id: 'tx-lowes', amount: -412.5, note: null, mercury_transactions: { posted_at: '2026-03-02T15:00:00Z', counterparty_name: 'Lowe’s', amount: -412.5 } as never },
    { job_id: 'j1', id: 'a2', mercury_transaction_id: 'tx-lowes-2', amount: -87.5, note: null, mercury_transactions: { posted_at: '2026-03-03T15:00:00Z', counterparty_name: 'Lowe’s', amount: -87.5 } as never },
    { job_id: 'j1', id: 'a3', mercury_transaction_id: 'tx-shell', amount: -60, note: null, mercury_transactions: { posted_at: '2026-03-02T17:00:00Z', counterparty_name: 'Shell', amount: -60 } as never },
    { job_id: 'j1', id: 'a4', mercury_transaction_id: 'tx-transfer', amount: -500, note: null, mercury_transactions: { posted_at: '2026-03-03T10:00:00Z', counterparty_name: 'Transfer', amount: -500 } as never },
    { job_id: 'j1', id: 'a5', mercury_transaction_id: 'tx-linked', amount: -200, note: null, mercury_transactions: { posted_at: '2026-03-04T10:00:00Z', counterparty_name: 'Ferguson', amount: -200 } as never },
    { job_id: 'j2', id: 'a6', mercury_transaction_id: 'tx-hd', amount: -75, note: null, mercury_transactions: { posted_at: null, counterparty_name: null, amount: -75 } as never },
  ],
  cardExclusions: exclusions,
  tally: [{ id: 't1', job_id: 'j1', quantity: 2, part_id: 'p1', price_at_time: 12.5, fixture_cost: null, fixture_name: 'Elbow', part_name: '3/4 PVC elbow', created_at: '2026-03-05T12:00:00Z', created_by_name: 'Dana' }],
  otherCharges: [
    { job_id: 'j1', amount: 150, created_at: '2026-03-06T12:00:00Z', description: 'Permit' },
    { job_id: 'j1', amount: 8000, created_at: '2026-03-20T12:00:00Z', description: 'ESTIMATE — Mobilization crews, replace with payroll' },
    { job_id: 'j2', amount: null, created_at: '2026-03-06T12:00:00Z', description: 'Nothing' },
  ],
  sheets: [
    { id: 's1', job_ledger_id: 'j1', labor_rate: 50, distance_miles: 0, assigned_to_name: 'Reyes Excavating', job_date: '2026-03-07', created_at: '2026-03-01T00:00:00Z' },
    { id: 's2', job_ledger_id: 'j2', labor_rate: 40, distance_miles: 0, assigned_to_name: null, job_date: null, created_at: '2026-03-08T00:00:00Z' },
  ],
  items: [
    { job_id: 's1', count: 2, hrs_per_unit: 3, is_fixed: false, labor_rate: 50, direct_labor_amount: null },
    { job_id: 's2', count: 1, hrs_per_unit: 2, is_fixed: false, labor_rate: 40, direct_labor_amount: null },
  ],
  settings: [],
  supplyAlloc: [
    { job_id: 'j1', pct: 100, supply_house_invoices: { invoice_number: '1001', invoice_date: '2026-03-01', amount: 1200, is_paid: true, on_job_account: false, supply_houses: { name: 'Ferguson' } } },
    { job_id: 'j2', pct: 50, supply_house_invoices: { invoice_number: '1002', invoice_date: '2026-03-09', amount: 600, is_paid: false, on_job_account: false, supply_houses: { name: 'Moore Supply' } } },
  ],
}

const LABOR: SiteLabor = {
  byJobId: new Map([
    ['j1', { jobId: 'j1', hours: 16, costUsd: 480, days: 2, people: [
      { personName: 'Luis', personId: 'p1', userId: null, hours: 8, costUsd: 240, days: 1, leadDays: 1 },
      { personName: 'Mateo', personId: 'p2', userId: null, hours: 8, costUsd: 240, days: 2, leadDays: 0 },
    ] }],
    ['j2', { jobId: 'j2', hours: 4, costUsd: 100, days: 1, people: [{ personName: 'Luis', personId: 'p1', userId: null, hours: 4, costUsd: 100, days: 1, leadDays: 0 }] }],
  ]),
  daysKnown: true,
  siteDays: 3,
  people: 2,
}
const laborRead: SiteLaborRead = { state: 'read', labor: LABOR }
const costsRead: SiteCostsRead = { state: 'read', byJobId: jobCostsFromRows(ROWS), rows: ROWS }
const overheadRead: SiteOverheadRead = { state: 'read', byJobId: new Map([['j1', { usd: 300, days: 2 }]]) }

function input(over: Partial<CostSummaryInput> = {}): CostSummaryInput {
  const model = buildScoreboard({ jobs: JOBS, invoices: [], jobLabel, labor: over.labor ?? laborRead, costs: over.costs ?? costsRead, overhead: over.overhead ?? overheadRead })
  return {
    model,
    costs: costsRead,
    labor: laborRead,
    overhead: overheadRead,
    head: { siteName: 'Harlow Ranch', line: 'Harlow Holdings · 3 jobs, 2 with money on them · 1 bid', small: '$12,000 left to collect · 2 people on it', printedAt: 'Mar 10, 2026, 9:14 AM', printedBy: 'Dana' },
    jobLabelOf: (id) => LABEL[id] ?? id,
    toYmd: (iso) => iso.slice(0, 10),
    overheadSince: 'Feb 19, 2026',
    ...over,
  }
}

describe('buildCostSummary', () => {
  it('carries the board’s totals and a row per job with money, in the board’s order', () => {
    const s = buildCostSummary(input())
    expect(s.totals).toEqual(input().model.site)
    expect(s.jobs.map((j) => j.label)).toEqual(['JP612', 'JP583'])
    expect(s.jobs[0]).toMatchObject({ name: 'Rough in: main house', state: 'paid' })
    expect(s.jobs[1]?.state).toBe('working · 20%')
    expect(s.emptyJobs).toBe(1)
  })

  it('sums the clock’s people over the site and the subs by the names on the sheets', () => {
    const s = buildCostSummary(input())
    expect(s.people).toEqual([
      { name: 'Luis', hours: 12, days: 2, usd: 340 },
      { name: 'Mateo', hours: 8, days: 2, usd: 240 },
    ])
    expect(s.subs.map((x) => [x.name, x.usd, x.sheets])).toEqual([
      ['Reyes Excavating', 300, 1],
      ['A sub sheet with no name', 80, 1],
    ])
  })

  it('totals the four buckets as the Costs column does and counts their rows', () => {
    const s = buildCostSummary(input())
    // The invoice RPC's figures (1200 + 300); the card rule: 412.5 + 87.5 + 60 + 75 count, the transfer and the linked charge do not.
    expect(s.buckets).toEqual({ supply: { rows: 2, usd: 1500 }, card: { rows: 4, usd: 635 }, tally: { rows: 1, usd: 25 }, other: { rows: 2, usd: 8150 } })
    const parts = s.buckets.supply.usd + s.buckets.card.usd + s.buckets.tally.usd + s.buckets.other.usd
    expect(parts).toBe(s.totals.parts)
  })

  it('groups the counted card charges by payee, largest first, a row with no payee named as such', () => {
    const s = buildCostSummary(input())
    expect(s.payees).toEqual([
      { name: 'Lowe’s', rows: 2, usd: 500 },
      { name: 'No payee on the bank row', rows: 1, usd: 75 },
      { name: 'Shell', rows: 1, usd: 60 },
    ])
    expect(s.rest).toBeNull()
  })

  it('names what the card total leaves out, with the dollars', () => {
    const s = buildCostSummary(input())
    expect(s.leftOut).toEqual({ internal: { rows: 1, usd: 500 }, invoiceLinked: { rows: 1, usd: 200 } })
  })

  it('lists the supply invoices by date with the allocated share, and the other charges with the estimates marked', () => {
    const s = buildCostSummary(input())
    expect(s.supply).toEqual([
      { job: 'JP612', house: 'Ferguson', number: '1001', ymd: '2026-03-01', usd: 1200, paid: true },
      { job: 'JP583', house: 'Moore Supply', number: '1002', ymd: '2026-03-09', usd: 300, paid: false },
    ])
    expect(s.other).toEqual([
      { job: 'JP612', ymd: '2026-03-06', description: 'Permit', usd: 150, estimate: false },
      { job: 'JP612', ymd: '2026-03-20', description: 'ESTIMATE — Mobilization crews, replace with payroll', usd: 8000, estimate: true },
    ])
    expect(s.estimates).toEqual({ rows: 1, usd: 8000 })
    expect(s.notes).toContain('One other charge is an estimate the office wrote, not bank rows: $8,000 of the parts.')
  })

  it('notes the overhead rule with the day the pool began, and the earned rule', () => {
    const s = buildCostSummary(input())
    expect(s.notes).toContain('Overhead is the office day share from the day the pool began, Feb 19, 2026.')
    expect(s.notes.some((n) => n.startsWith('Earned follows the percent done'))).toBe(true)
  })

  it('says when the clock or the ledger did not read, and when days are not known', () => {
    const failed = buildCostSummary(input({ labor: { state: 'failed' }, overhead: { state: 'failed' } }))
    expect(failed.notes).toContain('The clock did not read, so hours, days and labor are not on this page.')
    expect(failed.notes).toContain('The overhead ledger did not read, so overhead is not on this page.')
    expect(failed.people).toEqual([])
    const noDays = buildCostSummary(input({ labor: { state: 'read', labor: { ...LABOR, daysKnown: false } } }))
    expect(noDays.notes).toContain('Days are not known to this reader, so the Days column is left out.')
  })
})

describe('costSummaryPayees', () => {
  it('folds the tail past the line limit into one line that keeps the count and the dollars', () => {
    const lines = Array.from({ length: COST_SUMMARY_PAYEE_LINES + 5 }, (_, i) => ({ payee: `Store ${i}`, usd: 1000 - i }))
    const { payees, rest } = costSummaryPayees(lines)
    expect(payees).toHaveLength(COST_SUMMARY_PAYEE_LINES - 1)
    expect(payees[0]).toEqual({ name: 'Store 0', rows: 1, usd: 1000 })
    expect(rest).toEqual({ payees: 6, rows: 6, usd: 6 * 1000 - (24 + 25 + 26 + 27 + 28 + 29) })
    expect(payees.reduce((s, p) => s + p.usd, 0) + rest!.usd).toBe(lines.reduce((s, l) => s + l.usd, 0))
  })

  it('shows every payee when they fit', () => {
    const { payees, rest } = costSummaryPayees([{ payee: ' Ferguson ', usd: 10 }, { payee: 'Ferguson', usd: 5 }])
    expect(payees).toEqual([{ name: 'Ferguson', rows: 2, usd: 15 }])
    expect(rest).toBeNull()
  })
})

describe('costSummaryStateWords', () => {
  it('reads the status, the percent on a working job, and the flags, no percent folded under assumed', () => {
    expect(costSummaryStateWords({ status: 'working', pct: 20, flags: [] })).toBe('working · 20%')
    expect(costSummaryStateWords({ status: 'working', pct: null, flags: ['assumed-50', 'no-pct'] })).toBe('working · ≈ 50% assumed')
    expect(costSummaryStateWords({ status: 'paid', pct: 100, flags: ['materials-only'] })).toBe('paid · materials only')
    expect(costSummaryStateWords({ status: null, pct: null, flags: ['no-price'] })).toBe('no price')
  })
})

describe('costSummaryPrintHtml', () => {
  it('draws the head, the tiles, every section and the stamp, with no theme token on the page', () => {
    const html = costSummaryPrintHtml(buildCostSummary(input()))
    expect(html).toContain('<title>Harlow Ranch · cost summary</title>')
    expect(html).toContain('<p class="line">Harlow Holdings · 3 jobs, 2 with money on them · 1 bid</p>')
    expect(html.match(/Harlow Holdings/g)).toHaveLength(1)
    expect(html).toContain('$12,000 left to collect')
    expect(html).toContain('<b>JP612</b> Rough in: main house')
    expect(html).toContain('Lowe’s')
    expect(html).toContain('<span class="chip">Estimate</span> ESTIMATE — Mobilization crews')
    expect(html).toContain('1 internal transfer, $500.00, not a job cost; and 1 card charge also on a supply-house invoice, $200.00, counted there')
    expect(html).toContain('Printed Mar 10, 2026, 9:14 AM by Dana')
    expect(html).toContain('data-theme="light"')
    expect(html).not.toContain('var(--')
    expect(html).toContain('size: letter portrait')
  })

  it('escapes the words the rows carry', () => {
    const rows: SiteCostRows = { ...ROWS, otherCharges: [{ job_id: 'j1', amount: 10, created_at: null, description: 'Permit <fee> & "stamp"' }] }
    const costs: SiteCostsRead = { state: 'read', byJobId: jobCostsFromRows(rows), rows }
    const html = costSummaryPrintHtml(buildCostSummary(input({ costs })))
    expect(html).toContain('Permit &lt;fee&gt; &amp; &quot;stamp&quot;')
    expect(html).not.toContain('<fee>')
  })

  it('draws a dash where a read is not in, never a false zero', () => {
    const html = costSummaryPrintHtml(buildCostSummary(input({ labor: { state: 'failed' } })))
    expect(html).toContain('<span class="cap">Hours</span><b>—</b>')
    expect(html).toContain('No clocked hours on the site.')
  })
})
