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
    const input = await loadDemandInputs(db, { windowStart: '2026-09-28', todayYmd: '2026-10-26', zzTestJobIds: null })
    expect(input.bids).toEqual([{ id: 'b1', createdYmd: '2026-10-26', sentYmd: '2026-10-26', usd: 8_000, outcome: 'won', outcomeYmd: '2026-10-26', jobCreatedYmd: '2026-10-26', jobUsd: 8_400 }])
    expect(input.estimates).toEqual([{ id: 'e1', createdYmd: '2026-10-26', sentYmd: '2026-10-26', status: 'sent', usd: 1_200, acceptedYmd: null, updatedYmd: '2026-10-26' }])
    expect(buildDemand(input).sales.bids.wonUsd).toBe(8_000)
  })
})

describe('loadDemandInputs: a ZZ test job is no job a bid became (v2.6813)', () => {
  const bid = (id: string) => ({ id, created_at: '2026-10-01T15:00:00+00:00', bid_date_sent: '2026-10-02', bid_value: 8_000, agreed_value: null, outcome: 'started_or_complete', outcome_at: '2026-10-05T15:00:00+00:00' })
  const rows = {
    bids: [bid('b1'), bid('b2'), bid('b3')],
    jobs_ledger: [
      { id: 'real', job_name: 'Elm', customer_name: 'Ann Lee', bid_id: 'b1', created_at: '2026-10-06T15:00:00+00:00', revenue: 8_400, billing_only: false },
      { id: 'zzById', job_name: 'Renamed since', customer_name: 'Ann Lee', bid_id: 'b2', created_at: '2026-10-06T15:00:00+00:00', revenue: 56_343, billing_only: false },
      { id: 'zzByName', job_name: 'ZZ Test Walk Project', customer_name: 'ZZ Test Walk', bid_id: 'b3', created_at: '2026-10-06T15:00:00+00:00', revenue: 56_000, billing_only: false },
    ],
    estimates: [],
  }
  const window = { windowStart: '2026-09-28', todayYmd: '2026-10-26' }

  it('the sale of a ZZ job is not started work, and the bid stays a bid', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const input = await loadDemandInputs(db, { ...window, zzTestJobIds: new Set(['zzById']) })
    expect(input.bids.map((b) => [b.id, b.jobCreatedYmd, b.jobUsd])).toEqual([
      ['b1', '2026-10-06', 8_400],
      ['b2', null, null],
      ['b3', null, null],
    ])
    expect(buildDemand(input).sales.bids.startedUsd).toBe(8_400)
    expect(buildDemand(input).market.bidsInvited).toBe(3)
  })

  it('keeps every job for a dev who shows them', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const input = await loadDemandInputs(db, { ...window, zzTestJobIds: null })
    expect(buildDemand(input).sales.bids.startedUsd).toBe(8_400 + 56_343 + 56_000)
  })
})

describe('loadDemandInputs: a ZZ bid is no ask and no bid sent (v2.6823)', () => {
  const bid = (id: string, projectName: string) => ({ id, project_name: projectName, created_at: '2026-10-01T15:00:00+00:00', bid_date_sent: '2026-10-02', bid_value: 8_000, agreed_value: null, outcome: null, outcome_at: null })
  const rows = { bids: [bid('b1', 'Elm'), bid('b2', 'ZZ Shadow AUTOZONE'), bid('b3', 'ZZ Test')], jobs_ledger: [], estimates: [] }
  const window = { windowStart: '2026-09-28', todayYmd: '2026-10-26' }
  it('leaves the robots\' and the test bids out of the asks, the sent dollars and the awaiting pile', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const d = buildDemand(await loadDemandInputs(db, { ...window, zzTestJobIds: new Set() }))
    expect(d.market.bidsInvited).toBe(1)
    expect(d.sales.bids.sentUsd).toBe(8_000)
    expect(d.sales.awaiting.bids).toBe(1)
  })
  it('keeps them for a dev who shows ZZ rows', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const d = buildDemand(await loadDemandInputs(db, { ...window, zzTestJobIds: null }))
    expect(d.market.bidsInvited).toBe(3)
    expect(d.sales.awaiting.bids).toBe(3)
  })
})
