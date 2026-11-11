import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { buildCashForecast } from './cashForecast'
import type { BridgeCall } from './calls'
import { buildFlowStrip } from './flowStrip'
import type { Headline, HeadlineWeek } from './headline'
import type { StageFlow, StageReading } from './stageFlow'
import { buildWeekCall, type WeekCallInput } from './weekCall'
import { WEEK_MAIL_HALF_PX, WEEK_MAIL_TILE_PX, WEEK_MAIL_WORDS, weekMailGapsLine, weekMailHtml, weekMailLine, weekMailMoves, weekMailSubject, weekMailText, type WeekMail } from './weekMail'

// Made-up numbers throughout: a company whose finished work waits on the bill.

const week = (start: string, usd: number | null, over: Partial<HeadlineWeek> = {}): HeadlineWeek => ({ start, end: start, label: start.slice(5), current: false, recordedUsd: usd, approvedUsd: usd, recordedHours: 250, approvedHours: 250, pendingHours: 0, waiting: false, ...over })

const headline: Headline = {
  weeks: [week('2026-10-25', 27_000), week('2026-11-01', 31_000, { waiting: true, pendingHours: 40 }), week('2026-11-08', 4_000, { current: true })],
  thisWeek: week('2026-11-08', 4_000, { current: true }),
  trend: 'readable',
  verdict: '',
  settled: { lowUsd: 22_000, highUsd: 41_000, count: 8 },
}

const stage = (id: StageReading['id'], name: string, pile: string, weeks: number | null, weeksText: string, isLink = false): StageReading => ({
  id,
  name,
  object: '',
  action: '',
  readable: true,
  pile: { headline: pile, sub: [], usd: 142_000, guessShare: 0 },
  flow: isLink ? [{ who: 'the field finishes', usd: '$33k' }, { who: 'the office bills', usd: '$19k' }] : [],
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
    stage('bill', 'Bill', '$142k finished, not yet billed', 7.5, '7.5 weeks to bill what is already finished', true),
    stage('collect', 'Collect', '$188k billed, not yet paid', 3.7, '3.7 weeks to collect what is already late'),
  ],
  linkId: 'bill',
  nominatedId: 'bill',
  heldStands: false,
  pairId: null,
}

const clear = buildCashForecast({ todayYmd: '2026-11-09', daysAhead: 56, cashTodayUsd: 18_400, floorUsd: 10_000, events: [{ ymd: '2026-12-04', usd: 30_000, label: 'Receipt', kind: 'receipt' }] })
const under = buildCashForecast({ todayYmd: '2026-11-09', daysAhead: 56, cashTodayUsd: 18_400, floorUsd: 10_000, events: [{ ymd: '2026-11-24', usd: 10_800, label: 'Supply invoices due', kind: 'bill' }, { ymd: '2026-12-04', usd: 30_000, label: 'Receipt', kind: 'receipt' }] })

