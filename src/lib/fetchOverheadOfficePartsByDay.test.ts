import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Chainable thenable stand-in for the supabase query builder. Every filter
 * method returns the builder; awaiting it resolves the handler registered
 * for its table / rpc name (default: empty page). `fetchAllRows` stops after
 * any short page, so handlers just return the full row set once.
 */
type MockResult = { data: unknown; error: { message: string } | null }
const handlers = new Map<string, () => MockResult>()

/**
 * PostgREST-style `.is('<embed>.<col>', null)` against an `!inner` join:
 * drops parent rows whose embedded row has a non-null value in `<col>`.
 * (Un-dotted columns filter the parent row itself.)
 */
function applyIsNullFilters(r: MockResult, cols: string[]): MockResult {
  if (cols.length === 0 || !Array.isArray(r.data)) return r
  const data = (r.data as Record<string, unknown>[]).filter((row) =>
    cols.every((col) => {
      const dot = col.indexOf('.')
      if (dot < 0) return row[col] == null
      const head = col.slice(0, dot)
      const field = col.slice(dot + 1)
      const nested = row[head]
      const embed = Array.isArray(nested) ? nested[0] : nested
      return embed == null || (embed as Record<string, unknown>)[field] == null
    }),
  )
  return { ...r, data }
}

function makeBuilder(key: string) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'neq', 'gte', 'lte', 'lt', 'gt', 'in', 'or', 'not', 'order', 'range', 'limit']) {
    b[m] = () => b
  }
  const isNullCols: string[] = []
  b.is = (col: string, val: unknown) => {
    if (val === null) isNullCols.push(col)
    return b
  }
  b.then = (
    resolve: (r: MockResult) => unknown,
    reject?: (e: unknown) => unknown,
  ) => {
    const h = handlers.get(key)
    return Promise.resolve()
      .then(() => (h ? applyIsNullFilters(h(), isNullCols) : { data: [], error: null }))
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

import { fetchOtherJobsPartsByDay, fetchOverheadOfficePartsByDay } from './fetchOverheadOfficePartsByDay'

const OFFICE = 'job-office'

function mercuryRow(p: {
  id: string
  amount: number | string
  postedAt: string | null
  counterparty?: string | null
  note?: string | null
  txId?: string | null
  asArrayEmbed?: boolean
  duplicateOfTxId?: string | null
}) {
  const embed = {
    posted_at: p.postedAt,
    counterparty_name: p.counterparty ?? null,
    raw: null,
    duplicate_of_transaction_id: p.duplicateOfTxId ?? null,
  }
  return {
    id: p.id,
    amount: p.amount,
    note: p.note ?? null,
    mercury_transaction_id: p.txId ?? `tx-${p.id}`,
    mercury_transactions: p.asArrayEmbed ? [embed] : embed,
  }
}

beforeEach(() => {
  handlers.clear()
})

describe('fetchOverheadOfficePartsByDay', () => {
  it('unwraps object AND array nested embeds, Math.abs-es amounts, and buckets by Chicago wall date', async () => {
    handlers.set('mercury_transaction_job_allocations', () => ({
      data: [
        // 03:30Z on the 3rd = 22:30 on the 2nd in America/Chicago (CDT).
        mercuryRow({ id: 'm1', amount: -125.5, postedAt: '2026-06-03T03:30:00Z', counterparty: 'Lowes' }),
        mercuryRow({ id: 'm2', amount: 40, postedAt: '2026-06-04T18:00:00Z', counterparty: 'Home Depot', asArrayEmbed: true }),
        // Null posted_at → dropped.
        mercuryRow({ id: 'm3', amount: 99, postedAt: null }),
      ],
      error: null,
    }))
    const r = await fetchOverheadOfficePartsByDay({ officeJobLedgerId: OFFICE, startYmd: '2026-06-01', endYmd: '2026-06-10' })
    expect(r.partsUsdByDay.get('2026-06-02')).toBe(125.5)
    expect(r.partsUsdByDay.get('2026-06-04')).toBe(40)
    expect(r.partsUsdByDay.size).toBe(2)
    const lines = r.partsDetailByDay.get('2026-06-02') ?? []
    expect(lines[0]?.label).toBe('Lowes')
    expect(lines[0]?.mercuryTransactionId).toBe('tx-m1')
  })

  it('excludes allocations whose transaction is duplicate-marked (splits survive the marking)', async () => {
    handlers.set('mercury_transaction_job_allocations', () => ({
      data: [
        mercuryRow({ id: 'm1', amount: 60, postedAt: '2026-06-04T18:00:00Z', counterparty: 'Lowes' }),
        // Marked duplicate of another tx AFTER being split to the office job —
        // the allocation row still exists but must not count into the pool.
        mercuryRow({
          id: 'm2',
          amount: 60,
          postedAt: '2026-06-04T18:05:00Z',
          counterparty: 'Lowes',
          duplicateOfTxId: 'tx-original',
        }),
      ],
      error: null,
    }))
    const r = await fetchOverheadOfficePartsByDay({ officeJobLedgerId: OFFICE, startYmd: '2026-06-01', endYmd: '2026-06-10' })
    expect(r.partsUsdByDay.get('2026-06-04')).toBe(60)
    const lines = r.partsDetailByDay.get('2026-06-04') ?? []
    expect(lines).toHaveLength(1)
    expect(lines[0]?.mercuryTransactionId).toBe('tx-m1')
  })

  it('drops lines whose Chicago day falls outside the requested range (fetch is a day wide)', async () => {
    handlers.set('mercury_transaction_job_allocations', () => ({
      data: [mercuryRow({ id: 'm1', amount: 10, postedAt: '2026-05-31T18:00:00Z' })],
      error: null,
    }))
    const r = await fetchOverheadOfficePartsByDay({ officeJobLedgerId: OFFICE, startYmd: '2026-06-01', endYmd: '2026-06-10' })
    expect(r.partsUsdByDay.size).toBe(0)
  })

  it('allocates supply invoices by pct/100 and keys by invoice_date', async () => {
    handlers.set('supply_house_invoice_job_allocations', () => ({
      data: [
        {
          invoice_id: 'inv1',
          job_id: OFFICE,
          pct: 50,
          supply_house_invoices: {
            invoice_number: 'A-100',
            invoice_date: '2026-06-05',
            amount: '200',
            supply_houses: { name: 'Ferguson' },
          },
        },
        // pct 0 → allocated $0 → dropped.
        {
          invoice_id: 'inv2',
          job_id: OFFICE,
          pct: 0,
          supply_house_invoices: { invoice_number: 'A-101', invoice_date: '2026-06-05', amount: 999 },
        },
        // Array embed unwrap.
        {
          invoice_id: 'inv3',
          job_id: OFFICE,
          pct: 25,
          supply_house_invoices: [
            { invoice_number: 'A-102', invoice_date: '2026-06-06', amount: 400, supply_houses: [{ name: 'Winsupply' }] },
          ],
        },
      ],
      error: null,
    }))
    const r = await fetchOverheadOfficePartsByDay({ officeJobLedgerId: OFFICE, startYmd: '2026-06-01', endYmd: '2026-06-10' })
    expect(r.partsUsdByDay.get('2026-06-05')).toBe(100)
    expect(r.partsUsdByDay.get('2026-06-06')).toBe(100)
    const d5 = r.partsDetailByDay.get('2026-06-05') ?? []
    expect(d5).toHaveLength(1)
    expect(d5[0]?.label).toBe('Ferguson · #A-100')
  })

  it('tallies part lines at price_at_time and fixture-only lines at fixture_cost, office job only', async () => {
    handlers.set('rpc:list_tally_parts_with_po', () => ({
      data: [
        {
          id: 't1',
          job_id: OFFICE,
          created_at: '2026-06-05T18:00:00Z',
          quantity: 2,
          part_id: 'p1',
          price_at_time: 12.5,
          fixture_cost: 999,
          fixture_name: 'Water heater',
          part_name: 'T&P valve',
        },
        {
          id: 't2',
          job_id: OFFICE,
          created_at: '2026-06-05T18:00:00Z',
          quantity: 3,
          part_id: null,
          price_at_time: null,
          fixture_cost: 10,
          fixture_name: 'Hose bib',
          part_name: null,
        },
        // Different job → filtered client-side.
        {
          id: 't3',
          job_id: 'job-other',
          created_at: '2026-06-05T18:00:00Z',
          quantity: 1,
          part_id: null,
          price_at_time: null,
          fixture_cost: 500,
          fixture_name: 'X',
          part_name: null,
        },
      ],
      error: null,
    }))
    const r = await fetchOverheadOfficePartsByDay({ officeJobLedgerId: OFFICE, startYmd: '2026-06-01', endYmd: '2026-06-10' })
    expect(r.partsUsdByDay.get('2026-06-05')).toBe(25 + 30)
    const labels = (r.partsDetailByDay.get('2026-06-05') ?? []).map((l) => l.label)
    expect(labels).toEqual(['Water heater — T&P valve', 'Hose bib'])
  })

  it('rejects (instead of returning empty maps) when a source query fails', async () => {
    handlers.set('mercury_transaction_job_allocations', () => ({
      data: null,
      error: { message: 'permission denied' },
    }))
    await expect(
      fetchOverheadOfficePartsByDay({ officeJobLedgerId: OFFICE, startYmd: '2026-06-01', endYmd: '2026-06-10' }),
    ).rejects.toThrow(/overhead office parts mercury/)
  })

  it('rejects when the tally RPC fails even if earlier sources succeeded', async () => {
    handlers.set('rpc:list_tally_parts_with_po', () => ({ data: null, error: { message: 'boom' } }))
    await expect(
      fetchOverheadOfficePartsByDay({ officeJobLedgerId: OFFICE, startYmd: '2026-06-01', endYmd: '2026-06-10' }),
    ).rejects.toThrow(/overhead office parts tally/)
  })
})

describe('fetchOtherJobsPartsByDay', () => {
  it('excludes the office job from tally lines client-side and sums the rest', async () => {
    handlers.set('rpc:list_tally_parts_with_po', () => ({
      data: [
        {
          id: 't1',
          job_id: 'job-field',
          created_at: '2026-06-05T18:00:00Z',
          quantity: 4,
          part_id: 'p9',
          price_at_time: 5,
          fixture_cost: null,
          fixture_name: 'Fixture',
          part_name: 'Part',
        },
        {
          id: 't2',
          job_id: OFFICE,
          created_at: '2026-06-05T18:00:00Z',
          quantity: 1,
          part_id: null,
          price_at_time: null,
          fixture_cost: 100,
          fixture_name: 'Office thing',
          part_name: null,
        },
      ],
      error: null,
    }))
    const r = await fetchOtherJobsPartsByDay({ officeJobLedgerId: OFFICE, startYmd: '2026-06-01', endYmd: '2026-06-10' })
    expect(r.partsUsdByDay.get('2026-06-05')).toBe(20)
  })

  it('keeps ALL tally jobs when no office job is configured', async () => {
    handlers.set('rpc:list_tally_parts_with_po', () => ({
      data: [
        {
          id: 't2',
          job_id: OFFICE,
          created_at: '2026-06-05T18:00:00Z',
          quantity: 1,
          part_id: null,
          price_at_time: null,
          fixture_cost: 100,
          fixture_name: 'Office thing',
          part_name: null,
        },
      ],
      error: null,
    }))
    const r = await fetchOtherJobsPartsByDay({ officeJobLedgerId: null, startYmd: '2026-06-01', endYmd: '2026-06-10' })
    expect(r.partsUsdByDay.get('2026-06-05')).toBe(100)
  })

  it('excludes allocations whose transaction is duplicate-marked (splits survive the marking)', async () => {
    handlers.set('mercury_transaction_job_allocations', () => ({
      data: [
        mercuryRow({ id: 'm1', amount: 80, postedAt: '2026-06-04T18:00:00Z', counterparty: 'Lowes' }),
        // Marked duplicate of another tx AFTER being split to a field job —
        // the allocation row still exists but must not count into materials.
        mercuryRow({
          id: 'm2',
          amount: 80,
          postedAt: '2026-06-04T18:05:00Z',
          counterparty: 'Lowes',
          duplicateOfTxId: 'tx-original',
        }),
      ],
      error: null,
    }))
    const r = await fetchOtherJobsPartsByDay({ officeJobLedgerId: OFFICE, startYmd: '2026-06-01', endYmd: '2026-06-10' })
    expect(r.partsUsdByDay.get('2026-06-04')).toBe(80)
    const lines = r.partsDetailByDay.get('2026-06-04') ?? []
    expect(lines).toHaveLength(1)
    expect(lines[0]?.mercuryTransactionId).toBe('tx-m1')
  })

  it('propagates supply-source failures', async () => {
    handlers.set('supply_house_invoice_job_allocations', () => ({ data: null, error: { message: 'nope' } }))
    await expect(
      fetchOtherJobsPartsByDay({ officeJobLedgerId: OFFICE, startYmd: '2026-06-01', endYmd: '2026-06-10' }),
    ).rejects.toThrow(/overhead other jobs parts supply/)
  })

  it('sorts detail lines by source then sortKey within a day', async () => {
    handlers.set('mercury_transaction_job_allocations', () => ({
      data: [mercuryRow({ id: 'm9', amount: 5, postedAt: '2026-06-05T18:00:00Z', counterparty: 'Shell' })],
      error: null,
    }))
    handlers.set('rpc:list_tally_parts_with_po', () => ({
      data: [
        {
          id: 't1',
          job_id: 'job-field',
          created_at: '2026-06-05T18:00:00Z',
          quantity: 1,
          part_id: 'p1',
          price_at_time: 9,
          fixture_cost: null,
          fixture_name: 'F',
          part_name: 'P',
        },
      ],
      error: null,
    }))
    const r = await fetchOtherJobsPartsByDay({ officeJobLedgerId: OFFICE, startYmd: '2026-06-01', endYmd: '2026-06-10' })
    expect((r.partsDetailByDay.get('2026-06-05') ?? []).map((l) => l.source)).toEqual(['mercury', 'tally'])
  })
})
