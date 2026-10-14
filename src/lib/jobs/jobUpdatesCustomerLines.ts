/**
 * The tech's door to the customer's lines (v2.5527): Job Mode's Job updates and the Job detail window list a job's
 * calls, texts and emails with its customer beside the notes, under a Customer pill. Pure. The read is
 * `useJobMessages`, under the rows' policies, so a tech gets the lines tied to a job they are on this week or last and
 * never an office-only note. Pipeline's Job activity draws the same lines in its own numbered feed
 * (`jobActivityLine.ts`); this is the panel's version: no numbers, the customer's side only, no link to the thread.
 */
import type { JobThreadActivityItem } from '../../components/JobThreadNotesPanel'
import { activityItemMatchesFilter, type JobActivityFilter } from '../jobActivityFilter'
import { jobActivityItemTimeIso } from './jobActivityBoxFeed'
import { isCustomerSide, messageTone, type JobActivityMessage } from './jobActivityMessages'

/** One row of the panel: the job's own activity, or a line with its customer. */
export type JobUpdatesEntry =
  | { kind: 'item'; item: JobThreadActivityItem }
  | { kind: 'customer'; line: JobActivityMessage }

/** The customer's side of a job's messages, oldest first: her lines and ours to her, never an office-only note. */
export function customerLinesForJobUpdates(messages: readonly JobActivityMessage[]): JobActivityMessage[] {
  return messages
    .filter((m) => !m.officeOnly && isCustomerSide(messageTone(m)))
    .map((m, i) => ({ m, i, t: Date.parse(m.at) }))
    .sort((a, b) => (a.t === b.t || Number.isNaN(a.t) || Number.isNaN(b.t) ? a.i - b.i : a.t - b.t))
    .map(({ m }) => m)
}

/**
 * The panel's rows: the job's activity in the order it came, each customer line put before the first item that is
 * newer. A tie keeps the job's item first. With no lines, the activity as it was.
 */
export function mergeJobUpdates(items: readonly JobThreadActivityItem[], lines: readonly JobActivityMessage[]): JobUpdatesEntry[] {
  const out: JobUpdatesEntry[] = []
  let next = 0
  for (const item of items) {
    const t = Date.parse(jobActivityItemTimeIso(item))
    while (next < lines.length && !Number.isNaN(t) && Date.parse(lines[next]!.at) < t) {
      out.push({ kind: 'customer', line: lines[next]! })
      next++
    }
    out.push({ kind: 'item', item })
  }
  for (; next < lines.length; next++) out.push({ kind: 'customer', line: lines[next]! })
  return out
}

/** Whether a row shows under a pill: a customer line under All and Customer, the job's own items as the panel had them. */
export function jobUpdatesEntryMatches(entry: JobUpdatesEntry, filter: JobActivityFilter): boolean {
  if (filter === 'all') return true
  if (entry.kind === 'customer') return filter === 'customer'
  return filter !== 'customer' && activityItemMatchesFilter(entry.item, filter)
}

export function filterJobUpdates(entries: readonly JobUpdatesEntry[], filter: JobActivityFilter): JobUpdatesEntry[] {
  return filter === 'all' ? [...entries] : entries.filter((e) => jobUpdatesEntryMatches(e, filter))
}

/** Each pill's count, from the rows the filter narrows. 'all' is every row. */
export function countJobUpdates(entries: readonly JobUpdatesEntry[]): Record<JobActivityFilter, number> {
  const counts: Record<JobActivityFilter, number> = { all: entries.length, notes: 0, reports: 0, status: 0, billing: 0, crew: 0, customer: 0 }
  for (const entry of entries) {
    for (const f of ['notes', 'reports', 'status', 'billing', 'crew', 'customer'] as const) {
      if (jobUpdatesEntryMatches(entry, f)) {
        counts[f]++
        break
      }
    }
  }
  return counts
}
