import { describe, expect, it } from 'vitest'
import { makeProxyFakeSupabase } from '../../../test/proxyFakeSupabase'
import { loadSalesDeskReads } from './loadSalesDesk'
import { buildSalesDesk, isMarked, isWin, type SalesDecidedBid } from './salesDesk'

/**
 * v2.6813: on the Sales desk a ZZ test job is no job a bid became. The fake hands every `bids` read the same rows and
 * every `jobs_ledger` read the same rows, so each bid here is read as open and as decided, and its job as the span's.
 * Since the owner's rule of 2026-11-11 a job made from a bid decides nothing: the loader still hands such a bid over
 * with its job's day, and the desk leaves it out of every record (`isMarked`).
 */
const jobMade = (b: SalesDecidedBid): boolean => !!b.jobCreatedYmd
const bid = (id: string, projectName: string) => ({ id, bid_number: id, project_name: projectName, gc_builder_id: null, customer_id: null, bid_value: 8_000, agreed_value: null, bid_date_sent: '2026-10-02', created_at: '2026-10-01T15:00:00+00:00', next_followup_on: null, next_followup_reason: null, last_contact: null, outcome: null, outcome_at: null, loss_category: null, loss_reason: null })
const job = (id: string, bidId: string, jobName: string, customerName: string) => ({ id, job_name: jobName, customer_name: customerName, bid_id: bidId, created_at: '2026-10-06T15:00:00+00:00', billing_only: false })
const rows = {
  bids: [bid('b1', 'Elm'), bid('b2', 'Oak'), bid('b3', 'Ash'), bid('zz', 'ZZ Shadow TAVISH 8199')],
  jobs_ledger: [job('real', 'b1', 'Elm', 'Ann Lee'), job('zzById', 'b2', 'Renamed since', 'Ann Lee'), job('zzByName', 'b3', 'Walk through', 'ZZ Test Customer')],
  estimates: [],
}

describe('loadSalesDeskReads', () => {
  it('a job takes no bid out of the open pile, and a ZZ job is no job a bid became in the span', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const reads = await loadSalesDeskReads(db, { todayYmd: '2026-10-26', zzTestJobIds: new Set(['zzById']), hideZzEstimates: true })
    // b1 has a real job and no mark: under the rule it is still out, with the two whose jobs are ZZ.
    expect(reads.openBids.map((b) => b.id)).toEqual(['b1', 'b2', 'b3'])
    expect(reads.decidedBids.filter(jobMade).map((b) => b.id)).toEqual(['b1'])
    // A job made from a bid with no mark is neither a win nor decided.
    expect(reads.decidedBids.filter(isWin)).toEqual([])
    expect(reads.decidedBids.filter(isMarked)).toEqual([])
  })
  it('keeps every job for a dev who shows them', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const reads = await loadSalesDeskReads(db, { todayYmd: '2026-10-26', zzTestJobIds: null, hideZzEstimates: false })
    expect(reads.openBids.map((b) => b.id)).toEqual(['b1', 'b2', 'b3', 'zz'])
    expect(reads.decidedBids.filter(jobMade).map((b) => b.id)).toEqual(['b1', 'b2', 'b3'])
  })
})

describe('loadSalesDeskReads: a ZZ bid is in neither pile (v2.6823)', () => {
  it('a robot\'s sent bid is not open, and a ZZ bid marked won is no win', async () => {
    const { db } = makeProxyFakeSupabase({
      bids: [{ ...bid('zzOpen', 'ZZ Shadow TAVISH 8199') }, { ...bid('zzWon', 'ZZ Test'), outcome: 'won', outcome_at: '2026-10-05T15:00:00+00:00' }, bid('b1', 'Elm')],
      jobs_ledger: [],
      estimates: [],
    })
    const reads = await loadSalesDeskReads(db, { todayYmd: '2026-10-26', zzTestJobIds: new Set(), hideZzEstimates: true })
    expect(reads.openBids.map((b) => b.id)).toEqual(['b1'])
    expect(reads.decidedBids.map((b) => b.id)).toEqual([])
  })
})

