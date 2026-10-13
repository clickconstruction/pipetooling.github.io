/**
 * Messages, residential R1 (the thread's switch): a person's thread with the job activity of the jobs their lines are
 * tied to, between the lines, oldest first. The clock, the reports, the status and the billing that the job activity
 * panel draws on Jobs → Stages come into the thread with each row saying which job it is on. The **Job activity**
 * switch on the thread header turns them on and off, kept per computer: on by default for the office, off on the
 * tech's phone. Lifted from the customer messages prototype (branch spike/gc-mode,
 * `to-dos/gc-mode/messages/customer-messages-prototype.html` v0.8, screen 8: `ROWS`, `paintCmp`'s `herJobs` and
 * `personRows`, `counts`, `showAct` and `setAct`).
 *
 * The other direction, the customer's lines inside the job activity panel, is the registry's (`jobActivityEvent.ts`).
 */
import type { JobThreadActivityItem } from '../../components/JobThreadNotesPanel'
import { bucketForEvent } from '../jobActivityEvent'
import { activityItemMatchesFilter } from '../jobActivityFilter'
import { activitySortMs } from '../jobThreadActivitySort'
import type { ThreadMessage } from './thread'

/** One row of a person's thread: a line of theirs, or a row of a job their lines are tied to. */
export type ThreadActivityRow =
  | {
      kind: 'line'
      message: ThreadMessage
      /** The job the line is tied to. Null: on the person alone, no job tied yet. */
      jobId: string | null
      /** When, in epoch ms, for the merge. */
      ms: number
    }
  | {
      kind: 'activity'
      item: JobThreadActivityItem
      /** The job the row is on: `messages/load.ts`'s `jobKey`, the same string a line's `jobId` carries. */
      jobId: string
      ms: number
    }

export interface ThreadActivityOptions {
  /** The **Job activity** switch. Off: the person's lines alone. */
  on: boolean
  /** The tech's door: leave out every billing row (invoices, payments, contracts, lien releases). */
  noMoney?: boolean
}

/** A money row: the billing bucket, or an event the ledger marks financial. */
function isMoney(item: JobThreadActivityItem): boolean {
  return item.kind === 'event' && (item.event.financial || bucketForEvent(item.event.type) === 'billing')
}

/** The jobs the person's lines are tied to. A job of theirs that no line points at stays out. */
export function tiedJobs(messages: readonly ThreadMessage[]): string[] {
  const seen = new Set<string>()
  for (const m of messages) if (m.jobId) seen.add(m.jobId)
  return [...seen]
}

/**
 * The person's thread, oldest first. With the switch on, each job their lines are tied to brings its activity rows
 * from `activityByJob`, kept per job as the job panel keeps them. Its key is `messages/load.ts`'s `jobKey`
 * (`pipeline:<id>`), the same string a line's `jobId` carries, never a bare jobs ledger id. A line and a row at the
 * same moment keep the line first. A line's own money stays: the tech's door for `messages` rows is the database's.
 */
export function threadWithActivity(
  messages: readonly ThreadMessage[],
  activityByJob: Readonly<Record<string, readonly JobThreadActivityItem[]>>,
  opts: ThreadActivityOptions,
): ThreadActivityRow[] {
  const lines: ThreadActivityRow[] = messages.map((message) => ({
    kind: 'line',
    message,
    jobId: message.jobId,
    ms: Date.parse(message.at),
  }))
  const rows = [...lines]
  if (opts.on) {
    for (const jobId of tiedJobs(messages)) {
      for (const item of activityByJob[jobId] ?? []) {
        if (opts.noMoney && isMoney(item)) continue
        rows.push({ kind: 'activity', item, jobId, ms: activitySortMs(item) })
      }
    }
  }
  return rows.sort((a, b) => a.ms - b.ms || (a.kind === b.kind ? 0 : a.kind === 'line' ? -1 : 1))
}

/** The thread's filters: everything, the person's lines alone, or one bucket of the job activity panel. */
export type ThreadActivityFilter = 'all' | 'lines' | 'notes' | 'reports' | 'status' | 'billing' | 'crew'

const JOB_BUCKETS = ['notes', 'reports', 'status', 'billing', 'crew'] as const

/** Whether a row shows under a filter. A line counts only under All and the person's lines. */
export function threadRowMatches(row: ThreadActivityRow, filter: ThreadActivityFilter): boolean {
  if (filter === 'all') return true
  if (row.kind === 'line') return filter === 'lines'
  return filter !== 'lines' && activityItemMatchesFilter(row.item, filter)
}

/** The counts the filters show, from the same rows they filter, so a count always matches what its press reveals. */
export function activityCounts(rows: readonly ThreadActivityRow[]): Record<ThreadActivityFilter, number> {
  const counts: Record<ThreadActivityFilter, number> = { all: rows.length, lines: 0, notes: 0, reports: 0, status: 0, billing: 0, crew: 0 }
  for (const row of rows) {
    if (row.kind === 'line') {
      counts.lines++
      continue
    }
    const bucket = JOB_BUCKETS.find((f) => activityItemMatchesFilter(row.item, f))
    if (bucket) counts[bucket]++
  }
  return counts
}

/** Where the thread is open: the office's screens, or the tech's phone in Job Mode. */
export type ThreadDoor = 'office' | 'phone'

/** The switch's key per door, so a laptop that also opens Job Mode keeps both. */
export const JOB_ACTIVITY_SWITCH_KEY: Record<ThreadDoor, string> = {
  office: 'messages_job_activity_office',
  phone: 'messages_job_activity_phone',
}

/** On for the office, off on the phone, until someone presses it on that computer. */
export const JOB_ACTIVITY_SWITCH_DEFAULT: Record<ThreadDoor, boolean> = { office: true, phone: false }

export interface JobActivitySwitch {
  on: boolean
  /** Keeps the new setting on this computer and returns it. A storage that refuses still flips it for this visit. */
  set: (on: boolean) => boolean
}

/**
 * The **Job activity** switch over a storage the caller passes (`localStorage` on the screen). A storage that throws,
 * as a private window can, reads as the door's default.
 */
export function switchState(
  read: (key: string) => string | null,
  write: (key: string, value: string) => void,
  door: ThreadDoor,
): JobActivitySwitch {
  const key = JOB_ACTIVITY_SWITCH_KEY[door]
  let on = JOB_ACTIVITY_SWITCH_DEFAULT[door]
  try {
    const kept = read(key)
    if (kept === '1') on = true
    else if (kept === '0') on = false
  } catch {
    // the default stands
  }
  return {
    on,
    set: (next) => {
      try {
        write(key, next ? '1' : '0')
      } catch {
        // kept for this visit only
      }
      return next
    },
  }
}
