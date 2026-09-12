import { newestPercentEvent, type JobChargeEvent, type JobValueEvent } from '../jobChargesTimeline'
import { ymdAddDays } from '../../utils/dateUtils'

/**
 * Burn (v2.3189, owner-approved mock-up "Burn, Budget and Stages", 2026-09-09):
 * are we spending faster than we are finishing?
 *
 * Direct cost only — team labor, subs, parts — against a budget, with the
 * percent complete from the latest field report. Overhead is deliberately NOT
 * in the burn signal (it moves with the calendar, not with how the crew works,
 * and the bid never estimated it); it enters only the at-completion
 * projection, as Job Summary's day-share × the working days still to come, so
 * the projected TRUE margin lands on the same definition Job Summary uses.
 *
 * The one number: spent ÷ percent done = cost at completion. Price − that =
 * the margin we will actually make. Everything else here explains it.
 *
 * Pure. The component fetches; this file decides.
 */

export type JobBurnBudgetSource = 'bid_estimate' | 'target_margin'

export type JobBurnBudget = {
  usd: number
  source: JobBurnBudgetSource
  /** The rate used when source = target_margin. */
  targetMarginPct: number | null
}

/** Default target when the Job Summary Target chip is off (0). */
export const JOB_BURN_DEFAULT_TARGET_MARGIN_PCT = 35

/**
 * Bid estimate when the job came from a bid and the estimate was snapshotted
 * (not yet — always null today); else price × (1 − target margin). Null when
 * there is no price either — the section then says so instead of dividing by 0.
 */
export function resolveJobBurnBudget(args: {
  priceUsd: number | null
  bidEstimateUsd: number | null
  targetMarginPct: number | null
}): JobBurnBudget | null {
  if (args.bidEstimateUsd != null && args.bidEstimateUsd > 0) {
    return { usd: args.bidEstimateUsd, source: 'bid_estimate', targetMarginPct: null }
  }
  if (args.priceUsd == null || !(args.priceUsd > 0)) return null
  const target = args.targetMarginPct != null && args.targetMarginPct > 0 && args.targetMarginPct < 100 ? args.targetMarginPct : JOB_BURN_DEFAULT_TARGET_MARGIN_PCT
  return { usd: args.priceUsd * (1 - target / 100), source: 'target_margin', targetMarginPct: target }
}

export type JobBurnOverheadInput = {
  /** This job's day-share so far (Job Summary's method) over the loaded window. */
  shareToDateUsd: number
  /** Share ÷ this job's field days in the window; null when the job had no field day there. */
  perFieldDayUsd: number | null
}

export type JobBurnInput = {
  /** What the cumulative chart's earned-value line multiplies % done by (v2.3361): the budget (default) or the price — the honest basis when the budget is only an assumption. */
  earnedBasis?: 'budget' | 'price'
  chargeEvents: readonly JobChargeEvent[]
  valueEvents: readonly JobValueEvent[]
  /** Job-level % when no dated report carries one (Edit-Job pct / paid invoices). */
  fallbackPercent: number | null
  priceUsd: number | null
  budget: JobBurnBudget | null
  overhead: JobBurnOverheadInput | null
  todayYmd: string
}

export type JobBurnDay = {
  ymd: string
  team: number
  sub: number
  parts: number
  total: number
  /** Mean of `total` over this and the six prior working days. */
  avg7: number
}

export type JobBurnCumulativeRow = {
  ymd: string
  /** Cumulative direct cost through this day; null on forecast days. */
  actual: number | null
  /** Latest report % at or before this day × budget; null before the first report or without a budget. */
  earned: number | null
  /** Forecast continuation at today's burn; null before today. */
  forecast: number | null
}

export type JobBurnStatus = 'early' | 'ok' | 'hot' | 'no_budget'

export type JobBurnModel = {
  status: JobBurnStatus
  spentUsd: number
  /** Undated charges are in spentUsd but on no day. */
  undatedUsd: number
  percentDone: number | null
  percentSource: 'report' | 'job' | null
  budget: JobBurnBudget | null
  spentPctOfBudget: number | null
  /** spentPct − percentDone; positive = spend leads progress. */
  leadPts: number | null
  fieldDays: number
  /** Direct $ per field day over the last ten field days (null when idle 30+ days or no field days). */
  burnPerFieldDayUsd: number | null
  eacUsd: number | null
  marginUsd: number | null
  marginPct: number | null
  budgetRemainingUsd: number | null
  budgetGoneInFieldDays: number | null
  budgetGoneYmd: string | null
  progressPerFieldDay: number | null
  workLeftFieldDays: number | null
  overhead: {
    shareToDateUsd: number
    perFieldDayUsd: number | null
    projectedRemainingUsd: number | null
    trueMarginUsd: number | null
    trueMarginPct: number | null
  } | null
  daily: JobBurnDay[]
  cumulative: JobBurnCumulativeRow[]
}

