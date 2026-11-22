import { describe, expect, it } from 'vitest'
import { makeProxyFakeSupabase } from '../../test/proxyFakeSupabase'
import { jobIdsAlone } from '../jobs/zzTestJobVisibility'
import { withLeftOutJobIds } from './leftOut'
import { buildDemand } from './demandPace'
import { loadDemandInputs } from './loadDemandPace'
import { loadBuildPaceInputs } from './loadBuildPace'
import { loadBillDeskReads } from './bill/loadBillDesk'
import { loadMarketDeskReads } from './market/loadMarketDesk'
import { loadSalesDeskReads } from './sales/loadSalesDesk'
import { bridgeCollections, bridgeReadyToBill, bridgeZzJobIds, withoutZzBillDeskRows, withoutZzBridgeBids, withoutZzBridgeJobs, withoutZzBridgeMoney, withoutZzFieldSessions, withoutZzJobKeyedRows } from './zzTestJobs'

/**
 * v2.8281 (punch list #334, a fault found while building): a dev who shows ZZ tests lost every ZZ job and ZZ bid on the
 * Bridge once the left-out list named anything. Every read takes one set of ids and took any set to mean *hide the ZZ
 * tests too*. For that dev the list's jobs now arrive as ids alone (`withLeftOutJobIds`), and each read drops those
 * jobs and nothing else.
 *
 * Three viewers are held here, by the ids the page hands a read:
 * - **shows, no list**: null. Every row stays.
 * - **shows, with a list**: the list's jobs as ids alone. The fix: every row stays but the list's.
 * - **hides, with a list**: a plain set of the ZZ jobs and the list's. As it always read.
 *
 * Made-up jobs, customers and dollars.
 */
const LIST: ReadonlySet<string> = new Set(['left'])
/** A dev who shows ZZ tests, with nothing left out. */
const SHOWS = withLeftOutJobIds(null, null)
/** The same dev once the list names a job. */
const SHOWS_WITH_LIST = withLeftOutJobIds(null, LIST)
/** A viewer who hides ZZ tests, with the same list. */
const HIDES_WITH_LIST = withLeftOutJobIds(new Set(['zzById']), LIST)

describe('the three viewers', () => {
  it('are null, the list as ids alone, and a plain set', () => {
    expect(SHOWS).toBeNull()
    expect([...(SHOWS_WITH_LIST ?? [])]).toEqual(['left'])
    expect([...(HIDES_WITH_LIST ?? [])].sort()).toEqual(['left', 'zzById'])
    expect(SHOWS_WITH_LIST).toEqual(jobIdsAlone(['left']))
  })
})

