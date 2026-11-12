import { describe, expect, it } from 'vitest'
import type { DashboardFinancials } from '../dashboardFinancialsLoad'
import type { FinancialItem } from '../dashboardFinancials'
import type { BridgeCall } from './calls'
import type { BridgeData } from './loadBridgeData'
import { buildWeekMailFromReads, type MondaySheetReads } from './sheetBuild'
import type { BidSent } from './bidWins'
import type { EstimateSent } from './estimateWins'
import type { DemandInput } from './demandPace'
import { weekMailHtml, weekMailLine, weekMailSubject, weekMailText } from './weekMail'

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

/** A bank of two accounts, so one can be left out. */
const bank = { usd: 55_000, accounts: [{ id: 'op', name: 'Mercury Checking ••1111', kind: 'checking', currentBalance: 43_000, availableBalance: 43_000 }, { id: 'ap', name: 'Mercury Checking ••2222', kind: 'checking', currentBalance: 12_000, availableBalance: 12_000 }], readAtIso: '2026-10-26T11:00:00Z' }

const tile = (mail: ReturnType<typeof buildWeekMailFromReads>, id: 'made' | 'cash' | 'step') => mail.model.tiles.find((t) => t.id === id)

describe('buildWeekMailFromReads', () => {
  it('with the Bridge data alone: three tiles not read, a card that says so, this pay week', () => {
    const mail = buildWeekMailFromReads(reads())
    expect(weekMailLine(mail)).toBe('the week of Oct 25–31, read Oct 26')
    expect(mail.model.tiles.map((t) => t.value)).toEqual(['not read', 'not read', 'not read'])
    expect(mail.model.state).toBe('propose')
    expect(mail.model.link).toBeNull()
    expect(mail.model.card.lead).toBe('The five steps are not read yet.')
    expect(mail.strip?.litId).toBeNull()
    expect(mail.gaps).toEqual([])
  })

  it('the slowest step is proposed as the week’s call and lit on the strip, with nobody on a move the page gives to whoever looks', () => {
    const mail = buildWeekMailFromReads(reads({ data: data({ ...flows(), crew: { fieldHours7d: 0, fieldHoursWindow: 0, officeBidHours7d: 0, pendingClosedHours: 40, pendingClosedSessions: 5 } }), fin: fin([item('a', 10_000, '2026-09-01'), item('b', 30_000, '2026-09-20')]) }))
    expect(mail.model.state).toBe('propose')
    expect(mail.model.link).toBe('collect')
    expect(mail.model.card.lead).toBe('Collect is the slowest step.')
    expect(tile(mail, 'step')?.value).toBe('Collect')
    expect(mail.strip?.litId).toBe('collect')
    expect(mail.model.card.moves.length).toBeGreaterThan(0)
    expect(mail.model.card.moves.every((m) => m.who === '')).toBe(true)
  })

  it('last week’s call, unanswered, is asked for beside the proposal, in the text and the html', () => {
    const mail = buildWeekMailFromReads(reads({ data: data(flows()), fin: fin([item('a', 10_000, '2026-09-01'), item('b', 30_000, '2026-09-20')]), calls: [lastWeeksCall] }))
    expect(mail.model.last?.asks).toBe(true)
    expect(mail.model.last?.text).toBe('The last call was Collect. Did it move?')
    expect(weekMailText(mail, 'u')).toContain('The last call was Collect. Did it move?\nAnswer it on the Bridge.')
    expect(weekMailHtml(mail, 'u')).toContain('Answer it on the Bridge.')
  })

  it('an answered call asks nothing', () => {
    const mail = buildWeekMailFromReads(reads({ data: data(flows()), fin: fin([item('a', 10_000, '2026-09-01')]), calls: [{ ...lastWeeksCall, outcome: 'did_not_move', outcomeAt: '2026-10-23T18:00:00Z' }] }))
    expect(mail.model.last?.asks).toBe(false)
    expect(mail.model.last?.text).toBe('The last call was Collect. It did not move.')
    expect(weekMailText(mail, 'u')).not.toContain('Answer it on the Bridge.')
  })

  it('a call that stands this week is shown, with its person’s Done press beside the move', () => {
    const standing: BridgeCall = { ...lastWeeksCall, id: 'c2', weekStart: '2026-10-25', calledOn: '2026-10-25', calledByName: 'Sam', moves: [{ key: 'other', title: 'Call the three slow payers.', who: 'Dana', then: null }] }
    const mail = buildWeekMailFromReads(reads({ data: data(flows()), fin: fin([item('a', 10_000, '2026-09-01')]), calls: [standing] }), { marks: [{ callId: 'c2', idx: 0, doneBy: 'Dana' }] })
    expect(mail.model.state).toBe('standing')
    expect(mail.model.card.lead).toBe('Collect is this week’s call.')
    expect(mail.model.card.moves[0]).toMatchObject({ who: 'Dana', done: 'yes', why: 'Dana marked it done.' })
    expect(weekMailText(mail, 'u')).toContain('Open the Bridge: u')
  })

  it('what could not be read is on the mail, in its text and html', () => {
    const mail = buildWeekMailFromReads(reads({ gaps: ['the bank', 'the people'] }))
    expect(mail.gaps).toEqual(['the bank', 'the people'])
    expect(weekMailText(mail, 'u')).toContain('Not read when this was built: the bank, the people. The rest reads without it.')
    expect(weekMailHtml(mail, 'u')).toContain('Not read when this was built: the bank, the people.')
  })

  it('the bank sets cash on hand; the typed figure stands in without it', () => {
    const typed = { cashSetting: { usd: 40_000, asOfYmd: '2026-10-01' } }
    const withBank = buildWeekMailFromReads(reads({ data: data(typed), fin: fin(), bank }))
    expect(tile(withBank, 'cash')).toMatchObject({ value: '$55.0k', tone: 'green' })
    expect(tile(withBank, 'cash')?.note).toBeUndefined()
    const without = buildWeekMailFromReads(reads({ data: data(typed), fin: fin() }))
    expect(tile(without, 'cash')).toMatchObject({ value: '$40.0k', tone: 'green' })
  })

  it('an account the owner left out is off cash on hand, and the tile says which', () => {
    const mail = buildWeekMailFromReads(reads({ data: data(), fin: fin(), bank }), { accountsOut: ['ap'], bankNames: new Map([['ap', 'Accounts Payable']]) })
    expect(tile(mail, 'cash')).toMatchObject({ value: '$43.0k', note: 'Leaves out Accounts Payable, $12.0k.' })
    expect(weekMailHtml(mail, 'u')).toContain('Leaves out Accounts Payable, $12.0k.')
  })

  it('cash under the floor leads when the bank is read: the tile takes the row and the call is on cash', () => {
    const low = buildWeekMailFromReads(reads({ data: data({ ...flows(), floorUsd: 60_000 }), fin: fin([item('a', 10_000, '2026-09-01')]), bank }))
    expect(low.model.cashLeads).toBe(true)
    expect(low.model.link).toBe('capital')
    expect(low.model.tiles[0]).toMatchObject({ id: 'cash', wide: true })
    expect(weekMailSubject(low)).toBe('The Bridge, the week of Oct 25–31: Keep cash above the floor. Under the floor today. Made last week not read.')
    // The typed figure is not the bank's word, so it never leads.
    const typed = buildWeekMailFromReads(reads({ data: data({ ...flows(), floorUsd: 60_000, cashSetting: { usd: 40_000, asOfYmd: '2026-10-26' } }), fin: fin([item('a', 10_000, '2026-09-01')]) }))
    expect(typed.model.cashLeads).toBe(false)
  })
})

