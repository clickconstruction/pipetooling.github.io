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

function entryFromItem(item: JobThreadActivityItem): Omit<JobActivityBoxEntry, 'number'> | null {
  if (item.kind === 'note') {
    return {
      kind: 'note',
      atIso: item.note.created_at,
      authorName: item.note.author?.name?.trim() || null,
      body: (item.note.body ?? '').trim(),
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
