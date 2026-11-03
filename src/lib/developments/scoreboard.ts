/**
 * The Scoreboard (v2.6407, punch list #250): the Money look's second view, the game Squad's
 * end-of-match board in the app's clothes. One grid where the same nine columns mean the same
 * thing at every level: the site's totals are the column heads, a row is a job, and (PR 2) the
 * rows under an open job are the people, subs, supply houses, the card and the overhead day share,
 * each filling Cost with what it put in so they sum to the job. A folded row shows the three that
 * matter most, Earned · Cost · Profit; opened, all nine. Green is effort, red is what it cost, gold
 * is the money. Earned is Job Summary's rule (`jobEarned`), the costs are the Jobs & bids table's
 * (`siteCosts.ts`), hours and days the clock's (`siteLabor.ts`), overhead the day share. Pure: the
 * component draws, the hooks read.
 */
import { jobSummaryPaidInvoiceOpts, resolveJobSummaryPercentCompleteWithSource, type JobSummaryPercentSource } from '../jobSummaryPercentComplete'
import { jobEarned } from '../jobs/jobEarned'
import { normalizeJobsLedgerStatus, type JobsLedgerPipelineStatus } from '../jobsLedgerStatusPipeline'
import type { MemberJob } from './overview'
import type { SiteCostsRead } from './siteCosts'
import type { SiteLaborRead } from './siteLabor'

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

export function scoreboardColumnsFor(seesCosts: boolean): ReadonlyArray<ScoreboardColumn> {
  return seesCosts ? SCOREBOARD_COLUMNS : SCOREBOARD_COLUMNS.filter((c) => SCOREBOARD_LEAD_COLUMNS.includes(c.key))
}

/** What a folded row shows for a set of columns: the money three on the full board, every column on the lead's. */
export function scoreboardFoldedKeys(columns: ReadonlyArray<ScoreboardColumn>): ReadonlySet<ScoreboardColumnKey> {
  return new Set(columns.length === SCOREBOARD_COLUMNS.length ? SCOREBOARD_FOLDED : columns.map((c) => c.key))
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

export type SiteOverheadRead = { state: 'off' } | { state: 'reading' } | { state: 'read'; byJobId: ReadonlyMap<string, { usd: number; days: number }> } | { state: 'failed' }

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
  m: ScoreboardMeasures
  /** No earned dollar and no cost: folded under *Nothing on them yet*. */
  empty: boolean
}

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
}

export type ScoreboardInput = {
  jobs: ReadonlyArray<MemberJob>
  invoices: ReadonlyArray<{ job_id: string; amount: number; status: string }>
  jobLabel: (job: MemberJob) => string
  labor?: SiteLaborRead
  costs?: SiteCostsRead
  overhead?: SiteOverheadRead
  sort?: ScoreboardSort
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
export function scoreboardPct(job: MemberJob, invoices: ReadonlyArray<{ amount: number; status: string }>): { pct: number | null; source: ScoreboardPctSource } {
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
  const all: ScoreboardJob[] = input.jobs.map((job) => {
    const contractUsd = Number(job.revenue) || 0
    const { pct, source } = scoreboardPct(job, invoicesByJob.get(job.id) ?? [])
    const finished = pct === 100
    const earned = jobEarned({ contractUsd, pct, finished })
    const l = laborBy?.get(job.id)
    const c = costsBy?.get(job.id)
    const o = overheadBy?.get(job.id)
    const m: ScoreboardMeasures = {
      hours: l?.hours ?? 0,
      days: l?.days ?? 0,
      labor: round2(l?.costUsd ?? 0),
      subs: round2(c?.subLabor ?? 0),
      parts: round2(c ? c.parts.supplyInvoices + c.parts.cardCharges + c.parts.tallyParts + c.parts.otherCharges : 0),
      overhead: round2(o?.usd ?? 0),
      earned: round2(earned.usd),
      cost: 0,
      profit: 0,
    }
    m.cost = round2(m.labor + m.subs + m.parts + m.overhead)
    m.profit = round2(m.earned - m.cost)
    const flags: ScoreboardFlag[] = []
    if (!(contractUsd > 0) && m.cost > 0) flags.push('no-price')
    const materialsOnly = job.billing_only === true || (laborBy != null && costsBy != null && m.earned > 0 && m.hours === 0 && m.subs === 0 && m.parts > 0)
    if (materialsOnly) flags.push('materials-only')
    if (earned.flags.includes('assumed-50')) flags.push('assumed-50')
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
      m,
      empty: m.earned === 0 && m.cost === 0,
    }
  })
  const dir = sort.desc ? -1 : 1
  const byLabel = (a: ScoreboardJob, b: ScoreboardJob) => a.label.localeCompare(b.label, undefined, { numeric: true })
  const sorted = [...all].sort((a, b) => dir * (a.m[sort.key] - b.m[sort.key]) || byLabel(a, b))
  const rows = sorted.filter((r) => !r.empty)
  const empties = sorted.filter((r) => r.empty)
  const site: ScoreboardMeasures = { ...ZERO }
  for (const r of all) for (const k of Object.keys(site) as ScoreboardColumnKey[]) site[k] = round2(site[k] + r.m[k])
  // Days are counted once each across the site, not summed over jobs: the clock read knows the site's days.
  site.days = input.labor?.state === 'read' ? input.labor.labor.siteDays : 0
  const setAside = rows.filter((r) => r.flags.includes('materials-only'))
  const work =
    setAside.length > 0
      ? rows.filter((r) => !r.flags.includes('materials-only')).reduce((acc, r) => ({ earned: round2(acc.earned + r.m.earned), profit: round2(acc.profit + r.m.profit), jobs: acc.jobs + 1 }), { earned: 0, profit: 0, jobs: 0 })
      : null
  return { site, work, rows, empties, reads, sort, people: input.labor?.state === 'read' ? input.labor.labor.people : 0 }
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

/** The site's second margin, with materials-only jobs set aside (call 7). */
export function scoreboardWorkWords(work: ScoreboardModel['work']): string | null {
  return work && work.earned > 0 ? `${scoreboardPctOf(work.profit, work.earned)} on work alone` : null
}
