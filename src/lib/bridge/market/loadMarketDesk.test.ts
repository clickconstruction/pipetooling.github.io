import { describe, expect, it } from 'vitest'
import { makeProxyFakeSupabase } from '../../../test/proxyFakeSupabase'
import { loadMarketDeskReads } from './loadMarketDesk'

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
    const reads = await loadMarketDeskReads(db, { todayYmd: '2026-10-26', zzTestJobIds: new Set() })
    expect(reads.bids.map((b) => b.id)).toEqual(['b1'])
    expect(reads.firstBidYmdByGc.get('gc1')).toBe('2026-10-01')
    expect(reads.lifetimeByGc.get('gc1')?.bids).toBe(1)
  })
  it('keeps it for a dev who shows ZZ rows', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const reads = await loadMarketDeskReads(db, { todayYmd: '2026-10-26', zzTestJobIds: null })
    expect(reads.bids.map((b) => b.id)).toEqual(['zzFirst', 'b1'])
    expect(reads.firstBidYmdByGc.get('gc1')).toBe('2026-08-01')
  })
  it('does not read the jobs made from bids: a job decides nothing (punch list #318)', async () => {
    const { db, reads } = makeProxyFakeSupabase(rows)
    await loadMarketDeskReads(db, { todayYmd: '2026-10-26', zzTestJobIds: new Set() })
    expect(reads.some((r) => r.table === 'jobs_ledger')).toBe(false)
  })
})
