import { describe, expect, it } from 'vitest'
import { enrichJobSummaryRows } from './jobSummaryLedgerView'
import { filterReworkPairs, findReworkPairs, reworkAddressKey, reworkRateBy, summarizeRework } from './jobSummaryRework'

const mk = (id: string, o: { addrId?: string; addr?: string; created: string; billed?: string; tech?: string; trade?: string; labor?: number; parts?: number; revenue?: number; pct?: number | null }) => ({
  job: {
    id,
    hcp_number: id,
    job_name: `Job ${id}`,
    pct_complete: o.pct === undefined ? 100 : o.pct,
    status: o.billed ? 'billed' : 'working',
    created_at: `${o.created}T10:00:00Z`,
    customer_address_id: o.addrId ?? null,
    job_address: o.addr ?? null,
    master_user_id: o.tech ?? 'u1',
    service_type_id: o.trade ?? 'plumb',
    serviceType: { name: o.trade ?? 'plumb' },
    invoices: o.billed ? [{ status: 'billed', amount: o.revenue ?? 1000, billed_at: `${o.billed}T15:00:00Z` }] : [],
  },
  subLaborCost: 0,
  teamLaborCost: o.labor ?? 100,
  partsCost: o.parts ?? 0,
  totalBill: o.revenue ?? 1000,
})
const rows = enrichJobSummaryRows({
  rows: [
    mk('a', { addrId: 'A1', created: '2026-05-01', billed: '2026-05-05', tech: 'u1' }),
    mk('b', { addrId: 'A1', created: '2026-06-01', billed: '2026-06-02', tech: 'u2', labor: 300, parts: 50, revenue: 400 }), // 27 days after a → return
    mk('c', { addrId: 'A1', created: '2026-09-20', billed: '2026-09-21', tech: 'u1' }), // 110 days after b → outside 90
    mk('d', { addr: '123 Oak Ridge Dr, Suite 4', created: '2026-07-01', billed: '2026-07-03', tech: 'u2' }),
    mk('e', { addr: '123 oak ridge dr ste 4', created: '2026-07-20', billed: '2026-07-21', tech: 'u2', labor: 80, revenue: 0 }), // text-matched → return, 17 days, finished + unbilled → callback
    mk('g', { addrId: 'A1', created: '2026-06-20', tech: 'u1', labor: 40, revenue: 0, pct: 40 }), // unbilled, not finished → open (18 days after b)
    mk('f', { addr: 'x', created: '2026-07-01' }), // unplaceable
  ],
  reportPctByJobId: new Map(),
  ledger: null,
  method: 'day',
})

describe('rework (v2.2831)', () => {
  it('address keys prefer the id, then a normalized street text', () => {
    expect(reworkAddressKey({ customer_address_id: 'A1', job_address: 'anything' })).toBe('addr:A1')
    expect(reworkAddressKey({ job_address: '123 Oak Ridge Dr, Suite 4' })).toBe(reworkAddressKey({ job_address: '123 oak ridge dr ste 4' }))
    expect(reworkAddressKey({ job_address: 'x' })).toBeNull()
  })

  it('finds returns inside the window, nearest earlier job, with the return cost', () => {
    const pairs = findReworkPairs(rows, null, 90)
    expect(pairs.map((p) => [p.first.number, p.second.number, p.daysAfter, p.kind])).toEqual([
      ['d', 'e', 17, 'callback'],
      ['b', 'g', 18, 'open'],
      ['a', 'b', 27, 'repeat'],
    ])
    expect(pairs[2]).toMatchObject({ returnCostUsd: 350, returnRevenueUsd: 400, kind: 'repeat' })
    expect(pairs[0]).toMatchObject({ kind: 'callback' })
    expect(filterReworkPairs(pairs, 'callbacks').map((p) => p.second.number)).toEqual(['e', 'g'])
    expect(filterReworkPairs(pairs, 'all').map((p) => p.second.number)).toEqual(['e', 'g', 'b'])
    expect(findReworkPairs(rows, null, 180).map((p) => p.second.number)).toEqual(['c', 'e', 'g', 'b'])
    expect(findReworkPairs(rows, null, 20).map((p) => p.second.number)).toEqual(['e', 'g'])
  })

  it('rates by the first job’s group and summarizes', () => {
    const pairs = findReworkPairs(rows, null, 90)
    const byTech = reworkRateBy(pairs, rows, 'tech', { userNameById: new Map([['u1', 'Abraham'], ['u2', 'Terry']]) })
    // u2 finished b, d, e (3 jobs; d and b returned) → 67%; u1 finished a, c, f (3; a returned) → 33%. g is open, not finished.
    expect(byTech.map((g) => [g.label, g.jobs, g.returns, Math.round(g.ratePct ?? -1)])).toEqual([
      ['Terry', 3, 2, 67],
      ['Abraham', 3, 1, 33],
    ])
    const s = summarizeRework(pairs, rows)
    expect(s).toMatchObject({ finishedJobs: 6, returns: 3, returnCostUsd: 350 + 80 + 40, unplaced: 1 })
    expect(s.ratePct).toBeCloseTo((3 / 6) * 100)
  })
})