const HOT_LEAD_PTS = 5
const BURN_WINDOW_FIELD_DAYS = 10
const IDLE_CALENDAR_DAYS = 30
const DAILY_WINDOW_WEEKDAYS = 14

export function isWeekdayYmd(ymd: string): boolean {
  const d = new Date(`${ymd}T12:00:00Z`).getUTCDay()
  return d >= 1 && d <= 5
}

/** Last `n` weekdays ending at `endYmd` (inclusive when it is a weekday), oldest first. */
export function lastWeekdays(endYmd: string, n: number): string[] {
  const out: string[] = []
  let cur = endYmd
  let guard = 0
  while (out.length < n && guard < n * 3 + 7) {
    if (isWeekdayYmd(cur)) out.unshift(cur)
    cur = ymdAddDays(cur, -1)
    guard += 1
  }
  return out
}

/** `startYmd` plus `n` weekdays (fractions round up — money runs out during that day). */
export function addWeekdays(startYmd: string, n: number): string {
  let left = Math.ceil(n)
  let cur = startYmd
  let guard = 0
  while (left > 0 && guard < 2000) {
    cur = ymdAddDays(cur, 1)
    if (isWeekdayYmd(cur)) left -= 1
    guard += 1
  }
  return cur
}

function sourceBucket(source: JobChargeEvent['source']): 'team' | 'sub' | 'parts' {
  if (source === 'team_labor') return 'team'
  if (source === 'sub_labor') return 'sub'
  return 'parts'
}

