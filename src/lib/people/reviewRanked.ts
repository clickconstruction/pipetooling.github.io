// Pure kernels behind the Review tab's "ranked" view (variant C of the
// 2026-09-03 refresh): the verdict strip, the hygiene strip, the ranked
// profit bars, and the per-person "where the number comes from" drawer.
//
// Everything here is derived from the already-enriched
// `TeamSummaryBreakdown[]` rows — the same rows the Team Summary table
// renders — so the ranked view can never disagree with the table. No React,
// no Supabase.

import type { TeamSummaryBreakdown } from '../../components/people/teamSummary/types'
import { ymdAddDays } from '../../utils/dateUtils'

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

export type ReviewGroup = 'field' | 'office' | 'none'

/**
 * Field crew earn revenue; office & bids people ARE the overhead pool (their
 * wages sit on their own row as negative profit by construction); "none"
 * means no time and no money in the period.
 */
export function classifyReviewPerson(
  b: Pick<TeamSummaryBreakdown, 'totalHours' | 'overheadHours' | 'fieldHours' | 'gross' | 'net'>,
): ReviewGroup {
  const worked = b.totalHours > 0 || b.overheadHours > 0
  if (!worked && b.gross === 0 && b.net === 0) return 'none'
  return b.overheadHours > b.fieldHours ? 'office' : 'field'
}

export const REVIEW_GROUP_LABEL: Record<ReviewGroup, string> = {
  field: 'Field crew',
  office: 'Office & bids',
  none: 'No time this period',
}

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

/** Inclusive day count between two YYYY-MM-DD strings (1 when equal). */
export function inclusiveDayCount(start: string, end: string): number {
  const a = Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, Number(start.slice(8, 10)))
  const b = Date.UTC(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, Number(end.slice(8, 10)))
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1
  return Math.round((b - a) / 86_400_000) + 1
}

/** The same-length window immediately before [start, end]. */
export function priorPeriodRange(start: string, end: string): [string, string] {
  const len = inclusiveDayCount(start, end)
  const priorEnd = ymdAddDays(start, -1)
  const priorStart = ymdAddDays(start, -len)
  return [priorStart, priorEnd]
}

// ---------------------------------------------------------------------------
// Verdict strip
// ---------------------------------------------------------------------------

export type ReviewTrend = {
  direction: 'up' | 'down' | 'flat'
  /** (current − prior) ÷ |prior|; null when the prior period had no profit to compare against. */
  deltaPct: number | null
  priorProfit: number
}

/** ±`flatBand` reads as flat so a single swing doesn't flip the arrow. */
export function compareProfit(current: number, prior: number, flatBand = 0.05): ReviewTrend {
  if (!Number.isFinite(prior) || Math.abs(prior) < 1) {
    return { direction: 'flat', deltaPct: null, priorProfit: prior }
  }
  const deltaPct = (current - prior) / Math.abs(prior)
  if (deltaPct > flatBand) return { direction: 'up', deltaPct, priorProfit: prior }
  if (deltaPct < -flatBand) return { direction: 'down', deltaPct, priorProfit: prior }
  return { direction: 'flat', deltaPct, priorProfit: prior }
}

export type ReviewCompositionSegment = {
  key: 'costs' | 'fuel' | 'overheadLabor' | 'burden' | 'profit'
  label: string
  usd: number
  /** Share of gross, 0–1, clamped so the bar always fits. */
  share: number
}

export type ReviewVerdict = {
  people: number
  gross: number
  net: number
  /** Parts, subs and everyone's labor — gross − net (fuel included). */
  costs: number
  /** The fuel slice of `costs` (team share of Fuel / Gas card charges). */
  fuel: number
  /** Stored positive (a cost). */
  overheadLabor: number
  /** Positive; null until the 90-day rate loads. */
  burden: number | null
  /** null until the 90-day rate loads. */
  profit: number | null
  segments: ReviewCompositionSegment[]
  field: { count: number; profit: number | null; fieldHours: number; profitPerFieldHour: number | null }
  office: { count: number; overheadHours: number; overheadLabor: number; profit: number | null }
  none: { names: string[] }
  trend: ReviewTrend | null
}

function sumProfit(rows: readonly TeamSummaryBreakdown[]): number | null {
  let total = 0
  for (const r of rows) {
    if (r.profitAfterOverhead == null) return null
    total += r.profitAfterOverhead
  }
  return total
}

