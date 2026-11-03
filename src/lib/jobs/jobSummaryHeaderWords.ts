import type { JobSummaryBurn } from './jobSummaryBurn'
import { formatUsdNoCents } from './jobFormatting'
import { jobSummarySearchOn, type JobSummaryEnrichedRow, type JobSummaryTotals, type JobSummaryWindowKey } from './jobSummaryLedgerView'

/**
 * The words on Job Summary's header and Burn cells (v2.6389, the owner's J804 read).
 *
 * The strip above the table held six tiles whose figures mixed two moments: Revenue,
 * Gross and True profit are *to date* (an in-progress row earns its % of the contract),
 * while the row's Proj. margin is the true margin *at 100 %*. On J804 that put a 39 %
 * margin beside a −70 % projection with no word between them; Burn read `94% · 40%`
 * with nothing to say which was spend and which was progress; and three hygiene chips
 * about the whole window (sessions awaiting approval, overhead in flight, overhead on
 * jobs off the list) sat under a one-job search as if they were the job's. Pure.
 */

const pct = (v: number | null | undefined): string => (v == null ? '—' : `${Math.round(v)}%`)
const money = (v: number): string => `${v < 0 ? '−' : ''}${formatUsdNoCents(Math.abs(v))}`

export type JobSummaryTileWords = {
  revenue: { label: string; sub: string }
  gross: { sub: string }
  /** The sub-line once the overhead figure is known; the toolbar keeps its own loading / not-available words. */
  overhead: { sub: string }
  trueProfit: { sub: string }
  /** The seventh tile: Σ projected true margin at 100 % over the in-progress rows that have one; null when no row projects. */
  headingFor: { usd: number; pct: number | null; sub: string } | null
  perHour: { sub: string }
}

/**
 * Each tile's second line says which moment its figure belongs to. While any shown row
 * is in progress the to-date tiles say *to date*; a Revenue tile over one earned row says
 * the rule itself (*to date · 40% of $32,600*); **Heading for** carries the projection
 * the totals row already held, with the margin it works out to over those rows' contracts.
 */
export function jobSummaryTileWords(args: { totals: JobSummaryTotals; rows: ReadonlyArray<Pick<JobSummaryEnrichedRow, 'flags' | 'pct' | 'contractUsd'>>; methodLabel: string }): JobSummaryTileWords {
  const { totals, rows } = args
  const toDate = totals.earnedRows > 0 ? 'to date · ' : ''
  const only = rows.length === 1 ? rows[0]! : null
  let revenue: JobSummaryTileWords['revenue']
  if (totals.earnedRows === 0) {
    revenue = { label: 'Revenue', sub: 'contract · every job finished' }
  } else if (only && only.flags.includes('earned')) {
    const share = only.flags.includes('assumed-50') ? 'assumed 50%' : `${only.pct}%`
    revenue = { label: 'Revenue earned', sub: `to date · ${share} of ${formatUsdNoCents(only.contractUsd)}` }
  } else {
    const label = totals.earnedRows === totals.jobs ? 'Revenue earned' : 'Revenue'
    const of = totals.earnedRows === totals.jobs ? `${totals.earnedRows}` : `${totals.earnedRows} of ${totals.jobs}`
    revenue = { label, sub: `to date · ${of} in progress earned by hours` }
  }
  const ohOfGross = totals.overheadUsd != null && totals.grossUsd > 0 ? pct((totals.overheadUsd / totals.grossUsd) * 100) : '—'
  let headingFor: JobSummaryTileWords['headingFor'] = null
  if (totals.projectedRows > 0 && totals.projectedTrueMarginUsd != null) {
    const p = totals.projectedContractUsd > 0 ? (totals.projectedTrueMarginUsd / totals.projectedContractUsd) * 100 : null
    const tail = totals.projectedRows === 1 ? '' : ` · ${totals.projectedRows} jobs`
    headingFor = { usd: totals.projectedTrueMarginUsd, pct: p, sub: `true margin at 100% · ${pct(p)}${tail}` }
  }
  return {
    revenue,
    gross: { sub: `${toDate}${pct(totals.marginPct)} margin` },
    overhead: { sub: `${toDate}${args.methodLabel.toLowerCase()} · ${ohOfGross} of gross` },
    trueProfit: { sub: `${toDate}${pct(totals.trueMarginPct)} true margin` },
    headingFor,
    perHour: { sub: `true profit ÷ ${totals.hours.toFixed(1)} h` },
  }
}

