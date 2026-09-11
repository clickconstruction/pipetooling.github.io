import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PURSUIT_FILTER,
  PURSUIT_WINDOW_WORDS,
  buildPursuitRows,
  canSeeBidCostDollars,
  canSeeBidCosts,
  filterPursuitRows,
  formatPursuitPeople,
  formatUsdShort,
  isRobotBidName,
  pursuitByEstimator,
  pursuitByGc,
  pursuitByOutcome,
  pursuitOutcomeOf,
  pursuitRowsInWindow,
  pursuitSummary,
  type PursuitBidInput,
} from './bidPursuit'

const TODAY = '2026-09-11'
const bid = (o: Partial<PursuitBidInput> & { id: string }): PursuitBidInput => ({
  bid_number: null, project_name: null, outcome: null, bid_date_sent: null, created_at: '2026-06-01T12:00:00Z', bid_value: null, agreed_value: null, working_board_archived_at: null,
  estimator: null, customers: null, bids_gc_builders: null, ...o,
})
const labor = (manHours: number, bidCost: number, people: Array<[string, number]>) => ({ manHours, bidCost, breakdown: people.map(([personName, hours]) => ({ personName, hours })) })
const william = { id: 'u-w', name: 'William', email: 'w@x' }
const wendi = { id: 'u-we', name: 'Wendi', email: 'we@x' }

// Today's prod shape, trimmed: MPH STAGE open, Prue open, ATI won (started), Handel's lost, a robot twin, a bid with nothing.
const bids: PursuitBidInput[] = [
  bid({ id: 'mph', bid_number: '148', project_name: 'MPH STAGE', bid_date_sent: '2026-08-01', bid_value: 148000, estimator: william, customers: { name: 'Summit GC' } }),
  bid({ id: 'prue', bid_number: '380', project_name: 'Prue Event Center', bid_date_sent: '2026-08-24', bid_value: 380000, estimator: [william], bids_gc_builders: { name: 'TCT Construction' } }),
  bid({ id: 'ati', bid_number: '34', project_name: 'ATI Schertz, TX', outcome: 'started_or_complete', bid_date_sent: '2026-05-01', bid_value: 34000, agreed_value: 33500, estimator: wendi }),
  bid({ id: 'handel', bid_number: '95', project_name: "HANDEL'S ICE CREAM LEANDER", outcome: 'lost', bid_date_sent: '2026-08-14', bid_value: 95000, estimator: wendi, customers: { name: 'Summit GC' } }),
  bid({ id: 'twin', project_name: 'ZZ Twin ATI SCHERTZ, TX (backtest)', created_at: '2026-09-01T00:00:00Z', estimator: { id: 'u-t', name: 'Twin Estimator 1', email: 't@x' } }),
  bid({ id: 'quiet', bid_number: '7', project_name: 'Quiet bid', bid_date_sent: '2026-07-01', bid_value: 10000 }),
  bid({ id: 'old', bid_number: '2', project_name: 'Old lost bid', outcome: 'lost', bid_date_sent: '2025-03-01', bid_value: 50000, estimator: william }),
  bid({ id: 'archived', project_name: 'Archived unsent', working_board_archived_at: '2026-08-01T00:00:00Z' }),
]
const laborByBid = new Map([
  ['mph', labor(19.8, 494.99, [['William', 19.8]])],
  ['prue', labor(18.25, 456.1, [['William', 18.25]])],
  ['ati', labor(0.2333, 6.04, [['William', 0.2333]])],
  ['handel', labor(7.0667, 106.04, [['Wendi', 7.0667]])],
  ['twin', labor(1, 30, [['Twin Estimator 1', 1]])],
  ['old', labor(4, 100, [['William', 4]])],
])
const assignedByBid = new Map([['mph', { partsStyle: 37.99, materials: 0, total: 37.99 }]])
const rows = buildPursuitRows({ bids, laborByBid, assignedByBid })

