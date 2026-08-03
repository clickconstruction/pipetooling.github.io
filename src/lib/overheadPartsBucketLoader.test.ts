import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Same chainable thenable stand-in as `fetchOverheadOfficePartsByDay.test.ts`:
 * every filter method returns the builder; awaiting it resolves the handler
 * registered for its table / rpc name (default: empty page). `fetchAllRows`
 * stops after any short page, so handlers just return the full row set once.
 */
type MockResult = { data: unknown; error: { message: string } | null }
const handlers = new Map<string, () => MockResult>()

function makeBuilder(key: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'neq', 'gte', 'lte', 'lt', 'gt', 'in', 'is', 'or', 'not', 'order', 'range', 'limit']) {
    b[m] = () => b
  }
  b.then = (
    resolve: (r: MockResult) => unknown,
    reject?: (e: unknown) => unknown,
  ) => {
    const h = handlers.get(key)
    return Promise.resolve()
      .then(() => (h ? h() : { data: [], error: null }))
      .then(resolve, reject)
  }
  return b
}

vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => makeBuilder(table),
    rpc: (fn: string) => makeBuilder(`rpc:${fn}`),
  },
}))

import {
  collectMercuryTxIds,
  fetchAccountingBucketByTxId,
  loadOfficePartsUsdByDayExcludingInternalTransfer,
} from './overheadPartsBucketLoader'
import type { OverheadPartsDetailLine } from './fetchOverheadOfficePartsByDay'

const OFFICE = 'job-office'

function mercuryAllocRow(p: { id: string; amount: number; postedAt: string; counterparty: string; txId: string }) {
  return {
    id: p.id,
    amount: p.amount,
    note: null,
    mercury_transaction_id: p.txId,
    mercury_transactions: { posted_at: p.postedAt, counterparty_name: p.counterparty, raw: null },
  }
}

function detailLine(p: Partial<OverheadPartsDetailLine> & { source: OverheadPartsDetailLine['source'] }): OverheadPartsDetailLine {
  return { amountUsd: 1, label: 'x', sortKey: 'k', ...p }
}

beforeEach(() => {
  handlers.clear()
})

describe('collectMercuryTxIds', () => {
  it('dedupes across maps and skips non-mercury lines and missing tx ids', () => {
    const m1 = new Map<string, OverheadPartsDetailLine[]>([
      ['2026-06-01', [
        detailLine({ source: 'mercury', mercuryTransactionId: 'tx-1' }),
        detailLine({ source: 'mercury', mercuryTransactionId: null }),
        detailLine({ source: 'supply' }),
      ]],
    ])
    const m2 = new Map<string, OverheadPartsDetailLine[]>([
      ['2026-06-02', [
        detailLine({ source: 'mercury', mercuryTransactionId: 'tx-1' }),
        detailLine({ source: 'mercury', mercuryTransactionId: 'tx-2' }),
      ]],
    ])
    expect(collectMercuryTxIds([m1, m2]).sort()).toEqual(['tx-1', 'tx-2'])
  })
})

describe('fetchAccountingBucketByTxId', () => {
  it('returns an empty map without querying when given no tx ids', async () => {
    handlers.set('mercury_transaction_drag_sort_assignments', () => {
      throw new Error('should not query')
    })
    expect((await fetchAccountingBucketByTxId([])).size).toBe(0)
  })

  it('maps assignment label default_keys into buckets; unassigned tx ids stay absent', async () => {
    handlers.set('mercury_transaction_drag_sort_assignments', () => ({
      data: [
        { mercury_transaction_id: 'tx-it', label_id: 'lbl-it' },
        { mercury_transaction_id: 'tx-cogs', label_id: 'lbl-cogs' },
        { mercury_transaction_id: 'tx-misc', label_id: 'lbl-unknown' },
      ],
      error: null,
    }))
    handlers.set('mercury_drag_sort_labels', () => ({
      data: [
        { id: 'lbl-it', default_key: 'internal_transfers' },
        { id: 'lbl-cogs', default_key: 'cogs_part_iii' },
        { id: 'lbl-unknown', default_key: 'repairs' },
      ],
      error: null,
    }))
    const map = await fetchAccountingBucketByTxId(['tx-it', 'tx-cogs', 'tx-misc', 'tx-none'])
    expect(map.get('tx-it')).toBe('internal_transfer')
    expect(map.get('tx-cogs')).toBe('cogs_part_iii')
    expect(map.get('tx-misc')).toBe('other')
    expect(map.has('tx-none')).toBe(false)
  })
})

