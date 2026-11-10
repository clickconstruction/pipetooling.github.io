import { describe, expect, it } from 'vitest'
import { makeProxyFakeSupabase, proxyFakeCalls } from '../../test/proxyFakeSupabase'
import type { BridgeData } from './loadBridgeData'
import { loadBridgeVectorInputs, loadVectorSessions } from './loadBridgeVectors'

/**
 * v2.6813: the people's reads leave ZZ test jobs out. A session clocked on one, a bill sent or a payment recorded on
 * one and a percent or a report filed on one are nobody's hours, dollars or reports. Prod on 2026-11-09 held an
 * 8.7-hour session on a ZZ job, waiting for approval, in the people's grid.
 */
const session = (jobId: string | null, bidId: string | null = null) => ({ user_id: 'u1', work_date: '2026-11-03', clocked_in_at: '2026-11-03T14:00:00+00:00', clocked_out_at: '2026-11-03T16:00:00+00:00', job_ledger_id: jobId, bid_id: bidId, approved_at: null, rejected_at: null, revoked_at: null })
const rows = {
  clock_sessions: [session('real'), session('zzJob'), session(null, 'b1'), session('office')],
  job_activity_events: [
    { job_id: 'real', event_type: 'invoice_sent', actor_user_id: 'u1', occurred_at: '2026-11-03T15:00:00+00:00', detail: { invoice_id: 'i1' } },
    { job_id: 'zzJob', event_type: 'invoice_sent', actor_user_id: 'u1', occurred_at: '2026-11-03T15:00:00+00:00', detail: { invoice_id: 'i2' } },
    { job_id: 'real', event_type: 'payment_added', actor_user_id: 'u1', occurred_at: '2026-11-03T15:00:00+00:00', detail: { amount: 500 } },
    { job_id: 'zzJob', event_type: 'payment_added', actor_user_id: 'u1', occurred_at: '2026-11-03T15:00:00+00:00', detail: { amount: 75 } },
  ],
  jobs_ledger_invoices: [
    { id: 'i1', amount: 4_000 },
    { id: 'i2', amount: 900 },
  ],
  job_pct_events: [
    { job_id: 'real', changed_by_user_id: 'u1', changed_at: '2026-11-03T15:00:00+00:00' },
    { job_id: 'zzJob', changed_by_user_id: 'u1', changed_at: '2026-11-03T15:00:00+00:00' },
  ],
  reports: [
    { job_ledger_id: 'real', created_by_user_id: 'u1', created_at: '2026-11-03T15:00:00+00:00' },
    { job_ledger_id: 'zzJob', created_by_user_id: 'u1', created_at: '2026-11-03T15:00:00+00:00' },
    { job_ledger_id: null, created_by_user_id: 'u1', created_at: '2026-11-03T15:00:00+00:00' },
  ],
  // The fake hands the sent-bids read and the won-bids read the same rows (v2.6823).
  bid_versions: [{ bid_id: 'bidReal', outcome_at: '2026-11-03T15:00:00+00:00' }, { bid_id: 'bidZz', outcome_at: '2026-11-03T15:00:00+00:00' }],
  bids: [
    { id: 'bidReal', bid_number: '600', project_name: 'Elm Street clinic', estimator_id: 'u1', bid_value: 8_000, agreed_value: null, bid_date_sent: '2026-11-02' },
    { id: 'bidZz', bid_number: '601', project_name: 'ZZ Shadow AUTOZONE', estimator_id: 'u1', bid_value: 9_000, agreed_value: null, bid_date_sent: '2026-11-02' },
  ],
}
const data = { windowStart: '2026-09-14', todayYmd: '2026-11-09', officeJobLedgerId: 'office', jobs: [], earned: { expectedHoursByJob: new Map() } } as unknown as BridgeData
const zz = new Set(['zzJob'])

describe('loadVectorSessions', () => {
  it('leaves a session clocked on a ZZ job out, and keeps the office, bid and real ones', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const sessions = await loadVectorSessions(db, '2026-11-01', '2026-11-09', 'office', zz)
    expect(sessions.map((s) => [s.jobId, s.onBid, s.officeJob])).toEqual([
      ['real', false, false],
      [null, true, false],
      ['office', false, true],
    ])
  })
  it('keeps every session for a dev who shows them', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    expect(await loadVectorSessions(db, '2026-11-01', '2026-11-09', 'office', null)).toHaveLength(4)
  })
})

describe('loadBridgeVectorInputs', () => {
  it('a bill sent, a payment, a percent and a report on a ZZ job are nobody\'s', async () => {
    const { db, reads } = makeProxyFakeSupabase(rows)
    const v = await loadBridgeVectorInputs(db, data, { zzTestJobIds: zz })
    expect(v.sessions).toHaveLength(3)
    expect(v.invoiceSends.map((e) => e.usd)).toEqual([4_000])
    expect(v.payments.map((e) => e.usd)).toEqual([500])
    expect(v.pctUpdates).toHaveLength(1)
    expect(v.fieldReports).toHaveLength(2)
    expect(v.bidsSent.map((b) => b.usd)).toEqual([8_000])
    expect(v.bidsWon.map((b) => b.usd)).toEqual([8_000])
    // The dropped bill's amount is never asked for.
    expect(proxyFakeCalls(reads, 'jobs_ledger_invoices', 'in')).toEqual([['id', ['i1']]])
  })
  it('keeps every row for a dev who shows them', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const v = await loadBridgeVectorInputs(db, data, { zzTestJobIds: null })
    expect(v.sessions).toHaveLength(4)
    expect(v.invoiceSends.map((e) => e.usd)).toEqual([4_000, 900])
    expect(v.payments.map((e) => e.usd)).toEqual([500, 75])
    expect(v.pctUpdates).toHaveLength(2)
    expect(v.fieldReports).toHaveLength(3)
    expect(v.bidsSent).toHaveLength(2)
    expect(v.bidsWon).toHaveLength(2)
  })
})
