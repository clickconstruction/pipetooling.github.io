import { formatPayWeekLabel, payWeekContaining } from '../payWeekAnchor'
import { buildCashForecast } from './cashForecast'
import { buildFlowStrip } from './flowStrip'
import type { Headline, HeadlineWeek } from './headline'
import type { StageFlow, StageId, StageReading } from './stageFlow'
import { accrualLine, burnPerDay, cashLine, runwayFoot } from './moneyCard'
import { buildWeekCall } from './weekCall'
import type { WeekMail } from './weekMail'

/**
 * The weekly email on made-up numbers (v2.6888), for the email catalog's sample: a company whose finished work waits
 * on the bill. It runs the mail's own builders, so the sample's words change when the page's do. Every name and
 * number here is invented.
 */

const DAY_MS = 86_400_000
const addDays = (ymd: string, days: number): string => new Date(Date.parse(`${ymd}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
const md = (ymd: string): string => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

const MADE = [34_000, 29_000, 41_000, 22_000, 38_000, 36_000, 27_000, 31_000]
const CASH_TODAY = 48_400
const CASH_NOTE = 'Leaves out Accounts Payable, $12.0k.'

const stage = (id: StageId, name: string, pile: string, weeks: number | null, weeksText: string, flow: StageReading['flow'] = []): StageReading => ({
  id,
  name,
  object: '',
  action: '',
  readable: true,
  pile: { headline: pile, sub: [], usd: null, guessShare: 0 },
  flow,
  weeks,
  weeksText,
  badge: id === 'bill' ? 'the weakest link' : '',
  tone: id === 'bill' ? 'link' : 'plain',
  isLink: id === 'bill',
})

export function sampleWeekMail(todayYmd: string): WeekMail {
  const thisWeek = payWeekContaining(todayYmd)
  const week = (start: string, usd: number, over: Partial<HeadlineWeek> = {}): HeadlineWeek => ({ start, end: addDays(start, 6), label: md(start), current: false, recordedUsd: usd, approvedUsd: usd, recordedHours: 250, approvedHours: 250, pendingHours: 0, waiting: false, ...over })
  const current = week(thisWeek.start, 4_000, { current: true, pendingHours: 12 })
  const headline: Headline = {
    weeks: [...MADE.map((usd, i) => week(addDays(thisWeek.start, (i - MADE.length) * 7), usd)), current],
    thisWeek: current,
    trend: 'readable',
    verdict: '',
    settled: { lowUsd: 22_000, highUsd: 41_000, count: MADE.length },
  }
  const flow: StageFlow = {
    stages: [
      stage('market', 'Market', '45 asks in 8 weeks', null, 'worth $29k a week'),
      stage('sales', 'Sales', '$1.9M awaiting an answer', null, 'sold $36k of work a week'),
      stage('build', 'Build', '$198k left to build', 6, '6.0 weeks to build what is already sold'),
      stage('bill', 'Bill', '$142k finished, not yet billed', 7.5, '7.5 weeks to bill what is already finished', [{ who: 'the field finishes', usd: '$33k' }, { who: 'the office bills', usd: '$19k' }]),
      stage('collect', 'Collect', '$188k billed, not yet paid', 3.7, '3.7 weeks to collect what is already late'),
    ],
    linkId: 'bill',
    nominatedId: 'bill',
    heldStands: false,
    pairId: null,
  }
  const numbers = { bill: 142_000, chase: 96_000, approve: 96, price: 4, pct: 0 }
  const forecast = buildCashForecast({ todayYmd, daysAhead: 56, cashTodayUsd: CASH_TODAY, floorUsd: 10_000, events: [{ ymd: addDays(todayYmd, 18), usd: 26_400, label: 'Payroll', kind: 'bill' }, { ymd: addDays(todayYmd, 25), usd: 30_000, label: 'Ridgeway Builders', kind: 'receipt' }] })
  const model = buildWeekCall({
    todayYmd,
    weekStart: thisWeek.start,
    headline,
    forecast,
    cashTodayUsd: CASH_TODAY,
    cashNote: CASH_NOTE,
    cashMayLead: true,
    flow,
    moveNumbers: numbers,
    counts: { billJobs: 11, lateInvoices: 9 },
    supplyDue: null,
    dayLabel: md,
  })
  // Market at what the asks are worth at the won rates (punch list #318), with what the amount is made of.
  const strip = buildFlowStrip(flow, { market: 29_000, sales: 36_000, build: 33_000, bill: 19_000, collect: 41_000 }, { marketIsWorth: true })
  // The two balances the page shows after the slowest step: payroll $26.4k a week and $600 a day of overhead burn the runway.
  const burnPerDayUsd = burnPerDay({ payrollPerWeekUsd: 26_400, overheadPerDayUsd: 600 })
  const money = {
    cash: cashLine({ forecast, cashTodayUsd: CASH_TODAY, cashNote: CASH_NOTE, todayYmd, dayLabel: md, burnPerDayUsd }),
    accrual: accrualLine({ cashUsd: CASH_TODAY, owedToYouUsd: 188_000, owedByYouUsd: 71_000, burnPerDayUsd }),
    foot: runwayFoot(burnPerDayUsd),
  }
  return { weekLabel: formatPayWeekLabel(thisWeek), todayLabel: md(todayYmd), model, money, strip, marketParts: ['bids $22k at 7% won', 'estimates $7k at 48% won'], gaps: [] }
}
