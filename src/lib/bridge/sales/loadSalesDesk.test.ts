import { describe, expect, it } from 'vitest'
import { makeProxyFakeSupabase } from '../../../test/proxyFakeSupabase'
import { loadSalesDeskReads } from './loadSalesDesk'
import { isWin } from './salesDesk'

/**
 * v2.6813: on the Sales desk a ZZ test job is no job a bid became. The fake hands every `bids` read the same rows and
 * every `jobs_ledger` read the same rows, so each bid here is read as open and as decided, and its job as the span's.
 */
const bid = (id: string, projectName: string) => ({ id, bid_number: id, project_name: projectName, gc_builder_id: null, customer_id: null, bid_value: 8_000, agreed_value: null, bid_date_sent: '2026-10-02', created_at: '2026-10-01T15:00:00+00:00', next_followup_on: null, next_followup_reason: null, last_contact: null, outcome: null, outcome_at: null, loss_category: null, loss_reason: null })
const job = (id: string, bidId: string, jobName: string, customerName: string) => ({ id, job_name: jobName, customer_name: customerName, bid_id: bidId, created_at: '2026-10-06T15:00:00+00:00', billing_only: false })
const rows = {
  bids: [bid('b1', 'Elm'), bid('b2', 'Oak'), bid('b3', 'Ash')],
  jobs_ledger: [job('real', 'b1', 'Elm', 'Ann Lee'), job('zzById', 'b2', 'Renamed since', 'Ann Lee'), job('zzByName', 'b3', 'Walk through', 'ZZ Test Customer')],
  estimates: [],
}

describe('loadSalesDeskReads', () => {
  it('a ZZ job is no win in the span and takes no bid out of the open pile', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const reads = await loadSalesDeskReads(db, { todayYmd: '2026-10-26', zzTestJobIds: new Set(['zzById']) })
    expect(reads.openBids.map((b) => b.id)).toEqual(['b2', 'b3'])
    expect(reads.decidedBids.filter(isWin).map((b) => b.id)).toEqual(['b1'])
  })
  it('keeps every job for a dev who shows them', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const reads = await loadSalesDeskReads(db, { todayYmd: '2026-10-26', zzTestJobIds: null })
    expect(reads.openBids).toEqual([])
    expect(reads.decidedBids.filter(isWin).map((b) => b.id)).toEqual(['b1', 'b2', 'b3'])
  })
})
