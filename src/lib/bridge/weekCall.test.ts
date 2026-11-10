import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { buildCashForecast } from './cashForecast'
import type { BridgeCall } from './calls'
import type { Headline, HeadlineWeek } from './headline'
import type { StageFlow, StageReading } from './stageFlow'
import {
  WEEK_CALL_MOVES,
  WEEK_FIRST_SCREEN_NUMBERS,
  WEEK_HOW,
  WEEK_FIRST_SCREEN_WORDS,
  buildWeekCall,
  firstDayUnderFloor,
  firstName,
  movesToRecord,
  proposedMoves,
  topPerson,
  weekCallBudget,
  weekCallWords,
  whenWords,
  type WeekCallInput,
} from './weekCall'

// Made-up numbers throughout: a company whose finished work waits on the bill.

const week = (start: string, usd: number | null, over: Partial<HeadlineWeek> = {}): HeadlineWeek => ({ start, end: start, label: start.slice(5), current: false, recordedUsd: usd, approvedUsd: usd, recordedHours: 250, approvedHours: 250, pendingHours: 0, waiting: false, ...over })

const headline: Headline = {
  weeks: [week('2026-09-13', 34_000), week('2026-09-20', 29_000), week('2026-09-27', 41_000), week('2026-10-04', 22_000), week('2026-10-11', 38_000), week('2026-10-18', 36_000), week('2026-10-25', 27_000), week('2026-11-01', 31_000), week('2026-11-08', 4_000, { current: true, pendingHours: 12 })],
  thisWeek: week('2026-11-08', 4_000, { current: true, pendingHours: 12 }),
  trend: 'readable',
  verdict: '',
  settled: { lowUsd: 22_000, highUsd: 41_000, count: 8 },
}

const stage = (id: StageReading['id'], name: string, headlineText: string, weeks: number | null, weeksText: string, isLink = false, flowLines: StageReading['flow'] = []): StageReading => ({
  id,
  name,
  object: '',
  action: '',
  readable: true,
  pile: { headline: headlineText, sub: [], usd: 142_000, guessShare: 0 },
  flow: flowLines,
  weeks,
  weeksText,
  badge: isLink ? 'the weakest link' : '',
  tone: isLink ? 'link' : 'plain',
  isLink,
})

const flow: StageFlow = {
  stages: [
    stage('market', 'Market', '45 asks in 8 weeks', null, 'about $210k a week asked'),
    stage('sales', 'Sales', '$1.9M awaiting an answer', null, 'sold $36k of work a week'),
    stage('build', 'Build', '$198k left to build', 6, '6.0 weeks to build what is already sold'),
    stage('bill', 'Bill', '$142k finished, not yet billed', 7.5, '7.5 weeks to bill what is already finished', true, [{ who: 'the field finishes', usd: '$33k' }, { who: 'the office bills', usd: '$19k' }]),
    stage('collect', 'Collect', '$188k billed, not yet paid', 3.7, '3.7 weeks to collect what is already late'),
  ],
  linkId: 'bill',
  nominatedId: 'bill',
  heldStands: false,
  pairId: null,
}

const clear = buildCashForecast({ todayYmd: '2026-11-09', daysAhead: 56, cashTodayUsd: 18_400, floorUsd: 10_000, events: [{ ymd: '2026-11-27', usd: 6_400, label: 'Payroll', kind: 'bill' }, { ymd: '2026-12-04', usd: 30_000, label: 'Receipt', kind: 'receipt' }] })
const under = buildCashForecast({ todayYmd: '2026-11-09', daysAhead: 56, cashTodayUsd: 18_400, floorUsd: 10_000, events: [{ ymd: '2026-11-24', usd: 10_800, label: 'Supply invoices due', kind: 'bill' }, { ymd: '2026-11-27', usd: 5_500, label: 'Payroll', kind: 'bill' }, { ymd: '2026-12-04', usd: 30_000, label: 'Receipt', kind: 'receipt' }] })

