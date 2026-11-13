/**
 * The Scoreboard (v2.6407, punch list #250): the Money look's second view, the game Squad's
 * end-of-match board in the app's clothes. One grid where the same nine columns mean the same
 * thing at every level: the site's totals are the column heads, a row is a job, and (PR 2) the
 * rows under an open job are the people, subs, supply houses, the card and the overhead day share,
 * each filling Cost with what it put in so they sum to the job. A folded row shows the three that
 * matter most, Earned · Cost · Profit; opened, all nine. Green is effort, red is what it cost, gold
 * is the money. Earned is Job Summary's rule (`jobEarned`), the costs are the Jobs & bids table's
 * (`siteCosts.ts`), hours and days the clock's (`siteLabor.ts`), overhead the day share. A window (PR 4,
 * v2.6558) cuts every measure to the days in it: hours, days and labor from the clock's days, subs and
 * parts from the dated charge events the Timeline builds, overhead from its day lines, earned by the
 * hours in the window as Job Summary earns it; an undated charge stays out of a window. Pure: the
 * component draws, the hooks read.
 */
import { jobSummaryPaidInvoiceOpts, resolveJobSummaryPercentCompleteWithSource, type JobSummaryPercentSource } from '../jobSummaryPercentComplete'
import { jobEarned } from '../jobs/jobEarned'
import { earnedRevenueInWindow } from '../bridge/earnedRevenue'
import type { JobChargeEvent } from '../jobChargesTimeline'
import type { JobOverheadDayLine } from '../jobs/jobDayLedger'
import { normalizeJobsLedgerStatus, type JobsLedgerPipelineStatus } from '../jobsLedgerStatusPipeline'
import type { MemberJob } from './overview'
import type { SiteCostsRead } from './siteCosts'
import type { SiteLaborRead } from './siteLabor'
import type { CardHoldersRead } from './cardHolders'

export type ScoreboardColumnKey = 'hours' | 'days' | 'labor' | 'subs' | 'parts' | 'overhead' | 'earned' | 'cost' | 'profit'

export type ScoreboardGroup = 'effort' | 'cost' | 'money'

export type ScoreboardColumn = { key: ScoreboardColumnKey; label: string; group: ScoreboardGroup; glyph: string; title: string }

/** The nine, in the order the board draws them: effort, then what it cost, then the money. */
export const SCOREBOARD_COLUMNS: ReadonlyArray<ScoreboardColumn> = [
  { key: 'hours', label: 'Hours', group: 'effort', glyph: '◷', title: 'Clocked hours on the job, recorded time' },
  { key: 'days', label: 'Days', group: 'effort', glyph: '▦', title: 'Days with work, each counted once' },
  { key: 'labor', label: 'Labor', group: 'cost', glyph: '⚒︎', title: 'Wages for the clocked hours' },
  { key: 'subs', label: 'Subs', group: 'cost', glyph: '⚙︎', title: 'The sub-labor sheets, drive cost included' },
  { key: 'parts', label: 'Parts', group: 'cost', glyph: '▣', title: 'Supply-house invoices, card charges, the tally and the other charges' },
  { key: 'overhead', label: 'Overhead', group: 'cost', glyph: '⌂', title: 'The office day share, from the day the overhead pool began' },
  { key: 'earned', label: 'Earned', group: 'money', glyph: '$', title: 'The contract at 100%, the percent’s share while working, half when no percent is on record' },
  { key: 'cost', label: 'Cost', group: 'money', glyph: 'Σ', title: 'Labor, subs, parts and overhead together' },
  { key: 'profit', label: 'Profit', group: 'money', glyph: '★', title: 'Earned less cost' },
]

/** The three a folded row shows: the ones that matter most, and the last three of the nine. */
export const SCOREBOARD_FOLDED: ReadonlyArray<ScoreboardColumnKey> = ['earned', 'cost', 'profit']

/** The office without the finance seats reads effort and value, no wage and no cost (the owner's call 2). */
export const SCOREBOARD_LEAD_COLUMNS: ReadonlyArray<ScoreboardColumnKey> = ['hours', 'days', 'earned']

export function scoreboardColumnsFor(seesCosts: boolean, daysKnown = true): ReadonlyArray<ScoreboardColumn> {
  const cols = seesCosts ? SCOREBOARD_COLUMNS : SCOREBOARD_COLUMNS.filter((c) => SCOREBOARD_LEAD_COLUMNS.includes(c.key))
  // A reader who gets the hours without the clock's days sees no Days column, never a false zero (v2.6457).
  return daysKnown ? cols : cols.filter((c) => c.key !== 'days')
}