/** The Burn cell: *94% spent · 40% done* · *12% spent · early* · *done* · — (no budget). The footing glyph stays the caller's. */
export function jobSummaryBurnCellWords(burn: JobSummaryBurn | null | undefined, pctDone: number | null | undefined): string {
  if (!burn || burn.status === 'no_budget') return '—'
  if (burn.status === 'done') return 'done'
  if (burn.status === 'early') return burn.spentPct != null ? `${Math.round(burn.spentPct)}% spent · early` : 'early'
  return `${Math.round(burn.spentPct ?? 0)}% spent · ${Math.round(pctDone ?? 0)}% done`
}

/** The Worked in window as a phrase after "Across": *this year* · *the last 90 days* · … */
export function jobSummaryWindowPhrase(window: JobSummaryWindowKey): string {
  switch (window) {
    case '90d':
      return 'the last 90 days'
    case '6mo':
      return 'the last 6 months'
    case 'ytd':
      return 'this year'
    case '12mo':
      return 'the last 12 months'
    case 'all':
      return 'every day since 2025'
  }
}

export type JobSummaryWindowChipsInput = {
  search: string
  window: JobSummaryWindowKey
  /** Pay lockdown: the money chips show for dev, master, controller only. */
  showMoney: boolean
  /** The off-list chip exists only under the day-share method. */
  dayShare: boolean
  hygiene: { pendingFieldSessions: number; pendingFieldHours: number; unallocatedUsd: number; unallocatedDays: number; inFlightUsd: number; offListUsd: number; offListJobs: number } | null
}

export type JobSummaryWindowChipsFold = {
  /** The one muted line that stands in for the window-wide chips while a search is on. */
  summary: string
  /** The short form of each chip folded, for the hover. */
  parts: string[]
}

/**
 * While the search box holds something the rows are one job or a few, but the hygiene
 * chips still speak for the whole window — so they fold into one line that names the
 * window (*Across this year: 15 sessions await approval · $6,517 of overhead in flight ·
 * $12,745 on 10 jobs off this list*). Null with nothing typed, or nothing to fold; the
 * chips about the rows themselves (assumption, write-downs, collections, no %) never fold.
 */
export function jobSummaryWindowChipsFold(args: JobSummaryWindowChipsInput): JobSummaryWindowChipsFold | null {
  if (!jobSummarySearchOn(args.search) || !args.hygiene) return null
  const h = args.hygiene
  const parts: string[] = []
  if (h.pendingFieldSessions > 0) parts.push(`${h.pendingFieldSessions} ${h.pendingFieldSessions === 1 ? 'session awaits' : 'sessions await'} approval`)
  if (args.showMoney && h.unallocatedUsd > 0) parts.push(`${money(h.unallocatedUsd)} of overhead had nobody to charge`)
  if (args.showMoney && h.inFlightUsd > 0.5) parts.push(`${money(h.inFlightUsd)} of overhead in flight`)
  if (args.showMoney && args.dayShare && h.offListUsd > 0.5) parts.push(`${money(h.offListUsd)} on ${h.offListJobs} ${h.offListJobs === 1 ? 'job' : 'jobs'} off this list`)
  if (parts.length === 0) return null
  return { summary: `Across ${jobSummaryWindowPhrase(args.window)}: ${parts.join(' · ')}`, parts }
}

/** The red chip under a % when the job is billed to its contract but the % is under 100 (v2.6389) — the office or the crew is wrong, and the row says so. */
export const JOB_SUMMARY_BILLED_IN_FULL_CHIP = 'billed in full'

export function jobSummaryBilledInFullTitle(pctDone: number | null): string {
  const says = pctDone == null ? 'the job has no % yet' : `the % says ${pctDone}`
  return `Every invoice on the job adds up to the contract, but ${says}. The office or the crew is wrong. Set the job's % in Edit Job, or have the crew report the lines left.`
}