const input: WeekCallInput = {
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
  // As the weekly send builds it: nobody is signed in, so the caller's moves carry no person.
  people: { caller: '', biller: 'Dana', collector: 'Dana' },
  supplyDue: null,
  calls: [],
  now: { stageWeeks: { bill: 7.5, build: 6, collect: 3.7 }, stagePilesUsd: { bill: 142_000 }, keys: { bill: 142_000, chase: 96_000, approve: 96, price: 4, pct: 0 } },
  dayLabel: (ymd) => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`,
}

const strip = buildFlowStrip(flow, { market: 210_000, sales: 36_000, build: 33_000, bill: 19_000, collect: 41_000 })
const mailOf = (over: Partial<WeekCallInput> = {}, gaps: string[] = []): WeekMail => ({ weekLabel: 'Nov 8–14', todayLabel: 'Nov 9', model: buildWeekCall({ ...input, ...over }), strip, gaps })

const billCall: BridgeCall = {
  id: 'c1',
  weekStart: '2026-11-08',
  calledOn: '2026-11-08',
  calledByName: 'Sam',
  link: 'bill',
  moves: [
    { key: 'bill', title: 'Bill the 11 finished jobs.', who: 'Dana', then: 160_000 },
    { key: 'other', title: 'Take bank sorting off whoever bills.', who: 'Jorge', then: null },
  ],
  measures: { linkWeeks: 8.1, linkPileUsd: 160_000, stageWeeks: { bill: 8.1 }, keys: { bill: 160_000 } },
  note: 'Ridgeway Builders first.',
  outcome: null,
  outcomeAt: null,
  outcomeNote: null,
}

const URL = 'https://app.example/bridge'

describe('the Monday email as the first screen', () => {
  it('the subject says the call, then cash, then what the field made', () => {
    expect(weekMailSubject(mailOf())).toBe('The Bridge, the week of Nov 8–14: Bill is the slowest step. Cash low point $18.4k. Made last week $31.0k ≈.')
    expect(weekMailLine(mailOf())).toBe('the week of Nov 8–14, read Nov 9')
  })

  it('a proposal lists the card’s first three moves, each with its person, and the press opens the Bridge to make the call', () => {
    const mail = mailOf()
    const moves = weekMailMoves(mail.model)
    expect(moves).toHaveLength(3)
    expect(mail.model.card.moves.length).toBeGreaterThan(3)
    const html = weekMailHtml(mail, URL)
    expect(html).toContain('Bill is the slowest step.')
    expect(html).toContain('Bill the 11 finished jobs.')
    expect(html).toContain('>Dana</span>')
    expect(html).toContain(`<a href="${URL}"`)
    expect(html).toContain(`>${WEEK_MAIL_WORDS.open.propose}</a>`)
    // The mail records nothing, so it never prints the page's record press.
    expect(html).not.toContain(mail.model.card.press ?? 'no press')
  })

  it('a move the page gives to whoever is looking goes out with no person', () => {
    const mail = mailOf()
    const price = weekMailMoves(mail.model).find((m) => m.key === 'price')
    expect(price?.who).toBe('')
    expect(weekMailText(mail, URL)).toMatch(/Price the 4 jobs with no price\. Their hours earn nothing until then\.\n/)
  })

  it('three tiles sit in one row, the made tile with its bars', () => {
    const html = weekMailHtml(mailOf(), URL)
    expect(html.match(new RegExp(`max-width:${WEEK_MAIL_TILE_PX}px;font-size:14px`, 'g'))).toHaveLength(3)
    expect(html).toContain('Made last week')
    // A week whose hours still wait is the lightest bar, this week the full blue.
    expect(html).toContain('background:#bfdbfe')
    expect(html).toContain('background:#2563eb;border-radius:2px 2px 0 0')
  })

  it('the strip is a table of the five steps with the slowest lit and its weeks under it', () => {
    const html = weekMailHtml(mailOf(), URL)
    for (const name of ['Market', 'Sales', 'Build', 'Bill', 'Collect']) expect(html).toContain(`>${name}</b>`)
    expect(html).toContain('background:#dc2626;font-size:0')
    expect(html).toContain('$19k billed')
    expect(html).toContain('8 weeks wait')
    const text = weekMailText(mailOf(), URL)
    expect(text).toContain('  Bill: $19k billed, 8 weeks wait, the slowest step')
    expect(text).toContain('  Market: $210k asked')
  })

  it('in a week cash leads its tile takes the row, the other two share the next, and the strip goes under the call', () => {
    const mail = mailOf({ forecast: under, cashMayLead: true, supplyDue: { usd: 10_800, ymd: '2026-11-24' } })
    expect(mail.model.cashLeads).toBe(true)
    const html = weekMailHtml(mail, URL)
    expect(html.match(new RegExp(`max-width:${WEEK_MAIL_HALF_PX}px;font-size:14px`, 'g'))).toHaveLength(2)
    expect(html.indexOf('Cash comes first this week')).toBeLessThan(html.indexOf('Made last week'))
    expect(html.indexOf('Keep cash above the floor.')).toBeLessThan(html.indexOf('Dollars a week.'))
    expect(weekMailSubject(mail)).toMatch(/^The Bridge, the week of Nov 8–14: Keep cash above the floor\. Under the floor in \d+ (days|weeks)\./)
    const text = weekMailText(mail, URL)
    expect(text.indexOf('Keep cash above the floor.')).toBeLessThan(text.indexOf('The five steps.'))
  })

  it('a call that stands shows every move against today, the note, and a press that only opens the Bridge', () => {
    const mail = mailOf({ calls: [billCall] })
    expect(mail.model.state).toBe('standing')
    const html = weekMailHtml(mail, URL)
    expect(html).toContain('Bill is this week’s call.')
    expect(html).toContain('<b>Note.</b> Ridgeway Builders first.')
    expect(html).toContain('It was $160k. Today it is $142k.')
    expect(html).toContain(`>${WEEK_MAIL_WORDS.open.standing}</a>`)
    expect(weekMailText(mail, URL)).toContain('  1. Bill the 11 finished jobs. It was $160k. Today it is $142k. Dana. part.')
  })

  it('from Friday the card asks, and the press opens the Bridge to answer', () => {
    const mail = mailOf({ calls: [billCall], todayYmd: '2026-11-13' })
    expect(mail.model.state).toBe('friday')
    expect(weekMailHtml(mail, URL)).toContain(`>${WEEK_MAIL_WORDS.open.friday}</a>`)
    expect(weekMailHtml(mail, URL)).toContain('border:2px solid #2563eb')
  })

  it('what the reads print is escaped', () => {
    const mail = mailOf({ calls: [{ ...billCall, note: 'A & B <first>', moves: [{ key: 'other', title: 'Ask "Oak Hollow HOA" <today>.', who: 'Dana', then: null }] }] })
    const html = weekMailHtml(mail, URL)
    expect(html).toContain('A &amp; B &lt;first&gt;')
    expect(html).toContain('Ask &quot;Oak Hollow HOA&quot; &lt;today&gt;.')
    expect(html).not.toContain('<first>')
  })

  it('what could not be read is one sentence, and nothing when everything came back', () => {
    expect(weekMailGapsLine([])).toBe('')
    expect(weekMailHtml(mailOf(), URL)).not.toContain('Not read when this was built')
    expect(weekMailHtml(mailOf({}, ['the bank']), URL)).toContain('Not read when this was built: the bank. The rest reads without it.')
  })

  it('with no strip built the mail still reads', () => {
    const mail: WeekMail = { ...mailOf(), strip: null }
    expect(weekMailHtml(mail, URL)).not.toContain('Dollars a week.')
    expect(weekMailText(mail, URL)).not.toContain('The five steps.')
  })

  it('the mail’s own words are plain', () => {
    const words = [...Object.values(WEEK_MAIL_WORDS.open), WEEK_MAIL_WORDS.last, WEEK_MAIL_WORDS.lastAsk, WEEK_MAIL_WORDS.foot, WEEK_MAIL_WORDS.sent, weekMailGapsLine(['the bank', 'the people'])]
    for (const line of words) expect(plainWordsFailures(line), line).toEqual([])
  })
})
