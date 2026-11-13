import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { buildFlowStrip, stripWords } from './flowStrip'
import { buildCashForecast } from './cashForecast'
import type { Headline, HeadlineWeek } from './headline'
import type { StageFlow, StageReading } from './stageFlow'
import { WEEK_CALL_MOVES, WEEK_CARD_LABEL, WEEK_FIRST_SCREEN_NUMBERS, WEEK_FIRST_SCREEN_WORDS, WEEK_NOT_READ_LINE, buildWeekCall, deskMoves, firstDayUnderFloor, proposedMoves, weekCallBudget, weekCallWords, whenWords, type WeekCallInput } from './weekCall'

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
  moveNumbers: { bill: 142_000, chase: 96_000, approve: 96, price: 4, pct: 0 },
  counts: { billJobs: 11, lateInvoices: 9 },
  supplyDue: null,
  dayLabel: (ymd) => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`,
}

describe('buildWeekCall, a usual week', () => {
  it('names the slowest step with its moves, the ones with a number first', () => {
    const m = buildWeekCall(base)
    expect(m.link).toBe('bill')
    expect(m.cashLeads).toBe(false)
    expect(m.tiles.map((t) => t.id)).toEqual(['made', 'cash', 'step'])
    expect(m.card.label).toBe('What to do now')
    expect(m.card.lead).toBe('Bill is the slowest step.')
    // The pile and the two paces. The weeks are the step tile's, said once.
    expect(m.card.line).toBe('$142k finished, not yet billed. The field finishes $33k a week. The office bills $19k a week.')
    expect(m.card.tone).toBe('lit')
    // The first three are the ones the card shows; the step's other moves ride behind them.
    expect(m.card.moves.slice(0, WEEK_CALL_MOVES).map((x) => x.title)).toEqual(['Bill the 11 finished jobs.', 'Price the 4 jobs with no price.', 'Take bank sorting off whoever bills, so billing is never idle.'])
    expect(m.card.moves[0]).toEqual({ key: 'bill', kind: 'step', title: 'Bill the 11 finished jobs.', why: '$142k is finished and not billed.', door: { to: '/jobs?tab=stages', label: expect.any(String) }, then: 142_000 })
    expect(m.card.moves[2]?.door).toBeNull()
  })

  it('is a pulse: it names no person, proposes no call and asks nothing about Friday (#334)', () => {
    const m = buildWeekCall(base)
    expect(Object.keys(m).sort()).toEqual(['card', 'cashLeads', 'link', 'tiles'])
    expect(Object.keys(m.card).sort()).toEqual(['label', 'lead', 'line', 'moves', 'tone'])
    for (const move of m.card.moves) expect(Object.keys(move).sort()).toEqual(['door', 'key', 'kind', 'then', 'title', 'why'])
    for (const line of weekCallWords(m, WEEK_CALL_MOVES)) expect(line).not.toMatch(/Friday|call\b/)
  })

  it('drops a keyed move with nothing to do, and carries every move the step has', () => {
    const build = proposedMoves('build', base)
    // pct is 0 today, so "set a percent" has nothing to do.
    expect(build.map((x) => x.key)).toEqual(['price', 'other'])
    const sales = buildWeekCall({ ...base, flow: { ...flow, linkId: 'sales' } }).card.moves
    expect(sales.length).toBeGreaterThan(WEEK_CALL_MOVES)
  })

  it('says the list opens later while the five steps are not read', () => {
    const m = buildWeekCall({ ...base, flow: null })
    expect(m.link).toBeNull()
    expect(m.card).toEqual({ label: WEEK_CARD_LABEL, lead: 'The five steps are not read yet.', line: WEEK_NOT_READ_LINE, moves: [], tone: 'plain' })
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

  it('leads when it may: the cash tile first, the card on Capital, cash moves and then the step', () => {
    const m = buildWeekCall({ ...base, forecast: under, cashMayLead: true, supplyDue: { usd: 10_800, ymd: '2026-11-24' } })
    expect(m.cashLeads).toBe(true)
    expect(m.link).toBe('capital')
    expect(m.tiles.map((t) => t.id)).toEqual(['cash', 'made', 'step'])
    expect(m.tiles[0]).toMatchObject({ wide: true, label: 'Cash comes first this week', value: 'Under the floor in 2 weeks', sub: 'Cash goes under $10.0k on Nov 24. The bank has $18.4k today.' })
    expect(m.card.label).toBe('What to do now')
    expect(m.card.lead).toBe('Keep cash above the floor.')
    expect(m.card.line).toBe('Cash goes under $10.0k on Nov 24. Bill is still the slowest step.')
    expect(m.card.moves.map((x) => [x.kind, x.title])).toEqual([
      ['cash', 'Chase the 9 late invoices.'],
      ['cash', 'Ask the supply houses for more days.'],
      ['step', 'Bill the 11 finished jobs.'],
    ])
    expect(m.card.moves[1]?.why).toBe('$10.8k of supply bills is due Nov 24.')
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

  it('says today when cash is already under', () => {
    expect(firstDayUnderFloor(under, 4_000, '2026-11-09')).toEqual({ ymd: '2026-11-09', offset: 0 })
    expect([0, 1, 9, 15].map(whenWords)).toEqual(['today', 'tomorrow', 'in 9 days', 'in 2 weeks'])
  })
})

describe('the first screen’s words', () => {
  const screens = [
    buildWeekCall(base),
    buildWeekCall({ ...base, forecast: under }),
    buildWeekCall({ ...base, forecast: under, cashMayLead: true, supplyDue: { usd: 10_800, ymd: '2026-11-24' } }),
    buildWeekCall({ ...base, forecast: under, cashMayLead: true, supplyDue: { usd: 10_800, ymd: '2026-11-24' }, cashNote: 'Leaves out Accounts Payable 2222, $12.4k.' }),
    buildWeekCall({ ...base, todayYmd: '2026-11-13' }),
    buildWeekCall({ ...base, headline: null, forecast: null, flow: null }),
    ...(['market', 'sales', 'build', 'collect'] as const).map((id) => buildWeekCall({ ...base, flow: { ...flow, linkId: id } })),
  ]

  it('pass the plain-words rule, every sentence of every reading', () => {
    for (const s of screens) for (const line of weekCallWords(s, WEEK_CALL_MOVES)) expect(plainWordsFailures(line), line).toEqual([])
  })

  it('stay inside a phone’s first screen with the strip of pipe on it (PR 3)', () => {
    // The strip adds its legend, five names, five paces and the lit step's weeks to the usual week's screen.
    const strip = stripWords(buildFlowStrip(flow, { market: 44_000, sales: 36_000, build: 33_000, bill: 19_000, collect: 26_000 }), true).join(' ')
    const b = weekCallBudget(buildWeekCall(base))
    expect(b.words + strip.split(/\s+/).length).toBeLessThanOrEqual(WEEK_FIRST_SCREEN_WORDS)
    expect(b.numbers + (strip.match(/\$?\d[\d,.]*\s?(k|M|h|%)?/g) ?? []).length).toBeLessThanOrEqual(WEEK_FIRST_SCREEN_NUMBERS)
  })

  it('stay inside a phone’s first screen', () => {
    for (const s of screens) {
      const b = weekCallBudget(s)
      expect(b.words, s.card.lead).toBeLessThanOrEqual(WEEK_FIRST_SCREEN_WORDS)
      expect(b.numbers, s.card.lead).toBeLessThanOrEqual(WEEK_FIRST_SCREEN_NUMBERS)
    }
  })
})

describe('the desk’s list of a step’s moves', () => {
  it('lists every move with today’s number, and marks the ones the card holds', () => {
    const card = buildWeekCall(base).card.moves
    expect(card.length).toBeGreaterThan(WEEK_CALL_MOVES)
    // At a desk the card shows the first three.
    const list = deskMoves('bill', base, card.slice(0, WEEK_CALL_MOVES))
    expect(list.length).toBe(card.length)
    expect(list[0]).toEqual({ title: 'Bill the 11 finished jobs.', today: '$142k today', onCall: true })
    expect(list.map((m) => m.onCall)).toEqual(card.map((_, i) => i < WEEK_CALL_MOVES))
    // A move the app cannot read has no number.
    expect(list.find((m) => m.today == null)).toBeTruthy()
    // On a phone the card shows two.
    expect(deskMoves('bill', base, card.slice(0, 2)).filter((m) => m.onCall).length).toBe(2)
  })

  it('matches a move with a number by its kind, since the number in its sentence moves', () => {
    const list = deskMoves('bill', base, [{ key: 'bill', title: 'Bill the 9 finished jobs.' }])
    expect(list.filter((m) => m.onCall).map((m) => m.title)).toEqual(['Bill the 11 finished jobs.'])
    // Another step's desk: nothing of it is on the Bill card.
    expect(deskMoves('collect', base, [{ key: 'bill', title: 'Bill the 9 finished jobs.' }]).some((m) => m.onCall)).toBe(false)
  })
})
