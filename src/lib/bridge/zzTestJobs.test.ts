import { describe, expect, it } from 'vitest'
import { hidesZzTestJobs, withoutZzTestJobs } from '../jobs/zzTestJobVisibility'
import { bridgeCollections, bridgeReadyToBill, bridgeZzJobIds, withoutZzBillDeskRows, withoutZzBridgeBids, withoutZzBridgeJobs, withoutZzBridgeMoney, withoutZzFieldSessions, withoutZzJobKeyedRows } from './zzTestJobs'

/**
 * v2.6807: the Bridge's own reads leave ZZ test jobs out by the Pipeline's rule. The office saw a count read one over
 * its section on 2026-11-09 because a ZZ test job sat in Ready to Bill (the assistants' bar, v2.6805); the Bridge's
 * loader read the same stage with no rule at all.
 */
const job = (id: string, jobName: string, customerName: string | null, revenue: number | null = 1000) => ({ id, job_name: jobName, customer_name: customerName, revenue, status: 'ready_to_bill' })
const readyToBill = [job('real', 'Hill Street remodel', 'Ann Lee', 4000), job('zzJob', 'ZZ TEST ready to bill', 'Ann Lee', 900), job('zzCustomer', 'Walk through', 'ZZ Test Customer', 50), job('pizza', 'Marcos Pizza', 'Jazz Hall', 600)]
/** The shared id read's answer (`loadZzTestJobIds`): every ZZ job the viewer can see. */
const sharedIds = new Set(['zzJob', 'zzCustomer', 'zzPaid'])

/** What the page passes the loader: the ids while ZZ jobs are hidden, null for a dev whose switch shows them. */
const idsFor = (role: string | null, devShowsZz: boolean) => (hidesZzTestJobs(role, devShowsZz) ? sharedIds : null)
/** The Pipeline's Ready to Bill section for the same viewer: the jobs cache hands the rows out by the same rule. */
const pipelineSection = (role: string | null, devShowsZz: boolean) => (hidesZzTestJobs(role, devShowsZz) ? withoutZzTestJobs(readyToBill) : readyToBill)

describe('the Bridge\'s Ready to Bill count is the Pipeline section\'s rows', () => {
  const viewers: Array<{ who: string; role: string | null; devShowsZz: boolean; count: number; revenueUsd: number }> = [
    { who: 'an assistant', role: 'assistant', devShowsZz: false, count: 2, revenueUsd: 4600 },
    { who: 'an owner whose device once held the dev switch', role: 'master_technician', devShowsZz: true, count: 2, revenueUsd: 4600 },
    { who: 'a role still loading', role: null, devShowsZz: false, count: 2, revenueUsd: 4600 },
    { who: 'a dev hiding them', role: 'dev', devShowsZz: false, count: 2, revenueUsd: 4600 },
    { who: 'a dev showing them', role: 'dev', devShowsZz: true, count: 4, revenueUsd: 5550 },
  ]
  for (const v of viewers) {
    it(`${v.who}: ${v.count} jobs`, () => {
      const lever = bridgeReadyToBill(readyToBill, idsFor(v.role, v.devShowsZz))
      expect(lever.count).toBe(pipelineSection(v.role, v.devShowsZz).length)
      expect(lever).toEqual({ count: v.count, revenueUsd: v.revenueUsd })
    })
  }

  it('a ZZ job made since the ids were read leaves by its own name', () => {
    expect(bridgeReadyToBill(readyToBill, new Set()).count).toBe(2)
  })

  it('a lean row with no names leaves by the shared ids alone', () => {
    const lean = readyToBill.map((r) => ({ id: r.id, revenue: r.revenue }))
    expect(bridgeReadyToBill(lean, sharedIds)).toEqual({ count: 2, revenueUsd: 4600 })
    expect(bridgeReadyToBill(lean, null).count).toBe(4)
  })

  it('hands back the same array when there is nothing to drop', () => {
    const rows = readyToBill.filter((r) => r.id === 'real' || r.id === 'pizza')
    expect(withoutZzBridgeJobs(rows, sharedIds)).toBe(rows)
    expect(withoutZzBridgeJobs(readyToBill, null)).toBe(readyToBill)
  })
})