describe('buildPursuitRows', () => {
  it('folds the board outcomes to four and drops archived unsent bids', () => {
    expect(pursuitOutcomeOf({ outcome: 'started_or_complete', bid_date_sent: null, working_board_archived_at: null })).toBe('won')
    expect(pursuitOutcomeOf({ outcome: null, bid_date_sent: '2026-08-01', working_board_archived_at: null })).toBe('open')
    expect(pursuitOutcomeOf({ outcome: null, bid_date_sent: null, working_board_archived_at: '2026-08-01' })).toBeNull()
    expect(rows.find((r) => r.label === 'Archived unsent')).toBeUndefined()
    expect(rows.map((r) => r.bidId)).toEqual(['mph', 'prue', 'handel', 'old', 'twin', 'ati', 'quiet'])
  })
  it('reads label, estimator (object or one-element array), GC, value, and $ per $1k bid', () => {
    const mph = rows.find((r) => r.bidId === 'mph')!
    expect(mph).toMatchObject({ label: 'B148 MPH STAGE', estimatorName: 'William', gcName: 'Summit GC', outcome: 'open', dateYmd: '2026-08-01', hours: 19.8, laborUsd: 494.99, cardUsd: 37.99, bidValue: 148000 })
    expect(mph.totalUsd).toBeCloseTo(532.98, 2)
    expect(mph.usdPerThousandBid).toBeCloseTo(3.6012, 3)
    const prue = rows.find((r) => r.bidId === 'prue')!
    expect(prue).toMatchObject({ estimatorName: 'William', gcName: 'TCT Construction' })
    const ati = rows.find((r) => r.bidId === 'ati')!
    expect(ati.bidValue).toBe(33500) // agreed wins over bid value
    expect(rows.find((r) => r.bidId === 'quiet')).toMatchObject({ totalUsd: 0, hours: 0, usdPerThousandBid: null, people: [] })
    expect(rows.find((r) => r.bidId === 'twin')!.robot).toBe(true)
    expect(isRobotBidName('ZZ Shadow PALMER WINERY')).toBe(true)
    expect(isRobotBidName('ZZ Takeoffs Test')).toBe(false)
  })
})

describe('filters', () => {
  it('the window reads the sent date (else created) and folds robots unless asked', () => {
    expect(pursuitRowsInWindow(rows, 'year', TODAY, false).map((r) => r.bidId)).toEqual(['mph', 'prue', 'handel', 'ati', 'quiet'])
    expect(pursuitRowsInWindow(rows, '90d', TODAY, false).map((r) => r.bidId)).toEqual(['mph', 'prue', 'handel', 'quiet'])
    expect(pursuitRowsInWindow(rows, 'all', TODAY, true).map((r) => r.bidId)).toEqual(['mph', 'prue', 'handel', 'old', 'twin', 'ati', 'quiet'])
  })
  it('the default filter hides empties; chips, estimator, GC and search narrow further', () => {
    expect(filterPursuitRows(rows, DEFAULT_PURSUIT_FILTER, TODAY).map((r) => r.bidId)).toEqual(['mph', 'prue', 'handel', 'ati'])
    expect(filterPursuitRows(rows, { ...DEFAULT_PURSUIT_FILTER, showEmpty: true }, TODAY).map((r) => r.bidId)).toContain('quiet')
    expect(filterPursuitRows(rows, { ...DEFAULT_PURSUIT_FILTER, outcomes: new Set(['lost']) }, TODAY).map((r) => r.bidId)).toEqual(['handel'])
    expect(filterPursuitRows(rows, { ...DEFAULT_PURSUIT_FILTER, estimator: 'Wendi' }, TODAY).map((r) => r.bidId)).toEqual(['handel', 'ati'])
    expect(filterPursuitRows(rows, { ...DEFAULT_PURSUIT_FILTER, gc: 'Summit GC' }, TODAY).map((r) => r.bidId)).toEqual(['mph', 'handel'])
    expect(filterPursuitRows(rows, { ...DEFAULT_PURSUIT_FILTER, query: 'prue' }, TODAY).map((r) => r.bidId)).toEqual(['prue'])
    expect(filterPursuitRows(rows, { ...DEFAULT_PURSUIT_FILTER, query: 'tct' }, TODAY).map((r) => r.bidId)).toEqual(['prue'])
  })
})