describe('the Bridge’s kernels under the list’s ids alone', () => {
  const job = (id: string, jobName: string, customerName: string, revenue: number, paid = 0) => ({ id, job_name: jobName, customer_name: customerName, revenue, payments_made: paid })
  const jobs = [job('real', 'Hill Street remodel', 'Ann Lee', 4_000, 1_000), job('left', '40 Pine Road', 'Bo Diaz', 7_000, 0), job('zzById', 'Renamed since', 'Ann Lee', 900, 0), job('zzByName', 'ZZ TEST walk', 'Ann Lee', 50, 0), job('zzByCustomer', 'Walk through', 'ZZ Test Customer', 600, 100)]
  const lessTheList = <T extends { id: string }>(rows: T[]) => rows.filter((r) => !LIST.has(r.id))

  it('job rows: the list’s job leaves, and every ZZ job stays', () => {
    expect(withoutZzBridgeJobs(jobs, SHOWS_WITH_LIST).map((j) => j.id)).toEqual(['real', 'zzById', 'zzByName', 'zzByCustomer'])
    expect(withoutZzBridgeJobs(jobs, SHOWS_WITH_LIST)).toEqual(lessTheList(withoutZzBridgeJobs(jobs, SHOWS)))
  })

  it('job rows: a viewer who hides ZZ tests reads as before, the ZZ jobs gone by id and by name', () => {
    expect(withoutZzBridgeJobs(jobs, HIDES_WITH_LIST).map((j) => j.id)).toEqual(['real'])
  })

  it('Ready to Bill and Collections count the ZZ jobs again, less the list’s job', () => {
    expect(bridgeReadyToBill(jobs, SHOWS)).toEqual({ count: 5, revenueUsd: 12_550 })
    expect(bridgeReadyToBill(jobs, SHOWS_WITH_LIST)).toEqual({ count: 4, revenueUsd: 5_550 })
    expect(bridgeReadyToBill(jobs, HIDES_WITH_LIST)).toEqual({ count: 1, revenueUsd: 4_000 })
    expect(bridgeCollections(jobs, SHOWS)).toEqual({ count: 5, openUsd: 11_450 })
    expect(bridgeCollections(jobs, SHOWS_WITH_LIST)).toEqual({ count: 4, openUsd: 4_450 })
    expect(bridgeCollections(jobs, HIDES_WITH_LIST)).toEqual({ count: 1, openUsd: 3_000 })
  })

  it('the ZZ jobs a read knows: the ids pass on as they are, and a ZZ name adds none', () => {
    expect(bridgeZzJobIds(jobs, SHOWS_WITH_LIST)).toBe(SHOWS_WITH_LIST)
    expect(bridgeZzJobIds(jobs, SHOWS)).toBeNull()
    // A viewer who hides them still gathers the jobs the rows name as ZZ.
    expect([...(bridgeZzJobIds(jobs, HIDES_WITH_LIST) ?? [])].sort()).toEqual(['left', 'zzByCustomer', 'zzById', 'zzByName'])
  })

  it('bids: every bid stays, the robots’ and the test bids among them', () => {
    const bids = [{ id: 'b1', project_name: 'Elm Street clinic' }, { id: 'b2', project_name: 'ZZ Shadow TIREBARN' }, { id: 'b3', project_name: 'zz twin (backtest)' }]
    expect(withoutZzBridgeBids(bids, SHOWS_WITH_LIST)).toBe(bids)
    expect(withoutZzBridgeBids(bids, SHOWS)).toBe(bids)
    expect(withoutZzBridgeBids(bids, HIDES_WITH_LIST).map((b) => b.id)).toEqual(['b1'])
  })

  it('rows keyed by a job id: the list’s job’s rows leave and a ZZ job’s stay', () => {
    const sessions = [{ id: 's1', job_ledger_id: 'real' }, { id: 's2', job_ledger_id: 'left' }, { id: 's3', job_ledger_id: 'zzById' }, { id: 's4', job_ledger_id: null }]
    expect(withoutZzFieldSessions(sessions, SHOWS_WITH_LIST).map((s) => s.id)).toEqual(['s1', 's3', 's4'])
    expect(withoutZzJobKeyedRows(sessions, (s) => s.job_ledger_id, SHOWS_WITH_LIST).map((s) => s.id)).toEqual(['s1', 's3', 's4'])
    expect(withoutZzFieldSessions(sessions, SHOWS)).toBe(sessions)
    expect(withoutZzFieldSessions(sessions, HIDES_WITH_LIST).map((s) => s.id)).toEqual(['s1', 's4'])
  })

  it('bills and payments: the list’s job’s money leaves and a ZZ job’s stays', () => {
    const money = { bills: [{ id: 'i1', job_id: 'real' }, { id: 'i2', job_id: 'left' }, { id: 'i3', job_id: 'zzById' }], payments: [{ job_id: 'real', invoice_id: 'i1' }, { job_id: null, invoice_id: 'i2' }, { job_id: 'zzById', invoice_id: 'i3' }] }
    const kept = withoutZzBridgeMoney(money, SHOWS_WITH_LIST)
    expect(kept.bills.map((b) => b.id)).toEqual(['i1', 'i3'])
    expect(kept.payments.map((p) => p.invoice_id)).toEqual(['i1', 'i3'])
    expect(withoutZzBridgeMoney(money, SHOWS)).toBe(money)
    expect(withoutZzBridgeMoney(money, HIDES_WITH_LIST).bills.map((b) => b.id)).toEqual(['i1'])
  })

  it('the Bill desk’s rows: the list’s job leaves with its bills, and a ZZ job keeps its label and its bills', () => {
    const rows = { jobs: jobs.map((j) => ({ id: j.id, job_name: j.job_name, customer_name: j.customer_name })), invoices: jobs.map((j) => ({ id: `bill-${j.id}`, job_id: j.id })) }
    const kept = withoutZzBillDeskRows(rows, SHOWS_WITH_LIST)
    expect(kept.jobs.map((j) => j.id)).toEqual(['real', 'zzById', 'zzByName', 'zzByCustomer'])
    expect(kept.invoices.map((i) => i.job_id)).toEqual(['real', 'zzById', 'zzByName', 'zzByCustomer'])
    expect([...kept.zzJobIds]).toEqual(['left'])
    expect(withoutZzBillDeskRows(rows, HIDES_WITH_LIST).jobs.map((j) => j.id)).toEqual(['real'])
  })
})

