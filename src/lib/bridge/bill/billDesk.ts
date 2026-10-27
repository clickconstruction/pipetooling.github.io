/**
 * The Bill desk (punch list #192, v2.5930): the kernel behind the Bridge's Bill
 * card's "Break it down". One question: when the work finishes, does the bill
 * go out that day, and what is the sitting costing? The leaks are rows no
 * surface finds alone, each a crossing of two reads: a job at 100% whose bills
 * cover nothing, a remainder behind a part-bill, a job with hours and no price,
 * a bill marked billed by hand with no send on file. Then the fast lane (the
 * ready-to-bill jobs with the days each has sat), the scorecard (billed the day
 * it finished, over the last pay weeks, per bill) and the cost of a week of
 * sitting. Every sentence here is held to the plain-words rule by
 * `billDesk.test.ts`. Pure: no React, no Supabase; the loader beside it does
 * the reads the page does not already make.
 */
import { payWeekContaining } from '../../payWeekAnchor'
import { ymdAddDays } from '../../../utils/dateUtils'
import { coveredUsd, type BillPile, type BillPileItem, type BillPileJob } from '../billPile'
import type { PctPoint } from '../buildPace'
import { stageUsd } from '../stageFlow'
import type { VectorSession } from '../vectors'

/** Owner call (punch list #192): a bill reads same-day when billed − ready is at most this many days; default 0. */
export const BILL_SAME_DAY_TOLERANCE_DAYS = 0
/** Owner call (punch list #192): the pay weeks the scorecard and the bills table read, the page's own window; default 8. */
export const BILL_SCORECARD_WEEKS = 8
/** The bills table shows this many rows before its fold opens. */
export const BILL_TABLE_FOLD = 8

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)
const daysBetween = (fromYmd: string, toYmd: string): number => Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86_400_000)
/** "1024 · Lawver install" in a cell; "1024 Lawver install" inside a sentence, where a dot list is glue. */
export const labelInWords = (label: string): string => label.replace(/\s·\s/g, ' ')

// ---------------------------------------------------------------------------
// The shaped inputs: what the page knows, crossed with what the loader reads
// ---------------------------------------------------------------------------

export type BillDeskJob = {
  id: string
  /** "1024 · Lawver install". */
  label: string
  status: string
  revenueUsd: number | null
  billedUsd: number
  paymentsUsd: number
  /** The pile's own reading of the job. */
  item: BillPileItem
  /** The newest ready-to-bill status change on or before today; null when the job has none on record. */
  readyYmd: string | null
  /** The day the percent reached 100 in its current run of points; null when the points never say so. */
  pct100SinceYmd: string | null
  /** The job's newest percent point; the clock when there is no ready day. */
  newestPctYmd: string | null
  /** The newest billed day among the job's bills; the "on <day>" of a part-bill. */
  newestBillYmd: string | null
  /** Field hours on the job this window, counted as the field's pace counts a session. */
  hoursInWindow: number
}

export type BillDeskBill = {
  id: string
  jobId: string
  jobLabel: string
  usd: number
  /** The day the bill went to the customer, else the day it was marked billed (`invoiceBilledYmd`). */
  billedYmd: string
  sentFromHere: boolean
  sentByName: string | null
  /** The newest ready-to-bill change on or before the billed day; null when none is on record. */
  readyYmd: string | null
  paid: boolean
}

export type BillDeskPageInput = {
  todayYmd: string
  windowStart: string
  pile: { knownUsd: number; readyUsd: number }
  pace: { inPerWeekUsd: number; outPerWeekUsd: number; weeks: number | null; windowWeeks: number }
  flows: { billedUsd: number; paidUsd: number; arTotalUsd: number | null }
  companyPaceDays: number | null
  /** The bank's cash today (v2.5938); the meter reads the pile's dollar-days against it. Null or absent when the bank could not be read. */
  cashTodayUsd?: number | null
}

export type BillDeskInput = BillDeskPageInput & {
  jobs: ReadonlyArray<BillDeskJob>
  bills: ReadonlyArray<BillDeskBill>
  dayLabel: (ymd: string) => string
}

