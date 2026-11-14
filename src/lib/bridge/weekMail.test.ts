import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { buildCashForecast } from './cashForecast'
import { buildFlowStrip } from './flowStrip'
import type { Headline, HeadlineWeek } from './headline'
import type { StageFlow, StageReading } from './stageFlow'
import { accrualLine, burnPerDay, cashLine, runwayFoot } from './moneyCard'
import { buildWeekCall, type WeekCallInput } from './weekCall'
import { WEEK_MAIL_HALF_PX, WEEK_MAIL_WORDS, weekMailGapsLine, weekMailHtml, weekMailLine, weekMailMarketLine, weekMailMoves, weekMailSubject, weekMailText, weekMailTiles, type WeekMail, type WeekMailMoney } from './weekMail'

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
  moveNumbers: { bill: 142_000, chase: 96_000, approve: 96, price: 4, pct: 0 },
  counts: { billJobs: 11, lateInvoices: 9 },
  supplyDue: null,
  dayLabel: (ymd) => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`,
}

const strip = buildFlowStrip(flow, { market: 210_000, sales: 36_000, build: 33_000, bill: 19_000, collect: 41_000 })
/** The balances as the page builds them: $18.4k in the bank, $60k owed in, $25k owed out, payroll $14k a week and $300 a day of overhead. */
const moneyOf = (over: Partial<WeekCallInput> = {}, cashNote: string | null = null): WeekMailMoney => {
  const i = { ...input, ...over }
  const burnPerDayUsd = burnPerDay({ payrollPerWeekUsd: 14_000, overheadPerDayUsd: 300 })
  return {
    cash: cashLine({ forecast: i.forecast, cashTodayUsd: i.cashTodayUsd, cashNote, todayYmd: i.todayYmd, dayLabel: i.dayLabel, burnPerDayUsd }),
    accrual: accrualLine({ cashUsd: i.cashTodayUsd, owedToYouUsd: 60_000, owedByYouUsd: 25_000, burnPerDayUsd }),
    foot: runwayFoot(burnPerDayUsd),
  }
}
const mailOf = (over: Partial<WeekCallInput> = {}, gaps: string[] = []): WeekMail => ({ weekLabel: 'Nov 8–14', todayLabel: 'Nov 9', model: buildWeekCall({ ...input, ...over }), money: moneyOf(over), strip, gaps })

const URL = 'https://app.example/bridge'

describe('the Monday email as the first screen', () => {
  it('the subject says the card’s lead, then the cash balance, then what the field made', () => {
    expect(weekMailSubject(mailOf())).toBe('The Bridge, the week of Nov 8–14: Bill is the slowest step. Cash balance $18.4k. Made last week $31.0k ≈.')
    expect(weekMailLine(mailOf())).toBe('the week of Nov 8–14, read Nov 9')
  })

  it('lists the card’s first three moves under What to do now, and the press opens the Bridge', () => {
    const mail = mailOf()
    const moves = weekMailMoves(mail.model)
    expect(moves).toHaveLength(3)
    expect(mail.model.card.moves.length).toBeGreaterThan(3)
    const html = weekMailHtml(mail, URL)
    expect(html).toContain('>What to do now</div>')
    expect(html).toContain('Bill is the slowest step.')
    expect(html).toContain('Bill the 11 finished jobs.')
    expect(html).toContain(`<a href="${URL}"`)
    expect(html).toContain('>Open the Bridge</a>')
    expect(weekMailText(mail, URL)).toMatch(/\nWhat to do now\nBill is the slowest step\.\n/)
    expect(weekMailText(mail, URL)).toMatch(/  2\. Price the 4 jobs with no price\. Their hours earn nothing until then\.\n/)
    expect(weekMailText(mail, URL)).toContain(`Open the Bridge: ${URL}`)
  })

  it('speaks of no call: no person on a move, no Friday, no last call, no press to make one (#334, PR 11)', () => {
    for (const mail of [mailOf(), mailOf({ todayYmd: '2026-11-13' }), mailOf({ forecast: under, cashMayLead: true, supplyDue: { usd: 10_800, ymd: '2026-11-24' } })]) {
      for (const body of [weekMailHtml(mail, URL), weekMailText(mail, URL), weekMailSubject(mail)]) {
        expect(body).not.toMatch(/week’s call|week's call|make the call|Friday|last call|Answer it|Note\./i)
        expect(body).not.toContain('border-radius:999px')
      }
    }
  })

  it('two tiles share a row, the made tile with its bars, and the cash tile is the balances’ now', () => {
    const mail = mailOf()
    expect(weekMailTiles(mail.model).map((t) => t.id)).toEqual(['made', 'step'])
    const html = weekMailHtml(mail, URL)
    expect(html.match(new RegExp(`max-width:${WEEK_MAIL_HALF_PX}px;font-size:14px`, 'g'))).toHaveLength(2)
    expect(html).toContain('Made last week')
    expect(html).not.toContain('Cash low point, 8 weeks')
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

  it('Market reads at what it is worth, with what the amount is made of in one line under the pipe (#318)', () => {
    const worth = buildFlowStrip(flow, { market: 29_000, sales: 36_000, build: 33_000, bill: 19_000, collect: 41_000 }, { marketIsWorth: true })
    const mail: WeekMail = { ...mailOf(), strip: worth, marketParts: ['bids $22k at 7% won', 'estimates $7k at 48% won'] }
    const line = 'What Market is worth: bids $22k at 7% won. Estimates $7k at 48% won.'
    expect(weekMailMarketLine(mail)).toBe(line)
    const html = weekMailHtml(mail, URL)
    expect(html).toContain('$29k worth')
    expect(html).not.toContain('asked')
    expect(html).toContain(line)
    const text = weekMailText(mail, URL)
    expect(text).toContain('  Market: $29k worth')
    expect(text).toContain(`  ${line}`)
    // The line sits right under the five steps, before the card.
    expect(text.indexOf(line)).toBeGreaterThan(text.indexOf('  Collect:'))
    expect(text.indexOf(line)).toBeLessThan(text.indexOf(mail.model.card.label))
    expect(plainWordsFailures(line), line).toEqual([])
    // While Market still reads the dollars that came in, the mail says asked and prints no such line.
    expect(weekMailMarketLine(mailOf())).toBe('')
    expect(weekMailHtml(mailOf(), URL)).not.toContain(WEEK_MAIL_WORDS.marketWorth)
    expect(weekMailText(mailOf(), URL)).not.toContain(WEEK_MAIL_WORDS.marketWorth)
  })

  it('the two balances follow the slowest step, each with its runway, and one line says what runway counts (#334)', () => {
    const mail = mailOf()
    const html = weekMailHtml(mail, URL)
    // Payroll $14k a week is $2k a day, plus $300 of overhead: $2.3k a day. $18.4k carries 8 days, $53.4k carries 23.
    expect(mail.money.cash).toMatchObject({ label: 'Cash balance', value: '$18.4k', runway: '8 days of runway', tone: 'green' })
    expect(mail.money.accrual).toMatchObject({ label: 'Accrual balance', value: '$53.4k', runway: '23 days of runway' })
    for (const words of ['Cash balance', '$18.4k', '8 days of runway', 'Accrual balance', '$53.4k', '23 days of runway', 'Adds $60.0k owed to you. Takes off $25.0k you owe, subs included.', 'Runway counts payroll and overhead, $2.3k a day.']) expect(html, words).toContain(words)
    expect(html.indexOf('Slowest step')).toBeLessThan(html.indexOf('Cash balance'))
    expect(html.indexOf('Cash balance')).toBeLessThan(html.indexOf('Accrual balance'))
    expect(html.indexOf('Accrual balance')).toBeLessThan(html.indexOf('What to do now'))
    const text = weekMailText(mail, URL)
    expect(text).toContain('Slowest step: Bill\n  7.5 weeks to bill what is already finished.\nCash balance: $18.4k\n  8 days of runway\n  Stays over the $10.0k floor. Low point $18.4k on Nov 9.\nAccrual balance: $53.4k\n  23 days of runway\n  Adds $60.0k owed to you. Takes off $25.0k you owe, subs included.\nRunway counts payroll and overhead, $2.3k a day.\n')
  })

  it('the accounts left out of cash are said under the cash balance', () => {
    const mail: WeekMail = { ...mailOf(), money: moneyOf({}, 'Leaves out Accounts Payable, $12.0k.') }
    expect(weekMailHtml(mail, URL)).toContain('Leaves out Accounts Payable, $12.0k.')
    expect(weekMailText(mail, URL)).toContain('  Stays over the $10.0k floor. Low point $18.4k on Nov 9.\n  Leaves out Accounts Payable, $12.0k.\nAccrual balance')
  })

  it('with no balance read the cash line is the forecast’s low point, the accrual balance is not read, and no runway is claimed', () => {
    const mail: WeekMail = { ...mailOf(), money: moneyOf({ cashTodayUsd: null }) }
    expect(mail.money.cash.label).toBe('Cash low point, 8 weeks')
    expect(mail.money.cash.runway).toBeUndefined()
    expect(mail.money.accrual.value).toBe('not read')
    expect(weekMailSubject(mail)).toBe('The Bridge, the week of Nov 8–14: Bill is the slowest step. Cash low point $18.4k. Made last week $31.0k ≈.')
    expect(weekMailText(mail, URL)).toContain('Accrual balance: not read\n  What is owed is not read yet.\n')
  })

  it('in a week cash leads the balances stay where they are, the cash balance says when it goes under, and the strip goes under the card', () => {
    const mail = mailOf({ forecast: under, cashMayLead: true, supplyDue: { usd: 10_800, ymd: '2026-11-24' } })
    expect(mail.model.cashLeads).toBe(true)
    const html = weekMailHtml(mail, URL)
    expect(html.match(new RegExp(`max-width:${WEEK_MAIL_HALF_PX}px;font-size:14px`, 'g'))).toHaveLength(2)
    expect(html).not.toContain('Cash comes first this week')
    expect(mail.money.cash.tone).toBe('amber')
    expect(html).toMatch(/Goes under the \$10\.0k floor in \d+ (days|weeks), on Nov 24\./)
    expect(html.indexOf('Keep cash above the floor.')).toBeLessThan(html.indexOf('Dollars a week.'))
    expect(weekMailSubject(mail)).toMatch(/^The Bridge, the week of Nov 8–14: Keep cash above the floor\. Cash balance \$18\.4k\./)
    const text = weekMailText(mail, URL)
    expect(text.indexOf('Keep cash above the floor.')).toBeLessThan(text.indexOf('The five steps.'))
  })

  it('what the reads print is escaped', () => {
    const model = mailOf().model
    const mail: WeekMail = { ...mailOf(), model: { ...model, card: { ...model.card, lead: 'A & B <first>', moves: [{ key: 'other', kind: 'step', title: 'Ask "Oak Hollow HOA" <today>.', why: '', door: null, then: null }] } } }
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
    const money = moneyOf()
    const words = [WEEK_MAIL_WORDS.open, WEEK_MAIL_WORDS.foot, WEEK_MAIL_WORDS.sent, weekMailGapsLine(['the bank', 'the people']), money.cash.sub, money.accrual.sub, money.foot]
    for (const line of words) expect(plainWordsFailures(line), line).toEqual([])
  })
})