describe('buildWeekMailFromReads: Market on the won rates (punch list #318)', () => {
  // Made-up asks: one bid opened and sent in the window, and the record behind the rates.
  const demandInputs: DemandInput = {
    windowStart: '2026-08-31',
    todayYmd: TODAY,
    bids: [{ id: 'b1', createdYmd: '2026-10-01', sentYmd: '2026-10-02', usd: 400_000, outcome: null, outcomeYmd: null, jobCreatedYmd: null, jobUsd: null }],
    estimates: [],
  }
  const bid = (sentYmd: string, usd: number, outcome: string | null): BidSent => ({ sentYmd, usd, outcome, hasJob: false, jobUsd: null })
  // $20k to $50k bids: one won and three lost at $40k each, a quarter by dollars. $160k of that size went out in the 8 weeks.
  const bidsSent: BidSent[] = [bid('2026-09-10', 40_000, 'won'), bid('2026-09-11', 40_000, 'lost'), bid('2026-09-12', 40_000, 'lost'), bid('2026-09-13', 40_000, 'lost')]
  const est = (sentYmd: string, usd: number, status: string): EstimateSent => ({ sentYmd, usd, status, customerKey: null, addressKey: '', answeredYmd: null })
  // Estimates: $8k approved and $8k declined, half by dollars. $16k went out in the 8 weeks.
  const estimatesSent: EstimateSent[] = [est('2026-09-20', 8_000, 'customer_accepted'), est('2026-09-21', 8_000, 'declined')]
  const market = (mail: ReturnType<typeof buildWeekMailFromReads>) => mail.strip?.sections.find((s) => s.id === 'market')

  it('draws Market at what the asks are worth, and says what the amount is made of', () => {
    const mail = buildWeekMailFromReads(reads({ demandInputs, bidsSent, estimatesSent }))
    // Bids: $160k over 8 weeks is $20k a week, a quarter of it won: $5k. Estimates: $2k a week, half sold: $1k.
    expect(market(mail)?.paceUsd).toBeCloseTo(6_000, 6)
    expect(market(mail)?.paceText).toBe('$6k worth')
    expect(market(mail)?.label).toBe('Market. Worth $6k a week.')
    expect(mail.marketParts).toEqual(['bids $5k at 25% won, a thin count', 'estimates $1k at 50% won, a thin count'])
    const text = weekMailText(mail, 'https://app.example/bridge')
    expect(text).toContain('  Market: $6k worth')
    expect(text).toContain('  What Market is worth: bids $5k at 25% won, a thin count. Estimates $1k at 50% won, a thin count.')
    expect(weekMailHtml(mail, 'https://app.example/bridge')).toContain('$6k worth')
  })

  it('reads the dollars that came in, under asked, when the won rates were not read', () => {
    const mail = buildWeekMailFromReads(reads({ demandInputs }))
    expect(market(mail)?.paceText).toBe('$50k asked')
    expect(mail.marketParts).toEqual([])
    expect(weekMailText(mail, 'https://app.example/bridge')).not.toContain('What Market is worth')
  })

  it('waits for both reads, as the page does: with one missing Market still reads asked', () => {
    for (const over of [{ bidsSent, estimatesSent: null }, { bidsSent: null, estimatesSent }]) {
      const mail = buildWeekMailFromReads(reads({ demandInputs, ...over }))
      expect(market(mail)?.paceText).toBe('$50k asked')
      expect(mail.marketParts).toEqual([])
    }
  })
})
