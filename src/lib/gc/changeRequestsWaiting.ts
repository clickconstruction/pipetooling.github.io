/**
 * GC mode, the real build: the change requests waiting on us, for the dashboard's Needs you line (the Board's B2b), moved
 * word for word from the GC mode prototype (branch spike/gc-mode, `gcChangeRequestsWaiting.ts`) by the Portal lane's
 * P4b-iii.
 */
import { partnerById } from './lookups'
import { openChangeRequests } from './portal'
import type { GcProject, GcState, TradeChangeRequest } from './types'
import { daysUntil, money } from './words'

/** A request waits this many days before it reads late. */
export const CHANGE_REQUEST_LATE_DAYS = 7

export interface WaitingChangeRequest {
  project: GcProject
  request: TradeChangeRequest
  company: string
  trade: string
  /** Days since they asked. */
  waited: number
}

/** Every request waiting on us, oldest first, on jobs still open. */
export function changeRequestsWaiting(state: GcState): WaitingChangeRequest[] {
  return state.projects
    .filter((p) => !p.closedOn && !p.lostOn)
    .flatMap((project) =>
      openChangeRequests(project).map((request) => ({
        project,
        request,
        company: partnerById(state, request.partnerId)?.company ?? 'A trade',
        trade: project.packages.find((k) => k.id === request.packageId)?.trade ?? '',
        waited: Math.max(0, -daysUntil(request.askedOn, state.today)),
      })),
    )
    .sort((a, b) => b.waited - a.waited)
}

/** "Tri-County Site asked for a change: rock in the pad, $14,820. Answer it on Bill the customer." */
export function changeRequestLine(w: WaitingChangeRequest): string {
  const what = w.request.description.replace(/\.$/, '')
  const since = w.waited === 0 ? 'today' : w.waited === 1 ? 'yesterday' : `${w.waited} days ago`
  return `${w.company} asked for a change ${since}: ${what}, ${money(w.request.amount)}. Answer it on Bill the customer.`
}

/** The ring card's lines for one job. */
export function changeRequestLinesFor(state: GcState, project: GcProject): string[] {
  return changeRequestsWaiting(state)
    .filter((w) => w.project.id === project.id)
    .map(changeRequestLine)
}

export interface GcChangeRequestsNeedsYou {
  count: number
  late: boolean
  title: string
  detail: string
  /** The job the oldest is on: Answer opens it on Bill the customer. */
  projectId: string
}

/** The dashboard's line, or null when nothing waits on us. */
export function gcChangeRequestsNeedsYou(state: GcState): GcChangeRequestsNeedsYou | null {
  const waiting = changeRequestsWaiting(state)
  const first = waiting[0]
  if (!first) return null
  const n = waiting.length
  const shown = waiting.slice(0, 2).map((w) => `${w.company} asked for ${money(w.request.amount)} on ${w.project.name}`)
  return {
    count: n,
    late: waiting.some((w) => w.waited > CHANGE_REQUEST_LATE_DAYS),
    title: `${n} change ${n === 1 ? 'request' : 'requests'} waiting on you in GC mode`,
    detail: `${shown.join(' · ')}${n > 2 ? ` · and ${n - 2} more` : ''}. A trade asked from its portal; make it a change order or turn it down.`,
    projectId: first.project.id,
  }
}