/**
 * v2.8280 (punch list #334, a fault found while building): on the Sales window a ZZ test estimate is in neither the
 * estimates still out nor the estimates' own history, for the viewer who hides ZZ tests. The fake hands both
 * estimates reads the same rows, so each estimate here is read as still out and as history. Made-up customers and
 * dollars.
 */
describe('loadSalesDeskReads: a ZZ test estimate is in neither list (v2.8280)', () => {
  const estimate = (id: string, title: string, customer: string | null, status: string, cents: number) => ({ id, title, customers: customer == null ? null : { name: customer }, customer_id: customer == null ? null : `c-${id}`, created_at: '2026-10-05T15:00:00+00:00', sent_at: '2026-10-06T15:00:00+00:00', status, total_cents: cents, acceptor_consented_at: status === 'customer_accepted' ? '2026-10-12T15:00:00+00:00' : null, updated_at: '2026-10-12T15:00:00+00:00', doc_kind: 'estimate' })
  const real = [estimate('e1', 'Estimate for Maple Homes', 'Maple Homes', 'sent', 240_000), estimate('e2', 'Estimate for Pine Fork', 'Pine Fork Homes', 'customer_accepted', 120_000)]
  const zz = [estimate('z1', 'Kitchen repipe', 'ZZ Test Walk', 'sent', 500_000), estimate('z2', 'Estimate for ZZ Walk Press', null, 'customer_accepted', 700_000)]
  const TODAY = '2026-10-26'
  const load = (estimates: ReadonlyArray<Record<string, unknown>>, opts: { zzTestJobIds: ReadonlySet<string> | null; hideZzEstimates: boolean }) => loadSalesDeskReads(makeProxyFakeSupabase({ bids: [bid('b1', 'Elm'), bid('zz', 'ZZ Shadow TAVISH 8199')], jobs_ledger: [], estimates }).db, { todayYmd: TODAY, ...opts })
  const desk = (r: Awaited<ReturnType<typeof loadSalesDeskReads>>) => buildSalesDesk({ ...r, todayYmd: TODAY, fallbackRate: 0.2, estimateShare: 0.4 })

  it('leaves the test estimates out of both lists, and the whole window reads as if they were never written', async () => {
    const hidden = await load([...real, ...zz], { zzTestJobIds: new Set(), hideZzEstimates: true })
    expect(hidden.openEstimates.map((e) => [e.id, e.usd])).toEqual([
      ['e1', 2_400],
      ['e2', 1_200],
    ])
    expect(hidden.estimateHistory.map((e) => e.id)).toEqual(['e1', 'e2'])
    const neverWritten = await load(real, { zzTestJobIds: new Set(), hideZzEstimates: true })
    expect(hidden).toEqual(neverWritten)
    expect(desk(hidden)).toEqual(desk(neverWritten))
  })

  it('moves the estimates alone: the open and the decided bids are the same with the switch on or off', async () => {
    const hidden = await load([...real, ...zz], { zzTestJobIds: new Set(), hideZzEstimates: true })
    const kept = await load([...real, ...zz], { zzTestJobIds: new Set(), hideZzEstimates: false })
    expect(hidden.openBids).toEqual(kept.openBids)
    expect(hidden.decidedBids).toEqual(kept.decidedBids)
    expect(hidden.gcNames).toEqual(kept.gcNames)
    expect(kept.openEstimates.map((e) => e.id)).toEqual(['e1', 'e2', 'z1', 'z2'])
  })

  it('keeps every estimate for a dev who shows ZZ tests, with or without a left-out list', async () => {
    const noList = await load([...real, ...zz], { zzTestJobIds: null, hideZzEstimates: false })
    expect(noList.openEstimates.map((e) => e.id)).toEqual(['e1', 'e2', 'z1', 'z2'])
    expect(noList.estimateHistory.map((e) => e.id)).toEqual(['e1', 'e2', 'z1', 'z2'])
    // The ids are a set here because the left-out list names a job. The estimates follow the switch, not the set.
    const withList = await load([...real, ...zz], { zzTestJobIds: new Set(['a-left-out-job']), hideZzEstimates: false })
    expect(withList.openEstimates).toEqual(noList.openEstimates)
    expect(withList.estimateHistory).toEqual(noList.estimateHistory)
  })
})
