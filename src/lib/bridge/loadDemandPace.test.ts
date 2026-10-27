import { describe, expect, it } from 'vitest'
import { makeProxyFakeSupabase } from '../../test/proxyFakeSupabase'
import { buildDemand } from './demandPace'
import { loadDemandInputs } from './loadDemandPace'

// 01:30 UTC on Oct 27 is 8:30 PM on Oct 26 in Chicago, and every stamp here comes back as the UTC instant.
const TONIGHT = '2026-10-27T01:30:00+00:00'

describe('loadDemandInputs on the company calendar (v2.5956)', () => {
  it('reads tonight’s bid, its job and tonight’s estimate as today, so the win counts in the window that ends today', async () => {
    const { db } = makeProxyFakeSupabase({
      bids: [{ id: 'b1', created_at: TONIGHT, bid_date_sent: '2026-10-26', bid_value: 8_000, agreed_value: null, outcome: 'won', outcome_at: TONIGHT }],
      jobs_ledger: [{ id: 'j1', bid_id: 'b1', created_at: TONIGHT, revenue: 8_400, billing_only: false }],
      estimates: [{ id: 'e1', created_at: TONIGHT, sent_at: TONIGHT, status: 'sent', total_cents: 120_000, acceptor_consented_at: null, updated_at: TONIGHT, doc_kind: 'estimate' }],
    })
    const input = await loadDemandInputs(db, { windowStart: '2026-09-28', todayYmd: '2026-10-26' })
    expect(input.bids).toEqual([{ id: 'b1', createdYmd: '2026-10-26', sentYmd: '2026-10-26', usd: 8_000, outcome: 'won', outcomeYmd: '2026-10-26', jobCreatedYmd: '2026-10-26', jobUsd: 8_400 }])
    expect(input.estimates).toEqual([{ id: 'e1', createdYmd: '2026-10-26', sentYmd: '2026-10-26', status: 'sent', usd: 1_200, acceptedYmd: null, updatedYmd: '2026-10-26' }])
    expect(buildDemand(input).sales.bids.wonUsd).toBe(8_000)
  })
})
