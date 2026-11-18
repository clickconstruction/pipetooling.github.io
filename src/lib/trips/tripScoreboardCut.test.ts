/**
 * The Scoreboard cut by trip (punch list #379, PR 8). Heron Point's made-up jobs, people, days and round
 * dollars; nothing here is real.
 */
import { describe, expect, it } from 'vitest'
import { EMPTY_CARD_CHARGE_EXCLUSIONS } from '../../../supabase/functions/_shared/cardChargeAllocationFilter'
import type { MemberJob } from '../developments/overview'
import { buildScoreboard, type ScoreboardColumnKey, type ScoreboardModel, type SiteOverheadRead } from '../developments/scoreboard'
import { isScoreboardCut, SCOREBOARD_CUTS } from '../developments/scoreboardCuts'
import { jobCostsFromRows, type SiteCostRows, type SiteCostsRead } from '../developments/siteCosts'
import type { SiteLaborRead } from '../developments/siteLabor'
import { siteChargeEventsFromCostRows } from '../developments/siteTimeline'
import { addDays, type TripDayKind } from './tripDays'
import { newTripRecord, type TripRecord, type TripRosterPerson } from './tripRecord'
import { scoreboardTripCut, SCOREBOARD_TRIP_HOME_WORDS, type ScoreboardTripCut } from './tripScoreboardCut'

const TODAY = '2026-11-17'
function job(over: Partial<MemberJob> & { id: string }): MemberJob {
  return {
    hcp_number: null, click_number: over.id.replace('j', '210'), job_name: `Job ${over.id}`, job_address: null, customer_id: null, customer_name: null, gc_customer_id: null,
    development_id: 'd1', bid_id: null, status: 'working', revenue: 0, payments_made: 0, pct_complete: null, last_work_date: null, last_bill_date: null, job_plans_link: null,
    created_at: null, updated_at: null, ...over,
  } as MemberJob
}
const label = (j: MemberJob) => `J${j.click_number}`
const jobs = [job({ id: 'j1', revenue: 100000, pct_complete: 50 }), job({ id: 'j2', revenue: 20000, pct_complete: 50 })]
const day = (ymd: string, hours: number, costUsd: number) => ({ ymd, hours, costUsd })
const labor: SiteLaborRead = {
  state: 'read',
  labor: {
    byJobId: new Map([
      ['j1', { jobId: 'j1', hours: 33, costUsd: 1750, days: 4, people: [
        { personName: 'Luis', personId: 'p-luis', userId: 'u-luis', hours: 28, costUsd: 1400, days: 4, leadDays: 0, byWorkDate: [day('2026-10-12', 8, 400), day('2026-10-29', 6, 300), day('2026-10-31', 10, 500), day('2026-11-02', 4, 200)] },
        { personName: 'Dana', personId: 'p-dana', userId: null, hours: 5, costUsd: 350, days: 1, leadDays: 0, byWorkDate: [day('2026-10-31', 5, 350)] },
      ] }],
      ['j2', { jobId: 'j2', hours: 18, costUsd: 720, days: 2, people: [{ personName: 'Priya', personId: 'p-priya', userId: null, hours: 18, costUsd: 720, days: 2, leadDays: 0, byWorkDate: [day('2026-10-31', 10, 400), day('2026-11-04', 8, 320)] }] }],
    ]),
    siteDays: 5,
    people: 3,
    daysKnown: true,
  },
}
const tx = (posted_at: string | null, amount: number) => ({ posted_at, counterparty_name: 'A made-up fuel stop', amount })
const ROWS: SiteCostRows = {
  jobIds: ['j1', 'j2'],
  invoiceAmounts: [{ job_id: 'j1', invoice_amount: 1500 }],
  cardAlloc: [
    { job_id: 'j1', id: 'a1', mercury_transaction_id: 'tx1', amount: -120, mercury_transactions: tx('2026-10-29', -120) },
    { job_id: 'j1', id: 'a2', mercury_transaction_id: 'tx2', amount: -90, mercury_transactions: tx('2026-10-28', -90) },
    { job_id: 'j2', id: 'a3', mercury_transaction_id: 'tx3', amount: -200, mercury_transactions: tx('2026-11-04', -200) },
    { job_id: 'j1', id: 'a4', mercury_transaction_id: 'tx4', amount: -30, mercury_transactions: tx(null, -30) },
  ],
  cardExclusions: EMPTY_CARD_CHARGE_EXCLUSIONS,
  tally: [],
  otherCharges: [{ job_id: 'j1', amount: 40 }],
  sheets: [{ id: 's1', job_ledger_id: 'j1', labor_rate: 50, distance_miles: 0 }],
  items: [{ job_id: 's1', count: 2, hrs_per_unit: 3, is_fixed: false, labor_rate: 50, direct_labor_amount: null }],
  settings: [],
}
const costs: SiteCostsRead = { state: 'read', byJobId: jobCostsFromRows(ROWS), rows: ROWS }
const overhead: SiteOverheadRead = { state: 'read', byJobId: new Map([['j1', { usd: 250, days: 3 }]]) }