/** What a folded row shows for a set of columns: the money three on the full board, every column on the lead's. */
export function scoreboardFoldedKeys(columns: ReadonlyArray<ScoreboardColumn>): ReadonlySet<ScoreboardColumnKey> {
  return new Set(columns.some((c) => c.key === 'cost') ? SCOREBOARD_FOLDED : columns.map((c) => c.key))
}

export type ScoreboardSort = { key: ScoreboardColumnKey; desc: boolean }

export const SCOREBOARD_DEFAULT_SORT: ScoreboardSort = { key: 'earned', desc: true }

/** A press on a tile: a new column sorts biggest first; the same tile again turns the order. */
export function nextScoreboardSort(current: ScoreboardSort, key: ScoreboardColumnKey): ScoreboardSort {
  return current.key === key ? { key, desc: !current.desc } : { key, desc: true }
}

export type ScoreboardReadState = 'off' | 'reading' | 'read' | 'failed'

/** The three reads behind the cells: the clock, the costs, the day ledger. */
export type ScoreboardReads = { labor: ScoreboardReadState; costs: ScoreboardReadState; overhead: ScoreboardReadState }

/** `lines` (v2.6498): the day lines behind the share, for the Money look's Timeline's amber band; absent on an older read. */
export type SiteOverheadRead = { state: 'off' } | { state: 'reading' } | { state: 'read'; byJobId: ReadonlyMap<string, { usd: number; days: number; lines?: readonly JobOverheadDayLine[] }> } | { state: 'failed' }

/** Which read a column's figure comes from; Earned comes with the page, Cost and Profit from all three. */
export const SCOREBOARD_COLUMN_READ: Record<ScoreboardColumnKey, keyof ScoreboardReads | 'page' | 'all'> = {
  hours: 'labor',
  days: 'labor',
  labor: 'labor',
  subs: 'costs',
  parts: 'costs',
  overhead: 'overhead',
  earned: 'page',
  cost: 'all',
  profit: 'all',
}

/** Whether a column's figure stands: its read is in, or it is the page's own. */
export function scoreboardCellStands(key: ScoreboardColumnKey, reads: ScoreboardReads): 'stands' | 'reading' | 'failed' | 'off' {
  const src = SCOREBOARD_COLUMN_READ[key]
  if (src === 'page') return 'stands'
  const states = src === 'all' ? [reads.labor, reads.costs, reads.overhead] : [reads[src]]
  if (states.some((s) => s === 'failed')) return 'failed'
  if (states.some((s) => s === 'reading')) return 'reading'
  if (src !== 'all' && states[0] === 'off') return 'off'
  return 'stands'
}

export type ScoreboardMeasures = Record<ScoreboardColumnKey, number>

export type ScoreboardFlag = 'no-price' | 'materials-only' | 'assumed-50' | 'no-pct'

export type ScoreboardPctSource = JobSummaryPercentSource | 'paid'

export type ScoreboardJob = {
  jobId: string
  label: string
  name: string
  status: JobsLedgerPipelineStatus | null
  pct: number | null
  pctSource: ScoreboardPctSource
  finished: boolean
  flags: ScoreboardFlag[]
  /** The job carries a price (`revenue` over 0); the headline's first case is a job without one. */
  priced: boolean
  m: ScoreboardMeasures
  /** No earned dollar, no cost and no hours: folded under *Nothing on them yet*. Hours count since v2.6467, so the leader's board, which reads no cost, keeps a job with hours on it in view. */
  empty: boolean
  /** The job's work days, each once (PR 4): the clock's days, or the window's; null when the read has no days, so a part's days can be counted once across its jobs. */
  dayKeys: ReadonlySet<string> | null
}

/** A window on the board (PR 4): two calendar days, both inside, in APP_CALENDAR_TZ. */
export type ScoreboardWindowRange = { from: string; to: string }

export type ScoreboardModel = {
  /** The site's nine: the sum of every job, days counted once each across the site. */
  site: ScoreboardMeasures
  /** The margin on work alone, materials-only jobs set aside (the owner's call 7); null when no job is set aside. */
  work: { earned: number; profit: number; jobs: number } | null
  /** The jobs with money on them, in the sort's order. */
  rows: ScoreboardJob[]
  /** The jobs with nothing on them yet, folded. */
  empties: ScoreboardJob[]
  reads: ScoreboardReads
  sort: ScoreboardSort
  /** People with hours on the site, from the clock; 0 until that read is in. */
  people: number
  /** The window the measures are cut to (PR 4), or null for the site's whole life. */
  window: ScoreboardWindowRange | null
}

