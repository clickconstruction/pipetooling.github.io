import type { JobThreadActivityItem } from '../../components/JobThreadNotesPanel'

/**
 * Feed shaping for the Pipeline row "Job activity" box (wide desktop only):
 * the conversational trail — thread NOTES (incl. % auto-notes and arrived/
 * leaving stamps) and REPORTS — numbered chronologically with 1 = OLDEST so a
 * note's number never shifts as new ones arrive ("check note 3" stays note 3).
 * Schedule/clock/event synthetic items are excluded: they're timeline texture,
 * not conversation, and the full thread panel already carries them.
 */

export type JobActivityBoxEntry = {
  /** Stable conversational number — 1 is the oldest note/report on the job. */
  number: number
  kind: 'note' | 'report'
  atIso: string
  authorName: string | null
  body: string
}

/**
 * v2.1640: arrive/leave stamp notes store "Name · Wed, Aug 12, 2026 at 11:58 AM
 * — Leaving job" as their body (`buildJobThreadStampBody`) — but this box
 * already prints the author and time as line meta, so the body's copy is pure
 * duplication. Reduce a recognized stamp body to its phrase; anything that
 * doesn't match the exact stamp shape (manual notes, edited text) passes
 * through untouched. Display-only — other surfaces keep the full body.
 */
const STAMP_BODY_RE = /^.+ · .+ — (Arrived at job|Leaving job)$/

export function stripRedundantStampBody(body: string): string {
  const m = STAMP_BODY_RE.exec(body)
  return m ? m[1]! : body
}

function entryFromItem(item: JobThreadActivityItem): Omit<JobActivityBoxEntry, 'number'> | null {
  if (item.kind === 'note') {
    return {
      kind: 'note',
      atIso: item.note.created_at,
      authorName: item.note.author?.name?.trim() || null,
      body: stripRedundantStampBody((item.note.body ?? '').trim()),
    }
  }
  if (item.kind === 'report') {
    return {
      kind: 'report',
      atIso: item.report.created_at,
      authorName: (item.report.created_by_name ?? '').trim() || null,
      body: `Report: ${(item.report.template_name ?? '').trim() || 'Report'}`,
    }
  }
  return null
}

/**
 * Numbered feed, NEWEST FIRST (the box renders top-down from the latest).
 * Items are re-sorted by time here so numbering never depends on the caller's
 * ordering; ties keep input order.
 */
export function buildJobActivityBoxFeed(items: JobThreadActivityItem[]): JobActivityBoxEntry[] {
  const entries = items
    .map(entryFromItem)
    .filter((e): e is Omit<JobActivityBoxEntry, 'number'> => e !== null)
    .map((e, inputIndex) => ({ e, inputIndex, t: Date.parse(e.atIso) }))
    .sort((a, b) => (a.t === b.t || Number.isNaN(a.t) || Number.isNaN(b.t) ? a.inputIndex - b.inputIndex : a.t - b.t))
  return entries.map(({ e }, i) => ({ ...e, number: i + 1 })).reverse()
}
