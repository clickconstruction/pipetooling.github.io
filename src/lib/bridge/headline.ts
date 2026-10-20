import type { VectorGrid } from './vectorDays'

/**
 * The Bridge's top line (v2.5216): the number the company maximizes — field
 * contribution per pay week (earned at contract ÷ expected hours, less wages)
 * — over the last eight pay weeks, with a verdict sentence, and the two
 * constraints the owner set beside it as lights: net position rises over the
 * window, and cash never goes under the floor.
 *
 * Reads two grids of the Weeks zoom over the same range: recorded time (every
 * closed session, pending ones too) and approved time (what payroll paid).
 * The headline is recorded, marked ≈ where hours still wait, so a late
 * approval pile does not read as a slow field. Pure: no React, no Supabase.
 */

export const HEADLINE_WEEKS = 8
/** A week whose pending hours are at least this share of its recorded hours reads as waiting. */
export const HEADLINE_WAITING_SHARE = 0.25

export type HeadlineWeek = {
  start: string
  end: string
  /** "Aug 16" */
  label: string
  current: boolean
  /** Contribution on recorded time; null when no field hours. */
  recordedUsd: number | null
  /** Contribution on approved time; null when no approved field hours. */
  approvedUsd: number | null
  recordedHours: number
  approvedHours: number
  pendingHours: number
  /** Enough hours still wait that the week's number is not settled. */
  waiting: boolean
}

export type HeadlineTrend = 'readable' | 'waiting' | 'thin'

export type Headline = {
  weeks: HeadlineWeek[]
  thisWeek: HeadlineWeek
  trend: HeadlineTrend
  verdict: string
  /** Lowest and highest settled week, for the verdict and the bars. */
  settled: { lowUsd: number; highUsd: number; count: number } | null
}

const num = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** "$41.5k", "$8k", "−$2.0k" — the page's short form. */
export function shortK(n: number): string {
  const abs = Math.abs(n)
  const body = abs >= 100_000 ? `${(abs / 1000).toFixed(0)}k` : abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : `${Math.round(abs)}`
  return `${n < 0 ? '−' : ''}$${body}`
}

const hrs = (h: number): string => `${Math.round(h).toLocaleString('en-US')}h`
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const weekLabel = (ymd: string): string => `${MONTHS[Number(ymd.slice(5, 7)) - 1] ?? ''} ${Number(ymd.slice(8, 10))}`

export function buildHeadline(input: { recorded: VectorGrid; approved: VectorGrid; weeks?: number }): Headline {
  const count = input.weeks ?? HEADLINE_WEEKS
  const cols = input.recorded.columns
  const weeks: HeadlineWeek[] = []
  for (let i = Math.max(0, cols.length - count); i < cols.length; i++) {
    const col = cols[i]
    if (!col || col.future) continue
    const r = input.recorded.company.cells[i] ?? null
    const a = input.approved.company.cells[i] ?? null
    const recordedHours = num(r?.fieldHours)
    const pendingHours = num(r?.pendingHours)
    const allRecorded = recordedHours + num(r?.officeBidHours)
    weeks.push({
      start: col.start,
      end: col.end,
      label: weekLabel(col.start),
      current: col.end >= input.recorded.todayYmd,
      recordedUsd: r?.contributionUsd ?? null,
      approvedUsd: a?.contributionUsd ?? null,
      recordedHours,
      approvedHours: num(a?.fieldHours),
      pendingHours,
      waiting: allRecorded > 0 && pendingHours / allRecorded >= HEADLINE_WAITING_SHARE,
    })
  }
  const last = weeks[weeks.length - 1]
  const thisWeek: HeadlineWeek = last ?? { start: input.recorded.end, end: input.recorded.end, label: weekLabel(input.recorded.end), current: true, recordedUsd: null, approvedUsd: null, recordedHours: 0, approvedHours: 0, pendingHours: 0, waiting: false }
  const closed = weeks.filter((w) => !w.current)
  const settledWeeks = closed.filter((w) => !w.waiting && w.recordedUsd != null)
  const settled = settledWeeks.length > 0 ? { lowUsd: Math.min(...settledWeeks.map((w) => w.recordedUsd ?? 0)), highUsd: Math.max(...settledWeeks.map((w) => w.recordedUsd ?? 0)), count: settledWeeks.length } : null

  if (!weeks.some((w) => w.recordedHours > 0)) {
    return { weeks, thisWeek, trend: 'thin', verdict: `No field hours on record in the last ${count} pay weeks, so there is no contribution to read yet.`, settled }
  }

  // Trailing weeks that still wait on approvals, the current week among them.
  const trailingWaiting: HeadlineWeek[] = []
  for (let i = weeks.length - 1; i >= 0; i--) {
    const w = weeks[i]
    if (w && (w.waiting || (w.current && w.pendingHours > 0))) trailingWaiting.push(w)
    else break
  }
  const waitingClosed = trailingWaiting.filter((w) => !w.current)
  if (waitingClosed.length > 0) {
    const pend = trailingWaiting.reduce((s, w) => s + w.pendingHours, 0)
    const approved = trailingWaiting.map((w) => w.approvedUsd ?? 0)
    const ran = settled ? `Contribution ran ${shortK(settled.lowUsd)} to ${shortK(settled.highUsd)} a week over the ${settled.count} settled ${settled.count === 1 ? 'week' : 'weeks'}.` : 'No week in the window is settled yet.'
    const n = trailingWaiting.length
    const read = approved.length > 0 ? `${shortK(Math.min(...approved))} to ${shortK(Math.max(...approved))}` : '$0'
    return { weeks, thisWeek, trend: 'waiting', verdict: `${ran} The last ${n} ${n === 1 ? 'week reads' : 'weeks read'} ${read} on approved time only because ${hrs(pend)} still wait on approval, not because the field slowed.`, settled }
  }

  const recent = closed.slice(-4)
  const before = closed.slice(-8, -4)
  const avg = (ws: HeadlineWeek[]): number => (ws.length ? ws.reduce((s, w) => s + num(w.recordedUsd), 0) / ws.length : 0)
  let verdict = settled ? `Contribution ran ${shortK(settled.lowUsd)} to ${shortK(settled.highUsd)} a week over the last ${closed.length} ${closed.length === 1 ? 'week' : 'weeks'}.` : ''
  if (recent.length === 4 && before.length === 4) {
    const diff = avg(recent) - avg(before)
    verdict += ` The last four average ${shortK(avg(recent))} a week, ${diff >= 0 ? 'up' : 'down'} ${shortK(Math.abs(diff))} on the four before.`
  } else if (recent.length > 0) {
    verdict += ` The last ${recent.length === 1 ? 'week' : `${recent.length} weeks`} average ${shortK(avg(recent))} a week.`
  }
  if (thisWeek.current && thisWeek.recordedUsd != null) verdict += ` This week is ${shortK(thisWeek.recordedUsd)} so far${thisWeek.pendingHours > 0 ? ` with ${hrs(thisWeek.pendingHours)} still waiting` : ''}.`
  return { weeks, thisWeek, trend: 'readable', verdict: verdict.trim(), settled }
}