export type ScoreboardInput = {
  jobs: ReadonlyArray<MemberJob>
  invoices: ReadonlyArray<{ job_id: string; amount: number; status: string }>
  jobLabel: (job: MemberJob) => string
  labor?: SiteLaborRead
  costs?: SiteCostsRead
  overhead?: SiteOverheadRead
  sort?: ScoreboardSort
  /** The window (PR 4): given, every measure is cut to its days. */
  window?: ScoreboardWindowRange | null
  /**
   * The dated charge events per job (`siteChargeEventsFromCostRows`), read with a window: subs and parts in the window
   * are summed from them. Absent with a window, the costs keep their whole-life totals (an older caller).
   */
  chargeEvents?: ReadonlyMap<string, readonly JobChargeEvent[]> | null
}

/** Inside the window, or anywhere when there is none; an undated row is never inside a window. */
export function inScoreboardWindow(window: ScoreboardWindowRange | null | undefined, ymd: string | null | undefined): boolean {
  if (!window) return true
  return !!ymd && ymd >= window.from && ymd <= window.to
}

const ZERO: ScoreboardMeasures = { hours: 0, days: 0, labor: 0, subs: 0, parts: 0, overhead: 0, earned: 0, cost: 0, profit: 0 }

export function readStateOf(read: { state: ScoreboardReadState } | undefined): ScoreboardReadState {
  return read ? read.state : 'off'
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * The percent a job is at, as the Money look reads it: paid is done; else paid bills that cover the
 * contract, then the office's percent (the crew's newest report is Job Summary's second source; the
 * page does not read reports yet, so it is not here).
 */
export function scoreboardPct(job: Pick<MemberJob, 'status' | 'pct_complete' | 'revenue'>, invoices: ReadonlyArray<{ amount: number; status: string }>): { pct: number | null; source: ScoreboardPctSource } {
  if (normalizeJobsLedgerStatus(job.status) === 'paid') return { pct: 100, source: 'paid' }
  const r = resolveJobSummaryPercentCompleteWithSource(null, job.pct_complete ?? null, jobSummaryPaidInvoiceOpts([...invoices], job.revenue))
  return { pct: r.pct, source: r.source }
}

