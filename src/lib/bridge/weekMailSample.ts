import { formatPayWeekLabel, payWeekContaining } from '../payWeekAnchor'
import { buildCashForecast } from './cashForecast'
import { buildFlowStrip } from './flowStrip'
import type { Headline, HeadlineWeek } from './headline'
import type { StageFlow, StageId, StageReading } from './stageFlow'
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
      stage('market', 'Market', '45 asks in 8 weeks', null, 'about $210k a week asked'),
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
  const model = buildWeekCall({
    todayYmd,
    weekStart: thisWeek.start,
    headline,
    forecast: buildCashForecast({ todayYmd, daysAhead: 56, cashTodayUsd: 48_400, floorUsd: 10_000, events: [{ ymd: addDays(todayYmd, 18), usd: 26_400, label: 'Payroll', kind: 'bill' }, { ymd: addDays(todayYmd, 25), usd: 30_000, label: 'Ridgeway Builders', kind: 'receipt' }] }),
    cashTodayUsd: 48_400,
    cashNote: 'Leaves out Accounts Payable, $12.0k.',
    cashMayLead: true,
    flow,
    picked: null,
    moveNumbers: numbers,
    counts: { billJobs: 11, lateInvoices: 9 },
    people: { caller: '', biller: 'Dana', collector: 'Jorge' },
    supplyDue: null,
    calls: [],
    now: { stageWeeks: { build: 6, bill: 7.5, collect: 3.7 }, stagePilesUsd: { bill: 142_000 }, keys: numbers },
    dayLabel: md,
  })
  const strip = buildFlowStrip(flow, { market: 210_000, sales: 36_000, build: 33_000, bill: 19_000, collect: 41_000 })
  return { weekLabel: formatPayWeekLabel(thisWeek), todayLabel: md(todayYmd), model, strip, gaps: [] }
}
