import { describe, expect, it } from 'vitest'
import { makeProxyFakeSupabase } from '../../../test/proxyFakeSupabase'
import { loadMarketDeskReads } from './loadMarketDesk'
import { buildMarketDesk } from './marketDesk'

/**
 * v2.6823: on the Market desk a ZZ bid is no bid on the strip, none in the book and no asker's first bid. The fake
 * hands the bids read and the first-bids read the same rows.
 */
const bid = (id: string, projectName: string, customerId: string, createdAt: string) => ({ id, project_name: projectName, created_at: createdAt, bid_date_sent: null, bid_value: 8_000, agreed_value: null, outcome: null, outcome_at: null, customer_id: customerId, gc_builder_id: null })
const rows = {
  bids: [bid('zzFirst', 'ZZ Shadow TIREBARN', 'gc1', '2026-08-01T15:00:00+00:00'), bid('b1', 'Elm Street clinic', 'gc1', '2026-10-01T15:00:00+00:00')],
  bids_gc_builders: [],
  customers: [{ id: 'gc1', name: 'Acme GC' }],
  estimates: [],
}

describe('loadMarketDeskReads', () => {
  it('a robot\'s bid is no bid and no first bid for its asker', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const reads = await loadMarketDeskReads(db, { todayYmd: '2026-10-26', zzTestJobIds: new Set(), hideZzEstimates: true })
    expect(reads.bids.map((b) => b.id)).toEqual(['b1'])
    expect(reads.firstBidYmdByGc.get('gc1')).toBe('2026-10-01')
    expect(reads.lifetimeByGc.get('gc1')?.bids).toBe(1)
  })
  it('keeps it for a dev who shows ZZ rows', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const reads = await loadMarketDeskReads(db, { todayYmd: '2026-10-26', zzTestJobIds: null, hideZzEstimates: false })
    expect(reads.bids.map((b) => b.id)).toEqual(['zzFirst', 'b1'])
    expect(reads.firstBidYmdByGc.get('gc1')).toBe('2026-08-01')
  })
  it('does not read the jobs made from bids: a job decides nothing (punch list #318)', async () => {
    const { db, reads } = makeProxyFakeSupabase(rows)
    await loadMarketDeskReads(db, { todayYmd: '2026-10-26', zzTestJobIds: new Set(), hideZzEstimates: true })
    expect(reads.some((r) => r.table === 'jobs_ledger')).toBe(false)
  })
})

/**
 * v2.8280 (punch list #334, a fault found while building): on the Market window a ZZ test estimate is no ask on the
 * strip and none in the book's row of customers' estimates, for the viewer who hides ZZ tests. Made-up customers and
 * dollars.
 */
describe('loadMarketDeskReads: a ZZ test estimate is no ask (v2.8280)', () => {
  const estimate = (id: string, title: string, customer: string | null, status: string, cents: number) => ({ id, title, customers: customer == null ? null : { name: customer }, created_at: '2026-10-05T15:00:00+00:00', sent_at: '2026-10-06T15:00:00+00:00', status, total_cents: cents, acceptor_consented_at: null, updated_at: '2026-10-12T15:00:00+00:00', doc_kind: 'estimate' })
  const real = [estimate('e1', 'Estimate for Maple Homes', 'Maple Homes', 'sent', 240_000), estimate('e2', 'Estimate for Pine Fork', 'Pine Fork Homes', 'customer_accepted', 120_000)]
  const zz = [estimate('z1', 'Kitchen repipe', 'ZZ Test Walk', 'sent', 500_000), estimate('z2', 'Estimate for ZZ Walk Press', null, 'declined', 700_000)]
  const TODAY = '2026-10-26'
  const load = (estimates: ReadonlyArray<Record<string, unknown>>, opts: { zzTestJobIds: ReadonlySet<string> | null; hideZzEstimates: boolean }) => loadMarketDeskReads(makeProxyFakeSupabase({ ...rows, estimates }).db, { todayYmd: TODAY, ...opts })
  const desk = (r: Awaited<ReturnType<typeof loadMarketDeskReads>>) => buildMarketDesk({ todayYmd: TODAY, windowStart: '2026-09-28', bids: r.bids, estimates: r.estimates, gcNames: r.gcNames, firstBidYmdByGc: r.firstBidYmdByGc, lifetimeByGc: r.lifetimeByGc, winShare: null, fieldPerWeekUsd: null })
  const customersRow = (r: Awaited<ReturnType<typeof loadMarketDeskReads>>) => desk(r).rows.find((x) => x.kind === 'customers')

  it('leaves the test estimates out of the window’s list, and the whole window reads as if they were never written', async () => {
    const hidden = await load([...real, ...zz], { zzTestJobIds: new Set(), hideZzEstimates: true })
    expect(hidden.estimates.map((e) => [e.id, e.usd])).toEqual([
      ['e1', 2_400],
      ['e2', 1_200],
    ])
    const neverWritten = await load(real, { zzTestJobIds: new Set(), hideZzEstimates: true })
    expect(hidden).toEqual(neverWritten)
    expect(desk(hidden)).toEqual(desk(neverWritten))
  })

  it('moves the estimates alone: the bids, the askers’ first bids and their records are the same with the switch on or off', async () => {
    const hidden = await load([...real, ...zz], { zzTestJobIds: new Set(), hideZzEstimates: true })
    const kept = await load([...real, ...zz], { zzTestJobIds: new Set(), hideZzEstimates: false })
    expect(hidden.bids).toEqual(kept.bids)
    expect(hidden.firstBidYmdByGc).toEqual(kept.firstBidYmdByGc)
    expect(hidden.lifetimeByGc).toEqual(kept.lifetimeByGc)
    expect(hidden.gcNames).toEqual(kept.gcNames)
    // Every row of the book but the customers' estimates is the same row.
    const others = (r: typeof hidden) => desk(r).rows.filter((x) => x.kind !== 'customers')
    expect(others(hidden)).toEqual(others(kept))
    expect(customersRow(hidden)).not.toEqual(customersRow(kept))
  })

  it('keeps every estimate for a dev who shows ZZ tests, with or without a left-out list', async () => {
    const noList = await load([...real, ...zz], { zzTestJobIds: null, hideZzEstimates: false })
    expect(noList.estimates.map((e) => e.id)).toEqual(['e1', 'e2', 'z1', 'z2'])
    // The ids are a set here because the left-out list names a job. The estimates follow the switch, not the set.
    const withList = await load([...real, ...zz], { zzTestJobIds: new Set(['a-left-out-job']), hideZzEstimates: false })
    expect(withList.estimates).toEqual(noList.estimates)
  })
})