function days(first: string, letters: string): Record<string, TripDayKind> {
  const kind: Record<string, TripDayKind> = { g: 'ready', r: 'road', s: 'site' }
  const out: Record<string, TripDayKind> = {}
  ;[...letters].forEach((c, i) => {
    const k = kind[c]
    if (k) out[addDays(first, i)] = k
  })
  return out
}
const trip = (id: string, first: string, people: Array<[string, string, string]>, purpose: string): TripRecord => ({ ...newTripRecord({ id, developmentId: 'd1' }), purpose, people: people.map(([personId, name, letters]) => ({ personId, userId: null, name, days: days(first, letters) })) })
// The lift stations trip runs across a month end, Luis off on Nov 2. The first try has no hours on the clock. Trim-out is planned.
const records = [
  trip('t5', '2026-10-29', [['p-luis', 'Luis', 'grssxsr'], ['p-priya', 'Priya', 'xrssssr']], 'Lift stations before the pour'),
  trip('t6', '2026-12-01', [['p-dana', 'Dana', 'rsssr']], 'Trim-out, lodge first floor'),
  trip('t1', '2026-02-13', [['p-dana', 'Dana', 'grrssrr']], 'Rough-in, first try'),
]
const roster: TripRosterPerson[] = [{ id: 'p-luis', name: 'Luis', userId: 'u-luis' }, { id: 'p-priya', name: 'Priya', userId: null }, { id: 'p-dana', name: 'Dana', userId: null }]
const toYmd = (raw: string | null) => raw
const whole = () => buildScoreboard({ jobs, invoices: [], jobLabel: label, labor, costs, overhead })
const cutOf = (model: ScoreboardModel, over: Partial<Parameters<typeof scoreboardTripCut>[0]> = {}): ScoreboardTripCut => scoreboardTripCut({ model, labor, records, roster, costs, seesCosts: true, todayYmd: TODAY, toYmd, ...over })

// The measures the cut claims add up: the last row is the site less its trips in these alone.
const ADDS_UP: ScoreboardColumnKey[] = ['hours', 'labor', 'parts']
const sumOf = (cut: ScoreboardTripCut, k: ScoreboardColumnKey) => Math.round(cut.rows.reduce((s, r) => s + (r.m[k] ?? 0), 0) * 100) / 100

describe('the cut key', () => {
  it('is one of the Scoreboard’s cuts, after job, part and person', () => {
    expect(SCOREBOARD_CUTS.map((c) => c.key)).toEqual(['job', 'part', 'person', 'trip'])
    expect(isScoreboardCut('trip')).toBe(true)
  })
})