export function buildScoreboard(input: ScoreboardInput): ScoreboardModel {
  const sort = input.sort ?? SCOREBOARD_DEFAULT_SORT
  const reads: ScoreboardReads = { labor: readStateOf(input.labor), costs: readStateOf(input.costs), overhead: readStateOf(input.overhead) }
  const laborBy = input.labor?.state === 'read' ? input.labor.labor.byJobId : null
  const costsBy = input.costs?.state === 'read' ? input.costs.byJobId : null
  const overheadBy = input.overhead?.state === 'read' ? input.overhead.byJobId : null
  const invoicesByJob = new Map<string, Array<{ amount: number; status: string }>>()
  for (const i of input.invoices) {
    const list = invoicesByJob.get(i.job_id)
    if (list) list.push(i)
    else invoicesByJob.set(i.job_id, [i])
  }
  const win = input.window ?? null
  const events = win ? (input.chargeEvents ?? null) : null
  const all: ScoreboardJob[] = input.jobs.map((job) => {
    const contractUsd = Number(job.revenue) || 0
    const { pct, source } = scoreboardPct(job, invoicesByJob.get(job.id) ?? [])
    const finished = pct === 100
    const l = laborBy?.get(job.id)
    const c = costsBy?.get(job.id)
    const o = overheadBy?.get(job.id)
    // The clock's days, each once; in a window, the days inside it and the hours and dollars on them.
    const dayKeys = new Set<string>()
    let hours = l?.hours ?? 0
    let laborUsd = l?.costUsd ?? 0
    let days = l?.days ?? 0
    let daysDated = false
    if (l) {
      if (win) {
        hours = 0
        laborUsd = 0
      }
      for (const p of l.people) {
        for (const d of p.byWorkDate ?? []) {
          daysDated = true
          if (!inScoreboardWindow(win, d.ymd)) continue
          dayKeys.add(d.ymd)
          if (win) {
            hours += d.hours
            laborUsd += d.costUsd
          }
        }
      }
      if (win) days = dayKeys.size
    }
    // With a window the costs come from the dated events; an undated charge is not in any window.
    let subs = c?.subLabor ?? 0
    let parts = c ? c.parts.supplyInvoices + c.parts.cardCharges + c.parts.tallyParts + c.parts.otherCharges : 0
    if (win && events && c) {
      subs = 0
      parts = 0
      for (const e of events.get(job.id) ?? []) {
        if (!inScoreboardWindow(win, e.dateKey)) continue
        if (e.source === 'team_labor') continue
        if (e.source === 'sub_labor') subs += e.amount
        else parts += e.amount
      }
    }
    let overheadUsd = o?.usd ?? 0
    if (win && o) overheadUsd = (o.lines ?? []).reduce((sum, line) => sum + (inScoreboardWindow(win, line.ymd) ? line.shareUsd : 0), 0)
    // Earned: the whole-life rule, or in a window the hours' share of it as Job Summary earns it (the clock's hours in the window over the job's expected hours).
    const whole = jobEarned({ contractUsd, pct, finished })
    const windowed = win ? earnedRevenueInWindow({ contractUsd, pctComplete: pct, status: job.status ?? 'in_progress', finished, hoursInWindow: hours, lifetimeHours: l?.hours ?? 0 }) : null
    const earnedUsd = win ? (windowed?.usd ?? 0) : whole.usd
    const assumed = win ? (windowed ? windowed.assumedHalf : contractUsd > 0 && pct == null) : whole.flags.includes('assumed-50')
    const m: ScoreboardMeasures = {
      hours,
      days,
      labor: round2(laborUsd),
      subs: round2(subs),
      parts: round2(parts),
      overhead: round2(overheadUsd),
      earned: round2(earnedUsd),
      cost: 0,
      profit: 0,
    }
    m.cost = round2(m.labor + m.subs + m.parts + m.overhead)
    m.profit = round2(m.earned - m.cost)
    const flags: ScoreboardFlag[] = []
    // A job with no price and something on it: a cost, or hours on the leader's board, which reads no cost (v2.6467, so the row wears what its headline says).
    if (!(contractUsd > 0) && (m.cost > 0 || m.hours > 0)) flags.push('no-price')
    const materialsOnly = job.billing_only === true || (laborBy != null && costsBy != null && m.earned > 0 && m.hours === 0 && m.subs === 0 && m.parts > 0)
    if (materialsOnly) flags.push('materials-only')
    if (assumed) flags.push('assumed-50')
    if (pct == null) flags.push('no-pct')
    return {
      jobId: job.id,
      label: input.jobLabel(job),
      name: job.job_name?.trim() || job.job_address?.trim() || '',
      status: normalizeJobsLedgerStatus(job.status),
      pct,
      pctSource: source,
      finished,
      flags,
      priced: contractUsd > 0,
      m,
      empty: m.earned === 0 && m.cost === 0 && m.hours === 0,
      dayKeys: l && (daysDated || win) ? dayKeys : null,
    }
  })
  const dir = sort.desc ? -1 : 1
  const byLabel = (a: ScoreboardJob, b: ScoreboardJob) => a.label.localeCompare(b.label, undefined, { numeric: true })
  const sorted = [...all].sort((a, b) => dir * (a.m[sort.key] - b.m[sort.key]) || byLabel(a, b))
  const rows = sorted.filter((r) => !r.empty)
  const empties = sorted.filter((r) => r.empty)
  const site: ScoreboardMeasures = { ...ZERO }
  for (const r of all) for (const k of Object.keys(site) as ScoreboardColumnKey[]) site[k] = round2(site[k] + r.m[k])
  // Days are counted once each across the site, not summed over jobs: the clock read knows the site's days; in a window, the jobs' days inside it, each once.
  site.days = input.labor?.state === 'read' ? (win ? new Set(all.flatMap((r) => [...(r.dayKeys ?? [])])).size : input.labor.labor.siteDays) : 0
  const setAside = rows.filter((r) => r.flags.includes('materials-only'))
  const work =
    setAside.length > 0
      ? rows.filter((r) => !r.flags.includes('materials-only')).reduce((acc, r) => ({ earned: round2(acc.earned + r.m.earned), profit: round2(acc.profit + r.m.profit), jobs: acc.jobs + 1 }), { earned: 0, profit: 0, jobs: 0 })
      : null
  return { site, work, rows, empties, reads, sort, people: input.labor?.state === 'read' ? input.labor.labor.people : 0, window: win }
}

// ---- words -------------------------------------------------------------------------------------

