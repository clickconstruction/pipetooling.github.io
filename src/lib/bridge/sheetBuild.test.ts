import { describe, expect, it } from 'vitest'
import type { DashboardFinancials } from '../dashboardFinancialsLoad'
import type { FinancialItem } from '../dashboardFinancials'
import type { BridgeCall } from './calls'
import type { BridgeData } from './loadBridgeData'
import { mondaySheetHtml, mondaySheetText } from './mondaySheet'
import { buildSheetFromReads, type MondaySheetReads } from './sheetBuild'

/** A Monday. The pay week runs Sunday to Saturday, so this one is Oct 25–31. */
const TODAY = '2026-10-26'

function data(over: Partial<BridgeData> = {}): BridgeData {
  return {
    todayYmd: TODAY,
    windowStart: '2026-08-31',
    officeJobLedgerId: null,
    earned: { earnedByDay: new Map(), earnedByJob: new Map(), expectedHoursByJob: new Map(), assumedHalfJobs: [], noRevenueJobs: [] },
    jobs: [],
    jobsWorked: 0,
    earnedByDay: new Map(),
    directByDay: new Map(),
    overheadByDay: new Map(),
    totals: { earnedUsd: 0, fieldLaborUsd: 0, materialsUsd: 0, subLaborUsd: 0, overheadUsd: 0 },
    crew: { fieldHours7d: 0, fieldHoursWindow: 0, officeBidHours7d: 0, pendingClosedHours: 0, pendingClosedSessions: 0 },
    overheadPerDayBaseline: 0,
    hygiene: { unattributedNoncard: null, unlinkedCard: null },
    levers: { rtb: { count: 0, revenueUsd: 0 }, collections: { count: 0, openUsd: 0 }, bidsDue: [] },
    hazards: [],
    targetUsd: null,
    bankFlowByDay: new Map(),
    invoicesSentByDay: new Map(),
    paymentsReceivedByDay: new Map(),
    supplyDatedByDay: new Map(),
    supplyPaidByDay: new Map(),
    cashSetting: null,
    floorUsd: 5000,
    bills: [],
    payrollWeeklyEstUsd: 0,
    dailyDrainUsd: 0,
    paySpeeds: null,
    promisedByJob: null,
    ...over,
  }
}

const item = (key: string, amount: number, dateYmd: string): FinancialItem => ({ key, label: key, sublabel: null, amount, dateYmd, jobId: `job-${key}`, address: null, customerId: null, customerName: null, billToParty: null, billToEmail: null, invoiceStatus: null, billedAt: null, sequenceOrder: null }) as unknown as FinancialItem
const bucket = (items: FinancialItem[] = []) => ({ total: items.reduce((s, i) => s + i.amount, 0), count: items.length, oldestDateYmd: null, items })
function fin(arItems: FinancialItem[] = []): DashboardFinancials {
  return {
    ar: bucket(arItems),
    arCollections: bucket(),
    arUncollectible: bucket(),
    arExcluded: { count: 0, total: 0 },
    ap: { ...bucket(), supplyTotal: 0, payrollTotal: 0, subLaborTotal: 0, upcomingTotal: 0 },
    apUpcoming: { total: 0, count: 0, items: [] },
    apBills: {},
    unbilled: bucket(),
  }
}

const reads = (over: Partial<MondaySheetReads> = {}): MondaySheetReads => ({ data: data(), fin: null, bank: null, vectorInputs: null, weeksInputs: null, buildInputs: null, billJobs: null, demandInputs: null, calls: null, collectReads: null, gaps: [], ...over })

/** Last week's call on Collect, unanswered: Friday asks. */
const lastWeeksCall: BridgeCall = { id: 'c1', weekStart: '2026-10-18', calledOn: '2026-10-19', calledByName: 'Isiah', link: 'collect', moves: [], measures: { linkWeeks: 10, linkPileUsd: 50_000, stageWeeks: {}, keys: {} }, note: null, outcome: null, outcomeAt: null, outcomeNote: null }