describe('the Collections read', () => {
  const rows = [
    { id: 'real', job_name: 'Hill Street remodel', customer_name: 'Ann Lee', revenue: 4000, payments_made: 1000 },
    { id: 'overpaid', job_name: 'Small service call', customer_name: 'Bo Diaz', revenue: 200, payments_made: 250 },
    { id: 'zzJob', job_name: 'ZZ TEST collections', customer_name: 'Ann Lee', revenue: 900, payments_made: 0 },
  ]
  it('leaves a ZZ job out of the count and the open money, and keeps it for a dev who shows them', () => {
    expect(bridgeCollections(rows, sharedIds)).toEqual({ count: 2, openUsd: 3000 })
    expect(bridgeCollections(rows, null)).toEqual({ count: 3, openUsd: 3900 })
  })
})

describe('the jobs worked', () => {
  const sessions = [
    { job_ledger_id: 'real', work_date: '2026-11-02' },
    { job_ledger_id: 'zzJob', work_date: '2026-11-02' },
    { job_ledger_id: null, work_date: '2026-11-03' },
  ]
  it('a session clocked on a ZZ job leaves, so the job is not worked and earns nothing', () => {
    expect(withoutZzFieldSessions(sessions, sharedIds).map((s) => s.job_ledger_id)).toEqual(['real', null])
  })
  it('keeps every session for a dev who shows them, and the same array when none is dropped', () => {
    expect(withoutZzFieldSessions(sessions, null)).toBe(sessions)
    const clean = sessions.filter((s) => s.job_ledger_id !== 'zzJob')
    expect(withoutZzFieldSessions(clean, sharedIds)).toBe(clean)
    expect(withoutZzFieldSessions(sessions, new Set())).toBe(sessions)
  })
})

describe('the bills sent and the payments in', () => {
  const bills = [
    { id: 'b1', job_id: 'real', amount: 4000 },
    { id: 'b2', job_id: 'zzJob', amount: 900 },
    { id: 'b3', job_id: 'zzPaid', amount: 75 },
  ]
  const payments = [
    { job_id: 'real', invoice_id: 'b1', amount: 1000 },
    { job_id: 'zzPaid', invoice_id: 'b3', amount: 75 },
    { job_id: null, invoice_id: 'b2', amount: 10 },
    { job_id: null, invoice_id: null, amount: 5 },
  ]
  it('a ZZ job takes its bills with it, and a payment goes with its job or with its bill', () => {
    const kept = withoutZzBridgeMoney({ bills, payments }, sharedIds)
    expect(kept.bills.map((b) => b.id)).toEqual(['b1'])
    expect(kept.payments.map((p) => p.amount)).toEqual([1000, 5])
  })
  it('keeps every row for a dev who shows them', () => {
    const money = { bills, payments }
    expect(withoutZzBridgeMoney(money, null)).toBe(money)
  })
})

describe('the Bill desk\'s reads', () => {
  const jobs = [
    { id: 'real', job_name: 'Hill Street remodel', customer_name: 'Ann Lee' },
    { id: 'zzJob', job_name: 'ZZ TEST billed', customer_name: 'Ann Lee' },
    { id: 'zzNew', job_name: 'Walk through', customer_name: 'ZZ Test Customer' },
    { id: 'zzPaid', job_name: 'Renamed since', customer_name: 'Ann Lee' },
  ]
  const invoices = [
    { id: 'b1', job_id: 'real' },
    { id: 'b2', job_id: 'zzJob' },
    { id: 'b3', job_id: 'zzNew' },
    { id: 'b4', job_id: 'zzPaid' },
  ]
  it('a ZZ job leaves by the shared ids or by its own names, with its bills, and says which jobs went', () => {
    const kept = withoutZzBillDeskRows({ jobs, invoices }, sharedIds)
    expect(kept.jobs.map((j) => j.id)).toEqual(['real'])
    expect(kept.invoices.map((i) => i.id)).toEqual(['b1'])
    expect([...kept.zzJobIds].sort()).toEqual(['zzCustomer', 'zzJob', 'zzNew', 'zzPaid'])
  })
  it('keeps every row for a dev who shows them', () => {
    const kept = withoutZzBillDeskRows({ jobs, invoices }, null)
    expect(kept.jobs).toBe(jobs)
    expect(kept.invoices).toBe(invoices)
    expect(kept.zzJobIds.size).toBe(0)
  })
})

/**
 * v2.6813: the Bridge's other loaders (the Build pace, the people's reads, the demand read, the Market and Sales desks,
 * the Collect scorecard) take the same ids. Prod on 2026-11-09 held four open ZZ jobs, two of them at about $56,000,
 * in the Build pile and the jobs sold.
 */