describe('the Bridge’s loaders for a dev who shows ZZ tests, with a list', () => {
  const window = { windowStart: '2026-09-28', todayYmd: '2026-10-26' }
  const bid = (id: string, projectName: string) => ({ id, bid_number: id, project_name: projectName, gc_builder_id: null, customer_id: 'gc1', created_at: '2026-10-01T15:00:00+00:00', bid_date_sent: '2026-10-02', bid_value: 8_000, agreed_value: null, outcome: null, outcome_at: null, next_followup_on: null, next_followup_reason: null, last_contact: null, loss_category: null, loss_reason: null })
  const ledgerJob = (id: string, bidId: string, jobName: string, customerName: string, revenue: number) => ({ id, job_name: jobName, customer_name: customerName, bid_id: bidId, hcp_number: null, click_number: null, revenue, pct_complete: 50, status: 'working', created_at: '2026-10-06T15:00:00+00:00', billing_only: false })
  const rows = {
    bids: [bid('b1', 'Elm'), bid('b2', 'ZZ Shadow TIREBARN'), bid('b3', 'Pine')],
    jobs_ledger: [ledgerJob('real', 'b1', 'Elm', 'Ann Lee', 8_400), ledgerJob('zzByName', 'b2', 'ZZ TEST walk', 'Ann Lee', 5_000), ledgerJob('left', 'b3', '40 Pine Road', 'Bo Diaz', 7_000)],
    bids_gc_builders: [],
    customers: [{ id: 'gc1', name: 'Acme GC' }],
    estimates: [],
    job_pct_events: [
      { job_id: 'real', pct: 50, changed_at: '2026-10-20T15:00:00+00:00', source: 'hand' },
      { job_id: 'zzByName', pct: 50, changed_at: '2026-10-20T15:00:00+00:00', source: 'hand' },
      { job_id: 'left', pct: 50, changed_at: '2026-10-20T15:00:00+00:00', source: 'hand' },
    ],
    reports: [],
  }
  // A variable, so the same call reads on a loader that takes the estimates' own switch and on one that does not.
  const optsFor = (zzTestJobIds: ReadonlySet<string> | null) => ({ ...window, zzTestJobIds, hideZzEstimates: false, officeJobLedgerId: null })

  it('the asks and the bids: the ZZ bid is an ask again, its ZZ job dates it, and the list’s job is no job', async () => {
    const load = async (ids: ReadonlySet<string> | null) => loadDemandInputs(makeProxyFakeSupabase(rows).db, optsFor(ids))
    const withList = await load(SHOWS_WITH_LIST)
    expect(withList.bids.map((b) => [b.id, b.jobUsd])).toEqual([
      ['b1', 8_400],
      ['b2', 5_000],
      ['b3', null],
    ])
    expect(buildDemand(withList).market.bidsInvited).toBe(3)
    // Before the fix this dev read what a viewer who hides ZZ tests reads: the ZZ bid gone, and its job with it.
    const hides = await load(HIDES_WITH_LIST)
    expect(hides.bids.map((b) => [b.id, b.jobUsd])).toEqual([
      ['b1', 8_400],
      ['b3', null],
    ])
    // And nothing else moves: it is the no-list read with the list’s job taken off its bid.
    const noList = await load(SHOWS)
    expect(withList.bids).toEqual(noList.bids.map((b) => (b.id === 'b3' ? { ...b, jobCreatedYmd: null, jobUsd: null } : b)))
    expect(withList.estimates).toEqual(noList.estimates)
  })

  it('the build pace: the ZZ job is open, sold and pointed again, and the list’s job is none of them', async () => {
    const load = async (ids: ReadonlySet<string> | null) => loadBuildPaceInputs(makeProxyFakeSupabase(rows).db, optsFor(ids))
    const withList = await load(SHOWS_WITH_LIST)
    expect(withList.openJobs.map((j) => j.id)).toEqual(['real', 'zzByName'])
    expect(withList.createdInWindow.map((j) => j.id)).toEqual(['real', 'zzByName'])
    expect(withList.points.map((p) => p.jobId)).toEqual(['real', 'zzByName'])
    const noList = await load(SHOWS)
    expect(withList.openJobs).toEqual(noList.openJobs.filter((j) => j.id !== 'left'))
    expect(withList.points).toEqual(noList.points.filter((p) => p.jobId !== 'left'))
    expect((await load(HIDES_WITH_LIST)).openJobs.map((j) => j.id)).toEqual(['real'])
  })

  it('the Market window: the ZZ bid is on the strip and is its asker’s first bid again', async () => {
    const zzFirst = { ...bid('zzFirst', 'ZZ Shadow FIRST'), created_at: '2026-08-01T15:00:00+00:00' }
    const load = async (ids: ReadonlySet<string> | null) => loadMarketDeskReads(makeProxyFakeSupabase({ ...rows, bids: [zzFirst, ...rows.bids] }).db, optsFor(ids))
    const withList = await load(SHOWS_WITH_LIST)
    expect(withList.bids.map((b) => b.id)).toEqual(['zzFirst', 'b1', 'b2', 'b3'])
    expect(withList.firstBidYmdByGc.get('gc1')).toBe('2026-08-01')
    expect(withList).toEqual(await load(SHOWS))
    const hides = await load(HIDES_WITH_LIST)
    expect(hides.bids.map((b) => b.id)).toEqual(['b1', 'b3'])
    expect(hides.firstBidYmdByGc.get('gc1')).toBe('2026-10-01')
  })

  it('the Sales window: the ZZ bid is out again, and the list’s job dates no bid', async () => {
    const load = async (ids: ReadonlySet<string> | null) => loadSalesDeskReads(makeProxyFakeSupabase(rows).db, optsFor(ids))
    const withList = await load(SHOWS_WITH_LIST)
    expect(withList.openBids.map((b) => b.id)).toEqual(['b1', 'b2', 'b3'])
    expect(withList.decidedBids.filter((b) => !!b.jobCreatedYmd).map((b) => b.id)).toEqual(['b1', 'b2'])
    const noList = await load(SHOWS)
    expect(withList.openBids).toEqual(noList.openBids)
    expect(noList.decidedBids.filter((b) => !!b.jobCreatedYmd).map((b) => b.id)).toEqual(['b1', 'b2', 'b3'])
    const hides = await load(HIDES_WITH_LIST)
    expect(hides.openBids.map((b) => b.id)).toEqual(['b1', 'b3'])
    expect(hides.decidedBids.filter((b) => !!b.jobCreatedYmd).map((b) => b.id)).toEqual(['b1'])
  })

  it('the Bill window: the ZZ job keeps its bill and its label, and the list’s job has neither', async () => {
    const billRows = {
      jobs_ledger_invoices: [
        { id: 'i1', job_id: 'real', amount: 4_000, billed_at: '2026-10-03T15:00:00Z', sent_to_customer_at: null, sent_by_user_id: null, status: 'billed' },
        { id: 'i2', job_id: 'zzByName', amount: 900, billed_at: '2026-10-04T15:00:00Z', sent_to_customer_at: null, sent_by_user_id: null, status: 'billed' },
        { id: 'i3', job_id: 'left', amount: 7_000, billed_at: '2026-10-05T15:00:00Z', sent_to_customer_at: null, sent_by_user_id: null, status: 'billed' },
      ],
      job_status_events: [
        { job_id: 'real', to_status: 'ready_to_bill', changed_at: '2026-10-01T15:00:00Z' },
        { job_id: 'zzByName', to_status: 'ready_to_bill', changed_at: '2026-10-02T15:00:00Z' },
        { job_id: 'left', to_status: 'ready_to_bill', changed_at: '2026-10-02T15:00:00Z' },
      ],
      jobs_ledger: rows.jobs_ledger,
      users: [],
    }
    const load = async (ids: ReadonlySet<string> | null) => loadBillDeskReads(makeProxyFakeSupabase(billRows).db, { sinceYmd: '2026-09-28', pileJobIds: [], zzTestJobIds: ids })
    const billed = (r: Awaited<ReturnType<typeof loadBillDeskReads>>) => JSON.stringify(r)
    const withList = await load(SHOWS_WITH_LIST)
    expect(billed(withList)).toContain('zzByName')
    expect(billed(withList)).not.toContain('"left"')
    expect(billed(await load(SHOWS))).toContain('"left"')
    const hides = billed(await load(HIDES_WITH_LIST))
    expect(hides).not.toContain('zzByName')
    expect(hides).not.toContain('"left"')
    expect(hides).toContain('real')
  })
})