describe('loadOfficePartsUsdByDayExcludingInternalTransfer', () => {
  it('excludes Internal Transfer Mercury lines from the per-day sums but keeps them in the detail', async () => {
    handlers.set('mercury_transaction_job_allocations', () => ({
      data: [
        mercuryAllocRow({ id: 'm1', amount: 100, postedAt: '2026-06-03T18:00:00Z', counterparty: 'Transfer', txId: 'tx-it' }),
        mercuryAllocRow({ id: 'm2', amount: 40, postedAt: '2026-06-03T18:00:00Z', counterparty: 'Lowes', txId: 'tx-cogs' }),
      ],
      error: null,
    }))
    handlers.set('mercury_transaction_drag_sort_assignments', () => ({
      data: [
        { mercury_transaction_id: 'tx-it', label_id: 'lbl-it' },
        { mercury_transaction_id: 'tx-cogs', label_id: 'lbl-cogs' },
      ],
      error: null,
    }))
    handlers.set('mercury_drag_sort_labels', () => ({
      data: [
        { id: 'lbl-it', default_key: 'internal_transfers' },
        { id: 'lbl-cogs', default_key: 'cogs_part_iii' },
      ],
      error: null,
    }))
    const r = await loadOfficePartsUsdByDayExcludingInternalTransfer({
      officeJobLedgerId: OFFICE,
      startYmd: '2026-06-01',
      endYmd: '2026-06-10',
    })
    expect(r.partsUsdByDay.get('2026-06-03')).toBe(40)
    // Detail stays unfiltered for table/modal renderers.
    expect(r.partsDetailByDay.get('2026-06-03')).toHaveLength(2)
    expect(r.bucketByTxId.get('tx-it')).toBe('internal_transfer')
  })

  it('counts supply/tally lines regardless of buckets (they have no accounting label)', async () => {
    handlers.set('supply_house_invoice_job_allocations', () => ({
      data: [
        {
          invoice_id: 'inv1',
          job_id: OFFICE,
          pct: 100,
          supply_house_invoices: { invoice_number: 'A-1', invoice_date: '2026-06-04', amount: 75 },
        },
      ],
      error: null,
    }))
    const r = await loadOfficePartsUsdByDayExcludingInternalTransfer({
      officeJobLedgerId: OFFICE,
      startYmd: '2026-06-01',
      endYmd: '2026-06-10',
    })
    expect(r.partsUsdByDay.get('2026-06-04')).toBe(75)
    expect(r.bucketByTxId.size).toBe(0)
  })

  it('degrades to "everything counted" (empty bucket map) when the bucket fetch fails', async () => {
    handlers.set('mercury_transaction_job_allocations', () => ({
      data: [
        mercuryAllocRow({ id: 'm1', amount: 100, postedAt: '2026-06-03T18:00:00Z', counterparty: 'Transfer', txId: 'tx-it' }),
      ],
      error: null,
    }))
    handlers.set('mercury_transaction_drag_sort_assignments', () => ({
      data: null,
      error: { message: 'permission denied' },
    }))
    const r = await loadOfficePartsUsdByDayExcludingInternalTransfer({
      officeJobLedgerId: OFFICE,
      startYmd: '2026-06-01',
      endYmd: '2026-06-10',
    })
    // Even a known internal transfer counts when buckets are unavailable —
    // the Overhead tab's original degrade rule, preserved exactly.
    expect(r.partsUsdByDay.get('2026-06-03')).toBe(100)
    expect(r.bucketByTxId.size).toBe(0)
  })

  it('rejects when the detail fetch itself fails (callers surface the error)', async () => {
    handlers.set('mercury_transaction_job_allocations', () => ({
      data: null,
      error: { message: 'permission denied' },
    }))
    await expect(
      loadOfficePartsUsdByDayExcludingInternalTransfer({
        officeJobLedgerId: OFFICE,
        startYmd: '2026-06-01',
        endYmd: '2026-06-10',
      }),
    ).rejects.toThrow(/overhead office parts mercury/)
  })
})
