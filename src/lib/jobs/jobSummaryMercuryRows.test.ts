import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { JobSummaryMercuryAllocationRow } from '../../types/jobSummary'

/**
 * Job Summary's card lines (Stage A step 11): the mapping an opened row's cache and the cost
 * breakdown print share, and the print's read for a row never opened, run through the real
 * per-job loader against a mocked database. The job holds an Internal Transfer and a charge
 * also on a supply-house invoice; the print lists what its card total counts.
 */
const tables: string[] = []
let route: (table: string) => { data: unknown; error: { message: string } | null } = () => ({ data: [], error: null })
vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      tables.push(table)
      const p: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(route(table))
            return () => p
          },
        },
      )
      return p
    },
  },
}))
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    const r = await op()
    if (r.error) throw new Error(r.error.message)
    return r.data
  },
}))
vi.mock('../fetchMercuryRelationsByTxIds', () => ({
  fetchAttributionsByMercuryTxIds: async () => [{ mercury_transaction_id: 'tx1', person_id: 'p1', user_id: null }],
}))
vi.mock('./loadCardChargeExclusions', () => ({
  loadCardChargeExclusions: async () => ({ bucketByTxId: new Map([['tx3', 'internal_transfer']]), invoiceLinkedTxIds: new Set(['tx2']) }),
}))
vi.mock('../banking/categoryTagsData', () => ({
  loadCategoryTags: async () => ({ tags: [], members: [] }),
  fetchLabelIdByTxId: async () => new Map(),
}))

import { buildJobSummaryCostBreakdownHtml } from '../jobsDocuments/jobSummaryCostBreakdown'
import { jobSummaryMercuryRowsFromAllocations, loadJobSummaryPrintMercuryRows } from './jobSummaryMercuryRows'

const mt = (over: Record<string, unknown> = {}) => ({ posted_at: '2026-09-01', counterparty_name: 'Home Depot', amount: -50, note: null, external_memo: null, mercury_account_id: 'acct', raw: null, mercury_category: 'Hardware', ...over })
const narrowed = (over: Record<string, unknown> = {}) => ({ posted_at: '2026-09-01', counterparty_name: 'Home Depot', amount: -50, note: null, external_memo: null, raw: null, ...over })
const dbRows = [
  { id: 'a1', amount: -50, note: 'PVC', mercury_transaction_id: 'tx1', mercury_transactions: mt() },
  { id: 'a2', amount: -20, note: null, mercury_transaction_id: 'tx2', mercury_transactions: mt({ counterparty_name: 'Ferguson', amount: -20 }) },
  { id: 'a3', amount: -500, note: null, mercury_transaction_id: 'tx3', mercury_transactions: mt({ counterparty_name: 'Transfer to savings', amount: -500 }) },
]

beforeEach(() => {
  tables.length = 0
  route = (table) => {
    if (table === 'mercury_transaction_job_allocations') return { data: dbRows, error: null }
    if (table === 'people') return { data: [{ id: 'p1', name: 'Pat Person' }], error: null }
    return { data: [], error: null }
  }
})

describe('jobSummaryMercuryRowsFromAllocations', () => {
  it('keeps the line, its name and both flags, and narrows the transaction to the six fields the row and the print read', () => {
    const row = { id: 'a1', amount: -50, note: 'PVC', mercury_transaction_id: 'tx1', attributionDisplayName: 'Pat', linkedToSupplyInvoice: true, isFuel: true, mercury_transactions: mt() }
    expect(jobSummaryMercuryRowsFromAllocations([row, { ...row, id: 'a2', mercury_transactions: null }])).toEqual([
      { id: 'a1', amount: -50, note: 'PVC', mercury_transaction_id: 'tx1', attributionDisplayName: 'Pat', linkedToSupplyInvoice: true, isFuel: true, mercury_transactions: narrowed() },
      { id: 'a2', amount: -50, note: 'PVC', mercury_transaction_id: 'tx1', attributionDisplayName: 'Pat', linkedToSupplyInvoice: true, isFuel: true, mercury_transactions: null },
    ])
  })
})

describe('loadJobSummaryPrintMercuryRows', () => {
  it('an opened row prints its cached lines and reads nothing, even when it has none', async () => {
    const cached: JobSummaryMercuryAllocationRow[] = [{ id: 'c1', amount: -5, note: null, mercury_transaction_id: 'tx9', attributionDisplayName: null, mercury_transactions: null }]
    const out = await loadJobSummaryPrintMercuryRows('j1', new Map([['j1', cached]]))
    expect(out.rows).toBe(cached)
    expect(out.cardDetailUnavailable).toBe(false)
    expect(await loadJobSummaryPrintMercuryRows('j2', new Map([['j2', []]]))).toEqual({ rows: [], cardDetailUnavailable: false })
    expect(tables).toEqual([])
  })

  it('a row never opened reads through the row’s own loader: the Internal Transfer drops out, the invoice-linked flag rides along', async () => {
    const out = await loadJobSummaryPrintMercuryRows('j1', new Map([['other-job', []]]))
    expect(tables).toEqual(['mercury_transaction_job_allocations', 'people'])
    expect(out).toEqual({
      rows: [
        { id: 'a1', amount: -50, note: 'PVC', mercury_transaction_id: 'tx1', attributionDisplayName: 'Pat Person', linkedToSupplyInvoice: false, isFuel: false, mercury_transactions: narrowed() },
        { id: 'a2', amount: -20, note: null, mercury_transaction_id: 'tx2', attributionDisplayName: null, linkedToSupplyInvoice: true, isFuel: false, mercury_transactions: narrowed({ counterparty_name: 'Ferguson', amount: -20 }) },
      ],
      cardDetailUnavailable: false,
    })
  })

  it('a failed read prints without the lines', async () => {
    route = () => ({ data: null, error: { message: 'alloc rls' } })
    expect(await loadJobSummaryPrintMercuryRows('j1', new Map())).toEqual({ rows: [], cardDetailUnavailable: true })
  })

  it('the print from a row never opened lists the lines its card total counts, with no mismatch warning', async () => {
    const { rows, cardDetailUnavailable } = await loadJobSummaryPrintMercuryRows('j1', new Map())
    const html = buildJobSummaryCostBreakdownHtml({
      job: { id: 'j1', hcp_number: 'HCP-7', job_name: 'Repipe', job_address: '9 Elm', materials: [] } as unknown as JobWithDetails,
      teamLaborRow: null,
      teamLaborCost: 0,
      subLaborJobs: [],
      partsFromTally: 0,
      billedMaterialsSum: 0,
      invoicesFromSupplyHouses: 0,
      cardCharges: 70, // the bulk card map's total: Internal Transfers out, invoice-linked charges in
      totalBill: 0,
      profit: -70,
      tallyPartsForJob: [],
      mileageCost: 0,
      timePerMile: 0,
      invoiceRows: [],
      mercuryRows: rows,
      cardDetailUnavailable,
      clockSessions: [],
      clockSessionsLoaded: false,
      nicknameByDebitCard: {},
      generated: 'TEST-GENERATED',
    })
    expect(html).toContain('Card charges — $70.00')
    expect(html).toContain('Home Depot')
    expect(html).toContain('Ferguson')
    expect(html).not.toContain('Transfer to savings')
    expect(html).not.toContain('Card charge line detail unavailable.')
    expect(html).not.toContain('may not match job card total')
  })
})