const base: WeekCallInput = {
  todayYmd: '2026-11-09',
  weekStart: '2026-11-08',
  headline,
  forecast: clear,
  cashTodayUsd: 18_400,
  cashMayLead: false,
  flow,
  picked: null,
  moveNumbers: { bill: 142_000, chase: 96_000, approve: 96, price: 4, pct: 0 },
  counts: { billJobs: 11, lateInvoices: 9 },
  people: { caller: 'Sam', biller: 'Dana', collector: 'Dana' },
  supplyDue: null,
  calls: [],
  now: { stageWeeks: { bill: 7.5, build: 6, collect: 3.7 }, stagePilesUsd: { bill: 142_000 }, keys: { bill: 142_000, chase: 96_000, approve: 96, price: 4, pct: 0 } },
  dayLabel: (ymd) => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`,
}

const billCall: BridgeCall = {
  id: 'c1',
  weekStart: '2026-11-08',
  calledOn: '2026-11-09',
  calledByName: 'Sam',
  link: 'bill',
  moves: [
    { key: 'bill', title: 'Bill the 11 finished jobs.', who: 'Dana', then: 142_000 },
    { key: 'price', title: 'Price the 4 jobs with no price.', who: 'Sam', then: 4 },
    { key: 'other', title: 'Take bank sorting off whoever bills, so billing is never idle.', who: 'Dana', then: null },
  ],
  measures: { linkWeeks: 7.5, linkPileUsd: 142_000, stageWeeks: { bill: 7.5 }, keys: { bill: 142_000, price: 4 } },
  note: null,
  outcome: null,
  outcomeAt: null,
  outcomeNote: null,
}

const friday: WeekCallInput = {
  ...base,
  todayYmd: '2026-11-13',
  calls: [billCall],
  now: { stageWeeks: { bill: 5.9 }, stagePilesUsd: { bill: 112_000 }, keys: { bill: 64_000, price: 0 } },
}

describe('buildWeekCall, before the call', () => {
  it('proposes the slowest step with its moves, the ones with a number first', () => {
    const m = buildWeekCall(base)
    expect(m.state).toBe('propose')
    expect(m.link).toBe('bill')
    expect(m.cashLeads).toBe(false)
    expect(m.tiles.map((t) => t.id)).toEqual(['made', 'cash', 'step'])
    expect(m.card.lead).toBe('Bill is the slowest step.')
    // The pile and the two paces. The weeks are the step tile's, said once.
    expect(m.card.line).toBe('$142k finished, not yet billed. The field finishes $33k a week. The office bills $19k a week.')
    expect(m.card.press).toBe('Make Bill this week’s call')
    expect(m.card.moves.map((x) => x.title)).toEqual(['Bill the 11 finished jobs.', 'Price the 4 jobs with no price.', 'Take bank sorting off whoever bills, so billing is never idle.'])
    expect(m.card.moves.map((x) => x.who)).toEqual(['Dana', 'Sam', ''])
    expect(m.card.moves[0]).toMatchObject({ key: 'bill', kind: 'step', why: '$142k is finished and not billed.', door: { to: '/jobs?tab=stages' }, then: 142_000 })
    expect(m.card.moves[2]?.door).toBeNull()
    expect(m.last).toBeNull()
  })

  it('drops a keyed move with nothing to do, and never lists more than three', () => {
    const build = proposedMoves('build', base)
    // pct is 0 today, so "set a percent" has nothing to do.
    expect(build.map((x) => x.key)).toEqual(['price', 'other'])
    const sales = buildWeekCall({ ...base, flow: { ...flow, linkId: 'sales' } })
    expect(sales.card.moves.length).toBe(WEEK_CALL_MOVES)
  })

  it('says so when the pick is not the page’s reading', () => {
    const m = buildWeekCall({ ...base, picked: 'collect' })
    expect(m.link).toBe('collect')
    expect(m.card.lead).toBe('Collect is your pick.')
    expect(m.card.line).toBe('The page reads Bill as the slowest step.')
    expect(m.card.moves[0]?.title).toBe('Chase the 9 late invoices.')
    expect(m.card.press).toBe('Make Collect this week’s call')
  })

  it('reads the tiles: the last full week, the low point against the floor, the step', () => {
    const [made, cash, step] = buildWeekCall(base).tiles
    expect(made).toMatchObject({ label: 'Made last week', value: '$31.0k', sub: '8 settled weeks ran $22.0k to $41.0k.' })
    expect(made?.bars?.length).toBe(9)
    expect(made?.bars?.[2]?.share).toBe(1)
    expect(cash).toMatchObject({ value: '$12.0k', label: 'Cash low point, 8 weeks', sub: 'On Nov 27. The floor is $10.0k.', tone: 'green' })
    expect(step).toMatchObject({ value: 'Bill', sub: '7.5 weeks to bill what is already finished.', tone: 'red' })
  })

  it('leads with this week from Friday, and marks a week whose hours still wait', () => {
    const fri = buildWeekCall({ ...base, todayYmd: '2026-11-13' }).tiles[0]
    expect(fri).toMatchObject({ label: 'Made this week so far', value: '$4.0k ≈', sub: 'Last week was $31.0k.' })
    const waiting: Headline = { ...headline, weeks: headline.weeks.map((w) => (w.start === '2026-11-01' ? { ...w, waiting: true, pendingHours: 120 } : w)) }
    expect(buildWeekCall({ ...base, headline: waiting }).tiles[0]).toMatchObject({ value: '$31.0k ≈', sub: '120 hours still wait on approval.' })
    expect(buildWeekCall({ ...base, headline: null, forecast: null, flow: null }).tiles.map((t) => t.value)).toEqual(['not read', 'not read', 'not read'])
  })
})

describe('buildWeekCall, cash under the floor', () => {
  it('shows red and does not lead until the page may trust its cash', () => {
    const m = buildWeekCall({ ...base, forecast: under })
    expect(m.cashLeads).toBe(false)
    expect(m.link).toBe('bill')
    expect(m.tiles[1]).toMatchObject({ id: 'cash', tone: 'red', value: '$2.1k', sub: 'On Nov 27. Under the $10.0k floor from Nov 24.' })
  })

  it('leads when it may: the cash tile first, a call on Capital, cash moves and then the step', () => {
    const m = buildWeekCall({ ...base, forecast: under, cashMayLead: true, supplyDue: { usd: 10_800, ymd: '2026-11-24' } })
    expect(m.cashLeads).toBe(true)
    expect(m.link).toBe('capital')
    expect(m.tiles.map((t) => t.id)).toEqual(['cash', 'made', 'step'])
    expect(m.tiles[0]).toMatchObject({ wide: true, label: 'Cash comes first this week', value: 'Under the floor in 2 weeks', sub: 'Cash goes under $10.0k on Nov 24. The bank has $18.4k today.' })
    expect(m.card.lead).toBe('Keep cash above the floor.')
    expect(m.card.line).toBe('Cash goes under $10.0k on Nov 24. Bill is still the slowest step.')
    expect(m.card.moves.map((x) => [x.kind, x.title])).toEqual([
      ['cash', 'Chase the 9 late invoices.'],
      ['cash', 'Ask the supply houses for more days.'],
      ['step', 'Bill the 11 finished jobs.'],
    ])
    expect(m.card.moves[1]?.why).toBe('$10.8k of supply bills is due Nov 24.')
    expect(m.card.press).toBe('Make this the week’s call')
  })

  it('says which accounts are left out on the cash tile, in every week', () => {
    const note = 'Leaves out Accounts Payable 2222, $12.4k.'
    // A clear week: the note rides under the green tile.
    expect(buildWeekCall({ ...base, cashNote: note }).tiles[1]).toMatchObject({ id: 'cash', tone: 'green', note })
    // Nothing left out: no note at all.
    expect(buildWeekCall(base).tiles[1]?.note).toBeUndefined()
    expect(buildWeekCall({ ...base, cashNote: null }).tiles[1]?.note).toBeUndefined()
    // Under the floor and not leading.
    expect(buildWeekCall({ ...base, forecast: under, cashNote: note }).tiles[1]).toMatchObject({ tone: 'red', note })
    // Leading: the tile no longer says the bank has it, because an account is left out.
    const m = buildWeekCall({ ...base, forecast: under, cashMayLead: true, cashNote: note })
    expect(m.tiles[0]).toMatchObject({ wide: true, sub: 'Cash goes under $10.0k on Nov 24. Cash on hand is $18.4k today.', note })
    expect(weekCallWords(m)).toContain(note)
  })

  it('never leads over the owner’s own pick, and says today when cash is already under', () => {
    expect(buildWeekCall({ ...base, forecast: under, cashMayLead: true, picked: 'build' }).link).toBe('build')
    expect(firstDayUnderFloor(under, 4_000, '2026-11-09')).toEqual({ ymd: '2026-11-09', offset: 0 })
    expect([0, 1, 9, 15].map(whenWords)).toEqual(['today', 'tomorrow', 'in 9 days', 'in 2 weeks'])
  })
})

describe('buildWeekCall, once a call stands', () => {
  it('shows the call and each move against today', () => {
    const m = buildWeekCall({ ...base, todayYmd: '2026-11-10', calls: [billCall], now: { stageWeeks: { bill: 7.1 }, stagePilesUsd: { bill: 131_000 }, keys: { bill: 131_000, price: 4 } } })
    expect(m.state).toBe('standing')
    expect(m.card.lead).toBe('Bill is this week’s call.')
    expect(m.card.line).toBe('It was 7.5 weeks and $142k when called. Today it is 7.1 weeks and $131k.')
    expect(m.card.press).toBeNull()
    expect(m.card.foot).toBe('Called Nov 9 by Sam. Friday asks if it moved.')
    expect(m.card.moves.map((x) => x.doneText)).toEqual(['part', 'not yet', 'yours'])
    expect(m.card.moves[0]?.why).toBe('It was $142k. Today it is $131k.')
  })

  it('asks on Friday, with what the numbers say', () => {
    const m = buildWeekCall(friday)
    expect(m.state).toBe('friday')
    expect(m.card).toMatchObject({ label: 'Friday’s question', lead: 'Did Bill move?', tone: 'ask', foot: 'The numbers say it moved. Your answer is the one kept.' })
    expect(m.card.moves.map((x) => x.doneText)).toEqual(['done', 'done', 'yours'])
    expect(m.card.moves[1]?.why).toBe('It was 4 jobs. Today it is 0 jobs.')
  })

  it('keeps the answer, and the consequence the scorecard draws from it', () => {
    const m = buildWeekCall({ ...friday, calls: [{ ...billCall, outcome: 'did_not_move' }] })
    expect(m.state).toBe('answered')
    expect(m.card.lead).toBe('Bill did not move.')
    expect(m.card.foot).toBe('First week on Bill with nothing moved. Keep the call and move the moves.')
  })

  it('reads a cash call by today’s low point', () => {
    const cashCall: BridgeCall = { ...billCall, link: 'capital', moves: [], measures: { linkWeeks: null, throttles: 'bill', stageWeeks: {}, keys: {} } }
    const m = buildWeekCall({ ...base, todayYmd: '2026-11-10', calls: [cashCall] })
    expect(m.card.lead).toBe('Keep cash above the floor.')
    expect(m.card.line).toBe('Today the low point is $12.0k, on Nov 27.')
  })

  it('asks for the answer nobody gave to an earlier call', () => {
    const m = buildWeekCall({ ...base, calls: [{ ...billCall, weekStart: '2026-11-01', calledOn: '2026-11-02' }] })
    expect(m.state).toBe('propose')
    expect(m.last).toMatchObject({ linkName: 'Bill', text: 'The last call was Bill. Did it move?', asks: true, tone: 'amber' })
    const moved = buildWeekCall({ ...base, calls: [{ ...billCall, weekStart: '2026-11-01', calledOn: '2026-11-02', outcome: 'moved' }] })
    expect(moved.last).toMatchObject({ text: 'The last call was Bill. It moved.', asks: false, tone: 'green' })
  })
})

describe('the first screen’s words', () => {
  const screens = [
    buildWeekCall(base),
    buildWeekCall({ ...base, picked: 'collect' }),
    buildWeekCall({ ...base, forecast: under }),
    buildWeekCall({ ...base, forecast: under, cashMayLead: true, supplyDue: { usd: 10_800, ymd: '2026-11-24' } }),
    buildWeekCall({ ...base, forecast: under, cashMayLead: true, supplyDue: { usd: 10_800, ymd: '2026-11-24' }, cashNote: 'Leaves out Accounts Payable 2222, $12.4k.' }),
    buildWeekCall({ ...base, todayYmd: '2026-11-10', calls: [billCall] }),
    buildWeekCall(friday),
    buildWeekCall({ ...friday, calls: [{ ...billCall, outcome: 'moved' }] }),
    buildWeekCall({ ...base, calls: [{ ...billCall, weekStart: '2026-11-01', calledOn: '2026-11-02' }] }),
    buildWeekCall({ ...base, headline: null, forecast: null, flow: null }),
    ...(['market', 'sales', 'build', 'collect'] as const).map((id) => buildWeekCall({ ...base, flow: { ...flow, linkId: id } })),
  ]

  it('pass the plain-words rule, every sentence of every state', () => {
    for (const s of screens) for (const line of weekCallWords(s, WEEK_CALL_MOVES)) expect(plainWordsFailures(line), line).toEqual([])
    expect(plainWordsFailures(WEEK_HOW.join(' '))).toEqual([])
  })

  it('stay inside a phone’s first screen', () => {
    for (const s of screens) {
      const b = weekCallBudget(s)
      expect(b.words, s.card.lead).toBeLessThanOrEqual(WEEK_FIRST_SCREEN_WORDS)
      expect(b.numbers, s.card.lead).toBeLessThanOrEqual(WEEK_FIRST_SCREEN_NUMBERS)
    }
  })
})

describe('the record press', () => {
  it('writes the moves left on, with the person on each', () => {
    const moves = buildWeekCall(base).card.moves
    expect(movesToRecord(moves, new Set([2]), new Map([[1, ' Jorge ']]))).toEqual([
      { key: 'bill', title: 'Bill the 11 finished jobs.', who: 'Dana', then: 142_000 },
      { key: 'price', title: 'Price the 4 jobs with no price.', who: 'Jorge', then: 4 },
    ])
    expect(movesToRecord(moves, new Set([0, 1, 2]), new Map())).toEqual([])
  })

  it('names who bills from the bills they sent', () => {
    const people = [{ userId: 'u1', name: 'Dana Reyes' }, { userId: 'u2', name: 'Sam Holt' }]
    const sends = [{ userId: 'u1', ymd: '2026-10-20' }, { userId: 'u1', ymd: '2026-10-22' }, { userId: 'u2', ymd: '2026-10-21' }, { userId: 'u2', ymd: '2026-08-01' }, { userId: 'u2', ymd: '2026-08-02' }, { userId: null, ymd: '2026-10-23' }]
    expect(topPerson(sends, people, '2026-09-15')).toBe('Dana')
    expect(topPerson([], people, '2026-09-15')).toBe('')
    expect(firstName('  Sam Holt ')).toBe('Sam')
    expect(firstName(null)).toBe('')
  })
})