describe('the ZZ jobs a read knows', () => {
  const rows = [
    { id: 'real', job_name: 'Hill Street remodel', customer_name: 'Ann Lee' },
    { id: 'zzNew', job_name: 'ZZ TEST seat walk', customer_name: 'Robert Test' },
    { id: 'zzCustomerNew', job_name: 'Walk through', customer_name: 'zz test customer' },
    { id: 'pizza', job_name: 'Marcos Pizza', customer_name: 'Jazz Hall' },
  ]
  it('adds the jobs the rows name as ZZ to the shared ids', () => {
    expect([...(bridgeZzJobIds(rows, sharedIds) ?? [])].sort()).toEqual(['zzCustomer', 'zzCustomerNew', 'zzJob', 'zzNew', 'zzPaid'])
  })
  it('is the shared ids themselves when the rows name none', () => {
    expect(bridgeZzJobIds(rows.slice(0, 1), sharedIds)).toBe(sharedIds)
    expect(bridgeZzJobIds([], sharedIds)).toBe(sharedIds)
  })
  it('stays null for a dev who shows them, whatever the rows say', () => {
    expect(bridgeZzJobIds(rows, null)).toBeNull()
  })
})

describe('rows keyed to a job by an id alone', () => {
  const points = [
    { jobId: 'real', pct: 40 },
    { jobId: 'zzJob', pct: 25 },
    { jobId: 'zzPaid', pct: 100 },
  ]
  const events = [
    { job_id: 'real', event_type: 'invoice_sent' },
    { job_id: 'zzJob', event_type: 'payment_added' },
    { job_id: null, event_type: 'payment_added' },
  ]
  it('a percent point, an event or a payment on a ZZ job leaves, and a row on no job stays', () => {
    expect(withoutZzJobKeyedRows(points, (p) => p.jobId, sharedIds)).toEqual([{ jobId: 'real', pct: 40 }])
    expect(withoutZzJobKeyedRows(events, (e) => e.job_id, sharedIds).map((e) => e.job_id)).toEqual(['real', null])
  })
  it('keeps every row for a dev who shows them, and the same array when none is dropped', () => {
    expect(withoutZzJobKeyedRows(points, (p) => p.jobId, null)).toBe(points)
    expect(withoutZzJobKeyedRows(points, (p) => p.jobId, new Set())).toBe(points)
    const clean = points.filter((p) => p.jobId === 'real')
    expect(withoutZzJobKeyedRows(clean, (p) => p.jobId, sharedIds)).toBe(clean)
  })
  it('takes the ids a read found by name', () => {
    const seen = bridgeZzJobIds([{ id: 'zzNew', job_name: 'ZZ TEST seat walk', customer_name: 'Robert Test' }], new Set<string>())
    expect(withoutZzJobKeyedRows([{ jobId: 'zzNew' }, { jobId: 'real' }], (p) => p.jobId, seen)).toEqual([{ jobId: 'real' }])
  })
})

/**
 * v2.6823: the bids follow their own rule on the Bridge, for the same viewer. Prod on 2026-11-09 counted 71 bids
 * opened in the window on Market; about 36 of them were the robots' shadow and backtest bids.
 */
describe('the ZZ bids', () => {
  const bids = [
    { id: 'b1', project_name: 'Elm Street clinic' },
    { id: 'b2', project_name: 'ZZ Shadow AUTOZONE - KYLE, TX' },
    { id: 'b3', project_name: 'zz twin HEB CSTORE (backtest)' },
    { id: 'b4', project_name: 'ZZZ Corp warehouse' },
    { id: 'b5', project_name: null },
  ]
  it('a robot\'s or a test bid leaves by its project name; ZZZ Corp and a nameless bid stay', () => {
    expect(withoutZzBridgeBids(bids, sharedIds).map((b) => b.id)).toEqual(['b1', 'b4', 'b5'])
    expect(withoutZzBridgeBids(bids, new Set()).map((b) => b.id)).toEqual(['b1', 'b4', 'b5'])
  })
  it('keeps every bid for a dev who shows ZZ rows, and the same array when none is dropped', () => {
    expect(withoutZzBridgeBids(bids, null)).toBe(bids)
    const clean = bids.filter((b) => b.id === 'b1' || b.id === 'b5')
    expect(withoutZzBridgeBids(clean, sharedIds)).toBe(clean)
  })
})