export function buildReviewVerdict(
  rows: readonly TeamSummaryBreakdown[],
  priorRows: readonly TeamSummaryBreakdown[] | null,
): ReviewVerdict {
  let gross = 0
  let net = 0
  let fuel = 0
  let overheadLabor = 0
  let burden: number | null = 0
  const field = { count: 0, profit: 0 as number | null, fieldHours: 0 }
  const office = { count: 0, overheadHours: 0, overheadLabor: 0, profit: 0 as number | null }
  const none: string[] = []
  for (const r of rows) {
    gross += r.gross
    net += r.net
    fuel += r.allocatedFuel
    overheadLabor += -r.overheadLaborCost
    if (burden != null) burden = r.overheadBurden == null ? null : burden + -r.overheadBurden
    const group = classifyReviewPerson(r)
    if (group === 'field') {
      field.count += 1
      field.fieldHours += r.fieldHours
      field.profit = field.profit == null || r.profitAfterOverhead == null ? null : field.profit + r.profitAfterOverhead
    } else if (group === 'office') {
      office.count += 1
      office.overheadHours += r.overheadHours
      office.overheadLabor += -r.overheadLaborCost
      office.profit = office.profit == null || r.profitAfterOverhead == null ? null : office.profit + r.profitAfterOverhead
    } else {
      none.push(r.name)
    }
  }
  const profit = sumProfit(rows)
  const costs = gross - net

  const segments: ReviewCompositionSegment[] = []
  if (gross > 0 && burden != null && profit != null) {
    const share = (usd: number) => Math.max(0, Math.min(1, usd / gross))
    segments.push({ key: 'costs', label: 'Parts, subs & labor', usd: costs - fuel, share: share(costs - fuel) })
    segments.push({ key: 'fuel', label: 'Fuel', usd: fuel, share: share(fuel) })
    segments.push({ key: 'overheadLabor', label: 'Overhead labor', usd: overheadLabor, share: share(overheadLabor) })
    segments.push({ key: 'burden', label: 'Parts burden', usd: burden, share: share(burden) })
    segments.push({ key: 'profit', label: 'Profit', usd: profit, share: share(profit) })
  }

  const priorProfit = priorRows ? sumProfit(priorRows) : null
  const trend = profit != null && priorProfit != null ? compareProfit(profit, priorProfit) : null

  return {
    people: rows.length,
    gross,
    net,
    costs,
    fuel,
    overheadLabor,
    burden,
    profit,
    segments,
    field: {
      count: field.count,
      profit: field.profit,
      fieldHours: field.fieldHours,
      profitPerFieldHour: field.profit != null && field.fieldHours > 0 ? field.profit / field.fieldHours : null,
    },
    office: { count: office.count, overheadHours: office.overheadHours, overheadLabor: office.overheadLabor, profit: office.profit },
    none: { names: none.sort((a, b) => a.localeCompare(b)) },
    trend,
  }
}

// ---------------------------------------------------------------------------
// Ranked bars
// ---------------------------------------------------------------------------

export type ReviewRankBy = 'profit' | 'profitPerHour' | 'gross' | 'net'

export const REVIEW_RANK_BY_LABEL: Record<ReviewRankBy, string> = {
  profit: 'profit after overhead',
  profitPerHour: 'profit/hr after overhead',
  gross: 'gross revenue',
  net: 'net revenue',
}

export type ReviewRankedBar = {
  name: string
  group: ReviewGroup
  salaried: boolean
  /** The ranked value; null while overhead rates load (profit ranks only). */
  value: number | null
  /** Left edge and width of the bar, as % of the track. Losses grow left from `zeroPct`. */
  startPct: number
  widthPct: number
  /** Secondary text: hours and the non-ranked headline. */
  sub: string
}

export type ReviewRankedBars = {
  bars: ReviewRankedBar[]
  /** Where the zero line sits on the track, as % from the left. */
  zeroPct: number
}

function rankValue(b: TeamSummaryBreakdown, rankBy: ReviewRankBy): number | null {
  switch (rankBy) {
    case 'profit':
      return b.profitAfterOverhead
    case 'profitPerHour':
      return b.profitPerHourAfterOverhead
    case 'gross':
      return b.gross
    case 'net':
      return b.net
  }
}