describe('the cut by trip', () => {
  it('is a row for each trip that has gone out, newest first, then At home for the site; a planned trip is not a row', () => {
    const cut = cutOf(whole())
    expect(cut.pending).toBeNull()
    expect(cut.rows.map((r) => [r.key, r.name, r.kit, r.home])).toEqual([
      ['t5', 'Oct 29 to Nov 4', 'Lift stations before the pour', false],
      ['t1', 'Feb 13 to 19', 'Rough-in, first try', false],
      ['home', SCOREBOARD_TRIP_HOME_WORDS, 'everything outside a trip', true],
    ])
  })

  it('names a trip’s row by its number, its days leading the small words, and hands over the trip for the door on its name', () => {
    const numbered = records.map((r) => (r.id === 't5' ? { ...r, tripNumber: 5 } : r))
    const cut = cutOf(whole(), { records: numbered })
    expect(cut.rows.map((r) => [r.key, r.name, r.kit, r.tripId, r.door])).toEqual([
      ['t5', 'Trip 5', 'Oct 29 to Nov 4 · Lift stations before the pour', 't5', 'Open Trip 5'],
      // Made before numbers: told by its days, as before.
      ['t1', 'Feb 13 to 19', 'Rough-in, first try', 't1', 'Open this trip'],
      ['home', SCOREBOARD_TRIP_HOME_WORDS, 'everything outside a trip', null, null],
    ])
  })

  it('a trip’s row holds its people’s hours and wages on their trip days, the days with that work, the card and bank charges in its days, and the two together as its cost', () => {
    const lifts = cutOf(whole()).rows[0]!
    // Luis Oct 29 and Oct 31, Priya Oct 31 and Nov 4. Luis's day off on Nov 2 and Dana, who never went, stay out.
    expect(lifts.m).toEqual({ hours: 34, days: 3, labor: 1520, parts: 320, cost: 1840 })
    expect(lifts.daysTitle).toBe('Days with clocked work inside the trip. The trip itself ran 7 days.')
    expect(lifts.partsTitle).toBe('Card and bank charges in the days: 2 charges dated on a day someone was on the trip')
    // The trip's cost is its crew's hours and the charges in its days: the figure What it cost shows for it.
    expect(lifts.m.cost).toBe((lifts.m.labor ?? 0) + (lifts.m.parts ?? 0))
  })

  it('leaves blank what cannot be cut by trip, on every row: subs, overhead, earned and profit', () => {
    const cut = cutOf(whole())
    for (const r of cut.rows) {
      expect(r.m.subs).toBeUndefined()
      expect(r.m.overhead).toBeUndefined()
      expect(r.m.earned).toBeUndefined()
      expect(r.m.profit).toBeUndefined()
    }
    // A trip that went out with no hour on the clock is a row of zeros, never left out.
    expect(cut.rows[1]!.m).toEqual({ hours: 0, days: 0, labor: 0, parts: 0, cost: 0 })
  })

  it('the last row is the rest of the hours, the wages and the parts, and nothing else', () => {
    const model = whole()
    const home = cutOf(model).rows[2]!
    // Luis on Oct 12 and on his day off, and Dana.
    expect(home.m).toEqual({ hours: 17, days: 3, labor: 950, parts: 1660 })
    // The site has sub labor and overhead, and the At home row claims neither: a sub who went on a trip is never said to be at home.
    expect([model.site.subs, model.site.overhead]).toEqual([300, 250])
    expect(home.m.subs).toBeUndefined()
    expect(home.m.overhead).toBeUndefined()
    expect(home.m.cost).toBeUndefined()
  })

  it('hours, labor and parts add up to the site’s own totals, the totals the cut by job shows; cost is not claimed to', () => {
    const model = whole()
    const cut = cutOf(model)
    for (const k of ADDS_UP) {
      const byJob = Math.round(model.rows.reduce((s, r) => s + r.m[k], 0) * 100) / 100
      expect([k, sumOf(cut, k)]).toEqual([k, model.site[k]])
      expect([k, sumOf(cut, k)]).toEqual([k, byJob])
    }
    // Days are counted once each across the rows, as the site counts them.
    expect(new Set(cut.rows.flatMap((r) => [...r.dayKeys])).size).toBe(model.site.days)
    // The trips' costs fall short of the site's cost by the subs, the overhead and everything at home.
    expect(model.site.cost).toBe(5000)
    expect(sumOf(cut, 'cost')).toBe(1840)
  })

  it('in a window the rows carry the days inside it alone, and still add up to the windowed site', () => {
    const window = { from: '2026-11-01', to: '2026-11-30' }
    const model = buildScoreboard({ jobs, invoices: [], jobLabel: label, labor, costs, overhead, window, chargeEvents: siteChargeEventsFromCostRows(ROWS, { fuelTxIds: new Set(), toYmd: (raw) => raw ?? null }) })
    const cut = cutOf(model)
    // Priya on Nov 4, and the card charge of that day.
    expect(cut.rows[0]!.m).toEqual({ hours: 8, days: 1, labor: 320, parts: 200, cost: 520 })
    expect(cut.rows[2]!.m.hours).toBe(4)
    for (const k of ADDS_UP) expect([k, sumOf(cut, k)]).toEqual([k, model.site[k]])
    expect(new Set(cut.rows.flatMap((r) => [...r.dayKeys])).size).toBe(model.site.days)
    expect(cut.rows[2]!.m.cost).toBeUndefined()
  })

  it('the leader’s board carries hours and days and no dollar', () => {
    const model = buildScoreboard({ jobs, invoices: [], jobLabel: label, labor })
    const cut = cutOf(model, { seesCosts: false, costs: undefined })
    expect(cut.rows.map((r) => r.m)).toEqual([{ hours: 34, days: 3 }, { hours: 0, days: 0 }, { hours: 17, days: 3 }])
    expect(cut.rows.every((r) => r.partsTitle == null)).toBe(true)
  })

  it('while the costs are out a dev’s rows carry the hours and wages, and no part or cost on half a read', () => {
    const model = buildScoreboard({ jobs, invoices: [], jobLabel: label, labor, costs: { state: 'reading' }, overhead })
    const cut = cutOf(model, { costs: { state: 'reading' } })
    expect(cut.rows.map((r) => r.m)).toEqual([{ hours: 34, days: 3, labor: 1520 }, { hours: 0, days: 0, labor: 0 }, { hours: 17, days: 3, labor: 950 }])
  })

  it('a planned trip becomes a row once something falls on its days', () => {
    const early = buildScoreboard({ jobs, invoices: [], jobLabel: label, labor, costs, overhead })
    const cut = cutOf(early, { todayYmd: '2026-10-01' })
    // On Oct 1 every trip but the first try is still ahead, and the lift stations trip already has hours on its days.
    expect(cut.rows.map((r) => r.key)).toEqual(['t5', 't1', 'home'])
    expect(cutOf(early, { todayYmd: '2026-10-01', records: [records[1]!] }).rows.map((r) => r.key)).toEqual(['home'])
  })

  it('says why there are no rows while a read is out, or when the clock’s days are closed', () => {
    const model = whole()
    expect(cutOf(model, { records: null })).toEqual({ rows: [], pending: 'Reading the trips…' })
    expect(cutOf(model, { roster: null }).pending).toBe('Reading the trips…')
    expect(cutOf(model, { labor: undefined }).pending).toBe('Reading the clock…')
    expect(cutOf(model, { labor: { state: 'reading' } }).pending).toBe('Reading the clock…')
    expect(cutOf(model, { labor: { state: 'failed' } }).pending).toBe('The clock would not read, so the hours are not laid over the trips.')
    expect(cutOf(model, { labor: { state: 'read', labor: { ...labor.labor, daysKnown: false } } as SiteLaborRead }).pending).toBe('The clock’s days are closed to you, so the hours are not laid over the trips.')
  })
})
