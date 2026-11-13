import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { makeProxyFakeSupabase } from '../../test/proxyFakeSupabase'
import { leftOutText, withLeftOutJobIds, type LeftOutRule } from './leftOut'
import { loadLeftOutJobIds } from './leftOutIo'
import { loadBidsSent } from './loadBidWins'
import { loadEstimatesSent } from './loadEstimateWins'

/**
 * The Monday email leaves out what the page leaves out. The job-keyed loaders are stood in for, so each test reads the
 * ids the email handed them. The list, its jobs, the bids sent and the estimates sent are read for real, off one made-up
 * database, and held against the page's own calls.
 */
const seen = vi.hoisted(() => ({ ids: {} as Record<string, unknown> }))
const takes = (name: string) => (opts: { zzTestJobIds: unknown }) => {
  seen.ids[name] = opts.zzTestJobIds
  return Promise.resolve(null)
}

vi.mock('./loadBridgeData', async (original) => ({
  ...(await original<typeof import('./loadBridgeData')>()),
  loadBridgeData: (_db: unknown, opts: { zzTestJobIds: unknown }) => {
    seen.ids.data = opts.zzTestJobIds
    return Promise.resolve({ todayYmd: '2026-11-13', windowStart: '2026-09-19', officeJobLedgerId: null })
  },
}))
vi.mock('../dashboardFinancialsLoad', async (original) => ({ ...(await original<typeof import('../dashboardFinancialsLoad')>()), loadDashboardFinancials: (_db: unknown, opts: { zzTestJobIds: unknown }) => takes('fin')(opts) }))
vi.mock('./loadBridgeVectors', async (original) => ({ ...(await original<typeof import('./loadBridgeVectors')>()), loadBridgeVectorInputs: (_db: unknown, _data: unknown, opts: { zzTestJobIds: unknown }) => takes('people')(opts) }))
vi.mock('./loadVectorDays', async (original) => ({ ...(await original<typeof import('./loadVectorDays')>()), loadVectorDaysInputs: (_db: unknown, opts: { zzTestJobIds: unknown }) => takes('weeks')(opts) }))
vi.mock('./loadBuildPace', async (original) => ({ ...(await original<typeof import('./loadBuildPace')>()), loadBuildPaceInputs: (_db: unknown, opts: { zzTestJobIds: unknown }) => takes('build')(opts) }))
vi.mock('./loadBillPile', async (original) => ({ ...(await original<typeof import('./loadBillPile')>()), loadBillPileJobs: (_db: unknown, opts: { zzTestJobIds: unknown }) => takes('bill')(opts) }))
vi.mock('./loadDemandPace', async (original) => ({ ...(await original<typeof import('./loadDemandPace')>()), loadDemandInputs: (_db: unknown, opts: { zzTestJobIds: unknown }) => takes('demand')(opts) }))

import { LEFT_OUT_GAP, loadMondaySheetReads } from './sheetReads'

/** Every read of the email that takes the ids of the jobs to leave out. */
const JOB_KEYED = ['data', 'fin', 'people', 'weeks', 'build', 'bill', 'demand']

// Made-up names, addresses and dollars.
const development: LeftOutRule = { kind: 'development', key: 'dev-oak', label: 'Oak Hollow' }
const customer: LeftOutRule = { kind: 'customer', key: 'cust-ridge', label: 'Ridgeway Builders' }
const address: LeftOutRule = { kind: 'address', key: '12 elm st', label: '12 Elm St' }
const RULES = [development, customer, address]

