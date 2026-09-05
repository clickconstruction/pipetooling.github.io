/**
 * Pure kernel for the Job Mode Inbox "My requests" strip (journey-map Tier-2
 * #25, J2-F4): the tech's own `dispatch_requests` rows, split into what's
 * still waiting on Dispatch and what the office has answered — with the
 * office's closing note shown as "Office answered: …". This replaces the
 * Settings push-log component that Job Mode Inbox used to mount verbatim
 * ("No push notifications have been logged").
 */
import { formatDispatchNoteDaysAgoShortPhrase } from '../utils/dispatchNoteDisplay'

export type MyDispatchRequestRow = {
  id: string
  title: string
  status: 'open' | 'closed'
  created_at: string | null
  closed_at: string | null
  closed_note: string | null
  closed_by: { name: string | null } | null
  pending_action: string | null
}

export type MyDispatchRequestView = {
  id: string
  state: 'open' | 'answered'
  title: string
  /** One scan line: "Waiting on Dispatch · 3d ago" / "Office answered (Maria) · today". */
  headline: string
  /** The office's closing note, trimmed; null while open or when the closer left none. */
  answer: string | null
}

/** Answered rows shown before the strip collapses to a count. */
export const MY_DISPATCH_REQUESTS_ANSWERED_CAP = 10

export const MY_DISPATCH_REQUESTS_COPY = {
  heading: 'My requests',
  openHeading: 'Waiting on Dispatch',
  answeredHeading: 'Answered',
  answeredPrefix: 'Office answered',
  waitingPrefix: 'Waiting on Dispatch',
  empty: 'Nothing sent to Dispatch yet. The red phone or photos icon on a job card sends a request; answers land here.',
  noNote: 'Marked done — no note.',
} as const

export function summarizeMyDispatchRequest(row: MyDispatchRequestRow, now: Date = new Date()): MyDispatchRequestView {
  const title = row.title.trim() || 'Request'
  if (row.status === 'closed') {
    const by = row.closed_by?.name?.trim()
    const when = row.closed_at ?? row.created_at
    const age = when ? ` · ${formatDispatchNoteDaysAgoShortPhrase(when, now)}` : ''
    return {
      id: row.id,
      state: 'answered',
      title,
      headline: `${MY_DISPATCH_REQUESTS_COPY.answeredPrefix}${by ? ` (${by})` : ''}${age}`,
      answer: row.closed_note?.trim() || null,
    }
  }
  const age = row.created_at ? ` · ${formatDispatchNoteDaysAgoShortPhrase(row.created_at, now)}` : ''
  return {
    id: row.id,
    state: 'open',
    title,
    headline: `${MY_DISPATCH_REQUESTS_COPY.waitingPrefix}${age}`,
    answer: null,
  }
}

/**
 * Open rows newest-first, answered rows newest-closed-first (capped), plus how
 * many answered rows the cap hid.
 */
export function splitMyDispatchRequests(
  rows: ReadonlyArray<MyDispatchRequestRow>,
  now: Date = new Date(),
  answeredCap: number = MY_DISPATCH_REQUESTS_ANSWERED_CAP,
): { open: MyDispatchRequestView[]; answered: MyDispatchRequestView[]; answeredHidden: number } {
  const open = rows
    .filter((r) => r.status === 'open')
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .map((r) => summarizeMyDispatchRequest(r, now))
  const answeredAll = rows
    .filter((r) => r.status === 'closed')
    .sort((a, b) => (b.closed_at ?? b.created_at ?? '').localeCompare(a.closed_at ?? a.created_at ?? ''))
  const cap = Math.max(0, Math.floor(answeredCap))
  return {
    open,
    answered: answeredAll.slice(0, cap).map((r) => summarizeMyDispatchRequest(r, now)),
    answeredHidden: Math.max(0, answeredAll.length - cap),
  }
}