// ---- the two constraints as lights ----

export type Light = { tone: 'green' | 'red' | 'amber' | 'none'; title: string; lead: string; sentence: string }

/** Constraint 1: net position (cash + owed to you − owed by you) rises over the window. */
export function netPositionLight(input: { deltaUsd: number | null; todayUsd: number | null; startLabel: string; paperProfitUsd: number | null; billingLagUsd: number | null } | null): Light {
  const title = 'Net position rises over 8 weeks'
  if (!input || input.deltaUsd == null) return { tone: 'none', title, lead: 'not read yet', sentence: 'Type cash on hand to anchor the line.' }
  const up = input.deltaUsd >= 0
  const lead = `${up ? 'up' : 'down'} ${shortK(Math.abs(input.deltaUsd))} since ${input.startLabel}`
  const parts: string[] = []
  if (input.paperProfitUsd != null) parts.push(`Paper profit over the same weeks is ${input.paperProfitUsd >= 0 ? '+' : '−'}${shortK(Math.abs(input.paperProfitUsd))}.`)
  if (input.billingLagUsd != null && input.billingLagUsd > 0) parts.push(`${shortK(input.billingLagUsd)} is earned but not invoiced. Bill it to see it.`)
  if (up) parts.unshift(`The line is ${shortK(num(input.todayUsd))} today.`)
  return { tone: up ? 'green' : 'red', title, lead, sentence: parts.join(' ') }
}

/** Constraint 2: cash never goes under the floor, read from the forecast's lowest point. */
export function cashLight(input: { lowestUsd: number; lowestLabel: string; floorUsd: number; clearsFloor: boolean; daysUnderFloor: number; typedLabel: string | null; typedDaysAgo: number | null; /** Cash on hand came from the bank today (v2.5218), so no typed caveat. */ synced?: boolean } | null): Light {
  const title = 'Cash stays above the floor'
  if (!input) return { tone: 'none', title, lead: 'not read yet', sentence: 'Type cash on hand to start the forecast.' }
  const lead = `lowest point ${shortK(input.lowestUsd)} on ${input.lowestLabel}`
  const stale = !input.synced && input.typedDaysAgo != null && input.typedDaysAgo >= 7
  const typed = input.synced ? " Cash on hand is today's bank balance." : input.typedLabel ? ` Cash on hand was typed ${input.typedLabel}${input.typedDaysAgo != null && input.typedDaysAgo > 0 ? `, ${input.typedDaysAgo} day${input.typedDaysAgo === 1 ? '' : 's'} ago` : ''}.` : ''
  if (input.clearsFloor) return { tone: stale ? 'amber' : 'green', title, lead, sentence: `Above the ${shortK(input.floorUsd)} floor every day of the window.${typed}` }
  return { tone: 'red', title, lead, sentence: `${shortK(input.floorUsd - input.lowestUsd)} under the ${shortK(input.floorUsd)} floor, ${input.daysUnderFloor} day${input.daysUnderFloor === 1 ? '' : 's'} below it.${typed}` }
}