const job = (id: string, over: Record<string, unknown> = {}) => ({ id, development_id: null, customer_id: null, gc_customer_id: null, job_address: '40 Pine Rd', bid_id: null, revenue: 10_000, ...over })
const bid = (id: string, over: Record<string, unknown> = {}) => ({ id, project_name: `Bid ${id}`, bid_date_sent: '2026-10-05', bid_value: 50_000, agreed_value: null, outcome: null, development_id: null, customer_id: null, address: '40 Pine Rd', ...over })
const estimate = (id: string, over: Record<string, unknown> = {}) => ({ id, estimate_number: 41, title: `Estimate ${id}`, customers: { name: 'Maple Homes' }, sent_at: '2026-10-05T15:00:00+00:00', status: 'sent', total_cents: 240_000, doc_kind: 'estimate', customer_id: 'cust-maple', customer_email: null, for_address: '40 Pine Rd', acceptor_consented_at: null, updated_at: '2026-10-06T15:00:00+00:00', ...over })

const ROWS = {
  jobs_ledger: [
    job('job-oak', { development_id: 'dev-oak' }),
    job('job-ridge', { customer_id: 'cust-ridge' }),
    job('job-ridge-gc', { gc_customer_id: 'cust-ridge' }),
    job('job-elm', { job_address: '12  Elm St, Austin' }),
    job('job-kept', { bid_id: 'bid-kept' }),
  ],
  bids: [bid('bid-oak', { development_id: 'dev-oak' }), bid('bid-ridge', { customer_id: 'cust-ridge' }), bid('bid-elm', { address: '12 ELM ST' }), bid('bid-kept')],
  estimates: [estimate('est-ridge', { customer_id: 'cust-ridge' }), estimate('est-elm', { for_address: '12 Elm St' }), estimate('est-kept')],
}

/**
 * One database: the saved row behind `app_settings`, and every other table's rows whole. `saved` is the row's text,
 * null for no row, or an error the read answers with. `jobsFail` makes the read of the list's jobs fail.
 */
function fakeDb(saved: string | null | { error: string }, opts: { jobsFail?: boolean } = {}): SupabaseClient<Database> {
  const { db } = makeProxyFakeSupabase(ROWS)
  const settings = () => {
    const answer = saved != null && typeof saved === 'object' ? { data: null, error: { message: saved.error, code: '42501' } } : { data: saved == null ? null : { value_text: saved }, error: null }
    const builder = { select: () => builder, eq: () => builder, maybeSingle: () => Promise.resolve(answer) }
    return builder
  }
  const failing = () => {
    const builder: Record<string, unknown> = { select: () => builder, order: () => builder, range: () => Promise.resolve({ data: null, error: { message: 'no jobs', code: '42501' } }) }
    return builder
  }
  let jobReads = 0
  const from = (table: string) => {
    if (table === 'app_settings') return settings()
    // The list's own read of the jobs is the first one; the bids' read of the jobs they became comes later.
    if (table === 'jobs_ledger' && opts.jobsFail && jobReads++ === 0) return failing()
    return (db as unknown as { from: (t: string) => unknown }).from(table)
  }
  return { from } as unknown as SupabaseClient<Database>
}

const ZZ: ReadonlySet<string> = new Set(['job-zz'])
const read = (db: SupabaseClient<Database>, zzTestJobIds: ReadonlySet<string> | null = ZZ, onProblem?: (what: string, error: unknown) => void) => loadMondaySheetReads(db, { bank: null, zzTestJobIds, canReadTouches: true, onProblem })
const sorted = (ids: unknown) => [...(ids as ReadonlySet<string>)].sort()

beforeEach(() => {
  seen.ids = {}
})