const usd0 = (n: number): string => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`

/** A dollar figure for a cell: whole dollars, a minus sign before a loss. */
export function scoreboardUsd(n: number): string {
  return `${n < 0 ? '−' : ''}${usd0(n)}`
}

export function scoreboardHours(n: number): string {
  return `${Math.round(n).toLocaleString('en-US')} h`
}

export function scoreboardDays(n: number): string {
  return `${Math.round(n).toLocaleString('en-US')} d`
}

/** A part as a percent of a whole, whole percents; — when there is no whole. */
export function scoreboardPctOf(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—'
}

/** The figure a cell shows for a column. */
export function scoreboardCellWords(key: ScoreboardColumnKey, value: number): string {
  if (key === 'hours') return scoreboardHours(value)
  if (key === 'days') return scoreboardDays(value)
  return scoreboardUsd(value)
}

/**
 * A dollar figure short enough for a narrow column (v2.6457, the walk at tablet widths): the Gray Fox phone
 * strip's rule (`lookFigure.ts`), from a million *$2.4M*, from ten thousand *$712k*, and since a 57 px column
 * cannot hold *−$6,840* in bold, from a thousand one decimal (*$9.4k*, *−$8k*); under a thousand the whole
 * dollars, a minus sign before a loss. Hours and days stay whole. The exact figure rides the cell's title.
 */
export function scoreboardCompactWords(key: ScoreboardColumnKey, value: number): string {
  if (key === 'hours' || key === 'days') return scoreboardCellWords(key, value)
  const n = Math.abs(value)
  const sign = value < 0 ? '−' : ''
  if (n >= 1_000_000) return `${sign}$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
  if (n >= 10_000) return `${sign}$${Math.round(n / 1000)}k`
  if (n >= 1_000) return `${sign}$${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return scoreboardUsd(value)
}

/** Below this width the board's columns are too narrow for whole dollars: the cells and tiles read short. The window's query is the first paint's guess. */
export const SCOREBOARD_COMPACT_QUERY = '(max-width: 1180px)'

/**
 * The board's own width under which it reads short (v2.6457): at 1,200 px the columns `scoreboardColumnWidths`
 * gives are 144 px for Profit and 100 px for the other money, the room an eight-figure total in bold needs.
 * Measured on the board itself, so a side panel or a zoom decides as the window cannot.
 */
export const SCOREBOARD_NARROW_BELOW_PX = 1200

/** The full board's share of its width for each column that does not share alike: the effort columns hold a few digits and a letter, Profit a figure and its percent. */
const SCOREBOARD_SET_WIDTHS: Partial<Record<ScoreboardColumnKey, number>> = { hours: 6.5, days: 6.5, profit: 12 }

/**
 * How wide the Job column and each figure's column are, in percent of the board (v2.6457). The full board at
 * whole dollars weights them: Hours and Days give their room to the money and Profit takes the most, since nine
 * equal columns left the site's bold total and its percent 14 px short at 1280 wide. With short money words every
 * figure's column shares alike, and the leader's board gives the Job column nearly half.
 */
export function scoreboardColumnWidths(columns: ReadonlyArray<ScoreboardColumn>, narrow: boolean): { job: string; columns: ReadonlyArray<string | undefined> } {
  if (!columns.some((c) => c.key === 'cost')) return { job: '46%', columns: columns.map(() => undefined) }
  if (narrow) return { job: '26%', columns: columns.map(() => undefined) }
  const job = 25
  const set = columns.reduce((sum, c) => sum + (SCOREBOARD_SET_WIDTHS[c.key] ?? 0), 0)
  const rest = columns.filter((c) => SCOREBOARD_SET_WIDTHS[c.key] == null).length
  const share = rest ? (100 - job - set) / rest : 0
  return { job: `${job}%`, columns: columns.map((c) => `${Number((SCOREBOARD_SET_WIDTHS[c.key] ?? share).toFixed(3))}%`) }
}

/** The line a flag shows beside a job, and what it means on hover. */
export const SCOREBOARD_FLAG_WORDS: Record<ScoreboardFlag, { label: string; title: string }> = {
  'no-price': { label: 'no price', title: 'A job with no price: it costs and earns nothing until one is set' },
  'materials-only': { label: 'materials only', title: 'A pass-through job: no hours, parts billed on' },
  'assumed-50': { label: '≈ 50% assumed', title: 'No percent on record yet, so half the price is counted' },
  'no-pct': { label: 'no percent', title: 'No percent on record' },
}

/** The folded line under the rows: the jobs with nothing on them yet. */
export function scoreboardFoldWords(n: number): string {
  return `Nothing on them yet · ${n} ${n === 1 ? 'job' : 'jobs'}`
}

/** One line about the site right now: the job it names, its number, and the words after the number. */
export type ScoreboardHeadline = { jobId: string; label: string; after: string }

/** The headline as one sentence: the job's number, then the words. */
export function scoreboardHeadlineWords(h: ScoreboardHeadline): string {
  return `${h.label}${h.after}`
}

const biggest = <T,>(rows: ReadonlyArray<T>, by: (r: T) => number): T | undefined => rows.reduce<T | undefined>((best, r) => (best === undefined || by(r) > by(best) ? r : best), undefined)

/**
 * The match headline (v2.6467, punch list #250 PR 3): one line about the site right now, under *Right now* in the
 * board's flag block. On the full board, a job with no price that is costing comes first, the costliest of them;
 * else the job that carried the site, the most profit, leaving out a job whose earned dollars are the assumed half;
 * else the job that has cost the most past what it earned. The leader's board reads no cost, so its line speaks in
 * hours and earned dollars: a job with no price that has hours on it, else the job that earned the most. Null until
 * the reads the line stands on are in, and when there is nothing to say, so the line never names a job on half a read.
 */
export function scoreboardHeadline(model: ScoreboardModel, seesCosts: boolean): ScoreboardHeadline | null {
  const line = (r: ScoreboardJob, after: string): ScoreboardHeadline => ({ jobId: r.jobId, label: r.label, after })
  const sure = model.rows.filter((r) => !r.flags.includes('assumed-50'))
  if (seesCosts) {
    if (scoreboardCellStands('profit', model.reads) !== 'stands') return null
    const noPrice = biggest(model.rows.filter((r) => !r.priced && r.m.cost > 0), (r) => r.m.cost)
    if (noPrice) return line(noPrice, ` has no price yet: ${scoreboardUsd(noPrice.m.cost)} spent${noPrice.m.hours > 0 ? ` over ${scoreboardHours(noPrice.m.hours)}` : ''}.`)
    const carried = biggest(sure.filter((r) => r.m.profit > 0), (r) => r.m.profit)
    if (carried) return line(carried, ` carried the site: ${scoreboardUsd(carried.m.profit)} profit, ${scoreboardPctOf(carried.m.profit, carried.m.earned)} of what it earned.`)
    const losing = biggest(model.rows.filter((r) => r.m.profit < 0), (r) => -r.m.profit)
    return losing ? line(losing, ` has cost ${scoreboardUsd(-losing.m.profit)} more than it earned.`) : null
  }
  if (model.reads.labor !== 'read') return null
  const noPrice = biggest(model.rows.filter((r) => !r.priced && r.m.hours > 0), (r) => r.m.hours)
  if (noPrice) return line(noPrice, ` has no price yet: ${scoreboardHours(noPrice.m.hours)} on it.`)
  const carried = biggest(sure.filter((r) => r.m.earned > 0), (r) => r.m.earned)
  return carried ? line(carried, ` carried the site: ${scoreboardUsd(carried.m.earned)} earned, ${scoreboardPctOf(carried.m.earned, model.site.earned)} of the site.`) : null
}

/** The site's second margin, with materials-only jobs set aside (call 7). */
export function scoreboardWorkWords(work: ScoreboardModel['work']): string | null {
  return work && work.earned > 0 ? `${scoreboardPctOf(work.profit, work.earned)} on work` : null
}

// ---- the rows under an open job (v2.6457, punch list #250 PR 2) ---------------------------------

export type ScoreboardMemberKind = 'lead' | 'crew' | 'sub' | 'supplier' | 'card' | 'bank' | 'tally' | 'other' | 'overhead' | 'office'

/** The role tag in the margin, the game's SL and FTL in the app's words. */
export const SCOREBOARD_MEMBER_ROLE: Record<ScoreboardMemberKind, string> = {
  lead: 'Lead',
  crew: 'Crew',
  sub: 'Sub',
  supplier: 'Supplier',
  card: 'Card',
  bank: 'Bank',
  tally: 'Tally',
  other: 'Other',
  overhead: 'Overhead',
  office: 'Office',
}

export type ScoreboardMemberMeasures = Partial<Pick<ScoreboardMeasures, 'hours' | 'days' | 'labor' | 'subs' | 'parts' | 'overhead'>>

export type ScoreboardMember = {
  key: string
  kind: ScoreboardMemberKind
  name: string
  /** The small words beside the name: *led 12 of 74 days*, *2 sheets*, *11 invoices*, *34 charges*. */
  kit: string | null
  /** The cells this row fills besides Cost: a person's hours, days and labor; a sub's subs; a house's or a card's parts. */
  m: ScoreboardMemberMeasures
  /** What this row put into the job's Cost; null on the office line and on the lead's board. */
  cost: number | null
  /** That cost's share of the job's Cost, 0 to 1; null with no cost. */
  share: number | null
  /** The office line's words, in place of figures. */
  words: string | null
  /** The viewer's own row: gold. */
  you: boolean
}

export type ScoreboardViewer = { userId: string | null; name: string | null }

export type ScoreboardMembersInput = {
  jobId: string
  /** The job's Cost on the board: the shares' whole. */
  jobCost: number
  /** Dev and controller: every kind with its dollars. Otherwise the people with hours and days alone. */
  seesCosts: boolean
  labor?: SiteLaborRead
  costs?: SiteCostsRead
  overhead?: SiteOverheadRead
  cardHolders?: CardHoldersRead
  invoices: ReadonlyArray<{ job_id: string; sent_by_user_id?: string | null }>
  payments: ReadonlyArray<{ job_id: string; created_by?: string | null }>
  names: ReadonlyMap<string, string>
  viewer: ScoreboardViewer
}

export type ScoreboardMembers = {
  members: ScoreboardMember[]
  /** A read the rows still wait on, or one that would not read; the rows under the job say so in one line. */
  pending: 'reading' | 'failed' | null
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const sameName = (a: string | null | undefined, b: string | null | undefined) => !!a?.trim() && !!b?.trim() && a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Everyone and everything that put something into one job, each filling Cost with what it put in so
 * the rows add up to the job: the people from the clock (a *Lead* led the crew on at least one of the
 * days), the subs by the names on their sheets, the supply houses, the card holders and the bank's
 * payments with no card on them, the tally, the
 * other charges and the overhead day share, then the office line (who sent the bills and booked the
 * payments, words only). A supply or card split that falls short of its total (an allocation read cut
 * at its limit, the card rule's clamp, a card read that failed) gets one reconciling row, so the sum
 * holds. The lead's board lists the people with hours and days and nothing else. Pure.
 */
export function scoreboardMembers(i: ScoreboardMembersInput): ScoreboardMembers {
  let pending: ScoreboardMembers['pending'] = null
  const note = (state: ScoreboardReadState) => {
    if (state === 'failed') pending = 'failed'
    else if (state === 'reading' && pending !== 'failed') pending = 'reading'
  }
  const share = (usd: number) => (i.jobCost > 0 ? Math.max(0, usd) / i.jobCost : null)
  const money = (kind: ScoreboardMemberKind, key: string, name: string, kit: string | null, m: ScoreboardMemberMeasures, usd: number, you = false): ScoreboardMember => ({
    key: `${kind}:${key}`,
    kind,
    name,
    kit,
    m,
    cost: round2(usd),
    share: share(usd),
    words: null,
    you,
  })

  // The people, from the clock: leads first, then the crew, each by hours.
  note(readStateOf(i.labor))
  const lj = i.labor?.state === 'read' ? i.labor.labor.byJobId.get(i.jobId) : undefined
  const daysKnown = i.labor?.state === 'read' ? i.labor.labor.daysKnown : true
  const people: ScoreboardMember[] = (lj?.people ?? []).map((p): ScoreboardMember => {
    const lead = daysKnown && p.leadDays > 0
    const you = (i.viewer.userId != null && p.userId === i.viewer.userId) || (p.userId == null && sameName(p.personName, i.viewer.name))
    const kit = lead ? `led ${p.leadDays} of ${plural(p.days, 'day', 'days')}` : null
    const effort = daysKnown ? { hours: p.hours, days: p.days } : { hours: p.hours }
    if (!i.seesCosts) return { key: `person:${p.personId ?? p.personName}`, kind: lead ? 'lead' : 'crew', name: p.personName, kit, m: effort, cost: null, share: null, words: null, you }
    return { ...money(lead ? 'lead' : 'crew', p.personId ?? p.personName, p.personName, kit, { ...effort, labor: round2(p.costUsd) }, p.costUsd, you), key: `person:${p.personId ?? p.personName}` }
  })
  people.sort((a, b) => Number(b.kind === 'lead') - Number(a.kind === 'lead') || (b.m.hours ?? 0) - (a.m.hours ?? 0) || a.name.localeCompare(b.name))
  if (!i.seesCosts) return { members: people, pending }

  const out: ScoreboardMember[] = [...people]
  note(readStateOf(i.costs))
  const row = i.costs?.state === 'read' ? i.costs.byJobId.get(i.jobId) : undefined
  if (row) {
    const b = row.breakdown
    for (const sub of b.subs) out.push(money('sub', sub.name, sub.name, plural(sub.sheets, 'sheet', 'sheets'), { subs: round2(sub.usd) }, sub.usd))
    let houses = 0
    for (const h of b.suppliers) {
      houses += h.usd
      out.push(money('supplier', h.name, h.name, plural(h.invoices, 'invoice', 'invoices'), { parts: round2(h.usd) }, h.usd))
    }
    const supplyGap = round2(row.parts.supplyInvoices - houses)
    if (Math.abs(supplyGap) >= 0.01) out.push(money('supplier', 'gap', 'Other supply invoices', null, { parts: supplyGap }, supplyGap))
    // The card charges by holder once that read is in, the bank's payments with no card on them as one Bank row;
    // until then, or if it will not read, one row for the card.
    const holders = i.cardHolders?.state === 'read' ? i.cardHolders.byTxId : null
    const byHolder = new Map<string, { name: string; bank: boolean; usd: number; n: number; userId: string | null }>()
    for (const l of b.cardLines) {
      const h = holders && l.txId ? holders.get(l.txId) : undefined
      const name = h?.name ?? 'Card'
      const bank = h?.bank === true
      const key = `${bank ? 'bank' : 'card'}:${name}`
      const cur = byHolder.get(key) ?? { name, bank, usd: 0, n: 0, userId: h?.userId ?? null }
      cur.usd += l.usd
      cur.n += 1
      if (!cur.userId && h?.userId) cur.userId = h.userId
      byHolder.set(key, cur)
    }
    let cards = 0
    for (const c of [...byHolder.values()].sort((x, y) => y.usd - x.usd)) {
      cards += c.usd
      const kit = c.bank ? plural(c.n, 'payment', 'payments') : plural(c.n, 'charge', 'charges')
      out.push(money(c.bank ? 'bank' : 'card', c.name, c.name, kit, { parts: round2(c.usd) }, c.usd, i.viewer.userId != null && c.userId === i.viewer.userId))
    }
    const cardGap = round2(row.parts.cardCharges - cards)
    if (Math.abs(cardGap) >= 0.01) out.push(money('card', 'gap', 'Card charges not split', null, { parts: cardGap }, cardGap))
    if (row.parts.tallyParts) out.push(money('tally', 'tally', 'The tally', plural(b.tallyLines, 'line', 'lines'), { parts: round2(row.parts.tallyParts) }, row.parts.tallyParts))
    if (row.parts.otherCharges) out.push(money('other', 'other', 'Other job charges', plural(b.otherLines, 'line', 'lines'), { parts: round2(row.parts.otherCharges) }, row.parts.otherCharges))
  }
  note(readStateOf(i.overhead))
  const o = i.overhead?.state === 'read' ? i.overhead.byJobId.get(i.jobId) : undefined
  if (o && o.usd) out.push(money('overhead', 'day-share', 'Day share', `${plural(o.days, 'day', 'days')} charged`, { overhead: round2(o.usd) }, o.usd))

  // The office line: who sent the bills and who booked the payments, by person.
  const acts = new Map<string, { bills: number; payments: number }>()
  for (const inv of i.invoices) if (inv.job_id === i.jobId && inv.sent_by_user_id) acts.set(inv.sent_by_user_id, { bills: (acts.get(inv.sent_by_user_id)?.bills ?? 0) + 1, payments: acts.get(inv.sent_by_user_id)?.payments ?? 0 })
  for (const pay of i.payments) if (pay.job_id === i.jobId && pay.created_by) acts.set(pay.created_by, { bills: acts.get(pay.created_by)?.bills ?? 0, payments: (acts.get(pay.created_by)?.payments ?? 0) + 1 })
  const office = [...acts.entries()]
    .sort((x, y) => y[1].bills + y[1].payments - (x[1].bills + x[1].payments))
    .map(([userId, a]): ScoreboardMember => ({
      key: `office:${userId}`,
      kind: 'office',
      name: i.names.get(userId)?.trim() || 'Someone in the office',
      kit: null,
      m: {},
      cost: null,
      share: null,
      words: [a.bills ? `sent ${plural(a.bills, 'bill', 'bills')}` : null, a.payments ? `booked ${plural(a.payments, 'payment', 'payments')}` : null].filter(Boolean).join(' · '),
      you: i.viewer.userId != null && userId === i.viewer.userId,
    }))
  out.push(...office)
  return { members: out, pending }
}

/** The one line under an open job while its rows wait, or when one would not read. */
export function scoreboardPendingWords(pending: ScoreboardMembers['pending']): string | null {
  if (pending === 'reading') return 'Some rows are still reading.'
  if (pending === 'failed') return 'A source would not read. The Job window has these rows.'
  return null
}

/** The line under an open job with no row at all. */
export function scoreboardNoMembersWords(seesCosts: boolean): string {
  return seesCosts ? 'Nothing is on this job yet.' : 'No hours are on this job yet.'
}