describe('pursuitSummary + rollups', () => {
  it('sums spend over bids with time and value over every bid in the window', () => {
    const s = pursuitSummary(pursuitRowsInWindow(rows, 'year', TODAY, false))
    expect(s.bidsWithTime).toBe(4)
    expect(s.spendUsd).toBeCloseTo(532.98 + 456.1 + 106.04 + 6.04, 2)
    expect(s.hours).toBeCloseTo(45.35, 2)
    expect(s.perBidUsd).toBeCloseTo(s.spendUsd / 4, 6)
    expect(s.wonValue).toBe(33500)
    expect(s.lostValue).toBe(95000)
    expect(s.openValue).toBe(148000 + 380000 + 10000)
    expect(s.hitRateByValue).toBeCloseTo(33500 / 128500, 6)
    expect(s).toMatchObject({ lostSpendUsd: 106.04, lostBids: 1 })
    expect(s.lostSpendShare).toBeCloseTo(106.04 / s.spendUsd, 6)
    const none = pursuitSummary([])
    expect(none).toMatchObject({ perBidUsd: null, hitRateByValue: null, lostSpendShare: null })
  })
  it('rolls up by estimator, GC and outcome over bids with time, largest first', () => {
    const inWindow = pursuitRowsInWindow(rows, 'all', TODAY, false)
    expect(pursuitByEstimator(inWindow).map((r) => `${r.label} ${r.bids} ${r.usd.toFixed(2)}`)).toEqual(['William 3 1089.08', 'Wendi 2 112.08']) // ATI's clocked time is William's, its estimator is Wendi — the rail follows the estimator
    expect(pursuitByGc(inWindow).map((r) => `${r.label} ${r.bids}`)).toEqual(['Summit GC 2', 'TCT Construction 1', 'No GC 2'])
    const o = pursuitByOutcome(inWindow)
    expect(o.open).toMatchObject({ bids: 2 })
    expect(o.lost.bids).toBe(2)
    expect(o.lost.usd).toBeCloseTo(206.04, 2)
    expect(o.won).toMatchObject({ bids: 1, usd: 6.04 })
    expect(o.unsent).toMatchObject({ bids: 0 })
  })
})

describe('words + roles', () => {
  it('formats tile dollars, people, and reads the role gates', () => {
    expect(PURSUIT_WINDOW_WORDS).toEqual({ '90d': 'last 90 days', year: 'last 12 months', all: 'all time' })
    expect(formatUsdShort(1706726)).toBe('$1.71M')
    expect(formatUsdShort(564000)).toBe('$564k')
    expect(formatUsdShort(7003.4)).toBe('$7,003')
    expect(formatPursuitPeople([{ name: 'William', hours: 11.05 }, { name: 'Joseph', hours: 0.1167 }])).toBe('William 11:03 · Joseph 0:07')
    expect(formatPursuitPeople([{ name: 'Wendi', hours: 5.9999 }])).toBe('Wendi 6:00')
    expect(['dev', 'master_technician', 'controller', 'assistant', 'estimator'].every(canSeeBidCosts)).toBe(true)
    expect(['primary', 'superintendent', 'helper', 'subcontractor', null].some(canSeeBidCosts)).toBe(false)
    expect(['dev', 'master_technician', 'controller'].every(canSeeBidCostDollars)).toBe(true)
    expect(['assistant', 'estimator'].some(canSeeBidCostDollars)).toBe(false)
  })
})