// ---------------------------------------------------------------------------
// The shapers (pure): the loader's rows and the page's reads into the inputs
// ---------------------------------------------------------------------------

/** The newest ready-to-bill day on or before `onOrBefore`; null when none. */
export function readyDayFor(readyDays: ReadonlyArray<string> | undefined, onOrBefore: string): string | null {
  if (!readyDays) return null
  let best: string | null = null
  for (const d of readyDays) if (d <= onOrBefore && (!best || d > best)) best = d
  return best
}

/** Field hours per job over the window, counted exactly as `fieldPaceByHours` counts a session. */
export function hoursByJobInWindow(sessions: ReadonlyArray<VectorSession>, windowStart: string, todayYmd: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const s of sessions) {
    if (!(s.approved || s.pending)) continue
    if (s.onBid || s.officeJob || !s.jobId) continue
    if (s.workDate < windowStart || s.workDate > todayYmd) continue
    if (!(s.hours > 0)) continue
    out.set(s.jobId, (out.get(s.jobId) ?? 0) + s.hours)
  }
  return out
}

/** The day a job's percent reached 100 in its current run; null when the newest point is under 100 or there is none. */
export function pct100SinceYmd(points: ReadonlyArray<PctPoint>, todayYmd: string): string | null {
  const sorted = points.filter((p) => p.atYmd <= todayYmd).sort((a, b) => (a.atYmd < b.atYmd ? -1 : a.atYmd > b.atYmd ? 1 : 0))
  let since: string | null = null
  for (const p of sorted) {
    if (p.pct >= 100) since = since ?? p.atYmd
    else since = null
  }
  return since
}

export type BillDeskInvoiceRow = { id: string; jobId: string; usd: number; billedYmd: string | null; sentFromHere: boolean; sentByName: string | null; status: string }

export function shapeBillDeskJobs(args: {
  pile: BillPile
  jobs: ReadonlyArray<BillPileJob>
  points: ReadonlyArray<PctPoint>
  sessions: ReadonlyArray<VectorSession>
  labels: ReadonlyMap<string, string>
  readyDaysByJob: ReadonlyMap<string, ReadonlyArray<string>>
  invoices: ReadonlyArray<BillDeskInvoiceRow>
  windowStart: string
  todayYmd: string
}): BillDeskJob[] {
  const itemById = new Map(args.pile.items.map((i) => [i.id, i]))
  const hours = hoursByJobInWindow(args.sessions, args.windowStart, args.todayYmd)
  const pointsByJob = new Map<string, PctPoint[]>()
  for (const p of args.points) {
    const list = pointsByJob.get(p.jobId) ?? []
    list.push(p)
    pointsByJob.set(p.jobId, list)
  }
  const newestBill = new Map<string, string>()
  for (const inv of args.invoices) {
    if (!inv.billedYmd || inv.billedYmd > args.todayYmd) continue
    const cur = newestBill.get(inv.jobId)
    if (!cur || inv.billedYmd > cur) newestBill.set(inv.jobId, inv.billedYmd)
  }
  const out: BillDeskJob[] = []
  for (const j of args.jobs) {
    const item = itemById.get(j.id)
    if (!item) continue
    const pts = (pointsByJob.get(j.id) ?? []).filter((p) => p.atYmd <= args.todayYmd)
    let newestPct: string | null = null
    for (const p of pts) if (!newestPct || p.atYmd > newestPct) newestPct = p.atYmd
    out.push({
      id: j.id,
      label: args.labels.get(j.id) ?? 'Job with no name',
      status: j.status,
      revenueUsd: j.revenueUsd,
      billedUsd: j.billedUsd,
      paymentsUsd: j.paymentsUsd,
      item,
      readyYmd: readyDayFor(args.readyDaysByJob.get(j.id), args.todayYmd),
      pct100SinceYmd: pct100SinceYmd(pts, args.todayYmd),
      newestPctYmd: newestPct,
      newestBillYmd: newestBill.get(j.id) ?? null,
      hoursInWindow: hours.get(j.id) ?? 0,
    })
  }
  return out
}