/** The newest dated % at or before the day — a report or a hand-set (v2.3372, `newestPercentEvent`). */
function latestReportPercent(valueEvents: readonly JobValueEvent[], uptoYmd?: string): number | null {
  return newestPercentEvent(valueEvents, uptoYmd)?.percent ?? null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function buildJobBurn(i: JobBurnInput): JobBurnModel {
  // ---- spend, by day ----
  const byDay = new Map<string, { team: number; sub: number; parts: number }>()
  let spent = 0
  let undated = 0
  const fieldDaySet = new Set<string>()
  for (const e of i.chargeEvents) {
    const amt = Number(e.amount) || 0
    spent += amt
    if (!e.dateKey) {
      undated += amt
      continue
    }
    const b = byDay.get(e.dateKey) ?? { team: 0, sub: 0, parts: 0 }
    b[sourceBucket(e.source)] += amt
    byDay.set(e.dateKey, b)
    if (e.source === 'team_labor') fieldDaySet.add(e.dateKey)
  }
  const fieldDays = [...fieldDaySet].filter((d) => d <= i.todayYmd).sort()

  // ---- percent ----
  // v2.3372: the newest dated % wins — a hand-set after the last report reads as the job's own %.
  const newest = newestPercentEvent(i.valueEvents)
  const percentDone = newest?.percent ?? i.fallbackPercent
  const percentSource: JobBurnModel['percentSource'] = newest ? (newest.kind === 'manual' ? 'job' : 'report') : i.fallbackPercent != null ? 'job' : null

  // ---- burn rate: last ten field days, unless idle ----
  const recentFieldDays = fieldDays.slice(-BURN_WINDOW_FIELD_DAYS)
  const idleCutoff = ymdAddDays(i.todayYmd, -IDLE_CALENDAR_DAYS)
  let burnPerFieldDayUsd: number | null = null
  if (recentFieldDays.length > 0 && recentFieldDays[recentFieldDays.length - 1]! >= idleCutoff) {
    const windowStart = recentFieldDays[0]!
    let windowSpend = 0
    for (const [ymd, b] of byDay) {
      if (ymd >= windowStart && ymd <= i.todayYmd) windowSpend += b.team + b.sub + b.parts
    }
    burnPerFieldDayUsd = windowSpend / recentFieldDays.length
  }

  // ---- budget maths ----
  const budget = i.budget
  const spentPctOfBudget = budget && budget.usd > 0 ? (spent / budget.usd) * 100 : null
  const leadPts = spentPctOfBudget != null && percentDone != null ? spentPctOfBudget - percentDone : null
  const tooEarly = percentDone == null || percentDone < 10 || fieldDays.length < 3
  const eacUsd = !tooEarly && percentDone != null && percentDone > 0 ? spent / (percentDone / 100) : null
  const marginUsd = eacUsd != null && i.priceUsd != null ? i.priceUsd - eacUsd : null
  const marginPct = marginUsd != null && i.priceUsd != null && i.priceUsd > 0 ? (marginUsd / i.priceUsd) * 100 : null
  const budgetRemainingUsd = budget ? budget.usd - spent : null
  const progressPerFieldDay = percentDone != null && fieldDays.length > 0 ? percentDone / fieldDays.length : null
  const workLeftFieldDays =
    percentDone != null && progressPerFieldDay != null && progressPerFieldDay > 0 && percentDone < 100 ? (100 - percentDone) / progressPerFieldDay : percentDone != null && percentDone >= 100 ? 0 : null
  // A finished job has no runway to forecast — the budget was reached or it wasn't.
  const budgetGoneInFieldDays =
    workLeftFieldDays !== 0 && budgetRemainingUsd != null && budgetRemainingUsd > 0 && burnPerFieldDayUsd != null && burnPerFieldDayUsd > 0
      ? budgetRemainingUsd / burnPerFieldDayUsd
      : null
  const budgetGoneYmd = budgetGoneInFieldDays != null ? addWeekdays(i.todayYmd, budgetGoneInFieldDays) : null

  // ---- overhead: projection only ----
  let overhead: JobBurnModel['overhead'] = null
  if (i.overhead) {
    const projectedRemainingUsd =
      i.overhead.perFieldDayUsd != null && workLeftFieldDays != null ? i.overhead.perFieldDayUsd * workLeftFieldDays : null
    const trueMarginUsd =
      marginUsd != null && projectedRemainingUsd != null ? marginUsd - i.overhead.shareToDateUsd - projectedRemainingUsd : null
    overhead = {
      shareToDateUsd: i.overhead.shareToDateUsd,
      perFieldDayUsd: i.overhead.perFieldDayUsd,
      projectedRemainingUsd,
      trueMarginUsd,
      trueMarginPct: trueMarginUsd != null && i.priceUsd != null && i.priceUsd > 0 ? (trueMarginUsd / i.priceUsd) * 100 : null,
    }
  }

  // ---- daily series: last 14 weekdays with a trailing 7-weekday mean ----
  const weekdays = lastWeekdays(i.todayYmd, DAILY_WINDOW_WEEKDAYS + 6)
  const totals = weekdays.map((ymd) => {
    const b = byDay.get(ymd)
    return b ? b.team + b.sub + b.parts : 0
  })
  const daily: JobBurnDay[] = weekdays.slice(6).map((ymd, k) => {
    const idx = k + 6
    const b = byDay.get(ymd) ?? { team: 0, sub: 0, parts: 0 }
    const win = totals.slice(idx - 6, idx + 1)
    return { ymd, team: round2(b.team), sub: round2(b.sub), parts: round2(b.parts), total: round2(b.team + b.sub + b.parts), avg7: round2(win.reduce((a, c) => a + c, 0) / win.length) }
  })

  // ---- cumulative: actual · earned · forecast ----
  const datedDays = [...byDay.keys()].filter((d) => d <= i.todayYmd).sort()
  const cumulative: JobBurnCumulativeRow[] = []
  if (datedDays.length > 0) {
    const first = datedDays[0]!
    let cum = undated
    let cur = first
    let guard = 0
    while (cur <= i.todayYmd && guard < 4000) {
      const b = byDay.get(cur)
      if (b) cum += b.team + b.sub + b.parts
      const pct = latestReportPercent(i.valueEvents, cur)
      cumulative.push({
        ymd: cur,
        actual: round2(cum),
        earned: i.earnedBasis === 'price' ? (i.priceUsd != null && pct != null ? round2((pct / 100) * i.priceUsd) : null) : budget && pct != null ? round2((pct / 100) * budget.usd) : null,
        forecast: cur === i.todayYmd ? round2(cum) : null,
      })
      cur = ymdAddDays(cur, 1)
      guard += 1
    }
    if (burnPerFieldDayUsd != null && burnPerFieldDayUsd > 0 && budget && workLeftFieldDays !== 0) {
      const horizon = budgetGoneInFieldDays != null ? Math.min(Math.ceil(budgetGoneInFieldDays), 40) : 10
      let f = cum
      let day = i.todayYmd
      for (let k = 0; k < horizon; k += 1) {
        day = addWeekdays(day, 1)
        f = Math.min(f + burnPerFieldDayUsd, Math.max(budget.usd, cum))
        cumulative.push({ ymd: day, actual: null, earned: null, forecast: round2(f) })
        if (f >= budget.usd) break
      }
    }
  }

  const status: JobBurnStatus = !budget ? 'no_budget' : tooEarly ? 'early' : leadPts != null && leadPts > HOT_LEAD_PTS ? 'hot' : 'ok'

  return {
    status,
    spentUsd: round2(spent),
    undatedUsd: round2(undated),
    percentDone,
    percentSource,
    budget,
    spentPctOfBudget,
    leadPts,
    fieldDays: fieldDays.length,
    burnPerFieldDayUsd,
    eacUsd,
    marginUsd,
    marginPct,
    budgetRemainingUsd,
    budgetGoneInFieldDays,
    budgetGoneYmd,
    progressPerFieldDay,
    workLeftFieldDays,
    overhead,
    daily,
    cumulative,
  }
}