const fmtUsd0 = (n: number) => `${n < 0 ? '-$' : '$'}${Math.round(Math.abs(n)).toLocaleString('en-US')}`
/** Job label for prose: the ledger number when the job has one, else its name (click-only jobs carry hcp "Unknown"). */
function jobLabel(j: { hcp: string; jobName: string }): string {
  const hcp = j.hcp.trim()
  const name = j.jobName.trim()
  if (hcp && hcp.toLowerCase() !== 'unknown') return name ? `${hcp} ${name}` : hcp
  return name || 'Unnamed job'
}
const fmtH1 = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function buildReviewRankedBars(
  rows: readonly TeamSummaryBreakdown[],
  rankBy: ReviewRankBy,
  search = '',
): ReviewRankedBars {
  const q = search.trim().toLowerCase()
  const visible = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : [...rows]
  let maxPos = 0
  let maxNeg = 0
  const valued = visible.map((r) => {
    const value = rankValue(r, rankBy)
    if (value != null) {
      if (value > maxPos) maxPos = value
      if (-value > maxNeg) maxNeg = -value
    }
    return { r, value }
  })
  valued.sort((a, b) => {
    if (a.value == null && b.value == null) return a.r.name.localeCompare(b.r.name)
    if (a.value == null) return 1
    if (b.value == null) return -1
    return b.value - a.value || a.r.name.localeCompare(b.r.name)
  })
  const span = maxPos + maxNeg
  const zeroPct = span > 0 ? (maxNeg / span) * 100 : 0
  const bars: ReviewRankedBar[] = valued.map(({ r, value }) => {
    const group = classifyReviewPerson(r)
    const widthPct = value == null || span <= 0 ? 0 : (Math.abs(value) / span) * 100
    const startPct = value == null || value >= 0 ? zeroPct : zeroPct - widthPct
    const hoursText = `${fmtH1(r.totalHours)} h${r.payConfigSource === 'salary' ? ' assumed' : ''}`
    const subParts: string[] = [hoursText]
    if (group === 'office') subParts.push(`${fmtH1(r.overheadHours)} h office/bid`)
    else if (rankBy !== 'profit' && r.profitAfterOverhead != null) subParts.push(`${fmtUsd0(r.profitAfterOverhead)} profit`)
    else if (rankBy === 'profit' && r.profitPerHourAfterOverhead != null) subParts.push(`${fmtUsd0(r.profitPerHourAfterOverhead)}/hr`)
    return {
      name: r.name,
      group,
      salaried: r.payConfigSource === 'salary',
      value,
      startPct,
      widthPct,
      sub: subParts.join(' · '),
    }
  })
  return { bars, zeroPct }
}

// ---------------------------------------------------------------------------
// Per-person math drawer
// ---------------------------------------------------------------------------

export type ReviewMathLine = {
  key: string
  label: string
  /** One line saying where the number came from. */
  why: string
  /** null while the 90-day rate is loading. */
  usd: number | null
  kind: 'in' | 'out' | 'total'
}

export type ReviewLever = { text: string; tone: 'good' | 'warn' | 'neutral' }

export type ReviewPersonMath = {
  name: string
  group: ReviewGroup
  lines: ReviewMathLine[]
  perHour: { profit: number | null; hours: number; basis: 'assumed' | 'clocked' }
  levers: ReviewLever[]
  watchouts: string[]
}