export function shapeBillDeskBills(args: { invoices: ReadonlyArray<BillDeskInvoiceRow>; labels: ReadonlyMap<string, string>; readyDaysByJob: ReadonlyMap<string, ReadonlyArray<string>>; todayYmd: string }): BillDeskBill[] {
  const out: BillDeskBill[] = []
  for (const inv of args.invoices) {
    if (!inv.billedYmd || inv.billedYmd > args.todayYmd) continue
    out.push({
      id: inv.id,
      jobId: inv.jobId,
      jobLabel: args.labels.get(inv.jobId) ?? 'Job with no name',
      usd: inv.usd,
      billedYmd: inv.billedYmd,
      sentFromHere: inv.sentFromHere,
      sentByName: inv.sentByName,
      readyYmd: readyDayFor(args.readyDaysByJob.get(inv.jobId), inv.billedYmd),
      paid: inv.status === 'paid',
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// The facts the page knows before the desk's own reads land
// ---------------------------------------------------------------------------

export type BillDeskPipe = {
  finishedUsd: number
  unbilledUsd: number
  unbilledReadyUsd: number
  unbilledPctUsd: number
  billedUsd: number
  arUsd: number | null
  paidUsd: number
  windowWeeks: number
  line: string
}

export type BillDeskFacts = {
  verdict: string
  /** A label line, not a sentence: the card's paces with the weeks. */
  subLine: string
  pipe: BillDeskPipe
  meter: { head: string; value: string; words: string[] }
}

export function billDeskFacts(p: BillDeskPageInput): BillDeskFacts {
  const ready = p.pile.readyUsd
  const verdict = ready > 0 ? `${stageUsd(ready)} the office already called done waits on a send.` : 'Nothing waits on a send today.'
  const weeksWords = p.pace.weeks == null ? 'no pace to read' : `${p.pace.weeks >= 100 ? Math.round(p.pace.weeks) : p.pace.weeks.toFixed(1)} weeks to bill what is already finished`
  const subLine = `the field finishes ${stageUsd(p.pace.inPerWeekUsd)} a week · the office bills ${stageUsd(p.pace.outPerWeekUsd)} a week · ${weeksWords}`
  const pipe: BillDeskPipe = {
    finishedUsd: p.pace.inPerWeekUsd * p.pace.windowWeeks,
    unbilledUsd: p.pile.knownUsd,
    unbilledReadyUsd: ready,
    unbilledPctUsd: Math.max(0, p.pile.knownUsd - ready),
    billedUsd: p.flows.billedUsd,
    arUsd: p.flows.arTotalUsd,
    paidUsd: p.flows.paidUsd,
    windowWeeks: p.pace.windowWeeks,
    line: "This desk owns the first gap. The second is Collect's.",
  }
  const words = [`Billed today, ${stageUsd(p.pile.knownUsd)} starts its payers' clocks now.`]
  if (p.companyPaceDays != null) words.push(`Customers pay in about ${Math.round(p.companyPaceDays)} days.`)
  words.push('Sitting one more week moves all of it a week right.')
  if (p.cashTodayUsd != null && p.cashTodayUsd > 0 && p.pile.knownUsd > 0) {
    const days = Math.round((p.pile.knownUsd * 7) / p.cashTodayUsd)
    words.push(days === 0 ? 'That is under a day of the cash in the bank.' : `That is about ${days} ${plural(days, 'day', 'days')} of the cash in the bank.`)
  }
  return { verdict, subLine, pipe, meter: { head: 'What a week of sitting costs', value: `${stageUsd(p.pile.knownUsd * 7)}·days`, words } }
}

// ---------------------------------------------------------------------------
// The desk
// ---------------------------------------------------------------------------

export type BillLeakKind = 'never-billed' | 'remainder' | 'no-price' | 'hand-marked'
const LEAK_ORDER: Record<BillLeakKind, number> = { 'never-billed': 0, remainder: 1, 'no-price': 2, 'hand-marked': 3 }

export type BillLeak = {
  kind: BillLeakKind
  jobId: string
  /** The bill behind a hand-marked row (v2.5938); a job can carry several. */
  billId?: string
  /** The dollars standing still; 0 on a job with no price, which has no number to stand. */
  usd: number
  /** "$4.1k", or "38 h" on a no-price job. */
  amountText: string
  /** "5 weeks", "3 days", "no clock". */
  satText: string
  satDays: number | null
  head: string
  detail: string
  proof: string
  door: { label: string; to: string }
}

export type BillFastRow = {
  jobId: string
  label: string
  usd: number
  satDays: number | null
  /** "sat 6 days", "ready today", "no ready day on record". */
  satText: string
  /** "nothing billed yet", "bills cover $4.1k of $9.5k", "payments cover $6.1k of $9.7k". */
  coverText: string
  late: boolean
  door: { label: string; to: string }
}

export type BillScorecardWeek = { start: string; label: string; same: number; sent: number; tone: 'good' | 'bad' | 'none' }

export type BillScorecardRow = {
  id: string
  /** "1087 · Edwards Ranch · $645". */
  bill: string
  readyText: string
  billedText: string
  lagDays: number | null
  lagText: string
  sentBy: string
  cashDaysText: string
  late: boolean
}

export type BillScorecard = {
  sameDay: number
  withReady: number
  noReady: number
  /** "4 of 6" or "no bill with a ready day". */
  headText: string
  /** A label line: the late sends' cost in dollar-days. */
  costLabel: string
  weeks: BillScorecardWeek[]
  rows: BillScorecardRow[]
  /** The sentence under the table when some bills have no ready day; null otherwise. */
  noReadyLine: string | null
  lateCashDays: number
}

export type BillDesk = {
  headline: string
  leaksUsd: number
  leaks: BillLeak[]
  leaksNote: string
  /** The hand-marked bills with no send on file, apart from the leaks (v2.5938). */
  handMarked: BillLeak[]
  handMarkedUsd: number
  handMarkedNote: string
  fastUsd: number
  fast: BillFastRow[]
  fastNote: string
  scorecard: BillScorecard
  facts: BillDeskFacts
  footnote: string[]
}

const BILLING = '/jobs?tab=billing'

function satWords(fromYmd: string | null, todayYmd: string): { satText: string; satDays: number | null } {
  if (!fromYmd) return { satText: 'no clock', satDays: null }
  const d = Math.max(0, daysBetween(fromYmd, todayYmd))
  if (d < 7) return { satText: d === 0 ? 'today' : `${d} ${plural(d, 'day', 'days')}`, satDays: d }
  const w = Math.floor(d / 7)
  return { satText: `${w} ${plural(w, 'week', 'weeks')}`, satDays: d }
}

function coverSide(j: Pick<BillDeskJob, 'billedUsd' | 'paymentsUsd'>): 'bills' | 'payments' {
  return j.paymentsUsd > j.billedUsd ? 'payments' : 'bills'
}

/** The leaks, biggest dollars first: the four crossings, with the ready-to-bill jobs left to the fast lane. */
export function billLeaks(input: BillDeskInput): BillLeak[] {
  const out: BillLeak[] = []
  const { todayYmd, dayLabel } = input
  for (const j of input.jobs) {
    const name = labelInWords(j.label)
    const revenue = j.revenueUsd ?? 0
    const covered = coveredUsd(j)
    if (j.item.source === 'no-price') {
      if (!(j.hoursInWindow > 0)) continue
      const h = Math.round(j.hoursInWindow)
      out.push({
        kind: 'no-price',
        jobId: j.id,
        usd: 0,
        amountText: `${h} h`,
        satText: 'no clock',
        satDays: null,
        head: 'No price, so no number ever rings.',
        detail: `${name} has hours and no contract price. Its finished work reads $0 forever.`,
        proof: `${h} ${plural(h, 'hour', 'hours')} of closed clock sessions sit on the job this window, and its contract is empty. The leak sits upstream of billing. Until a price is on the job, nothing downstream can count it. Fix the reading names the same jobs.`,
        door: { label: 'Price the job', to: `/jobs?tab=stages&edit=${j.id}` },
      })
      continue
    }
    if (j.item.source !== 'hand' && j.item.source !== 'report') continue
    if (!(revenue > 0) || j.item.pct == null) continue
    const finished = (revenue * j.item.pct) / 100
    if (j.item.pct >= 100 && covered <= 0) {
      const sat = satWords(j.readyYmd ?? j.pct100SinceYmd ?? j.newestPctYmd, todayYmd)
      const since = j.pct100SinceYmd ?? j.newestPctYmd
      out.push({
        kind: 'never-billed',
        jobId: j.id,
        usd: j.item.usd,
        amountText: stageUsd(j.item.usd),
        ...sat,
        head: 'Finished, never billed.',
        detail: `${name} reads 100%${since ? ` since ${dayLabel(since)}` : ''}. No bill was ever made.`,
        proof: `The job's % is 100 and its contract is ${stageUsd(revenue)}, but its bills cover $0. It is in nobody's queue, not ready to bill and not on a billed list. Only crossing the two reads finds it.`,
        door: { label: 'Bill it', to: BILLING },
      })
      continue
    }
    if (covered > 0 && j.item.usd > 0) {
      const side = coverSide(j)
      const sat = satWords(j.readyYmd ?? j.newestPctYmd, todayYmd)
      const first = side === 'bills' ? `${name} billed ${stageUsd(covered)} of ${stageUsd(finished)}${j.newestBillYmd ? ` on ${dayLabel(j.newestBillYmd)}` : ''}.` : `${name} has payments covering ${stageUsd(covered)} of ${stageUsd(finished)}.`
      out.push({
        kind: 'remainder',
        jobId: j.id,
        usd: j.item.usd,
        amountText: stageUsd(j.item.usd),
        ...sat,
        head: 'A remainder aging behind a part-bill.',
        detail: `${first} The rest has no bill and no date.`,
        proof: `The finished share is ${stageUsd(finished)} and the ${side} cover ${stageUsd(covered)}. A part-billed job drops off the Stages board once its first bill goes out. So its tail hides.`,
        door: { label: 'Bill the rest', to: BILLING },
      })
    }
  }
  return out.sort((a, b) => b.usd - a.usd || LEAK_ORDER[a.kind] - LEAK_ORDER[b.kind] || a.jobId.localeCompare(b.jobId))
}


/**
 * The bills marked billed by hand with no send on file, biggest first (v2.5938: apart from the leaks and
 * off the headline, since a hand-marked bill is billed and its dollars are Collect's; on prod a GC's pay
 * application is recorded this way, so the row asks only whether the customer got it).
 */
export function billHandMarked(input: Pick<BillDeskInput, 'bills' | 'todayYmd' | 'dayLabel'>): BillLeak[] {
  const out: BillLeak[] = []
  const { todayYmd, dayLabel } = input
  const start = scorecardStart(todayYmd)
  for (const b of input.bills) {
    if (b.sentFromHere || b.paid) continue
    if (b.billedYmd < start || b.billedYmd > todayYmd) continue
    const sat = satWords(b.billedYmd, todayYmd)
    out.push({
      kind: 'hand-marked',
      jobId: b.jobId,
      billId: b.id,
      usd: b.usd,
      amountText: stageUsd(b.usd),
      ...sat,
      head: 'Marked billed by hand, nothing on record went out.',
      detail: `${labelInWords(b.jobLabel)} was marked billed ${dayLabel(b.billedYmd)} with no send on file.`,
      proof: "The bill's billed day comes from the hand mark. No email, text or paper send sits in the bill's record. If the customer never got it, the pay clock runs on nothing.",
      door: { label: 'Open the bill', to: BILLING },
    })
  }
  return out.sort((a, b) => b.usd - a.usd || a.jobId.localeCompare(b.jobId) || (a.billId ?? '').localeCompare(b.billId ?? ''))
}
/** The fast lane: the ready-to-bill jobs, biggest remainder first, with the days each has sat since the office called it done. */
export function billFastLane(input: BillDeskInput): BillFastRow[] {
  const out: BillFastRow[] = []
  for (const j of input.jobs) {
    if (j.item.source !== 'ready') continue
    const revenue = j.revenueUsd ?? 0
    const covered = coveredUsd(j)
    const days = j.readyYmd ? Math.max(0, daysBetween(j.readyYmd, input.todayYmd)) : null
    const satText = days == null ? 'no ready day on record' : days === 0 ? 'ready today' : `sat ${days} ${plural(days, 'day', 'days')}`
    const coverText = covered > 0 ? `${coverSide(j)} cover ${stageUsd(covered)} of ${stageUsd(revenue)}` : 'nothing billed yet'
    out.push({ jobId: j.id, label: j.label, usd: j.item.usd, satDays: days, satText, coverText, late: days != null && days > BILL_SAME_DAY_TOLERANCE_DAYS, door: { label: 'Bill it', to: BILLING } })
  }
  return out.sort((a, b) => b.usd - a.usd || a.label.localeCompare(b.label))
}

/** The first day of the scorecard's window: this pay week and the ones before it, `BILL_SCORECARD_WEEKS` in all. */
export function scorecardStart(todayYmd: string): string {
  return ymdAddDays(payWeekContaining(todayYmd).start, -7 * (BILL_SCORECARD_WEEKS - 1))
}

/** Billed the day it finished? Over the window's bills with a ready day, per pay week and per bill. */
export function billScorecard(input: Pick<BillDeskInput, 'bills' | 'todayYmd' | 'dayLabel'>): BillScorecard {
  const start = scorecardStart(input.todayYmd)
  const bills = input.bills.filter((b) => b.billedYmd >= start && b.billedYmd <= input.todayYmd)
  const weeks: BillScorecardWeek[] = []
  const thisWeek = payWeekContaining(input.todayYmd).start
  for (let ws = start; ws <= thisWeek; ws = ymdAddDays(ws, 7)) weeks.push({ start: ws, label: input.dayLabel(ws), same: 0, sent: 0, tone: 'none' })
  const weekByStart = new Map(weeks.map((w) => [w.start, w]))
  let sameDay = 0
  let withReady = 0
  let noReady = 0
  let lateCashDays = 0
  const rows: BillScorecardRow[] = []
  for (const b of [...bills].sort((a, c) => (a.billedYmd > c.billedYmd ? -1 : a.billedYmd < c.billedYmd ? 1 : a.id.localeCompare(c.id)))) {
    const lag = b.readyYmd ? Math.max(0, daysBetween(b.readyYmd, b.billedYmd)) : null
    const late = lag != null && lag > BILL_SAME_DAY_TOLERANCE_DAYS
    const cashDays = lag != null ? lag * b.usd : 0
    if (lag == null) noReady += 1
    else {
      withReady += 1
      const w = weekByStart.get(payWeekContaining(b.billedYmd).start)
      if (w) {
        w.sent += 1
        if (!late) w.same += 1
      }
      if (!late) sameDay += 1
      else lateCashDays += cashDays
    }
    rows.push({
      id: b.id,
      bill: `${b.jobLabel} · ${stageUsd(b.usd)}`,
      readyText: b.readyYmd ? input.dayLabel(b.readyYmd) : '—',
      billedText: input.dayLabel(b.billedYmd),
      lagDays: lag,
      lagText: lag == null ? '—' : late ? `${lag} ${plural(lag, 'day', 'days')}` : 'same day',
      sentBy: b.sentFromHere ? (b.sentByName ?? 'from here') : 'by hand',
      cashDaysText: lag == null ? '—' : cashDays > 0 ? `${stageUsd(cashDays)}·d` : '0',
      late,
    })
  }
  for (const w of weeks) w.tone = w.sent === 0 ? 'none' : w.same === w.sent ? 'good' : 'bad'
  return {
    sameDay,
    withReady,
    noReady,
    headText: withReady > 0 ? `${sameDay} of ${withReady}` : 'no bill with a ready day',
    costLabel: lateCashDays > 0 ? `late sends cost ${stageUsd(lateCashDays)}·days this window` : 'no late send this window',
    weeks,
    rows,
    noReadyLine: noReady > 0 ? `${noReady} ${plural(noReady, 'bill has', 'bills have')} no ready day on record. ${plural(noReady, 'It sits', 'They sit')} in the table with a dash.` : null,
    lateCashDays,
  }
}

/** The footnote: how the desk reads, so a reader can see where it could lie. */
export function billHowItReads(): string[] {
  const tol = BILL_SAME_DAY_TOLERANCE_DAYS
  return [
    'How this reads: every row names the read that proves it.',
    'Finished is the %s times the contracts, less what bills or payments cover. The larger side is named.',
    'A ready job counts its whole remainder. A job with no price counts when it has field hours this window.',
    "The ready day is the job's own ready-to-bill status change. A job with none on record reads no ready day.",
    'The billed day is the day the bill went to the customer, else the day it was marked billed.',
    'Lag is the billed day less the ready day. Cash-days is the lag times the bill.',
    tol === 0 ? 'A bill reads same-day when it goes out the day the job was called done.' : `A bill reads same-day within ${tol} ${plural(tol, 'day', 'days')} of its ready day.`,
    "Who sent it comes from the bill's own record. A bill already paid never lists here.",
    'A bill marked billed by hand is billed, so it lists apart and the headline counts only unbilled work.',
    `The scorecard reads the last ${BILL_SCORECARD_WEEKS} pay weeks, this one included.`,
    "The cash days divide the pile's dollar-days by the bank's cash today.",
    "No weekly plan lives here. Each row carries its own door. The Bridge's call stays with the lit link.",
  ]
}

export function buildBillDesk(input: BillDeskInput): BillDesk {
  const facts = billDeskFacts(input)
  const leaks = billLeaks(input)
  const leaksUsd = leaks.reduce((s, l) => s + l.usd, 0)
  const fast = billFastLane(input)
  const handMarked = billHandMarked(input)
  const handMarkedUsd = handMarked.reduce((s, l) => s + l.usd, 0)
  const handMarkedNote =
    handMarked.length > 0
      ? `${handMarked.length} ${plural(handMarked.length, 'bill', 'bills')}, ${stageUsd(handMarkedUsd)}, ${plural(handMarked.length, 'was', 'were')} marked billed by hand with no send on file. A GC's pay application is recorded this way. The question is whether the customer got each one.`
      : `No bill of the last ${BILL_SCORECARD_WEEKS} pay weeks was marked billed by hand without a send.`
  const fastUsd = fast.reduce((s, r) => s + r.usd, 0)
  const noPrice = leaks.filter((l) => l.kind === 'no-price').length
  const headline =
    leaksUsd > 0 ? `Where billing leaks: ${stageUsd(leaksUsd)} will not bill itself.` : noPrice > 0 ? `Where billing leaks: ${noPrice} ${plural(noPrice, 'job has', 'jobs have')} no price to bill.` : 'Where billing leaks: nothing the reads can prove today.'
  return {
    headline,
    leaksUsd,
    leaks,
    leaksNote: leaks.length > 0 ? 'Every leak the reads can prove, biggest first. A row the office clears disappears on its own.' : 'No leak today. A row appears here the day the reads can prove one.',
    fastUsd,
    fast,
    handMarked,
    handMarkedUsd,
    handMarkedNote,
    fastNote: fast.length > 0 ? 'The office called these done, so the whole remainder counts. The day they finish is the day the rule says they go out.' : 'No job is marked ready to bill today.',
    scorecard: billScorecard(input),
    facts,
    footnote: billHowItReads(),
  }
}
