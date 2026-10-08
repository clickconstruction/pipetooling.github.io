/**
 * GC mode, the Dashboard's Follow up line (Helper 6, after door 2; the plan is
 * to-dos/gc-mode/mockups/follow-up-needs-you.md on branch spike/gc-mode). Follow up's count as one
 * Needs you line, so the pill on /gc, the Follow up view and the Dashboard say one number (the
 * owner, 2026-10-04: "make them match").
 *
 * The Dashboard does not load the whole board. It reads a slice of the board's rows
 * (`FollowUpSlice`, read by `followUpNeedsIo.ts`), and the Board's own mappers turn the slice into
 * the state `followUps` reads, so the rule that picks who to call lives in one place.
 */
import { boardStateFromRows, type CompanyRow, type ContactRow, type InviteRow, type QuoteRow } from './boardRows'
import { askPromise, followUps, type FollowUp } from './followUp'
import { gcProjectFromRows, type GcProjectRows } from './projectRows'
import type { GcState } from './types'
import { daysUntil } from './words'

export interface GcFollowUpNeeds {
  /** The asks to call: Follow up's pill. */
  count: number
  /** A promised day passed, or an ask sat unopened past three days: red, not amber. */
  late: boolean
  title: string
  detail: string
}

/** The rows the Dashboard reads for the line: the projects, their trades, the asks on them and the companies asked. */
export interface FollowUpSlice {
  today: string
  gc: (GcProjectRows['gc'] & { project_id: string })[]
  projects: GcProjectRows['project'][]
  packages: (GcProjectRows['packages'][number] & { project_id: string })[]
  companies: CompanyRow[]
  invites: InviteRow[]
  quotes: QuoteRow[]
  contacts: ContactRow[]
}

/** The slice as the Board's kernels read it. What Follow up does not read (scope, plans, promises, money) stays empty. */
export function followUpStateFromSlice(slice: FollowUpSlice): GcState {
  const projects = slice.gc.flatMap((gc) => {
    const project = slice.projects.find((p) => p.id === gc.project_id)
    if (!project) return []
    const packages = slice.packages.filter((p) => p.project_id === gc.project_id)
    return [gcProjectFromRows({ project, gc, packages, scopeItems: [], exclusions: [], sets: [], setItems: [], questions: [] })]
  })
  return boardStateFromRows({
    today: slice.today,
    projects,
    boardDates: {},
    customers: [],
    companies: slice.companies,
    invites: slice.invites,
    quotes: slice.quotes,
    contacts: slice.contacts,
    promises: [],
    promiseMoves: [],
  })
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** One ask to call, in a sentence of its own. */
function reasonWords(f: FollowUp, today: string): string {
  const c = f.partner.company
  if (f.why === 'passed') return `${c} is ${plural(askPromise(f.invite, today)?.days ?? 0, 'day', 'days')} past the day it gave for its quote.`
  if (f.why === 'today') return `${c} promised its quote today.`
  if (f.why === 'silent') return `${c} has not opened the ask we sent ${plural(daysUntil(today, f.invite.invitedOn), 'day', 'days')} ago.`
  return `${c} has the plans and gave no day for its quote.`
}

/** The line, or null when nobody waits on a call: the count is `followUpsToCall`'s, the reasons in Follow up's order. */
export function gcFollowUpNeeds(state: GcState): GcFollowUpNeeds | null {
  const calls = followUps(state).filter((f) => f.why !== 'waiting')
  if (calls.length === 0) return null
  const shown = calls.slice(0, 2).map((f) => reasonWords(f, state.today))
  const more = calls.length - shown.length
  return {
    count: calls.length,
    late: calls.some((f) => f.why === 'passed' || f.why === 'silent'),
    title: calls.length === 1 ? 'A call to make about a quote' : `${calls.length} calls to make about quotes`,
    detail: [...shown, ...(more > 0 ? [`And ${more} more.`] : []), 'Next: call them from Follow up.'].join(' '),
  }
}