export function buildReviewPersonMath(
  b: TeamSummaryBreakdown,
  ctx: { partsRate: number | null },
): ReviewPersonMath {
  const group = classifyReviewPerson(b)
  const salaried = b.payConfigSource === 'salary'
  const jobs = b.gb.jobs
  const costs = b.gross - b.net
  const wageText =
    b.overheadWage > 0
      ? ` × $${b.overheadWage.toFixed(2)}${b.overheadWage !== b.hourlyWage ? ' office rate' : ''}`
      : ''
  const lines: ReviewMathLine[] = [
    {
      key: 'gross',
      label: 'Gross revenue',
      why: `${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} · each job's bill × % complete, then this person's share by their labor-cost share of the job's lifetime labor`,
      usd: b.gross,
      kind: 'in',
    },
    ...(b.allocatedParts + b.allocatedLabor > 0 || costs === 0
      ? [
          {
            key: 'parts',
            label: '− Parts & job purchases',
            why: 'tally parts + supply invoices + billed materials + card charges other than fuel, in the same share',
            usd: -(b.allocatedParts - b.allocatedFuel),
            kind: 'out' as const,
          },
          {
            key: 'fuel',
            label: '− Fuel',
            why: 'card charges labelled Fuel / Gas in Banking (or bank-categorised FuelAndGas until labelled), in the same share',
            usd: -b.allocatedFuel,
            kind: 'out' as const,
          },
          {
            key: 'labor',
            label: '− Subs & team labor',
            why: 'every contributor\'s labor on those jobs, own labor included, in the same share',
            usd: -b.allocatedLabor,
            kind: 'out' as const,
          },
        ]
      : [
          {
            key: 'costs',
            label: '− Parts, subs & team labor',
            why: 'tally parts + supply invoices + billed materials + card charges + every contributor\'s labor, in the same share',
            usd: -costs,
            kind: 'out' as const,
          },
        ]),
    { key: 'net', label: 'Net revenue', why: '', usd: b.net, kind: 'total' },
    {
      key: 'overheadLabor',
      label: '− Own office / bid wages',
      why: `${fmtH1(b.overheadHours)} h of approved office and bid sessions in the period${wageText}`,
      usd: b.overheadLaborCost,
      kind: 'out',
    },
    {
      key: 'burden',
      label: '− Parts burden',
      why:
        ctx.partsRate == null
          ? 'field hours × the 90-day office-parts rate (loading)'
          : `${fmtH1(b.fieldHours)} field h × $${ctx.partsRate.toFixed(2)} (office parts ÷ field hours, 90-day)`,
      usd: b.overheadBurden,
      kind: 'out',
    },
    { key: 'profit', label: 'Profit after overhead', why: '', usd: b.profitAfterOverhead, kind: 'total' },
  ]

  const levers: ReviewLever[] = []
  const assumed = jobs.filter((j) => j.pctCompleteSource === 'assumed')
  if (assumed.length > 0) {
    const riding = assumed.reduce((s, j) => s + j.allocatedRevenue, 0)
    levers.push({
      text: `${assumed.length} ${assumed.length === 1 ? 'job has' : 'jobs have'} no % complete and count as 100% done — ${fmtUsd0(riding)} of gross rides on that`,
      tone: 'warn',
    })
  }
  const noBill = jobs.filter((j) => j.totalBill <= 0 && j.costInPeriod > 0)
  if (noBill.length > 0) {
    const names = noBill.slice(0, 2).map(jobLabel).join(', ')
    levers.push({
      text: `${noBill.length} ${noBill.length === 1 ? 'job has' : 'jobs have'} no bill amount, so the labor there is pure loss (${names}${noBill.length > 2 ? ', …' : ''})`,
      tone: 'warn',
    })
  }
  if (b.gross > 0 && jobs.length > 1) {
    const top = [...jobs].sort((x, y) => y.allocatedRevenue - x.allocatedRevenue)[0]
    if (top && top.allocatedRevenue / b.gross >= 0.4) {
      const pct = Math.round((top.allocatedRevenue / b.gross) * 100)
      const ratioPct = Math.round(top.ratio * 100)
      levers.push({
        text: `${pct}% of gross is one job (${jobLabel(top)}) — ${ratioPct}% of a job whose lifetime labor is ${fmtUsd0(top.totalLaborOnJob)}`,
        tone: 'warn',
      })
    }
  }
  const worst = [...b.pb.jobs].filter((j) => j.allocatedNet < 0).sort((x, y) => x.allocatedNet - y.allocatedNet)[0]
  if (worst) {
    levers.push({
      text: `Worst job: ${jobLabel(worst)} · ${fmtUsd0(worst.allocatedNet)} over ${fmtH1(worst.hoursInPeriod)} h`,
      tone: 'neutral',
    })
  }
  if (b.pb.unaccountedHours >= 0.5) {
    levers.push({ text: `${fmtH1(b.pb.unaccountedHours)} h of the period landed on no job`, tone: 'neutral' })
  }
  let zeroHourRows = 0
  for (const d of b.hb.dailyRows) for (const a of d.crewAllocations) if (a.hours <= 0) zeroHourRows += 1
  if (zeroHourRows > 0) {
    levers.push({ text: `${zeroHourRows} crew ${zeroHourRows === 1 ? 'assignment carries' : 'assignments carry'} 0 h — listed, not counted`, tone: 'neutral' })
  }

  const watchouts: string[] = [
    'Revenue uses today\'s % complete, so this period\'s number moves when a job progresses later.',
  ]
  if (salaried) watchouts.push('Hours are assumed: 8 h every weekday in the period, including today.')
  if (group === 'field') watchouts.push('Only this person\'s own office/bid wages are charged here; office staff wages sit on their own rows.')
  if (group === 'office') watchouts.push('Office & bids time is the overhead pool — a negative profit here is the cost of running the office, not a loss on a job.')
  if (ctx.partsRate == null) watchouts.push('The 90-day overhead rate is still loading; burden and profit after overhead are blank until it lands.')

  return {
    name: b.name,
    group,
    lines,
    perHour: { profit: b.profitPerHourAfterOverhead, hours: b.totalHours, basis: salaried ? 'assumed' : 'clocked' },
    levers,
    watchouts,
  }
}