describe('the Monday email leaves out what the page leaves out', () => {
  it('hands every job-keyed read the ZZ jobs and the jobs the list names, the set the page makes', async () => {
    const db = fakeDb(leftOutText(RULES))
    const reads = await read(db)
    // The page's own two steps (`Bridge.tsx`): the jobs the rules name, joined to the ZZ jobs.
    const page = withLeftOutJobIds(ZZ, await loadLeftOutJobIds(db, RULES))
    expect(sorted(page)).toEqual(['job-elm', 'job-oak', 'job-ridge', 'job-ridge-gc', 'job-zz'])
    for (const name of JOB_KEYED) expect([name, sorted(seen.ids[name])]).toEqual([name, sorted(page)])
    expect(reads.gaps).toEqual([])
    expect(reads.leftOut).toEqual(RULES)
  })

  it('drops the bids and the estimates the page drops, by the rules and with the ZZ jobs alone', async () => {
    const db = fakeDb(leftOutText(RULES))
    const reads = await read(db)
    // The page's own calls: the viewer's ZZ switch alone, and the rules.
    expect(reads.bidsSent).toEqual(await loadBidsSent(db, { zzTestJobIds: ZZ, leftOut: RULES }))
    expect(reads.estimatesSent).toEqual(await loadEstimatesSent(db, { leftOut: RULES, zzTestJobIds: ZZ }))
    expect((reads.bidsSent ?? []).map((b) => [b.id, b.leftOut])).toEqual([
      ['bid-oak', true],
      ['bid-ridge', true],
      ['bid-elm', true],
      ['bid-kept', false],
    ])
    expect((reads.estimatesSent ?? []).map((e) => e.id)).toEqual(['est-kept'])
  })

  it('leaves the list’s jobs out when ZZ test jobs are kept, and hands the sent reads no ZZ set', async () => {
    const db = fakeDb(leftOutText([development]))
    const reads = await read(db, null)
    for (const name of JOB_KEYED) expect([name, sorted(seen.ids[name])]).toEqual([name, ['job-oak']])
    expect(reads.bidsSent).toEqual(await loadBidsSent(db, { zzTestJobIds: null, leftOut: [development] }))
  })
})

describe('with nothing left out, the email reads as it did', () => {
  const nothing: Array<[string, string | null]> = [
    ['no row', null],
    ['an empty row', ''],
    ['a saved empty list', '[]'],
    ['broken text', '{not a list'],
  ]
  for (const [name, saved] of nothing) {
    it(`${name}: every read takes the ZZ set itself and no bid or estimate leaves`, async () => {
      const reads = await read(fakeDb(saved))
      for (const read of JOB_KEYED) expect(seen.ids[read]).toBe(ZZ)
      expect((reads.bidsSent ?? []).map((b) => b.leftOut)).toEqual([false, false, false, false])
      expect((reads.estimatesSent ?? []).map((e) => e.id)).toEqual(['est-ridge', 'est-elm', 'est-kept'])
      expect(reads.leftOut).toEqual([])
      expect(reads.gaps).toEqual([])
    })
  }

  it('keeps null for a reader who keeps the ZZ test jobs', async () => {
    await read(fakeDb(null), null)
    for (const name of JOB_KEYED) expect(seen.ids[name]).toBeNull()
  })
})

describe('a list that cannot be read', () => {
  it('leaves nothing out, as on the page, and the mail names it as not read', async () => {
    const problems: string[] = []
    const reads = await read(fakeDb({ error: 'permission denied' }), ZZ, (what) => problems.push(what))
    for (const name of JOB_KEYED) expect(seen.ids[name]).toBe(ZZ)
    expect((reads.bidsSent ?? []).some((b) => b.leftOut)).toBe(false)
    expect((reads.estimatesSent ?? []).length).toBe(3)
    expect(reads.leftOut).toEqual([])
    expect(reads.gaps).toEqual([LEFT_OUT_GAP])
    expect(problems).toEqual([LEFT_OUT_GAP])
  })

  it('keeps the rules for the bids and the estimates when only its jobs cannot be read', async () => {
    const problems: string[] = []
    const reads = await read(fakeDb(leftOutText(RULES), { jobsFail: true }), ZZ, (what) => problems.push(what))
    for (const name of JOB_KEYED) expect(seen.ids[name]).toBe(ZZ)
    expect((reads.bidsSent ?? []).filter((b) => b.leftOut).map((b) => b.id)).toEqual(['bid-oak', 'bid-ridge', 'bid-elm'])
    expect((reads.estimatesSent ?? []).map((e) => e.id)).toEqual(['est-kept'])
    expect(reads.gaps).toEqual([LEFT_OUT_GAP])
    expect(problems).toEqual([LEFT_OUT_GAP])
  })
})