/** The window's flows, so Collect reads a pace and the stages nominate a link. */
const flows = (): Partial<BridgeData> => ({
  invoicesSentByDay: new Map([['2026-09-15', 20_000], ['2026-10-05', 20_000]]),
  paymentsReceivedByDay: new Map([['2026-09-20', 8_000], ['2026-10-10', 8_000]]),
})

describe('buildSheetFromReads', () => {
  it('with the Bridge data alone: three tiles not read, no link lines, no people, this pay week', () => {
    const sheet = buildSheetFromReads(reads())
    expect(sheet.weekLine).toBe('the week of Oct 25–31, read Oct 26')
    expect(sheet.contribution.tone).toBe('none')
    expect(sheet.net.tone).toBe('none')
    expect(sheet.cash.tone).toBe('none')
    expect(sheet.link).toEqual([])
    expect(sheet.people).toEqual([])
    expect(sheet.gaps).toEqual([])
  })

  it('the Friday ask rides the sheet when last week’s call is unanswered, after the rule, the link and the call lines', () => {
    const sheet = buildSheetFromReads(reads({ data: data(flows()), fin: fin([item('a', 10_000, '2026-09-01'), item('b', 30_000, '2026-09-20')]), calls: [lastWeeksCall] }))
    expect(sheet.link[0]).toMatch(/^Find the slowest step/)
    expect(sheet.link[1]).toMatch(/^Collect: /)
    expect(sheet.link[2]).toBe('No call recorded for this week yet.')
    expect(sheet.link[3]).toMatch(/^Last week's call: Collect, /)
    expect(sheet.link[4]).toBe('Friday asks: did Collect move? Answer it on the Bridge.')
    expect(mondaySheetText(sheet, 'u')).toContain('Friday asks: did Collect move?')
  })

  it('an answered call asks nothing on Friday', () => {
    const sheet = buildSheetFromReads(reads({ data: data(flows()), fin: fin([item('a', 10_000, '2026-09-01')]), calls: [{ ...lastWeeksCall, outcome: 'did_not_move', outcomeAt: '2026-10-23T18:00:00Z' }] }))
    expect(sheet.link.some((l) => l.startsWith('Friday asks'))).toBe(false)
    expect(sheet.link.some((l) => l.startsWith("Last week's call: Collect, did not move"))).toBe(true)
  })

  it('the page’s stepped pay week moves the people lines’ week; today stays the read day', () => {
    const sheet = buildSheetFromReads(reads(), { weekStart: '2026-10-13' })
    expect(sheet.weekLine).toBe('the week of Oct 11–17, read Oct 26')
  })

  it('what could not be read is on the sheet, in the mail’s text and html', () => {
    const sheet = buildSheetFromReads(reads({ gaps: ['the bank', 'the people'] }))
    expect(sheet.gaps).toEqual(['the bank', 'the people'])
    expect(mondaySheetText(sheet, 'u')).toContain('Not read when this sheet was built: the bank, the people. Those tiles read without it.')
    expect(mondaySheetHtml(sheet, 'u')).toContain('Not read when this sheet was built: the bank, the people.')
  })

  it('the bank sets cash on hand and the cash light reads synced; the typed figure stands in without it', () => {
    const withBank = buildSheetFromReads(reads({ data: data({ cashSetting: { usd: 40_000, asOfYmd: '2026-10-01' } }), fin: fin(), bank: { usd: 55_000, accounts: [], readAtIso: '2026-10-26T11:00:00Z' } }))
    expect(withBank.cash.tone).toBe('green')
    expect(withBank.cash.lead).toMatch(/lowest point \$5[0-9]\.\dk/)
    const typed = buildSheetFromReads(reads({ data: data({ cashSetting: { usd: 40_000, asOfYmd: '2026-10-01' } }), fin: fin() }))
    expect(typed.cash.tone).toBe('amber')
  })
})