// ---------------------------------------------------------------------------
// Hygiene strip
// ---------------------------------------------------------------------------

export type ReviewHygieneItem = {
  key: 'approvals' | 'noBill' | 'assumedPct' | 'officeLikeCharges' | 'salaried'
  headline: string
  detail: string
  href?: string
  linkLabel?: string
}

export type ReviewHygieneApprovals = { sessions: number; totalHours: number; people: number; oldestAgeDays: number }

/** Office-type card charges (Software, Utilities, Insurance, Medical…) allocated to field jobs in the period. */
export type ReviewHygieneOfficeLikeCharges = {
  usd: number
  charges: number
  jobs: number
  top: ReadonlyArray<{ category: string; counterparty: string; usd: number }>
}

export function buildReviewHygiene(
  rows: readonly TeamSummaryBreakdown[],
  approvals: ReviewHygieneApprovals | null,
  officeLike: ReviewHygieneOfficeLikeCharges | null = null,
): ReviewHygieneItem[] {
  const items: ReviewHygieneItem[] = []
  if (approvals && approvals.sessions > 0) {
    items.push({
      key: 'approvals',
      headline: `${approvals.sessions} ${approvals.sessions === 1 ? 'session' : 'sessions'} · ${fmtH1(approvals.totalHours)} h awaiting approval`,
      detail: `${approvals.people} ${approvals.people === 1 ? 'person' : 'people'}, oldest ${approvals.oldestAgeDays} ${approvals.oldestAgeDays === 1 ? 'day' : 'days'} ago — not counted anywhere until approved.`,
      href: '/people?tab=hours',
      linkLabel: 'Approve in Hours',
    })
  }
  const noBill = new Map<string, string>()
  const assumed = new Map<string, string>()
  let salaried = 0
  for (const r of rows) {
    if (r.payConfigSource === 'salary' && r.totalHours > 0) salaried += 1
    for (const j of r.gb.jobs) {
      if (j.totalBill <= 0 && j.costInPeriod > 0) noBill.set(j.jobId, jobLabel(j))
      if (j.pctCompleteSource === 'assumed' && j.totalBill > 0) assumed.set(j.jobId, jobLabel(j))
    }
  }
  if (noBill.size > 0) {
    const list = [...noBill.values()].slice(0, 3).join(', ')
    items.push({
      key: 'noBill',
      headline: `${noBill.size} ${noBill.size === 1 ? 'job has' : 'jobs have'} no bill amount`,
      detail: `Labor there lands as pure loss (${list}${noBill.size > 3 ? ', …' : ''}).`,
      href: '/jobs',
      linkLabel: 'Open Jobs',
    })
  }
  if (assumed.size > 0) {
    items.push({
      key: 'assumedPct',
      headline: `${assumed.size} ${assumed.size === 1 ? 'job has' : 'jobs have'} no % complete`,
      detail: 'They count as 100% done, so their whole bill is treated as earned.',
      href: '/jobs',
      linkLabel: 'Set progress',
    })
  }
  if (officeLike && officeLike.usd >= 1 && officeLike.charges > 0) {
    const named = officeLike.top.slice(0, 3).map((t) => `${t.counterparty} ${fmtUsd0(t.usd)}`).join(', ')
    items.push({
      key: 'officeLikeCharges',
      headline: `${fmtUsd0(officeLike.usd)} of office-type charges on ${officeLike.jobs} field ${officeLike.jobs === 1 ? 'job' : 'jobs'}`,
      detail: `${officeLike.charges} card ${officeLike.charges === 1 ? 'charge' : 'charges'} the bank filed as software, utilities, insurance, internet or medical count as parts there — usually office spend, sometimes a dump fee or permit (${named}${officeLike.top.length > 3 ? ', …' : ''}). Confirm or re-sort.`,
      href: '/banking?tab=sorting',
      linkLabel: 'Sort in Banking',
    })
  }
  if (salaried > 0) {
    items.push({
      key: 'salaried',
      headline: `Salaried hours are assumed for ${salaried} ${salaried === 1 ? 'person' : 'people'}`,
      detail: '8 h every weekday in the period, including today — not clock time.',
    })
  }
  return items
}
