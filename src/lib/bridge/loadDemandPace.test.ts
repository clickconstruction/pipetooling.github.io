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

  it('a ZZ job dates no win and gives a bid no dollars, and the bid stays a bid', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const input = await loadDemandInputs(db, { ...window, zzTestJobIds: new Set(['zzById']) })
    expect(input.bids.map((b) => [b.id, b.jobCreatedYmd, b.jobUsd])).toEqual([
      ['b1', '2026-10-06', 8_400],
      ['b2', null, null],
      ['b3', null, null],
    ])
    // Each bid is marked and carries its own answer day and value, so each is a win at its own dollars.
    expect(buildDemand(input).sales.bids.wonUsd).toBe(3 * 8_000)
    expect(buildDemand(input).market.bidsInvited).toBe(3)
  })

  it('keeps every job for a dev who shows them', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const input = await loadDemandInputs(db, { ...window, zzTestJobIds: null })
    expect(input.bids.map((b) => b.jobUsd)).toEqual([8_400, 56_343, 56_000])
  })
})

describe('loadDemandInputs: a marked win with no answer day (punch list #318)', () => {
  /**
   * A stand-in client that filters: `gte` on a text column, `in`, and `not(col, 'is', null)`. The proxy fake hands
   * every read of a table the same rows, so it cannot show that an old bid is reached only through its job.
   */
  function filteringDb(tables: Record<string, Array<Record<string, unknown>>>) {
    const asked: Array<{ table: string; filters: string[] }> = []
    const db = {
      from(table: string) {
        const tests: Array<(r: Record<string, unknown>) => boolean> = []
        const filters: string[] = []
        asked.push({ table, filters })
        const builder: Record<string, unknown> = {
          select: () => builder,
          order: () => builder,
          range: () => builder,
          gte: (col: string, v: string) => {
            filters.push(`${col} >= ${v}`)
            tests.push((r) => typeof r[col] === 'string' && (r[col] as string) >= v)
            return builder
          },
          in: (col: string, vals: unknown[]) => {
            filters.push(`${col} in ${vals.join(',')}`)
            tests.push((r) => vals.includes(r[col]))
            return builder
          },
          not: (col: string) => {
            filters.push(`${col} not null`)
            tests.push((r) => r[col] != null)
            return builder
          },
          then: (resolve: (v: unknown) => void) => resolve({ data: (tables[table] ?? []).filter((r) => tests.every((t) => t(r))), error: null }),
        }
        return builder
      },
    }
    return { db: db as unknown as Parameters<typeof loadDemandInputs>[0], asked }
  }

  // An old bid, marked won with no answer day: created and sent long before the three bid reads reach.
  const old = { id: 'old', project_name: 'Made-up clinic', created_at: '2026-03-01T15:00:00+00:00', bid_date_sent: '2026-03-05', bid_value: 30_000, agreed_value: null, outcome: 'won', outcome_at: null }
  const recent = { id: 'recent', project_name: 'Made-up shell', created_at: '2026-10-01T15:00:00+00:00', bid_date_sent: '2026-10-02', bid_value: 9_000, agreed_value: null, outcome: null, outcome_at: null }
  const job = { id: 'j-old', job_name: 'Made-up clinic', customer_name: 'A made-up customer', bid_id: 'old', created_at: '2026-10-06T15:00:00+00:00', revenue: 31_000, billing_only: false }
  const earlierJob = { id: 'j-early', job_name: 'Made-up annex', customer_name: 'A made-up customer', bid_id: 'older', created_at: '2026-04-01T15:00:00+00:00', revenue: 12_000, billing_only: false }
  const older = { ...old, id: 'older', project_name: 'Made-up annex' }
  const window = { windowStart: '2026-09-28', todayYmd: '2026-10-26' }

  it('reads the bid behind a job made inside the window, so the win is dated by that job', async () => {
    const { db, asked } = filteringDb({ bids: [old, older, recent], jobs_ledger: [job, earlierJob], estimates: [] })
    const input = await loadDemandInputs(db, { ...window, zzTestJobIds: new Set() })
    // The recent bid comes in by its own days; the old one only through its job. The bid whose job is before the window stays out.
    expect(input.bids.map((b) => [b.id, b.outcome, b.outcomeYmd, b.jobCreatedYmd]).sort()).toEqual([
      ['old', 'won', null, '2026-10-06'],
      ['recent', null, null, null],
    ])
    expect(buildDemand(input).sales.bids.wonUsd).toBe(30_000)
    expect(asked.filter((a) => a.table === 'bids').some((a) => a.filters.includes('id in old'))).toBe(true)
  })

  it('a job decides nothing: the same bid with no mark is still out, and no win', async () => {
    const { db } = filteringDb({ bids: [{ ...old, outcome: null }, recent], jobs_ledger: [job], estimates: [] })
    const demand = buildDemand(await loadDemandInputs(db, { ...window, zzTestJobIds: new Set() }))
    expect(demand.sales.bids.wonUsd).toBe(0)
  })
})

describe('loadDemandInputs: a ZZ bid is no ask and no bid sent (v2.6823)', () => {
  const bid = (id: string, projectName: string) => ({ id, project_name: projectName, created_at: '2026-10-01T15:00:00+00:00', bid_date_sent: '2026-10-02', bid_value: 8_000, agreed_value: null, outcome: null, outcome_at: null })
  const rows = { bids: [bid('b1', 'Elm'), bid('b2', 'ZZ Shadow TIREBARN'), bid('b3', 'ZZ Test')], jobs_ledger: [], estimates: [] }
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
